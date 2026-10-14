---
title: 从传统到现代：Android 应用开发范式的演变
slug: from-traditional-to-modern-android
date: 2026-10-14T10:00:00+08:00
tags:
  - Android
  - Kotlin
  - 架构
  - 协程
  - Flow
draft: false
description: 一次范式转变：语言、数据、UI、架构、工程五个层面的演进。
---

> 一次范式转变：语言、数据、UI、架构、工程五个层面的演进。

<!--more-->
---

## 引子

Android 开发经历了一次范式转变。传统范式里，开发者要手动管理请求、线程、订阅和生命周期；现代范式里，这些工作被协程作用域、数据流和声明式 UI 接管了。

语言层从 Java 转向 Kotlin，协程与 Flow 成为语言的一部分，这是其他层面现代化的前提。数据层随之从 SharedPreferences、SQLite 和 HttpURLConnection 走向 DataStore、Room 和 Retrofit。UI 层从 XML 与 View 的命令式更新走向 Compose 的声明式渲染。架构从 MVC、MVP 演进为 MVVM，并在 MVVM 内部确立了单向数据流。工程则从 Groovy 和单模块走向 KTS、Hilt、多模块与现代化测试。

下面按语言、数据、UI、架构、工程的顺序，逐层展开。

---

## 领域一 · 语言：Java → Kotlin

### 1. Kotlin 如何取代 Java 成为首选

Android 自 2008 年发布起，应用层就只有一种官方开发语言：Java（native 层另有 NDK，不在此列）。这不是主动选择，而是历史继承——框架 API、运行时、工具链全部围绕 Java 构建。Java 在移动场景下有三个结构性问题：类型系统不区分 nullable 和 non-null，NPE 长期是最主要的崩溃来源之一；数据类需要几十行样板代码只为了承载几个字段；没有原生协程，异步编程只能依赖回调或外部库。

这些不是 Java 的“错误”，而是 Java 的设计年代和移动开发场景之间的张力。

Google 的态度经历了三个阶段。2017 年宣布 Kotlin 成为官方支持语言，关键词是“可选”。2019 年宣布 Kotlin-first，新 API、库和文档以 Kotlin 优先。同年发布的 Compose 从一开始就只支持 Kotlin；此后 Hilt、Room 等组件的 Kotlin 支持也优先于 Java，Kotlin 从“可选”变成了默认入口。Kotlin 与 Java 的 100% 互操作性意味着不需要一次性重写，但渐进式迁移本身有代价：混合代码库要同时支持两套工具链，J2K 自动转换的结果远非惯用 Kotlin。

但 Kotlin 对 Android 范式的改变，不在于语法糖的多少。真正根本性的变化在于，Kotlin 作为语言，为异步编程提供了原生的基础设施。`suspend` 函数和 `CoroutineScope` 是语言级特性，它们让异步代码可以“写起来像同步代码”。数据层的 Flow、架构层的 StateFlow、UI 层的 Compose，都建立在协程之上。

### 2. 协程到底是什么

在 Java 时代，异步编程依赖 `AsyncTask` 或 RxJava。`AsyncTask` 与生命周期强绑定，屏幕旋转时任务丢失或重复发起。RxJava 带来了声明式组合，但 `Disposable` 必须手动管理，漏一个就泄漏。两者的共同问题是：**取消和生命周期管理始终是开发者的手动负担。**

Kotlin 协程从语言层面回应了这个问题。

协程不是线程。线程由操作系统管理，创建和切换成本高。协程由程序自己创建和调度，是一段被 Kotlin 编译器重写过的可挂起计算，可以在明确定义的点暂停，稍后恢复。

关键区别在于：当一个线程执行耗时操作时，它被阻塞，占用的系统资源无法被其他任务使用。当一个协程遇到耗时操作时，它挂起——释放它所占用的底层线程，让该线程去执行其他协程。挂起的协程在堆上只需几十字节，而阻塞的线程需要保留兆字节的栈内存。

协程的核心价值不只是轻量。更重要的是结构化并发。在结构化并发模型下，协程形成一棵父子层次树，子协程的生命周期被限制在父协程的生命周期内。取消父协程会自动传播到所有子协程，异常沿协程树向上传播，不会丢失。

在 Android 开发中，结构化并发的典型体现是 `viewModelScope` 和 `lifecycleScope`。`viewModelScope` 在 ViewModel 清除时自动取消所有子协程，开发者不再需要手动管理 `Disposable` 或写取消代码。

协程解决的根本问题是：**异步任务的取消和生命周期管理，从开发者的手动操作变成了作用域的结构性保证。**

### 3. Flow 的引入

协程解决了一次性异步任务的问题。但很多场景需要的是多个值的异步序列。

比如用户在搜索框中连续输入，每次输入都触发一次搜索请求。用 `suspend` 函数，每次请求返回一个结果，但用户想要的是“连续输入对应的连续结果”，而不是“一次请求一个结果”。这就是 Flow 出现的原因。

Flow 是 Kotlin 协程库的一部分，提供了一种异步处理数据流的方式。它的本质是一个序列——像 Kotlin 的 `Sequence` 一样简单，但所有操作都是挂起函数。与 `suspend` 函数只返回单个值不同，Flow 可以按顺序发出多个值。

Flow 有两种形态：冷流和热流。这个区分不是技术细节，它决定了数据流在什么时候开始工作、在什么时候停止工作。

用 `flow { }` 构建器创建的是冷流。每个收集者都会独立触发上游代码的执行。没有收集者时，上游代码不会运行。这适合“按需计算”的场景。

`StateFlow` 和 `SharedFlow` 是热流。从热流收集数据不会触发任何提供方代码。热流始终活跃，适合“持续暴露”的场景。

`StateFlow` 管状态，必须有初始值，默认去重。`SharedFlow` 管事件，不要求初始值，可配置 `replay`。这个分离解决了传统范式中 `LiveData` 把状态和事件混在一起、需要用 `SingleLiveEvent` 打补丁的问题——状态和事件是两种不同的东西，混在一起会导致粘性、重复消费、难以追踪。

Flow 引入了一个新问题：生命周期安全收集。如果 UI 在后台仍然收集 Flow，会导致资源浪费和潜在错误。解决方案是 `repeatOnLifecycle`——在 `STARTED` 时启动收集，在 `STOPPED` 时取消收集。Compose 中对应的是 `collectAsStateWithLifecycle`。

语言层的范式转变，核心不是 Kotlin 的语法更简洁，而是异步编程的基础设施从“库”变成了“语言”。RxJava 是外部依赖，协程是 Kotlin 语言的一部分；`Disposable` 是手动管理，`CoroutineScope` 是结构化保证。这个转变让后续所有层面的现代化成为可能。

---

## 领域二 · 数据层：一次性读取 → 流式观察

### 1. 为什么数据层先变

语言层提供了协程与 Flow，但工具本身不会自动改变任何东西。需要有人先用起来。

