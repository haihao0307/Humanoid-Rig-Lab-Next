# KAOPU 鞋履 R05 · 整形与牛皮

当前任务：接手崩溃的鞋履工作台，在既有整鞋上继续精修，使用用户已有皮革台；不重新设计一双替身。

## 冻结来源

- 鞋履父节点：`dc34864747126361ae6dbb24f83b06e1bed0b96a`，R04 / Draft PR46。
- 旧版永久对照：https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/62d6c3497493200e7fa934fb9760fe08ffd14f35/shoe-workshop/r04/public-lite.html
- 皮料供体：`af389cc216ddd01e3b1aa66c972f42b2587bc797/leather-workshop/r10`；沿用 R04 已锁定的 R02 grain、R05 appearance/seam、R06 catalogue 与扫描材质数据。13项为外观配方，不是13种经过测试的真实皮革强度。
- 原结构老师：https://class.textile-academy.org/2021/sara.alvarez/projects/symbiotic-shoes/04-how/ 。保留原 CAD 数据、作者来源与继承许可证。原例不是已标定的牛皮制鞋工艺。
- UV 方法参考：https://docs.blender.org/manual/en/4.2/modeling/meshes/editing/uv.html 。独立实现 Cauchy–Riemann 最小二乘展开；不是把 Blender 或 Houdini 移植到了网页。
- PBR 接口：https://threejs.org/docs/pages/MeshPhysicalMaterial.html 。材质外观不能替代力学参数。

## 实际改动

原九片、原鞋楦、原鞋底和四个鞋眼保留。P29 是从 P19 轮廓派生的真实厚壳内底皮垫，明确不是原作者提供的第十片。独立厚度、整鞋、拆层、原片、灰模、剖切、部件选择、配方保存/导入/导出均保留。

接缝不再跨过被拒绝的配缝区间；按成形弧长重新布点，允许原马鞍针路生成真实短段。缺少接触依据的区间保持断开，不能解释为整条鞋帮已经受力缝合。削薄按现有成形表面的边距计算，厚度落在实际顶点而非只改滑块。

鞋面使用独立的外观 UV，原纸样坐标及大形变报告不改。粗参数域方向一致不等于细分鞋面或全厚壳无自交。P28 底部仍存在较大的 UV 比例误差，实际细网格 UV 指标单独记录。鞋底下方局部、后短条及全域碰撞没有得到生产批准。

皮革内面使用与供体外面相同的源图均值归一化，避免底图与基色重复染黑，并以哑光肉面角色处理；供体文件不改。保持未削薄区域原鞋楦的平滑法线，避免把原楦离散三角面误显示为皮革折痕。

## 验证与恢复

`source-transfer/restore.py` 根据锁定的原文件哈希和输出哈希恢复可读源码；`refine.py` 是真实网页检查后发现的 P29 选择错误及高光碎裂修正。最终源码由 Actions 提交为普通可读文件，构建清单记录实际文件哈希。传输校验失败不会进入构建。

执行：`node shoe-workshop/r05/tools/build.mjs`，`node shoe-workshop/r05/tests/verify.mjs`。发布后再执行 `--public`，验证固定提交 HTML 完整字节哈希及真实外部浏览器。以 `PUBLIC_URL.txt` 和 `evidence/public/QA.json` 存在且通过为公网交付门槛；仅有本地/旧版记录不算完成。

首轮真实网页检查发现皮垫单选失败，已纳入本轮回归。数值的针孔中心射线通过，不等于整根线都不穿模，也不等于整鞋没有自交。用户视觉验收保持待定；没有足部动态适配、绷楦受力、粘接或制造认证。手机只做390×844视口，不冒充实机。

- [x] 没有用生成图片代替真实三维实现。
- [x] 已实际修改生产源码；几何来自真实运行时，不是静态假画面。
- [x] 当前候选含可交互三维工作台、镜头、选择与参数控制。
- [x] 公网固定链接和最终真实浏览器回归：当前 `evidence/public/QA.json` 已通过。
- [ ] 用户已批准视觉质量：尚未。
- [x] 如果只有截图而没有工作台，本轮判定失败。

不合并、不强推、不改写历史；R01–R04、皮革供体及其他工作台不修改。
