# Humanoid Rig Lab Next Procedural Clothing V0.1.0

## 模块身份

- 板块编号：`HRL-M04`
- 名称：基于二进制函数的程序化服装、自适应与材质系统
- 当前状态：`foundation_complete`
- 标准衣服：`standard_crew_shirt_v1`
- 代码入口：`packages/procedural-clothing/index.js`
- 观察入口：`procedural-clothing-lab.html`
- 测试入口：`npm run test:procedural-clothing`

## 本轮已经建立

1. `GarmentDNA`，保存款式、衣片参数、松量、结构分辨率和构造规则。
2. `MaterialDNA`，保存织物力学、表面光学和微结构函数参数。
3. `FitContract`，把一件标准衣服解析为某个人物比例版本的确定尺寸。
4. `PatternGraph`，记录前片、后片、双袖、领口和缝合关系。
5. `GarmentCompiler`，生成位置、法线、索引、骨骼权重、材质坐标、缝线与约束 TypedArray。
6. `HRLG`，用于服装编译结果的单文件二进制格式。
7. `GarmentRuntime`，读取最终骨骼蒙皮矩阵并更新衣服顶点。
8. 轻量 `hybrid` 求解器，支持结构长度、缝合、骨骼跟随和解析式人体碰撞接口。
9. 无外部服装网格、无图像纹理的自动检查。

## 快速验证

```bash
npm run test:procedural-clothing
```

浏览器通过 HTTP 静态服务器打开：

```bash
python -m http.server 8080
```

然后访问 `procedural-clothing-lab.html`。

## 长期不变量

- 人物比例、骨骼、姿势、动画和服装保持分层。
- 服装只读 `ProportionProfile` 和人物表面采样接口。
- 服装只读 `simulationRig.finalPose`，不得回写骨长、父子层级或人物表面。
- 每次适配都保存目标 `proportionRevision`、人体哈希、衣服哈希和材质哈希。
- 同一 `GarmentDNA` 面向不同人物重新编译衣片，不允许使用整件统一缩放代替适配。
- 原始真值为参数、函数和版本化数据；运行结果为 TypedArray 与 `HRLG` 二进制。
- 外部服装模型、外部网格和图像纹理均不进入此模块。
