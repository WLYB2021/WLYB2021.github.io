---
title: "一个音乐播放器的跨平台架构演进"
slug: "hmp-cross-platform-evolution"
date: 2026-10-10T10:00:00+08:00
tags: ["KMP", "Compose Multiplatform", "跨平台", "架构", "个人项目"]
draft: false
description: "HMP 个人项目的跨平台架构演进实录：从单模块 Android 到一套 Compose Multiplatform 代码跑在 Android、iOS、Desktop。"
---

> HMP（Hearable Music Player）
>
> 本文是《从单体到共享：应用架构演进的一条可行路径》的实践篇。论证篇讲路径的通用逻辑，本篇讲这条逻辑的一次完整落地。

<!--more-->
---

### 引子

HMP 是一个纯本地的音乐播放器，个人项目。起点是单模块的 Android 应用，终点是一套 Compose Multiplatform 代码同时跑在 Android、iOS、Desktop 上。

它走完了论证篇描述的三个阶段：**单体 → 模块 → 共享**。共享阶段内部又分两步，先共享逻辑层，再共享 UI 层。下面按这个顺序展开，每一步都对应到仓库里的具体出处。

---

## 第一阶段 · 单体

### 一 · 起点：单模块 Android 应用

一个 `app` 模块，按技术分包（`ui/` `viewmodel/` `repository/` `database/`），全部代码在一个构建单元里。

2025-04-23 出第一个可运行版本（v2.0）：Jetpack Compose、Retrofit + OkHttp + Gson、ExoPlayer，没有依赖注入，ViewModel 靠手写 `ViewModelFactory` 装配。

形态定型后的样子：

- 两个 ViewModel（列表 `MusicViewModel` + 播放 `PlayControlViewModel`）
- 业务逻辑长在 ViewModel 里
- Repository 是具体类，没有接口
- `Context`、`Intent` 散落在各处

**单端、单模块、不共享。** 这个形态下，播放逻辑和界面生命绑在一起，依赖靠工厂手写。功能能加，但每加一处都要动同一批文件。

---

### 二 · 基础改造：引入 DI 与播放收口

先是两处基础改造。**把播放能力收口**：播放控制从旧方案迁到 Media3 的 `MediaSession`，把原先散在 UI 里的播放逻辑收进一个播放服务。**引入 Hilt**：`MusicApplication` 加 `@HiltAndroidApp`，ViewModel 加 `@HiltViewModel`，数据库与网络初始化迁到 Hilt Module，手写的 `ViewModelFactory` 退役。

动机写在提交信息里：可测试性与可维护性。

#### 这两步后来各自被用上了一次

- DI 让 ViewModel 可被外部装配。后来从 Hilt 换 Koin 时，换的是装配器，装配方式没动。
- Media3 把播放能力收进一个服务，后来被 `PlaybackController` 接口整个包住。

这两步只解决了单模块内部的耦合。模块之间仍然没有边界——`core-domain` 这类东西还不存在，数据、播放、界面全在一个构建单元里。

---

## 第二阶段 · 模块

### 三 · 模块化：拆出五个模块

上一章的两处收口发生在模块内部，模块之间还没有边界。这一次划分把边界显式化：先规划拆分方案，再执行迁移，最后收口。

#### 拆成了什么

从单模块拆成五个：

```kotlin
include(":app")
include(":core-data")     // Room、Repository
include(":core-domain")   // UseCase、领域模型
include(":core-player")   // Media3、播放服务
include(":feature-ui")    // Compose 页面与组件
```

**这是第二阶段：单端、多模块、依赖方向显式。**

#### 原始动机

当时留下的改进路线文档写得很清楚，动机是三条：降低耦合、提升编译速度、明确模块边界。

#### `feature-ui` 被单独拆了出来

这次划分里，`feature-ui` 是一个独立模块。

动机写在同一份文档里，属于"分层更干净"的一部分——UI 归 UI，数据归数据。后来共享 UI 时，它是唯一有资格被整体上提的候选：代码已隔离、依赖已单向、编译已独立，只差搬走。

#### 划分之后，架构停在这里

功能继续增长：v5.2 ~ v5.9 加了触觉反馈、动态主题、音效、歌词、播放列表管理；域模型重构并接入 Hilt 导航组件；数据库版本升级与音乐额外信息表迁移；迁到 Navigation 3 和 Gradle 9.0。

