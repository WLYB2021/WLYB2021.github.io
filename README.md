# wlyb2021.github.io · Xi 的博客

个人主页 + 博客，Hugo + PaperMod 深度定制为「杂志编辑风」版式：首页 = 报头（刊名 / 导航 / 项目 / 社交）+ 文章流；文章页 = 双栏正文 + 目录，导航随滚动在两栏间迁移。部署在 GitHub Pages。

> 不是通用模板 —— 版式与主题强耦合。如果你要拿去改，先读下面的「主题依赖」。

## 目录结构

```
.
├── hugo.toml                     # 站点全部配置（含逐段注释）
├── content/
│   ├── _index.md                 # 首页占位（内容由 layouts/index.html 渲染）
│   ├── about.md                  # 关于（layout: plain，朴素页）
│   ├── archives.md               # 归档（layout: archives，自建模板）
│   ├── search.md                 # 搜索（layout: search，自建模板）
│   └── posts/                    # 文章
├── data/
│   └── projects.toml             # 首页「项目」区块的数据源
├── layouts/
│   ├── index.html                # 首页（报头 + 项目 + 文章流 + 单页导航 SPA）
│   ├── 404.html                  # 404（Hugo 据此生成站点根的 /404.html）
│   ├── _default/
│   │   ├── baseof.html           # 覆盖主题：加 body class（home / ed-single-body）
│   │   ├── single.html           # 文章页（双栏 + 悬浮迁移布局 + 交互脚本）
│   │   ├── list.html             # 列表页（杂志式卡片流）
│   │   ├── terms.html            # 标签总览页（发丝线行列表）
│   │   ├── archives.html         # 归档页（按年分节 + 卡片流）
│   │   ├── search.html           # 搜索页（零依赖前端搜索）
│   │   ├── plain.html            # 通用朴素页（layout: "plain"，about 用）
│   │   └── _markup/
│   │       └── render-image.html # 图片渲染钩子（lazy + decoding + 宽高防 CLS）
│   └── partials/
│       ├── nav_menu.html         # 导航（id=ed-menu，避免与顶栏 #menu 撞 id）
│       ├── post_header.html      # 文章页 header（标题 / 副标题 / meta；面包屑已移除）
│       ├── post_meta.html        # 覆盖主题：追加「更新于 X」（GitInfo lastmod）
│       ├── page_head.html        # 统一栏目头（首页 / 列表 / 标签 / 归档 / 关于 / 搜索）
│       ├── toc.html              # 自建目录：自适应两级
│       ├── theme_icon.html       # 主题切换双图标（可复用）
│       ├── spa_handoff.html      # 单页导航「回程」逻辑（首页外页面复用）
│       ├── giscus.html           # Giscus 评论组件
│       └── comments.html         # 接线到 giscus
├── assets/css/extended/
│   └── custom.css                # 全部定制样式（分段注释）
├── static/
│   ├── favicon.svg               # 站点图标（矢量）
│   ├── favicon-16x16.png         # PNG 版（PaperMod 的 <link> 硬编码 png 类型）
│   ├── favicon-32x32.png
│   └── images/og-default.png     # 分享卡片默认图 1200×630
├── scripts/
│   ├── dev.sh                    # 本地一键预览（克隆主题 + 补丁 + hugo server）
│   └── patch-theme.sh            # PaperMod v8.0 在新版 Hugo 下的兼容补丁（幂等）
├── Makefile                      # make serve / make build
└── .github/workflows/deploy.yml  # push main → 构建 → GitHub Pages
```

## 本地预览

前置：Hugo **extended**（`brew install hugo`；版本 ≥ 0.146，CI 用 0.167.0）。

```bash
make serve        # = ./scripts/dev.sh：自动克隆主题、打补丁、起服务
```

手动方式：

```bash
git clone --depth 1 --branch v8.0 https://github.com/adityatelange/hugo-PaperMod.git themes/PaperMod
./scripts/patch-theme.sh themes/PaperMod   # 必须执行，否则新版 Hugo 构建失败
hugo server
```

## 写新文章

```bash
hugo new posts/xxx.md    # 脚手架默认 draft: true，发布前改 false
```

**标题层级约定（重要）**：正文从 h2 开始写，不要用 h1 —— 文章标题是页面唯一的 h1；自建目录（`layouts/partials/toc.html`）取"最小标题层级 + 一级"共两级展示。当前约定：

| 层级 | 语义 | 目录 |
|---|---|---|
| h2 | 阶段 / 大节 | 第一层（加粗） |
| h3 | 章 | 第二层 |
| h4 / h5 | 节 / 子节 | 不进目录 |

front matter 常用字段：

```yaml
---
title: "文章标题"
date: 2026-10-08T10:00:00+08:00
draft: false
slug: "url-slug"          # 建议显式指定，避免中文转码 URL
tags: ["KMP", "架构"]
description: "一句话摘要；显示在首页卡片与分享卡片"
---
```

`lastmod` 不用手写 —— `enableGitInfo` 开着，取最后一次提交时间，文章页 meta 显示「更新于 X」（与发布日期不同天时才出现）。

## 首页配置速查

都在 `hugo.toml`：

| 想改什么 | 位置 |
|---|---|
| 报头文章流条数 / 标题 / meta 开关 | `[params.home]` |
| 报头自我介绍两行文案 | `params.description` + `[params.profile]` 的 `desc` |
| 项目区块 | `data/projects.toml`（加一段 `[[project]]` 即可） |
| 导航菜单 | `[[menu.main]]`（weight 控制顺序） |
| 社交图标 | `[[params.social]]`（icon 名对应主题 `svg.html`，邮箱统一读 `params.email`） |
| 评论 | `[params.giscus]`（整站开关：`params.comments`；单篇关：front matter `disable_comments: true`） |
| OG 分享图 | `static/images/og-default.png`（1200×630） |

## 部署

push 到 `main` 即自动发布。仓库 Settings 需开启：Pages → Source = **GitHub Actions**；General → Discussions（Giscus 依赖）。CI 会校验构建产物（index.html / 404.html / sitemap / RSS / OG 图），缺件即失败。

## 主题依赖（升级 PaperMod 前必读）

自定义模板直接调用以下主题 partial，**升级主题后如构建失败，优先核对这些是否被改名/删除**：

- 被 `{{ partial }}` 引用：`post_meta`、`svg`、`cover`、`anchored_headings`、`post_nav_links`、`share_icons`、`translation_list`、`edit_post`、`post_canonical`、`head`、`header`、`footer`、`author`
- 主题机制依赖：`head.html`（CSS 打包）、`footer.html`（主题切换 / 平滑锚点 / 复制代码脚本，绑定 `#theme-toggle` 与 `#menu`）、`templates/*`（OG / schema）、`index.json`（搜索）、`archives.html`、`search.html`、`terms.html`、`404.html`

已知限制：

- 页脚「Powered by Hugo & PaperMod」在主题 `footer.html` 里硬编码，无法用配置关闭；© 行的年份由主题取构建年，不会过期
- Giscus 分类用的默认 `Announcements`；介意杂音可在仓库 Discussions 新建 `Comments` 分类后替换 `[params.giscus]` 的两项 ID
- 标题字体走系统衬线栈（Georgia / Songti SC / SimSun…），不加载 Web 字体 —— 这是刻意的（fonts.googleapis.com 在中国大陆常连不通，且中文 Web 字体动辄数 MB，收益仅在标题几个字）
- `params.social` 的图标名必须能被主题 `svg.html` 识别（按 `name` 小写匹配）
