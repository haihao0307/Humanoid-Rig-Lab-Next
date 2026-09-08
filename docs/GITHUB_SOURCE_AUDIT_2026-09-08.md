# GitHub 与项目源文件核查记录

日期：2026-09-08

## 已读取的项目母本

- Humanoid Rig Lab Next 项目总记录与技术架构说明书母本
- GPT 人物项目总源文件
- GitHub 人物项目同步规则
- World Human System Direction
- JARVIS FULL WORKBENCH BODY V1.16.0 全量包

## GitHub 代码事实

仓库：`haihao0307/Humanoid-Rig-Lab-Next`

核查时 `main`：

- HEAD：`d7bbf9a107a1794f460850d4b368265417d7e24a`
- 根 `BUILD_MANIFEST.json` 将服装标记为 `static-clothing`
- 当前服装运行链为 `asset → profile → reference → attachment → simulationRig → render`
- 当前服装定义仍围绕 `meshRef`、`materialRef`、附件点、缩放、偏移和静态跟随
- 布料模拟字段处于关闭状态

历史服装分支：

- 分支：`feature/clothing-integration-v001`
- HEAD：`e8be7431afbe3be8a42d53928ce09564d274a987`
- 该分支提供静态服装挂接、穿脱、变换、适配值和测试
- 该分支没有形成衣片拓扑、缝合真值、织物本构、程序化表面和二进制编译协议

程序化原创性策略分支：

- 分支：`policy/human-system-procedural-originality-v1`
- HEAD：`174c9dad980764d1e486074b120df3f19fb8bb5f`
- 该策略要求几何和表面由可审计的人体 DNA、派生状态和派生产物生成，并排除外部人体几何及图像贴图依赖

## JARVIS V1.16.0 本地代码事实

- 人体表面以程序化代码和 TypedArray 作为运行载体
- 表面输出包含位置、法线、索引、关节索引和关节权重
- 最终姿势权威来自统一人物求解链
- 手、腕、前臂、上臂和肩部存在冻结区域
- 服装系统不得修改上述人体区域的几何参数、骨长、绑定和表面

## 本轮决策

建立独立 `packages/procedural-clothing/`。旧 `packages/clothing-system/` 作为历史静态挂接模块保留，当前基础提交不覆盖它。

新的服装真值层包括 `GarmentDNA`、`PatternGraph`、`SeamGraph`、`MaterialDNA`、`FitContract`、`GarmentPayload`、`HRLG Binary` 和 `GarmentRuntime`。该层只读人物比例和最终骨骼状态，输出可重建的程序化服装。
