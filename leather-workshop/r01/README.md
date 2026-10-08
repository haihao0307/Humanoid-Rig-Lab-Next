# KAOPU 皮革工坊 R01

已实现可运行的独立程序化三维材质候选。网站与运行检查通过；Adobe 一比一复刻目标尚未完成，视觉验收为 PENDING_USER。不是 Adobe 原始 SBS / SBSAR 的移植，不是生成图片或静态截图展示。

## 直接打开

固定构建：82295cb93f70adc7f8d6c6eba90fba443ea7567d。

https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/82295cb93f70adc7f8d6c6eba90fba443ea7567d/leather-workshop/r01/preview.html

离线版本为本目录 preview.html，单个文件，双击打开；核心功能无需服务器或网络。
文件大小 564132 字节；SHA-256：71db8199509743cac7ae6f016672980cc338d39a43b41c4a95776f06ed92a87d。

先切换「油蜡棕革」，查看「微距」，再按住「对照：无微细节」。对照保留同曲面、同镜头、同光照，关闭材质微细节。保存/恢复只在当前浏览器来源内持久化；跨域或离线版本使用材质谱导出、导入。

## 本轮范围与保护边界

目标：学习 Adobe Digital Leather Workshop 的粒面、涂饰、工艺分层思路，并实现可复用网页模块。参考并不等于取得完整原始节点图。

基线为 main@fda12bf2fe0262e4d02f1b08508128d17959e0c8。只在 experiment/leather-workshop-r01-20261008 的 leather-workshop/r01 与专属工作流中新增内容。没有合并 main，没有替换现有人物身体、服装版型、骨骼、动画和已认可皮肤实验。

五套配方为原色粒面、油蜡棕革、黑色压粒、磨砂革、交叉压纹。原色与油蜡共用粒面结构体系但参数不同；另外三类具有不同表面结构算法，并非全部只改颜色。

三维承载曲面包括有厚度和实体缝线的卷曲皮样、平铺皮样及校验球。参数包括颜色、粒面尺度、微凹凸高度、粗糙度、蜡光、包浆色差、纹理种子、曝光、卷曲程度与纹理分辨率。微观凹凸通过法线表达，不是逐颗粒真实几何。

## 真实验证与证据

文件直开和交互检查：qa/qa-local.json，27 项通过。覆盖桌面 1440×1000、五套预设、法线 PNG 尺寸、不同结构输出、同镜头 A/B 像素变化、粗糙度像素变化、保存恢复、三种承载曲面、掠射光、核心零 HTTP 请求和手机视口 390×844。

固定公网链接检查：qa/qa-public.json，6 项通过。真实 Chromium 打开上述 HTTPS 地址，确认 R01.0、三维几何渲染、微距像素变化、预设切换、预设像素变化、控制台零错误。

公网测试运行：https://github.com/haihao0307/Humanoid-Rig-Lab-Next/actions/runs/37726876358

测试使用 GitHub Actions Chromium / SwiftShader。手机测试是视口模拟，不是手机实机。启动与 CPU 发出绘制命令的耗时不能当作用户显卡帧率或完整 GPU 生成耗时。未保证所有浏览器、手机和 4K 纹理档位性能。

历史记录：早期单文件打包脚本替换错误已修复；早期主镜头主要显示背面的问题已修复并重测。raw.githack 镜像未通过，已改为上面的 HTMLPreview 固定提交链接，并单独完成真实浏览器验证。不要用早期失败截图或旧镜像作为交付。

## 文件与复现

- site/leather.js：LeatherKernel、预设、程序化场与材质谱。
- site/app.js：曲面、厚度、切边、缝线、灯光、相机和交互。
- site/template.html：中文界面；Adobe 图片仅为可选联网参考，不参与材质计算。
- site/three.module.js：Three.js r169 固定运行库。
- site/lookdev.json：通过真实画面检查后追加的精确源码修正，必须保留。
- build.cjs：先检查并应用 lookdev 修正，再以 esbuild 打包单文件，校验最终脚本，输出 BUILD_MANIFEST.json。
- qa.py：本地文件和常规网址测试。HTMLPreview 入口采用 .github/workflows/leather-public-r01.yml 中的专用公网测试。

