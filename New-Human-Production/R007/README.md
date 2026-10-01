# 新人物参数化生成 R007

当前生产入口由 `source/assembly.json` 的 `activeSubject` 选择 R007。
运行 `node tools/build-pure.mjs` 装配根入口，`node tools/check-pure.mjs` 检查文件与参数契约。
本地预览：<http://127.0.0.1:8877/>。这是本地工作台，尚未发布公网。
双击项目根目录的 `start-r007-preview.cmd`，或运行 `node New-Human-Production/R007/start-preview.cjs`，会在后台启动服务并检查就绪状态；重复启动复用已有服务。重启电脑后需要重新启动。页面打开后首次生成约需 15 秒。

## 输入与完整采集

唯一参考是用户提供的 `shirtless+male+model+3d (1).zip`，SHA256：
`fbf763eab51c127ff350207e6762570a5a0501170e3fe27d5317c122cb08586c`。
完整读取 17,885 个三角面、53,655 个绘制顶点、8,942 个独立位置、法线、UV、原始权重、61 骨骼层级/局部变换/逆绑定矩阵，以及 run、jump、look_around、walk 四段动作的全部轨道。
表面检验记录覆盖每个面的三个角点、三个边中点和重心，共 125,195 个位置样本。输入贴图只在编译阶段采样。

## 最终保存的参数

- 429 个可单值投影的曲面域；按原骨骼组织建立域，禁止投影重叠和不同高度的近重合接触。
- 每个域的基平面、稀疏分层双线性高度系数、紧支撑径向修正系数和二维裁剪边界。
- 连续骨骼权重场、颜色/粗糙度/金属度场和法线场；材质高频细节经过拟合与带宽压缩。
- 原骨架的实际变换与绑定关系；动作是原始骨骼变换曲线经容差简化后的参数。
- 共享系数数组、整数差分、变长整数和 gzip；打包阶段不再损失拟合后的系数。

`parameters.phf.gz` 不含原始顶点 XYZ 列表、三角面索引、FBX、ZIP 或图片。运行时由 `surface-generator.mjs` 根据密度和曲率生成新的网格。改变采样密度会生成不同的顶点和索引；显示网格仅存在于内存。

空间以米为单位；绑定表面归一化至 1.8 m。原 FBX 坐标经原 Armature 变换转为 Y 向上，只进行一次坐标转换。保留原逆绑定关系，不能用当前姿势重新计算逆绑定矩阵，否则会改变原动画。
高度系数单位 10 微米，权重单位 1/4096，颜色单位 1/256，法线单位 1/512。重采样顶点最多保留 8 个骨骼影响，CPU 和 GPU 均使用同一套 8 影响 LBS，避免丢失相邻手指的影响。

## 当前验证与限制

文件审核、无界面真实浏览器、四段动画各五个时刻的 61 骨骼矩阵对照均已执行。
生成网格的独立检验共 35,770 点，全部落在新网格中。当前 95% 误差约 0.302 mm，RMS 约 0.149 mm，最大约 4.391 mm，集中在右腿衣物局部褶皱；参数函数的采集点最大误差小于 0.5 mm。
独立权重检查最大偏差约 0.016（1.6 个百分点）；动画最大骨骼矩阵分量差约 0.00073。
这些是测量结果，不等同于无损复制或用户的视觉验收。完整采集与拟合生成是两个阶段。高频材质和少数局部褶皱仍有近似误差。

证据在本地 `qa/validation.json`、`qa/mesh-validation.json`、`qa/final-browser-report.json` 以及四段动作的实际渲染截图中；原始模型、原始贴图和完整原始顶点转储在验证后清理，证据不作为运行资产。最终浏览器检查没有脚本错误，8 个影响的权重归一化最大偏差小于 5e-8，采集目录和编译工具均返回 404。
运行包的实际字节数、输入规模和压缩比例记录在 `fit-report.json`。服务端使用运行文件白名单，拒绝读取采集目录。

## 复现与接入

`node New-Human-Production/R007/tools/rebuild.mjs "C:/Users/Administrator/Downloads/shirtless+male+model+3d (1).zip"`

复现会临时解包与完整采集，编译参数，装配并审核，然后删除原始缓存。输入包保留在用户的下载目录，应用不保留副本。
`SubjectRuntime.mjs` 导出 `loadSubjectParameters()`、`createSubject()`；角色提供 `play(name)`、`step(dt)`、`command(text)` 和实际 Skeleton。该接口用于接入任务层；当前工作台已实现走、跑、跳、环顾与参数控制。

参考原则：[Three.js 骨骼蒙皮](https://threejs.org/docs/pages/SkinnedMesh.html)、[Three.js 动画系统](https://threejs.org/manual/pages/animation-system.html)、[曲面图册参数化研究](https://www.microsoft.com/en-us/research/video/iso-charts-stretch-driven-mesh-parameterization-using-spectral-analysis/)。本实现采用自有切域、系数拟合和生成代码，并未声称复现该论文算法。

- [x] 没有用生成图片代替真实三维实现；
- [x] 已实际修改生产源码；
- [x] 用户看到的是可交互三维工作台；
- [x] 人物几何、骨骼和动作来自真实运行时；
- [x] 镜头、动作和参数控制可以实际操作；
- [ ] 公网固定链接和真实浏览器已验证（真实本地浏览器已验证，公网未发布）；
- [x] 当前交付包含真实工作台，截图仅为运行证据。
