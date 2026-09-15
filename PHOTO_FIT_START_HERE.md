# 照片驱动 NPC 拟合测试板 R1

## 固定代码基线

```text
repository: haihao0307/Humanoid-Rig-Lab-Next
source branch: upload/human-workbench-20260915
source commit: 2c10edaec6e8515bc64f9df8b3da78cb34c89e61
work branch: feature/photo-driven-npc-fit-r1-complete-base
entry: photo-fit-test.html
```

R1 已废弃旧 `main` 上的 `appearance.morphs` 假设，直接使用完整源码当前合同：

```text
jarvis/character_preset@6
jarvis/human_shape@2
r2-regional-shape-r2
bodyPlanRevision 17
```

## 目标

测试板把一张正面照片和可选侧面照片转为当前活动 NPC 的可审计参数候选。它不改公共母体，不改动作、姿势和任务，不把图片像素写入人物配方。

链路为：

```text
本地图片
→ 人工关键点
→ 正面/侧面投影测量
→ 当前 R2 体型与面部参数候选
→ 分阶段应用到所选 NPC
→ 正面、侧面和面部复核
→ 导出 photo_fit_profile@0.2
```

## 当前能力

1. 选择当前完整工作台中的活动 NPC。
2. 读取该 NPC 的 `character_preset@6`、`human_shape@2`、体型指标和面部控制配方。
3. 导入正面图，侧面图可选。
4. 支持“全身＋面部”和“只处理面部”两种模式。
5. 在图片上拖动可检查关键点。
6. 正面图提取身高、腿身比例、肩宽、髋宽、腰宽、上臂和大腿投影宽度，以及面部主要横向关系。
7. 侧面图提取胸腹厚度，以及鼻、唇、颏相对面颊的前向投影。
8. 输出照片候选和每个参数的来源、置信度、限制与警告。
9. 支持人工覆盖所有 8 个当前体型参数。
10. 按身高、宽度、体积、面部正面、面部深度五个阶段应用。
11. 应用时调用完整源码 `lab.character.apply()`，由现有人物重建事务负责验证、暂存和提交。
12. 随时恢复进入拟合前的 NPC 基线。
13. 导出 JSON 时拒绝图片字节、Data URL、Object URL 和 Base64。

## 当前映射边界

完整源码当前体型参数为：

```text
statureScale   0.94–1.06
legProportion  -1–1
shoulderWidth  -1–1
hipWidth       -1–1
waistWidth     -1–1
torsoDepth     -1–1
armFullness    -1–1
legFullness    -1–1
```

肩宽、髋宽、腿身比例、胸腹厚度和四肢丰满度优先读取运行时 `lab.shape.report()` 中的当前人物指标与 R2 形变规则。腰部表面没有公开的可逆宽度指标，因此 R1 只给出低置信度工程建议并强制显示警告。

当前面部仍是 `jarvis/face_pose@1`：

- 17 个局部控制点；
- 每个控制点合成位移向量最大 6 mm；
- 表情权重与局部位移分开；
- R1 保留当前人物已有表情权重，只修改局部位移；
- 当前没有独立颅骨、眼眶、下颌角、鼻梁和头部前后深度身份参数。

所以 R1 可以验证照片观测到参数候选的闭环，但不能宣称完成真人身份级复刻。

## 单图限制

单张正面图片不能唯一确定：

- 胸腹和骨盆前后厚度；
- 鼻、唇、颏真实侧面投影；
- 后脑和颅骨形态；
- 宽松服装下面的腰围、胸围和四肢直径；
- 相机焦距、距离和透视造成的比例偏差。

没有侧面图时，上述深度参数保持当前 NPC 值或人工值，不会静默推断。

## 数据分层

导出的 `humanoid_rig/photo_fit_profile@0.2` 是测试候选档案，不是已经提交的 `ProportionProfile`。其边界字段固定为：

```json
{
  "proportionProfileCommitted": false,
  "projectRevisionIntegrated": false,
  "runtimeVerified": false,
  "visualAcceptance": false,
  "productionReady": false
}
```

照片拟合不得修改：

- 当前 Pose；
- MotionClip；
- NPC 任务；
- 公共人物母体；
- 其他 NPC 的参数。

## 使用步骤

1. 通过 HTTP 或 HTTPS 打开 `photo-fit-test.html`。
2. 等待完整工作台生成母体复制体和对照人物。
3. 从顶部选择目标 NPC。
4. 点击“记录当前 NPC 为基线”。
5. 上传正面图；需要厚度和面部深度时再上传侧面图。
6. 将所有可见关键点拖到真实轮廓。
7. 核对警告和参数候选。
8. 先应用“身高与腿身比例”。
9. 再应用“肩、髋与腰部宽度”。
10. 有侧面图时应用“厚度与四肢丰满度”。
11. 分别应用面部正面和侧面阶段。
12. 在三维窗口切换正面、侧面、面部近景和素模进行检查。
13. 结果不合理时恢复基线，调整关键点或人工参数后重试。
14. 导出 JSON 留作后续正式 `ProportionProfile` 事务的输入证据。

## 文件

```text
photo-fit-test.html
photo-fit/PhotoFitCore.mjs
schemas/photo-fit-profile.schema.json
tools/check-photo-fit.mjs
PHOTO_FIT_START_HERE.md
```

测试板保持为独立入口，不修改 `source/assembly.json`、正式 `index.html` 或当前动作、物理、NPC 人口模块，降低与其他并行窗口的合并冲突。

## 检查

```sh
node tools/check-photo-fit.mjs
```

R1 纯数据检查覆盖：

- 当前 shape schema 与 revision；
- 正面和侧面关键点验证；
- 单图深度未知；
- 体型参数边界；
- 面部 6 mm 向量上限；
- 表情权重与身份位移分离；
- 分阶段应用；
- `character_preset@6` 保留任务、皮肤、头发、力量和生理数据；
- 图片二进制拒绝；
- 多 NPC 目标实例记录；
- 测试档案不得伪装成已提交比例版本。

当前检查只验证数据与文件逻辑。浏览器中的实际重建耗时、WebGL 视觉结果和人物相似度必须由真实图片运行后验收。
