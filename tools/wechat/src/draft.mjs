#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

const here = path.dirname(fileURLToPath(import.meta.url));
const toolsDir = path.resolve(here, "..");
const repoRoot = path.resolve(toolsDir, "../..");
const API_BASE = "https://api.weixin.qq.com";
const MAX_CONTENT_CHARS = 19_900;
const args = process.argv.slice(2);
const slug = args.find((arg) => !arg.startsWith("--"));
const previewOnly = args.includes("--preview");

if (!slug) {
  console.error("用法: npm run draft -- <slug> [--preview]");
  process.exit(1);
}

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

function fatal(error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\n✗ 执行失败: ${message.slice(0, 500)}\n`);
  process.exit(1);
}

process.on("uncaughtException", fatal);
process.on("unhandledRejection", fatal);

function loadEnv(file) {
  if (!fs.existsSync(file)) return;

  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function charCount(value) {
  return Array.from(value).length;
}

function mimeType(file) {
  const extension = path.extname(file).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".gif") return "image/gif";
  fail(`公众号图片只支持 PNG/JPEG/GIF: ${file}`);
}

function renderWechatHtml(markdown, { compact = false } = {}) {
  const base =
    "font-size:15px;line-height:1.75;color:#2b2b2b;letter-spacing:.02em;text-align:left;";
  const h2 = compact
    ? "margin:22px 0 9px;font-size:19px;font-weight:700;"
    : "margin:26px 0 11px;padding-bottom:6px;border-bottom:1px solid #e8e4de;font-size:19px;font-weight:700;";
  const h3 = "margin:20px 0 7px;font-size:16px;font-weight:700;";
  const pre = compact
    ? "margin:13px 0;padding:9px;background:#f6f4f0;font-family:inherit;font-size:12px;line-height:1.5;overflow-x:auto;"
    : "margin:15px 0;padding:11px;border:1px solid #e8e4de;border-radius:6px;background:#f6f4f0;font-family:inherit;font-size:12px;line-height:1.5;overflow-x:auto;";
  const table = "width:100%;margin:16px 0;border-collapse:collapse;font-size:13px;";
  const cell = compact ? "padding:4px;" : "padding:6px;border:1px solid #e8e4de;";
  const image = "display:block;width:100%;height:auto;margin:18px auto;";
  const quote =
    "margin:18px 0;padding:8px 14px;border-left:3px solid #b03a2e;" +
    "background:#fbfaf8;color:#6f6b66;";
  let html = marked.parse(markdown, { gfm: true });
  html = html.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, "$1");
  html = html.replace(
    /(<h2(?:\s[^>]*)?>参考<\/h2>\s*)<ol[^>]*>([\s\S]*?)<\/ol>/i,
    (full, heading, list) => {
      const items = [...list.matchAll(/<li(?:\s[^>]*)?>([\s\S]*?)<\/li>/gi)]
        .map((match) => match[1].replace(/<\/?p[^>]*>/gi, "").trim())
        .filter(Boolean);
      if (items.length === 0) return full;

      const lines = items
        .map((item, index) => `${index + 1}. ${item}`)
        .join("<br>");
      return `${heading}<section style="text-align:left;word-break:break-all;font-size:10px;line-height:1;"><p>${lines}</p></section>`;
    },
  );
  html = html.replace(/<h2([^>]*)>/gi, (full, attrs) => `<h2${attrs} style="${h2}">`);
  html = html.replace(/<h3([^>]*)>/gi, (full, attrs) => `<h3${attrs} style="${h3}">`);
  // 公众号版不保留 code 标签：行内 code 使用正文默认字体，
  // 代码块靠 pre 的底色和换行区分，避免等宽字体回退成宋体。
  html = html.replace(/<\/?code\b[^>]*>/gi, "");
  // 公众号网页编辑器会折叠 <pre> 内的换行与连续空格，导致代码挤成一行。
  // 改为显式 <br> 换行、空格转 &nbsp;，不再依赖 white-space 保留空白。
  html = html.replace(/<pre\b([^>]*)>([\s\S]*?)<\/pre>/gi, (full, attrs, inner) => {
    const lines = inner
      .replace(/\r\n/g, "\n")
      .replace(/^\n+|\n+$/g, "")
      .split("\n")
      .map((line) => line.replace(/ /g, "&nbsp;"))
      .join("<br>");
    return `<pre${attrs} style="${pre}">${lines}</pre>`;
  });
  html = html.replace(/<table>/gi, `<table style="${table}">`);
  html = html.replace(/<th(\s[^>]*)?>/gi, (full, attrs = "") => `<th${attrs} style="${cell}">`);
  html = html.replace(/<td(\s[^>]*)?>/gi, (full, attrs = "") => `<td${attrs} style="${cell}">`);
  html = html.replace(/<blockquote>/gi, `<blockquote style="${quote}">`);
  html = html.replace(/<img\b([^>]*)>/gi, (full, attrs) => {
    const clean = attrs.replace(/\/\s*$/, "").replace(/\sstyle="[^"]*"/gi, "");
    return `<img${clean} style="${image}">`;
  });

  return `<section style="${base}">${html}</section>`;
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function projectedImageContent(html, images) {
  let projected = html;
  const placeholder = `src="${"x".repeat(180)}"`;

  for (const image of images) {
    projected = projected.replaceAll(`src="./${image.file}"`, placeholder);
  }

  return projected;
}

function previewDocument(title, content) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHTML(title)}</title>
<style>
  body { margin: 0; background: #f3f1ed; }
  article { box-sizing: border-box; max-width: 720px; margin: 32px auto; padding: 36px 28px; background: #fff; }
  img { max-width: 100%; }
</style>
</head>
<body>
<article>${content}</article>
</body>
</html>
`;
}