第一个用起来的是数据层。不是因为它最重要，而是因为它最容易替换。数据层的三个核心组件——DataStore、Room、Retrofit——的替换是局部的、可控的、立即可用的。不需要额外的架构改造，也不需要 UI 层的配合。

相比之下，UI 层的现代化需要 Compose 的引入，架构层的现代化需要 ViewModel 和 UDF 的配合，工程层的现代化需要工具链的整体升级。数据层没有这些前置条件。

### 2. 三个组件走向流原生

数据层有三个核心组件：本地存储、数据库、网络。它们各自面对不同的问题，但走向了同一个方向。

#### 本地存储：SharedPreferences → DataStore

`SharedPreferences` 的设计假设是“数据量小、读写不频繁、主线程调用没关系”。但随着应用复杂度增加，这个假设失效了。读写是同步的，主线程调用 `getString` 会阻塞 UI；`apply()` 虽然把写盘交给了后台，但系统在 `onPause`、`onReceive` 返回等节点会调用 `QueuedWork.waitToFinish()` 同步等待所有挂起的写盘完成，主线程照样可能被卡住，严重时触发 ANR。官方文档如今明确建议新项目改用 DataStore。

DataStore 于 2021 年 8 月发布正式版，基于 Kotlin 协程和 Flow 构建。变化的核心在返回类型：`SharedPreferences` 返回同步值，DataStore 返回 `Flow<Preferences>`。存储层不再是“读取一次、返回一个值”，而是“持续暴露当前状态”。任何对存储的修改都会自动推送到收集者。**从读取一次，到观察变化。**

#### 数据库：SQLiteOpenHelper → Room + Flow

`SQLiteOpenHelper` 需要手动写 SQL、手动管理 `Cursor`、手动把每一列映射到对象。一个简单的查询需要几十行代码，而且容易出错——列名拼错、类型转换异常、Cursor 忘记关闭，都是常见问题。

Room 用注解和编译时代码生成替代了这些。但它的核心变化不在于“更简单的数据库”，而在于 DAO 可以直接返回 `Flow` 或 `suspend` 函数。查询返回 `Flow<List<Item>>` 意味着：数据库中的任何变化都会自动推送到收集者。数据库从一个被动的存储容器，变成了一个主动的数据流源头。**从查询一次，到订阅变化。**

Room 2.7 起进一步重构为 Kotlin 多平台库，引入了可替换的 `SQLiteDriver` 抽象（Android 上默认仍走框架自带的 SQLite），并把协程当作一等公民——`setQueryCoroutineContext` 让查询的调度上下文可以被显式指定。DAO 函数既可以写成挂起函数，也可以返回 `Flow`、`LiveData` 这类响应式类型；真正被禁止的是在主线程直接调用同步 DAO，这一点由 Room 自身的线程检查兜底。

#### 网络：HttpURLConnection → Retrofit + 协程

`HttpURLConnection` 需要手动处理输入输出流、手动在后台线程执行、手动切回主线程更新 UI。`OkHttp` 接管了连接池、缓存、HTTP/2 和线程池调度，`enqueue()` 提供了开箱即用的异步请求，但代码组织方式仍然是回调嵌套，取消和生命周期还是要调用方自己管。`Retrofit` 带来了类型安全的接口声明，但早期仍然返回 `Call` 或 `Observable`，调用方需要自己处理线程切换和取消。

Retrofit 从 2.6.0 开始支持 `suspend` 函数。网络调用可以直接写成挂起函数，在 `viewModelScope` 中调用时，协程自动在后台线程执行网络请求，返回时自动回到调用方的上下文。线程调度、取消、异常传播，全部由协程作用域接管。**从调用一次、等待回调，到挂起等待、自动恢复。**

#### 三个组件的差异与共同方向

本地存储和数据库的转变是**返回类型**的变化：从同步值变成 Flow。网络层的转变是**调用方式**的变化：从回调变成挂起函数。前者改变的是数据如何被暴露，后者改变的是异步如何被表达。

方向是一致的：三个组件都从“发起一次操作、等待一个结果”走向“声明一条数据流、订阅它的变化”。

### 3. Repository：三个组件的收束

三个组件各自演变之后，需要一个统一的层把它们组织起来。这个层就是 Repository。

Google 在 2017 年的架构指南中正式推荐了 Repository 模式，作为 UI 层和数据源之间的中介。传统范式里，数据获取逻辑散落在 Activity、Presenter 或 ViewModel 中。网络请求、本地缓存、数据合并全部混在业务逻辑里。调用方需要知道“先读缓存再请求网络，然后合并结果”的逻辑，这些逻辑和 UI 逻辑纠缠在一起，测试困难。

Repository 的职责是封装数据来源，对外暴露统一接口。调用方不需要知道数据来自哪里，只需要订阅 Repository 暴露的流。Repository 不发起请求，不管理线程，不关心 UI。它只描述“数据如何流动”。线程切换由 `flowOn` 声明，取消由调用方的作用域决定。

Repository 的出现让“数据从哪里来”的决策集中到了一层。ViewModel 不再需要知道数据来自网络还是缓存，只需要订阅 Repository 暴露的 `Flow`，把数据转换成 UI 状态。这正好是“从读取到观察”在架构层的体现——ViewModel 观察 Repository 的数据流，UI 观察 ViewModel 的状态流，每一层都只订阅上游的变化，而不是主动去拉取。

### 4. 转变点

数据层的转变分三条线发生。本地存储从“读取一次”变成“观察变化”，数据库从“查询一次”变成“订阅变化”，网络从“调用一次、等待回调”变成“挂起等待、自动恢复”。

三条线的具体问题不同，转变方式不同，但方向一致：数据的获取不再是一次性的动作，而是一个持续的关系。**数据不再是被“读取”的，而是被“观察”的。**

这个转变让 UI 层可以用统一的 `collect` 消费所有数据源，不再需要为每种数据源写不同的获取和更新逻辑。

---

## 领域三 · UI：XML/View → Compose

### 1. View 体系的结构性约束

Android 的 UI 构建从 2008 年起就围绕 XML 布局和 View 体系展开。开发者用 XML 描述界面结构，用 `findViewById` 获取视图引用，用 `setText`、`setVisibility` 等命令式方法更新界面。

View 体系的核心特征是**布局和逻辑分离在两个文件中**。布局在 XML 里，逻辑在 Activity/Fragment 里，两者通过 ID 连接。

布局文件 `activity_list.xml` 定义了一个 `FrameLayout`，包含三个子视图——`ProgressBar`、`RecyclerView`、`TextView`——每个子视图有一个字符串 ID。逻辑文件 `ListActivity.kt` 在 `onCreate` 中通过 `findViewById(R.id.progressBar)` 逐一声明引用，在 `render()` 函数中根据状态手动设置每个视图的可见性。两个文件之间唯一的联系是字符串 ID。

```xml
<FrameLayout>
    <ProgressBar android:id="@+id/progressBar" />
    <RecyclerView android:id="@+id/list" />
    <TextView android:id="@+id/emptyHint" />
</FrameLayout>
```

