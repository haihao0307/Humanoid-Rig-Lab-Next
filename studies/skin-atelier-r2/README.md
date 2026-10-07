# R2 多视角外观重建 — 非完整数字人成品

## 固定公开网页

https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/01bbb85aa258cc06bdd1b1d70c78e9f2977f2bf4/studies/skin-atelier-r2/observed-surface.html

固定构建提交：`01bbb85aa258cc06bdd1b1d70c78e9f2977f2bf4`。
文件：`observed-surface.html`，6,643,414 bytes。
SHA-256：`129793d0c50f07355c93de143eaea546429bed40744b3c32e5ac1e0a6085582c`。

## 结论必须保留

用户要求的顶尖、可独立重打光及控制皮肤/毛发/眼部的三维数字人成品，交付未完成。

本页是对用户指定原片的有限视角外观重建研究。细致外观直接来自原片图像观测，光照与高光仍保留在图像中。不能将这些外观宣称为新实现的电影级皮肤或毛发着色器。

固定三维可见表面由光流、低秩相机估计和正则化恢复。它不是平面视频播放器，但也不是可靠的完整头模：底层几何有明显起伏误差，轮廓有分割/截断痕迹，未观测背面没有恢复。`regularizationConverged=false` 已保留，当前几何不通过解剖或生产质量验收。

没有独立可动眼球、毛发、器官、表情或完整皮肤材质；不能独立重打光，不能转动360度。几何诊断光源不等于外观重打光。

## 已实际实现

- 固定恢复曲面，50,629顶点，99,934三角面；未标定绝对物理尺寸。
- 16个跟踪视角和6组原片外观观测，约28.10度观测范围内插值浏览。
- 肖像、面颊、眼部、嘴唇、毛发近景；缩放、平移、小范围旋转。
- 曲面、法线、观测权重和真实三角网格诊断；静止时不重绘。
- 桌面及窄屏控制面板；未进行手机实机性能测试。

## 真实浏览器验收

https://github.com/haihao0307/Humanoid-Rig-Lab-Next/actions/runs/37618493009

公开网页与固定文件逐字节一致。Chromium/SwiftShader 实际渲染与读回通过。桌面1200×900、手机视口390×844。鼠标旋转、滚轮缩放、转台、近景、几何诊断、窄屏面板和空闲停止重绘检查通过。页面/控制台错误0，WebGL错误0。

这是软件渲染测试，不是普通显卡帧率承诺，也不是手机实机验收。源文件检查和运行成功不能提升美术质量状态。

## 可追溯研究

完整图像转三维接口曾实际调用，得到预览但未成功导出GLB；没有把接口运行状态或生成预览当作完整三维资产交付。该路径的预览也存在毛发和几何缺陷，未作为成品发布。没有开通收费服务或规避服务配额。

## 原作与权利

视觉参考由用户指定：
https://cdn.artstation.com/p/video_sources/002/676/142/shadowheart-custom-black-double.mp4

作品页： https://blu1304.artstation.com/projects/DLW62R

作者署名：Natallia Sudas / BLU1304 × Symbiote。
本研究不包含原作者Houdini工程、原始贴图、Groom或专有算法。不主张原作图像或角色资产的所有权，不赋予新的商业再分发授权。

## 文件与复现

- `reconstruct.py`：图像跟踪、相机与表面估计、图像观测打包。
- `viewer.js`：WebGL2固定曲面与观测外观浏览。
- `template.html`：界面与显式限制说明。
- `qa.cjs`：真实公开网页检查。
- `build-report.json`：包括未收敛和不可重打光等限制，不可删除这些字段。

本研究仅在 `work/skin-atelier-r2-data-driven-20261007` 分支；未合并main、未替换既有人物工作台或现有GitHub Pages站点。旧R1.1仍保留但被用户否定，不是验收基线。
