# 四个执行对话的开场指令

新开四个 ChatGPT 对话后，分别上传对应模块工作包，并发送下面的指令。

## 骨骼比例对话

```text
你负责 Humanoid Rig Lab Next 的骨骼比例板块。只修改工作包中标记为可写的比例文件。共享协议和其他模块保持只读。先阅读 MODULE_TASK.md、MODULE_BOUNDARIES.md 和 DATA_CONTRACTS.md，然后检查现有实现。当前目标是验证八项比例参数真正驱动三维绑定骨架，维持固定骨骼 ID、左右镜像和隐藏锁骨控制点。完成后输出 proportion-patch-v001.zip 和 HANDOFF.md，列出修改文件、测试结果、兼容骨架版本和已知问题。
```

## 人物蒙皮对话

```text
你负责 Humanoid Rig Lab Next 的人物蒙皮板块。只修改工作包中标记为可写的蒙皮文件。骨骼层级、骨骼 ID 和绑定骨长保持只读。先审查当前静态人体与实验权重流程，重点设计预绑定 GLB、原生 skinIndex、skinWeight、inverseBindMatrices 和单一 SkinnedMesh 管线。完成后输出 skin-patch-v001.zip 和 HANDOFF.md，列出资产许可、兼容 rigVersion、测试结果和变形缺陷。
```

## 动作与物理对话

```text
你负责 Humanoid Rig Lab Next 的动作与物理板块。只修改工作包中标记为可写的动作文件。动作不得修改绑定尺寸。先检查固定骨长、刚性骨盆、脚部固定、人体活动范围和全身联动。将姿势输出整理为局部四元数、IK 目标、固定点和约束数据。完成后输出 pose-patch-v001.zip 和 HANDOFF.md，列出测试姿势、兼容 rigVersion 和已知问题。
```

## 动画系统对话

```text
你负责 Humanoid Rig Lab Next 的动画系统板块。只修改工作包中标记为可写的动画文件。骨骼比例和蒙皮权重保持只读。建立时间轴、关键帧、插值、循环、动画片段和 PoseSnapshot 引用协议。动画轨道使用稳定骨骼 ID 和局部四元数。完成后输出 animation-patch-v001.zip 和 HANDOFF.md，列出修改文件、测试片段、兼容 rigVersion 和阻塞问题。
```

## 交回总控对话

四个执行对话完成后，把补丁 ZIP 和 HANDOFF.md 上传到总控对话。总控对话负责：

```text
检查越界修改
合并共享协议
运行完整测试
更新 integration
生成完整版本包
维护 CHANGELOG 和验证记录
```
