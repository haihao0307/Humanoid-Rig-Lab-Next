# Humanoid Rig Lab V8.4 三维比例与人体约束视口

V8.4 是 Humanoid Rig Lab Next V0.5.0 的统一三维人物视口。它使用 Three.js、WebGPU 优先渲染、SMPL 24 兼容骨架、固定骨长、人体活动范围和 BodyProfile 三维重建器。

## V8.4 新增能力

母平台可以通过 `postMessage` 发送完整 BodyProfile。V8.4 从不可变参考骨架重新生成绑定骨架，并返回实际三维测量值。

支持的绑定尺寸：

```text
身高
肩关节宽度
髋关节宽度
上臂长度
前臂长度
腕到手部控制点
大腿长度
小腿长度
```

每次重建会重新创建 PhysicsRig，固定骨长和关节限制继续有效。

## 主机通信

母平台发送：

```text
HRL_HOST_STATE
HRL_PREVIEW_BODY_PROFILE
```

V8.4 返回：

```text
HRL_EMBED_READY
HRL_RENDERER_STATUS
HRL_PROFILE_STATUS
HRL_SURFACE_STATUS
HRL_POSE_COMMIT
HRL_HOST_ACK
```

## 锁骨和肩关节

SMPL collar 节点保留为内部锁骨控制点。它们不显示大关节球。`leftUpperArm` 和 `rightUpperArm` 是左右真正肩关节，也是每侧唯一可见肩关节球。

## 比例与表皮

参考 BodyProfile 与当前示例人体表面对应。自定义比例会标记：

```text
requiresSkinRebind: true
```

运行时会使用新的骨骼局部位置实时驱动预绑定表皮，因此比例滑块会同步改变表皮的骨段长度和关节间距；这属于参考权重重定向。正式生产仍需要生成匹配新骨架版本的专业 SkinBinding，并补齐肩髋姿势修正形变。

当前示例表面仍使用运行时实验权重。正式生产建议接入带原生骨架、蒙皮权重和逆绑定矩阵的预绑定 GLB。

## 启动

建议从母项目根目录运行：

```text
start.bat
```

也可以在本目录运行：

```text
打开编辑器.bat
```

浏览器地址通常为：

```text
http://127.0.0.1:4173/?build=v8.4-3d-proportion
```

旧版本曾经打开过时，请按一次 `Ctrl + F5`。

## 本地状态

```text
humanoid-skeleton-editor:v8.4-3d-proportion
```

V8.3 及更早的状态键位于迁移列表中。

## 测试

```text
npm test
```

测试覆盖：

```text
SMPL 24 映射
Rig schema 6
BodyProfile 精确三维测量
八项绑定尺寸重建
锁骨控制点隐藏
固定骨长和刚性骨盆
人体关节范围
GLB 解析与参考表面实验变形
母平台 iframe 通信
Windows 启动器
```