```kotlin
private fun render(state: ListUiState) {
    progressBar.isVisible = state is ListUiState.Loading
    list.isVisible = state is ListUiState.Success
    emptyHint.isVisible = state is ListUiState.Empty
}
```

这三个引用都来自 `findViewById(R.id.xxx)`，ID 必须和 XML 里的声明逐字对上。编译器不会替你在两个文件之间建立任何关联——改一个 ID，另一处要到运行时才崩。

这个分离带来三种失效模式：

- **RecyclerView 的更新与状态变化不同步。** `notifyItemChanged` 只是把更新排进下一次布局，从调用到实际重绘之间存在窗口期。手动使用 `DiffUtil` 时更麻烦：diff 计算跑在后台线程，两批变更的结果可能乱序返回，后算完的旧数据覆盖先算完的新数据，表现为 item 闪烁或索引越界。
- **多个异步任务的返回顺序不确定。** 两个并发请求谁先回来无法预知，后到的结果会覆盖先到的，UI 可能停在不一致的中间态。
- **配置变更时视图状态丢失。** 屏幕旋转时 Activity 重建，`TextView` 的文本、`RecyclerView` 的滚动位置全部丢失，需要手动保存和恢复。

三种失效模式的共同根源是同一个：**状态变化和 UI 更新是两个独立步骤，中间需要开发者手动写代码连接。** XML 是静态的，它只描述视图树结构，不包含任何动态行为。任何状态相关的视图变化都必须由代码在运行时完成。

### 2. Compose 的运行时机制：自动重组

Compose 把布局和逻辑合并到同一个 Kotlin 函数中。一个 `@Composable` 函数 `ListScreen(state: ListUiState)`，函数体内是一个 `when` 表达式，每个分支直接返回对应的界面描述：`Loading` 分支返回 `CircularProgressIndicator()`，`Success` 分支返回 `ItemList(state.items)`。没有 XML，没有 `findViewById`，没有 ID 连接。布局和逻辑在同一个函数里，代码结构直接反映界面结构。

但“代码写在一起”只是表象，真正的差异在运行时。

#### 2.1 自动重组的本质是监听，但连接关系由编译器推导

Compose 运行时维护一个 Composition——可组合项执行后生成的描述树。状态变化时，Compose 安排重组，重新执行**读取了该状态的可组合项**，而不是全量刷新。

`@Composable` 函数会被编译器插件改写。这个插件是 Kotlin 编译器的一个扩展，工作在编译流程的 IR 阶段：它给每个可组合项插入 `Composer` 的分组调用，划出重组作用域的边界。但 `val x by state` 的取值仍然来自 `state` 对象本身——真正记录依赖关系的是快照系统，它在读取发生的那一刻把“当前这个重组作用域读了 `state`”登记下来。状态变化时，运行时据此知道该重新执行哪些作用域。Compose 之所以只支持 Kotlin，原因也在这里：这套改写依赖 Kotlin 编译器插件，Java 没有等价的机制。

**重组作用域**是可组合项在 Composition 中的对应节点。每个可组合项的执行对应一个作用域，作用域记录了它读取了哪些状态。状态变化时，只有依赖了该状态的作用域会被标记为需要重新执行。

**自动重组的本质仍然是监听，但连接关系不是开发者注册的，而是编译器从“谁读取了状态”中自动推导的。** 传统范式里，开发者写 `stateFlow.collect { render(it) }`，显式注册监听。Compose 里，开发者只写“读取 state，描述界面”，编译器在编译期发现这个可组合项读取了 `state`，于是在运行时记录了依赖关系。没有人写“监听 state”，但编译器生成了等价的连接。

第一个后果是：不存在“忘记监听”——只要你读了这个状态，编译器就自动建立连接。

#### 2.2 跳过机制：依赖追踪与参数稳定性

第二个后果是：监听范围由代码结构决定。如果你把一个状态读取放在一个很上层的可组合项里，这个状态变化会导致整个上层重组；如果放在底层，就只有底层重组。这个规则决定了重组的粒度，也是跳过机制的基础。

重组不是无条件的。Compose 通过两个机制决定是否跳过某个可组合项。

第一个是**依赖追踪**：编译器记录了每个可组合项读取了哪些状态。没有读取变化状态的可组合项，不会被重新执行。

第二个是**参数稳定性判定**。如果某个类型是稳定的——不可变，或者 Compose 能够确定其值在重组之间没有变化——且两次调用的 `equals` 相同，该可组合项被跳过。如果参数不稳定，Compose 在重组父项时会始终对它执行重组。

参数稳定性的影响可以用一个例子说明。`ItemList(items: List<Item>)` 的 `items` 是 `List`，而 Compose 编译器默认把 `List` 判为不稳定——它无法排除运行时拿到的其实是一个 `MutableList`。类型一旦不稳定，Compose 就不再拿 `equals` 去比内容，而是保守地假设“可能变了”；于是父级每次重组都会重新执行 `ItemList`，哪怕 `items` 的内容一个字节都没动。换成 `ImmutableList` 之后，编译器知道集合不会被修改，内容相同就可以跳过。

#### 2.3 稳定性是开发者的新责任

跳过机制依赖参数稳定性。但稳定性不是自动保证的——它是开发者的新责任。

编译器会自动推断稳定性。基本类型、`String`、函数类型和枚举天生稳定；一个所有属性都是 `val`、且属性类型也都稳定的数据类，会被推断为稳定；含有 `var` 属性的类不稳定；`List`、`Set`、`Map` 这三个标准库集合接口一律不稳定，因为编译器无法排除背后藏着可变实现。这个判定会传染：数据类只要有一个 `List` 字段，整个类就被判为不稳定，所有依赖它的可组合项在父级重组时都会被重新执行。

恢复稳定性有三条路。一是用 `kotlinx.collections.immutable` 的 `ImmutableList`、`ImmutableSet` 替代标准集合，这是唯一能在编译期真正保证不可变的办法。二是给数据类加 `@Immutable` 或 `@Stable` 注解，向编译器承诺契约。三是在稳定性配置文件里把 `kotlin.collections.*` 整体声明为稳定，但官方同时提醒：这样 Compose 就得对集合做 O(N) 的 `equals` 比较，大集合下得不偿失。

两个注解的语义不同。`@Immutable` 承诺对象的所有公开属性在构造后永远不会变化——包括对象内部的引用。`@Stable` 的语义更宽，它可以表示不可变，也可以表示“可变但变化时会被 Compose 观察到”——`MutableState` 自己就是这么标注的。`@Stable` 的约束比 `@Immutable` 弱，使用时要更谨慎。两者都是与编译器签的合约，而不是让对象变得不可变的魔法。**如果注解语义不真实，会导致 UI 不刷新——这是比性能问题更危险的后果。**

