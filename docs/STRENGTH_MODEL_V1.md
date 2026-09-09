> 生成机制与来源参考。此文中的历史检查不代表当前纯函数版本的运行或视觉验收；当前状态见根目录 README.md。

# 身体力量模型 V1

日期：2026-09-08。当前交付是 body-plan-r9 加力量模型 V1。

这版让肌群基础参数、当前状态和搬运／推动任务共用能力计算。先联网调研后修改文件；本轮只验证文件内容与语法，没有启动应用、模拟动作、操作鼠标或进行视觉验收。数值是可调整的工程初值，不是测得的真人力量。

## 使用入口

打开现有工作台，人物画面右下角新增 **力量与状态** 按钮。无需启动动作即可使用比较面板。

- 身体配置：均衡基础、较大肌量、耐力倾向、较小肌量。
- 状态：充分恢复、疲劳状态，以及 0.2–1 的当前状态系数。
- 单侧肌群：调整某个肌群的基础体积，左右两侧独立。
- 任务比较：指定搬运／推动、重量、持续时间、前伸距离和物体滑动摩擦系数。比较保留相同的当前疲劳与状态。
- 导出／导入：保存完整力量基础和动态状态；普通角色预设导出也包含这些数据。
- 修改配置会保留疲劳；只有明确应用“充分恢复”等状态才重置状态。普通人物复位保留肌群状态，暂停和检查模式冻结力量时间。

任务或形体重建期间禁止修改配置，防止已执行的计划突然更换身体能力。比较、查看和导出是只读操作。

## 数据与公式

`body/StrengthProfiles.json` 是可读数据源，包含 15 个独立肌群通道：左右肩、屈肘、伸肘、握持、伸髋、伸膝、踝跖屈，以及中央躯干。它们是功能肌群，不对应 15 块完整解剖肌肉，也不覆盖全身所有肌肉。

每个肌群存储体积 cm³、最佳纤维长度 cm、羽状角 degree、力臂 m、单位面积产力 N/cm²、最大募集比例、疲劳率和恢复率。四套配置不依据性别自动分配，也不是人群均值。耐力配置的疲劳率是独立参数，不由肌量直接推导。

基础计算为：

```
PCSA(cm²) = volume(cm³) / optimalFiberLength(cm)
maxTendonForce(N) = PCSA × specificTension × cos(pennation)
availableForce = maxTendonForce × recruitment × readiness
                 × (1 - 0.8 × fatigue) × lengthFactor × velocityFactor
availableTorque(Nm) = availableForce × momentArm(m)
```

羽状角只投影一次。基础 PCSA 来自固定基础体积，不从动作中的鼓起半径重新计算；发力时变形不等于肌量增长。建模肌群质量由体积和密度相加；估算体重再加上 `nonModeledMassKg`，其中包含骨、脂肪、器官及未单独建模的肌肉，避免重复计重。

长度曲线采用工程近似；正缩短速度降低产力。离心阶段当前最多计入等长能力，不额外增加力量。姿势测量只为肘屈伸通道提供长度／速度近似，其余通道仍使用参考长度和力臂。

动态状态分开保存激活和疲劳。激活具有上升／下降时间常数；疲劳随激活累积，低激活时恢复，使用有界的一阶解析更新。`readiness` 是可配置的状态系数，不代表测量出的神经驱动或心理状态。

## 任务接线

1. 语言规划器在新力量配置下不使用旧的 12／45 kg 阈值排除候选。此时粗略 affordance 带有 `strengthCheckPending`，必须经过身体评估才确定任务可行；旧协议仍保留兼容路径。
2. 身体的 `physicalAnalyzeStep` 同时检查尺寸、可达路线和肌群能力。肌群需求包括外物、身体节段自重、前伸力臂、下蹲姿势、加速度和握持摩擦；推动还检查地面牵引与简化的前后支撑余量。
3. 规划中的持续时间采用整步估计时长，且把整个时段视作负载时段，偏保守。活跃肌群按全激活且无恢复预测末端疲劳，连续任务在私有状态副本上继续累积。规划不会修改真实角色状态。
4. `Agent.begin()` 无论来自文本还是结构化指令，都重新执行身体预检，避免绕过语言规划器。
5. 建立抓握后、每次提交物体新位置之前，再用当前姿势、当前状态和同一个 `StrengthModel.assess()` 检查能力。超限时暂停，保持上一有效接触姿势，不再提交新的物体位置。这是受限运动学暂停，不是模拟摔落或自动卸载。
6. 实际成功执行帧才更新负载疲劳。当前空手步行、手势、坐躺按非负载恢复处理；这些行为尚未纳入力驱动或腿部疲劳求解。
7. 肌群激活映射到已有肌肉形变更新。持物不动和缓慢放下也能保持激活；皮肤变形仍沿用现有体积与绑定机制。调整基础肌量目前不重建外形。

