---
title: "从页面到数据流：Android 应用开发范式的演变"
slug: "from-traditional-to-modern-android"
date: 2026-10-17T10:00:00+08:00
tags:
  - "Android"
  - "Kotlin"
  - "Jetpack Compose"
  - "架构"
  - "数据流"
draft: false
description: "一次删除之后，列表怎样知道数据变了？数据流的价值，在于把读取、状态、渲染与写回的同步责任放到了可观察、可约束的位置。"
author: "Xi"
model: "DeepSeek 4.1 Flash"
tool: "WorkBuddy"
---

## 引子：一次删除之后

在详情页删掉一首歌，返回列表，界面接下来怎样更新？数据库已经变了，列表要怎样知道？这个再普通不过的动作，藏着应用最基本的一组关系：数据在哪里，谁在使用它，变化怎样到达界面。

一种做法由页面推进：详情页回传删除结果，列表收到后重查；或者列表每次恢复可见时，都重新查询。另一种做法是让列表持续观察数据，详情页只负责删除，新结果沿观察关系到达界面。两种做法都能完成更新，差别在于同步由页面推动，还是由数据流完成。

更值得看的是同步责任最后落在谁手里。语言和 UI 工具包的替换只是表层，变化发生在应用的组织中心。要看清这种移动，先得看看：应用以页面为中心，还是以数据流为中心？

## 一、应用的中心，是页面还是数据流

页面当然是应用的组成部分。用户看到的是列表页和详情页，系统把生命周期交给的，也是 Activity 和 Fragment。

以页面为中心组织代码，因此是一种很自然的选择：列表页查询歌曲、保存结果、显示列表，详情页接收点击、执行删除，再把结果带回来。页面既是用户操作的入口，也是各项工作的协调者。

MVP 和 MVVM 把其中一些职责分了出去。Presenter 可以处理业务逻辑，ViewModel 则是配置变更之间持续存活的状态持有者。但如果何时重读、怎样刷新、如何通知另一个页面仍由界面层逐项安排，应用的组织中心就没有根本移动。架构名称变了，页面之间的调用关系还可以保持原样。

从数据流看，同一个应用会呈现出另一幅结构。数据库是歌曲数据的来源，Repository 规定读取和写入的入口，ViewModel 把数据转换成界面状态，UI 显示状态并上抛事件。删除不再主要是“详情页通知列表页”的一次页面协作，而是沿既有路径完成的一次往返：

![页面中心由调用串联数据与界面，数据流中心让数据沿固定关系到达界面，事件再返回数据层](/images/modern-android/page-vs-dataflow.svg?w=760)

这张图没有让页面消失，也没有让 Activity、Fragment 失去作用。页面仍然承载生命周期、导航和平台交互，只是不再天然拥有所有数据与同步工作。列表为什么更新，答案不再藏在某次回传里，而可以从数据的来源和流向上读出来。

这里说的旧范式与新范式，不是两个泾渭分明的年代，更不是合格与不合格的分界。它们描述的是两种组织重心：一种从页面出发，用调用把数据接起来；一种从数据出发，让页面成为流经的环节。接下来的几章，就沿删除流程把后一种结构逐段搭起来，同时看哪些工作仍要由页面和平台机制承担。

## 二、数据变化以后，谁负责再读一次

先看删除之后，列表怎样拿到新结果。一次查询可以这样写：

```kotlin
@Query("SELECT * FROM song ORDER BY title")
suspend fun songs(): List<Song>
```

它返回一份完整结果，然后结束。列表页可以在每次恢复可见时调用它，也可以在收到删除通知后调用它；两种做法都直接有效。只是查询发生以后，数据库与这份结果之间没有保留下来的关系。下一次何时查询，要由调用方决定。

把返回类型换成 `Flow`，关系就不一样了。`Flow` 是 Kotlin 协程中的数据流；Room 返回的查询流属于冷流，只有被收集时才执行：

```kotlin
@Query("SELECT * FROM song ORDER BY title")
fun observeSongs(): Flow<List<Song>>
```

![一次查询返回快照后关系结束，持续订阅让数据变化沿 Flow 不断到达界面](/images/modern-android/snapshot-vs-stream.svg?w=680)