还有一个过去常被提到、如今已经不太成立的坑：lambda 传递破坏跳过。在 Kotlin 2.0.20 之前，每次重组新建的 lambda 引用都不同，会被当作变化的参数，导致子可组合项逐一重组，当时的解法是手动 `remember` 缓存。自 Kotlin 2.0.20 起，强跳过模式（strong skipping）默认开启，编译器会自动记忆化可组合项内部的 lambda——只要捕获的值引用不变，就复用同一个实例，不稳定参数也改用 `===` 参与比较。手写 `remember { { ... } }` 在多数场景下已经不再必要。

#### 2.4 重组是异步的

前面讲的是“谁需要重组”。重组还有一个时间维度上的约束：**它不是同步的。**

状态变化后，Compose 把重组安排到下一个帧周期，而不是立即执行；同一帧内的多次状态变化会被合并成一次重组。这意味着状态变化和 UI 更新之间有一个帧的延迟。承担这个合并工作的是快照（`Snapshot`）系统：状态变化先被记录进快照，到重组时才被读取。

`Snapshot` 系统还保证了状态变化的一致性。在一次重组中读取到的所有状态，都来自同一个 `Snapshot`。如果重组过程中有新的状态变化，这些变化会被记录到下一个 `Snapshot`，在下一次重组中生效。这避免了“重组读到一半状态变了”导致的不一致。

所以 Compose 保证的是“状态变化后，UI 最终会更新”，而不是“立即更新”。这个约束在动画、手势、输入等场景下有实际影响——如果需要在一帧内完成多个状态变化并让 UI 只更新一次，需要用 `Snapshot.withMutableSnapshot` 批量提交。

#### 2.5 副作用与重组生命周期

前面几节讲的是“谁需要重组”和“什么时候重组”。但重组会多次执行同一个可组合项，所以副作用需要单独管理。

可组合项中不能直接写副作用。Compose 提供了一组 API 来管理“在什么时机执行什么操作”。`LaunchedEffect` 在首次组合时启动协程，在 key 变化时重启，在可组合项离开组合时取消。`DisposableEffect` 用于需要在 key 变化或组件离开组合时清理的操作。`derivedStateOf` 从其他状态派生出新状态，只有派生结果变化时才触发重组——它把重组的触发条件从“源状态每次变化”收窄为“派生结果变化”，在高频输入的场景下能显著减少无谓重组。

这些 API 的存在说明：**布局和逻辑合并后，副作用的生命周期需要显式声明，而不能依赖“函数只执行一次”这个假设。** 重组可能以任意顺序执行、可能被丢弃，因此可组合项应当是“无副作用”的。

#### 2.6 互操作

前面五节讲的是 Compose 自身的机制。但现实项目中，Compose 和 XML 长期共存，需要处理两者的互操作。

在 XML 中嵌入 Compose，用 `ComposeView`。`ComposeView` 是一个普通的 Android View，可以像其他 View 一样放进 XML 布局。它在 `onAttachedToWindow` 时创建 Composition，销毁时机则由 `ViewCompositionStrategy` 决定：默认策略是 detach 时销毁，但如果宿主是 RecyclerView 这类会回收复用 View 的容器，View 进入回收池时并不会立刻销毁。Fragment 场景官方推荐显式改用 `DisposeOnLifecycleDestroyed`，否则重组可能在后台继续执行。

在 Compose 中嵌入 View，用 `AndroidView`。`AndroidView` 在首次组合时创建 View 实例，在重组时触发 `update` 回调。状态同步需要手动处理——`update` 回调在每次重组时触发，如果 View 的状态需要和 Compose 状态保持一致，需要在 `update` 里手动同步。生命周期方面，`AndroidView` 的 View 实例在可组合项离开组合时销毁，但 View 自身的生命周期需要单独处理。

互操作时最大的风险是**状态同时存在于 View 体系和 Compose 体系中**。如果两个体系各自持有一部分状态，需要明确单一可信来源——通常是以 Compose 的状态为准，`AndroidView` 的 `update` 回调负责把状态同步到 View。

### 3. 导航：声明式路由与状态化返回栈

导航的演变和 UI 渲染同构：从手动管理事务变成状态驱动。

传统导航靠 `Intent` 和 `FragmentManager`。返回栈是 `FragmentManager` 的内部状态，参数通过 `Bundle` 传递，深层链接手动解析。导航逻辑与 UI 逻辑纠缠，无法单独测试。

Navigation Compose 把导航图定义为 Kotlin DSL：

```kotlin
NavHost(navController, startDestination = "list") {
    composable("list") {
        ListScreen(onItemClick = { id -> navController.navigate("detail/$id") })
    }
    composable("detail/{id}") { backStackEntry ->
        val id = backStackEntry.arguments?.getString("id")
        DetailScreen(id)
    }
}
```

路由和参数成为可序列化的类型。返回栈是 `NavController` 的状态，可被观察、可被测试。`NavHost` 本身是一个可组合项，导航图的切换触发重组。

Navigation 3 走得更远：它把返回栈直接做成了一个 Compose 状态对象——`rememberNavBackStack` 返回的 `NavBackStack<T>`，本质上是 `SnapshotStateList<T>` 的类型安全包装。返回栈的修改直接触发重组。这意味着导航不再是一个“框架内部机制”，而是一个完全暴露给开发者的状态：压入和弹出就是列表的增删操作，任何观察它的可组合项都会自动重组。Navigation 3 已于 2026 年初发布稳定版，官方把它定位为 Compose 应用的首选导航方案。

这个设计正好回扣了第 2 节的机制。返回栈是一个状态，导航操作是状态变化，重组自动响应——和 `StateFlow` 的变化触发重组是同一套机制。导航和 UI 渲染共享同一个运行时：状态变化触发重组，重组重新执行读取了该状态的可组合项。区别只在于，UI 渲染的状态是 `StateFlow<UiState>`，导航的状态是 `SnapshotStateList`。

### 4. 转变点

语言层解决了取消和生命周期管理，数据层解决了数据获取，UI 层解决了状态到视图的同步。

传统范式里，取消、线程、状态同步是三件独立的事，开发者分别处理：手动管理 `Disposable`，手动切换线程，手动调用 `render()`。现代范式里，这三件事被统一的机制覆盖——协程作用域管取消，Flow 管运输，Compose 管渲染。三者的边界由框架定义，开发者只需要声明意图。

UI 层是五个层面中转变最晚的。Compose 依赖 Kotlin 编译器、协程与 Flow、ViewModel 的状态管理，没有语言层和数据层的先行，Compose 无法出现。

而 UI 层把状态到视图的同步接管之后，状态的归属和管理成为下一个要解决的问题。这正是架构层要处理的。

---

## 领域四 · 架构：MVC/MVP → MVVM + UDF

### 1. 传统架构的演变过程

Android 早期的架构被称作 MVC，但 Activity 同时承担着 View 和 Controller 的双重角色。名义上 XML 是 View、Activity 是 Controller；实际上 Activity 还要处理用户输入、发起网络请求、更新 UI，什么都做。MVC 在 Android 上名存实亡。

