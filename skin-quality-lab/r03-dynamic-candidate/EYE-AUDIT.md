# Unity Digital Human 眼球源码审计

审计日期：2026-10-08。固定提交：8d61864050277f2c4574df7b31beb70093a8c263。
通过 GitHub 连接器读取实际文本与完整仓库树。未下载、复制或发布演示贴图、网格、人物资产。本文是行为审计与独立实现建议，不能当作 Unity 源码的移植许可。

## 最重要的边界

这套源码实现的是可调眼球表面渲染、虹膜折射采样、瞳孔视觉缩放与眼睑遮蔽。检查范围内没有晶状体曲率、焦距、屈光度、视网膜成像或 accommodation 状态变量。不能把 pupilScale、corneaIORIrisRay、irisUVExtraScale 或 graph 的 Caustic Cornea Radius 标成“晶状体调焦”。

检查范围：EyeRenderer.cs 全文、EyeProperties.hlsl 全文、EyeRendererCS.compute 全文、EyeOcclusionParameters.cs.hlsl、EyeRendererEditor.cs、2019 与 .NewShaderGraphs2022 的 Eyes shadergraph。此结论限定于这些实际检查的眼球实现；没有声称审计 Unity HDRP 的整个外部渲染管线。

## 参数与证据

### 1. 虹膜尺寸和纹理尺寸

