# 资产与代码许可

## 当前候选使用

- 原工作台代码：延续用户的 R02.1 固定版本并标明修改；不修改原目录。
- Three.js r180：MIT。包含 THREE-LICENSE.txt，bundle 保留原版权注释。下载代码固定于原工作台资产提交。
- Lee Perry-Smith 的 Infinite 3D Head Scan：CC BY 3.0。原始许可已从 [Three.js r180 的 LeePerrySmith_License.txt](https://github.com/mrdoob/three.js/blob/r180/examples/models/gltf/LeePerrySmith/LeePerrySmith_License.txt)核对；与原工作台中的 head.glb、normal.jpg、specular.jpg 对应。原作者 Infinite / Lee Perry-Smith；原作来源 Triplegangers / Infinite Realities。许可：https://creativecommons.org/licenses/by/3.0/ 。修改：原工作台网格细分、派生法线/高度、材质处理；本候选增加可逆局部形变及自主响应层。不暗示作者背书。
- 原 4K albedo、16-bit 高度及其 meso/micro/surface 派生图：沿用 R02 已有资源和 [固定来源许可说明](https://github.com/haihao0307/Humanoid-Rig-Lab-Next/blob/2368e26e76114f45e716cefba3320cfd76c61a9e/skin-quality-lab/r01/assets/hires/LICENSE-AND-SOURCE.txt)。该说明记录来源为 Pixar Photorealistic Head 教程所分发的 Infinite 扫描。此次核对了原说明和上游扫描许可，没有把 Pixar 全站资产视为通用授权，也未增加新的外来贴图。
- SSS 核及相关实现：延续原 R02 的 Jorge Jimenez / Diego Gutierrez Separable SSS 许可和版权说明，完整保留 THIRD_PARTY.txt。
- 新眼球几何、虹膜/巩膜程序纹理、灯箱环境、动态位移场和美术响应：本任务独立编写，不包含外部人物或眼球图像资产。

## 仅研究，不进入发布产物

- Unity Digital Human 固定提交：LICENSE.md 指向 Unity Companion License，不能当作 MIT。当前官方 [UCL v1.4](https://unity.com/legal/licenses/unity-companion-license)要求与有效 Unity Engine License 下的创作/分发关联，并有其他条款。候选未包含 Unity C#/HLSL/compute/ShaderGraph、Unity Demo 人物资产或其逐行翻译。
- Unity 包附带的 Accord.NET / CSparse.NET：没有打包进本网页。其第三方许可不自动适用于 Unity 本体或演示人物素材。
- Unity sample / The Heretic / Enemies 人物：没有下载或使用，未推定其资产许可。
- Kyka：仅原页面视觉目标链接；没有复制其人物、贴图、照片或宣传图。

大贴图只从原固定提交读取；候选没有新增第三方人物资产或改变现有资源的许可证。