MVP 是第一次系统性的关注点分离。Presenter 承载业务逻辑，View 只负责渲染和事件转发。Presenter 不持有 View 的引用，通过接口与 View 通信。Presenter 可以独立写单元测试，不依赖 Android 框架。这是 Android 架构史上第一次真正的可测试性提升。

但 Presenter 仍然需要感知 View 的存在。异步任务完成后，Presenter 调用 `view.showData()`。而 View 的生命周期由系统管理——屏幕旋转、进程被杀、后台回收，View 可能在任何时候被销毁。开发者需要在 `onDestroy` 里手动断开连接，但异步任务可能在断开之后才返回，仍然会触发对已销毁 View 的调用。

MVVM 加 Architecture Components（AAC）解决了生命周期问题。`ViewModel` 的生命周期独立于 Activity——它在配置变更时存活，在页面真正销毁时清除。`LiveData` 是生命周期感知的，它只在 Activity 处于活跃状态时通知观察者。开发者不再需要在 `onDestroy` 里手动清理，也不需要在异步回调里检查 View 是否还存在。

但传统 MVVM 有一个固有问题。一个页面可能暴露多个 `LiveData`：`isLoading`、`data`、`error`。UI 需要同时观察这三个容器，手动组合它们的状态。这些组合状态没有在类型上被约束，全靠开发者的约定和判断。状态散落在多个容器中，每个容器可以被独立修改。

### 2. 约束变化：为什么需要单一可信来源

状态散落的问题不是“代码写得不好”，而是约束变化后的必然结果。

**状态组合爆炸。** 一个列表页可能有六个维度的状态：加载中、数据、错误、空、筛选条件、分页游标。如果用独立的 `LiveData` 或布尔值表示，理论上存在 2^6 = 64 种组合。其中大部分是无效的——`isLoading` 和 `hasError` 同时为 true，`data` 不为空但 `isEmpty` 为 true，等等。UI 需要处理所有组合，但实际上只有少数几种是合法的。开发者需要手动判断“当前是哪个合法状态”，这个判断逻辑散落在各处，每次新增一个状态维度，组合数翻倍。

**时序竞态。** 用户连续切换筛选条件，每次切换触发一次请求。请求 A 返回得慢，请求 B 返回得快。如果 A 的结果后到，UI 会显示旧筛选条件的数据。用户看到的是“筛选条件已经变了，但列表还是旧的”。要解决这个问题，需要手动维护请求代次——每次请求递增一个序号，返回时检查序号是否是最新的。这个逻辑和业务逻辑无关，但必须写，而且很容易漏。

**可测试性。** ViewModel 的引入是为了让业务逻辑可以脱离 Android 框架做单元测试。但如果 ViewModel 暴露多个 `LiveData`，测试需要验证多个状态容器的组合结果。状态转换不是显式的，测试无法断言“从 Loading 到 Success 是一个合法的转换”。

这三个约束指向同一个方向：**状态需要有一个单一可信来源，状态转换需要是显式的、可验证的。**

这个方向不是 Google 发明的。UDF 的思想源头可以追溯到 2012 年的 Elm——它的 Model-Update-View 结构后来被提炼为 Elm Architecture——以及 2014 年 Facebook 在 F8 公布的 Flux 架构。Android 社区在 2016 年前后开始探索 MVI 等具体实现形式。Google 则在 2022 年重写了官方架构指南：新版 UI 层文档不再使用“MVVM”这个词，改用“状态容器 + 单向数据流”来描述同一件事，官方架构建议页把 UDF 列为强烈建议项。需要说明的是，官方并没有宣布“UDF 取代 MVVM”，它只是不再用 MVVM 这个标签——分层结构没变，变的是描述状态流动的语言。

### 3. 迁移路径：从多状态到单一 UiState

传统 MVVM 里，ViewModel 可能暴露三个独立的 `LiveData`：

```kotlin
val isLoading: LiveData<Boolean>
val data: LiveData<List<Item>>
val error: LiveData<String>
```

MVVM + UDF 里，ViewModel 暴露一个 `StateFlow<ListUiState>`：

```kotlin
sealed interface ListUiState {
    data object Loading : ListUiState
    data class Success(val items: List<Item>) : ListUiState
    data class Error(val message: String) : ListUiState
    data object Empty : ListUiState
}
```

状态从“多个独立容器”变成了“一个密封接口的实例”。密封类型的类型系统保证了状态的互斥性——`Loading` 和 `Success` 不能同时存在，因为它们是同一个密封接口的不同子类型。无效组合在类型层面就被排除了。

状态转换也变得显式。从 `Loading` 到 `Success` 是一次 `_uiState.value = ListUiState.Success(items)`。测试可以直接断言“初始状态是 Loading，请求成功后状态是 Success，请求失败后状态是 Error”。不需要组合多个容器，不需要处理中间态。

事件和状态也分开了。持久状态——列表数据、筛选条件、加载状态——用 `StateFlow<UiState>` 暴露。一次性事件——导航指令、Snackbar 提示——用 `SharedFlow` 或 `Channel` 传递。语言层讲过的那个区分，在架构层落成了具体职责：状态可以被重复消费，事件不能。

竞态问题也有了更清晰的解法。用户连续切换筛选条件时，用 `flatMapLatest` 取消前一次请求：

```kotlin
val uiState = query
    .debounce(300)
    .flatMapLatest { query ->
        flow {
            emit(ListUiState.Loading)
            try {
                val items = repository.search(query)
                emit(if (items.isEmpty()) ListUiState.Empty else ListUiState.Success(items))
            } catch (e: Exception) {
                emit(ListUiState.Error(e.message ?: "未知错误"))
            }
        }
    }
    .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), ListUiState.Loading)
```

`flatMapLatest` 在收到新的 `query` 时取消上一次的请求流。旧请求的结果不会到达 `emit`，不会覆盖新请求的状态。竞态不是靠手动维护请求代次解决的，而是由 Flow 的取消机制保证的。

### 4. 现代架构：三层结构 + UDF

传统 MVVM 和 MVVM + UDF 的核心差别，不在于是否使用 ViewModel，而在于**状态是否有单一可信来源**。传统 MVVM 里，ViewModel 是多个状态的容器；MVVM + UDF 里，ViewModel 是单一状态的持有者。

这里需要先澄清一个常见的误解：UDF 不是用来取代 MVVM 的。MVVM 是架构模式，定义分层结构；UDF 是数据流原则，定义数据在层与层之间的流动方向。两者是组合关系，不是替代关系。MVVM 提供了状态容器——ViewModel。UDF 规定了容器内的数据如何有序流动。

Google 在官方架构指南中推荐了分层架构，明确划分了 UI 层、领域层（可选）和数据层，每层只依赖它的下一层，不跨层反向依赖。

**UI 层**负责渲染和事件上抛。它观察 ViewModel 暴露的 `StateFlow<UiState>`，把状态渲染成界面。用户操作触发事件，事件上抛给 ViewModel。UI 层不修改状态，不发起请求，不管理取消。

