# 皮肤与肤色控制 R1

后续更新：用户随后授权了实际截图，并要求处理假疤线；当前结果与限制见 [皮肤假疤线修正 R2](SKIN_SURFACE_REPAIR_R2.md)。以下保留 R1 文件检查阶段的记录。

2026-09-12。已完成联网调研、源码接入与文件检查；未运行网页、人体生成、人物模拟或 GPU。状态为 Candidate，未完成视觉验收。

## 使用入口

场景左下方点击 **皮肤与肤色**，或者进入 **人物设置 → 皮肤与肤色**。

提供八个浅至深、冷暖不同的示例肤色，也可通过拾色器和 `#RRGGBB` 输入自定义颜色。预设是设计样例，不对应族群、身份或实测生理浓度。

| 控制 | 范围 | 用途 |
| --- | --- | --- |
| 基础肤色 | sRGB 十六进制 | 漫反射底色；包括深肤色与自定义幻想颜色 |
| 冷暖底调 | -1 至 1 | 在底色上做有界的相对色调变化 |
| 红润 | 0 至 1 | 轻微红色倾向，使用乘法，避免深色皮肤被固定加色抬灰 |
| 粗糙度 | 0.30 至 0.85 | 控制高光宽度，保留皮肤材质的有界范围 |
| 油光 | 0 至 1 | 在宽、窄两种表面高光之间调整占比 |
| 散射柔和度 | 0 至 1 | 控制包裹光照和暖色响应的轻量近似 |
| 肤色细微变化 | 0 至 1 | 连续的低频颜色变化 |
| 微表面细节 | 0 至 1 | 程序化微起伏及少量颜色变化，按像素覆盖范围淡出 |
| 生成种子 | 0 至 4294967295 | 控制细节分布；点击“按种子生成肤色”会同时生成一套肤色参数 |

同一版本、同一种子产生相同皮肤配方。皮肤面板只改外观，不改角色身份、任务、能力、环境或体型。普通滑动只更新参数和材质 uniform，不重新采样人体、创建贴图或上传几何缓冲。

调整即时作用于当前角色，但刷新页面不会自动保存。**导出角色** 保存完整 NPC 定义；**导出皮肤配方** 保存可用于其他角色的 `.skin.json`。导入错误会在面板说明原因。灰模和关节分区仍使用各自颜色，可点击“显示皮肤视图”查看材质。

## 源码审查发现及修正

1. `validateCharacterPreset` 原先无论输入何种 `skinColor` 都写回 `[.497,.391,.296]`；渲染器也另有写死的常量。现在从 `appearance.skin` 经 `ReconstructionState.skinMaterial` 传到绘制 uniform，初始导入、角色切换、皮肤微调共用这条路径。
2. 原来 `seededCharacterPreset` 只换 ID、名字和种子。现在调用确定性的肤色采样函数，在浅深色带之间按线性光插值，并生成有界的材质参数。皮肤采样不根据职业、行为或能力选色。
3. 原先除眼角膜和虹膜之外的面部部件大多共用皮肤着色。依据同源 `anatomy/whole-body/manifest.json` 的部件标签核对：`FJ2811` 是外耳，`FJ2812` 是眉毛，`FJ2814` 是嘴唇，`FJ1317/FJ1368` 是左右眼白。外耳随身体共用肤色与细节；眉毛、眼白保持独立颜色，嘴唇由底色推导。只核对了来源元数据，未导入或复制旧人体网格。
4. 皮肤移除了不受肤色控制的蓝白轮廓加光，表面高光采用中性介电 GGX 双波瓣，反射率基准为 0.028；散射近似也受当前阴影因子约束。世界雾和既有曝光压缩仍会改变画面观感，所以色块不等于最终渲染像素。

## 保存和生成接口

