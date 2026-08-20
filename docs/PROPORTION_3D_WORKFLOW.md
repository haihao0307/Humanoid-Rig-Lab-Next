# V0.5.0 三维骨骼比例工作流

## 数据流

```text
比例滑块 input
    ↓
HRL_PREVIEW_BODY_PROFILE
    ↓
V8.4 BodyProfile 重建器
    ↓
新的三维 RigDefinition 与 PhysicsRig
    ↓
HRL_PROFILE_STATUS
    ↓
母平台显示实际测量值
    ↓
滑块 change
    ↓
Proportion ModulePatch
    ↓
SharedWorker 同步其他窗口
```

## 重要规则

1. 预览阶段不写入项目 revision。
2. 松开滑块后才正式提交共享状态。
3. 每次重建都从参考绑定骨架开始，避免连续缩放累积误差。
4. 动作姿势与绑定尺寸分开保存。
5. 自定义 BodyProfile 标记 `requiresRebind=true`。
6. 锁骨控制点隐藏，每侧只显示一个肩关节球。
7. 2D Canvas 只用于三维运行失败的后备提示。

## 验收指标

实际三维测量值需要与目标值在 `0.000001 m` 以内一致：

```text
height
shoulderWidth
hipWidth
upperArmLength
forearmLength
handControlLength
thighLength
lowerLegLength
```
