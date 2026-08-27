# Task 15A Production Surface V2 — Neutral Body Candidate A

## 1. 路线切换原因

旧 SMPL24 表面已进入只读历史基线。本任务保留已经验证的 Human Core、`finalPose`、Reference Pose Calibrator 与 Full Joint Basis，将显示/形变职责移入可替换的 Surface V2 架构。工具预检未发现 Python、Blender、MakeHuman/MPFB 运行时或本地 glTF Validator CLI，因此选择确定性的路线 B：由项目新编写的 Node 转换器直接读取官方 OBJ、骨架与权重 JSON。

## 2. Pilot D 保留内容

保留 Asset Restore Gate、Reference Pose Calibrator、Full Joint Basis、twist/bend/side probes、Root Carrier Offset、shared `finalPose` identity、mapped-joint/endpoint error 与 penetration classification。Surface V2 直接导入 Pilot D 的校准实现，避免形成第二套参考姿势/基变换算法；Pilot D 页面、实现、提交和证据均未修改。

## 3. 旧 SMPL24 冻结范围

以下文件保持只读且只承担历史对照、Pilot D 视觉基线和回归证据：

- `legacy/v8/assets/smpl/smpl-male-surface-skinned.glb`
- `legacy/v8/assets/smpl/SKIN_BINDING_METADATA.json`
- `legacy/v8/assets/smpl/SKIN_BINDING_PROFILE_V4.json`
- `legacy/v8/src/smpl-skin.js`
- `legacy/v8/src/production-skin-runtime.js`

## 4. Candidate A 来源

来源为 MakeHuman Community 官方 MPFB2 仓库的核心图形资产：`https://github.com/makehumancommunity/mpfb2`。没有使用用户上传资产、Mixamo、旧 SMPL 网格或自动生成权重。

## 5. 来源 commit

锁定 commit：`437dd513888a92399d1d3200d2e80859fae55abc`。

## 6. 许可证证据

图形资产许可证为 CC0-1.0。证据为 MakeHuman 官方许可证页 `https://static.makehumancommunity.org/about/license.html` 及锁定提交中的 `LICENSE.ASSETS.md`。没有复制 MPFB/MakeHuman 的 GPL 或 AGPL 程序源码。

## 7. 原始文件 SHA256

| 文件 | SHA256 |
| --- | --- |
| `src/mpfb/data/3dobjs/base.obj` | `8E761E6624B8F54536409135D1636DA63B32486A90D4897F84E121D144F6FB4C` |
| `src/mpfb/data/rigs/standard/rig.game_engine.json` | `0C91396219FD85CA0D0858016A9AD4295C5F6520F78546A7D59B5A3171F68E70` |
| `src/mpfb/data/rigs/standard/weights.game_engine.json` | `02CCFFD5776D7AB278B295C71BDAF199AC7CBDA7CA6B6A2D9F3ABA80AE9851EC` |
| `LICENSE.ASSETS.md` | `5F3AB0CF6F7EBE92EFE4B83213131C617D308D164EEEFD5DA230373640B0C226` |

## 8. 转换文件 SHA256

`assets/human/production-surface-v2/candidate-a/neutral-body-candidate-a.glb`：`8E62AE9FBDCDF40F0B3B294ACC8DE1FE0360A838B4E9351604114AFAED94D38E`，974,268 bytes，13,380 vertices，26,756 triangles，53 joints。

## 9. 转换工具和命令

转换器：`scripts/convert-makehuman-candidate-a.mjs`。它解析官方 OBJ、`rig.game_engine.json` 与 `weights.game_engine.json`，生成骨架层级、`JOINTS_0`、`WEIGHTS_0`、inverse bind matrices 和标准 GLB；坐标为右手、Y-up、Z-forward，单位为米。执行命令和参数记录在 `artifacts/qa/task15a-production-surface-v2/conversion-report.json`。资产转换仅执行一次。

## 10. SurfaceCarrierV2 架构