这一长段里没有提交触碰过模块划分。模块边界一直在那里，但用它的理由还没出现——直到项目决定增加第二个端。

---

## 第三阶段 · 共享

### 四 · 转向：为什么决定支持 iOS

转向来自一份《iOS 适配与双平台维护工作流 — 设计文档》，整条路径的起点。

#### 目标与约束

**目标**：适配到 iOS，共享 domain + data 层（约 40-50%），UI 和播放引擎保持平台原生。

**文档明确写下的约束（原文）**：

> - 一次性重构（非渐进式迁移）
> - Monorepo 仓库结构
> - 开发者 iOS 经验为零，此项目本身即为技术探索

#### 技术选型映射

| 层级 | 现有 Android | KMP 迁移后 | 说明 |
|---|---|---|---|
| 数据库 | Room 2.8.3 | Room KMP | `@ConstructedBy` + `BundledSQLiteDriver` |
| 偏好存储 | DataStore | DataStore KMP | preferences-core |
| 网络 | Retrofit + OkHttp | Ktor Client | 各端换 engine |
| 序列化 | Gson | kotlinx.serialization | KMP 原生 |
| 依赖注入 | Hilt | Koin | Hilt 不支持 iOS |
| 标签解析 | Jaudiotagger | `expect/actual` | iOS 用 AVAssetReader |
| 播放引擎 | Media3 | 各自实现 | iOS 用 AVPlayer |
| UI | Jetpack Compose | 各自实现 | iOS 用 SwiftUI |

这张表是论证篇第六章"平台耦合清单"的一个具体实例，它同时给出了第三阶段的内部分界：**domain 与 data 全部可换，UI 与播放引擎保持各自实现。**

#### 为什么选"一次性重构"

文档给出的理由是 domain / data 层逻辑纯度高、平台耦合可枚举、有编译与测试作为硬反馈。三条判据只覆盖了 domain 与 data——表格最后两行不在这次搬运范围内，它们要照原样在 iOS 上各写一份。

---

### 五 · 共享逻辑层：下沉 domain 与 data

一次做完，按 P0 ~ P7 推进。

#### 搬走了什么

**搬运方式**：Monorepo 化成 `android/` + `shared/` + `ios/` 三个目录；`core-domain` 全部 36 个文件移入 `shared/commonMain`；Room 改造为 KMP 模式一并迁入；网络栈整体换血（Retrofit / OkHttp / Gson → Ktor / kotlinx.serialization）；Repository 实现、DI、标签解析、存储、工具类全部下沉，Android 端随之移除 Hilt。

**平台边界**：收敛成 11 个 `expect/actual` 声明（`DeviceMusicScanner`、`MusicTagParser`、`SecureStorageHelper`、`getRoomDatabase`、`createHttpClient`、拼音排序、时间戳等）。

**iOS 侧**：Xcode 工程 + CocoaPods 集成 + AVPlayer 封装；SwiftUI 界面逐模块实现，落成 8 个 ViewModel 与一整套界面。

共享边界从"单端内"移到"跨端"，越过了逻辑，没越过 UI。

#### 为什么能一次搬完

这一层可以自动验证：编译过不过、测试绿不绿，是硬反馈。加上耦合可枚举（一张表列完）、逻辑纯度高（36 个文件没有一条依赖 UI），迁移退化成体力活。

#### 留下了什么

**iOS 的界面是从零重写的。** Android 有 Compose 界面，iOS 有 SwiftUI 界面——两份 UI 从这一刻开始并行维护。共享层已经就位，但共用它的界面还不存在。

---

### 六 · 逻辑共享的验证：桌面端与 UI 跨平台

第三个端来自一次平台扩展：新模块 `desktop/app` + `desktop/core-player`。播放引擎因为桌面没有 Media3，基于 FFmpeg 子进程 + JNA 自研一套。

#### UI 选型

**桌面端的界面用 Compose Multiplatform 写。** 这和 Android 的 Jetpack Compose 同源——同一个框架，target 从 Android 换成 JVM/Desktop。论证篇第四章的判据在这里兑现：判断"UI 能不能共享"，先做一个端比先论证有效。桌面端就是那个端。

同期还有一次边界试探：歌词解析器（LRC）从各端实现上提到 `shared`，Android 与 Desktop 共用。共享边界第一次越过"纯逻辑"，碰到 UI 相关的东西，没有引发问题。

