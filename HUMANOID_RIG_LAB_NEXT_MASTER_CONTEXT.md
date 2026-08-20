# Humanoid Rig Lab Next Master Context

## 文件用途

本文件是 Humanoid Rig Lab Next 人物生产线统一上下文入口。

所有后续人物相关项目启动前，应优先读取本文件。

适用范围：
- 人物骨骼系统
- 人物比例系统
- 人物蒙皮系统
- 动作物理系统
- 动画系统
- 图片驱动人物系统
- 数字人体生成系统
- 人物资产导出系统

更新时间：
2026-08-20

---

# 当前项目状态

项目：
Humanoid Rig Lab Next

仓库：
haihao0307/Humanoid-Rig-Lab-Next

当前发布分支：
publish/source-tree-20260820

当前版本：
0.5.0

当前合并版本：
four-module-v002-20260819

编辑器：
V8.4 / 0.8.4

Three.js：
0.185.1

---

# 总体架构

技术基础：

WebGPU + Three.js + TypeScript

核心目标：

建立从人物比例、骨骼、蒙皮、动作、动画到资产输出的完整人物生产线。

核心共享：

- ProjectState
- Revision
- JSON Schema
- SharedWorker
- IndexedDB
- OPFS
- Three.js Viewport

---

# 四大模块状态

## 骨骼比例 Proportion

版本：
rig@0.4.0

职责：
人物身体比例和绑定骨架生成。

规则：

- 固定骨骼 ID
- 固定父子关系
- 固定骨长
- SMPL 24 映射
- 28 控制节点

核心比例：

1. 人物身高
2. 肩宽
3. 髋宽
4. 上臂长度
5. 前臂长度
6. 腕到手部控制点长度
7. 大腿长度
8. 小腿长度

禁止：
姿势和动画修改绑定比例。

---

## 人物蒙皮 Skin

版本：
skin@0.5.1

当前方案：

单一预绑定 SkinnedMesh。

标准：

- JOINTS_0
- WEIGHTS_0
- inverseBindMatrices
- GLB绑定资产

当前状态：

骨架驱动表皮链路已经建立。

后续重点：

- 专业蒙皮权重
- 肩部修正
- 髋部修正
- 姿势形变

禁止：
出现第二层人体表皮。

---

## 动作物理 Pose

版本：
pose@0.4.0

职责：

- 姿势编辑
- 图片动作复刻
- IK
- 固定点
- 地面碰撞
- 关节限制
- 物理跟随

流程：

图片
→ 关键点
→ 骨架映射
→ PhysicsRig
→ PoseCandidate
→ PoseSnapshot

规则：

姿势只能修改：

- 局部四元数
- 根节点位置
- 根节点旋转
- IK目标

禁止修改：

- 骨骼层级
- 骨长
- 绑定比例

---

## 动画 Animation

版本：
anim@0.4.0

能力：

- AnimationSession
- MotionClip
- AnimationGraph
- 动画层
- 时间轴
- 关键帧
- 根运动
- 脚底锁定
- IK
- 重定向
- GLB动画导出

运行结构：

animationRig：
负责动画采样和混合。

simulationRig：
负责IK、物理、交互和最终显示。

流程：

Animation
→ desiredPose
→ IK
→ Physics
→ finalPose
→ Skin

---

# 图片驱动人物系统

两个方向：

## 图片比例

输入：
人物照片

输出：
ProportionProfile

作用：
生成身体尺寸结构。

## 图片姿势

输入：
动作图片

输出：
PoseSnapshot

作用：
生成动作。

两个系统保持独立。

---

# 数据标准

ProportionProfile：
保存人物比例和绑定版本。

PoseSnapshot：
保存局部四元数、根节点和IK目标。

MotionClip：
保存动画轨道、关键帧和事件。

ProjectState：
保存项目状态、revision和模块状态。

---

# 多窗口原则

状态中心：

SharedWorker

窗口：

- 主编辑
- 比例
- 蒙皮
- 动作
- 动画
- 数据
- 诊断

共享：

- 项目状态
- revision
- 历史
- 保存状态

窗口私有：

- 摄像机
- UI布局
- 面板状态

---

# 不可破坏规则

1. 不允许出现第二层人体表皮。
2. 不允许姿势系统修改骨骼比例。
3. 不允许动画系统修改绑定骨长。
4. 不允许通过缩放骨骼解决比例问题。
5. 所有动作必须引用明确比例版本。
6. 所有姿势使用局部四元数。
7. 最终显示必须经过 simulationRig。
8. 所有模块修改必须版本化。

---

# 后续读取规则

所有人物项目启动：

第一步：
读取本文件。

第二步：
检查：

- 当前版本
- 模块状态
- 数据协议

第三步：
在现有架构基础上扩展。

不要重新设计已经确定的基础系统。
