# 89 节点全表现骨架架构

## 目标

V8.5 将原有 28 节点编辑骨架扩展为 `performance89@1`。扩展采用追加式拓扑：原 28 个节点的 ID、顺序、父子关系和 SMPL 0–23 索引保持不变，旧比例参数、旧姿势和当前 24 骨蒙皮继续工作；新增节点负责扭转分配、IK、接触、手指和面部表现。

设计参考：

- [VRM 1.0 Humanoid](https://github.com/vrm-c/vrm-specification/blob/master/specification/VRMC_vrm-1.0/humanoid.md)：采用标准手指、眼睛、下颌命名和父子语义。
- [Unity Avatar Mapping](https://docs.unity.cn/Manual/class-Avatar.html)：区分必需身体映射与可选头部、手部映射。
- [Blender Rigify](https://docs.blender.org/manual/en/latest/addons/rigify/basics.html)：参考 meta-rig、生成式控制层及肢体极向设计。
- [Unreal Engine IK Rig Retargeting](https://dev.epicgames.com/documentation/en-us/unreal-engine/ik-rig-animation-retargeting-in-unreal-engine)：采用按链重定向、IK 目标和可选手指链。
- [Unreal Engine IK Rig Solvers](https://dev.epicgames.com/documentation/unreal-engine/ik-rig-solvers-in-unreal-engine?lang=en-US)：参考 Full Body IK 的目标、限制、刚度和首选弯曲方向。

## 分层拓扑

| 显示层 | 累计节点 | 内容 | 用途 |
| --- | ---: | --- | --- |
| 核心 `core` | 28 | 24 个 SMPL 变形关节、全局根控制、3 个测量端点 | 旧姿势、比例重建、现有蒙皮兼容 |
| 身体制作 `production` | 56 | +8 扭转、+12 制作控制、+6 接触标记、+2 肩胛校正 | 手脚 IK、极向、脚掌滚动、接触和肢体扭转 |
| 完整表现 `performance` | 89 | +30 VRM 手指、+双眼、+下颌 | 抓握、手势、视线、口部和近景表演 |

最终角色统计：

```text
总节点          89
变形关节        65
校正关节         2
控制器          13
标记             9
可见关节        83
可见骨段        64
物理骨段        57
重定向链        18
```

## 身体制作层

### 扭转关节

左右上臂、前臂、大腿和小腿各增加一个中段扭转节点，共 8 个。节点位置由相邻解剖关节实时插值，驱动元数据使用 `swing-twist-distribution`，避免把整段轴向旋转集中在单一关节。

### 控制器与接触

控制层包含重心、左右手脚 IK、肘膝极向、左右脚掌滚动和视线目标。接触层包含左右脚跟、前脚掌和手掌抓握点。控制器不参与蒙皮，接触点作为约束、重定向和地面判断的稳定语义位置。

### 肩胛校正

左右肩胛节点作为派生校正层，跟随上胸、锁骨和上臂关系。它们不改变旧核心拓扑，可供后续专业蒙皮添加肩带修正权重。

## 手指和面部

每只手使用 15 个 VRM 兼容关节：

```text
Thumb:  Metacarpal → Proximal → Distal
Index:  Proximal → Intermediate → Distal
Middle: Proximal → Intermediate → Distal
Ring:   Proximal → Intermediate → Distal
Little: Proximal → Intermediate → Distal
```

所有手指根节点直接挂在对应 `leftHand` 或 `rightHand` 下。物理求解中，手指是以手腕为运动学根的轻量末端链，手指约束不会反向增加手腕和躯干的虚假刚度。面部层包含 `leftEye`、`rightEye` 和 `jaw`。

## 重定向和姿势兼容

骨架声明 18 条语义链：根、脊柱、颈、头、左右手臂、左右腿，以及左右各五条手指链。旧片段可以省略所有新增节点；缺失的旋转按单位四元数处理。

V8 世界姿势载荷升级到 schema 2，同时保存：

- 89 个节点的世界位置，供编辑器和旧桥接读取；
- 89 个节点的局部四元数，保证手掌轴向旋转、手指展开方向和面部关节能够无损往返；
- schema 1 的仅世界位置载荷仍使用旧的单子节点方向推导路径。

## 视口视觉语法

- 中轴核心：冷白蓝；左侧：青蓝；右侧：粉红。
- 扭转节点：紫色圆环；校正节点：紫红多面体。
- IK/极向/重心/视线控制：琥珀色控制形状。
- 接触和抓握标记：薄荷绿。
- 手指与面部关节使用更小的关节体，骨段使用锥形圆柱，选中项带独立光环。
- 视口可切换 `核心 28`、`身体制作 56`、`完整表现 89`，便于在简洁检查和精细编辑之间切换。

## 兼容边界

源文件 `smpl-male-surface-skinned.glb` 仍使用原 24 骨调色板。运行时在不改写源资产的前提下追加 8 个扭转、2 个肩胛和 30 个手指变形关节，形成 67 关节调色板；眼睛、下颌节点保持无表皮权重。肩、肘、髋、膝通过八区稀疏姿势修正补偿 GPU 线性蒙皮的局部体积损失，CPU DQS 只作为质量参考。该运行时扩展不会影响旧 24 骨表皮和旧动作，但生产级精细形变仍需要新的专业 SkinBinding 资产或重新绑定权重。

## 验证

自动验证覆盖 89 节点数量与角色、完整局部轴、镜像关系、VRM 手指命名、18 条重定向链、固定骨长、人体关节范围、轻量手指链、图片姿势重定向、动画局部四元数往返、GLB 骨架动画导出、67 关节运行时表皮调色板、姿势修正区域隔离、肩部体积保持和 DQS/LBS 参考差异。视觉效果由人工在本地浏览器验收。