桌面端证明了"能共享"，但它自己也带一份独立 UI。至此三份界面并行维护，成本随功能增长——这份成本由谁来承担，是下一章的事。

---

### 七 · 共享 UI 层：迁移式提取与旧层删除

Android Compose、iOS SwiftUI、Desktop Compose 三份 UI 的维护成本已经压不住，共享边界需要第二次移动——越过 UI。

#### 一条被作废的重写路线

仓库里留下了完整的迁移方案，开头第一句是：

> 本方案**取代**已作废的 `docs/ui-rewrite` 重写路线

被作废的路线是"并行重写 + feature flag 双轨切换"，方案里记载了作废的三个理由：

1. **双实现长期并存**：两套 UI、两套 ViewModel、两套资源，逐页对齐成本非线性上升
2. **资源契约被低估**：`IconKey` / `MessageKey` 到 Compose Resources 的映射没一次做对，出现反复返工
3. **重写不适合本仓库规模**：边搬边改两个变量叠加，冲突面与回归风险失控

它和第四章的"一次性重构"用的是同一套判据——逻辑纯度、耦合可枚举、能否自动验证——结论相反：UI 层里带着行为，而行为无法用编译验证。这对应论证篇第九章开头分析的那条错误路线。

#### 定契约：先盘点，再冻结

产物是一份《接口冻结 — 调用点映射表》：把旧界面里全部真实调用点盘了一遍，据此补全并冻结 `PlaybackController` 与 `PlatformServices` 两个接口。

| 接口成员 | 调用点 |
|---|---|
| `currentPlayingMusic` | `PlaybackViewModel`、`PlaylistQueueViewModel`、`FloatingLyricsOverlay` |
| `isPlaying` | `PlaybackViewModel` |
| `playWith(music)` | `PlaylistQueueViewModel` |
| `playHeartMode()` | `PlaylistQueueViewModel`（心动模式，盘点时发现的遗漏项） |

最后一行是盘点过程中才发现的遗漏项。若跳过反查直接冻结一个"看起来完整"的接口，这个功能会在迁移后静默消失。这张表随后成为硬约束：冻结之后不再临时增补。

#### 删旧层：先建基线，再冷死

旧桌面 UI 层删除时的规模是 **260 文件 / +2 −28172**。

删除之前先建立了行为基线：全量截图旧 UI + 记录交互清单。旧层冷死后无法再运行时对照，基线必须在移除之前采集。《阶段一切换前基线》文档列出 24 个路由页 + 10 类对话框的截图清单，以及播放核心、列表、主题、平台能力、导航的逐项交互清单。

旧层从编译图移除，源文件保留。并存会让双实现继续维护——这是被作废路线的失败原因；直接删除则历史不可回溯。

#### v7.0 的结果

```
v7.0.0 shared-ui 跨平台架构迁移
  - 118 个 UI 文件迁移至 commonMain
  - Android/Desktop 双端共用一套 UI
  - 平台差异收口到 androidMain/desktopMain 桥接层
  - 删除旧 desktop/feature-ui 和 android/feature-ui 模块
  - APK 体积从 46.9MB 优化至 13.2MB
```

**共享边界越过 UI**，Android 与 Desktop 开始共用一套界面。方案里另附两条执行纪律：迁移与整理分两阶段不混做；不做纵向切片，按可运行闭环推进（壳 → 首页骨架 → 列表主路径 → 播放闭环 → 横向铺满）。

iOS 在这一步没有跟上。它的 SwiftUI 界面仍在，共享层对它是空的。

---

### 八 · 共享 UI 的收尾：iOS 全量切换

`shared-ui` 增加 iOS targets；`shared-ios` 聚合框架把 `shared` + `shared-ui` 链接成单一 `sharedIos.framework` 接入 CocoaPods。三个决策都不是偏好，是被约束逼出来的：

- **单一聚合 framework**：规避双静态框架 duplicate symbol、双动态框架 Koin 全局分裂
- **只编 `iosArm64` + `iosSimulatorArm64`**：`navigation3-ui` 没有 `iosX64` 构件，Intel 模拟器走 Rosetta
- **Kotlin 2.2 → 2.3**：`navigation3` 全系 iOS klib 是 2.3 ABI

地基完成后 iOS 完成切换：