皮肤使用独立版本 `jarvis/skin_appearance@1`。当前角色导出为 `jarvis/character_preset@4`，接受旧 `@3` 角色及无版本的构造输入，拒绝未知角色版本。旧 `appearance.skinColor` 按线性 RGB 迁移为 sRGB 十六进制，有最多半个 8 位通道步长的量化；新定义中的 `skin` 优先，`skinColor` 只保留为基础色的兼容派生值，不含冷暖、红润或光照。

示例供页面正常运行后的调用方参考；本轮没有执行这些调用：

```js
HumanLab.skin.set({baseColor:'#875b43',roughness:0.60,oil:0.18});
HumanLab.skin.apply(HumanLab.skin.sample(4101));
const skinRecipe=HumanLab.skin.export();
const npcDefinition=HumanLab.npc.export();
// 从已保存母定义派生角色，仍沿用既有 NPC 定义机制：
const derived=HumanLab.npc.derive('base-r2',4101,'npc-4101');
```

`HumanLab.skin.apply` 验证完整配方，`set` 合并局部参数；返回值为规范化后的副本。`HumanLab.skin.report` 和人物 DNA 导出声明当前配方、色彩空间和验证边界。肤色不进入几何缓存标识；人物预览仍是单实体，新增皮肤参数不等于完成多 NPC 渲染。

## 调研依据与取舍

- [Three.js 色彩管理](https://threejs.org/manual/en/color-management.html)：颜色输入、线性工作空间和输出需要明确分工。这里的主渲染器实际是原生 WebGL2，故采用显式分段 sRGB 转换，没有引入 Three.js 依赖。输入颜色只解码一次；compact 输出在既有色调压缩之后编码一次。
- [Filament 材质说明](https://github.com/google/filament/blob/main/docs/Materials.md.html)：提供粗糙度、介电反射及皮肤反射率的建模参考；0.028 是通用参考值，并非对当前人物的测量。
- [Filament 渲染说明](https://google.github.io/filament/main/filament.html)：微表面分布、Fresnel 和几何遮蔽分项支持本轮 GGX 表面高光的实现方向。完整照明仍沿用现有工作台，不能因此称为完整物理渲染器。
- [NVIDIA GPU Gems 3，皮肤渲染](https://developer.nvidia.com/gpugems/gpugems3/part-iii-rendering/chapter-14-advanced-techniques-realistic-real-time-skin)：皮肤的表面反光与皮下散射应分开考虑。本文实现局部包裹光近似，没有实现该章纹理空间扩散、透射阴影或厚度求解。
- [Donner 等，分层非均匀皮肤反射模型](https://research.nvidia.com/publication/2008-12_layered-heterogeneous-reflectance-model-acquiring-and-rendering-human-skin)：支持将色素差异、表面细节和散射分离为控制维度；当前未采集多光谱参数，不把滑块命名为实测黑色素或血红蛋白浓度。
- [Khronos 的 volume、IOR 与 specular 说明](https://www.khronos.org/blog/using-the-new-gltf-extensions-volume-index-of-refraction-and-specular)：该文的体积吸收不包含散射，不能直接拿透明玻璃式 transmission 冒充皮肤。当前皮肤保持不透明，角膜保留自己的透明路径。

## 文件验证与后续边界

`tools/check-skin-appearance.mjs` 已并入 `tools/check-pure.mjs`，检查参数字面量、色带顺序、装配依赖、版本迁移路径、渲染 uniform 接入、部件材质分离、程序化细节坐标及着色器替换锚点。检查器只解析文件内容；不调用皮肤函数、不编译着色器、不生成图像。结果收录到 `FILE_AUDIT.json`。

真实观感尚未观测。后续视觉验收应覆盖浅色/深色、正面/侧逆光、全身/近景、耳与脸的衔接、嘴唇和眼白、粗糙度和油光边界、不同细节档的纹理稳定性，以及导出后重新导入的结果。程序化噪声不等于真实毛孔扫描；当前没有雀斑/疤痕/年龄纹理、部位色素遮罩、真实多层散射或生理状态驱动肤色，也没有多 NPC 性能测量。
