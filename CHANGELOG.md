# Changelog

## Unreleased · Character Studio v1 integration · 2026-08-21

- 合并 `feature/character-studio-shell`、`feature/character-studio-panels` 和 `feature/character-studio-state`，形成 Character Studio v1。
- `character-studio.html` 提供左侧九面板、中间唯一 simulationRig 人物视口、右侧 Character 状态与版本的三栏工作台。
- Shell、Panels 和 Session 复用同一个 ProjectHubClient；面板正式修改只通过模块接口和 Character Core 引用进入 ProjectState。
- 新增 Character Studio session/store，统一创建、加载、保存、历史恢复、导出和状态订阅。
- Character 加载和恢复进入 CharacterState revision、OperationEvent、integration ModulePatch 和 ProjectState revision 正式链路。
- 新增 IndexedDB 项目快照、事件和资源索引，资源二进制优先进入 OPFS，普通消息拒绝 Blob、ArrayBuffer 和内联 base64。
- 新增 `humanoid_rig/character_profile_export@1.0`，包含 schema、版本、模块引用和资源摘要。
- 新增四窗口 Character 同步、刷新恢复和现有模块隔离测试。
- 动画逐帧采样与时间轴预览保持临时态，不创建高频 revision；普通 JSON 消息继续拒绝二进制和内联 base64。
- V8 表皮运行时在唯一原生 `SkinnedMesh` 上追加 67 关节变形调色板，并保留源 GLB 的 24 关节绑定兼容性。
- 正式显示路径增加肩、肘、髋、膝八区稀疏姿势修正，在 GPU 线性蒙皮输入端补偿关节弯曲时的体积损失。
- CPU 双四元数蒙皮作为质量参考接入回归测试，不替换 WebGPU/WebGL2 的正式渲染路径。
- 增加姿势修正零激活、区域隔离、肩部体积保持、极端 T/Step 姿势和 DQS/LBS 有界差异测试。

## 0.5.0 four-module V002 integration · 2026-08-19

### 四模块交付

- 合入骨骼比例 V002，增加 28 节点角色分类、绑定轴审计、辅助标记和追加式骨架升级蓝图。
- 合入人物蒙皮 V002，默认使用原生 `JOINTS_0`、`WEIGHTS_0`、24 组逆绑定矩阵和单一 `SkinnedMesh` 的预绑定 GLB。
- 合入动作与物理 V002，增加单张图片动作识别、深度修正、固定骨长重定向、标准 PoseSnapshot 和浏览器动作库。
- 合入动画系统 V002 Complete，增加局部四元数轨道、动画层、状态机、事件、接触、根运动、脚底锁定、重定向、烘焙和标准骨架动画 GLB 导出。
- 归档四个模块的 `HANDOFF.md`、边界文件、修改清单和测试记录。

### 共享整合

- 新增构建 ID `four-module-v002-20260819` 和机器可读 `BUILD_MANIFEST.json`。
- Windows 启动器新增构建身份核验，避免复用同端口上的历史项目目录。
- V8.4 三维视口优先读取 `humanoid_rig/pose_snapshot@1.0` 局部四元数协议，旧世界坐标载荷保留为兼容回退。
- 新增 `humanoid_rig/transient_bus@1.0`，用于动画播放锚点和时间轴预览，不增加 ProjectState revision。
- 默认 ProjectState 自动迁移到今日四模块版本和最低 moduleRevision。
- 默认蒙皮资产切换到 `smpl-male-surface-skinned.glb`，并连接绑定元数据与单表皮运行时标识。

### 验证

- 新增四模块联合测试，检查状态迁移、PoseSnapshot 到 PhysicsRig、原生蒙皮哈希、临时消息和构建身份。
- 动画专项测试扩展为七套，覆盖资产、模型、编辑、运行时、性能、烘焙和工作台契约。
- 全套 `npm test` 通过，53 个必需文件检查通过。
- 本地 HTTP 冒烟检查覆盖首页、四模块工作台、V8.4、预绑定 GLB、动画资产、图片姿势代码和蒙皮验证页，全部返回 HTTP 200。

### 当前边界

- 过渡性蒙皮权重仍需专业许可权重与姿势修正形变。
- MediaPipe 模型来源、再分发条款与图片处理隐私说明仍需发布审查。
- 全身物理外部 `simulationRig` 接口和最终 SkinnedMesh 加动画 GLB 合并导出仍待跨模块联调。
- Windows Chrome 或 Edge 的 WebGPU 可见画面与交互验收仍需人工完成。

## 0.5.0 collaboration completion

- Finished the primary three-dimensional proportion workspace and exact BodyProfile preview.
- Separated all four module source directories and module revisions.
- Added four-chat ownership rules, startup prompts and handoff templates.
- Added GitHub branch preparation for integration and four work branches.
- Added manual GitHub review and Pull Request workflow.
- Added module starter kits for work without Codex.


## 0.4.0 · 2026-08-18

