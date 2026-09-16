# 行为系统与人物模块审查 R11

2026-09-11。本轮根据当前源码审查并修改 Human-Workbench。先查阅官方资料，再修改代码；仅检查文件，没有启动页面、执行人物动作、运行生成器或操作鼠标。下面的“修复”指代码路径已调整，不代表运行结果已验收。

## 与常见角色系统的区别

这里以 Unreal 的 Behavior Tree / StateTree、动画状态机，以及 Unity 的动画层为参照，并不假定所有角色系统都有相同架构。

| 方面 | 常见实现的职责 | 本项目当前实现与判断 |
| --- | --- | --- |
| 行为决策 | 条件、任务、共享状态与中断规则；行为层决定做什么 | 有语义计划、条件分支、追加/替换、整串预检；NPC 根据需求、疲劳、冷却选择固定配方。适合单人物长任务，但没有通用行为树编辑器、感知黑板或并行行为树 |
| 动画组织 | 动画状态机负责状态过渡；动画层可按身体部位组合动作 | Motion-Lab 负责步行/转向/收脚，BasicController 负责坐卧/手势，任务执行器负责搬运/推动。当前仍按全身动作顺序执行；没有上半身挥手与下半身行走的独立混合层 |
| 运动与姿态 | 行为意图、移动执行、最终姿态各有明确入口 | 已有单一 MotionLabPose 提交入口、固定身体时钟、脚部锚点和完整骨架校验；应保留。原先忙闲判断散落在多个模块，会将“任务已清空、脚仍未收好”误判为空闲 |
| 人物数据 | 可复用的角色定义与每个实例的临时状态分开 | CharacterPreset、力量参数和生理状态已有区分，形体为固定 R2 来源。页面和桥接仍围绕一个 HumanLab 实例；多个 NPC 身份不是同时运行的多人物场景 |
| 视觉资源 | 生成/加载、渲染、释放有清楚的所有者 | 曲面由函数参数重建，使用同源骨架与 8 权重 DQS；这有利于保留来源，但不能替代低成本游戏模型、动作层、碰撞体或实测软组织模型 |
| 验证与证据 | 区分编辑器/静态检查、运行检查和视觉验收 | 本项目保留来源锁、任务结果及候选校验；这一点应保留。文件检查无法证明真实动作自然、长时间运行稳定或性能达标 |