**数据层**由 Repository 和 DataSource 组成。Repository 封装数据来源——网络、缓存、数据库——对外暴露统一的 `Flow` 或 `suspend` 函数。DataSource 是具体的实现，网络请求用 Retrofit，本地存储用 Room 或 DataStore。数据层不关心 UI，不关心状态，只描述“数据如何流动”。官方强烈建议即使只有一个数据源也要创建 Repository。

**领域层**是可选的。当业务逻辑跨越多个 Repository 时，领域层封装这些跨 Repository 的用例。对于简单的 CRUD 应用，领域层可以省略，ViewModel 直接调用 Repository。

单向数据流把三层连接起来。UI 事件向上传递到 ViewModel，ViewModel 调用 Repository 获取数据，数据返回后 ViewModel 更新 `StateFlow<UiState>`，新的状态向下传递到 UI，Compose 自动重组。

三层结构定义了状态在架构层的位置。而在 Compose 层面，状态的位置由另一个原则决定——状态提升。状态应该放在使用它的可组合项的最近公共祖先。传统 MVVM 里，状态散落在多个 `LiveData` 中，每个状态可能被多个观察者独立消费；MVVM + UDF 里，状态被提升到 ViewModel 的单一 `StateFlow<UiState>`，所有 UI 层的变化都从这个单一来源派生。状态提升和单一可信来源是同一个原则在两个层面的体现：在 Compose 层面是“状态放在最近公共祖先”，在架构层面是“状态放在 ViewModel”。

`viewModelScope` 管理取消。ViewModel 清除时，所有子协程自动取消。数据层的 `Flow` 在调用方取消时停止上游执行。UI 层通过 `repeatOnLifecycle` 在 `STOPPED` 时停止收集，在 `STARTED` 时恢复收集。取消、线程、生命周期，三件事由三个不同的机制覆盖，但它们协同工作，不需要开发者手动协调。

### 5. 一个最简单的单体应用结构

以一个显示用户列表的应用为例，全部在一个 `app` 里：

```
app/src/main/java/com/example/simpleapp/
├── data/
│   ├── UserRepository.kt        # 封装 UserApi，暴露 suspend 函数
│   └── UserApi.kt               # Retrofit 接口
├── model/
│   └── User.kt                  # 纯数据类
├── ui/
│   └── userlist/
│       ├── UserListUiState.kt   # 密封类型：Loading / Success / Error
│       ├── UserListEvent.kt     # 密封类型：LoadUsers / Retry
│       ├── UserListViewModel.kt # 持有 StateFlow<UiState>，处理事件
│       └── UserListScreen.kt    # 纯 UI，接收 state 和 onEvent
└── MainActivity.kt
```

`UserListEvent` 是一个密封类型，包含 `LoadUsers` 和 `Retry` 两个事件。`UserListViewModel` 持有单一状态，通过 `onEvent` 统一接收事件：

```kotlin
@HiltViewModel
class UserListViewModel @Inject constructor(
    private val repository: UserRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<UserListUiState>(UserListUiState.Loading)
    val uiState: StateFlow<UserListUiState> = _uiState.asStateFlow()

    init { onEvent(UserListEvent.LoadUsers) }

    fun onEvent(event: UserListEvent) {
        when (event) {
            is UserListEvent.LoadUsers -> loadUsers()
            is UserListEvent.Retry -> loadUsers()
        }
    }

    private fun loadUsers() {
        viewModelScope.launch {
            _uiState.value = UserListUiState.Loading
            try {
                _uiState.value = UserListUiState.Success(repository.getUsers())
            } catch (e: Exception) {
                _uiState.value = UserListUiState.Error(e.message ?: "未知错误")
            }
        }
    }
}
```

UI 层只做两件事：收集状态，上抛事件。

```kotlin
@Composable
fun UserListRoute(viewModel: UserListViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    UserListScreen(state = uiState, onEvent = viewModel::onEvent)
}

@Composable
fun UserListScreen(
    state: UserListUiState,
    onEvent: (UserListEvent) -> Unit
) {
    when (state) {
        is UserListUiState.Loading -> LoadingIndicator()
        is UserListUiState.Success -> UserList(state.users)
        is UserListUiState.Error -> ErrorView(state.message) {
            onEvent(UserListEvent.Retry)
        }
    }
}
```

数据流闭环：

```
用户打开页面
    ↓
UserListRoute 收集 uiState
    ↓
UserListViewModel.init 触发 LoadUsers
    ↓
_uiState.value = Loading
    ↓
UserListScreen 渲染 LoadingIndicator
    ↓
repository.getUsers() 返回数据
    ↓
_uiState.value = Success(users)
    ↓
UserListScreen 自动重组，渲染 LazyColumn
```

整个循环里，UI 不修改状态，只上抛事件。ViewModel 不直接操作 UI，只更新状态。状态变化自动驱动 UI 更新。

`viewModelScope` 管理协程的生命周期，`repository.getUsers()` 是挂起函数，协程在 ViewModel 清除时自动取消。语言层和数据层的机制在这里汇合——协程提供了取消的结构性保证，挂起函数提供了异步调用的同步写法，`StateFlow` 提供了状态的持续暴露。架构层把这些机制组织成一个可预测的循环。

### 6. 转变点

架构层的范式转变，不是“从 MVVM 到 MVI”，而是**MVVM 从多状态容器变成了单一状态持有者。** UDF 不是新架构，是 MVVM 内部的数据流原则。

这个转变让架构层成为全文的枢纽。没有架构层，协程的取消范围、Flow 的订阅时机、Compose 的重组触发条件都无处安放。架构层定义了状态的生命周期——状态在哪个作用域中产生、在哪个作用域中消费、在哪个作用域中销毁。语言层提供了协程和 Flow，让状态可以在作用域内安全产生和销毁。数据层提供了流原生的 API，让状态可以从数据源持续观察。UI 层提供了自动重组，让状态变化自动驱动界面更新。但如果没有架构层把这些机制组织起来——状态在哪里、由谁修改、如何流动——三个层面的现代化只是孤立的工具，无法构成完整的范式。

架构层确定了状态的归属和管理方式之后，工程层要解决的是：这些架构模式如何被标准化地落地。Hilt 提供依赖注入，KTS 管理构建逻辑，多模块强制模块边界，现代测试工具链验证状态转换。这些是下一个层面的问题。

---

## 领域五 · 工程：Groovy/单模块 → KTS/Hilt/多模块/测试

### 1. 工程层的问题不容易被感知

架构层确定了状态的归属和管理方式。但这些模式如何在团队中稳定落地，取决于工程层的基础设施。

工程层的变化和前面四层不同。语言层有 Kotlin，数据层有 Flow 和 Room，UI 层有 Compose，架构层有 MVVM + UDF——每一层都有一个清晰的范式标志。工程层没有。KTS 看起来只是换了一种语法，Hilt 看起来只是少写了几行 `new`，多模块看起来只是把文件搬到了不同目录。

但工程层的变化不改变运行时的行为，只改变开发者的工作方式。它是其他四层能被团队稳定采用的前提。工程层有五个子领域：构建、依赖注入、模块化、测试、后台任务。它们各自面对不同的问题。