- 删除程序化人体、隐藏选择人体和黄色表面代理。
- 精细 SMPL 网格同时承担显示、Raycaster 拾取和姿势变形。
- 点击人物三角形后通过顶点权重解析主导关节。
- A 绑定姿势直接恢复原始顶点和法线。
- 蒙皮变形改为人体区域隔离的四关节双四元数方法。
- 增加三角形邻接权重平滑、A 姿势手部下肢候选保护和 T 姿势网格拉伸质量门槛。
- 骨架重新拟合当前示例人体的肩、腕、髋、膝、踝和足部。
- ProjectState 升级为 schemaVersion 4。
- 骨架 JSON 升级为 schemaVersion 5。
- 旧 auto、base 和 fallbackAsset 表皮数据自动迁移到唯一精细表皮。
- 内置编辑器升级到 V8.3。

## 0.3.0 · 2026-08-18

### 统一人物视口

- 将 V8.2 实际三维人物视口嵌入比例、蒙皮、动作、动画和综合预览工作台。
- 轻量 Canvas 人偶改为故障回退，不再作为模块默认视觉结果。
- 比例、蒙皮、动画和综合预览使用只读人物视口。
- 动作与物理工作台可以直接拖动表皮、关节或骨杆。
- 增加母平台与 V8.2 的同源消息桥接。
- 增加 V8 姿势载荷跨窗口同步。

### 单层表皮

- 精细表皮接管后，将基础程序化人体 Group 从 Three.js 渲染场景移除。
- 基础人体继续作为脱离场景的 Raycaster 拾取代理。
- 不再依赖 `colorWrite`、透明度或深度写入隐藏基础人体。
- 增加 `attachedToScene` 诊断字段。
- 增加渲染场景级来源互斥测试。
- 修复 WebGPU 实机中黄色头部、颈部和肢体仍可能残留的问题。

### 数据与协作

- ProjectState 升级为 schemaVersion 3。
- PoseSnapshot 增加 `v8Payload`，保存完整三维姿势数据。
- 模块包和集成快照使用 schemaVersion 3。
- 保留 schemaVersion 1 和 2 项目迁移。

### 验证

- 增加统一 iframe 视口桥接静态测试。
- 增加脱离场景的隐藏拾取代理测试。
- 增加 V8 姿势载荷模块 Patch 合并测试。

## 0.2.0 · 2026-08-18

### 人物表皮

- 修复基础程序化表皮与精细 SMPL 表皮同时显示的问题。
- 建立单一可见表皮规则，任意时刻最多显示一层人体表面。
- 默认采用自动精细优先模式，精细表皮完成后自动隐藏基础表皮。
- 基础表皮在隐藏后保留为不可见拾取壳，继续支持直接触碰身体部位。
- 增加自动、精细 SMPL、基础程序化三种表皮来源选择。
- 增加 `singleVisibleSurface`、`activeSource` 与来源诊断信息。
- 将内置三维实验编辑器升级为 V8.1。

### 四模块协作

- 将比例、蒙皮、动作、动画和综合预览拆分到独立模块目录。
- 将 ProjectState 升级为 schemaVersion 2。
- 为五个模块建立独立 `moduleRevision` 与 `moduleUpdatedAt`。
- 使用模块级 Patch 代替四窗口整份状态互相覆盖。
- 支持多个模块在接近同时修改时合并各自数据。
- 增加过期 Patch 拒绝和旧 schemaVersion 1 项目迁移。
- 增加模块更新包导入与导出。
- 蒙皮工作台增加表皮来源、显示模式、透明度和重建状态控制。
- 动作工作台增加全身联动、阻尼、固定脚与人体限制共享参数。
- 动画工作台增加将当前动作保存为关键帧草案。

### 验证

- 增加模块并发 Patch 自动测试。
- 增加 V8.1 单一表皮集成测试。
- 增加基础表皮隐藏后仍可拾取的测试。
- 完成首页、SharedWorker 和 GLB 本地 HTTP 路由及 MIME 类型检查。

## 0.1.1

- 修复 `start.bat` 依赖中文文件名造成的 Windows 启动失败。
- 新增纯 ASCII 启动入口 `START_HERE.cmd`。
- 新增 `launcher.ps1`，自动选择 Node.js 或 Windows PowerShell 服务器。
- 新增无 Node.js 启动回退、端口检测、启动日志和诊断文件。

## 0.1.0 · 2026-08-18

- 建立统一项目总控网站。
- 建立骨骼比例、人物蒙皮、动作与物理、动画系统四个工作台。
- 建立综合人物预览和 V8 实验编辑器入口。
- 建立 SharedWorker、BroadcastChannel 与本地持久化协作链路。
- 建立模块状态、版本、测试、阻塞和审查记录。
- 建立项目 JSON、模块 JSON 与 ReviewBundle 导出。
- 建立 GitHub Actions 验证和 GitHub Pages 发布工作流。
- 建立 Windows 本地启动、测试与 GitHub 同步脚本。
