# Original Bird 执行令 R0.02

日期：2026-09-20  
执行端：Bird Mother  
方法来源：Ocean Life Fish Mother 干净交接线的“自然事实 → 测量 → 统一尺度/坐标 → 功能关系 → 独立生成 → 反向验证”生产顺序。

## 一、先纠正两个会导致返工的错误前提

1. **“模型文件叫 pigeon / seagull / egret”不等于物种已确认。**
   文件名、商店标题和外观只能建立候选类群身份；精确物种、年龄、性别、真实尺度必须另有自然或科学证据。模型数据进入 R1 参考层，不能自动升级成 R0 自然真值。
2. **“捕食体系”不能假定每种鸟都是捕食者。**
   鸽类主要是地面搜寻与取食；鸥类是机会性杂食和多环境觅食；鹭类才以浅水视觉搜索、站立或缓行、快速刺击为核心。内核统一字段应叫 `foragingEcology`，其中再区分 predator、grazer、granivore、omnivore、scavenger 等 guild。

## 二、真值阶梯

- **R0 Natural / Scientific Truth**：自然标本、科学测量、同行评议运动与生态研究。
- **R1 Reference / Calibration Truth**：用户 GLB、历史工作台、外部动画、照片和扫描，只用于测量、比较和校准。
- **R2 Numeric Truth**：统一坐标、比例、关节局部轴、翼区/羽区、动作相位、生态事件链的数值卡。
- **R3 Runtime Truth**：骨架、蒙皮、羽层、飞行/地面/涉水/栖息运行时。
- **R4 Visual Acceptance**：用户可直接打开的 HTML 工作台与固定视角验收。
- **R5 Product Readiness**：稳定、可迁移、可回滚、移动端可运行，并且不依赖第三方原模型。

## 三、每一只参考鸟的蒸馏顺序

1. **身份与许可**：SHA-256、来源、作者、许可、候选分类、不能证明的身份。
2. **文件体检**：mesh / vertex / triangle / material / texture / skin / joint / animation / morph / bounds。
3. **坐标与尺度门禁**：单位、前向、上向、原点、根节点缩放、场景包围盒；未知即保持 unknown，不猜米制。
4. **骨骼语义**：
   - axial：root / pelvis / trunk / neck / head / beak
   - pectoral：girdle / shoulder / humerus / forearm / wrist-manus
   - feather attachment：primary / secondary / covert / tail array
   - hindlimb：hip / knee / ankle / foot / toe / perch-contact
5. **表面与羽层**：连续体、喙/眼/足、翼膜边界、初级飞羽、次级飞羽、覆羽、尾羽；记录是显式几何、蒙皮还是贴图假象。
6. **动作**：动画剪辑只作为候选；提取关节通道、相位、接触、翼击与身体耦合，不直接复制源速度。
7. **飞行生态**：起飞、巡航、爬升/下降、转弯、滑翔、着陆、逃逸；区分飞行模式与栖息地风场。
8. **生活生态**：栖息、筑巢、地面/水边移动、觅食 guild、猎物/食物、捕食者风险、群体与昼夜节律。
9. **共同内核与差异项**：共享结构写入 Original Bird Kernel；类群和物种差异进入 Clade / Species Delta，不复制一套新架构。
10. **反向验证**：从独立生成结果回测体长、翼展、关节链、动作相位、栖息/觅食关系；模型对得上但自然证据对不上仍不通过。

## 四、当前批次的执行优先级

### A. Columbidae / 鸽类（三个 GLB）

优先原因：同时覆盖高细节连续体、完整翼羽/足趾骨架、飞行动画与 Morph，可以建立第一套完整迁移考试。

- `cine__pigeon_fly(2).glb`：低面、显式翼链与飞行动画，适合动作/骨架候选。
- `pigeon (1)(2).glb`：高细节、117 关节、翼羽与足趾控制丰富，适合解剖/附着候选。
- `pigeon(2).glb`：表面与 Morph 候选，但骨架使用 `Chicken_*` 命名且缺少显式翼链，作为“外观可像鸽子、内核却不能直接采用”的反例。

### B. Laridae / 鸥类（两个 GLB）

用于建立长翼、滑翔、风场利用与机会性觅食的类群差异。两个文件不是重复，也不能把 generic seagull 直接认定为红嘴鸥或黑头鸥。

### C. Ardeidae / 鹭类（一个 GLB）

用于建立长颈、长腿、浅水涉行、站立/缓行搜索、刺击捕食和飞行时颈链收拢的差异合同。当前模型只有简化翼链，不足以提供完整翼羽真值。

### D. Chiroptera / 蝙蝠（一个 GLB）

不进入 Bird Kernel。仅作为膜翼与羽翼、手指支撑与鸟类腕掌缩合的对照反例，由 Animal Mother 主责。

## 五、四类群迁移考试

同一 Original Bird Kernel 必须通过：

1. passerine：小型、快速翼击、跳跃/栖枝；
2. columbid：强起飞、连续拍翼、地面取食、群飞；
3. ardeid：长颈长腿、涉水、刺击、慢深翼击；
4. larid：较长翼、滑翔/风场、岸海与陆地机会性觅食。

通过不是“四只都看起来像鸟”，而是：同一语义合同能够容纳不同骨长、质量分布、羽区、动作相位和生态行为，且没有用缩放一张皮来冒充迁移。

## 六、本轮产物与门禁

本轮只宣布完成：

- 7 个 GLB 的 R1 参考卡；
- Columbid 第一轮共享内核蒸馏；
- Larid / Ardeid 的飞行—栖息—觅食科学证据卡；
- 蝙蝠排除合同；
- 自动测量工具扩展。

以下仍必须保持 false，直到有对应证据：

- exactSpeciesIdentityLocked
- realScaleLocked
- naturalSurfaceTruthComplete
- completeFeatherAttachmentTruth
- crossCladeTransferPassed
- visualAcceptance
- productionReady