Room 是 Android 的 SQLite 持久化库；它的[可观察查询](https://developer.android.google.cn/training/data-storage/room/async-queries)会在相关表发生变化时重新执行查询，并向下游发出新结果。它并没有让原来的列表对象自动改变，也没有只推送被删除的那一行；发生变化的是读取方式。调用方订阅的不是一次结果，而是一条会持续产生结果的查询。

于是，详情页删除歌曲时，不必知道列表页是否存在。它写入数据库，列表页如果仍在收集，就会收到重新查询得到的列表。返回时重查和删除后通知仍有各自的位置，但已不是数据库变化到达界面的唯一通路。

Repository 可以把这条关系收进一个明确的数据出口：

```kotlin
class SongRepository(private val dao: SongDao) {
    val songs: Flow<List<Song>> = dao.observeSongs()

    suspend fun delete(id: Long) {
        dao.delete(id)
    }
}
```

读取返回 `Flow`，写入使用 `suspend`。这并非通用定律，只是这个场景对读写差别的选择：读取要跟随来源变化，写入要完成一个动作。

上层不必关心列表来自 Room 还是别的本地实现，也不必在删除时另找一条页面通知链。至于缓存、刷新和重试，并不会因为接口换了形状就自动消失，它们仍要由 Repository 明确安排。

[DataStore](https://developer.android.google.cn/topic/libraries/architecture/datastore) 与 Room 类似，可以把偏好值作为流提供。网络则不同。[Retrofit](https://github.com/square/retrofit/blob/8c2b181ee0127c5f0ee4c93f47e1185119311602/CHANGELOG.md) 的 `suspend` 请求仍然只得到一次响应；服务端不会因为它变成挂起函数，就开始向客户端推送变化。三种来源可以使用相似的流式接口，触发新结果的机制却不一样。

**表 1**　三种来源的“流”分别停在哪一层

| 来源 | 返回形状 | 谁负责产生下一次结果 |
| --- | --- | --- |
| Room | `Flow<List<Song>>` | `InvalidationTracker` 在相关表变化后重跑查询 |
| DataStore | `Flow<Preferences>` | 每次写入提交后，由 DataStore 发出新值 |
| Retrofit | `suspend fun`，单次响应 | 没有内置重发，需要轮询、推送或缓存策略 |

冷流有一个直接后果：两个收集者可能各自触发一次查询。需要共享结果时，还要决定在哪里共享、何时开始和停止。

`shareIn` 可以在指定作用域内复用上游，[`stateIn`](https://developer.android.google.cn/kotlin/flow/stateflow-and-sharedflow) 会进一步暴露一个带初始值的 `StateFlow`，新订阅者立即拿到当前状态。选择哪一种，不只是操作符差别，也决定了第一次订阅之前、最后一个订阅者离开之后，上游分别处于什么状态。

数据层因此只回答了一半问题：新结果能够持续发出了，但谁来接收，接收多久，仍然悬而未决。

即使结果顺利到达，它也只是一份歌曲列表。界面还要处理加载、错误和空内容，这些值不应该继续散落在各个 View 的属性里。下一步，是把数据来源转换成界面真正需要的状态。

## 三、界面需要的，不只是数据

歌曲列表到达界面层以后，还不能回答几个问题：第一次进入时显示什么，读取失败时显示什么，没有歌曲时是显示空列表，还是一句提示？数据库只提供 `List<Song>`，界面却同时需要数据、进度和结果。

这些值如果分别藏在进度条的可见性、错误文本和 Adapter 的内容里，界面状态就要靠检查一组 View 才能还原。

这正是 ViewModel 要接手的地方：列表仍然来自 Repository，但它还要负责列表、进度和错误之间的组合关系。先把这份组合写成一个状态：

```kotlin
data class SongListUiState(
    val songs: List<Song> = emptyList(),
    val loading: Boolean = true,
    val error: String? = null,
)
```

接下来，ViewModel 从 Repository 的流生成这个状态，并暴露为 `StateFlow`。这是一种始终持有当前值的热流，新的收集者会立即拿到最新状态：

```kotlin
class SongListViewModel(
    private val repository: SongRepository,
) : ViewModel() {
    val state: StateFlow<SongListUiState> = repository.songs
        .map { songs -> SongListUiState(songs = songs, loading = false) }
        .catch { emit(SongListUiState(loading = false, error = it.message)) }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5_000),
            initialValue = SongListUiState(),
        )
}
```

`map` 把数据库结果折进界面状态，`catch` 只接住上游异常并转成新状态，`stateIn` 则把冷流变成可共享的当前值。`WhileSubscribed(5_000)` 允许最后一个收集者离开后，上游再保留五秒；旋转屏幕时，新界面通常能在这段窗口内重新订阅，而不必立刻重跑查询。这个时长是策略，不是固定答案。

`catch` 在发出错误状态后会结束当前上游；如果希望数据库在异常后继续送来变化，还需要重试或重建这条流。示例中的 `it.message` 也只是占位，真正显示给用户的错误仍需要映射。

列表变化时，UI 读到的是一份新的界面状态，而不必分别询问“列表更新了吗”“加载结束了吗”“刚才报错了吗”。需要一起使用的值，由此有了共同的落点。

这也是 ViewModel 比“又一个存放数据的类”更有意义的地方。它跨越旋转等配置变更存在，界面重建后不必把读取和转换从头再做一遍；真正销毁时，`onCleared()` 被调用，`viewModelScope` 中的任务随之取消。

它不提供进程死亡后的自动恢复，需要在进程重建后恢复的小量状态，仍应交给 `SavedStateHandle` 或界面状态保存机制。[保存界面状态](https://developer.android.google.cn/topic/libraries/architecture/saving-states)因此是另一项安排，不是 ViewModel 的附属特性。

LiveData 也曾把一部分同步责任从调用方手里拿出来：观察者只在合适的生命周期状态接收值，销毁后自动移除。StateFlow 则把当前值、协程组合与数据流放在同一套模型里，但收集侧仍需自己遵循界面生命周期。两者都能承载 `SongListUiState`；把多个 LiveData 简单替换成多个 StateFlow，并不会自动完成这里的状态建模。

状态并非越集中越好。上面的 `data class` 仍允许 `loading = true` 与 `error != null` 同时出现。如果这些条件在业务上互斥，就应该进一步用密封类型限制它。把字段装进一个对象，只明确了组合的位置，不能保证组合本身合理。相反，彼此无关的小状态，也没有必要为了形式统一而塞进整个页面的状态里。

单向数据流到这里完成了前半程：Repository 提供来源，ViewModel 产生界面状态，事件则留待 UI 向上传回。它不是 MVC、MVP、MVVM 之后又一代必须套用的架构名称，而是一种更具体的约束——状态怎样下来，操作怎样回去。接下来只差把这两端接到界面上。

## 四、从状态到界面，再从事件写回数据

有了 `SongListUiState`，View 体系可以把更新集中到一个渲染函数里。函数根据 `loading` 切换进度条，根据 `error` 设置错误文案，再把 `songs` 交给 Adapter。相比分散在各个回调里的属性修改，这已经是数据流组织方式的一部分。

声明式 UI 并不是单向数据流的前提。Compose 是 Android 的声明式 UI 工具包：界面由 `@Composable` 函数描述，状态改变后由运行时触发重组，不需要调用方逐项修改 View。它改变的是状态与界面之间如何衔接。

在 Compose 侧，`StateFlow` 需要先转成组合可以读取的 `State`。[`collectAsStateWithLifecycle()`](https://developer.android.google.cn/topic/libraries/architecture/coroutines) 来自 `lifecycle-runtime-compose`。它会在界面至少进入 `STARTED` 时收集，在 `STOPPED` 时停止，避免不可见的页面继续接收更新：

```kotlin
@Composable
fun SongListRoute(viewModel: SongListViewModel) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    SongListScreen(state = state, onDelete = viewModel::onDelete)
}
```

界面本身按状态分支渲染：

```kotlin
@Composable
fun SongListScreen(state: SongListUiState, onDelete: (Long) -> Unit) {
    when {
        state.loading -> CircularProgressIndicator()
        state.error != null -> Text(state.error.orEmpty())
        else -> LazyColumn {
            items(state.songs, key = { it.id }) { song ->
                SongRow(song) { onDelete(song.id) }
            }
        }
    }
}
```

调用方不再逐项发出“隐藏进度条、替换列表、清空错误”的命令。新的状态到来时，Compose 重新执行相关的组合函数，界面根据这份状态得到更新。

重组也不是把整页推倒重画。组合期间读取过的状态会与当前作用域建立关系；值变化后，运行时使读过它的作用域失效，未读取该状态的部分可以跳过。界面不需要显式“订阅”某个字段，但状态放在哪个函数里、由谁读取，仍会影响重组的范围。运行时接管的是同步过程，不是状态设计。

渲染只完成了数据向下的一半。用户点击删除，事件还要沿相反方向返回：

```kotlin
fun onDelete(id: Long) {
    viewModelScope.launch {
        repository.delete(id)
    }
}
```

UI 不直接操作数据库，也不需要找到列表页通知刷新。ViewModel 接收操作，Repository 完成写入，剩下的路已经在前两章铺好：

![一次删除从 UI 事件写入数据库，再由会重新执行的查询生成新的 UiState 并驱动界面](/images/modern-android/delete-dataflow-loop.svg?w=720)

删除与刷新由此成为同一条数据流上的输入和输出。详情页与列表页仍然可以同时存在，但详情页不必知道谁在观察歌曲，列表页也不必解释删除发生在哪个页面。新增一个显示歌曲数量的组件时，只要观察同一来源，就不必在删除流程里再增加一条专门通知。

异步任务也在这条链上找到了位置。过去常见的做法，是由页面保存请求或监听器的引用，再在销毁时取消、注销。

现在，`viewModelScope` 让任务的终点与 ViewModel 的清除对齐。UI 收集则可以用 [`repeatOnLifecycle(STARTED)`](https://developer.android.google.cn/topic/libraries/architecture/coroutines) 随界面状态启动和停止。收集停止以后，上游是否也停止，还取决于 `stateIn` 等共享策略，不能一概交给生命周期推断。

协程并没有取消所有手动责任。取消是协作式的，阻塞调用和非挂起循环需要额外处理；删除失败也不会因为使用了 `Flow` 就自动变成合适的提示，写入结果仍要显式进入状态或事件。框架提供的是任务与数据关系的骨架，业务结果仍要由应用补全。

回看开头那次删除，两种做法在这里已经可以分清楚。页面推进时，删除完成以后，由调用方决定下一步通知谁、何时重查；数据流推进时，观察关系先于删除建立，写入完成后，新结果沿它返回。两者都需要设计，也都能写对，但后者把“为什么界面会更新”变成了一条可以直接阅读的路径。

## 五、数据流不是万物的容器

一条清晰的数据流，很容易让人想把所有东西都装进去。但把所有东西都装进去，反而会模糊它的边界。第一个反例是返回栈：它看起来也是一种状态，真正决定行为的却是栈的所有权。

### 5.1 导航也是状态，但不只是状态

FragmentManager 和 NavController 也提供返回栈信息。不过栈主要保存在控制器内部，前进和返回仍通过事务或 `navigate()`、`popBackStack()` 等命令完成。能读到当前项，不等于调用方拥有整个栈。

[Navigation 3](https://developer.android.google.cn/jetpack/androidx/releases/navigation3) 是 Navigation 组件的下一代实现。它进一步把返回栈交给调用方持有，`NavDisplay` 读取这个列表并显示内容。

```kotlin
val backStack = rememberNavBackStack(Home)
backStack.add(Detail(42))
backStack.removeLastOrNull()
```

**表 2**　返回栈归谁

| | FragmentManager / NavController | Navigation 3 |
| --- | --- | --- |
| 返回栈 | 控制器内部 | 调用方 |
| 可读范围 | 当前项或只读信息 | 整个列表 |
| 修改方式 | 事务、`navigate()` | 列表增删 |
| 仍需处理 | 事务与生命周期 | 恢复与序列化 |

打开详情和返回，在这里表现为列表的增删。栈的长度、当前项和组合方式因此更容易直接表达。可是系统返回、目的地状态保存、进程恢复并不会因为栈变成列表就失去自己的规则；例如用于恢复的 `NavKey` 仍有序列化要求。状态化改变了导航的表达方式，没有取消导航语义。

### 5.2 一次性事件没有统一答案

删除成功后显示一条 Snackbar，看起来也能写成 `showMessage = true`。但提示消失以后谁来把它改回去，界面重建后是否还要显示，都需要额外约定。换成 `Channel` 或 `SharedFlow`，问题也不会自动消失。前者更接近队列，后者是可配置重放次数的热流；重放多少、何时收集、配置变更期间是否保留，仍决定提示是丢失还是再次出现。

因此，不能把 SharedFlow 说成“恰好一次”的保证。它只是提供了发射、订阅和重放的机制，一次性语义仍要由使用场景定义。有些提示适合作为可持久状态的一部分，有些适合作为事件，还有些需要带标识并显式确认消费。

数据流的价值不是给所有问题一个相同容器，而是让值从哪里来、由谁持有、怎样被消费变得可见。承认这些差异，也把前面的主线说得更清楚：它组织的是会持续变化并需要观察的数据，不是所有运行时行为。

## 六、流向写清楚以后，靠什么维持

Repository 统一数据出口，ViewModel 负责界面状态，UI 上抛事件——这些关系画在图上很直观，写在代码里却仍可能被绕过。包名约束不了它，文档也约束不了它；能长期维持方向的，是构建边界。

单模块工程里的 `ui/`、`data/`、`domain/` 就是例子。它们首先只是包名。数据层某天引用一个 UI 类型，编译器不会因为分层图上的箭头而拒绝它：

```kotlin
// core/data 中的一个文件
import com.example.feature.player.PlayerAdapter
```

多模块把其中一部分约定变成构建图中的依赖。一个模块没有声明依赖，就不能直接引用另一个模块的公开类型。[`implementation`](https://docs.gradle.org/current/userguide/java_library_plugin.html) 不把依赖暴露给下游的编译类路径，`api` 会；Kotlin 的 `internal` 则把声明限制在编译模块内。过去靠 review 发现的越界，现在有机会在编译时暴露。

```kotlin
// :feature:player/build.gradle.kts
dependencies {
    implementation(project(":core:model"))
    // 在这个依赖声明下，播放模块看不见数据层
}
```

但 Gradle 检查的是依赖有没有声明，不是方向是否符合架构。`:core:data` 如果声明依赖 `:feature:player`，上面的反向引用照样可能通过。模块边界只能固定已经作出的设计，不能替设计者决定哪一层应该指向哪一层。

方向是设计出来的，Gradle 只保证写下的方向不容易被偷偷绕过。模块拆得越多，边界划错的调整成本也越高。

![feature 依赖 data、data 依赖 model 的声明可以编译；data 反向依赖 feature 也仍然可以编译，Gradle 不会判断架构方向](/images/modern-android/gradle-boundary.svg?w=600)

[Hilt](https://developer.android.google.cn/training/dependency-injection/hilt-android) 是基于 Dagger 的依赖注入框架。它处理的是另一项工作：谁提供 Repository，谁需要它，这些装配关系通过注解进入编译期生成的依赖图。它减少了手写单例、ServiceLocator 和 ViewModel Factory，也让依赖关系更容易集中检查。不过，注入一个 Repository 不等于数据就会沿正确方向流动，生成一张依赖图也不等于拥有一张合理的数据流图。

这些工程机制更适合被看作主线的护栏，而不是额外一层。页面少、数据入口少、维护者只有一个人时，包结构和简单注入可能已经够用；当多人开始并行修改、越界依赖反复出现时，把约定交给构建工具才更有收益。是否采用它们，仍取决于需要保护的结构有多大。

## 结语：从哪来，到哪去

回到那次删除。页面没有消失，变化的是它为何更新：不再由调用方逐项命令，而由一套可观察的状态生成。它的来路和去向，都不在界面本身。这套组合并非 Android 首创，它的成熟模板来自 Web 前端。[React](https://react.dev/learn/thinking-in-react) 把单向数据流写进组件，[Redux](https://redux.js.org/tutorials/fundamentals/part-2-concepts-data-flow) 把它收紧为 action → reducer → store → view。更早的 [Elm Architecture](https://guide.elm-lang.org/architecture/) 用 Model、View、Update 描述同一件事。Compose、`UiState` 和 `StateFlow` 让 Android 有了几乎相同的表达方式，但 Android 并没有简单照搬。

Android 面对的运行环境更苛刻：进程可能被回收，配置变更会重建界面，返回栈、系统 Intent、前台服务和音频焦点各有生命周期。Web 的单向数据流回答“状态如何驱动界面”，Android 还要回答“界面消失以后，状态是否还活着”。

来路并不等于终点。Web 解释了它在工程史上的出处，却不足以解释它为什么自然。真正的原因在更长的交互史：人只能通过有限的感官和动作使用机器，界面在不断试错中被筛选，能匹配这套输入的留下，不匹配的被淘汰。从命令行到图形界面，从网页到触屏，交互形式一直在变；输入、状态、表达、反馈这条回路却反复出现。它看起来像生命体的表达机制，但那是长期磨合的结果，不是从生物学推导出的原因。

人不会逐块控制面部肌肉来生成表情；表情是内部状态在外表上的结果。旧写法逐项修改 View，相当于绕过内部状态直接操纵表情；新范式先维持状态，再让表达从状态里产生。对碳基用户，这种筛选让这条回路接近完整：视觉、触控、语音、即时反馈与异步等待，都能在结构里找到位置。以屏幕为主要界面时，它很难再被整体替换。

但这份完整有一个前提：读者必须拥有人的感官。长期筛选出这套界面的，是碳基用户。若读者不再只有人，这把尺子就会失效。今天的 LLM 还谈不上硅基生命，但它已经提出一个新问题：当机器也参与读取和行动，界面是否仍然只能是给人看的像素？

所以，这套范式可能是碳基界面的成熟形态，却未必是界面演化的终点。下一次会变成什么样，现在没有答案。能判断的是，数据流不会消失；它必须在另一种读者面前，找到新的出口。

界面是应用的表情。下一个读懂它的，不一定还是人。

## 参考

文中涉及的 API 与版本行为，以下列官方文档为准。访问日期：2026-10-29。

1. [Room：异步查询](https://developer.android.google.cn/training/data-storage/room/async-queries) — Android Developers（可观察查询与 `Flow`）
2. [DataStore](https://developer.android.google.cn/topic/libraries/architecture/datastore) — Android Developers（异步、流式读取偏好数据）
3. [Retrofit CHANGELOG](https://github.com/square/retrofit/blob/8c2b181ee0127c5f0ee4c93f47e1185119311602/CHANGELOG.md) — GitHub（`suspend` 支持）
4. [StateFlow and SharedFlow](https://developer.android.google.cn/kotlin/flow/stateflow-and-sharedflow) — Android Developers（当前值、共享与重放语义）
5. [Save UI states](https://developer.android.google.cn/topic/libraries/architecture/saving-states) — Android Developers（ViewModel、SavedStateHandle 与状态恢复）
6. [Lifecycle-aware coroutine collection](https://developer.android.google.cn/topic/libraries/architecture/coroutines) — Android Developers（`collectAsStateWithLifecycle` 与 `repeatOnLifecycle`）
7. [State and Jetpack Compose](https://developer.android.google.cn/develop/ui/compose/state) — Android Developers（Compose 中的状态）
8. [Navigation 3 release notes](https://developer.android.google.cn/jetpack/androidx/releases/navigation3) — Android Developers（`NavDisplay` 与调用方持有的返回栈）
9. [Java Library plugin](https://docs.gradle.org/current/userguide/java_library_plugin.html) — Gradle（`api` 与 `implementation`）
10. [Hilt](https://developer.android.google.cn/training/dependency-injection/hilt-android) — Android Developers（编译期依赖图）
11. [Cancellation and timeouts](https://kotlinlang.org/docs/cancellation-and-timeouts.html) — Kotlin Docs（协程的协作式取消）
12. [Thinking in React](https://react.dev/learn/thinking-in-react) — React Docs（单向数据流与状态驱动渲染）
13. [Redux Fundamentals, Part 2: Concepts and Data Flow](https://redux.js.org/tutorials/fundamentals/part-2-concepts-data-flow) — Redux Docs（action、reducer、store 与 view 的单向链路）
14. [The Elm Architecture](https://guide.elm-lang.org/architecture/) — Elm Guide（Model、View、Update）
