---
title: "从传统到现代：Android 应用开发范式的演变"
slug: "from-traditional-to-modern-android"
date: 2026-10-17T10:00:00+08:00
tags:
  - "Android"
  - "Kotlin"
  - "Jetpack Compose"
  - "架构"
draft: false
description: "从协程到构建检查，这些变化看着各改各的，其实是同一件事：把「什么时候读、什么时候停、由谁保证」从调用方手里拿走。"
author: "Xi"
model: "DeepSeek 4.1 Flash"
tool: "DeepSeek Harness"
---

## 引子

从详情页返回列表，刚删掉的那条还在。下拉刷新一下，它没了；再进详情、再返回，它又可能回来。操作再快一点，删除和刷新几乎同时发出，谁先落地也不一定。

这类 bug 很难指到哪一行：数据库删成功了，列表页手里那份没变。同一份数据存在三个地方——列表页的字段、数据库、详情页回传的结果——谁最后写，界面就显示谁。这里说的「状态」指三样：界面要显示的值、正在发生的事、以及两者落定的先后。

这不是一次手误。旧写法里，状态本来就没有唯一的主人：界面一份、数据库一份、上一个页面回传一份，谁都能改，谁也不知道别人改了。要不出错，只能靠每一处都记得同步。

换库不是范式转变；把所有权换掉才是。Android 这些年的六层变化，就是在回应这件事——把「什么时候读、什么时候停、由谁保证」，从调用方手里一点点拿走。六层依次是：语言（协程与 Flow）、数据（读取变订阅）、UI（同步变重组）、导航（栈变状态）、架构（多容器变一个入口）、工程（约定变检查）。这个 bug 只是其中一种症状：状态没有唯一的主人，会有六种失控——任务没人负责停、值没人负责更新、界面没人负责同步、当前位置没人负责持有、写入没人负责收口、依赖没人负责检查。六层各管一种。

判断有没有真的转变，只看一条：原来必须靠人记住的东西，还剩多少。

## 一、语言：取消权从回调里被拿走

这一层排在前面，因为它给的是后面五层要用的语言设施：协程负责「什么时候停」，Flow 负责「值什么时候到」。它不解决状态存在哪，但没有它，后面几层都无从谈起。

### 1.1 回调里的取消，是一个布尔量

