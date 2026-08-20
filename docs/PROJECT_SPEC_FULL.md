# Humanoid Rig Lab 人体骨架与表皮交互网站

## 新项目总记录与技术架构说明书

文档版本：1.4
当前实现基线：Humanoid Rig Lab Next V0.5.0 四板块 V002，内置编辑器 V8.4
修订日期：2026 年 8 月 19 日

> 本文档用于新项目立项、开发、测试、部署和后续迭代。

## 2026 年 8 月 19 日四板块 V002 实施状态

当前母项目已经完成比例、蒙皮、动作物理和动画四个 V002 执行包的代码级合并。正式构建身份为 `four-module-v002-20260819`。

| 板块 | 活动版本 | moduleRevision | 本轮实现 |
| --- | --- | ---: | --- |
| 骨骼比例 | `rig@0.4.0` | 3 | 28 节点角色分类、完整绑定轴审计、隐藏测量标记和追加式升级蓝图 |
| 人物蒙皮 | `skin@0.5.1` | 3 | 原生预绑定 GLB、24 组逆绑定矩阵、单一 SkinnedMesh 和场景级单表皮守卫 |
| 动作与物理 | `pose@0.4.0` | 3 | 图片姿势识别、固定骨长重定向、PoseSnapshot、动作库和 IndexedDB 图片存储 |
| 动画系统 | `anim@0.4.0` | 4 | 局部四元数轨道、动画层、状态机、事件、接触、根运动、重定向、烘焙和骨架动画 GLB |
| 综合整合 | `character@0.5.0` | 2 | 构建身份、状态迁移、PoseSnapshot 直连、临时消息总线和联合回归 |

本轮共享层已经确认以下实现原则：

1. 三维视口优先读取 `humanoid_rig/pose_snapshot@1.0` 的局部四元数和根节点变换。
2. 旧 V8 世界坐标姿势继续作为兼容回退，避免历史项目和旧插件立即失效。
3. 动画播放锚点和时间轴预览使用 `humanoid_rig/transient_bus@1.0`，不会增加项目 revision。
4. 默认人物表面使用 `smpl-male-surface-skinned.glb`，显示、蒙皮变形和三角面拾取由同一 SkinnedMesh 完成。
5. Windows 启动器通过 `BUILD_MANIFEST.json` 核对构建 ID，历史目录占用 4173 端口时不会被误复用。
6. 四个执行包的原始交接文档和模块边界已经归档到 `control/handoffs/2026-08-19/` 与 `control/module-scopes/`。
7. 全套 `npm test` 已经通过，联合测试覆盖状态迁移、原生蒙皮、PoseSnapshot 到 PhysicsRig、动画纵向闭环、临时消息和构建身份。

当前保留的发布边界：

1. 预绑定 GLB 使用过渡性权重，专业发布需要许可明确的权重与姿势修正形变。
2. MediaPipe Pose Landmarker 的来源、再分发条款、隐私说明和离线部署策略仍需单独审查。
3. 动画的全身物理模式仍需动作模块开放外部 `simulationRig` 求解接口。
4. 当前能够导出标准骨架动画 GLB，最终 SkinnedMesh 与动画合并导出仍需跨模块联调。
5. Windows Chrome 或 Edge 的 WebGPU 画面、交互和长时间多窗口稳定性仍属于发布前人工验收。

完整合并记录见 `docs/FOUR_MODULE_V002_MERGE_REPORT_2026-08-19.md`，自动测试记录见 `VALIDATION.md`。

## V0.4.0 实施状态更新

当前母平台已经完成唯一精细人物表面、直接网格拾取和解剖拟合骨架：

1. 比例、蒙皮、动作、动画和综合预览默认嵌入同一个 V8.3 三维人物视口。
2. 轻量 Canvas 人偶只作为三维运行故障回退。
3. 动作与物理工作台可以写入三维姿势，其他模块使用只读视口。
4. 母平台与 iframe 通过同源消息桥接同步显示、物理和姿势。
5. ProjectState 升级为 schemaVersion 4，骨架导出升级为 schemaVersion 5。
6. 场景中只创建一套精细 SMPL 人体 Mesh。
7. 精细网格直接承担三角形拾取，程序化人体代理已删除。
8. 骨架重新拟合当前示例网格，表面使用区域隔离权重、三角形邻接平滑和双四元数变形。
9. A 绑定姿势直接恢复原始顶点和法线。
10. 自动测试覆盖唯一 Mesh、直接拾取、绑定姿势保护、骨架拟合和模块 Patch。

当前实现已经让四个模块看到同一套人物反馈。下一阶段继续完成身体比例对精细网格的实时适配、正式蒙皮权重、局部四元数动画轨道和预绑定生产用 Skinned GLB。

## 文档说明

本说明书用于启动一个全新的 Humanoid Rig Lab 网站项目。文档完整记录现有原型的目标、功能、数据、已验证内容、实机问题，以及新项目所需的多窗口数据共享架构。它同时承担产品需求说明、技术设计说明、数据规范、测试标准和开发路线图的作用。

| 项目项 | 内容 |
| --- | --- |
| 新项目工作名 | Humanoid Rig Lab Next |
| 当前实现基线 | Humanoid Rig Lab Next V0.5.0 四板块 V002，内置编辑器 V8.4 |
| 核心技术 | TypeScript、Three.js、WebGPU、WebGL 2 回退、SharedWorker、IndexedDB |
| 核心能力 | 标准人体骨架、固定骨长、原生 SkinnedMesh、图片姿势、局部四元数动画、多窗口共享 |
| 主要用户 | 项目所有者本人，后续可扩展为内部工具或在线服务 |
| 数据单位 | 米 |
| 坐标系统 | 右手坐标系，Y 轴向上，Z 轴向前，X 轴向右 |
| 文档日期 | 2026 年 8 月 19 日 |
| 文档状态 | 四板块 V002 合并基线，后续按模块交接和联合验收持续更新 |

> **最重要的结论**
> 新项目需要把“绑定尺寸”“当前姿势”“派生世界数据”“窗口显示状态”分成四层。绑定尺寸只读，姿势由全身 IK 与人体约束求解，多个窗口通过 SharedWorker 共享同一份权威状态。每个窗口独立创建 Three.js 渲染器和 GPU 资源。人物表皮加载完成后由唯一精细 Mesh 承担显示、拾取和变形。加载期间保持骨架与状态提示可用。

## 1. 项目定义与总体目标

### 1.1 项目定位

Humanoid Rig Lab Next 是一个运行在浏览器中的人体骨架、姿势与表皮交互编辑网站。用户可以在三维视口中直接触碰关节、骨段或人体表面，拖动后由全身求解器生成符合骨长、关节轴和人体活动范围的姿势。编辑结果能够在同一浏览器的多个窗口中实时共享，并保存为可恢复、可迁移、可导出的结构化数据。

该项目首先服务于自用工作流。输出应能够直接迁移到其他 Three.js 项目，后续可继续扩展到人物生成、自动比例拟合、动作重定向、动画编辑、GLB 导出和在线资产管理。

### 1.2 核心目标

1. 提供一套来源清晰、比例稳定、层级明确的标准人体骨架。
2. 任何姿势编辑都不修改人物原始尺寸，所有物理骨段长度保持固定。
3. 肩、髋、肘、膝、腕、踝、脊柱和颈部遵守真实人体运动逻辑。
4. 拖动任意关节、骨段或表皮部位时，全身能够自然联动。
5. 进入三维视图后立即看到人物表皮，并可切换表皮、骨架、同时三种模式。
6. 主三维窗口、数据窗口、层级窗口、表皮窗口与诊断窗口共享同一项目状态。
7. 项目数据采用版本化 JSON，并具备导入、导出、自动保存、撤销、重做和迁移能力。
8. WebGPU 优先运行，无法使用 WebGPU 时保持 WebGL 2 回退。
9. 浏览器真实画面验证进入发布门槛，自动测试不能替代实机可见性检查。

### 1.3 首版范围

| 范围 | 首版要求 |
| --- | --- |
| 项目管理 | 创建、打开、复制、重命名、删除项目；记录 schema 与构建版本 |
| 骨架 | SMPL 24 兼容骨架，额外包含控制点和末端辅助点 |
| 姿势 | A 姿势、T 姿势、恢复绑定姿势、关节拖动、骨段拖动、数值输入 |
| 人体约束 | 固定骨长、刚性骨盆、关节活动范围、固定关节、地面碰撞、可选重力 |
| 表皮 | 精细 GLB 后台加载；唯一人体 Mesh；直接表面拾取；三种显示模式 |
| 多窗口 | 同源窗口实时共享项目、姿势、历史、固定状态和活动窗口信息 |
| 数据 | JSON 与 CSV；IndexedDB 自动保存；事件日志与快照 |
| 诊断 | 渲染后端、表皮状态、骨长误差、关节越界、同步 revision、窗口列表 |
| 部署 | 本地开发服务器、静态 HTTPS 部署、离线缓存 |

