# Humanoid Rig Lab V8.5 全表现骨架与人体约束视口

V8.5 是 Humanoid Rig Lab Next V0.5.0 的统一三维人物视口。它使用 Three.js、WebGPU 优先渲染、追加式 89 节点骨架、固定骨长、人体活动范围和 BodyProfile 三维重建器。

## 骨架层级

```text
核心 28       原 SMPL 24 兼容层、全局根与测量端点
身体制作 56   +8 扭转、+12 控制、+6 接触、+2 肩胛校正
完整表现 89   +30 VRM 手指、+双眼、+下颌
```

显示选项可在三层之间切换。颜色和形状区分左右变形骨、扭转、控制器、接触标记和校正节点。完整架构见 `../../docs/PERFORMANCE_RIG_ARCHITECTURE.md`。

原 28 个节点的 ID、顺序、父子关系和 SMPL 索引保持不变。当前表皮继续使用 24 骨调色板；新增节点的精细表皮形变需要后续重新绑定权重。

## 主机通信

母平台发送：

```text
HRL_HOST_STATE
HRL_PREVIEW_BODY_PROFILE
HRL_ANIMATION_FRAME
```

V8.5 返回：

```text
HRL_EMBED_READY
HRL_RENDERER_STATUS
HRL_PROFILE_STATUS
HRL_SURFACE_STATUS
HRL_POSE_COMMIT
HRL_HOST_ACK
```

## 比例与表皮

八项 BodyProfile 参数从不可变参考绑定重新生成骨架。自定义比例会标记 `requiresSkinRebind: true`。场景使用唯一预绑定 SMPL 人体网格；源资产保持 24 关节绑定，运行时追加为 67 关节调色板，并在 GPU 线性蒙皮输入端应用肩、肘、髋、膝稀疏姿势修正。CPU DQS 仅作为质量参考；正式生产仍需要与目标骨架匹配的专业 SkinBinding 和雕刻级姿势修正形变。

## 启动

建议从母项目根目录运行 `start.bat`，也可以在本目录运行 `打开编辑器.bat`。浏览器地址通常为：

```text
http://127.0.0.1:4173/?build=v8.5-performance-rig
```

旧版本曾经打开过时，请按一次 `Ctrl + F5`。

本地状态键：

```text
humanoid-skeleton-editor:v8.5-performance-rig
```

V8.4 及更早的状态键保留在迁移列表中。

## 测试

```text
npm test
```

测试覆盖 89 节点角色和拓扑、89 项绑定轴、VRM 手指、重定向链、BodyProfile、固定骨长、刚性骨盆、人体关节范围、图片姿势、GLB、蒙皮、主机通信和视觉分层代码。
