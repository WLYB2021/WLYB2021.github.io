# Xi 的博客

**[wlyb2021.github.io](https://wlyb2021.github.io)** · Writing what's worth keeping.

个人博客，Hugo + PaperMod 定制，部署在 GitHub Pages。没有固定主题，也没有人设——写自己消化过、觉得值得输出的东西。目前的内容以 KMP / Compose Multiplatform 跨平台架构演进为主。

## 技术栈

| | |
|---|---|
| 生成器 | Hugo **extended**（CI 用 0.167.0，需 ≥ 0.146） |
| 主题 | PaperMod v8.0（CI 自动克隆并打兼容补丁） |
| 评论 | Giscus（GitHub Discussions） |
| 搜索 | Hugo 原生 JSON 索引 + 零依赖前端搜索 |
| 部署 | GitHub Actions → GitHub Pages |

## 本地预览

前置：安装 Hugo extended。macOS 可 `brew install hugo`；Windows 从 [releases](https://github.com/gohugoio/hugo/releases) 页面下载。

```bash
make serve
```

自动完成克隆主题、打兼容补丁、启动 `http://localhost:1313`。手动方式见 [docs/maintenance.md](docs/maintenance.md)。

## 写文章

```bash
hugo new posts/xxx.md
```

日常约定（完整版见 [docs/maintenance.md](docs/maintenance.md)）：

- 正文从 `h2` 开始，`h1` 留给文章标题——自建目录按两级展示
- 显式写 `slug`，避免中文转码 URL
- `lastmod` 不手写，由 GitInfo 取最后一次提交时间
- 发布前把 `draft` 改为 `false`

front matter 示例：

```yaml
---
title: "文章标题"
date: 2026-10-08T10:00:00+08:00
draft: false
slug: "url-slug"
tags: ["KMP", "架构"]
description: "一句话摘要"
---
```

## 部署

push 到 `main` 即自动构建发布。CI 会校验构建产物（index.html / 404.html / sitemap / RSS / OG 图），缺件即失败。

## 维护手册

目录结构、首页配置速查、主题依赖与升级注意事项等维护细节，见 [docs/maintenance.md](docs/maintenance.md)。