async function requestJSON(url, options = {}) {
  let response;
  try {
    response = await fetch(url, { ...options, signal: AbortSignal.timeout(45_000) });
  } catch (error) {
    fail(`请求微信接口失败: ${error.message}`);
  }

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    fail(`微信接口返回了非 JSON 内容 (${response.status}): ${text.slice(0, 300)}`);
  }

  if (!response.ok) fail(`微信接口 HTTP ${response.status}: ${text.slice(0, 300)}`);
  if (data.errcode) {
    const hints = {
      40001: "access_token 无效，检查 AppID / AppSecret。",
      40164: "调用 IP 不在白名单，请到公众号后台配置当前公网 IP。",
      45009: "接口调用频次超限。",
      48001: "账号没有该接口权限，请检查账号类型与认证状态。",
    };
    const hint = hints[data.errcode] ? ` ${hints[data.errcode]}` : "";
    fail(`微信接口错误 ${data.errcode}: ${data.errmsg}${hint}`);
  }

  return data;
}

async function getAccessToken(appId, appSecret) {
  const url =
    `${API_BASE}/cgi-bin/token?grant_type=client_credential` +
    `&appid=${encodeURIComponent(appId)}&secret=${encodeURIComponent(appSecret)}`;
  const data = await requestJSON(url);
  if (!data.access_token) fail("微信没有返回 access_token");
  return data.access_token;
}

async function uploadBodyImage(token, file) {
  const stat = fs.statSync(file);
  if (stat.size > 1024 * 1024) fail(`正文图片超过 1MB: ${file}`);

  const form = new FormData();
  form.append(
    "media",
    new Blob([fs.readFileSync(file)], { type: mimeType(file) }),
    path.basename(file),
  );

  const data = await requestJSON(
    `${API_BASE}/cgi-bin/media/uploadimg?access_token=${encodeURIComponent(token)}`,
    { method: "POST", body: form },
  );
  if (!data.url) fail(`正文图片上传后没有返回 URL: ${file}`);
  return data.url;
}

async function uploadCover(token, file) {
  const stat = fs.statSync(file);
  if (stat.size > 10 * 1024 * 1024) fail(`封面超过 10MB: ${file}`);

  const form = new FormData();
  form.append(
    "media",
    new Blob([fs.readFileSync(file)], { type: mimeType(file) }),
    path.basename(file),
  );

  const data = await requestJSON(
    `${API_BASE}/cgi-bin/material/add_material?access_token=${encodeURIComponent(token)}&type=image`,
    { method: "POST", body: form },
  );
  if (!data.media_id) fail("封面上传后没有返回 media_id");
  return data.media_id;
}