### 1.4 首版暂缓内容

首版不同时承担完整人物生成、服装系统、毛发系统、肌肉体积模拟、多人远程协作和复杂动画时间线。架构会为这些能力保留接口，开发顺序先保证骨架、表皮和多窗口同步可靠。

## 2. 当前原型的完整研发记录

### 2.1 研发沿革

| 阶段 | 主要成果 | 暴露的问题 |
| --- | --- | --- |
| V1 | 建立标准人形骨骼链，关节球与骨杆显示，记录局部位置和世界位置。 | 远程模块加载失败时整个界面停在初始化状态。 |
| V2 | 加入 JSON 导入、文本输入、数据表、关节拖动、鼠标悬停反馈。 | 直接使用 file 协议打开页面时 ES Modules 与资源加载被浏览器拦截。 |
| V3 | 增加本地服务器启动器和中文启动脚本。 | 启动方式得到修复，项目仍以单窗口和单文件主控制器为主。 |
| V5 | 分离模型尺寸与姿势，引入固定骨长、全身联动、地面、固定脚与阻尼。 | 位置约束能够保持长度，真实关节轴和人体运动限制仍需加强。 |
| V6 | 隐藏骨盆控制骨杆，加入人体活动范围和刚性骨盆，重新校正比例。 | 部分手臂和腿部比例仍缺少成熟标准映射。 |
| V7 | 采用 SMPL 24 关节顺序，加入 SMPL 示例人体表面与 CPU 蒙皮尝试。 | 自动生成的蒙皮权重与 WebGPU 实机显示不稳定。 |
| V7.2 | 增加表皮加载状态、重载入口与 CPU 变形回退。 | 用户实机仍只看到骨架，表皮可见性没有通过真实浏览器验收。 |
| V8 | 增加立即创建的基础人体表皮，设计表皮、骨架、同时三种模式。 | 代码测试通过，用户截图仍显示骨架，说明表皮创建或可见状态在实机链路中仍有缺口。 |
| V8.1 | 增加单一可见表皮状态机。精细表皮接管后隐藏基础层，并保留隐藏拾取壳。 | 自动测试已验证任意时刻最多一层表皮可见，仍需 Windows Chrome 或 Edge 实机画面确认。 |
| V8.3 | 删除程序化人体代理，使用唯一精细网格直接拾取，重新拟合关节并加入区域权重、邻接平滑与双四元数变形。 | 处理黄色第二层人体、肩部拉扯和骨架对位偏差。 |

### 2.2 当前 V8.3 已记录能力

当前 V8.3 文件包包含 28 个编辑器节点，其中 24 个映射到 SMPL 标准关节，另有全身控制、头顶和左右脚趾末端辅助点。绑定身高约为 1.795672 米，精细示例人体表面包含 27,578 个渲染顶点和 55,152 个三角形。

1. 标准 A 姿势与 T 姿势。
2. 固定骨长、刚性髋距、人体活动范围、全身运动传播。
3. 关节、骨段和表皮部位的鼠标拾取设计。
4. 正面、侧面、顶部和透视视角。
5. 表皮、骨架、同时三种显示模式。
6. JSON 导入、姿势 JSON 输入、CSV 导出、本地保存、撤销和重做。
7. WebGPU 优先与 WebGL 回退设计。
8. 二维 SVG 物理编辑回退。
9. GLB 解析、CPU 双四元数蒙皮、绑定姿势保护和自动化测试。

### 2.3 历史实机问题与 V8.3 修复

![图 1  当前 V8 实机截图。WebGPU 骨架已经显示，人物表皮仍未出现。](da70ee9b-e893-4ab8-a2aa-69d0e202ea50.png)

截图记录了 V8 阶段的历史问题。V8.3 已删除程序化人体代理，精细网格同时承担显示、拾取和变形。骨架关节中心重新拟合当前人体表面，肩部和髋部变形采用区域隔离权重、三角形邻接平滑与双四元数方法。自动测试已经验证唯一 Mesh、直接拾取、A 姿势顶点保护、固定骨长和姿势桥接，真实 Chrome 或 Edge 的最终画面验收仍保留在发布门槛中。

### 2.4 从现有原型得到的关键经验

1. 网站外壳与数据编辑器应先启动，三维渲染器异步启动，渲染失败不能使 JSON 和项目数据功能失效。
2. 本地运行必须通过 HTTP 服务器或 HTTPS，页面不能依赖直接双击 index.html。
3. 运行库应锁定版本并在本地可用，在线 CDN 仅作为可选回退。
4. 绑定尺寸与姿势数据必须彻底分离。姿势编辑只改变根变换和关节旋转。
5. 真实人物表皮应使用预绑定 GLB。当前运行时权重用于原型验证，生产阶段需要专业权重与姿势修正形变。
6. 表皮开关需要同时控制对象创建状态、场景挂载状态、visible、材质透明度、渲染层与深度设置。
7. 自动测试需要覆盖数据和算法，发布前还需要浏览器截图、像素检测和人工实机检查。
8. 单窗口 localStorage 结构无法满足多窗口一致性。新项目需要单一权威状态中心。

## 3. 新项目必须遵守的设计原则

| 编号 | 原则 | 落实方式 |
| --- | --- | --- |
| P01 | 绑定尺寸锁定 | 绑定骨架独立存储，界面只读，姿势工作区不提供骨长编辑。 |
| P02 | 旋转驱动姿势 | 以局部四元数和根变换作为权威姿势，世界位置只作为派生缓存。 |
| P03 | 真实人体约束 | 关节局部坐标框架、摆动锥、扭转范围和铰链轴全部显式记录。 |
| P04 | 唯一人物表面 | 精细人体 Mesh 同时承担显示、拾取和变形，场景中不创建第二套人体。 |
| P05 | 单一权威状态 | SharedWorker 负责所有共享数据、revision、历史与编辑锁。 |
| P06 | 窗口视图独立 | 相机、网格、显示模式与面板布局属于窗口本地状态。 |
| P07 | 本地优先并可在线化 | IndexedDB 与资产缓存保证本地使用，SyncAdapter 为云端同步预留接口。 |
| P08 | 版本化与可迁移 | schemaVersion、assetVersion、solverVersion 和 buildVersion 分开记录。 |
| P09 | 实机画面是发布条件 | 每次发布都在 Windows Chrome 和 Edge 验证骨架、表皮与切换开关。 |
| P10 | 模块可迁移 | 骨架、求解器、渲染器、表皮、同步和存储均形成独立包。 |

## 4. 网站内容与功能模块

### 4.1 项目首页

项目首页用于创建和管理人物骨架项目。每个项目卡片显示名称、缩略图、标准骨架版本、最后更新时间、当前姿势名称、表皮资产和同步状态。

1. 新建标准成人项目。
2. 从 JSON 导入项目。
3. 复制已有项目。
4. 打开最近项目。
5. 查看项目 revision 和 schemaVersion。
6. 导出完整项目包。

### 4.2 主三维编辑窗口

主窗口保持当前 V8.3 的三栏结构，并把渲染视口作为核心。顶部提供视角、姿势、显示模式、窗口管理、保存和导出。左侧显示骨架层级、物理与显示设置。右侧显示选中关节、骨段或表皮部位的属性。

| 区域 | 内容 |
| --- | --- |
| 顶部工具栏 | 撤销、重做、视角、A 姿势、T 姿势、恢复绑定姿势、停止运动、表皮模式、打开窗口、保存、导入、导出。 |
| 左侧骨架区 | 项目状态、关节层级、搜索、固定关节列表、物理设置、显示设置。 |
| 中央视口 | Three.js WebGPU 场景、人体表皮、骨架、地面、坐标轴、变换手柄、悬停提示。 |
| 右侧检查器 | 标准映射、父级、绑定数据、当前局部旋转、世界位置、角度、限制状态、固定状态、速度。 |
| 底部状态栏 | 渲染后端、同步 revision、SharedWorker 状态、表皮状态、骨长误差、当前编辑锁。 |

### 4.3 多窗口角色

