---
title: "{{ replace .Name "-" " " | title }}"
slug: "{{ .Name }}"
date: {{ .Date }}
tags: []
draft: true
description: ""
author: "Xi"
model: ""
tool: ""
---

<!-- 写作约定（完整规范见 docs/maintenance.md 的「写文章」一节）：
  - 正文从 h2（##）开始，不要用 h1 —— 文章标题是页面唯一的 h1
  - 层级：h2 阶段 / h3 章 / h4 节 / h5 子节；侧栏目录只取 h2 + h3
  - 字段顺序：title → slug → date → tags → draft → description → author；model / tool 置于末
  - 值一律加引号，避免 YAML 解析意外（date 除外）
  - tags 用「- 项」列表写法
  - slug 显式写，避免中文转码 URL
  - description 会显示在首页卡片与分享卡片，认真写一句
  - author 是必需项（人类作者），可字符串或数组；不写则回退站点级 params.author
  - model / tool 是两个互相独立的可选字段：填了才显示「Model: …」「Tool: …」 -->
