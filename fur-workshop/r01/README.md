# FUR ATELIER R01 — 皮草材质实验室

用户任务（2026-10-14）：参考 https://x.com/Google/status/2110114452955926759 ，建立可以在外部浏览器直接打开的皮草大衣工作台，并验证长毛衣领、帽子应用。视频当前未获得可核验画面，不能声称逐帧学习完成或已超过原视频。

本分支从 main@fda12bf2fe0262e4d02f1b08508128d17959e0c8 独立创建。仅新增 fur-workshop/r01 和专用工作流；不修改任何旧版人物、布料、灯光或其他活动分支。不合并、不强推。

## 方法

程序化承载曲面 → 面积均匀的稳定毛根 → 分区毛向 → 密底绒、细针毛与游离毛 → 有界弯曲中心线 → 单根细丝的摄像机朝向窄带 → 同一 EB1 光场 → 连续亚像素覆盖。不是粗圆管，不是以贴图代替整个毛皮层。

应用：完整大衣、仅长毛领的大衣、毛皮帽、弯曲样片。六个外观预设：深棕貂绒、银灰长毛、奶油长绒、暖棕长毛、卷曲羊羔绒、短绒翻毛皮。名称为外观目标，不是物种参数标定。

材质参数和毛根分离。改变毛长、弯曲、梳理、光泽不重建毛根；不做固定距离的高低模切换。显示纤维数量不等于真实毛囊数量。微风与拨毛采用有界导向毛梢弹簧，不是逐毛碰撞、全长不可伸长链条，也不是成衣布料物理。

## 继承

Three.js r169 (MIT)。EB1 1.1 使用已有原始核心：
- 仓库：haihao0307/Humanoid-Rig-Lab-Next
- 固定提交：beb3dda0a28f732e1e387dd68cc0d90f27ce8b7b
- 路径：lighting/eb1/eb1.js
- SHA-256：39f747e36f905eaf9e760236315ae649bcab4ffd4feb62290017c7c5da650572

以现有 lighting/eb1/v1/EB1_MANIFEST.json 与 PR76 核对用户确认配方。标准承载材质使用原 EB1 Three 适配器；毛丝着色器从 EB1.sampleProfile 读取同源主光、轮廓光和环境积分。材质替换不恢复旧照明。

## 验收

必须有固定提交 HTTPS 网页、真实 Chromium 三维画布与控件测试、源与构建 SHA、错误日志、桌面截图和手机视口检查。软件渲染帧率不冒充用户 GPU 或真机性能。CI 通过之前，状态是交付未完成。

首版边界：承载大衣是自有参数化视觉原型，没有声称经过裁片缝合或穿着碰撞验收；毛层遮蔽、透光和纤维散射为实时解析近似，不是完整多重散射或离线路径追踪。

## 方法参考（非代码、模型或纹理搬运）

https://developer.nvidia.com/hairworks-tutorials
https://developer.nvidia.com/blog/render-path-traced-hair-in-real-time-with-nvidia-geforce-rtx-50-series-gpus/

本轮不引入外部大衣网格、Google 视频帧、商业皮草贴图或私有布料仓库内容。最终交付状态以 DELIVERY.json 和 qa/PUBLIC_REPORT.json 为准。