- geometryRadius 默认 0.014265；corneaCrossSection 默认 0.01325。后者是沿眼球前向轴的截面位置，不是“虹膜直径”。[Runtime/EyeRenderer.cs L25-L43](https://github.com/Unity-Technologies/com.unity.demoteam.digital-human/blob/8d61864050277f2c4574df7b31beb70093a8c263/Runtime/EyeRenderer.cs#L25-L43)
- shader 以截面距离决定 cornea/sclera 区域以及边缘混合。改变截面会改变可见角膜/虹膜区域。[ShaderLibrary/Nodes_Eyes/EyeProperties.hlsl L108-L125](https://github.com/Unity-Technologies/com.unity.demoteam.digital-human/blob/8d61864050277f2c4574df7b31beb70093a8c263/ShaderLibrary/Nodes_Eyes/EyeProperties.hlsl#L108-L125)；[ShaderLibrary/Nodes_Eyes/EyeProperties.hlsl L145-L153](https://github.com/Unity-Technologies/com.unity.demoteam.digital-human/blob/8d61864050277f2c4574df7b31beb70093a8c263/ShaderLibrary/Nodes_Eyes/EyeProperties.hlsl#L145-L153)
- 在球眼假设下截面半径为 sqrt(R² − c²)。默认数值计算得到 0.00528467 模型长度；若场景 1 单位等于 1 米，截面直径约 10.57 mm。这是几何推导，不是源码对人体的测量。源码对独立虹膜贴图正是先算球面截面半径，再构造 UV scale/bias。[Runtime/EyeRenderer.cs L569-L582](https://github.com/Unity-Technologies/com.unity.demoteam.digital-human/blob/8d61864050277f2c4574df7b31beb70093a8c263/Runtime/EyeRenderer.cs#L569-L582)
- useSeparateIrisTextures=false 默认；irisUVExtraScale=1 默认且只在独立虹膜贴图开启时使用。它改变纹理采样尺度，不改变网格或截面位置。[Runtime/EyeRenderer.cs L107-L110](https://github.com/Unity-Technologies/com.unity.demoteam.digital-human/blob/8d61864050277f2c4574df7b31beb70093a8c263/Runtime/EyeRenderer.cs#L107-L110)；[Runtime/EyeRenderer.cs L569-L582](https://github.com/Unity-Technologies/com.unity.demoteam.digital-human/blob/8d61864050277f2c4574df7b31beb70093a8c263/Runtime/EyeRenderer.cs#L569-L582)

### 2. 瞳孔尺寸不是 accommodation

- pupilUVOffset=(0.002,0.016)、pupilUVDiameter=0.095、pupilUVFalloff=0.015、pupilScale=1，范围 0.001–2.2；pupilScaleUVMin=0.5、pupilScaleUVMax=2.2。[Runtime/EyeRenderer.cs L66-L79](https://github.com/Unity-Technologies/com.unity.demoteam.digital-human/blob/8d61864050277f2c4574df7b31beb70093a8c263/Runtime/EyeRenderer.cs#L66-L79)
- pupilScale 改变虹膜 UV 的径向映射：保留外侧采样边界，移动内侧输出边界。它未改变晶状体或光学焦距。[ShaderLibrary/Nodes_Eyes/EyeProperties.hlsl L127-L143](https://github.com/Unity-Technologies/com.unity.demoteam.digital-human/blob/8d61864050277f2c4574df7b31beb70093a8c263/ShaderLibrary/Nodes_Eyes/EyeProperties.hlsl#L127-L143)
- 瞳孔 mask 由重映射后的 UV 中心距离、半个 pupilUVDiameter 和 falloff 得到。瞳孔放大会影响虹膜采样外观，不是简单缩放整个眼球。[ShaderLibrary/Nodes_Eyes/EyeProperties.hlsl L151-L153](https://github.com/Unity-Technologies/com.unity.demoteam.digital-human/blob/8d61864050277f2c4574df7b31beb70093a8c263/ShaderLibrary/Nodes_Eyes/EyeProperties.hlsl#L151-L153)
- 编辑器将默认 pupilUVDiameter 解释为相对眼球直径的比例；在未增加独立虹膜 UV 缩放的几何解释下，默认瞳孔直径为 2R×0.095=0.00271035 模型长度。[Editor/EyeRendererEditor.cs L22-L43](https://github.com/Unity-Technologies/com.unity.demoteam.digital-human/blob/8d61864050277f2c4574df7b31beb70093a8c263/Editor/EyeRendererEditor.cs#L22-L43)；[Editor/EyeRendererEditor.cs L179-L184](https://github.com/Unity-Technologies/com.unity.demoteam.digital-human/blob/8d61864050277f2c4574df7b31beb70093a8c263/Editor/EyeRendererEditor.cs#L179-L184)

### 3. 两种 IOR 必须分清

- corneaIOR=1.376 是表面材质 IOR；scleraIOR=1.33698 是默认泪膜 IOR。shader 按角膜 mask 在两者之间混合。[Runtime/EyeRenderer.cs L17-L30](https://github.com/Unity-Technologies/com.unity.demoteam.digital-human/blob/8d61864050277f2c4574df7b31beb70093a8c263/Runtime/EyeRenderer.cs#L17-L30)；[Runtime/EyeRenderer.cs L45-L49](https://github.com/Unity-Technologies/com.unity.demoteam.digital-human/blob/8d61864050277f2c4574df7b31beb70093a8c263/Runtime/EyeRenderer.cs#L45-L49)；[ShaderLibrary/Nodes_Eyes/EyeProperties.hlsl L186-L200](https://github.com/Unity-Technologies/com.unity.demoteam.digital-human/blob/8d61864050277f2c4574df7b31beb70093a8c263/ShaderLibrary/Nodes_Eyes/EyeProperties.hlsl#L186-L200)
- corneaIORIrisRay=1.3 是另一个独立参数。它用来折射观察方向，再取得虹膜层的纹理坐标。它不是晶状体 IOR。[ShaderLibrary/Nodes_Eyes/EyeProperties.hlsl L99-L125](https://github.com/Unity-Technologies/com.unity.demoteam.digital-human/blob/8d61864050277f2c4574df7b31beb70093a8c263/ShaderLibrary/Nodes_Eyes/EyeProperties.hlsl#L99-L125)
- irisRefractedOffset=true 时，折射射线抵达截面之后再前进固定 irisOffset 距离；false 时，前进至固定深度平面。前者是虹膜外观近似。[Runtime/EyeRenderer.cs L59-L64](https://github.com/Unity-Technologies/com.unity.demoteam.digital-human/blob/8d61864050277f2c4574df7b31beb70093a8c263/Runtime/EyeRenderer.cs#L59-L64)；[ShaderLibrary/Nodes_Eyes/EyeProperties.hlsl L117-L124](https://github.com/Unity-Technologies/com.unity.demoteam.digital-human/blob/8d61864050277f2c4574df7b31beb70093a8c263/ShaderLibrary/Nodes_Eyes/EyeProperties.hlsl#L117-L124)
- irisRefractedLighting 是传往 shading graph 的 bent-lighting 开关；corneaSmoothness=0.917、corneaSSS=0 是表面渲染参数。[Runtime/EyeRenderer.cs L51-L64](https://github.com/Unity-Technologies/com.unity.demoteam.digital-human/blob/8d61864050277f2c4574df7b31beb70093a8c263/Runtime/EyeRenderer.cs#L51-L64)；[ShaderLibrary/Nodes_Eyes/EyeProperties.hlsl L195-L200](https://github.com/Unity-Technologies/com.unity.demoteam.digital-human/blob/8d61864050277f2c4574df7b31beb70093a8c263/ShaderLibrary/Nodes_Eyes/EyeProperties.hlsl#L195-L200)
- IOR_HUMAN_LENS=1.406 虽被声明，在 EyeRenderer.cs 中没有其他引用；EyeProperties 也没有 lens/accommodation 对应变量。因此这个常量不能作为“已有晶状体调焦实现”的证据。[Runtime/EyeRenderer.cs L17-L23](https://github.com/Unity-Technologies/com.unity.demoteam.digital-human/blob/8d61864050277f2c4574df7b31beb70093a8c263/Runtime/EyeRenderer.cs#L17-L23)

### 4. GPU eye occlusion 不是眼内光学计算

- EyeRenderer 收集 4 个 marker，只有四者都是指定 GPU attachment target 的附件且目标在 GPU 上执行时才选择 GPU 路径；否则 CPU 计算相同类型的遮蔽参数。[Runtime/EyeRenderer.cs L436-L482](https://github.com/Unity-Technologies/com.unity.demoteam.digital-human/blob/8d61864050277f2c4574df7b31beb70093a8c263/Runtime/EyeRenderer.cs#L436-L482)
- compute kernel 每次 dispatch 1×1×1，读取 4 个世界空间 marker，转到眼球物体空间，计算并写出 1 份 EyeOcclusionParameters。[Runtime/EyeRenderer.cs L351-L389](https://github.com/Unity-Technologies/com.unity.demoteam.digital-human/blob/8d61864050277f2c4574df7b31beb70093a8c263/Runtime/EyeRenderer.cs#L351-L389)；[Runtime/Resources/EyeRendererCS.compute L134-L166](https://github.com/Unity-Technologies/com.unity.demoteam.digital-human/blob/8d61864050277f2c4574df7b31beb70093a8c263/Runtime/Resources/EyeRendererCS.compute#L134-L166)
- 参数结构只有 origin、mean、tangent、bitangent、sharpness、threshold scale/bias。没有瞳孔、折射、晶状体或焦距数据。[Runtime/Resources/EyeOcclusionParameters.cs.hlsl L9-L17](https://github.com/Unity-Technologies/com.unity.demoteam.digital-human/blob/8d61864050277f2c4574df7b31beb70093a8c263/Runtime/Resources/EyeOcclusionParameters.cs.hlsl#L9-L17)
- 两种 coneMapping 为 ObjectSpaceMean 与 ClosingAxisSpaceSplit；后者以左右角和上下睑确定局部开合几何。[Runtime/Resources/EyeRendererCS.compute L41-L130](https://github.com/Unity-Technologies/com.unity.demoteam.digital-human/blob/8d61864050277f2c4574df7b31beb70093a8c263/Runtime/Resources/EyeRendererCS.compute#L41-L130)
- shader 用 anisotropic spherical super-Gaussian 近似眼睑可见性，并可给虹膜附加一层，影响 AO/albedo。源码注释明确目的是补足薄眼睑的阴影分辨率限制。[ShaderLibrary/Nodes_Eyes/EyeProperties.hlsl L64-L70](https://github.com/Unity-Technologies/com.unity.demoteam.digital-human/blob/8d61864050277f2c4574df7b31beb70093a8c263/ShaderLibrary/Nodes_Eyes/EyeProperties.hlsl#L64-L70)；[ShaderLibrary/Nodes_Eyes/EyeProperties.hlsl L155-L179](https://github.com/Unity-Technologies/com.unity.demoteam.digital-human/blob/8d61864050277f2c4574df7b31beb70093a8c263/ShaderLibrary/Nodes_Eyes/EyeProperties.hlsl#L155-L179)

### 5. Shader Graph 核对

- .NewShaderGraphs2022 的 Eyes graph 使用 HDRP EyeSubTarget。[ShaderLibrary/.NewShaderGraphs2022/DigitalHuman Eyes.shadergraph L1368-L1390](https://github.com/Unity-Technologies/com.unity.demoteam.digital-human/blob/8d61864050277f2c4574df7b31beb70093a8c263/ShaderLibrary/.NewShaderGraphs2022/DigitalHuman%20Eyes.shadergraph#L1368-L1390)
- “Caustic Cornea Radius” 的属性默认值 0.1，属性节点连接到 SurfaceDescription.IrisRadius。这个名字属于 graph 的焦散配置，不能等同于 EyeRenderer 几何截面尺寸，更不能叫 accommodation。[ShaderLibrary/.NewShaderGraphs2022/DigitalHuman Eyes.shadergraph L1310-L1336](https://github.com/Unity-Technologies/com.unity.demoteam.digital-human/blob/8d61864050277f2c4574df7b31beb70093a8c263/ShaderLibrary/.NewShaderGraphs2022/DigitalHuman%20Eyes.shadergraph#L1310-L1336)；[ShaderLibrary/.NewShaderGraphs2022/DigitalHuman Eyes.shadergraph L342-L356](https://github.com/Unity-Technologies/com.unity.demoteam.digital-human/blob/8d61864050277f2c4574df7b31beb70093a8c263/ShaderLibrary/.NewShaderGraphs2022/DigitalHuman%20Eyes.shadergraph#L342-L356)；[ShaderLibrary/.NewShaderGraphs2022/DigitalHuman Eyes.shadergraph L2109-L2146](https://github.com/Unity-Technologies/com.unity.demoteam.digital-human/blob/8d61864050277f2c4574df7b31beb70093a8c263/ShaderLibrary/.NewShaderGraphs2022/DigitalHuman%20Eyes.shadergraph#L2109-L2146)；[ShaderLibrary/.NewShaderGraphs2022/DigitalHuman Eyes.shadergraph L3180-L3220](https://github.com/Unity-Technologies/com.unity.demoteam.digital-human/blob/8d61864050277f2c4574df7b31beb70093a8c263/ShaderLibrary/.NewShaderGraphs2022/DigitalHuman%20Eyes.shadergraph#L3180-L3220)
- graph 另外有 Caustic Blend=0.8、Caustic Intensity=0.4。它们是焦散艺术参数，不是 lens focus 控制。[ShaderLibrary/.NewShaderGraphs2022/DigitalHuman Eyes.shadergraph L4437-L4463](https://github.com/Unity-Technologies/com.unity.demoteam.digital-human/blob/8d61864050277f2c4574df7b31beb70093a8c263/ShaderLibrary/.NewShaderGraphs2022/DigitalHuman%20Eyes.shadergraph#L4437-L4463)；[ShaderLibrary/.NewShaderGraphs2022/DigitalHuman Eyes.shadergraph L7567-L7593](https://github.com/Unity-Technologies/com.unity.demoteam.digital-human/blob/8d61864050277f2c4574df7b31beb70093a8c263/ShaderLibrary/.NewShaderGraphs2022/DigitalHuman%20Eyes.shadergraph#L7567-L7593)
- 2019 graph 暴露的顶层属性为 Albedo、Normal、Mask、Subsurface 贴图；核心眼球参数从 EyeRenderer 的 material property block 注入。[ShaderLibrary/DigitalHuman Eyes (2019).shadergraph L1-L29](https://github.com/Unity-Technologies/com.unity.demoteam.digital-human/blob/8d61864050277f2c4574df7b31beb70093a8c263/ShaderLibrary/DigitalHuman%20Eyes%20(2019).shadergraph#L1-L29)；[Runtime/EyeRenderer.cs L506-L582](https://github.com/Unity-Technologies/com.unity.demoteam.digital-human/blob/8d61864050277f2c4574df7b31beb70093a8c263/Runtime/EyeRenderer.cs#L506-L582)

## 独立 WebGL / Three.js 实现建议

以下是自主教学模型的设计建议，并非 Unity 代码翻译、算法逐行移植或像素级复现。

1. 结构：一个眼球 Group，下设巩膜球、浅凹虹膜盘、黑色瞳孔区域、可选透明角膜帽。球与角膜可用 MeshPhysicalMaterial；虹膜用从零编写的极坐标程序色彩与径向纤维，不使用演示资产。
2. 独立参数：irisRadiusRatio（虹膜口径）、pupilRadiusRatio（瞳孔相对虹膜口径）、irisDepth（几何深度）、corneaIOR（角膜材质 IOR）、roughness、yaw/pitch。保持瞳孔半径小于虹膜半径。
3. Three.js 的 MeshPhysicalMaterial 有 ior、transmission、thickness 和 specularIntensity；可将 IOR 作为外层表面/透射的物性参数。它不会凭空生成自定义虹膜 UV 重映射，也不是晶状体调焦系统。[Three.js r170 物理材质源码](https://github.com/mrdoob/three.js/blob/r170/src/materials/MeshPhysicalMaterial.js#L34-L74)
4. 自写 ShaderMaterial 通过 uniforms 接收半径与色彩参数即可；镜头角度通过父 Group 的 rotation/quaternion 更新。若要做低成本“折射感”，将其明确标为自主视觉近似，并与物理 IOR 开关区分。[Three.js r170 ShaderMaterial 源码](https://github.com/mrdoob/three.js/blob/r170/src/materials/ShaderMaterial.js#L18-L33)
5. 普通 WebGL 方案不需要复制 Unity compute。眼睑可以直接用原创几何遮挡或独立制作的平滑局部暗化模型；不要把这种近似写成已经移植了 Unity GPU ASG。
6. 若页面要展示“调焦”，应另设教学示意：独立薄透镜/焦平面模型或相机景深演示，并明确标注“扩展教学示意；不来自该眼球源码；不用于眼科测量”。眼球转向是注视方向，不是 accommodation。
7. 如果 pupil 的缩放只移动黑色圆而虹膜纤维不随之变形，应把效果如实标为“瞳孔口径演示”；不声称复现原 shader 的 iris remapping。
8. QA：分别固定其它参数测试 iris size、pupil size、IOR、yaw/pitch；查看正面与斜侧面，防止瞳孔穿出虹膜、角膜遮挡全部虹膜、深度闪烁与极坐标中心除零。任何与时间相关的 pupil 动画只标注人工演示驱动，除非确实实现并验证了刺激响应模型。

## 建议页面短文

“源码审计确认：这里的瞳孔控制是纹理/口径变化，角膜折射控制改变虹膜的观察外观。晶状体调焦并未在已审计源码中实现。网页使用独立编写的通用参数眼球模型，不复制 Unity 演示资产或其 shader 实现。”

## 验证状态与许可边界

- 已完成：固定提交实际源文件读取、完整眼球核心路径阅读、2019/2022 graph 属性解析与相关连线检查。
- 未执行：Unity Editor/HDRP 构建或实机渲染。本文不宣称已获得 Unity 与 Three.js 的图像等价性。
- 按本任务边界，Unity 源文件仅供审计；不加入网页发布目录。独立眼台已实现，GPU 图像验收另见 QA-REPORT.json。