Java 时代的异步样板大致这样：`new Thread()` 里发请求，结果到了用 `handler.post { title.text = ... }` 回主线程。后来有了 `AsyncTask`，把 `doInBackground` 和 `onPostExecute` 分开，[API 30 起废弃](https://developer.android.google.cn/reference/android/os/AsyncTask)。

```java
new Thread(() -> {
    List<Song> songs = api.songs();
    handler.post(() -> adapter.submitList(songs));
}).start();
```

取消在这套写法里很难看。`AsyncTask.cancel(true)` 会置上取消标记，再尝试中断工作线程；任务已经结束的话，中断也不会发生。可 `doInBackground` 里的阻塞调用不一定响应中断——循环得自己每轮查一次标记。

更常见的是根本不取消。请求回来时 Activity 已经销毁，回调照跑，`title` 还指着那个已经 detach 的 View；`setText` 通常不崩，泄漏才是结果。

根子上是一个假设：一次请求占一个线程，取消等于杀掉这个线程。线程是操作系统的调度单位，每条都要预留一块栈空间，连接一多，切线程和占内存都成了负担。而一次请求的大部分时间在等，占着线程什么也不干。

### 1.2 协程是可挂起的计算，取消沿作用域向下传

协程是 Kotlin 语言层的可挂起计算：`suspend` 函数在挂起点把续体存下来，线程回去干别的，结果到了再接着跑。它换掉的是「任务必须占住一个线程」这条绑定。

**协程不绑定线程。** `Dispatchers.Main` 上的协程挂起时，主线程没有被阻塞，它只是去处理下一条消息了。

![阻塞的线程被整段时间占住，挂起的协程让出线程](/images/modern-android/04-coroutine-suspend.svg)

取消因此可以传播。`coroutineScope { }` 里的子协程和父协程构成层级。父取消，所有子取消；一个子抛异常，父取消其余子，再把异常抛出去。这叫结构化并发，一句话概括：作用域不结束，里面的协程不会漏掉。

```kotlin
viewModelScope.launch {
    val songs = repository.songs()   // 挂起时不占线程
    _state.value = Success(songs)    // ViewModel 清除时自动取消
}
```

绑定生命周期的是作用域。`viewModelScope` 在 `onCleared()` 时取消，`lifecycleScope` 在 `DESTROYED` 时取消。收集侧还有一层：`repeatOnLifecycle(STARTED)` 让收集随页面可见性起停。

lifecycle 2.4.0 起，`repeatOnLifecycle` 取代了 `launchWhenStarted`。后者只是把协程挂起，上游其实还在跑。

### 1.3 Flow 交出的是值什么时候到

Flow 是协程库里的数据流类型，用来表达「会来很多次的值」。它换掉的是那类回调接口：`OnSharedPreferenceChangeListener`、EventBus——它们只告诉你「变了」，不给你取消、背压和组合的手段。

Flow 默认是冷的。`flow { }` 里那段代码在订阅之前一行都不执行，两个订阅者就是两遍执行。冷是特性，也是数据层要付的账。

常用的两个热变体：StateFlow 永远有当前值，相同值不重复发射，`value` 可以同步读；SharedFlow 没有当前值，重放次数可配。前者换掉的是「观察者自己存最后一份值」的写法，后者换掉的是「一次性事件发两次」那类补丁。

![冷流每个订阅者各跑一遍上游，热流只跑一份并共享当前值](/images/modern-android/05-cold-hot-flow.svg)

取消是协作式的。`Thread.sleep`、阻塞 IO、`while (true)` 里的非挂起代码都不响应取消，得自己 `ensureActive()`。异常默认向上抛，`viewModelScope` 里没接住就是一次崩溃。`GlobalScope` 是逃生口，用了它，取消又回到手动时代。

这一层交出去的是「什么时候取消、值什么时候到」。没交的是：这些值从哪来、谁能改。

## 二、数据：谁负责再读一次

数据层紧接语言层，因为它最好验证：改完能不能编译、查询有没有重跑，当场就能看见。界面那边改错了，要等用户点出来。

### 2.1 一次查询的有效期，没有人定义

旧写法里三个数据源各有一套「读一次」的接口。`SharedPreferences.getAll()` 返回快照，想跟着变就注册监听器，还得记得注销。Room 的 DAO 写 `fun all(): List<Song>`，查完就结束；Retrofit 的 `Call<T>` 加 `enqueue`，回调里拿到一份响应。

三件套的默认接口都只给一次结果。监听器能补上「变了」的通知，但读值本身仍是一次快照。这默认了一个前提：读到的值在下次读之前有效。这个前提在单页面工具里成立，同一份数据一旦有第二个观察者就破了。

破的具体方式：详情页删了一首歌，列表页手里还是旧的列表；后台同步往库里写新行，界面不知道；设置页改了「仅 Wi-Fi 下载」，播放页的判断还是老值。每个页面各自决定何时重读，跨页面同步最后都落到 EventBus 和静态回调上。

### 2.2 Room 和 DataStore 把返回值换成了流

Room 换掉的是 `SQLiteOpenHelper` 加手写 `Cursor`，把 SQL 校验挪到编译期。[2.2 起](https://developer.android.google.cn/jetpack/androidx/releases/room) `@Query` 可以直接返回 `Flow<List<Song>>`；表被写时 `InvalidationTracker` 重跑查询，把新结果发下去。

[DataStore](https://developer.android.google.cn/jetpack/androidx/releases/datastore) 换掉的是 SharedPreferences 的同步读写和 `getAll()` 那种全量快照。它异步、事务性，偏好读出来是 `Flow<Preferences>`，写入是 `suspend edit { }`。

Retrofit 换掉的是 `HttpURLConnection` 加手写解析。它只走到 `suspend`：[2.6.0 起](https://github.com/square/retrofit/blob/8c2b181ee0127c5f0ee4c93f47e1185119311602/CHANGELOG.md) 方法能标 `suspend`，返回值仍是一次性的，要变成流得自己包一层。

**表 1**　三个数据源各自的「流」停在哪一层

| 载体 | 旧接口 | 现在 | 谁负责重发 |
| --- | --- | --- | --- |
| 偏好 | `SharedPreferences.getAll()` | `Flow<Preferences>` | DataStore |
| 数据库 | `fun all(): List<Song>` | `Flow<List<Song>>` | Room 的 `InvalidationTracker` |
| 网络 | `Call<T>.enqueue` | `suspend fun`，返回一次 | 没有人，得自己接 |

三件套转向流的速度不一样，原因在数据源。前两个在本机，谁改了它，库自己知道；网络没有这个能力，服务端不会通知你，流只能建在轮询或推送之上。

落到代码上，这一步小得不像迁移：

```kotlin
@Query("SELECT * FROM song ORDER BY title")
fun observeAll(): Flow<List<Song>>

class SongRepository(private val dao: SongDao) {
    fun songs(): Flow<List<Song>> = dao.observeAll()
}
```

### 2.3 Repository 是这一层的出口

Repository 是数据的出口：对上层只暴露两种形状，读返回流，写是 `suspend`。它把「数据从哪来」收进一个地方，换掉的是 Presenter 或 Activity 直接持有 `Dao` 和 `ApiService`、并自己决定先读缓存还是先发请求的写法。

它不是一个框架类型，是一个约定。编译器不知道你有没有绕过去，只有模块边界和 review 知道。这一点到工程层会再出现一次。

写用 `suspend`、读用 `Flow`，不是规律，是这个场景的选择：写要等一个结果，读要一直跟着变。想反过来也能做，只是多数页面不需要。这个选择决定了缓存、重试、刷新分别写在哪一边。

### 2.4 冷流意味着每次订阅都重跑

两个页面各 `collect` 一次，就是两次查询。共用结果得在有生命周期的作用域里 share，而 share 立刻带来新问题：什么时候开始、最后一个订阅者走了要不要停。这些没有默认答案，只有你写下的答案。

错误处理也换了位置。`try/catch` 包在 `collect` 外面能接住上游异常，代价是整条流就此结束；`catch` 操作符只作用于上游，可以在出错时换一个值继续发，`retryWhen` 管重试。异常也不会自动冒到 UI，得显式建模进结果类型。网络层的一次失败，在这里变成一次状态迁移。

## 三、UI：刷新从调用方挪到运行时

数据能持续推了，界面却还在手动拉。这一层要拿走的，是「谁来同步」这件事。

### 3.1 手动同步的成本在漏掉的那一处

View 体系是命令式。`findViewById` 拿到引用，`title.text` 赋一次值，`progress.visibility` 手动切 `VISIBLE` 和 `GONE`。数据变了，调用方负责把每一处对应关系改一遍。

这套写法假设：界面正确等于每一处修改都记得同步。成本不在写，在漏。一个页面五处要同步，漏一处，界面就停在旧值上，而且不报错。`notifyDataSetChanged()` 更省事：整表重绑，结果正确，但把「哪一行变了」这个信息扔了。

状态还藏在 View 的字段里。加载中靠进度条的可见性表示，错误靠一个 `TextView` 有没有文字表示。这些值没有单一来源，也就没法被断言。

### 3.2 组合函数把界面写成状态的函数

Compose 是 Jetpack 的声明式 UI 工具包。它用 `@Composable` 函数描述「给定这份状态，界面长什么样」，由运行时负责让界面跟上状态。它换掉的是「拿到 View 引用、改它的属性」这套命令式接口。

一个 `@Composable` 函数执行时读到的 `State<T>` 会被运行时记下来。写发生时，读过它的那部分函数被标脏，下一帧重跑，没读过的跳过。刷新不再由调用方触发，由读关系决定。

![自动重组的本质：连接关系由编译器推导，不由开发者注册](/images/modern-android/02-compose-dependency.svg)

```kotlin
@Composable
fun SongList(state: ListUiState) {
    when (state) {
        Loading -> CircularProgressIndicator()
        is Success -> LazyColumn { items(state.songs) { SongRow(it) } }
    }
}
```

`remember` 在重组之间保住一个值。转屏要靠 `rememberSaveable` 或 ViewModel，两者的分工留到架构层。

### 3.3 重组跳过不跳过，取决于稳定性

编译器推断的是类型的稳定性，不是参数的。`List<T>` 被判为不稳定，因为接口的实现可能是 `MutableList`：参数类型里带 `List<Song>`，编译器就不敢跳过这个函数。换成 `ImmutableList`，或者把这个类型标注成 `@Immutable`（注解加在类型上，不是加在参数上），它才敢跳。开了 [strong skipping](https://developer.android.google.cn/develop/ui/compose/performance/stability/strongskipping) 之后规则有例外，但集合仍然是最常见的坑。

把 `List` 换成 `ImmutableList` 常被当成性能技巧，它实际影响的是重组的判定条件。写 Compose 时遇到的「明明没变却重新跑」，先查这里。

### 3.4 排查路径换了

Compose 编译器插件进构建，编译时间变长。`@Composable` 只能被 `@Composable` 调用，回调要穿过 lambda，边界画错就来回改「状态提升」的位置。

排查也更绕。View 时代断点打进去，属性就在眼前；Compose 里要看 Layout Inspector 的重组计数，判断哪个写触发了哪次读。工具能用，直觉要重建。

我判断 Compose 的门槛在排查：出问题时能定位到哪一层，决定了你敢不敢拿它写复杂页面。

## 四、导航：返回栈从指令变成列表

界面刷新交给了运行时，可「当前在哪一屏」还留在 `FragmentManager` 的字段里。导航是 UI 这条线的延长：同样是状态，只是换成了栈。

### 4.1 事务是命令，返回栈是副作用

FragmentManager 的写法是一串事务调用：`beginTransaction()`、`replace()`、`commit()`。返回栈由 FragmentManager 内部维护：`getBackStackEntryAt()` 能逐项取，`addOnBackStackChangedListener()` 能监听变化，但取到的是只读的 `BackStackEntry`，监听器也只发通知；改还是得发事务。

这套模型的默认用法是：指令发出去就完了，栈由内部维护。`commit()` 是异步的，`commitNow()` 不能和 `addToBackStack` 随便混用。结果回传要 `setFragmentResultListener` 加 `Bundle`。这些都不是缺陷，是命令式事务接口的必然结果。

### 4.2 可读，但栈不在你手里

Navigation Compose 是 Navigation 组件在 Compose 里的版本，目的地写成 `composable("route")`，2.4.0 起可用。它换掉的是事务调用，栈的所有权没变，还在 `NavController` 里。

`NavController` 把栈投影成了可观察的值：`backStack` 是一条 `StateFlow`，`currentBackStackEntryAsState()` 给当前项。能读、能断言，但增删仍然要调 `navigate()` 和 `popBackStack()`。字符串路由还带来新的错误源：参数拼错、类型不对，都是运行时才发现。

Navigation 2.8 起可以用 `@Serializable` 的对象当 route，把这类错误挪回编译期。

### 4.3 Navigation 3 把栈交给调用方持有

Navigation 3 是 2025 年 11 月[发布稳定版](https://developer.android.google.cn/jetpack/androidx/releases/navigation3)的下一代导航库。它把返回栈变成一个由调用方持有的列表，`NavDisplay` 读这个列表渲染。换掉的是「栈的所有权在库内部」这件事。

栈变成 Compose 的可观察列表 `SnapshotStateList` 之后，能断言的东西多了：长度、当前 key 都是普通值。`rememberNavBackStack` 自带 saver，转屏和进程恢复都能把它存下来。它还能被两个 pane 同时读：列表 pane 读整条栈，详情 pane 读最后一项。

```kotlin
val backStack = rememberNavBackStack(Home)
backStack.add(Detail(42))      // 打开详情
backStack.removeLastOrNull()   // 返回
```

多栏布局在旧模型里要两套导航图来绕，这里只是两个读数。

![返回栈由框架内部维护时只能发事务，Navigation 3 把栈变成调用方持有的可观察列表](/images/modern-android/06-backstack.svg)

pop 也不再是内部动作：`NavDisplay` 默认会调 `onBack` 帮你 pop，但栈是你自己持有的列表，想怎么改由你写。把一个刚稳定不久的库放进主线是有风险的，我还是放了：栈从指令变状态这一步，只有它做完整了。

### 4.4 系统返回的语义要自己接

`NavDisplay` 默认接管返回手势和预测性返回的过渡，但 pop 之后旧目的地何时清理、何时保存状态，得自己定义。Fragment 时代那些隐式行为没有了，换来的是显式。

Navigation 3 的 API 面比 Navigation Compose 小，有些事要自己做。这一层的风险是选型：栈结构一旦定下来，再换库要动所有目的地。

栈有了唯一答案。可「当前在哪」只是状态的一种，页面自己的数据还散在别处。

## 五、架构：分散的状态收成一个入口

状态至少有四个住处：ViewModel、`remember`、返回栈、仓库缓存。四种生命周期，四个能改的地方——架构层要把它们收成一个入口。

### 5.1 ViewModel 解决的是转屏后数据重来

ViewModel 是跨配置变更存活的状态容器，解决转屏、分屏、字体缩放之后界面数据要重来一遍的问题。`ViewModelStore` 挂在 `ComponentActivity` 上，转屏时被留下来，真正销毁才走 `onCleared()`。

它换掉的是「转屏后重新请求」这件事。`onSaveInstanceState` 加 `Bundle` 还在——它负责进程死亡后的恢复，ViewModel 不跨进程，两者互补，不互相替代。Bundle 有 `TransactionTooLargeException` 的上限，只适合少量可序列化的值。

第二个收益是 `viewModelScope`，协程的取消点终于有了一个和界面生命周期对齐的位置。

### 5.2 LiveData 解决的是回调打到已经销毁的 View

LiveData 是生命周期感知的观察容器，解决回调打到已经销毁的 View 上的问题。`observe(owner)` 注册后，只在 owner 至少 `STARTED` 时投递，`DESTROYED` 时自动移除。它换掉的是手写 listener 加 `onDestroy` 里手动 `unregister` 的那套纪律。

它的边界在「生命周期感知」。LiveData 只有一个 `value`，没有「正在加载」和「加载失败」的位置。那两个状态得靠第二个 LiveData，或者一个 `sealed class` 塞进同一个 `value`。

### 5.3 MVC 到 UDF，换的都是状态放在哪

MVC 把找 View、绑数据、处理点击放进同一个 Activity。MVP 拆出 Presenter，测试能脱离界面，代价是接口随页面线性增长，`attach` / `detach` 漏一次就是一次泄漏。MVVM 省掉 View 接口，代价是状态和一次性事件混在一个口——导航、Toast 要靠 `SingleLiveEvent` 这类只投一次的包装打补丁。

UDF 不是第四代架构，是 MVVM 内部的一条数据流原则：一个不可变的 `UiState` 向下，事件向上，ViewModel 里把事件折成新状态。它换掉的是「多个可观察字段各自更新」这种写法。

**表 2**　状态放在哪：三种架构，和加了 UDF 的 MVVM

| 写法 | 状态放在哪 | UI 怎么拿到 | 主要代价 |
| --- | --- | --- | --- |
| MVC | Activity 的字段和 View 属性 | 直接改 View | 三件事挤在一个生命周期 |
| MVP | Presenter | View 接口回调 | 接口随页面增长，`attach` / `detach` 手工配对 |
| MVVM | ViewModel 里的多个 LiveData | `observe` | 状态和一次性事件混在一个口 |
| MVVM + UDF | 一个不可变 `UiState` | `collect` 一个 StateFlow | 所有变化都要建模，事件要另找位置 |

### 5.4 单一状态把一致性交给一个不可变对象

MVVM 这一套暗含一个假设：状态可以分散在几个可观察容器里，只要每个都能观察就行。这个假设在两个容器同时更新时失效。

两个 LiveData 分别更新，观察者收到两次投递；如果两次落在不同的帧，中间那一帧就是「列表到了、加载还没关」，界面闪一下。`MediatorLiveData` 或 `combine` 只是把合并挪了个位置，投递顺序仍然不保证。

单一 `UiState` 让「一次渲染对应一个对象」成立。渲染函数拿到的是完整快照，不用判断字段之间是否自洽。

界面不再能从四个地方改，只能从事件进、从状态出。

```kotlin
data class HomeUiState(
    val items: List<Item> = emptyList(),
    val loading: Boolean = true,
    val error: String? = null,
)

fun onAction(action: HomeAction) {
    _state.update { reduce(it, action) }
}
```

![单向数据流：事件向上，状态向下](/images/modern-android/03-udf-flow.svg)

### 5.5 一次性事件没有天然位置

导航、Snackbar、Toast 只该发生一次，可它们也是「正在发生的事」。塞进 state 要带 id 去重，否则重组一次弹一次；走 `Channel` 或 `SharedFlow` 要写清重放和消费语义，否则转屏丢一次或者重放一次。

`data class` 的 `copy()` 样板随字段增长，大 state 每次更新都复制一遍，字段多了要拆成子 state 再 `combine`。ViewModel 不该持有 Activity 和 View；需要字符串资源时，用 `Application` 或者把文案提到 UI 层。

规矩定完了，靠什么保证？人，还是编译器。

## 六、工程：把约定变成检查

前五层改的都是运行时行为：谁取消、谁刷新、谁持有。工程层改的是另一件事——把前面那些约定，变成构建期能检查的规则。

### 6.1 单模块里，分层只是一组包名

单模块工程的典型结构是 `ui/`、`data/`、`domain/`、`util/`。依赖方向靠 code review 和口头约定，`util` 包慢慢变成什么都往里塞的地方。

这套结构假设分层可以靠自觉维持。约定失效的方式很安静：`data` 里的类 import 了 `ui` 的 Adapter，编译通过；新人复制一个文件、改个包名，依赖就反了，编译器不说话。

### 6.2 多模块把依赖变成构建图上的边

多模块工程把代码切成 `:feature:player`、`:core:data`、`:core:model`，模块之间的依赖写在 Gradle 里。[`implementation` 的依赖不传递给下游](https://docs.gradle.org/current/userguide/java_library_plugin.html)，`api` 会——上游用 `api` 暴露的类型，下游不声明也能看见。`internal` 把可见性收到模块内，跨模块引用直接编译不过。

要注意它管到哪：Gradle 检查的是「声明没声明」和「成不成环」，不检查方向合不合你的分层。`:core:data` 依赖 `:feature:player`，只要写了就能编过。方向是设计出来的，Gradle 只保证它一旦写下来，就不能被偷偷绕过去。

```kotlin
// :feature:player/build.gradle.kts
dependencies {
    implementation(project(":core:model"))
    // 不写 :core:data，就看不见数据层
}
```

### 6.3 Hilt 把依赖图挪到编译期

[Hilt](https://developer.android.google.cn/training/dependency-injection/hilt-android) 是基于 Dagger 的依赖注入框架，在编译期生成依赖图，用注解声明谁提供、谁需要。它换掉的是手写单例、`object` 工具类和 ServiceLocator。后者的 `get()` 在测试里要手动替换，Hilt 换一个 binding 就行。

`@HiltAndroidApp` 生成应用级组件，`@Inject constructor` 标出提供方。ViewModel 那边加 `@HiltViewModel` 和 `hiltViewModel()`，不用再写 Factory。

代价都落在构建配置上。每个模块一份 `build.gradle.kts`，重复的部分要靠 `build-logic` 里的 convention plugin 收口；Hilt 的报错出在生成的 `Hilt_*.java` 里，第一次读像天书；编译期会变长，kapt 换 KSP 有改善，但没有消失。模块边界画错的代价比包名画错大得多，改一次要动整张 Gradle 图。

依赖方向能查了。状态本身怎么切，还是人的事。

## 结语

六层交出去的是同一件事：什么时候读、什么时候停、什么时候刷新、由谁保证。交完之后，这些时刻由运行时和编译器安排，人只剩一个决定——状态长什么样。

代价是失败的位置变了。以前是某一行忘了同步，翻代码能找到；现在是一段状态没有被结构接住，得先想清楚它归谁，才知道去哪儿修。

这套移交有前提：框架要覆盖住每一条退出路径。覆盖不到的地方，交出去只是换个地方漏——播放进度、音频焦点、前台服务，结束条件来自系统回调和用户操作，不在任何一层的管辖里。

所以它不是可以整体采纳的套餐，而是一串独立的决定。一个人维护、三个月的项目，模块化和 Hilt 换不回学习成本；多人并行、边界开始被踩、构建时间成为日常阻塞，机制才开始值钱。

控制权交出去之后，人剩下的工作在最上游：把状态切成什么样。切错了，后面几层只是把错误传播得更整齐。

## 参考

文中涉及的版本与 API 行为，以下列官方文档为准（访问日期均为 2026-10-17）：

1. [AsyncTask](https://developer.android.google.cn/reference/android/os/AsyncTask) — Android Developers（API 30 起废弃）
2. [Lifecycle release notes](https://developer.android.google.cn/jetpack/androidx/releases/lifecycle) — Android Developers（2.4.0 起提供 `repeatOnLifecycle`）
3. [DataStore release notes](https://developer.android.google.cn/jetpack/androidx/releases/datastore) — Android Developers（1.0.0，2021-08）
4. [Room release notes](https://developer.android.google.cn/jetpack/androidx/releases/room) — Android Developers（2.2 起支持 `Flow` 返回类型）
5. [Retrofit CHANGELOG](https://github.com/square/retrofit/blob/8c2b181ee0127c5f0ee4c93f47e1185119311602/CHANGELOG.md) — square/retrofit（2.6.0 起支持 `suspend`）
6. [Stability in Compose](https://developer.android.google.cn/develop/ui/compose/performance/stability) — Android Developers
7. [Strong skipping mode](https://developer.android.google.cn/develop/ui/compose/performance/stability/strongskipping) — Android Developers
8. [Navigation 3 release notes](https://developer.android.google.cn/jetpack/androidx/releases/navigation3) — Android Developers（1.0.0，2025-11）
9. [Save UI states](https://developer.android.google.cn/topic/libraries/architecture/saving-states) — Android Developers
10. [Hilt](https://developer.android.google.cn/training/dependency-injection/hilt-android) — Android Developers
11. [Java Library plugin](https://docs.gradle.org/current/userguide/java_library_plugin.html) — Gradle（`api` 与 `implementation` 的可见性差别）
