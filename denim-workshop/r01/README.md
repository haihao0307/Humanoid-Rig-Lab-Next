# KAOPU Denim Material Workbench R01

独立牛仔布材质工作台。R01 只处理牛仔布本体，不改动人物、裁缝铺、其他布料母体、服装纸样或现有工作台。

## 固定公网入口

https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/f62d9cdafebd142d01b6d1f778f9e201a6d852c6/denim-workshop/r01/index.html

该入口锚定已通过真实公网浏览器验收的提交 `f62d9cdafebd142d01b6d1f778f9e201a6d852c6`。验收运行：

https://github.com/haihao0307/Humanoid-Rig-Lab-Next/actions/runs/38023705873

## 本轮真实能力

- 单体 HTML，所有 CSS、JavaScript、WebGL2 着色器和几何数据以内联 gzip 载荷封装，由浏览器原生 `DecompressionStream` 展开；无 CDN、图片贴图、GLB、字体或外部运行资源；需使用支持 `DecompressionStream` 与 WebGL2 的现代浏览器。
- 真实 WebGL2 网格：121 × 85 顶点、20,160 个三角形；支持旋转、缩放、正反面与全屏。
- 程序化 3/1 右斜纹、2/1 右斜纹、3/1 左斜纹、3/1 断斜纹。
- 独立靛蓝经纱与本白纬纱，支持竹节、经纬微起伏、粗糙度、棉纤维绒感、水洗、磨耗与缝线响应。
- 平铺、柔性折面、上沿悬挂三种真实几何状态，以及轻微动态风扰动。
- “结构锚点 / 当前候选”双三维视口同屏比较。
- 导出 `kaopu.denim_material_profile@1.0` JSON，作为未来裁缝台、成衣运行时、布料求解器与 MaterialX 出口的桥梁。

## 明确未完成

R01 是视觉与数据基础，不是影视级成品，也不等于 Houdini Vellum：

- 未使用实测 GSM、厚度、拉伸、剪切、弯曲、摩擦、回弹或阻尼数据校准。
- 未实现 XPBD/FEM、布料自碰撞、人体碰撞、缝合约束、撕裂与塑性。
- 未实现牛仔裤纸样、门襟、腰头、口袋、包缝、铆钉或穿着褶皱。
- 未实现由应变、接触、洗水历史驱动的猫须、蜂窝、落色和磨破演化。
- 未进行 MaterialX/USD/Houdini 往返与影视镜头级离线渲染校准。

## 门禁

- [x] 没有用生成图片代替真实三维实现。
- [x] 已实际修改生产源码。
- [x] 用户看到的是可交互三维工作台。
- [x] 牛仔布几何、材质与参数来自真实运行时。
- [x] 镜头、形态、组织、染色与表面参数可以实际操作。
- [x] 公网固定提交链接和真实浏览器已验证。
- [x] 桌面 1440 × 1000 已验证。
- [x] 手机 390 × 844 视口模拟已验证；不是实机。
- [x] 不是只有截图而没有工作台。
