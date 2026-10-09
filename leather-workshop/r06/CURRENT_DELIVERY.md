# R06.1 当前交付 / 2026-10-09

固定网站：https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/d322a9b173d889f2bdb723ff7c04955e40472b2b/leather-workshop/r06/public-lite.html

源码 7acf3421619b03fc3704c0d7b8bfce637f58f816；构建 d322a9b173d889f2bdb723ff7c04955e40472b2b。原用户 R05 入口与 R01–R05、anchors 零差异。TAKEOVER_ANCHOR.json 为接手时历史，不代表当前实现进度。

已实现：8 个原皮革预设完整保留；总共 13 个材质/涂饰三维缩略图；卡包、腰带、肩包、皮帽与皮样；三套灯光、旋转/缩放/微距；卡包和腰带 1:1 mm 试作 SVG；原 R04 皮样承重与恢复；原 R05 精确字节保留。窄屏取景按三维边界精确计算，不再仅检查 DOM 横向溢出。

本次完整公网验收已通过，详情见 qa/public/browser.json 与 DELIVERY_RECEIPT.json。手机仅 390×844 视口模拟，非实机。检查项包括重复视角和参数，不能当成独立物理能力数量。

若出现预览宿主 favicon.ico 的 HTTP 404，它被明确归入 hostWarnings，并保留具体来源；没有忽略任何应用代码、着色器、贴图或其他资源错误。网站本身的错误列表必须为空。

边界：未实现夹克；成品为尺寸驱动三维结构，不是整件皮具/整衣动态求解。仅卡包和腰带有试作纸样，仍需按标尺印制、废皮打样、削薄及五金试配；肩包/帽子无定版纸样。皮革外观不自动等于实测力学参数，仍缺整衣自碰撞、人体碰撞、摩擦与实物标定。视觉状态仍待用户验收。