### 2. 构建：Groovy → KTS + Version Catalog

Groovy DSL 建立在动态类型语言之上，构建脚本没有类型检查。写错属性名或传错参数类型，要到构建运行时才发现。依赖版本手动管理，一个中型项目可能有几十个依赖，版本冲突靠手动排查。

这个问题在单模块项目里影响面有限——构建脚本的错误只影响一个模块。但多模块项目普及后，约束变了。一个模块的版本写错，可能导致整个项目构建失败；同一个库在不同模块中被声明为不同版本，运行时可能出现类冲突。构建配置的可维护性从“可以忍受”变成了“必须解决”。

Kotlin DSL（KTS）在 2023 年 7 月随 AGP 8.1 与 Android Studio Giraffe 成为新项目的默认构建脚本语言。它使用 Kotlin 语法编写构建脚本，提供类型安全和 IDE 补全。写错属性名或传错参数类型会在编译期报错。Version Catalog 集中管理依赖版本——所有依赖的坐标和版本在 `gradle/libs.versions.toml` 中声明，构建脚本通过别名引用，版本升级只需修改一处。

KTS 和 Version Catalog 的组合，让依赖版本对齐从“团队约定”变成了“编译期约束”。

### 3. 依赖注入：手动 → Hilt

传统范式里，依赖注入靠手动单例或 ServiceLocator。对象创建和持有散落各处，测试时无法替换依赖。

这个问题在单层测试里影响有限。但架构层引入 ViewModel + Repository + DataSource 之后，约束变了。ViewModel 依赖 Repository，Repository 依赖 ApiService 和 Dao——测试 ViewModel 时需要构造完整的依赖链，无法单独替换某一层。依赖注入从“少写几行 `new`”变成了“决定架构能否被测试”。

Hilt 在 2021 年 5 月发布稳定版，是 Jetpack 推荐的 Android 依赖注入方案，构建在 Dagger 之上。`@Inject` 标注构造函数，`@HiltViewModel` 标注 ViewModel，`@Module` 和 `@Provides` 声明无法通过构造函数注入的依赖。Hilt 自动管理 Android 类的生命周期——ViewModel、Activity、Fragment、Service、Worker 都有对应的 Hilt 组件，依赖的创建和销毁与这些组件的生命周期对齐。

Hilt 还解决了测试中的依赖替换问题。通过 `@TestInstallIn` 和 `@UninstallModules`，测试可以用 Fake 实现替换生产环境的绑定，ViewModel 的单元测试不需要构造完整的依赖链。依赖替换从“手动 mock”变成了“注解配置”。

### 4. 模块化：单模块 → 多模块

单模块项目里，所有代码在一个 module 里。编译时间随代码量线性增长，模块边界不清晰，不同功能的代码互相引用。

这个问题在代码量小的时候不明显。但代码量增长到几十万行后，约束变了。全量编译时间从几分钟涨到十几分钟，增量编译也越来越慢。不同功能的代码互相引用，修改一个功能可能影响另一个功能，重构困难。模块边界从“有更好”变成了“必须有”。

多模块项目按功能或层级拆分——`data` 模块封装数据和业务逻辑，`feature` 模块对应一个功能或一组屏幕，`core` 模块包含公共代码，`app` 模块是入口。

模块化的收益不只在编译时间。`api` 和 `implementation` 区分暴露的依赖和内部依赖，防止模块间过度耦合。模块边界同时成为团队协作的边界，不同开发者可以并行开发不同模块。模块边界从“开发者自觉遵守”变成了“Gradle 强制约束”——一个模块无法引用它没有声明的依赖。

### 5. 测试：仪器化 → runTest + Turbine + Compose 测试

传统测试以仪器化测试为主，依赖真机或模拟器。测试运行慢，隔离差，ViewModel 和 Repository 的逻辑无法脱离 Android 框架做单元测试。

这个问题在架构层引入 ViewModel 之后变得突出。ViewModel 的引入本来就是为了让业务逻辑可以脱离 Android 框架做单元测试，但测试工具链不配套，这个收益无法验证。ViewModel 和 Repository 的逻辑可以在本地 JVM 上跑，但测试协程需要虚拟时间，测试 Flow 需要发射序列断言，测试 Compose 需要 semantics tree——没有这些工具，ViewModel 的单元测试写不出来。

现代测试工具链把测试分成了几个层次，每个层次对应前面某一层引入的新机制。

`runTest` 解决协程测试的虚拟时间问题，对应语言层的协程。`TestCoroutineScheduler` 管理虚拟时间，`viewModelScope` 中 `delay(5000)` 在测试中不会真实等待 5 秒，而是立即推进虚拟时间。`TestDispatcher` 通过 `Dispatchers.setMain` 替代生产环境的 `Dispatchers.Main`，让 `viewModelScope.launch` 在测试中同步执行。

Turbine 解决 Flow 发射序列的断言问题，对应数据层的 Flow。`awaitItem()` 等待下一个发射值，`expectNoEvents()` 断言没有额外发射，能检测到 Flow 中的竞态条件——比如 Room 的响应式查询在数据变化时是否发射了预期数量的值。

`createComposeRule` 解决 Compose 的 UI 测试问题，对应 UI 层的 Compose。测试针对无状态（stateless）的可组合项，通过 semantics tree 定位节点，和屏幕阅读器读取的是同一棵树。写可测试的 Compose 和写可访问的 Compose 是同一件事。

### 6. 后台任务：Service → WorkManager

传统后台任务的方案是混用的：`Service`、`IntentService`、`JobScheduler`、`AlarmManager` 各有一套 API 和生命周期语义，选哪个取决于 API 级别和任务类型。

Android 6.0 引入 Doze 模式后，`AlarmManager` 的行为变得不可靠——设备进入 Doze 后，Alarm 被推迟到维护窗口才触发。Android 8.0 限制后台 Service 后，`Service` 不再能长时间运行——后台应用启动 Service 会被系统限制。约束变了：开发者需要一套统一的 API，描述“在什么条件下执行什么任务”，而不是手动适配不同版本的调度机制。

WorkManager 对外暴露统一的 API，底层按 API 级别自动选择调度器——`JobScheduler` 可用时用它，否则回落到 `AlarmManager` 加 `BroadcastReceiver`。这个回落分支如今主要具有历史意义：WorkManager 早期支持到 API 14，2.11 起最低版本已提到 API 23，`JobScheduler` 在所有受支持设备上都可用。真正有价值的是声明式那一面——`WorkRequest` 可以声明约束条件（网络可用、设备充电中），任务只在约束满足时执行。`CoroutineWorker` 的 `doWork()` 是一个挂起函数，协程的取消机制和 WorkManager 的停止信号对齐——这和 `viewModelScope` 在 ViewModel 清除时取消子协程是同一个机制。协程的取消由作用域的结构决定，而不是由开发者手动触发。

### 7. 一个多模块项目结构示例