场景对象增加可存档的 `friction`（滑动摩擦，默认 0.4）和 `gripFriction`（掌面摩擦，默认 0.6）。现有水平场景地面摩擦使用 0.65；没有轮子接触或真实坡面碰撞。独立评估接口允许输入摩擦、支撑长度、左右分担和坡度参数，但这些输入不生成对应场景几何。

## 接口

以下是供后续代码调用的示例，本轮没有运行这些模型调用：

```javascript
HumanLab.strength.report();
HumanLab.strength.applyPreset('power');
HumanLab.strength.setCondition('tired');
HumanLab.strength.assess({type:'carry', massKg:10, durationS:20, reachM:0.34});
HumanLab.strength.compare({type:'push', massKg:30, durationS:15, objectFriction:0.4});
const saved = HumanLab.strength.export();
HumanLab.strength.import(saved);
```

`configure(profile)` 接受完整、严格验证的肌群配置；`export()` 返回 `jarvis/strength_snapshot@1`，内含 profile 和 state。旧角色 JSON 缺少 strength 时补充均衡、充分恢复配置。字符、字段、数值范围、完整肌群集合和文件体积均检查后再应用；失败不会覆盖当前配置。

## 调研依据与边界

- [OpenSim 静态优化](https://opensimconfluence.atlassian.net/wiki/spaces/OpenSim/pages/53089619)：最大等长力、激活、长度／速度与关节力臂参与肌力和关节力矩计算。本实现借鉴这些变量关系，未运行 OpenSim 优化器。
- [OpenSim 疲劳肌肉示例](https://opensimconfluence.atlassian.net/wiki/spaces/OpenSim/pages/53087718/Fatigable+Muscle+Code)：展示疲劳、募集和恢复作为独立状态并通过实验标定。本实现使用自己的简化状态方程，没有复制示例求解器或宣称已标定。
- [肌肉模型参数研究](https://pmc.ncbi.nlm.nih.gov/articles/PMC9583830/)：肌体积、最佳纤维长度和生理横截面积参与最大产力参数化。

`calibrated:false`、`fullDynamics:false`、`visualAcceptance:false` 始终明确记录。这是肌群能力包络，不是完整 Hill 肌腱求解、逆动力学、动态平衡、疲劳损伤或运动控制器。肌腱顺应性、三维重心、足底压力、功率／代谢限制、具体技巧与训练适应仍未建模。

本轮期间工作区同时加入 `ApprovedUpperBodyData.js` 与 `ApprovedUpperBody.js` 上半身参考解剖数据。这些文件及其接线保持原样，未作为力量模型的改动。参考网格目前使用关节绑定；已有通道收到肌群激活，不代表参考肌肉网格已经实现激活驱动的体积变形。本版没有从该参考网格测量真实肌肉体积，也没有验证其视觉效果。

## 文件交付与验证

核心：`body/StrengthModel.js`、`body/StrengthProfiles.json`、`body/StrengthBridge.js`。活动源：`body_runtime.js`。页面仍从 `index.html` 中的压缩 BODY_PAYLOAD 加载。

`node tools/sync-body-runtime.mjs` 会从新模块和 JSON 重组力量段，然后同步当前身体页面、两个载荷、源映射和摘要。`tools/build.py` 的完整模板构建也支持力量模块。

`node tools/verify-strength-files.mjs` 只检查文件、语法、数据范围、公式单位算术、接线顺序、生成载荷和摘要，不导入或执行应用模块。报告：`tests/strength-v1/file-qa.json`。旧 R9 报告记录旧版本；其中要求构建工具完全不变的断言不作为新力量版本验收条件。

迁移前文件备份在 `backups/strength-model-v1-20260908/`。该目录仅作为恢复点，两个一次性迁移脚本不可重复执行。

后续画面和运行验收应由用户启动：比较相同姿势不同配置、同一配置不同疲劳、近身与前伸、瞬时与持续任务、低摩擦推动、持续负载超限，以及存档往返。本轮没有把这些列为已通过结果。
