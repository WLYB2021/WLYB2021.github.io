# Hugo + PaperMod 博客模板

个人主页式博客模板：首页展示技术栈与作品集，配套技术文章与 Giscus 评论。GitHub Actions 自动发布到 GitHub Pages。

> 这是一个**空白模板**，不含任何个人信息。所有 `yourname` / `Your Name` 占位符需要替换成你自己的。

## 目录结构

```
.
├── hugo.toml                    # 站点全部配置（主题/菜单/SEO/Giscus/社交图标）
├── content/
│   ├── _index.md                # 首页 = 技术栈 + 作品集（已脱敏，不含雇主信息）
│   ├── about.md                 # 关于我
│   ├── search.md                # 搜索页
│   ├── archives.md              # 归档页
│   └── posts/                   # 博客文章
│       ├── android-automotive-tel-practice.md
│       ├── retrofit-to-ktor-migration.md
│       └── agent-skill-workflow.md
├── layouts/partials/
│   ├── comments.html            # 覆盖主题评论模板，接入 giscus
│   └── giscus.html              # Giscus 嵌入组件
├── assets/css/extended/
│   └── custom.css               # 定制样式（首页 Hero、卡片、表格等）
├── static/images/               # 头像等静态资源
└── .github/workflows/
    └── deploy.yml               # GitHub Actions：push main → 自动构建发布
```

## 前置要求

本地预览需要 **Hugo extended 版**（支持 SCSS）。本机已放在 `D:\MyFile\hugo-bin\hugo.exe`。

```bash
# 构建
hugo --minify --gc

# 本地预览（http://localhost:1313）
hugo server --bind 0.0.0.0 --port 1313
```

> 主题放在 `themes/PaperMod`（已被 .gitignore 忽略）。新机器上需先克隆：
> `git clone --depth 1 --branch v8.0 https://github.com/adityatelange/hugo-PaperMod.git themes/PaperMod`

## 部署到 GitHub Pages

1. **新建仓库**：在 GitHub 新建一个名为 **`WLYB2021.github.io`** 的仓库（Public —— Giscus 要求仓库公开）。

   > ⚠️ 仓库名必须与账号名完全一致，这是 GitHub「用户站点」的唯一命名方式。仓库一旦创建不可改名，改名会导致 URL 失效。

2. **推送代码**：

   ```bash
   cd D:/MyFile/WLYB2021.github.io
   git init
   git add .
   git commit -m "init: hugo blog"
   git branch -M main
   git remote add origin https://github.com/WLYB2021/WLYB2021.github.io.git
   git push -u origin main
   ```

3. **开启 Pages**：仓库 `Settings → Pages → Source` 选 **GitHub Actions**。

4. **开启 Discussions**（评论必需）：`Settings → General → Features → 勾选 Discussions`。

5. 等待 Actions 跑完，站点访问 `https://wlyb2021.github.io/`。

## 配置 Giscus 评论

1. 打开 <https://giscus.app>，填写：
   - Repository：`WLYB2021/WLYB2021.github.io`
   - Category：`Announcements`（或新建一个如 `Comments`）
   - Mapping：`pathname`
   - Theme：`preferred_color_scheme`
2. 把生成的 `repo`、`repoID`、`category`、`categoryID` 填进 `hugo.toml` 的 `[params.giscus]`：

   ```toml
   [params.giscus]
   repo       = "yourname/blog"
   repoID     = "R_kgDOxxxxxxxx"     # ← 换成你的
   category   = "Announcements"
   categoryID = "DIC_kwDOxxxxxxx"    # ← 换成你的
   ```

## 写新文章

在 `content/posts/` 下新建 `.md`，带上前置元数据：

```markdown
---
title: "文章标题"
date: 2026-10-08T10:00:00+08:00
tags: ["Android", "Kotlin"]
categories: ["技术实践"]
description: "一句话摘要，显示在列表页"
---

正文内容…
```

推送到 main 分支即自动发布。

## 需要替换的占位符

站点地址与GitHub 用户名已填好（仓库 `WLYB2021.github.io`）。其余 `Your Name` / `you@example.com` 等需要替换：

| 位置 | 文件 | 占位内容 |
|---|---|---|
| 作者名 | `hugo.toml` | `Your Name`（`params.author`、`profile.title`、版权行） |
| 个人简介 | `hugo.toml` | `profile.subtitle`、`params.description` |
| 邮箱 | `hugo.toml` | `you@example.com`（不公开联系方式可删掉该 `[[params.social]]` 段） |
| Giscus ID | `hugo.toml` | `repoID` / `categoryID`（`repo` 已填好） |
| 首页内容 | `content/_index.md` | Hero、技术栈卡片、作品集、最近文章 |
| 关于页 | `content/about.md` | 自我介绍、联系方式 |
| 项目链接 | `content/_index.md`、`about.md` | `yourname/project` |
| 示例文章 | `content/posts/` | `first-post.md`、`second-post.md` 可直接删除 |
| 头像 | `static/images/` | 未放图片时侧边栏不显示头像 |

## 功能开关

在 `hugo.toml` 的 `[params]` 下常用开关：

```toml
comments = false          # 关闭评论
ShowToc = false           # 关闭右侧目录
ShowReadingTime = false   # 关闭阅读时长
ShowCodeCopyButtons = false
defaultTheme = "light"    # "light" / "dark" / "auto"
```

单篇文章不想显示评论：

```yaml
---
disable_comments: true
---
```

> 未配置 Giscus ID 前，评论框不会显示内容（脚本报 404）。其余功能不受影响。