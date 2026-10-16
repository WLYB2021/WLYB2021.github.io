# 维护手册

本文件收纳维护站点时的细节：目录结构、首页配置、主题依赖、升级注意事项。日常使用请先看根目录的 [README](../README.md)。

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
│   ├── index.html                # 首页内容（最新文章 + 项目；外壳与 SPA 见 baseof）
│   ├── 404.html                  # 404（Hugo 据此生成站点根的 /404.html）
│   ├── _default/
│   │   ├── baseof.html           # 覆盖主题：套「外壳」+ 分派 body class（外壳页 / 文章页 / 404）
│   │   ├── single.html           # 文章页（双栏 + 悬浮迁移布局 + 交互脚本）
│   │   ├── list.html             # 列表页（杂志式卡片流）
│   │   ├── terms.html            # 标签总览页（发丝线行列表）
│   │   ├── archives.html         # 归档页（按年分节 + 卡片流）
│   │   ├── search.html           # 搜索页（零依赖前端搜索，支持 ?q=）
│   │   ├── plain.html            # 通用朴素页（layout: "plain"，about 用）
│   │   └── _markup/
│   │       └── render-image.html # 图片渲染钩子（lazy + decoding + 宽高防 CLS）
│   └── partials/
│       ├── ed_masthead.html      # 左列刊头（外壳的一部分，含主题切换代理）
│       ├── ed_spa.html           # 单页导航（外壳页通用：只替换 #ed-content）
│       ├── nav_menu.html         # 导航（id=ed-menu，避免与顶栏 #menu 撞 id）
│       ├── post_header.html      # 文章页 header（标题 / 副标题 / meta；面包屑已移除）
│       ├── post_meta.html        # 覆盖主题：追加「更新于 X」（GitInfo lastmod）
│       ├── page_head.html        # 统一栏目头（首页 / 列表 / 标签 / 归档 / 关于 / 搜索）
│       ├── toc.html              # 自建目录：自适应两级
│       ├── theme_icon.html       # 主题切换双图标（可复用）
│       ├── giscus.html           # Giscus 评论组件
│       └── comments.html         # 接线到 giscus
├── assets/css/extended/
│   └── custom.css                # 全部定制样式（分段注释）
├── static/
│   ├── favicon.svg               # 站点图标（矢量）
│   ├── favicon-16x16.png         # PNG 版（PaperMod 的 <link> 硬编码 png 类型）
│   ├── favicon-32x32.png
│   ├── apple-touch-icon.png      # iOS 加主屏（180×180，不透明；主题 <link> 默认取这个名字）
│   ├── safari-pinned-tab.svg     # Safari 固定标签页（单色剪影，evenodd 挖空字形）
│   └── images/og-default.png     # 分享卡片默认图 1200×630
├── scripts/
│   ├── dev.sh                    # 本地一键预览（克隆主题 + 补丁 + hugo server）
│   └── patch-theme.sh            # PaperMod v8.0 在新版 Hugo 下的兼容补丁（幂等）
├── Makefile                      # make serve / make build
└── .github/workflows/deploy.yml  # push main → 构建 → GitHub Pages
```

> 版式与主题强耦合：自定义模板直接调用多个主题 partial。不要把这套 layouts 当通用模板用。

## 本地预览（手动方式）

`make serve`（即 `scripts/dev.sh`）已覆盖绝大多数场景；Windows 的 Git Bash 默认不带 `make`，直接跑 `./scripts/dev.sh` 即可，两者等价。需要手动执行时：

```bash
git clone --depth 1 --branch v8.0 https://github.com/adityatelange/hugo-PaperMod.git themes/PaperMod
./scripts/patch-theme.sh themes/PaperMod   # 必须执行，否则新版 Hugo 构建失败
hugo server
```

## 写文章

### 标题层级约定（重要）

正文从 h2 开始写，不要用 h1 —— 文章标题是页面唯一的 h1；自建目录（`layouts/partials/toc.html`）取"最小标题层级 + 一级"共两级展示。当前约定：

| 层级 | 语义 | 目录 |
|---|---|---|
| h2 | 阶段 / 大节 | 第一层（加粗） |
| h3 | 章 | 第二层 |
| h4 / h5 | 节 / 子节 | 不进目录 |

### front matter 字段

| 字段 | 说明 |
|---|---|
| `title` | 文章标题 |
| `date` | 发布日期，建议带时区（`+08:00`） |
| `draft` | 脚手架默认 `true`，发布前改 `false` |
| `slug` | URL 片段，建议显式指定，避免中文转码 URL |
| `tags` | 标签数组 |
| `description` | 一句话摘要；显示在首页卡片与分享卡片 |
| `disable_comments` | 单篇关闭评论时加此项 |
| `author` | 人类作者署名（必需）；不写则回退站点级 `params.author`（当前 `Xi`）。可字符串或数组 |
| `model` | 使用的模型（可选）；署名里渲染为「CoWith …」 |
| `tool` | 使用的工具（可选）；署名里渲染为「Use …」，与 `model` 互相独立 |

> 署名整体形如「人名, CoWith 模型, Use 工具」，各段用逗号分隔，缺哪段就不出现。
> 作者名做成链接：优先取 `[[params.social]]` 中 `icon = "github"` 那条的
> `url`（即 GitHub 主页），没有 GitHub 时回退到邮箱（`mailto:` + `params.email`）。

#### 字段顺序与写法

顺序固定为 `title → slug → date → tags → draft → description`；值**一律加引号**（`date` 除外），`tags` 用 `- 项` 列表：

```yaml
---
title: "文章标题"
slug: "url-slug"
date: 2026-10-08T10:00:00+08:00
tags:
  - "KMP"
  - "架构"