```
v7.1.0 iOS 切换到共享层 Compose UI
  - iosMain 桥接层：PlaybackController 双桥 + PlatformServices
  - 删除 67 个 SwiftUI 页面 / 组件 / Swift ViewModel
  - 壳收敛至 17 个原生层文件
  - 真机（iPhone 13）构建 / 安装 / 启动验证通过
```

三端跑了同一套 Compose UI。**共享边界移到了它当前能到的位置：只有播放引擎和平台能力留在各端。**

#### 代价：三类能力倒退

删掉 67 个文件之后，出现一批"编译通过、功能却丢了"的缺陷。《能力搬迁点检》文档记录了三种形态，共同点是编译器和测试都抓不到。

**R1 · 权限申请失效（实现没搬）**
`AndroidPlatformServices.requestIntroPermissions` 是个空壳，`onResult(true)` 直接回调成功。这个实现当年写的时候确实没有调用点——那时 `IntroScreen` 在自己内部申请权限。后来 `IntroScreen` 迁到 `commonMain`，改调这个接口：**调用点出现了，实现没补**。后果：Android 首启申请权限不弹框，扫描得到空曲库且无提示。

**R2 · iOS Live Activity 声明丢失（声明丢了）**
`f42e51c` 从 `Info.plist` 删除了 `NSSupportsLiveActivities`，且没补进 `project.yml` 的 `info.properties`（该文件由 XcodeGen 维护）。Live Activity 的代码仍在被调用，**缺的只是声明**。后果：iOS 锁屏实时活动不显示。

**R3 · 桌面端目录管理整块丢失（入口没搬）**
删掉旧桌面 UI 层时，完整的目录管理（VM 四个 mutation + 两个 UI 区块 + 目录选择器）没搬进新版 `LibrarySettingsScreen`，但**数据层仍完好**——`SettingsRepositoryImpl.desktop` 还在读配置，只是没有任何地方能写入它。后果：桌面端只能扫描默认目录，音乐放在别处无法入库。

三种形态分别是实现没搬、声明丢了、入口没搬，**都表现为编译通过**。

#### 点检的产物

仓库沉淀出一份《能力搬迁检查清单》：

- **调用链回溯**：从 UI 入口沿桥 / UseCase 查到平台实现
- **调用点核查**：对每个平台 API 反问"谁调用它"，零调用的 override 一律可疑
- **单源核对**：生成器产出的声明，核对真源
- **反向核对**：确认被删的东西改造前是否真有人用——`MusicLibraryService` 这类死代码因此被正确判定为"非倒退"，没有把清理当事故

---

## 复盘

### 九 · 三个阶段，两次边界移动

| 阶段 | 关键动作 | 共享边界在哪 |
|---|---|---|
| **单体** | 单模块 Android 应用 | 不共享 |
| **模块** | 一次划分拆出 5 个模块 | 不共享，边界显性化 |
| **共享 · 逻辑** | domain + data 下沉，UI 双原生 | domain + data |
| **共享 · UI** | 共享 UI 提取 + iOS 全替换 | domain + data + UI |

共享阶段内部两步之间、以及每次边界移动之间，都没有提交触碰过共享边界——架构停在原处，功能继续增长。

#### 每一步的动机与后果

| 动作 | 动机 | 后来成为什么的前提 |
|---|---|---|
| 拆模块 | 降低耦合、提升编译速度 | `feature-ui` 独立成模块，共享 UI 才有地方安放 |
| 共享逻辑 | 支持 iOS | domain + data 已在共享层，UI 共享的收益才成立 |
| 上桌面端 | 多支持一个平台 | Compose Multiplatform 在第二端跑通，UI 共享从假设变成事实 |
| 共享 UI | 三份 UI 维护不动 | — |

三个阶段没有一份总规划文档串起来，每一步的动机都是当时的具体压力。但它们叠起来，恰好是共享边界逐段移动的一条完整路径。

#### 留下的资产

- **迁移方案文档**：模块化方案、共享 UI 提取方案（含被作废的重写路线）
- **设计文档**：iOS 适配设计、接口冻结映射表
- **审查报告**：能力搬迁点检、架构审查

（对应论证篇第十章："架构资产不只包括代码，也包括决策的来路。"）

---

*本文是论证篇《从单体到共享：应用架构演进的一条可行路径》的实践篇。论证篇讲路径的通用逻辑，本篇是这条逻辑的一次完整落地记录。*
