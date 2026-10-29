# 微信公众号发布包导出

把站点的 Markdown 文章转换成适合公众号排版的素材包。

当前是第一阶段：只生成可检查的本地发布包，不直接调用公众号 API，也不依赖公众号登录态。

## 依赖

- Node.js 18 或更高版本
- 首次使用安装依赖：

```powershell
cd "D:\MyFile\WLYB2021.github.io\tools\wechat"
npm install
```

## 用法

按 slug 导出：

```powershell
npm run export -- from-traditional-to-modern-android
```

按路径导出：

```powershell
npm run export -- "D:\MyFile\WLYB2021.github.io\content\posts\from-traditional-to-modern-android.md"
```

指定封面：

```powershell
npm run export -- from-traditional-to-modern-android --cover="covers/from-traditional-to-modern-android.svg"
```

封面也支持 PNG/JPG；SVG 会在导出时自动转成高清 PNG。

输出目录：

```text
dist/wechat/<slug>/
├── article.md
├── meta.json
├── cover.png          # 只有传入 --cover 时存在
└── assets/
    ├── images-modern-android-page-vs-dataflow.png
    ├── images-modern-android-snapshot-vs-stream.png
    ├── images-modern-android-delete-dataflow-loop.png
    └── images-modern-android-gradle-boundary.png
```

## 导出阶段做了什么

- 读取 Hugo front matter，提取标题、摘要、作者；
- 将本地 SVG 渲染为 2x PNG，确保公众号能上传；
- 将 Markdown 图片路径改成发布包内的相对路径；
- 收集外部链接，在正文中改成 `[n]` 脚注；
- 删除文章原有的“参考”尾部，重新生成纯文本参考列表；
- 生成 `meta.json`，记录标题、摘要、博客原文地址、图片和封面。

导出阶段不会做：

- 不修改源文章；
- 不调用公众号接口；
- 不决定公众号主题样式。

## 生成草稿

`draft` 命令会：

- 把 `article.md` 转成公众号兼容的内联样式 HTML；
- 上传正文图片到公众号图床；
- 上传封面为永久图片素材；
- 创建草稿；
- 不自动群发。

### 1. 配置凭证

从公众号后台获取 AppID / AppSecret，并配置 API IP 白名单。复制：

```powershell
cd "D:\MyFile\WLYB2021.github.io\tools\wechat"
Copy-Item .env.example .env
```

编辑 `.env`：

```dotenv
WECHAT_APP_ID=你的AppID
WECHAT_APP_SECRET=你的AppSecret
```

`.env` 已被忽略，不会进入仓库。

### 2. 先生成 HTML 预览

不需要凭证，先检查正文长度和排版：

```powershell
npm install
npm run draft -- from-traditional-to-modern-android --preview
```

输出：

```text
dist/wechat/<slug>/preview.html
```

公众号草稿正文上限为 2 万字符；超过时命令会直接失败，不调用 API。

### 3. 创建草稿

```powershell
npm run draft -- from-traditional-to-modern-android
```

成功后终端会输出 `media_id`。到公众号后台草稿箱检查标题、摘要、封面、图片、代码块和脚注，确认后人工群发。

## 限制

- 草稿接口需要公众号具备相应权限，且调用 IP 在白名单内；
- 正文 HTML 必须少于 2 万字符、小于 1MB；
- 为压住字符上限，公众号版不保留行内 code 的独立字体，按正文默认字体显示；代码块保留底色与换行；
- 正文图片只支持 PNG/JPG，且单张小于 1MB；
- 封面使用永久素材，需要有封面才能创建图文草稿；
- 本工具只创建草稿，不会直接群发。

如果账号没有 API 权限，仍可使用 `article.md` + `assets/` + `cover.png`，转到 Doocs/md 或 md2wechat 手工发草稿。
