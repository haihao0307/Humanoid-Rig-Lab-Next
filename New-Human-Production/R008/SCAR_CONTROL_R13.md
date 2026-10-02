# R13 肩臂伤疤控制

2026-10-02。入口：http://127.0.0.1:8877/?version=R008-scar-13 。生产路径由 `source/assembly.json` 指定，伤疤面板与原角色、骨架、游戏控制及肤色共用一个运行时。

## 操作与状态

在「肩臂伤疤与愈合」里选择右/左肩、上臂、前臂，或统一控制六区。「近看右肩臂」「近看左肩臂」暂停游戏并显示正面近景；返回游戏镜头后可点「继续游戏」。清除所选伤痕可同时淡去颜色与凹凸；恢复所选原貌回到来源外观。默认保留来源伤痕。

七项滑条分别控制明显程度、受伤程度、自定义颜色强度、泛红、凹凸、粗糙度、愈合进度。选色会自动打开颜色强度。新增程序化伤痕可在原本无伤的左臂生成局部切痕。新伤、结痂、淡疤、已愈合为美术示例。统一控制显示右肩数值，修改某项才同步该项，不会抹去其他区域的独立参数。

自动愈合默认关闭，开启后沿用肤色面板的「预览一天用时」；不必开启日晒。暂停、动作检查、面部检查、后台标签页会停止演示时钟。初始完全愈合用时为 10 游戏天，愈合后保留 15% 淡疤；设为 0 可以彻底淡去。此时间与阶段是游戏设定，不是医学模拟。推进愈合一天独立于日晒。

统一存档为 `human-r008/skin@2`，包含肤色、日晒进度与 `human-r008/scars@1` 六区参数。旧 `skin@1` 配方仍可读取，伤疤采用来源默认状态。肤色预设和「重新到岛」保留伤疤状态。导出皮肤存档包含全部数据；刷新、密度重建及导入均恢复参数。只保存紧凑参数，不保存修复采样、贴图、顶点或权重缓存。

```js
HumanScars.injure('rightShoulder', .7);
HumanScars.set('rightShoulder', {color:'#963d31', tint:.8, redness:.4, relief:.6});
HumanScars.configure({automaticHealing:true, healingHours:240, residual:.15});
// 实际游戏显式推进一次时钟；勿同时开启演示自动时钟。
HumanSkin.advance(6, {uv:1, shade:.5, coveredFraction:0});
// 独立的手动愈合，不累积日晒。
HumanScars.advance(24);
const save = HumanSkin.export();
HumanSkin.restore(save);
```

## 函数所有权与修复方法

- `ScarState.mjs`：六区定义、参数验证、受伤、阶段及按小时积分。左右以人物自身为准。
- `ScarSurface.mjs`：仅绑定 `tripo_part_14/12/10/11/6/8` 六个肩臂材质；不改头部、衣物、眼球。使用重建的静止坐标，随已有八影响蒙皮传导到动作中。
- 来源右肩、右上臂、右前臂有伤，左侧没有同样来源伤痕。颜色分析与局部空间约束形成最多 24 个运行时修复锚点/区；锚点和所有采样仅在内存。邻近健康区域拟合四项线性色彩系数、粗糙度和局部二次曲面。
- 色素、法线/粗糙度、几何修复分离。原伤痕的几何修复位移上限为 2 mm，缓冲区更新只覆盖局部；法线采样保留周围形状。新增切痕用连续函数和导数法线表达，未增添外来网格、图片或源模型。
- 健康补全为附近皮肤拟合与带像素足迹过滤的自编程序纹理，不能恢复原模型未提供的隐藏皮肤。原重建的接缝/拓扑误差也不能由伤疤滑条保证消除。
- `SkinAppearance.mjs` 拥有联合存档；`SkinWorkbench.mjs` 拥有本地保存和演示时钟；`ScarWorkbench.mjs` 拥有分区操作；`app.mjs` 拥有近景与角色镜头。`FacialBinding.mjs` 保留已排队的缓冲更新范围，避免同帧表情刷新覆盖肩臂修复上传。

## 研究与排除的做法

[NVIDIA GPU Gems 3 皮肤渲染](https://developer.nvidia.com/gpugems/gpugems3/part-iii-rendering/chapter-14-advanced-techniques-realistic-real-time-skin)提供色彩、微结构与反射分开的原则。本轮没有宣称实现该章的完整散射模型。
[Three.js Material](https://threejs.org/docs/pages/Material.html)提供 `onBeforeCompile` 和程序缓存键约定；[官方法线着色器](https://raw.githubusercontent.com/mrdoob/three.js/r184/src/renderers/shaders/ShaderChunk/normal_fragment_maps.glsl.js)与[法线基底](https://raw.githubusercontent.com/mrdoob/three.js/r184/src/renderers/shaders/ShaderChunk/normal_fragment_begin.glsl.js)用于核对插入位置。

只褪去深红中心会留下浅色裂痕，已弃用。整片椭球区域替换会造成光滑色块，也已弃用。当前沿来源伤痕生成稀疏局部修复场，补充程序细节并柔化边缘。所有实际阶段需要用户美术选择；运行检查不等于最终视觉验收。

## 验证与门禁

纯参数测试、原有游戏/跳跃回归、真实后台浏览器 GPU 编译与阶段对照由 `tools/test-scars.mjs`、`tools/test-skin.mjs`、`tools/test-game.mjs`、`tools/test-jumps.mjs`、`tools/scar-review.cjs`、`tools/skin-review.cjs` 复现。已通过 45 项纯参数/游戏检查、11 项伤疤浏览器检查与 12 项肤色浏览器检查，真实 GPU 编译无错误；原貌恢复像素完全一致，局部修复最大约 2 mm，示例联合存档 1216 字节。缓存体积为浮点载荷估算，不是 JavaScript 堆测量。最新结果、源码哈希、局部位移及持久化体积见 `SCAR_REVIEW_REPORT.json`。QA 截图和生成缓存位于忽略的 `qa/scar-r13`，不作为生产资产提交。没有操作用户桌面鼠标。

- [x] 没有用生成图片代替真实三维实现；
- [x] 已实际修改生产源码；
- [x] 用户看到的是可交互三维工作台；本机预览已运行；
- [x] 人物/动物几何、骨骼和动作来自真实运行时；
- [x] 镜头、选择、动作或参数控制可以实际操作；
- [ ] 公网固定链接和真实浏览器已验证；本机已验证，未发布公网；
- [x] 如果只有截图而没有工作台，本轮判定失败；本轮交付运行源码和工作台。
