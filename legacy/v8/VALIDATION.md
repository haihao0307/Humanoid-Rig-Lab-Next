# Humanoid Rig Lab V8.3 验证记录

版本：0.8.3

## 自动测试

```text
npm test
```

通过结果：

```text
V8.3 SMPL 24 mapping, fitted anatomical joints, and fixed segment data validation passed.
V8.3 fixed dimensions, whole-body propagation, and anatomical ROM checks passed.
V8.3 local GLB surface parser, topology, bounds, and checksum validation passed.
V8.3 dual-quaternion deformation, regional weighting, bind-pose protection, and four-influence normalization checks passed.
T-pose mesh quality passed: max displacement 0.6531 m, max edge stretch 5.632x, max shoulder stretch 1.645x.
V8.3 single detailed mesh, direct weighted picking, smoothed regional DQS, and bind-pose protection passed.
V8.3 single detailed surface, anatomical fit, host bridge, direct body picking, launchers, and integration checks passed.
```

## 已验证内容

1. 场景中最多存在一套可渲染人体 Mesh。
2. 程序化人体代理和黄色选择人体不存在。
3. 精细人体网格直接参与 Raycaster 拾取。
4. 三角形顶点权重可以解析主导 SMPL 关节。
5. 选择关节不会改变人体表面材质。
6. A 绑定姿势直接恢复原始顶点与法线。
7. T 姿势使用区域权重、三角形邻接平滑和双四元数变形。
8. 左右手臂和左右腿的候选骨链保持隔离，A 姿势手部不会混入下肢权重。
9. 24 个 SMPL 关节映射完整。
10. 28 个编辑器节点、固定骨长和刚性骨盆正常。
11. 人体关节活动范围测试通过。
12. GLB 包含 27,578 个渲染顶点和 55,152 个三角形。
13. 表皮、骨架和同时显示协议正常。
14. 母平台状态与 V8.3 姿势能够通过同源消息桥接。
15. Windows 启动脚本和本地服务器契约通过。
16. T 姿势最大顶点位移、全身三角边伸长和肩部三角边伸长均通过质量门槛。

## 仍需实机确认

```text
肩部和腋下在 T 姿势下的最终轮廓
腕、膝、踝和足部的视觉对位
WebGPU 下的人体材质和法线表现
长时间拖动后的帧率和 CPU 开销
```