`SurfaceCarrierV2` 提供 `load`、receipt/mesh/skeleton/joint-map/rest/deformed geometry 查询、`applyFinalPose`、变形顶点采样、Asset Bind/Reference T 恢复、geometry/runtime metrics 与 `dispose`。它只读消费 `finalPose`，一次场景只实例化一个 Candidate A 表面，不写入 Human Core 状态。

## 11. PerformanceDeformRigV2 架构

表现骨架登记 Core/target mapping、父关系、原始 bind、Human Core reference、Full Basis correction、root carrier offset、权重与能力状态。映射在六个场景中固定，不改变绑定骨长或 target local scale，不使用 pose-specific offset。

## 12. Human Core 权威关系

权威链保持为 `BodyDNA → HumanRigCore → finalPose → PerformanceDeformRigV2 → SurfaceCarrierV2 → Skinning → Renderer`。`finalPose.localRotations` 仍为唯一姿势权威；新骨架与网格只负责表面形变和显示。fingerprint 检查确认 `BodyDNA`、HumanRigCore 与 `finalPose` 未被反向修改。

## 13. Joint Mapping

核心映射覆盖 hips、spine、chest、upperChest、neck、head、双侧 shoulder/upperArm/lowerArm/hand、upperLeg/lowerLeg/foot/toes，并登记官方 clavicle 与 fingers。完整映射、父关系、bind/reference transform、Full Basis 和 capability 状态见 `artifacts/qa/task15a-production-surface-v2/rig-mapping.json`。

## 14. Reference Pose

Asset Restore Gate 通过：quaternion、position、scale 与 world-matrix 最大误差均为 0，IBM 与 weights 字节未改变。Reference T Gate 失败：角度误差为 shoulder 0°、elbow 0°、hip 17.104176°、knee 12.399246°；mapped max/mean 为 0.194534/0.070345 m，wrist/ankle/root 为 0.130243/0.012532/0 m。该失败不能在禁止骨骼缩放和禁止修改 Human Core 的约束下消除。

## 15. Full Basis

Full Basis Gate 通过。Reference T 使用同一校准参考；twist/bend/side probe 最大角误差为 0°，最大正交误差 `3.5691935518222806e-16`，最小 determinant `0.9999999999999998`，无 reflection。

## 16. Weight Audit

官方权重最大真实影响数为 6；608 个顶点超过四影响。转换保留最高四项并重新归一化，最大/平均丢弃权重为 `0.03359999880194664` / `0.00018852667920658158`，均低于 0.08/0.01 门槛；零权重顶点为 0，最大归一化误差 `4.842877388000488e-8`。没有使用 automatic/envelope/heat/nearest/random/SMPL 权重。完整结果见 `weight-audit.json`。

## 17. 六场景数值

角度顺序均为 source / legacy / candidate；mapped 与 endpoint 数值为 Candidate A。

| 场景 | shoulder / elbow / hip / knee (°) | mapped max / mean (m) | wrist / ankle / root (m) |
| --- | --- | --- | --- |
| Reference T | 90/90/90 · 0/0/0 · 0/0/17.104 · 0/0/12.399 | 0.194534 / 0.070345 | 0.130243 / 0.012532 / 0 |
| Reference A | 55.172/55.172/55.172 · 0/0/0 · 0/0/17.104 · 0/0/12.399 | 0.194534 / 0.068212 | 0.117627 / 0.012532 / 0 |
| Shoulder | 119.788/119.788/119.788 · 0/0/0 · 0/0/17.104 · 0/0/12.399 | 0.194534 / 0.069929 | 0.130243 / 0.012532 / 0 |
| Elbow | 121.366/121.366/121.366 · 140/140/140 · 0/0/17.104 · 0/0/12.399 | 0.194534 / 0.069064 | 0.130243 / 0.012532 / 0 |
| Hip | 90/90/90 · 0/0/0 · 55/55/38.978 · 0/0/12.399 | 0.194534 / 0.070716 | 0.130243 / 0.015799 / 0 |
| Knee | 90/90/90 · 0/0/0 · 0/0/17.104 · 110/110/100.842 | 0.194534 / 0.072929 | 0.130243 / 0.040611 / 0 |

