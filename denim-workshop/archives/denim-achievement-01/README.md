# 牛仔布成果一档

存档编号：`denim-achievement-01`。记录日期：2026-10-13。

用户原始指令：将这一步的成果存档好，叫做牛仔布成果一档。

本档固定当前已经交付并恢复复核的 **R10.0**，不再继续修改这一档。命名存档不代表新增版本，不等于影视级、全部角度零闪烁或大量整衣性能验收。

## 固定入口与身份

[打开本档原固定交互网页](https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/3daabc3436ecf6e5297d56869712449ca145ab5e/denim-workshop/r10/index.html)

- 已测试构建提交：`3daabc3436ecf6e5297d56869712449ca145ab5e`。
- 最后运行时修正提交：`3ae1189e62568616db0a5ffa6d8c4526b9ab0f69`。
- 源码及完整交付记录快照：`b034587bce970ede3aec1d1797f26b2df10b54e4`。
- HTML：74,969 字节；SHA-256：`a6d9dbac361aaf9017c42095e1d8ab63f1d9bc3d55c8e47c9c85af7ebb469c87`。
- 存档分支：`archive/denim-achievement-01`。后续引用应使用存档提交或上述固定构建，不使用会移动的开发分支作为版本身份。

本目录的 `index.html` 直接复用已经测试的同一 Git blob，未改标题、参数、着色器或运行行为。规范源码、构建脚本及数值测试保存在本分支的 `denim-workshop/r10/`；恢复测试保存在 `denim-workshop/r10-recovery/`。完整源码树和恢复记录树的摘要见 `ARCHIVE_MANIFEST.json`。

## 本档保留成果

保留棉纱近景、程序化经纬纱与毛羽，四种织法、十二种整理和五种破损；保留黄色双面针脚的几何表达及布面跟随。

保留独立工作线程中的475节点布样物理、风吹、重力、惯性和锚点牵引接口。远近切换不删除或冻结物理节点。

保留中远景按屏幕像素足迹的连续过滤、细节分级和动态阴影，以及微观纤维层接近时生成、远离后释放、返回时按同一种子恢复的机制。

## 随档证据

原完整验证与发布：[Actions 38133622400](https://github.com/haihao0307/Humanoid-Rig-Lab-Next/actions/runs/38133622400)。

中断后独立恢复复核：[Actions 38187071021](https://github.com/haihao0307/Humanoid-Rig-Lab-Next/actions/runs/38187071021)。

永久源码记录：`denim-workshop/r10/BUILD_MANIFEST.json`、`DELIVERY_RECEIPT.json`、`PUBLIC_DELIVERY_REVIEW.md`，以及 `denim-workshop/r10-recovery/RECOVERY_RECEIPT.json`。其中 BUILD_MANIFEST 是发布前构建清单，验证状态以之后的两份收据为准，原文件不改写。

四个固定场景的局部重投影波动残差改善约44.1%、71.7%、73.9%、60.4%；每组仅6帧、3处13×51像素补丁，不能解释为全画面闪烁百分比。物理形变对照使用固定求解姿态，连续风吹另作功能验证。

1000×780、DPR1下已跟踪GPU对象：冷中景144.58 MiB，完整近景184.38 MiB，拉远卸载后148.58 MiB，验证轨迹过渡峰值199.63 MiB。它们不是浏览器或驱动总内存，不是实机显卡占用率。

## 冻结与后续使用

本次只建立命名存档和校验记录，运行时代码零修改；不合并PR、不强推、不修改旧网页或其他工作台。不将整个GitHub仓库设置为只读归档，以免阻断其他开发。

后续提出“牛仔布成果一档”时，均指向本档的固定R10成果。后续优化、整衣接入及其他修改另开分支/版本，不覆盖或移动本档。固定提交和哈希是内容身份；未申请或宣称服务器端分支保护。

保留已知限制：当前是布样级微层按需驻留，不是局部分页或多整衣调度；成衣人物绑定、自碰撞、连续碰撞检测、动态撕裂、真实针孔和缝线张力尚未完成；没有消费显卡FPS或手机实机性能结论。存档不抹除这些限制。
