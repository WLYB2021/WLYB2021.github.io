# 发布手册

本站没有后台、没有草稿箱，发布只有两个动作：改 front matter 的 `draft`，然后 push。
这份手册把那两个动作前后的固定步骤写下来，免得每次重新想。

## 先理解发布模型

| 事实 | 含义 |
|---|---|
| 唯一的发布开关是 front matter 里的 `draft` | 没有别的地方控制"发没发" |
| 部署是 `push main → CI 全量构建 → 整站替换` | 不存在"只发一篇、其他不动"的原生机制 |
| 所以线上"已发布集合" = 上次 push 那一刻 `draft: false` 的集合 | "逐篇发布" = 每次只把当前一篇翻成 `false`，其余留 `true` |

一个直接后果：**把文章改回 `draft: true` 再 push，线上会立刻少掉它。**
这是全量快照的语义，不是 bug。

## 日常命令

本机已装 Hugo v0.167.0 extended（`C:\Users\TS\hugo`，已加入用户 PATH）。
Windows 的 Git Bash 默认不带 `make`，所以两种写法都列出：

| 目的 | 有 make | 没有 make |
|---|---|---|
| 预览（含草稿） | `make serve` | `./scripts/dev.sh` |
| 只看已发布的样子 | — | `hugo server` |
| 列出所有草稿 | `make drafts` | `hugo list drafts` |
| 本地构建自检 | `make build` | `hugo --minify --gc` |
| 校验正文排版 | `make lint` | `python scripts/lint-prose.py` |

> 预览必须带 `-D`（`scripts/dev.sh` 已内置）。
> 少了它，`draft: true` 的文章在本地也是 404 —— 写作期反而看不见自己写的东西。

## 五阶段流程

| 阶段 | 做什么 | 出口 |
|---|---|---|
| ① 起草 | `hugo new posts/xxx.md`，archetype 生成骨架（默认 `draft: true`） | 骨架就位 |
| ② 预览 | `hugo server -D` 本地实时看渲染 | 页面对得上预期 |
| ③ 定稿 | 内容与呈现双向精修 | 过「发布标准清单」 |
| ④ 校验 | `python scripts/lint-prose.py` 查排版，再 `hugo --minify --gc` 构建 | 排版通过 + 产物正常 |
| ⑤ 发布 | 翻 `draft: false` → 一篇一提交 → push | CI 绿 + 线上 URL 200 |

## 发布标准清单

判定"达没达标"就看这两栏，避免每篇都凭感觉收尾。

**内容**

- [ ] 无残留占位符（`[图占位]`、`TODO`、`待补` 等）
- [ ] 论证链完整，结论都能在正文找到出处
- [ ] 该配图的地方有图（架构、流程类尤其）
- [ ] 代码块可直接运行，或已注明是伪代码

**格式**

- [ ] front matter 的顺序、引号、`tags` 写法符合 [maintenance.md](maintenance.md) 的「字段顺序与写法」
- [ ] 排版通过 `python scripts/lint-prose.py`（空行 / 行尾空格 / 围栏规则见 [typography.md](typography.md)）
- [ ] 标题编号符合统一体系（`h2` = `一、`，`h3` = `1.1`，`h4` = `1.1.1`；`引子`/`结语` 不编号）

**呈现**

- [ ] 标题从 `h2` 起，层级符合约定（`h2` 阶段 / `h3` 章；目录只取这两级）
- [ ] 目录与实际章节一致
- [ ] 表格、代码块、长行在窄屏不溢出
- [ ] `description` 一句话，会显示在卡片与分享面板

## 逐篇发布

1. 确认**这篇之外**的文章 `draft` 保持现状（要"逐篇"，就别顺手把它们也改了）
2. 把这篇改成 `draft: false`
3. 本地 `hugo --minify --gc` 构建，确认无 error
4. `git add content/posts/xxx.md && git commit -m "post: 发布《标题》"`
5. `git push`
6. 等 CI 绿，访问 `/posts/<slug>/` 确认 200，再看 sitemap 是否收录

一篇一提交：出问题时能只回滚这一篇。

## 回滚

| 情况 | 做法 |
|---|---|
| 刚发布想撤下 | 把 `draft` 改回 `true`，再 push 一次（线上立刻消失） |
| 内容要修 | 直接改，再 push（GitInfo 会自动更新页面上的"更新于"） |
| 某次提交引入问题 | `git revert <commit>` 后 push |

## 当前状态

> 随进度更新，别当长期约定。

（2026-10-16）4 篇文章均为 `draft: false`，即都还在线上，但内容与呈现尚未达到发布标准。
计划逐篇精修、逐篇重新发布；修一篇推一篇，其余保持现状。
