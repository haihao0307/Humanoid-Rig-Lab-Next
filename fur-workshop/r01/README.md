# FUR ATELIER R01 — 皮草材质实验室

2026-10-14：已交付可运行的独立网页候选。网页可达性、真实三维渲染和主要交互已验证；影视级毛皮质量尚未通过视觉验收。

## 固定网页与代码锚点

https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/0058e6337ee82a7fb664fb58df94fd2406bb1c15/fur-workshop/r01/preview.html

- 仓库：haihao0307/Humanoid-Rig-Lab-Next
- 分支：feature/fur-atelier-r01-20261014
- Draft PR：85，未合并、未强推
- 源码输入：460828a9119be579eadb0fc3e938b9461b48dc6e
- 完整展开源码与不可变构建：0058e6337ee82a7fb664fb58df94fd2406bb1c15
- 公网验收回执：951660156570c0aec1ea2c130915b96fa8a446a5
- 成功作业：https://github.com/haihao0307/Humanoid-Rig-Lab-Next/actions/runs/38529585909
- HTML SHA-256：7de44e15e3b5e1a02fc5d720b1530f4c5e686397f2071c1feedc188100197815

只新增本专项目录与专用工作流，不改旧版人物、布料和其他活动分支。固定网页引用构建 SHA，而不是会移动的分支名。

## 本版实际功能

完整大衣、仅长毛领的大衣、毛皮帽、弯曲样片共四种承载形态。大衣及帽子由程序生成，没有外部网格、摄影毛皮贴图或预渲染视频。六个外观预设为深棕貂绒、银灰长毛、奶油长绒、暖棕长毛、卷曲羊羔绒和短绒翻毛皮；这些名字是外观方向，不是生物物种参数标定。

大衣默认 280000 个显式毛丝实例及 1024 个导向点。可调整针毛长度、底绒长度、顺毛下垂、自然卷曲、聚束、粗糙度、显示密度和微风。毛长、材质切换不重建毛根。支持底绒/针毛/裸基底分层、整件/领口/局部/背面/侧面镜头、旋转、缩放、拨毛模式和 JSON 参数导出。

逻辑：程序化承载曲面 → 面积均匀的稳定毛根 → 分区毛向 → 底绒、针毛和游离毛 → 弯曲中心线 → 细丝窄带 → EB1 同源光场 → 连续亚像素覆盖。不是粗圆管，也不是在整个大衣上贴一张皮草照片。显示采样数不等于真实毛囊数。不采用固定距离分档的高低模型切换。

## 本次恢复解决了什么

旧运行没有完成交付。最早是连续 GPU 提交与截图争用；后续 volume-v2 已完成 23 项检查并输出 10 张画布证据，但刷新测试触发整轮 240 秒上限。不能把这些旧失败说成已交付。

恢复版保留 GPU fence 背压，等真实帧完成后读取同一画布；暂停观察时使用按需绘制；刷新前排空在途 GPU 工作；测试按阶段即时保存结果并采用有界总时限。没有另造截图场景，也没有减少默认毛丝数量来让测试通过。

视觉侧把薄片翻领改成闭合、渐缩的椭圆卷领，保留圆肩；改变底绒方向散布和弯曲，降低光滑承载基底的暴露感。源变换脚本是 refine.py 与 recovery.py；展开后的完整 app.js 已进入固定构建提交，可以直接继续开发。

## 实际验收范围

qa/BROWSER_REPORT.json：40 项通过；qa/PUBLIC_REPORT.json：在新的 Chromium 会话中直接打开上述固定公网地址，40 项通过。两轮 JavaScript 错误与着色器错误均为 0。测过材质切换、真实像素变化、分层、毛长与毛根稳定、四种形态、灯光像素变化与跨重建/刷新保存、指针旋转、配方导出、390×844 手机视口及横向溢出。

公网证据包含完整桌面界面、毛丝近看、毛领、帽子和手机视口。证据目录 qa，最终状态以 DELIVERY.json 和 PUBLIC_REPORT.json 为准。BUILD_MANIFEST.json 是发布前冻结的构建清单，其历史 BUILD_ONLY 标签不能替代后续公网回执。

测试设备是 Chromium + SwiftShader 软件渲染器，不是用户显卡。没有认证 60 FPS，没有真机手机测试。observedFPS 在自动化中混入截图停帧和测试等待，不作为纯运行性能基准；firstReadyMs 只是初始化标记，也不是用户设备首次可见帧时间。

## 视觉复看后的未完成项

我已查看本次公网整件和近景实拍。当前仍存在：底绒体积感不足、近看可见光滑基底外附细丝的感觉、部分聚束过于规整，以及灯光下局部偏硬的明暗。发布检查通过不代表这些问题已解决，也不代表已达到电影级或超过参考视频。

微风/拨毛使用有界导向毛梢弹簧，不是逐毛碰撞、完整不可伸长毛杆或成衣布料物理。没有完成裁片缝合、人体穿着或与服装总台的运行时合入。遮蔽、透光、散射为实时解析近似，不是完整多重散射或离线路径追踪。

下一轮应从当前固定构建派生，在同一 EB1 下做密底绒遮蔽、聚束与毛尖形态、轮廓蓬松度的同视角对比；同时建立不含截图停帧的独立性能测试。保留本轮网页，不覆盖旧入口。

## 灯光、许可与参考

继承未经改写的 EB1 1.1 用户确认配方：Humanoid-Rig-Lab-Next@beb3dda0a28f732e1e387dd68cc0d90f27ce8b7b/lighting/eb1/eb1.js，SHA-256 39f747e36f905eaf9e760236315ae649bcab4ffd4feb62290017c7c5da650572。承载材质使用原 EB1 Three 适配器，毛丝从 EB1.sampleProfile 读取同源光场。更换材质不恢复旧灯光。

Three.js r169（MIT），许可见 THREE-LICENSE.txt；EB1 第三方说明见 EB1-THIRD_PARTY_NOTICES.md。

用户参考：https://x.com/Google/status/2110114452955926759 。本轮再次尝试公开页面和公开嵌入入口，仍未获得可核验的视频画面。因此不声称完成逐帧比较，也不宣称已经超越 Google。

第一方方法阅读：
- NVIDIA：Hair Animation and Rendering in the Nalu Demo，https://developer.nvidia.com/gpugems/gpugems2/part-iii-high-quality-rendering/chapter-23-hair-animation-and-rendering-nalu-demo
- PBRT 第四版：Scattering from Hair，https://www.pbr-book.org/4ed/Reflection_Models/Scattering_from_Hair

参考阅读不是完整方法实现声明；没有复制其中的模型、视频帧或商业毛皮纹理。