对照来源：[Epic Behavior Tree 概览](https://dev.epicgames.com/documentation/en-us/unreal-engine/behavior-tree-in-unreal-engine---overview)、[Epic StateTree 概览](https://dev.epicgames.com/documentation/en-us/unreal-engine/overview-of-state-tree-in-unreal-engine)、[Epic 动画状态机](https://dev.epicgames.com/documentation/en-us/unreal-engine/state-machines-in-unreal-engine)、[Unity 6 动画层](https://docs.unity3d.com/6000.0/Documentation/Manual/AnimationLayers.html)。表中对本项目的评价来自本地源码审查。

## 本轮针对性调整

### 1. 共用活动状态，明确任务结束与收脚结束

新增 `control/CharacterActivity.js`，从现有执行器读取任务、坐卧转换、手势、脚步、抓握、错误和暂停状态，不另建一套需要同步的状态机。

- `physicalBusy` 包含尚未收脚及仍在持物。
- `readyForTask` 还要求没有身体错误；暂停另有 `paused` 字段，队列启动会同时检查。
- `phase` 区分 `settling`、`transitioning`、`gesturing`、`manipulating`、`failed` 等状态；坐卧保持可以空闲接收任务，后续动作仍通过原有起身流程。
- `HumanLab.activity()`、身体桥接、NPC 日常调度和完成确认使用同一个状态口径。

停止之后，后续任务会先等待实际收脚/支撑转换结束，再读取场景并重新预检。显式“等待 N 秒”在身体稳定后才开始计算身体时间；身体暂停也不会消耗步骤超时预算。

另修复了“坐卧转换中停止，然后提交替换任务”的取消标记：新任务会清除旧的 `cancelRequested`，避免转换结束时连新任务一起丢弃。

### 2. 提取控制模块，统一编辑前置条件

将嵌在 `source/runtime.template.js` 中的两个类移入 `control/BasicController.js` 和 `control/TaskAgent.js`，由装配清单按原依赖顺序载入。职责与原有类名保留，运行仍使用同一动作核心。

`requireCharacterIdle` 统一检查日常/语义预约、持物、身体错误和物理忙碌状态。人物定义、力量/身体状态重置、场景修改及人物重置使用该检查。按钮与公开重置接口在修改世界前检查，堵住了直接按钮绕过场景编辑入口的路径。地面点选定位在写入位置时再次检查，避免进入定位模式后又开始任务的竞争。角色定义切换会先构造新的力量与生理实例，再更新引用。

### 3. 最终姿态在提交前完成校验

原路径为“构造 → 初检 → 写入骨架 → 离地修正 → 重测接触”。后两步失败或产生过大残差时，骨架可能已经更新；固定脚部目标还会随人体一起上移，使残差无法反映实际锚点偏离。

改为：

```text
构造候选 → 检查完整关节集合/变换 → 用候选帧查询支撑
         → 候选离地修正 → 重测最终接触 → 完整校验
         → 准备全部局部变换 → 一次提交
```

支撑查询可读取传入的候选帧，不为测量而改动实时骨架。关节 ID、向量/四元数维度、有限值、固定骨长和既有关节范围均检查。脚部锚点和物体接触默认保持世界坐标；敬礼手部标记显式声明为身体相对目标。最终手/脚位置误差仍使用已有 12 mm 上限，没有为通过检查而放宽。

这是运动学候选校验。支撑点是有限采样，仍不是全表面碰撞、接触力或软组织精度证明。报告增加 `validatedAfterClearance` 和 `worldContactTargetsPreserved`，描述实际校验路径。

### 4. 重建和释放采用明确的资源所有权

旧表皮替换会先删除现有缓冲，再上传新缓冲。改为暂存新分块、权重报告、支撑点和可选毛发；所有分配与上传检查通过后切换引用，再释放旧资源。失败时只释放本次暂存资源，保留原表皮引用与报告。WebGL 上下文本身丢失时不能保证旧资源继续显示，自动重建上下文尚未实现。

Worker 取消既调用 `terminate()`，也让对应 Promise 以 `AbortError` 结束；增加消息传递失败与过期消息处理。移除页面卸载后遗留在父文档的点击监听，释放计时查询；资源释放可重复调用。进入浏览器往返缓存时保留资源，避免返回页面后引用已释放的 GPU 对象。

这遵循显式资源释放与异步任务收尾原则。参考：[Three.js 资源清理](https://threejs.org/manual/en/cleanup.html)、[MDN Worker.terminate](https://developer.mozilla.org/en-US/docs/Web/API/Worker/terminate)、[MDN WebGL.getError](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/getError)、[MDN WebGL.isContextLost](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/isContextLost)。本项目实际使用原生 WebGL2，释放对象是 buffer、VAO、texture 和 program。

暂存替换会短时间同时保留新旧 GPU 几何，峰值内存增加；重建仍有主线程权重计算。这是保证替换失败可恢复所付的成本，没有进行性能测量。

## 后续值得做，但本轮没有声称实现的能力

| 优先方向 | 需要补齐的内容 |
| --- | --- |
| 运行验收 | 停止/替换/暂停竞争、坐卧起身、搬运失败恢复、重建失败与页面返回；在获得运行授权后单独验证 |
| 动画组合 | 按部位的动作层、掩码、优先级、足部支撑与手部接触仲裁，之后才能可靠地实现边走边挥手 |
| 多人物 | 将全局 HumanLab、页面预约、桥接身份与资源引用改为实例作用域；再接多角色导航和调度 |
| 规模与性能 | 根据测量决定减少远处骨架/皮肤更新、运行时细节层级、权重计算迁移 Worker；不凭源码猜测 FPS |
| 物理真实感 | 接触几何、关节轴标定、滑移/压缩、质量与摩擦的独立验证；来源动作和 DQS 本身不能证明这些 |

## 文件验证

`tools/check-character-system.mjs` 检查模块声明、共享状态入口、关键写入顺序、候选支撑路径、资源暂存与取消收尾；它只解析源文件，不调用这些函数。原有动作、日常、R2 骨架/动作参数、R10 表皮连续性和 Motion-Lab 来源锁检查继续执行。最终统计保存在 `FILE_AUDIT.json`，交付文件哈希保存在 `SHA256SUMS.txt`。

R2 的七个曲面系数容器、128 节点来源骨架和八个 Motion-Lab R2.2 核心文件未在本轮改写。没有另起人体、步态或 NPC 架构。运行、视觉、生产就绪仍分别为 `false`，人物配方仍为 Candidate。
