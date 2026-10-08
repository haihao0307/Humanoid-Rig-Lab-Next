# ET01 公网交付验收 — 已通过

验证时间：2026-10-08T04:14:42.972Z。

固定预览提交：`a08f7fff098dad3a18fb655418660ddaae4ecb35`。

一键网页：
https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/a08f7fff098dad3a18fb655418660ddaae4ecb35/skin-quality-lab/emily-transfer/preview.html

构建与完整浏览器验证：
https://github.com/haihao0307/Humanoid-Rig-Lab-Next/actions/runs/37725259916

原始证据附件：`emily-transfer-evidence`，artifact ID `11527308921`。包含 `public-report.json` 和公网页面真实截图。附件设置保留 14 天；本文件永久记录验收摘要，源码、固定预览和源版本回归报告留在仓库。

## 本次实际修复

上一版打包程序把压缩 JavaScript 当作 String.replace 的 replacement 字符串，触发 `$&` 特殊替换规则，将 HTML script 标签插入了 Three.js 代码，导致公网页面不能启动。现已使用回调返回替换内容，防止特殊替换规则破坏脚本。

新增检查实际最终 HTML：仅有一个内联脚本、嵌入的脚本与预期内容逐字符一致、最终脚本可以解析。检查的是最终交付文件，不仅是原 app.js。

打包修复版本 `1.0.1`。渲染应用版本仍为 `emily-transfer/1.0.0`；本次未改模型、扫描纹理或皮肤默认视觉参数。生成的 app.js SHA-256 与上次通过本地浏览器检查的版本一致：
`a02c5de123de7f139aba072d7479062db8da1296459e0926b3130b7f03581e90`。

## 公网实际验证

独立 Chromium / SwiftShader 浏览器直接打开上述 HTTPS 地址。没有 localhost 服务器，没有拦截网络请求或替换远程数据。

远端 HTML HTTP 200，644817 bytes。SHA-256：
`504bac4bde0907b2781da62a78e866408f5d3a6ccb40573fcdbb52266796d140`。
远端文件与构建文件摘要一致，内联脚本解析通过。

桌面页面视口：1440×1040；其中 WebGL 画布 1134×974。已检查实际头模渲染、Emily 参考思路与增强皮肤切换、基础材质对照、划线分界移动、鼠标拖动旋转、面颊近景及微细节开关、耳部逆光视角。

手机检查：390×844 浏览器视口；实际画布为 390×789。检查了皮肤显示、面板展开和收起、方法切换与对照功能。这不是手机实机测试，SwiftShader 数据不作为硬件帧率承诺。

页面脚本错误：0。渲染控制台错误：0。失败网络请求：0。没有请求 alteredqualia 的模型、纹理或引擎。

实际画布差异：参考皮肤与基础材质平均绝对 RGB 差异 3.2299975736 / 255；增强皮肤与参考皮肤差异 2.7813084343 / 255；拖动对照分界差异 0.4501944743 / 255。颜色、几何和照明保持机制见 transfer-runtime.js；完整源版本回归报告见 qa-report.json。

## 内容与复用边界

展示对象是 Lee Perry-Smith / Infinite 扫描头模，不是 Emily。默认“Emily 参考思路”是 RGB 包裹漫反射、微凹凸与反射层的独立重实现；反射使用 Three.js GGX，不是 XG 原引擎逐像素移植。“增强皮肤”另外包含本库已有的屏幕空间 RGB 扩散、几何厚度透光与绒毛。

可独立学习和复用的光照响应位于 EmilyTransferKernel.js。目标模型仍需自己的颜色、法线、表面数据及 UV 适配。当前页面是单头模的皮肤方法迁移验证，不代表参数化全身人物已经整合完成。

原色、中尺度法线、微细节法线和表面数据实际为 4096×4096，基础法线为 1024×1024。首次加载仍包含数十 MB 纹理；尚不是面向大量 NPC 的低开销成品。全身接入需继续处理 UV、区域尺度、接缝和动态表皮。

## 实际公网截图摘要

`public-desktop.png` SHA-256：`a25da33060ad2bbe64e5a36820832a310e547c5f0b4600d48e104f2dcecf2d96`。

`public-live-comparison.png` SHA-256：`a5d871f480ece98cb24f443d1196ca71470045049ebbf98e53505da009e2c33d`。

`public-mobile-viewport.png` SHA-256：`49f8b1542bb3559ab4c670a71cf7d4ea8fffa38114b074611f19f086eafa6ed3`。

上述截图已实际打开审视；没有使用图片生成器替代三维结果。主分支及原 R01/R02 工作台不被本次交付覆盖。
