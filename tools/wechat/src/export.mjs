#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { Resvg } from "@resvg/resvg-js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const args = process.argv.slice(2);
const input = args.find((arg) => !arg.startsWith("--"));
const coverArg = args.find((arg) => arg.startsWith("--cover="));

if (!input) {
  console.error("用法: npm run export -- <slug-or-path> [--cover=path/to/cover.png]");
  process.exit(1);
}

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

function readBaseURL() {
  const configPath = path.join(repoRoot, "hugo.toml");
  const config = fs.readFileSync(configPath, "utf8");
  const match = config.match(/^baseURL\s*=\s*"([^"]+)"/m);
  return (match?.[1] ?? "https://wlyb2021.github.io/").replace(/\/?$/, "/");
}

function resolvePostPath(value) {
  if (value.endsWith(".md")) return path.resolve(process.cwd(), value);

  const direct = path.resolve(process.cwd(), value);
  if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct;

  return path.join(repoRoot, "content", "posts", `${value}.md`);
}

function transformProse(markdown, transform) {
  let fenced = false;

  return markdown
    .split(/\r?\n/)
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        fenced = !fenced;
        return line;
      }
      if (fenced) return line;

      // 必须按整行处理：链接标签可能包含 inline code，
      // 例如 [`stateIn`](https://...)。先按反引号切分会把链接切断。
      return transform(line);
    })
    .join("\n");
}