| 窗口角色 | 主要用途 | 是否创建三维渲染器 |
| --- | --- | --- |
| main | 主三维姿势编辑。 | 是 |
| hierarchy | 关节层级、搜索、选择、固定和结构诊断。 | 否 |
| data | 绑定数据只读表、姿势数据表、JSON、CSV、差异比较。 | 否 |
| surface | 表皮资产、材质、透明度、线框、骨架透视、加载诊断。 | 可选预览 |
| physics | 约束参数、固定点、求解迭代、误差与运动状态。 | 可选简化视图 |
| preview | 只读人物预览，适合观察表皮与姿势。 | 是 |
| diagnostics | 性能、同步、资源、日志、窗口活动和错误。 | 否 |

### 4.4 窗口管理器

主窗口提供“打开数据窗口”“打开表皮窗口”“打开诊断窗口”等按钮。每个窗口通过 projectId 和 role 参数启动。系统使用固定窗口名称复用已有窗口，并在关闭、刷新、断线或恢复时更新活动窗口列表。

```javascript
window.open(
  `/workspace.html?projectId=${projectId}&role=data`,
  `riglab:${projectId}:data`,
  'width=1080,height=820'
);
```

## 5. 总体技术架构

![图 2  新项目总体架构。多个窗口连接到同一个 SharedWorker，项目状态由工作线程统一维护。](architecture.png)

### 5.1 推荐技术栈

| 层 | 推荐技术 | 说明 |
| --- | --- | --- |
| 构建与语言 | Vite、TypeScript、ES Modules | 适合纯前端三维工具，开发启动快，输出静态文件。 |
| 界面 | React、CSS Modules 或现有设计系统 | React 负责面板和窗口页面，Three.js 场景保持独立生命周期。 |
| 三维 | Three.js，WebGPURenderer 优先 | 同一渲染模块支持 WebGPU 与 WebGL 2 回退。 |
| 材质 | 标准 PBR 与 TSL | 自定义 WebGPU 材质从 TSL 开始，避免依赖只适用于旧 WebGL 的改写方式。 |
| 共享状态 | SharedWorker、MessagePort | 同源多窗口只有一个权威项目实例。 |
| 回退同步 | BroadcastChannel | SharedWorker 不可用时采用主窗口选举与广播。 |
| 持久化 | IndexedDB，建议使用 Dexie 封装 | 保存项目、快照、事件、资产索引和窗口设置。 |
| 大文件 | OPFS 或 IndexedDB Blob | 保存 GLB、贴图和导入资产，消息中只传 assetId。 |
| 校验 | Zod 或 JSON Schema | 所有导入数据和跨窗口消息统一校验。 |
| 测试 | Vitest、Playwright | 算法单测、同步集成测试、真实浏览器画面测试。 |
| 仓库 | GitHub、锁定依赖、自动发布 | 源码、文档、技能、资产清单和版本全部在线保存。 |

### 5.2 分层结构

1. 领域层：骨架标准、绑定数据、姿势数据、关节限制、项目 schema。
2. 求解层：IK、固定骨长、刚性骨盆、关节活动范围、固定点、地面和阻尼。
3. 同步层：SharedWorker、动作协议、revision、编辑锁、广播和重连。
4. 存储层：IndexedDB、事件日志、快照、资产索引和迁移。
5. 渲染层：Three.js 场景、骨架层、表皮层、辅助层、拾取和相机。
6. 界面层：多窗口页面、工具栏、检查器、数据表、诊断和通知。

### 5.3 每个窗口独立渲染

WebGPUDevice、Three.js 场景、材质、几何体和纹理属于当前窗口的浏览器上下文，不能直接跨窗口共享。多窗口共享的是项目数据、姿势旋转、骨矩阵输入和资产标识。每个需要三维画面的窗口根据同一份共享姿势自行更新场景。

## 6. 多窗口数据共享核心设计

![图 3  拖动时序。拖动预览高频广播，松手后形成一次正式提交和一次全局历史记录。](multiwindow.png)

### 6.1 SharedWorker 作为权威状态中心

同一浏览器、同一来源下的所有项目窗口连接到一个 SharedWorker。工作线程持有完整 ProjectDocument、当前 revision、撤销重做历史、活动窗口、编辑锁和持久化队列。任何共享状态修改都先发送 Action，由工作线程校验并应用。

窗口不能直接改写共享快照。窗口只提交动作并接收 PATCH 或 SNAPSHOT。这样可以避免两个窗口各自保存一份状态后相互覆盖。

### 6.2 连接与重连流程

1. 窗口生成持久 clientId 和当前 windowId。
2. 窗口向 SharedWorker 发送 HELLO，携带 projectId、role、已知 revision 和构建版本。
3. 工作线程返回完整 SNAPSHOT 或从已知 revision 开始的 PATCH 列表。
4. 窗口建立心跳并进入活动窗口列表。
5. 窗口刷新后使用同一 clientId 和新的 windowId 重新握手。
6. 所有窗口关闭后，最新快照已经写入 IndexedDB。再次打开时由存储层恢复。

### 6.3 拖动数据分为预览与提交

关节拖动会产生高频目标点。如果每一帧都写入事件日志和撤销历史，会造成大量数据和难以使用的撤销记录。新项目采用两阶段处理。

| 阶段 | 消息 | 处理方式 |
| --- | --- | --- |
| 开始 | DRAG_BEGIN | 申请关节或骨链编辑租约，记录起始姿势。 |
| 移动 | DRAG_SAMPLE | 工作线程执行 IK 与约束，广播临时 posePreview，不写正式历史。 |
| 结束 | DRAG_COMMIT | 将最终姿势写入 ProjectDocument，revision 加一，生成一个撤销记录。 |
| 取消 | DRAG_CANCEL | 恢复起始姿势，释放租约。 |

### 6.4 编辑租约与冲突控制

同一时刻可能有两个窗口编辑同一条骨链。工作线程为拖动目标授予短期租约。租约包含 token、jointId、ownerWindowId、expiresAt 和受影响关节集合。其他窗口可以继续观察，也可以编辑不重叠的区域。

1. 心跳持续时自动续期。
2. 窗口关闭或失联后租约自动释放。
3. 同一骨链的第二个拖动请求收到 LEASE_DENIED，并显示正在被哪个窗口编辑。
4. 数值表修改使用 baseRevision 校验。字段不重叠时可以自动重放，字段重叠时提示用户选择最新值。

### 6.5 共享状态与窗口本地状态

| 状态项 | 默认归属 | 原因 |
| --- | --- | --- |
| 项目名称、schema、资产引用 | 共享 | 所有窗口必须一致。 |
| 绑定骨架与比例 | 共享且只读 | 决定模型结构与表皮绑定。 |
| 当前姿势与固定关节 | 共享 | 多个窗口必须看到同一人物状态。 |
| 物理设置与求解版本 | 共享 | 保持求解结果一致。 |
| 全局撤销重做历史 | 共享 | 避免每个窗口产生不同历史。 |
| 当前活动选择 | 共享 | 主视口选择关节后，检查器窗口同步更新。 |
| 鼠标悬停 | 窗口本地 | 悬停属于当前指针。 |
| 相机与轨道目标 | 窗口本地 | 不同窗口可以观察不同角度。 |
| 表皮、骨架、同时模式 | 窗口本地 | 数据窗口和预览窗口的观察需求不同。 |
| 网格、坐标轴、骨架透视 | 窗口本地 | 只影响显示。 |
| 面板宽度与折叠状态 | 窗口本地 | 属于布局偏好。 |

### 6.6 回退方案

SharedWorker 无法创建时，系统使用 BroadcastChannel 进行窗口发现，并选举一个主窗口作为临时状态中心。主窗口将状态写入 IndexedDB，其他窗口发送动作并接收补丁。该模式用于兼容和故障恢复，首选运行路径仍然是 SharedWorker。

### 6.7 可选的高频共享内存模式

当站点启用跨源隔离并确认浏览器支持时，可以为骨矩阵或局部旋转建立 SharedArrayBuffer。SharedWorker 写入统一 Float32Array，三维窗口读取版本号后更新骨骼。首版可以先使用可转移 Float32Array 和消息合并，性能达到要求后再开启共享内存。

## 7. 数据模型与 JSON 规范

![图 4  四层数据模型。绑定尺寸、共享姿势、派生缓存和窗口视图保持明确边界。](data_layers.png)

### 7.1 ProjectDocument 顶层结构

```typescript
interface ProjectDocument {
  schemaVersion: number;
  projectId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  buildVersion: string;
  rig: BindRig;
  pose: PoseState;
  physics: PhysicsSettings;
  surface: SurfaceBinding;
  assets: AssetReference[];
  metadata: Record<string, unknown>;
}
```

