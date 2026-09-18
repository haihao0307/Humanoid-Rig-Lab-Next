# 人物亚麻裙 R1

本轮把 GitHub 人物项目已有草裙替换成真实三维亚麻裙。入口为 `linen.html?linen=1`；使用 `node server/linen-server.cjs` 启动后，打开 http://127.0.0.1:8792/linen.html?linen=1 。也可双击根目录 `start-linen.cmd` 启动服务。

## 来源与实现

- 基础仓库：`haihao0307/Humanoid-Rig-Lab-Next`，分支 `upload/human-workbench-20260915`，本地基础提交 `2c10edaec6e8515bc64f9df8b3da78cb34c89e61`。
- 本轮联网读取并核对了 [原草裙文件](https://github.com/haihao0307/Humanoid-Rig-Lab-Next/blob/upload/human-workbench-20260915/body/ProceduralGrassSkirt.js)，Git blob 为 `043f8012f3c2c9795e4b8ed05c8665ee64318abb`，与本地基础文件相同。
- 当前工作树和本地分支为 `Human-Linen-Skirt-Workbench` / `feature/linen-skirt-20260918`。人物面部、皮肤、骨骼和动作源码沿用该基础版本；没有改其他工作树。
- 新增 `body/ProceduralLinenSkirt.js`。裙面由八个独立材料坐标的裙片、内侧表面、翻入的边缘、腰头及下摆组成，约 40.5 cm 长、0.9 mm 厚。共 12,704 个三角形，不再包含原来的 256 条草叶。没有画虚线来代替接缝。
- 裙体由原人物皮肤尺寸生成，继续使用每个人的骨盆 / 大腿关节纹理和几何避让。内外层避让半径保留层间偏移，避免压到同一位置。
- 亚麻布使用布料工作台粗织亚麻的程序化经纬组织、纱束差异和按像素覆盖范围过滤的方法，来源哈希保存在 `LINEN_MATERIAL_SOURCE`。不使用图片贴图或外来人物 / 裙子模型。
- 材料坐标使用厘米，各片各自建立经纬坐标。消费端投影切线到平滑法线、加入环境补光，并把场景阴影只用于对应的主光贡献。人物预览使用覆盖人物的阴影范围，避免军营大范围阴影图在裙面上产生大块采样痕迹。原冻结材料包没有修改；这里的实际着色器包含上述适配，不能称其运行字节完全未变。

## 可交互内容

2026-09-18 纹理尺度调整：按用户要求将程序化布纹的两个方向都放大为原来的 3 倍，使用原厘米坐标除以 3 后采样。经纬、纱节及材料色差同步放大，镜头、裙形和材质基础色参数保持原值；`skirt.report.textureScale` 记录当前倍数。该版截图和检查记录位于 `../linen-skirt-texture3x-20260918/`。

可查看全身、正面、侧面、背面、裙子和布纹近景；拖动旋转、滚轮缩放、右键平移沿用人物工作台。转身按钮调用实际人物动作系统。可切换纯色预览和原场景。独立裙子入口只初始化一个人物；原 `index.html` 仍保留完整人物工作台。

`linen.html` 由同一份人体运行时装配，不是截图展示页。源码修改后执行：

```powershell
node tools/build-pure.mjs
node tools/build-linen-preview.mjs
node tools/check-pure.mjs
```

## 验证边界

实际浏览器 QA 使用后台 Chrome / ANGLE SwiftShader，检查站姿正背面、近景、转身按钮和窄屏。证据目录在工作树之外：`../linen-skirt-final-20260918/`，其中 `QA.json` 记录入口哈希、脚本错误、交互状态和截图名称。旧检查过程保留在同级 `linen-skirt-review-*`、`linen-skirt-layer-fix-*`、`linen-skirt-diagnostics-*` 和 `linen-skirt-shadow-fix-*` 目录，不能代替最终版本的证据。

这是一条穿在原人物上的可交互蒙皮裙。裙片没有经过真实裁片缝合求解，褶皱由几何函数生成；重力悬垂、缝线张力、任意动作布料碰撞和跨硬件实时预算未验证。当前任务是替换裙子外观及材质接入，不把本轮结果写成布料物理系统已经稳定。

2026-09-18 用户已要求提交并同步到人物开发分支 `upload/human-workbench-20260915`。标准 `index.html` 的所有人物通过共享 `CompactSurfaceRenderer` 默认创建同一款 3 倍织纹亚麻裙，独立 `linen.html?linen=1` 用于材质观察。

合入时以远端人物提交 `e32f2f30f6922fc5faded6b4f944d7b33ee893dc` 为基础，保留面部 R10 及单人面部审阅入口。已在完整 `index.html?qa=1` 中实际生成默认六人，六人的 `textureScale` 均为 3，草叶数量均为 0，页面脚本错误为 0。检查包含普通场景和裙子正背面、近景；截图在 `../linen-human-integration-20260918/`，可复核的结果摘要见 `docs/qa/linen-skirt-integration-20260918.json`。本次没有扩展任意动作布料物理的验证范围。