function stripReferenceSection(markdown) {
  const lines = markdown.split(/\r?\n/);
  let fenced = false;
  let referenceHeading = -1;

  for (let index = 0; index < lines.length; index += 1) {
    if (/^\s*(```|~~~)/.test(lines[index])) {
      fenced = !fenced;
      continue;
    }
    if (!fenced && /^##\s+参考\s*$/.test(lines[index])) {
      referenceHeading = index;
    }
  }

  if (referenceHeading === -1) return markdown.trimEnd();
  return lines.slice(0, referenceHeading).join("\n").trimEnd();
}

function collectReferences(markdown) {
  const references = [];
  const byURL = new Map();

  function register(label, url) {
    const key = url.replace(/\/$/, "");
    if (!byURL.has(key)) {
      byURL.set(key, references.length + 1);
      references.push({ label, url });
    }
    return byURL.get(key);
  }

  const markdownLink = /(?<!!)\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
  const angleLink = /<(https?:\/\/[^>\s]+)>/g;

  transformProse(markdown, (segment) => {
    segment.replace(markdownLink, (full, label, url) => {
      register(label, url);
      return full;
    });
    segment.replace(angleLink, (full, url) => {
      register(url, url);
      return full;
    });
    return segment;
  });

  return { references, register };
}

function svgWidth(svg) {
  const match = svg.match(/<svg\b[^>]*\bwidth="([0-9.]+)"/i);
  return match ? Number(match[1]) : 0;
}

function normalizeSvg(svg) {
  return svg.replace(
    /var\(\s*--[\w-]+\s*,\s*(#[0-9a-fA-F]{3,8})\s*\)/g,
    "$1",
  );
}

function renderSvg(sourcePath, outputPath) {
  const source = normalizeSvg(fs.readFileSync(sourcePath, "utf8"));
  const width = svgWidth(source) || 760;
  const targetWidth = Math.min(1600, Math.max(1080, Math.round(width * 2)));

  const renderer = new Resvg(source, {
    background: "#fbfaf8",
    fitTo: { mode: "width", value: targetWidth },
    font: {
      loadSystemFonts: true,
      defaultFontFamily: "Microsoft YaHei",
    },
  });
  const rendered = renderer.render();

  fs.writeFileSync(outputPath, rendered.asPng());
  return { width: rendered.width, height: rendered.height };
}

function copyCover(value, outputDir) {
  if (!value) return null;

  const source = path.resolve(process.cwd(), value.replace(/^--cover=/, ""));
  if (!fs.existsSync(source)) fail(`找不到封面图: ${source}`);

  const extension = path.extname(source).toLowerCase();
  if (extension === ".svg") {
    const target = path.join(outputDir, "cover.png");
    const size = renderSvg(source, target);
    return { file: "cover.png", ...size };
  }

  const targetName = `cover${extension || ".png"}`;
  fs.copyFileSync(source, path.join(outputDir, targetName));
  return { file: targetName };
}

const postPath = resolvePostPath(input);
if (!fs.existsSync(postPath)) fail(`找不到文章: ${postPath}`);

const source = fs.readFileSync(postPath, "utf8");
const parsed = matter(source);
const data = parsed.data;
const title = String(data.title ?? "").trim();
if (!title) fail("front matter 缺少 title");

const slug = String(data.slug ?? path.basename(postPath, ".md")).trim();
const outputDir = path.join(repoRoot, "dist", "wechat", slug);
const assetsDir = path.join(outputDir, "assets");

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(assetsDir, { recursive: true });

const { references, register } = collectReferences(parsed.content);
let body = stripReferenceSection(parsed.content);

const images = [];
const imageOutputs = new Map();

body = transformProse(body, (segment) =>
  segment.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (full, alt, rawURL) => {
    if (/^https?:\/\//i.test(rawURL)) {
      fail(`暂不支持远程图片，请先下载到本地: ${rawURL}`);
    }

    const urlPath = rawURL.split("?")[0];
    const sourcePath = urlPath.startsWith("/")
      ? path.join(repoRoot, "static", urlPath.replace(/^\//, ""))
      : path.resolve(path.dirname(postPath), urlPath);

    if (!fs.existsSync(sourcePath)) fail(`找不到文章图片: ${sourcePath}`);

    if (imageOutputs.has(sourcePath)) {
      return `![${alt}](./assets/${imageOutputs.get(sourcePath)})`;
    }

    const extension = path.extname(sourcePath).toLowerCase();
    const basename = urlPath
      .replace(/^\//, "")
      .replace(/\.[^.]+$/, "")
      .replace(/[\\/]/g, "-");
    const outputName = `${basename}${extension === ".svg" ? ".png" : extension}`;
    const outputPath = path.join(assetsDir, outputName);

    if (extension === ".svg") {
      const size = renderSvg(sourcePath, outputPath);
      images.push({ file: `assets/${outputName}`, source: urlPath, ...size });
    } else {
      fs.copyFileSync(sourcePath, outputPath);
      images.push({ file: `assets/${outputName}`, source: urlPath });
    }

    imageOutputs.set(sourcePath, outputName);
    return `![${alt}](./assets/${outputName})`;
  }),
);

body = transformProse(body, (segment) =>
  segment
    .replace(
      /(?<!!)\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      (full, label, url) => `${label}<sup>[${register(label, url)}]</sup>`,
    )
    .replace(/<(https?:\/\/[^>\s]+)>/g, (full, url) => {
      const index = register(url, url);
      return `${url}<sup>[${index}]</sup>`;
    }),
);

const unresolvedLinks = [];
transformProse(body, (segment) => {
  for (const match of segment.matchAll(
    /(?<!!)\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
  )) {
    unresolvedLinks.push(match[0]);
  }
  return segment;
});

if (unresolvedLinks.length > 0) {
  fail(`仍有 ${unresolvedLinks.length} 条外链未转换，例如: ${unresolvedLinks[0]}`);
}

if (references.length > 0) {
  const list = references
    .map((reference, index) => {
      return `${index + 1}. ${reference.label} — ${reference.url}`;
    })
    .join("\n");

  body += `\n\n## 参考\n\n${list}`;
}

const cover = copyCover(coverArg, outputDir);
const baseURL = readBaseURL();
const sourceURL = new URL(`posts/${slug}/`, baseURL).href;
const meta = {
  title,
  slug,
  author: data.author ?? "Xi",
  digest: data.description ?? "",
  sourceUrl: sourceURL,
  cover,
  images,
};

fs.writeFileSync(path.join(outputDir, "article.md"), `${body.trim()}\n`);
fs.writeFileSync(
  path.join(outputDir, "meta.json"),
  `${JSON.stringify(meta, null, 2)}\n`,
);

console.log(`\n✓ 已生成公众号发布包`);
console.log(`  目录: ${path.relative(repoRoot, outputDir)}`);
console.log(`  图片: ${images.length} 张`);
console.log(`  脚注: ${references.length} 条`);
console.log(`  封面: ${cover ? cover.file : "未提供（可用 --cover=... 指定）"}`);

if (!cover) {
  console.log("\n下一步: 先补一张 2.35:1 封面，再用 md2wechat 或 Doocs/md 转入草稿箱。");
} else {
  console.log("\n下一步: 用 md2wechat 或 Doocs/md 检查样式，再写入公众号草稿箱。");
}