### 7.2 绑定骨架 BindRig

BindRig 代表人物原始尺寸和拓扑。它在创建项目或明确执行“比例生成”工作流时产生。进入姿势编辑后保持只读。

```typescript
interface BindJoint {
  id: string;
  parentId: string | null;
  standardName: string;
  standardIndex: number | null;
  bindTranslation: [number, number, number];
  bindRotation: [number, number, number, number];
  boneLength: number;
  jointFrame: JointFrame;
  limits: JointLimit;
  flags: {
    visualJoint: boolean;
    visualBone: boolean;
    physicalBone: boolean;
    helper: boolean;
  };
}
```

### 7.3 姿势 PoseState

新项目以局部旋转作为权威姿势。拖动关节时，IK 求解器修改一组 localRotation。rootTranslation 和 rootRotation 控制全身。世界位置、世界四元数和骨矩阵全部由绑定数据与姿势计算。

```typescript
interface PoseState {
  name: string;
  rootTranslation: [number, number, number];
  rootRotation: [number, number, number, number];
  localRotations: Record<string, [number, number, number, number]>;
  pinnedJoints: Record<string, PinConstraint>;
  revision: number;
  modifiedAt: string;
}
```

### 7.4 派生数据

DerivedState 不进入项目 JSON，也不进入撤销历史。它包括关节世界矩阵、骨骼世界矩阵、骨长误差、活动范围状态、包围盒、鼠标拾取代理、表皮骨矩阵和性能统计。窗口收到共享姿势后可以自行重建，SharedWorker 也可返回紧凑的骨矩阵数组。

### 7.5 窗口视图状态

```typescript
interface WindowViewState {
  role: 'main' | 'hierarchy' | 'data' | 'surface' | 'physics' | 'preview' | 'diagnostics';
  camera: CameraState;
  displayMode: 'skin' | 'skeleton' | 'both';
  skeletonXray: boolean;
  skinOpacity: number;
  showGrid: boolean;
  showAxes: boolean;
  panelLayout: Record<string, number | boolean>;
}
```

### 7.6 Schema 版本和迁移

1. schemaVersion 只描述项目 JSON 结构。
2. rigVersion 描述骨架标准和绑定拓扑。
3. solverVersion 描述 IK 与物理求解行为。
4. surfaceVersion 描述表皮资产和骨骼映射。
5. buildVersion 描述网站构建。
6. 导入旧项目时按顺序执行纯函数迁移，并保留原文件备份。
7. 迁移不能用旧姿势数据覆盖新的绑定骨长、关节轴和标准层级。

## 8. 标准骨架、人体比例与坐标系统

### 8.1 标准骨架选择

当前基线沿用 SMPL 24 关节顺序，便于与成熟人体表面和动作数据建立映射。编辑器保留 24 个标准节点，并增加全身控制、头顶和左右脚趾末端辅助点。为了改善肩部、前臂和大腿的表皮扭转，新项目可以在变形骨架中增加 twist 辅助骨，同时保持标准 24 节点作为交换层。

### 8.2 当前基准人体比例

| 项目 | 数值 |
| --- | --- |
| 参考身高 | 1.795672 m |
| 肩关节宽度 | 0.410000 m |
| 髋关节宽度 | 0.190000 m |
| 上臂长度 | 0.272993 m |
| 前臂长度 | 0.237908 m |
| 腕到手部控制点 | 0.069599 m |
| 上臂与前臂比例 | 1.1475 |
| 大腿长度 | 0.420088 m |
| 小腿长度 | 0.420040 m |
| 大腿与小腿比例 | 1.0001 |
| 踝到前脚掌 | 0.150416 m |

### 8.3 坐标系统

项目统一使用右手坐标系。Y 轴向上，Z 轴向前，X 轴向右。所有绑定数据、姿势数据、IK 目标、表皮绑定和导出数据都使用米。导入其他来源时先进入转换层，不能在核心数据内混用厘米、不同前向轴或左手坐标。

### 8.4 骨盆显示规则

1. 全身根控制到骨盆中心的控制杆不显示。
2. 骨盆中心到左右髋关节的内部连接杆不显示。
3. 左右髋距仍通过隐藏刚性约束保持。
4. 髋关节球可以显示并参与选择。
5. 表皮模式中骨盆表面映射到骨盆中心控制。

### 8.5 绑定姿势与姿势预设

A 姿势作为默认绑定姿势。T 姿势通过旋转肩、上臂、前臂和手部链生成，所有绑定节段长度保持不变。姿势预设只修改 PoseState，不能改写 BindRig。

## 9. 人体运动学、IK 与物理

### 9.1 求解模型

新项目建议采用全身 IK 与 XPBD 风格约束组合。关节拖动先生成目标效应器，再通过迭代求解调整局部旋转和根变换。固定骨长来自绑定矩阵，关节限制在每次迭代后投影到合法范围。

### 9.2 关节类型

| 类型 | 适用部位 | 约束方式 |
| --- | --- | --- |
| 球窝关节 | 肩、髋 | 摆动锥加扭转范围，使用局部关节框架。 |
| 铰链关节 | 肘、膝 | 单主轴屈伸，限制反向过伸。 |
| 双轴关节 | 腕、踝 | 屈伸和侧偏分别限制，扭转单独限制。 |
| 锥形关节 | 脊柱、颈部、锁骨 | 相对绑定方向限制在锥角内。 |
| 刚性约束 | 骨盆 | 左右髋距、骨盆朝向和中心保持一致。 |
| 末端控制 | 手部、前脚掌、脚趾、头顶 | 用于拾取、碰撞和目标控制。 |

### 9.3 当前活动范围基线

| 关节区域 | 首版限制 |
| --- | --- |
| 肩关节 | 前屈 170°，后伸 55°，外展 95°，内收 35° |
| 肘关节 | 屈曲 145°，反向过伸最多 5° |
| 腕关节 | 掌屈 80°，背伸 70°，桡偏 20°，尺偏 30° |
| 髋关节 | 前屈 130°，后伸 18°，外展 50°，内收 30° |
| 膝关节 | 屈曲 140°，反向过伸最多 2° |
| 踝关节 | 跖屈 55°，背屈 15°，轴向偏转 20° |
| 脚趾 | 屈曲 35°，伸展 45° |
| 腰椎 | 分段锥角 22° |
| 胸椎与上胸 | 分段锥角 18° |
| 颈根 | 锥角 45° |
| 头部 | 锥角 60° |
| 锁骨 | 锥角 35° |

### 9.4 拖动行为

1. 拖动关节球时，以该关节作为效应器目标。
2. 拖动骨段时，以父子两端共同作为目标，并保持骨段长度。
3. 拖动表皮时，根据 bodyPartId 映射到关节或骨段。
4. 双脚固定时，手部拖动会通过肩、胸椎、腰椎、骨盆和腿部传递。
5. 没有固定点时，根节点可以跟随目标，保持身体整体性。
6. 目标超出可达范围时，效应器停在最接近的合法位置。
7. 松手后姿势保持，除非开启重力或回弹模式。

### 9.5 求解器运行位置

为保证多窗口一致，权威 IK 与物理求解在 SharedWorker 中运行。三维窗口可以在本地进行一帧预测，用于降低鼠标延迟，但最终结果以工作线程返回的 revision 和 PoseState 为准。所有求解函数必须保持纯数据输入和确定性输出。

### 9.6 数值标准

| 指标 | 目标 |
| --- | --- |
| 最大骨长误差 | 常规编辑小于 0.1 mm，测试环境目标小于 0.01 mm。 |
| 关节限制越界 | 最终提交小于 0.5°。 |
| 拖动同步延迟 | 同机窗口中位数小于 50 ms。 |
| 求解帧率 | 交互时目标 60 次每秒，压力模式可降到 30 次每秒。 |
| 抖动 | 固定目标静止 500 ms 后，效应器位移小于 0.2 mm。 |

## 10. 人物表皮与蒙皮系统

![图 5  表皮采用双层结构。基础人体保证立即可见和可交互，精细 GLB 提供真实外形。](surface_pipeline.png)

### 10.1 表皮双层结构

基础人体表皮由低面数躯干、头部、手部、足部和四肢胶囊组成。它与骨架使用同一 Three.js 场景、相机和渲染循环，在三维视图创建时同步加入场景。只要骨架能够显示，基础人体层也应当显示。