```
settings.gradle.kts              # 声明所有模块
gradle/libs.versions.toml        # 版本目录，集中管理依赖版本
app/
  └── build.gradle.kts           # 入口模块，依赖所有 feature
core/
  ├── model/build.gradle.kts     # 纯数据类，无 Android 依赖
  ├── data/build.gradle.kts      # Repository、DataSource
  ├── network/build.gradle.kts   # Retrofit 接口
  ├── database/build.gradle.kts  # Room 数据库
  └── designsystem/build.gradle.kts  # 主题、通用组件
feature/
  ├── player/build.gradle.kts    # 播放页
  └── library/build.gradle.kts   # 音乐库
```

`settings.gradle.kts` 声明模块：

```kotlin
include(":app")
include(":core:model", ":core:data", ":core:network", ":core:database", ":core:designsystem")
include(":feature:player", ":feature:library")
```

`gradle/libs.versions.toml` 集中声明版本：

```toml
[versions]
kotlin = "2.0.0"
compose = "1.7.0"
coreKtx = "1.13.1"
hilt = "2.51"

[libraries]
androidx-core = { group = "androidx.core", name = "core-ktx", version.ref = "coreKtx" }
compose-ui = { group = "androidx.compose.ui", name = "ui", version.ref = "compose" }
hilt-android = { group = "com.google.dagger", name = "hilt-android", version.ref = "hilt" }
```

`feature/player/build.gradle.kts` 声明依赖：

```kotlin
plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.hilt)
}

dependencies {
    implementation(project(":core:model"))
    implementation(project(":core:designsystem"))
    implementation(libs.compose.ui)
    implementation(libs.hilt.android)
}
```

模块的划分和前四层是对应的。`core:model` 不依赖 Android，因为数据类不需要 Android 框架——对应语言层的 Kotlin 数据类。`core:data` 返回 Flow，因为数据层是流原生的——对应数据层的 Flow 和 suspend。`feature:player` 包含 ViewModel 和可组合项，因为 UI 层和架构层的机制在这里汇合——对应 UI 层的 Compose 和架构层的 MVVM + UDF。

而 Gradle 强制了这些模块的边界：`settings.gradle.kts` 声明了所有模块，Gradle 在配置阶段就知道项目有哪些模块；`libs.versions.toml` 集中声明版本，任何模块引用 `libs.hilt.android` 都会解析到同一个版本；`feature/player/build.gradle.kts` 显式声明它依赖 `core:model` 和 `core:designsystem`，如果它试图引用 `core:data` 而没有声明，Gradle 会报错。这就是“模块边界由 Gradle 强制”的具体含义。

### 8. 转变点

工程层的范式转变，核心是**约束从约定变成机制。**

传统范式里，依赖版本对齐靠团队约定，模块边界靠开发者自觉，测试隔离靠手动 mock，后台任务调度靠手动适配不同版本的 API。现代范式里，Version Catalog 让版本对齐变成编译期约束，多模块让边界变成 Gradle 的强制依赖，Hilt 让依赖替换变成注解配置，WorkManager 让后台调度变成声明式配置。约束不再依赖团队约定，而是被工具强制执行。

工程层的标准化是其他四层机制能被团队稳定采用的前提。没有 Hilt，协程和 Flow 的注入点散落各处——ViewModel 需要手动创建 Repository，Repository 需要手动创建 ApiService，每个注入点都可能写错或遗漏。没有多模块，ViewModel 的测试边界无法强制——`core:data` 和 `feature:player` 的依赖关系靠自觉，测试时可能意外引入 Android 框架的依赖。没有 Version Catalog，Compose 和 Kotlin 版本的对齐靠人工检查——从 Kotlin 2.0 起 Compose 编译器并入 Kotlin 仓库、版本号跟随 Kotlin，Compose Compiler Gradle 插件也只适用于 Kotlin 2.0 及以上；Hilt 走 KSP 时，KSP 版本又必须与 Kotlin 版本严格匹配。这几条兼容关系，没有一条能靠肉眼在几十个依赖里排查出来。

工程层是五个层面中最后稳定下来的。原因在于，工程层要标准化的对象——Hilt 注入什么、KTS 管理什么、模块怎么划分——取决于前面四层用了什么。工程层的标准化需要等前面的层先确定“用什么”。Kotlin 成为默认语言、协程和 Flow 稳定、Compose 发布 1.0、MVVM + UDF 被官方推荐——这些在前四层发生之后，KTS、Hilt、Version Catalog 才陆续成为默认方案。

---

## 结语

五个层面各自解决的问题不同，但做的是同一件事：**把“开发者必须记得做”的事，变成“结构上没法不做”的事。**

| 层面 | 转变前由开发者手动负责 | 转变后由谁接管 |
|---|---|---|
| 语言 | 取消任务、切换线程、释放订阅 | 协程作用域的结构化并发 |
| 数据 | 何时重新拉取、如何通知 UI | Flow：返回类型从值变成流 |
| UI | 状态到视图的同步、视图引用的绑定 | Compose 编译器：读了状态就建立依赖 |
| 架构 | 判断“当前是哪一种合法状态” | 密封类型 + 单一 `StateFlow<UiState>` |
| 工程 | 版本对齐、模块边界、依赖装配 | Version Catalog、Gradle、Hilt |

每一行的右列都比左列更难写错，代价是出问题时更难看清。这次转变不是免费的，文中出现过的三笔账值得单独记一下。

**第一笔：稳定性成了新责任。** Compose 把重组决策交给了编译器，但编译器只能推断类型是否稳定，推断不出你的语义是否诚实。`@Immutable` 和 `@Stable` 是合约，签错了不会编译失败，只会让 UI 在某些路径上静默不刷新。手动写 `render()` 的年代，漏更新是看得见的 bug；现在漏更新可能是看不见的。

**第二笔：混合期要同时维护两套心智模型。** Kotlin 与 Java 100% 互操作，Compose 与 View 可以互相嵌入，这两件事都让渐进迁移成为可能，也都让混合代码库必须同时供养两套工具链和两套状态模型。互操作最大的风险不是 API 难用，而是状态同时存在于两个体系里，谁也说不清哪边是可信来源。

**第三笔：约束从约定变成机制，机制本身也要维护。** Version Catalog 把版本对齐变成编译期约束，多模块把边界变成 Gradle 的强制依赖——但配置文件和模块划分本身成了新的待维护对象。工程层是唯一一层收益不体现在运行时的层面，也因此最容易被排到最后。

这五层的顺序不是任意的。语言层提供了协程和 Flow，数据层才可能把返回类型改成流；数据层给出了流原生的 API，架构层才有单一 `StateFlow` 可暴露；架构层确定了状态的归属，Compose 的自动重组才有明确的触发源；前四层的选型稳定下来，工程层才知道该标准化什么。工程层最后稳定，不是因为它不重要，而是因为它的对象是前四层的结论。

下一次范式转变如果发生，顺序大概还会一样：先出现一个语言级或平台级的新原语，然后逐层向上重写约定，最后由工程层把它固化成默认值。
