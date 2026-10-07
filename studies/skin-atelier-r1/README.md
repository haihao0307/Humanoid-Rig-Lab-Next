# Skin Atelier R1.1 — 程序化肖像研究候选

## 公开网页

https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/f1e9800bebcbd5486b9e252cfcc7f4e15556824d/studies/skin-atelier-r1/standalone.html

固定单文件提交：`f1e9800bebcbd5486b9e252cfcc7f4e15556824d`。
HTML SHA-256：`f131819a50cad45620401ccee059b213c4b804bb075cbda3e5b803e92e68c176`。
HTML 大小 728129 bytes，包含固定 Three.js r169 和 MIT 许可；无外部人物模型或图片贴图请求。

## 当前结论

浏览器运行检查通过。美术质量不通过：不是 Shadowheart 成片的等质复刻。
形体是新编写的参数化候选，不是原作者扫描或雕刻；五官/耳部结构、发束自然度、皮肤微结构与光学仍明显落后。
不能把成功生成、没有着色器报错或较小源文件解释为影视级质量或极低运行开销。
没有给出相似度百分比、普通电脑帧率或手机性能承诺。

## 实测范围

Actions： https://github.com/haihao0307/Humanoid-Rig-Lab-Next/actions/runs/37604337474

在 Playwright 1.55 匹配的 Chromium / SwiftShader 中，从上述公开入口直接加载，无登录或托管确认步骤。
公开 HTML 与固定仓库文件逐字节一致；得到真实肖像和独立眼球渲染截图。
原生鼠标旋转、滚轮缩放、毛孔参数写入、关闭头发、窄屏参数面板检查通过；静止画面不持续重绘。
这次为 420×500 视口、截图像素倍率 1；不是实机手机或普通显卡性能测试，不是全部功能穷尽测试。
运行时统计：2152104 三角面、1131861 顶点、17241 条生成曲线。有限值检查不代表结构正确。

历史验证失败保留于之前工作流：githack 的 HTTP 200 曾实际为安全确认页；高分辨率软件渲染也曾导致近景截图超时。
没有将这些失败抹去，也没有部署或覆盖现有 GitHub Pages 网站。

## 包含与不包含

包含连续头颈曲面、程序化肤色/毛孔/粗糙度、近似散射、发丝/眉睫/绒毛、虹膜/瞳孔/角膜/泪线，以及观察和分层开关。
不包含原作者或 Symbiote 的模型、贴图、Groom、专有算法。
未完成随机游走 SSS、表情/眨眼、牙齿/舌头/口腔动作、内部器官、毛发物理与碰撞。
这是独立静态研究，不是已整合到生产绑定或 NPC 行为系统的正式人物。

## 运行与构建

用户离线直接打开 `standalone.html`。`index.html` 是多文件开发入口，需要正常 HTTP 服务。
`atelier.js` 冻结 R1；`bootstrap-r11.js` 为逐项断言的可读修正；`build-standalone.cjs` 落实修正并内嵌引擎。
构建：`npm install --no-save three@0.169.0`，然后 `node studies/skin-atelier-r1/build-standalone.cjs`。
所有人物曲面与微表面数据在运行时生成，没有保存烘焙人物顶点或角色图片纹理。
画质控制会改变实际像素倍率，较高设置增加显卡负担。

原人物基线：`8b34db7993b27f8cdb40c801a40bf20931d8a416`。
仅独立研究分支：`work/skin-atelier-r1-20261007`。未合并 main，未修改原人物工作台。
继承原库的分区、连续截面和眼球附着方法，不代表继承了已经验收的真实人物外观。

视觉参考： https://blu1304.artstation.com/projects/DLW62R 与 https://www.symbiote.skin/shadowheart 。