精细表皮采用预绑定 GLB。GLB 内部必须已经包含骨骼层级、skinIndex、skinWeight、inverseBindMatrices 和可验证的骨骼命名。加载完成后由标准关节映射驱动 SkinnedMesh。当前静态 SMPL 示例网格可以继续作为形体参考和测试资产，但生产用精细表皮需要预先绑定。

### 10.2 三种显示模式

| 模式 | 显示内容 | 交互 |
| --- | --- | --- |
| 表皮 | 基础或精细人体表面。 | 点击人体部位选择并拖动对应关节链。 |
| 骨架 | 关节球、骨杆、控制手柄。 | 直接选择关节和骨段。 |
| 同时 | 表皮与骨架一起显示。 | 骨架透视可开启，适合调试姿势和蒙皮。 |

### 10.3 表皮加载状态机

```text
idle
  -> detailedLoading
  -> detailedPreview
  -> weightsBuilding
  -> detailedReady
  -> detailedError
```

加载期间保持骨架、项目数据和状态提示可用。精细网格出现后立即作为唯一人体表面。权重完成后开启直接三角形拾取和姿势变形。表皮开关只控制唯一网格的场景挂载与可见状态。重建表皮属于诊断操作。

### 10.4 预绑定 GLB 验证

1. 至少一个 SkinnedMesh。
2. 存在 skinIndex 与 skinWeight。
3. 每个顶点权重归一化。
4. 存在 inverseBindMatrices。
5. 骨骼名称能够映射到标准关节。
6. 绑定姿势和坐标轴与项目一致。
7. 包围盒高度与参考身高在允许误差内。
8. 材质可见、双面设置合理、透明度大于零。

### 10.5 表皮拾取

精细人体网格直接参与 Raycaster。命中三角形以后，系统读取三个顶点的 skinIndex 与 skinWeight，汇总主导关节。生产版本也可以离线生成 bodyPart 属性或区域贴图。拾取结果转换为统一的 InteractionTarget。

```typescript
interface InteractionTarget {
  kind: 'joint' | 'bone' | 'surfacePart';
  jointId?: string;
  parentJointId?: string;
  childJointId?: string;
  bodyPartId?: string;
  worldPoint: [number, number, number];
}
```

### 10.6 表皮实机验收

1. 精细 GLB 加载完成后，场景中只有一套人体 Mesh。
2. 点击“表皮”后视口中显示完整人物外形。
3. 点击“骨架”后表皮隐藏，骨架可见。
4. 点击“同时”后显示一套人物和一套骨架。
5. 拖动前臂表面能选择对应骨链并带动肘和腕。
6. 选择关节时人体表面不出现黄色代理区域。
7. 精细 GLB 失败时显示明确错误并保留骨架和数据编辑功能。
8. Playwright 截图中人体表面像素面积达到设定阈值。
9. Windows Chrome 与 Edge 人工确认通过。

## 11. Three.js 与 WebGPU 渲染系统

### 11.1 渲染器启动链

1. 页面和共享数据连接先完成。
2. 创建 Three.js 场景、相机、灯光和 WebGPURenderer。
3. WebGPU 初始化失败时创建兼容渲染后端。
4. 同步创建骨架层。
5. 后台加载唯一精细人物网格并建立权重。
6. 精细网格直接加入表皮显示层和拾取列表。
7. 渲染状态、后端名称和错误写入诊断窗口。

### 11.2 场景分层

| 层 | 对象 | 关键设置 |
| --- | --- | --- |
| BodySurfaceLayer | 唯一精细人体 Mesh | 可见性、透明度、材质、直接三角形拾取和姿势变形。 |
| SkeletonLayer | 关节球、骨杆、隐藏控制点 | 骨架透视、选择高亮、固定状态。 |
| GizmoLayer | TransformControls、目标点、拖动辅助线 | 只在选中和编辑时显示。 |
| HelperLayer | 地面网格、坐标轴、包围盒 | 窗口本地开关。 |
| OverlayLayer | 标签、状态、错误、性能信息 | DOM 或 CSS2D，避免影响三维深度。 |

### 11.3 材质与灯光

首版使用稳定的 MeshStandardMaterial 或 WebGPU 对应节点材质。人体采用中性皮肤色、适度粗糙度和双面关闭。场景使用环境光、半球光和主方向光。自定义特效后续使用 TSL。表皮可见性验证阶段避免透明混合、复杂后处理和深度技巧。

### 11.4 相机与视角

1. 正面：沿负 Z 方向观察。
2. 侧面：沿正负 X 方向观察。
3. 顶部：沿负 Y 方向观察。
4. 透视：OrbitControls 自由观察。
5. 适配视图：根据绑定骨架或表皮包围盒自动设置相机距离和轨道中心。

### 11.5 性能策略

1. 姿势没有变化时不更新表皮骨矩阵。
2. 拖动消息按 requestAnimationFrame 合并。
3. 关节球和骨杆使用共享几何体和实例化。
4. 精细表皮只保留必要材质和贴图。
5. 诊断窗口不创建 Three.js 渲染器。
6. 多个三维窗口同时打开时允许降低预览窗口像素比。
7. 资源通过 Service Worker 和浏览器缓存复用下载，GPU 上传仍由每个窗口独立完成。

## 12. 交互与用户体验

### 12.1 指针交互

| 动作 | 结果 |
| --- | --- |
| 悬停关节 | 关节球放大或变亮，显示名称和 ID。 |
| 悬停骨段 | 骨段加粗或高亮，显示父子关节。 |
| 悬停表皮 | 对应人体部位高亮，显示将要控制的关节或骨链。 |
| 单击 | 更新共享 activeSelection，所有检查器窗口同步。 |
| 拖动 | 申请租约并进入全身 IK 预览。 |
| 松手 | 形成一次全局提交和撤销记录。 |
| Esc | 取消当前拖动并恢复起始姿势。 |

### 12.2 数值编辑

右侧检查器允许编辑局部旋转或目标世界位置。世界位置输入会触发 IK，不直接写入关节坐标。绑定平移、骨长和标准映射只读。数据窗口可以批量修改姿势，但必须通过事务提交。

### 12.3 撤销与重做

全局历史保存语义动作，例如“拖动左手”“应用 T 姿势”“固定左脚”“修改重力”。高频预览不进入历史。撤销和重做由 SharedWorker 执行，并向所有窗口广播新的 revision。窗口本地相机操作不进入全局历史。

### 12.4 键盘快捷键

| 快捷键 | 功能 |
| --- | --- |
| Ctrl+Z | 全局撤销 |
| Ctrl+Y 或 Ctrl+Shift+Z | 全局重做 |
| 1 | 当前窗口只显示表皮 |
| 2 | 当前窗口只显示骨架 |
| 3 | 当前窗口同时显示 |
| F | 适配人物视图 |
| A | 应用 A 姿势 |
| T | 应用 T 姿势 |
| Esc | 取消拖动或关闭弹窗 |

### 12.5 诊断可见性

表皮和多窗口同步属于高风险链路，状态信息不能隐藏在 Console 中。界面应显示 rendererBackend、surfaceState、surfaceAsset、workerState、projectRevision、lastPersistedRevision、activeWindows、currentLease 和 lastError。Console 接口仍保留给开发者。

## 13. 存储、版本管理与在线化

### 13.1 IndexedDB 表设计

| 表 | 主键 | 内容 |
| --- | --- | --- |
| projects | projectId | 项目元数据、当前 revision、当前 snapshotId。 |
| snapshots | projectId + revision | 压缩后的完整 ProjectDocument。 |
| events | projectId + sequence | 正式 Action、作者窗口、时间、前后 revision。 |
| assets | assetId | GLB、贴图、哈希、许可、来源、缓存位置。 |
| windowSettings | projectId + role | 相机、显示模式、面板布局。 |
| migrations | projectId + schemaVersion | 迁移记录和原始文件备份引用。 |

### 13.2 自动保存

1. 正式 Action 提交后进入持久化队列。
2. 500 ms 内合并连续提交。
3. 每 50 到 100 个事件创建一次完整快照。
4. 窗口关闭前尽力执行 flush。
5. SharedWorker 关闭前最后一次 flush。
6. 导出前强制创建快照。

### 13.3 资产保存

GLB 和贴图通过 assetId 引用。大文件优先存入 OPFS，回退到 IndexedDB Blob。跨窗口消息只发送 assetId、哈希和元数据。Service Worker 缓存网站静态资源，避免每个窗口重复下载。

### 13.4 在线保存与持续升级