async function createDraft(token, meta, html, thumbMediaId) {
  const payload = {
    articles: [
      {
        article_type: "news",
        title: meta.title,
        author: meta.author,
        digest: meta.digest,
        content: html,
        content_source_url: meta.sourceUrl,
        thumb_media_id: thumbMediaId,
        need_open_comment: 0,
        only_fans_can_comment: 0,
      },
    ],
  };

  return requestJSON(
    `${API_BASE}/cgi-bin/draft/add?access_token=${encodeURIComponent(token)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
}

loadEnv(path.join(toolsDir, ".env"));

const outputDir = path.join(repoRoot, "dist", "wechat", slug);
const articlePath = path.join(outputDir, "article.md");
const metaPath = path.join(outputDir, "meta.json");
if (!fs.existsSync(articlePath) || !fs.existsSync(metaPath)) {
  fail(`找不到发布包。请先运行: npm run export -- ${slug}`);
}

const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
const markdown = fs.readFileSync(articlePath, "utf8");
const previewPath = path.join(outputDir, "preview.html");
let html = renderWechatHtml(markdown);
let contentChars = charCount(html);
let projectedChars = charCount(projectedImageContent(html, meta.images ?? []));
let compact = false;

if (contentChars >= MAX_CONTENT_CHARS || projectedChars >= MAX_CONTENT_CHARS) {
  html = renderWechatHtml(markdown, { compact: true });
  contentChars = charCount(html);
  projectedChars = charCount(projectedImageContent(html, meta.images ?? []));
  compact = true;
}

fs.writeFileSync(previewPath, previewDocument(meta.title, html));

const titleChars = charCount(meta.title);
const authorChars = charCount(meta.author ?? "");
const digestChars = charCount(meta.digest ?? "");
if (titleChars > 32) fail(`标题 ${titleChars} 字，超过公众号 32 字限制`);
if (authorChars > 16) fail(`作者 ${authorChars} 字，超过公众号 16 字限制`);
if (digestChars > 120) fail(`摘要 ${digestChars} 字，超过公众号 120 字限制`);
if (Buffer.byteLength(meta.sourceUrl ?? "", "utf8") >= 1024) {
  fail("原文地址超过公众号 1KB 限制");
}

console.log(`\n预览: ${path.relative(repoRoot, previewPath)}`);
console.log(`正文 HTML: ${contentChars} 字符`);
console.log(`图片上传后预计: ${projectedChars} 字符`);
if (compact) console.log("已启用紧凑排版，以满足公众号字符上限。");

if (contentChars >= MAX_CONTENT_CHARS || projectedChars >= MAX_CONTENT_CHARS) {
  fail("正文超过公众号草稿字符限制，需要精简公众号版或拆分文章");
}
if (Buffer.byteLength(html, "utf8") >= 1024 * 1024) {
  fail("正文 HTML 超过公众号 1MB 限制");
}

if (previewOnly) {
  console.log("\n✓ 仅生成预览，未调用公众号接口。");
  process.exit(0);
}

const appId = process.env.WECHAT_APP_ID;
const appSecret = process.env.WECHAT_APP_SECRET;
if (!appId || !appSecret) {
  fail("缺少 WECHAT_APP_ID / WECHAT_APP_SECRET，请在 tools/wechat/.env 中配置");
}
if (!meta.cover?.file) fail("缺少封面，请用 --cover 重新导出发布包");
if (!meta.sourceUrl) fail("meta.json 缺少 sourceUrl");

const coverPath = path.join(outputDir, meta.cover.file);
if (!fs.existsSync(coverPath)) fail(`找不到封面: ${coverPath}`);

console.log("\n获取 access_token...");
const token = await getAccessToken(appId, appSecret);

console.log("上传正文图片...");
let remoteHtml = html;
for (const image of meta.images ?? []) {
  const imagePath = path.join(outputDir, image.file);
  if (!fs.existsSync(imagePath)) fail(`找不到正文图片: ${imagePath}`);
  const remoteURL = await uploadBodyImage(token, imagePath);
  remoteHtml = remoteHtml.replaceAll(`src="./${image.file}"`, `src="${remoteURL}"`);
}

if (remoteHtml.includes('src="./assets/')) {
  fail("仍有正文图片没有上传到公众号图床");
}

contentChars = charCount(remoteHtml);
console.log(`上传后的正文 HTML: ${contentChars} 字符`);
if (contentChars >= MAX_CONTENT_CHARS) {
  fail("上传后的正文超过公众号字符限制，请精简公众号版或拆分文章");
}
if (Buffer.byteLength(remoteHtml, "utf8") >= 1024 * 1024) {
  fail("上传后的正文超过 1MB");
}

console.log("上传封面...");
const coverMediaId = await uploadCover(token, coverPath);

console.log("创建草稿...");
const draft = await createDraft(token, meta, remoteHtml, coverMediaId);

console.log("\n✓ 已创建公众号草稿");
console.log(`  media_id: ${draft.media_id}`);
console.log("  请到公众号后台草稿箱检查排版、封面和摘要，再人工群发。");