开发者在本目录执行 npm install --no-save esbuild@0.25.9，然后 node build.cjs。用户直接打开 preview.html，不需要 Node/npm。

注意：不要跳过 site/lookdev.json 直接运行原始 app.js 或移植原始 leather.js，否则会丢失已验证的粒面朝向、镜头、照明和粒面修正。接入宿主时应使用 build.cjs 中相同的检查/应用流程，或将对应修正明确收敛到新版本源码后重新验收。BUILD_MANIFEST 同时记录原始与应用修正后的源码哈希。

## 可复用材质与宿主接入

生成链路：周期性多尺度高度/粒面/微孔/色差场 → 底色、OpenGL +Y 法线、粗糙度、高度、微遮蔽图 → Three.js 物理材质、环境反射、涂层与 sheen。

材质谱为 kaopu/leather_material@1。LeatherKernel.bake(parameters) 返回 Three.js 材质，kernel.maps 提供五类纹理，kernel.recipe() 输出参数、尺度与来源。

底色 GPU 工作空间为线性 sRGB，导出 PNG 转为 sRGB；其余图为线性数据。高度 PNG 为 8 位归一化数据，不能当作工业压模或高精度位移资产。

一 UV 单位对应 0.096 m 的材料边长。宿主需要按静止曲面建立材质真实尺度，不能直接把整件衣服的 0—1 UV 当作米制材料坐标。保护宿主网格、原始 UV、蒙皮、骨骼、动画；在指定材质槽与明确的材料坐标通道适配。R01 验证了三种测试曲面的材质转移，尚未完成裁缝铺或人物生产工作台的实际接入。

## 仍未完成的部分

一比一视觉目标尚未完成。实际观察中，当前粒面仍较规则，天然皮革的细小不规则褶皱与区域变化不足；卷曲轮廓也比参考中的自然皮样更规整。不能用代码或测试数量替代这一差距。

没有取得原作逐项节点图、相同实物尺度、HDR 灯光、相机和颜色管理设置，不能证明像素级或感知级一比一。原文完整源材质的取得和可使用范围需另行确认。

卷曲是静态参数曲面，不包含质量、弹性、弯曲能量、自碰撞或人体碰撞。磨砂为微法线与 sheen 近似，不是纤维级追踪。主材质是可复用候选，不是皮革动力学系统。

桌面默认 2048²；窄视口默认 1024²；4096² 增加显存与生成开销。窄屏默认镜头仍有进一步完善取景的空间，可用双指缩放。正常静止时按需渲染，自动旋转时连续渲染。

## 来源和权利说明

Adobe Substance 3D content team, Welcome to our Digital Leather Workshop!, 2021-04-15：
https://www.adobe.com/products/substance3d/magazine/welcome-to-our-digital-leather-workshop.html

Three.js 官方文档：
https://threejs.org/docs/pages/MeshPhysicalMaterial.html
https://threejs.org/docs/pages/Texture.html

未下载或再发布 Adobe SBS/SBSAR、付费材质贴图或参考模型；未新增收费服务。原作图片仅由在线参考面板可选加载，权利归原作者。核心三维材质不依赖该图片。Three.js MIT 许可见 THIRD_PARTY.txt，也已封装在单体 HTML 内。

## 交付检查

- [x] 没有用生成图片代替真实三维实现。
- [x] 已实际修改生产源码（独立材质模块）。
- [x] 用户看到的是可交互三维工作台。
- [x] 皮样几何来自真实运行时；人物/动物几何、骨骼和动作未被替换。
- [x] 镜头和材质参数可以实际操作。
- [x] 公网固定链接和真实浏览器已验证。
- [x] 离线单体 HTML 已验证核心零网络请求。
- [x] 如果只有截图而没有工作台，本轮判定失败。
- [ ] Adobe 一比一视觉质量通过：尚未完成，不以运行检查代替。
- [ ] 实际裁缝铺/人物工作台生产接入完成：尚未实施。