新项目源码、技能、依赖清单、数据 schema、示例资产和文档全部进入 GitHub 仓库。依赖使用锁文件，正式版本使用 tag 和 release。云端数据层通过 SyncAdapter 接口接入，首版可以只实现 LocalSyncAdapter，后续增加 WebSocket 与对象存储适配器。

```typescript
interface SyncAdapter {
  open(projectId: string): Promise<ProjectDocument>;
  pushActions(actions: SharedAction[]): Promise<SyncAck>;
  pullSince(revision: number): Promise<SharedPatch[]>;
  uploadAsset(asset: Blob, metadata: AssetMetadata): Promise<AssetReference>;
}
```

### 13.5 数据导出

| 导出类型 | 内容 |
| --- | --- |
| 姿势 JSON | 标准骨架引用、根变换、局部关节旋转、固定点、姿势名称。 |
| 完整项目 JSON | BindRig、PoseState、PhysicsSettings、SurfaceBinding、元数据。 |
| CSV | 关节 ID、父级、标准映射、绑定位置、当前世界位置、角度和误差。 |
| GLB | 后续阶段导出预绑定表皮、当前姿势和可选动画。 |
| 项目包 | JSON、资产、许可、缩略图和校验清单。 |

## 14. 推荐项目目录与模块职责

```text
humanoid-rig-lab-next/
  apps/
    editor/
      src/
        windows/
        components/
        app.tsx
      public/
  packages/
    schema/
    rig-core/
    solver/
    renderer/
    surface/
    sync/
    storage/
    diagnostics/
    ui/
  assets/
    human/
    presets/
  tests/
    unit/
    integration/
    browser/
  docs/
  package.json
  tsconfig.base.json
  vite.config.ts
```

### 14.1 包职责

| 包 | 职责 |
| --- | --- |
| schema | Zod 或 JSON Schema、版本迁移、导入校验。 |
| rig-core | SMPL 24 映射、绑定骨架、姿势计算、坐标转换、派生世界矩阵。 |
| solver | 全身 IK、XPBD 约束、人体关节限制、固定点、地面和误差统计。 |
| renderer | Three.js 场景、WebGPU 与 WebGL 回退、骨架、相机、拾取。 |
| surface | 精细 GLB、骨骼映射、权重、材质、直接表面拾取与姿势变形。 |
| sync | SharedWorker、消息协议、revision、租约、BroadcastChannel 回退。 |
| storage | IndexedDB、OPFS、事件日志、快照、导入导出。 |
| diagnostics | 日志、性能、同步状态、资源状态、错误编码。 |
| ui | 工具栏、面板、数据表、弹窗、窗口管理与主题。 |

### 14.2 当前 V8.3 文件迁移对应

| V8.3 文件 | 新模块 | 处理方式 |
| --- | --- | --- |
| src/skeleton-presets.js | rig-core/presets | 保留数据和 SMPL 映射，改为 TypeScript，增加关节框架。 |
| src/skeleton-model.js | rig-core | 保留纯函数，姿势权威值改为局部四元数。 |
| src/biomechanics.js | solver/constraints | 保留活动范围思想，改为局部轴 swing 与 twist。 |
| src/physics-rig.js | solver | 重构为可在 SharedWorker 运行的确定性求解器。 |
| src/three-view.js | renderer | 拆分渲染器、骨架层、拾取、相机和控制器。 |
| src/smpl-skin.js | surface | 保留唯一精细网格、直接权重拾取与绑定姿势保护，生产阶段替换为预绑定 GLB 权重。 |
| src/glb-geometry.js | surface/validator | 扩展为 SkinnedMesh、权重和骨架验证。 |
| src/svg-view.js | renderer/fallback | 保留为二维数据与交互回退。 |
| src/main.js | apps/editor | 拆分为窗口页面、命令控制器和共享状态客户端。 |
| styles.css | ui | 拆分主题变量和组件样式。 |

## 15. 消息协议与 API 设计

### 15.1 通用消息头

```typescript
interface MessageEnvelope<T> {
  protocolVersion: number;
  projectId: string;
  clientId: string;
  windowId: string;
  role: WindowRole;
  messageId: string;
  baseRevision?: number;
  sentAt: number;
  type: string;
  payload: T;
}
```

### 15.2 核心消息

| 消息 | 方向 | 用途 |
| --- | --- | --- |
| HELLO | 窗口到工作线程 | 建立连接，声明角色、版本和已知 revision。 |
| SNAPSHOT | 工作线程到窗口 | 发送完整项目快照。 |
| ACTION | 窗口到工作线程 | 提交正式语义动作。 |
| PATCH | 工作线程到所有窗口 | 发送 revision 对应的数据补丁。 |
| DRAG_BEGIN | 窗口到工作线程 | 申请编辑租约。 |
| DRAG_SAMPLE | 窗口到工作线程 | 提交高频拖动目标。 |
| POSE_PREVIEW | 工作线程到窗口 | 广播临时求解结果。 |
| DRAG_COMMIT | 窗口到工作线程 | 提交最终姿势。 |
| LEASE_GRANTED | 工作线程到窗口 | 返回租约 token。 |
| LEASE_DENIED | 工作线程到窗口 | 目标正在被其他窗口编辑。 |
| PRESENCE | 双向 | 窗口角色、可见状态、心跳和当前操作。 |
| PERSISTED | 工作线程到窗口 | 报告已写入 IndexedDB 的 revision。 |
| ERROR | 工作线程到窗口 | 结构化错误码、消息和可恢复建议。 |

### 15.3 Action 类型

```text
project/create
project/rename
pose/applyPreset
pose/resetToBind
pose/setRootTransform
pose/setJointRotation
pose/solveTarget
pin/set
pin/clearAll
physics/updateSettings
surface/selectAsset
selection/set
history/undo
history/redo
asset/import
project/migrate
```

### 15.4 示例拖动提交

```json
{
  "protocolVersion": 1,
  "projectId": "project_01",
  "clientId": "browser_a8f2",
  "windowId": "main_7c19",
  "role": "main",
  "messageId": "msg_1042",
  "baseRevision": 42,
  "sentAt": 1787028000123,
  "type": "DRAG_COMMIT",
  "payload": {
    "leaseToken": "lease_leftHand_01",
    "target": { "kind": "joint", "jointId": "leftHand" },
    "pose": { "name": "CUSTOM", "localRotations": {} }
  }
}
```

## 16. 性能、兼容与安全

### 16.1 性能目标

| 场景 | 目标 |
| --- | --- |
| 骨架加基础表皮，单三维窗口 | 1080p 下目标 60 FPS。 |
| 精细表皮，单三维窗口 | 常规编辑目标 60 FPS，低性能设备允许 30 FPS。 |
| 两个三维窗口 | 主窗口保持交互优先，预览窗口可降低像素比和刷新率。 |
| 数据窗口同步 | 同机动作到界面更新中位数小于 50 ms。 |
| 项目打开 | 本地项目骨架与基础表皮在 1 秒内可操作。 |

### 16.2 浏览器与运行环境

1. 开发阶段以 Windows Chrome 和 Edge 为首要实机环境。
2. 本地开发使用 Vite HTTP 服务器。
3. 正式部署必须使用 HTTPS。
4. 同一项目的所有窗口必须来自同一 origin。
5. WebGPU 不可用时使用 WebGL 2，功能保持一致，部分特效可以降级。
6. 直接 file 协议打开时显示明确阻断页面和启动说明。

### 16.3 安全边界

1. 导入 JSON 先做大小限制、schema 校验、循环层级检查和数值有效性检查。
2. 导入 GLB 检查文件大小、拓扑数量、外部 URI、材质、动画和骨架映射。
3. 默认不执行 GLB 或 JSON 中的任意脚本。
4. 对象 URL 使用后及时释放。
5. Content Security Policy 限制脚本和资源来源。
6. 用户项目和本地资产默认只保存在本机浏览器，云端同步需要明确开启。

### 16.4 许可管理

当前示例人体表面记录为 CC BY 4.0，并需要保留归属说明。完整 SMPL 参数模型、训练权重、关节回归器和正式姿势修正数据具有单独许可要求。新项目的资产表必须保存 license、attribution、source、hash 和 allowedUses。

## 17. 测试体系与发布验收

### 17.1 测试层级