draft: false
description: "一句话摘要。"
---
```

- 加引号是为了与脚手架对齐：`archetypes/default.md` 的 `title`/`slug` 含 `{{ }}`（`{` 是 YAML 特殊字符）本就必须加引号，以它为准能让新文章零调整，也顺带避开 YAML 解析的坑。
- 不再使用 `categories` —— `hugo.toml` 的 `[taxonomies]` 只定义了 `tag`，写 `categories` 不会生成任何页面。将来要分类，先在配置里加 taxonomy。
- 早前四篇文章的 front matter 写法不一（引号有无、`tags` 行内与列表混用），现已按上述统一。

> 导语只留一处：标题下方的副标题由 front matter `description` 渲染，**正文开头不再
> 重复放引用块**（早前四篇是「引用块 + `<!--more-->` + `---`」开头，已统一去掉，正文从 h2 开始）。
> 关键细节：悬浮块迁到左栏（pinned）时副标题也**不折叠**，只缩到 `.74rem` 并截断两行
> （`custom.css` 的 is-pinned 段）——折叠掉的话，读者滚到一半就再也看不到这句导语了。
> `.Summary` 去掉引用块后由 Hugo 按 `summaryLength` 自动截取首段；卡片与 RSS 优先用
> `description`，都不受影响。

`lastmod` 不用手写 —— `enableGitInfo` 开着，取最后一次提交时间，文章页 meta 显示「更新于 X」（与发布日期不同天时才出现）。

## 首页配置速查

都在 `hugo.toml`：

| 想改什么 | 位置 |
|---|---|
| 首页展示几篇 / 是否随机 | `[params.home]` 的 `postsLimit`（第一篇固定最新，其余随机）+ `randomRest` |
| 报头副标题（刊名下一行） | `params.description`（回退 `[params.profile].subtitle`） |
| 报头第二段自我介绍 | `[params.profile]` 的 `desc` —— 目前未配置，刊头不显示第二段 |
| 项目区块 | `data/projects.toml`（加一段 `[[project]]` 即可） |
| 导航菜单 | `[[menu.main]]`（weight 控制顺序） |
| 社交图标 | `[[params.social]]`（icon 名对应主题 `svg.html`，邮箱统一读 `params.email`） |
| 评论 | `[params.giscus]`（整站开关：`params.comments`；单篇关：front matter `disable_comments: true`） |
| OG 分享图 | `params.images`（文件仍是 `static/images/og-default.png`，1200×630） |
| 主题词 / 站外身份 | `params.keywords` 与 `[params.schema] sameAs` |

> 首页卡片（`postsLimit = 2`，1 篇最新 + 1 篇随机）：随机是**构建时**用 `shuffle` 定的，
> 页面仍是静态 HTML（可收录、无闪烁），每次部署重抽一次；序号按 `RelPermalink` 查预建的
> 篇号表得到（展示顺序已不等于时间顺序，不能再按下标反推）。卡片走 `.ed-cards--pair`
> 的方卡片并排样式（≥768px 两列），`/posts/` 与归档页仍用原来的发丝线长列表版式。

> TOML 嵌套坑（真踩过）：`images` / `keywords` 必须写在 `[params]` 直接层。写在
> `[params.assets]` 之后会被并进 assets 表，主题读 `site.Params.images` 就是空，
> 表现是全站 `og:image` / `twitter:image` 静默缺失——构建不报错，只能看产物。
> 加任何新的顶层 params 键时，注意它在文件里紧跟的是哪个 `[params.xxx]` 表。

## 外壳与单页导航（直连与切换必须长得一样）

三类页面的骨架都由 `layouts/_default/baseof.html` 决定：

| 类型 | body class | 骨架 |
|---|---|---|
| 外壳页：首页、`/posts/`、`/tags/`、`/tags/x/`、`/archives/`、`/about/`、`/search/` | `ed-shell-body` | 导航行 + 左列刊头（`ed_masthead.html`）+ 右列 `#ed-content`，顶栏 CSS 隐藏 |
| 文章页（`single.html`） | `ed-single-body` | 双栏 + 悬浮 header，自带导航，不套外壳 |
| 404 | `list` | 主题顶栏 + 三个去处链接，不套外壳 |

关键是**外壳只有一个渲染处**：所有内容模板（`index.html` / `list.html` / `terms.html` / `archives.html` / `plain.html` / `search.html`）只写「栏目头 + 内容」，由 baseof 把它们装进 `#ed-content`。因此同一个 URL 直连、或经单页导航（`ed_spa.html`）切换过去，DOM 与版式完全一致——这正是早前"直连页没有刊头/内容通栏"问题的根因与解法。

底色也统一了：外壳页与文章页都是 `--theme`（亮色纯白 / 深色主题灰）。主题默认给 `.list` 页铺 `--code-bg`（亮色浅灰），会造成"主页浅灰、文章页纯白"两种底色，`custom.css` 里用 `body.ed-shell-body { background: var(--theme) }` 覆盖掉，导航行同取 `--theme`。注意别把页面底色改回 `--code-bg`：它另一个职责是行内代码的底色，同色会让亮色下的 `` `code` `` 隐形。

`ed_spa.html` 在每个外壳页都会加载，任何一页都能当宿主原地替换 `#ed-content`：

- **白名单**：`isSpaPath()` 决定哪些目标可在右列打开；文章详情由 `isArticle()` 放行（整页跳转，因为它的双栏 + 悬浮脚本塞进右列会嵌套冲突）。
- **提取目标必须是 `#ed-content`**，不能是 `main`：外壳页的 `main` 里装着导航 + 刊头，直接注入会套娃。
- **新增外壳页时**：在 baseof 的 `$isArticle` 判定里确认它不被当成文章页，再把它加进 `isSpaPath()` 白名单（否则直连可开、点击却整页跳转）。
- **执行顺序**：`apply()` 先 `pushState` 改地址栏、再注入并执行脚本。页面脚本以 `location` 为准（搜索页要从 `?q=` 取词），顺序反了会读到上一个 URL 的 query。

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
