# 动态皮肤 R03 候选：源码学习、实现与验收边界

研究日期：2026-10-08。该候选在独立目录内，原 R02.1 不变。

## 最先说明

这次增加的是同一张高精皮肤的局部可逆形变、网格应变驱动的美术血色/皱纹响应，以及单独的参数眼球验证台。原扫描头没有睁眼拓扑和独立眼球，眼台没有植入原头。局部形变没有表情 rig。眼台没有晶状体调焦。

Unity 源码的存在不代表允许按 MIT 移植：它采用 Unity Companion License。当前网页采用独立编写的通用几何、材质与程序纹理，没有复制/翻译 Unity shader、compute、C#、人物网格或贴图。它不是 Unity/HDRP 的浏览器等价版。

## 固定来源

- [Unity Digital Human 固定提交 8d61864](https://github.com/Unity-Technologies/com.unity.demoteam.digital-human/tree/8d61864050277f2c4574df7b31beb70093a8c263)
- [原 R02.1 固定提交 1d4a616](https://github.com/haihao0307/Humanoid-Rig-Lab-Next/blob/1d4a616672f2a45e869d4ef3e36e710b11f5cf41/skin-quality-lab/r02/preview.html)
- 原贴图和模型固定于资产提交 2368e26e76114f45e716cefba3320cfd76c61a9e，不复制大贴图到候选目录。

## SOURCE / READ / RUN / PARITY

- SOURCE：Unity 与 R02.1 都使用固定提交；Unity 仓库树、LICENSE、package.json 和 README 已核对。
- READ：已读 SkinDeformationRenderer、SkinDeformationClip、SkinDeformationCS、SkinTensionRenderer、SkinTensionCS、SkinDeformationBlend、SkinTensionSampleWeight、SnappersBlend、SkinAttachmentCS、SkinAttachmentData；检查 SkinAttachmentTarget、SnappersHeadRenderer 的相关调用；解析新 Skin/Tension 子图的属性和连线。眼部完整范围见 EYE-AUDIT.md。
- RUN：未执行 Unity Editor/HDRP。网页构建与原头数值/独立眼台接口测试已运行。当前云浏览器的原版 R02 都无法创建 WebGL，GPU 图像验收需独立测试环境。每一阶段状态见 QA-REPORT.json。
- PARITY：不宣称与 Unity 相同。R02 静态回退的原始位置/法线数组保持 byte-exact；仍须经过同灯光/相机/像素分辨率的最终 PNG 对照，数值不变本身不是像素验收通过。

## 真实运行依赖

[README 的要求](https://github.com/Unity-Technologies/com.unity.demoteam.digital-human/blob/8d61864050277f2c4574df7b31beb70093a8c263/README.md#requirements)写明基础 Unity 2020.3+ / HDRP 10.9+；GPU deformation/attachment 为 Unity 2021.2+；新眼/皮肤 shader 为 Unity 2022.2.0a16+ / HDRP 14.0.3+。

[package.json](https://github.com/Unity-Technologies/com.unity.demoteam.digital-human/blob/8d61864050277f2c4574df7b31beb70093a8c263/package.json)保留了更旧的 HDRP 7.3.1、Burst 1.2.3、Collections 0.1.1-preview、Mathematics 1.1.0、Timeline 1.2.17 声明。这与 README 新路径要求不一致，不能仅照 package.json 就声称新 shader 可运行。实际 Unity 验证必须选择兼容版本、安装 HDRP 并准备合法且拓扑匹配的资产。

## 动态血色到底来自什么

### 4D 捕获帧与纹理插值

[SkinDeformationClip](https://github.com/Unity-Technologies/com.unity.demoteam.digital-human/blob/8d61864050277f2c4574df7b31beb70093a8c263/Runtime/SkinDeformationClip.cs#L10-L68)组织帧的顶点位移、法线位移、可选 fitted weights、albedo，以及低/高帧和插值范围的 subframe 索引。

[SkinDeformationRenderer L389–462](https://github.com/Unity-Technologies/com.unity.demoteam.digital-human/blob/8d61864050277f2c4574df7b31beb70093a8c263/Runtime/SkinDeformationRenderer.cs#L389-L462)根据时间位置选两帧，混合几何变化并设置对应低/高 albedo 和权重；[SkinDeformationBlend](https://github.com/Unity-Technologies/com.unity.demoteam.digital-human/blob/8d61864050277f2c4574df7b31beb70093a8c263/ShaderLibrary/Nodes_Skin/SkinDeformationBlend.hlsl#L6-L44)最多采样两个 clip 输入，逐 clip 做相邻颜色帧插值，再与基础 albedo 混合。

因此，捕获素材中的颜色变化能够进入渲染，但这条路径没有计算血液循环、氧合或压力生理。没有原 4D 数据就不能声称重建了原人物动态血色。

### 网格应变驱动美术贴图

[SkinTensionCS L22–48](https://github.com/Unity-Technologies/com.unity.demoteam.digital-human/blob/8d61864050277f2c4574df7b31beb70093a8c263/Runtime/Resources/SkinTensionCS.compute#L22-L48)读取每顶点相邻索引、索引偏移/数量、静止平均边长和变形后的原始顶点缓冲，计算当前平均邻边长度相对于静止值的变化，再以 gain 曲线放大。它区分压缩和拉伸。CPU 对应路径在 SkinTensionRenderer 中，不是识别肤色或分割皮肤。

[SkinTensionSampleWeight](https://github.com/Unity-Technologies/com.unity.demoteam.digital-human/blob/8d61864050277f2c4574df7b31beb70093a8c263/ShaderLibrary/Nodes_Skin/SkinTensionSampleWeight.hlsl#L4-L18)按 vertexID 读取单个 float 权重。新 Skin graph 有 Tension Albedo Map、Tension Normal Map、Tension Reflectance、Tension Mask、Tension Scale。TensionSingleSample 子图把 mask 与两种张力权重组合，选择半幅宽度纹理中的采样区，再与基础采样混合。它依赖为人物准备的响应贴图，并非通用“自动血流”。

[SnappersHeadRenderer L50–109](https://github.com/Unity-Technologies/com.unity.demoteam.digital-human/blob/8d61864050277f2c4574df7b31beb70093a8c263/Runtime/SnappersHeadRenderer.cs#L50-L109)还组织 albedo/normal/cavity texture arrays。它与 Snappers 角色的数据/rig 配套，不能单独获得一套 ShaderGraph 就凭空生成该角色的表情纹理。

## GPU 的工作是什么

[SkinDeformationCS](https://github.com/Unity-Technologies/com.unity.demoteam.digital-human/blob/8d61864050277f2c4574df7b31beb70093a8c263/Runtime/Resources/SkinDeformationCS.compute#L3-L63)从每顶点 12 字节的打包数据解码 6 个 half 浮点数，即 3D 位置增量和 3D 法线增量；叠加中性姿态并归一化法线，再写回目标顶点缓冲。它是形变应用，不是皮肤识别。

[SkinAttachmentCS](https://github.com/Unity-Technologies/com.unity.demoteam.digital-human/blob/8d61864050277f2c4574df7b31beb70093a8c263/Runtime/Resources/SkinAttachmentCS.compute#L10-L57)保存目标三角形 v0/v1/v2、重心坐标/距离、局部 frame 和 pose 范围；运行时读取变形三角形驱动毛发/眉睫等附件位置与朝向。这里也没有图像识别。通用 skeletal skinning（骨骼蒙皮）与这里的帧增量/附件求解相关但不相同，不能混为一个算法。

## 本网页的具体有机融合

1. 保持原 4K albedo、分频 meso/micro、表面位移、组织扩散、厚度透光、环境遮挡与 14,000 根毳毛通道。
2. 在原网格上建立邻接 CSR 数据。原静止 position/normal 不改；嘴角、面颊和眉区用自主平滑位移场得到 delta，GPU 在顶点阶段应用。法线通过该位移场的微分变换更新。CPU 使用相同变形位置计算相邻平均边长的真实应变。
3. 网格应变作为 vertex attribute 进入原皮肤材质。压缩权重改变局部 albedo、meso 褶皱强度和 roughness；血色进入原 albedo/SSS 流程，高光仍独立保留。没有给最终画面叠一层红色滤镜。
4. 毳毛位置使用相同位移场跟随表面；未实现 Unity 原附件重心求解、动态毛发物理或完整毛发法线运输。
5. 时间节律只是人工艺术驱动。暂停停止变化；关闭动态层把新增位移、应变响应和时间项全部门控为零。原“按住看基础材质”仍是不同的 PBR 检查按钮，别把它当完整 R02 对照。
6. 眼台独立显示真正的球面/开口巩膜、凹虹膜和透射角膜。虹膜纤维是程序生成，瞳孔改变孔径和可见环带；IOR 驱动 Three 透射材质。无晶状体/视网膜/生理瞳孔刺激模型。

## 参数映射与边界

| 页面参数 | 实际驱动 | 与原源的关系 |
|---|---|---|
| 嘴角 / 面颊、眉区 | 平滑位移场及法线变化 | 自建替代输入，不是原4D clip或Snappers rig |
| 局部血色 | 区域和压缩权重的光谱颜色美术响应 | 学习“状态驱动albedo”，没有复制响应贴图 |
| 褶皱增强 | 压缩区原 meso normal slope 的增益 | 学习张力响应组织，没有原tension normal atlas |
| 张力增益 | 相对邻边变化的线性缩放和显示 | 自建通用实现，未复制 Unity gain 函数 |
| 血色节律 / 频率 | 正弦时间驱动颜色项 | 新增美术演示，不是源仓库生理模型 |
| 瞳孔 | 独立虹膜环带内的孔径比例 | 与 pupilScale 有概念对应，非原 UV 算法移植 |
| 虹膜尺寸 | 独立眼球开口与虹膜几何口径 | 自建几何参数 |
| 角膜折射率 | Three MeshPhysicalMaterial IOR | 渲染控制，不是调焦 |
| 虹膜凹入 | 程序网格艺术深度映射 | 不是解剖毫米或晶状体焦距 |
| 转动 | 眼球父 Group rotation | 注视方向，不是 accommodation |

## 可见效果验收顺序

- 固定正面/柔箱光，关闭动态层，与固定原 R02 比较整个渲染 canvas；目标 RMSE 不超过 1/255，失败就不标“保真通过”。
- 轻笑/温暖：嘴角/面颊局部变化，同时血色和粗糙度改变；纹理细节和毳毛仍存在。
- 压缩/张力：检查蓝色压缩、红色拉伸诊断，确认变化不是全脸统一颜色。
- 静息及关闭：局部形变必须完全可逆，没有累计顶点漂移。
- 眼台：分别测试瞳孔、虹膜、IOR、深度和侧向角度；观察角膜反光及程序纤维，极限时无裂面/NaN/闪烁。
- 手机：参数抽屉能打开，反复皮肤/眼球切换不失去画布；保存/导入同一参数可复现。

## 尚未完成 / 不宣称

没有 Unity 运行结果、Unity图像 parity、真实表情 rig、睁眼脸部拓扑、4D 扫描 clip、真实生理血流/调焦、HDRP 眼睑 ASG 移植、原生 GPU compute 张力链，或生产角色质量验收。详细测试状态是可核查的 QA-REPORT.json，而不是本说明中的目标。