| 层级 | 内容 |
| --- | --- |
| 单元测试 | 骨架映射、四元数、世界矩阵、骨长、关节限制、迁移和 schema。 |
| 求解测试 | 拖动手、脚、头、骨盆、骨段；固定点；不可达目标；抖动和误差。 |
| 同步测试 | 两个以上窗口连接、重连、租约冲突、revision、撤销重做、持久化。 |
| 资产测试 | 预绑定 GLB 属性、骨骼映射、权重归一化、包围盒、许可和哈希。 |
| 浏览器测试 | 表皮出现、显示开关、鼠标拾取、拖动、窗口同步和错误回退。 |
| 人工实机测试 | Windows Chrome、Edge，WebGPU 和 WebGL 2 各一次。 |

### 17.2 多窗口自动化场景

1. 打开主窗口和数据窗口，确认 revision 相同。
2. 在主窗口拖动左手，数据窗口在 50 ms 目标内更新姿势值。
3. 数据窗口应用 T 姿势，主窗口同步更新人物。
4. 两个窗口同时拖动同一只手，第二个窗口获得租约拒绝提示。
5. 主窗口拖动过程中刷新，租约超时释放，其他窗口继续编辑。
6. 关闭所有窗口后重新打开，恢复最后持久化 revision。
7. 断开 SharedWorker 连接后自动重连并补齐补丁。

### 17.3 表皮画面自动化

Playwright 在页面加载后等待 surfaceState 至少到达 proxyReady，然后截图视口。测试可以通过颜色分割、对象包围盒投影或渲染像素统计确认人物表面面积。仅检查 DOM 中存在“表皮已加载”文字没有足够证明力。

### 17.4 发布门槛

| 检查项 | 必须结果 |
| --- | --- |
| 基础人体表皮 | 主窗口首次加载可见。 |
| 精细表皮 | 预绑定 GLB 成功加载或明确显示回退状态。 |
| 三种显示模式 | 表皮、骨架、同时均正确。 |
| 固定骨长 | 最大误差达到标准。 |
| 关节限制 | 肘膝不会反折，肩髋不越界。 |
| 多窗口 | 项目 revision、姿势和历史一致。 |
| 导入导出 | 完整往返后结构和姿势一致。 |
| 浏览器 | Chrome 与 Edge 真实画面确认。 |
| 许可与清单 | 第三方资产归属、哈希和版本完整。 |

## 18. 开发阶段与任务计划

| 阶段 | 主要任务 | 完成标准 |
| --- | --- | --- |
| 阶段 0  建立新仓库 | Vite、TypeScript、目录、CI、文档、版本规则。 | 空项目可启动，测试与构建流水线通过。 |
| 阶段 1  数据核心 | ProjectDocument、BindRig、PoseState、迁移和 IndexedDB。 | 新建、保存、恢复、导入、导出通过。 |
| 阶段 2  多窗口同步 | SharedWorker、消息协议、revision、活动窗口、BroadcastChannel 回退。 | 两个数据窗口可稳定共享同一项目。 |
| 阶段 3  骨架与求解 | SMPL 24、局部旋转、IK、关节框架、固定骨长、刚性骨盆。 | 拖动关节符合人体逻辑，误差达标。 |
| 阶段 4  三维与唯一表皮 | WebGPU、骨架层、精细人体层、直接拾取和三种显示模式。 | 真实浏览器中只有一套人体表面。 |
| 阶段 5  生产蒙皮 | 预绑定 GLB、正式权重、姿势修正、材质和错误诊断。 | 精细人物在极端姿势下稳定变形。 |
| 阶段 6  完整多窗口 UI | 主窗口、数据、层级、表皮、诊断和预览窗口。 | 跨窗口选择、姿势、历史和设置符合状态矩阵。 |
| 阶段 7  发布与在线化 | 静态 HTTPS、Service Worker、GitHub Release、可选云端适配器。 | 新版本可重复部署、缓存和回滚。 |

### 18.1 首个开发迭代的顺序

1. 先建立 TypeScript 数据核心和 SharedWorker，不先搬运当前完整 UI。
2. 用一个极简页面验证两个窗口共享一个计数器、选择关节和姿势 revision。
3. 接入 SMPL 24 BindRig，并以局部四元数生成世界矩阵。
4. 加入骨架 Three.js 视图和固定骨长 IK。
5. 加入唯一精细人物网格、直接表面拾取和浏览器截图测试。
6. 最后迁移当前 V8.3 的完整界面和数据表。

## 19. 风险登记与应对

| 风险 | 影响 | 应对 |
| --- | --- | --- |
| 表皮再次不可见 | 核心体验失败。 | 基础表皮与骨架同场景同步创建；预绑定 GLB；像素级浏览器测试；状态与错误直接显示。 |
| 多窗口数据覆盖 | 姿势丢失或历史分叉。 | SharedWorker 单一权威；revision；语义 Action；租约；快照和事件日志。 |
| 求解器抖动 | 人物难以控制。 | 局部旋转约束；阻尼；目标平滑；固定迭代；数值测试。 |
| 肩髋变形差 | 人物看起来不真实。 | 预绑定权重；twist 辅助骨；姿势修正接口；限制极端姿势。 |
| WebGPU 差异 | 部分设备黑屏或材质异常。 | WebGL 2 回退；稳定标准材质；双后端实机测试。 |
| 多窗口 GPU 占用高 | 显存和性能下降。 | 只有需要的窗口创建渲染器；预览降像素比；限制同时三维窗口数量。 |
| 旧数据不兼容 | 导入失败或比例被覆盖。 | 明确 migration；旧文件备份；绑定数据保护；迁移报告。 |
| 资产许可不清 | 无法发布或复用。 | 资产表记录许可和归属；生产表皮使用许可明确的预绑定资产。 |
| 依赖升级破坏 | Three.js API 变化。 | 锁定版本；升级分支；回归截图；Release 可回滚。 |

## 20. 架构决策记录

| 决策编号 | 结论 | 理由 |
| --- | --- | --- |
| ADR 001 | WebGPU 优先，WebGL 2 回退。 | 满足新技术路线，并保留广泛运行能力。 |
| ADR 002 | SharedWorker 保存权威项目状态。 | 同源多窗口需要单一事务中心。 |
| ADR 003 | 姿势以局部四元数保存。 | 固定骨长、人体关节轴和蒙皮都需要稳定旋转数据。 |
| ADR 004 | 绑定尺寸只读。 | 姿势编辑不能改变人物比例。 |
| ADR 005 | 基础表皮同步创建。 | 人物必须在精细资产加载前可见。 |
| ADR 006 | 精细表皮采用预绑定 GLB。 | 运行时自动生成权重难以保证肩髋与实机稳定性。 |
| ADR 007 | 显示设置默认窗口本地。 | 多个窗口可以承担不同观察任务。 |
| ADR 008 | 拖动预览与正式提交分离。 | 降低消息和历史体积，保持撤销语义清晰。 |
| ADR 009 | IndexedDB 保存快照和事件。 | 支持恢复、迁移、审计和未来云同步。 |
| ADR 010 | 真实浏览器画面进入 CI 与人工发布门槛。 | V8 与 V8.1 的实机反馈证明算法测试需要配合浏览器画面验收。 |

## 21. 新项目启动清单

1. 创建 GitHub 新仓库并写入本说明书。
2. 初始化 Vite、TypeScript、React 和 npm 或 pnpm 锁文件。
3. 建立 packages/schema、rig-core、solver、sync、storage、renderer、surface。
4. 先实现 SharedWorker HELLO、SNAPSHOT、ACTION、PATCH。
5. 建立 IndexedDB projects、snapshots、events、assets 和 windowSettings。
6. 把 V8.3 的 SMPL 24 映射和比例数据迁移为 TypeScript 常量。
7. 把权威姿势改为根变换与局部四元数。
8. 实现关节世界矩阵和固定骨长测试。
9. 实现两个窗口同步选择和 A、T 姿势。
10. 实现 Three.js 骨架视图。
11. 实现基础人体表皮并在真实浏览器截图中确认。
12. 准备一具许可明确、已经绑定的精细 GLB。
13. 实现表皮、骨架、同时三种显示模式。
14. 实现全身 IK、人体活动范围和租约式拖动。
15. 迁移完整 UI、数据表、诊断与导入导出。
16. 完成 Chrome、Edge、WebGPU、WebGL 2 和多窗口发布验收。

## 附录 A  当前 V8.3 文件清单与职责

