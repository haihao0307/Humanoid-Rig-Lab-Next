# KAOPU 鞋履工坊 R14

本轮按用户“开始执行吧”的指令落实 R14 计划，改善 Canvas 附件弯折、Chelsea 筒根轮廓与 Monk 静态扣合。四种程序鞋型与原 R10 鞋款、12 组原款配方仍在同一工作台。

## 当前交付状态

源码候选已经通过实际几何、材料坐标、单体文件浏览器与独立 AI 视觉审核，见 [VISUAL_REVIEW.json](VISUAL_REVIEW.json)。最终可直接双击的交付本体是本目录 `public-lite.html`；固定公网入口将写入 `PUBLIC_URL.txt`。公开版本的真实浏览器与独立视觉核验正在执行，两个入口必须来自同一份通过检查的构建字节。

- 本轮源码：`4306b375404a40b7b9842f29cfa5e53fcde70278`，见 [草稿 PR #94](https://github.com/haihao0307/Humanoid-Rig-Lab-Next/pull/94)。
- 实际 CI：[39108047375](https://github.com/haihao0307/Humanoid-Rig-Lab-Next/actions/runs/39108047375)，158 项几何、67 项构造/弯折、66 面板材料、8 个浏览器功能组通过。
- 生产基线：`0f105165964795b4895c3a5d8d2440deac1add91`。
- 冻结计划：`ec7d80c9f99dc978735245d463306075f5a287d5`，见 [PLAN.md](../plans/r14-20261018/PLAN.md)。
- 工作分支：`feature/shoe-r14-construction-and-flex-20261018`，仅 Draft PR，不合并、不强推。
- [研究依据与方法](RESEARCH.md)。[检查与调整记录](AUDIT.md)。

## 本轮变化

Canvas 从最终金属、两层孔沿和鞋带端环建立联动范围，使用整鞋共用的连续角度场；鞋眼保持刚性，法线包含完整变形导数。鞋襟第三排有限孔径的映射另作局部非线性修正。

Chelsea 在原共边采样行之间调整筒根过渡，皮革、松紧片和针脚同步生成，保留鞋头、踝口、拉环与域外形状。Monk 修正带根/覆盖片、扣座/后帮和扣针/带孔关系，并以项目自有的静态双柱连接固定原金属框。

五金近看镜头用于观察真实附件。可继续选择鞋款、双鞋、四款对照、灰模、剖面、线框、拆件、部件隔离、尺寸/厚度/弯折以及配方操作。

## 验证入口

开发验证使用 `npm run build`、`node tests/geometry.mjs`、`node tests/material-coordinates-audit.mjs evidence/MATERIAL_COORDINATES.json`、`node tests/construction-flex.mjs --output evidence/CONSTRUCTION_FLEX.json` 和 `node tests/browser.mjs`。这些命令只供维护者复验，用户直接双击单体 HTML 即可运行。

R13 的 44 份源码、测试、文字证据与单体 HTML，R12 的 27 文件，R10 的 22 文件受精确字节保护。旧截图只作为 BEFORE，当前结果须由本次源码新渲染。生产者不能批准自己；数值、视觉、浏览器、公开字节与用户批准分开记录。

## 限制

当前为程序构造与几何检查，未完成材料物理、穿着适配、制造放码或实物实验。Monk 双柱安装是本项目设计，不声称复制商业参考鞋的隐藏安装方式。保留原材料与照明设置。R13 的历史 UV 统计异常仍标记为根因未解，原 1% 门槛不变。

## 工作台硬门禁

- [x] 没有用生成图片代替真实三维实现；
- [x] 已实际修改生产源码；
- [ ] 用户看到的是可交互三维工作台；
- [x] 人物/动物几何、骨骼和动作来自真实运行时；本轮只涉及鞋几何，人物/动物骨骼不适用；
- [x] 镜头、选择、动作或参数控制可以实际操作；
- [ ] 公网固定链接和真实浏览器已验证；
- [x] 如果只有截图而没有工作台，本轮判定失败。