所有场景共享同一 `finalPose` identity，且 finite/geometry checks 通过；Reference/mapped/endpoint/penetration gates 失败。

## 18. 穿透对比

Direct / Legacy Pilot D / Candidate A introduced pairs：Reference T `0/3/1707`，Reference A `691/5/1660`，Shoulder `0/88/1751`，Elbow `0/213/1857`，Hip `20/23/1604`，Knee `0/3/1770`。Shoulder 主要包含 upperTorso self 554、left/right upperArm+upperTorso 106/95；Elbow 主要包含 upperTorso self 542、leftForearm+leftUpperArm 125、left/right upperArm+upperTorso 84/95。Candidate A 六场景均超过未降低的门限。

## 19. 视觉逐项结果

| 项目 | 结论 | 项目 | 结论 |
| --- | --- | --- | --- |
| 整体比例 | legacy-better | 头颈连接 | legacy-better |
| 锁骨轮廓 | legacy-better | 肩峰位置 | legacy-better |
| 三角肌轮廓 | legacy-better | 腋窝连续性 | legacy-better |
| 上臂与胸廓连接 | legacy-better | 肘部外侧弧面 | legacy-better |
| 肘窝压缩 | legacy-better | 前臂扭转稳定 | legacy-better |
| 腕部轮廓 | legacy-better | 手掌方向 | candidate-a-better |
| 腹部与骨盆过渡 | legacy-better | 腹股沟分离 | legacy-better |
| 大腿根连接 | legacy-better | 髋屈曲体积 | legacy-better |
| 膝盖前侧 | legacy-better | 膝窝 | legacy-better |
| 小腿连接 | legacy-better | 脚踝与脚掌 | legacy-better |
| 表面折面 | legacy-better | 左右对称 | equal |
| 姿势后体积保持 | legacy-better |  |  |

主要缺陷是躯干、骨盆、颈部和四肢之间的严重分段/断裂，以及关节近景中的错误空间定位；这与 Reference Pose Gate 和大规模穿透失败一致。

## 20. 性能

GLB 974,268 bytes；单一 skinned mesh/1 draw call；geometry/skin-attribute memory estimates 为 963,312/321,120 bytes。cold load 11.1774 ms，reference setup 3.2959 ms，median/p95 pose update 0.1677/0.2280 ms，median surface sample 3.6696 ms。连续 WebGL2 流程中 GLB request=1、consoleErrors=0、pageErrors=0；为保持一次请求约束没有重复 warm load。

## 21. 未支持能力

官方 `game_engine` rig 没有加权 scapula、upper-arm twist、forearm twist、thigh twist 或 calf twist，因此均明确标记 `unsupported`；Task 15A 不创建 correctives。clavicle 与 fingers 已登记。没有生成无权重假骨骼。

## 22. 后续建议

保留 SurfaceCarrierV2 与 PerformanceDeformRigV2 架构，Candidate A 退出。后续单独评估官方来源 Candidate B，优先选择 reference/rest alignment 与 Human Core 比例兼容的骨架；不得在本任务继续缩放骨骼、调权重、制作 corrective 或 BodyDNA fitting。

## 23. 最终结论

`CANDIDATE_A_RIG_INCOMPATIBLE`

资产接入、Validator、Asset Restore 与 Full Basis 均有效，但官方骨架在不缩放骨骼、不修改 Human Core 的条件下无法正确消费 `finalPose`：Reference Pose Gate、六场景 mapped/endpoint gates 和表面穿透/视觉审查失败。该结果不是 `INCONCLUSIVE`；页面、GLB、metrics、共享 `finalPose` 和连续 WebGL2 证据均已完成。