| 文件 | 职责分类 | 大小 |
| --- | --- | --- |
| BUILD_MANIFEST.txt | 文档与清单 | 1,707 B |
| README.md | 文档与清单 | 4,791 B |
| RUN_EDITOR.bat | 启动与本地服务器 | 44 B |
| THIRD_PARTY_NOTICES.md | 文档与清单 | 695 B |
| VALIDATION.md | 文档与清单 | 1,973 B |
| assets/smpl/ATTRIBUTION.md | 人物资产与许可 | 1,009 B |
| assets/smpl/smpl-male-surface.glb | 人物资产与许可 | 1,435,300 B |
| index.html | 网页界面 | 22,727 B |
| install-three-runtime.ps1 | 启动与本地服务器 | 1,673 B |
| package.json | 依赖与脚本 | 693 B |
| sample-standard-humanoid-a.json | 示例数据 | 29,935 B |
| server-windows.ps1 | 启动与本地服务器 | 3,372 B |
| server.mjs | 启动与本地服务器 | 2,481 B |
| src/biomechanics.js | 核心源代码 | 29,080 B |
| src/glb-geometry.js | 核心源代码 | 6,925 B |
| src/main.js | 核心源代码 | 57,044 B |
| src/physics-rig.js | 核心源代码 | 36,216 B |
| src/skeleton-model.js | 核心源代码 | 11,945 B |
| src/skeleton-presets.js | 核心源代码 | 22,460 B |
| src/smpl-skin.js | 核心源代码 | 43,541 B |
| src/svg-view.js | 核心源代码 | 16,272 B |
| src/three-view.js | 核心源代码 | 32,775 B |
| start-without-install.bat | 启动与本地服务器 | 44 B |
| start.bat | 启动与本地服务器 | 44 B |
| styles.css | 网页界面 | 40,232 B |
| tests/glb-asset.mjs | 自动测试 | 2,440 B |
| tests/physics-rig.mjs | 自动测试 | 10,109 B |
| tests/static-check.mjs | 自动测试 | 8,845 B |
| tests/surface-cpu.mjs | 自动测试 | 2,237 B |
| tests/surface-layer-integration.mjs | 自动测试 | 8,273 B |
| tests/validate-data.mjs | 自动测试 | 6,124 B |
| vendor/README.txt | 文档与清单 | 534 B |
| 只打开二维模式.bat | 启动与本地服务器 | 546 B |
| 安装本地三维库并打开.bat | 启动与本地服务器 | 1,703 B |
| 打开前请看.txt | 文档与清单 | 718 B |
| 打开编辑器.bat | 启动与本地服务器 | 1,127 B |

## 附录 B  28 个编辑器节点映射

| ID | 名称 | 父级 | 标准映射 | 类型 | 显示骨杆 | 固定长度 m |
| --- | --- | --- | --- | --- | --- | --- |
| root | 全身根控制 | 无 |  global_control | control | 否 | 0.000000 |
| hips | 骨盆中心 | root | 0 pelvis | pelvis | 否 | 0.000000 |
| spine | 腰椎 | hips | 3 spine1 | spine | 是 | 0.120104 |
| chest | 胸椎 | spine | 6 spine2 | spine | 是 | 0.135237 |
| upperChest | 上胸 | chest | 9 spine3 | spine | 是 | 0.145169 |
| neck | 颈根 | upperChest | 12 neck | neck | 是 | 0.155081 |
| head | 头部中心 | neck | 15 head | neck | 是 | 0.142215 |
| headTop | 头顶辅助点 | head |  head_top_helper | endpoint | 是 | 0.165974 |
| leftShoulder | 左锁骨 | upperChest | 13 left_collar | clavicle | 是 | 0.114018 |
| leftUpperArm | 左肩关节 | leftShoulder | 16 left_shoulder | ball | 是 | 0.134722 |
| leftLowerArm | 左肘 | leftUpperArm | 18 left_elbow | hinge | 是 | 0.272993 |
| leftHand | 左腕 | leftLowerArm | 20 left_wrist | wrist | 是 | 0.237908 |
| leftHandEnd | 左手中心 | leftHand | 22 left_hand | endpoint | 是 | 0.069599 |
| rightShoulder | 右锁骨 | upperChest | 14 right_collar | clavicle | 是 | 0.114018 |
| rightUpperArm | 右肩关节 | rightShoulder | 17 right_shoulder | ball | 是 | 0.134722 |
| rightLowerArm | 右肘 | rightUpperArm | 19 right_elbow | hinge | 是 | 0.272993 |
| rightHand | 右腕 | rightLowerArm | 21 right_wrist | wrist | 是 | 0.237908 |
| rightHandEnd | 右手中心 | rightHand | 23 right_hand | endpoint | 是 | 0.069599 |
| leftUpperLeg | 左髋关节 | hips | 1 left_hip | ball | 否 | 0.096047 |
| leftLowerLeg | 左膝 | leftUpperLeg | 4 left_knee | hinge | 是 | 0.420088 |
| leftFoot | 左踝 | leftLowerLeg | 7 left_ankle | ankle | 是 | 0.420040 |
| leftToes | 左前脚掌 | leftFoot | 10 left_foot | toe | 是 | 0.150416 |
| leftToesEnd | 左脚趾末端 | leftToes |  left_toe_tip_helper | endpoint | 是 | 0.060828 |
| rightUpperLeg | 右髋关节 | hips | 2 right_hip | ball | 否 | 0.096047 |
| rightLowerLeg | 右膝 | rightUpperLeg | 5 right_knee | hinge | 是 | 0.420088 |
| rightFoot | 右踝 | rightLowerLeg | 8 right_ankle | ankle | 是 | 0.420040 |
| rightToes | 右前脚掌 | rightFoot | 11 right_foot | toe | 是 | 0.150416 |
| rightToesEnd | 右脚趾末端 | rightToes |  right_toe_tip_helper | endpoint | 是 | 0.060828 |

## 附录 C  多窗口状态矩阵

| 状态 | 归属 | 持久化 | 说明 |
| --- | --- | --- | --- |
| Project metadata | 共享 | 持久化 | 项目名称、版本、更新时间。 |
| BindRig | 共享只读 | 持久化 | 绑定尺寸和拓扑。 |
| PoseState | 共享 | 持久化 | 根变换、局部旋转、固定点。 |
| PhysicsSettings | 共享 | 持久化 | 所有窗口使用同一求解配置。 |
| ActiveSelection | 共享 | 可持久化为可选 | 检查器同步。 |
| Hover | 本地 | 否 | 每个窗口指针独立。 |
| Camera | 本地 | 按窗口持久化 | 观察角度独立。 |
| DisplayMode | 本地 | 按窗口持久化 | 表皮、骨架、同时。 |
| PanelLayout | 本地 | 按窗口持久化 | 宽度与折叠状态。 |
| DragLease | 共享临时 | 否 | 防止冲突。 |
| PosePreview | 共享临时 | 否 | 拖动实时预览。 |
| UndoHistory | 共享 | 事件化持久化 | 全局语义历史。 |
| Diagnostics | 本地加共享摘要 | 可选 | 错误和性能。 |

## 附录 D  当前资料依据

| 资料 | 用途 |
| --- | --- |
| 当前对话中的功能要求与实机截图 | 确定用户目标、交互方式和表皮实际问题。 |
| V8.3 README.md | 记录现有功能、显示模式、启动与诊断接口。 |
| V8.3 BUILD_MANIFEST.txt | 记录版本、资产数量、GLB 数据和测试结论。 |
| V8.3 VALIDATION.md | 记录自动测试覆盖和浏览器截图边界。 |
| sample-standard-humanoid-a.json | 记录 28 节点、SMPL 24 映射、比例、活动范围和物理参数。 |
| src/skeleton-presets.js 与 skeleton-model.js | 记录绑定骨架、姿势和数据导入导出逻辑。 |
| src/biomechanics.js 与 physics-rig.js | 记录人体约束和全身物理实现。 |
| src/three-view.js 与 smpl-skin.js | 记录 WebGPU、骨架、表皮、拾取和 CPU 蒙皮。 |
| src/main.js 与 index.html | 记录完整界面、控制、数据表、显示模式和诊断。 |

## 附录 E  完成定义

当以下条件全部满足时，新项目可以认为完成首个可用版本。

1. 打开项目后无需导入数据即可看到标准人物。
2. 表皮、骨架、同时三种模式全部可用。
3. 拖动人体任意主要部位可以带动全身，并保持真实关节逻辑。
4. 人物原始尺寸在姿势编辑中不会改变。
5. 两个以上窗口实时共享同一姿势和历史。
6. 刷新、关闭、重开后项目恢复一致。
7. JSON 导入导出往返无数据丢失。
8. 精细表皮加载失败时仍有基础人体可见。
9. Chrome 和 Edge 实机画面、交互与同步验收通过。
10. 源码、依赖、数据、文档和资产许可全部进入版本管理。
