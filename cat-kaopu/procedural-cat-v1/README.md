# CAT PROCEDURAL BODY V1

## 目标

建立我们自己的全参数化、全程序化家猫母体。最终运行时不得加载第三方猫模型或外部图像贴图。外部资料只允许作为比例、骨架、关节和表面测量证据，所有最终几何、材质、骨架、权重、碰撞体和变体均由第一方 CatDNA 与程序公式生成。

## 当前 P0 内容

- `CAT_DNA_SCHEMA.json`：版本化 CatDNA 数据协议。
- `DEFAULT_GREY_TABBY_A.catdna.json`：第一只灰虎斑基础母体。
- `src/cat-procedural-core.mjs`：参数归一化、解剖约束、骨架锚点、连续身体场、碰撞代理、程序化毛色、指标和受限变体内核。
- `index.html`：可视化作者工作台，全部参数直接驱动 CatDNA。
- `../tools/validate_cat_procedural_v1.mjs`：纯 Node 技术验证。
- `../tools/capture_cat_procedural_v1.mjs`：WebGL2 固定六视图与移动端 QA。

## 永久边界

1. 形态、绑定、姿势、动画分层。
2. Pose 和 Animation 不得通过骨骼缩放改变猫体比例。
3. 身体、骨架锚点、碰撞代理和材质必须读取同一 CatDNA revision。
4. 所有参数先通过约束归一化，再进入几何和运行时。
5. 稳定拓扑冻结之前，不进入正式蒙皮与动作生产。
6. 单只猫的形态、变形和核心动作通过之前，不进入猫群。
7. 品种和个体差异必须由受限 DNA 派生，禁止各部位无约束随机缩放。
8. 原始参考证据与最终生成资产分开保存。

## P0 参数域

当前 CatDNA 覆盖：

- 整体长度、肩高、髋高、站距和总体体量；
- 胸廓、腰腹、骨盆的长度、宽度、深度、背线和腹线；
- 颈部长宽深和抬角；
- 颅部、口鼻、下颌、眼距、耳高和耳倾；
- 前肢肩胛、上臂、前臂、掌骨及各段体积和角度；
- 后肢股骨、胫骨、跖部及各段体积和角度；
- 前后足掌尺寸和趾端展开；
- 尾巴长度、粗细、抬高、弯曲和侧摆；
- 灰虎斑颜色、条纹、背部深色、腿环纹、尾环纹和粗糙度；
- 短毛微起伏参数。

## 生产顺序

1. **P0 参数内核与连续作者态**：当前阶段。
2. **P1 权威测量校准**：把许可明确的参考数据转换为 CatDNA 测量，不带入外部运行时模型。
3. **P2 中性站立形态验收**：固定六视图通过，冻结基础 Grey Tabby A。
4. **P3 稳定拓扑 Surface Carrier**：固定顶点索引和区域映射。
5. **P4 cat_body_bind_v1**：建立新绑定位置、逆绑定矩阵、蒙皮权重和姿势修形。
6. **P5 关节应力与破损测试**：肩胛、肘腕、髋膝、飞节、尾根。
7. **P6 核心动作**：站立、待机、起步、行走、停止、左右转向。
8. **P7 单体碰撞和环境 NPC**。
9. **P8 受限变体、猫群和品种扩展**。

## 当前状态

```text
parameterContract = active
proceduralGeometry = active
proceduralMaterial = active
stableTopology = false
visualAcceptance = false
bindAcceptance = false
motionAcceptance = false
productionReady = false
```

技术 QA 只能证明程序和约束正常，不能替代用户的视觉验收。
