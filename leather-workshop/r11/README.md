# R11 权属边界与独立随机场候选

状态：`SOURCE_IMPLEMENTED_VISUAL_HOLD`。这不是已经验收的网页发布，不是“全系统自研/独占产权”认证。当前公网仍是 R10，R01–R10、原根 LICENSE 和既有第三方声明未修改。

## 本轮实际源码

`site/seed-field.glsl` 和 `site/seed-field.mjs` 是本轮针对项目编写的新整数随机场与 CPU 对照函数。使用四轮加法、旋转、异或混合，不使用原浮点 hash12 算式，也不是对原函数改名或标量转写。仅用于图形采样，非加密随机数。

`build.py` 是新的受控链接器。输入必须逐字节匹配 R10 固定构建 `af389cc216ddd01e3b1aa66c972f42b2587bc797`，SHA-256 为 `7da84eec41b6db9fe69c62ea17a3194283522004df92f47f0cd707d11b642622`。任何未知输入立即失败，不能静默继承其他分支。

链接器在候选外层及两份解压后的兼容工艺页替换四处随机辅助函数，并移除兼容页的 Adobe 远程参考图片及其加载回调；文章来源链接保留。兼容页明确标为已修改的 R11 兼容副本，不冒充未改动的 R02/R05。历史原件不动。

完整 Three.js、Earcut、Poly2Tri、PBD 导数参考和继承项目许可文字随候选的三个页面一同打包，正常界面可展开阅读。扫描纹理的 CC0 来源单独登记。物理 Worker 两段完整代码、扫描图片有效载荷以及包括三角剖分、裁片、缝线、壳厚、蒙皮更新在内的整个几何前缀逐字节保持一致。

## 效果保持边界

不能一边改成新的随机生成方法，一边宣称所有微观纹路逐像素相同。新随机函数会改变程序化毛孔、皮纹、磨损的具体排列。形状、物理和扫描贴图没有更换，不等于程序化材质的视觉验收已经通过。因此 `promotionAllowed=false`，不更新旧固定链接，也不提交候选 HTML 冒充完成交付。

如必须做到全部材质逐像素相同，当前独立随机场替换不能直接晋级；需要在明确合法来源的保留路径和新的视觉验收路径之间解决该约束。不得通过改名、压缩、烧录输出或删除署名，把未知代码包装成独占原创。

## 可复验命令

在仓库目录执行：

```sh
node leather-workshop/r11/qa-seed.mjs
python leather-workshop/r11/qa-rights.py --baseline leather-workshop/r10/public-lite.html
R11_SOURCE_SHA=$(git rev-parse HEAD) python leather-workshop/r11/build.py
python leather-workshop/r11/qa-browser.py --baseline "$(pwd)/leather-workshop/r10/public-lite.html" --browser /path/to/approved/chromium
```

前三项不需要网络。浏览器测试需要 Playwright、NumPy、Pillow 和获准运行的 Chromium。`R11_SOURCE_SHA` 未提供时会明确标识 `UNCOMMITTED-R11-CANDIDATE`，不会拿 R10 源码提交冒充 R11。构建只输出独立候选，不自动部署，不生成 DELIVERY.json。

本轮实际通过：65,536 个 CPU 样本的 10 项分布/边界测试；40 项静态检查，含三页语法、完整声明、旧函数排除和受保护代码字节一致性。均不能冒充 GPU 编译、三维效果或全球法律认证。

本轮浏览器在打开基线前即返回 `net::ERR_BLOCKED_BY_ADMINISTRATOR`，运行时完成检查为零。发布工作流的写入请求也被平台安全检查拦截，没有改路径重试该工作流，也没有绕过浏览器管理策略。相关失败保留在 VERIFICATION_STATUS.json 和测试记录。普通源码提交成功不等于公网交付完成。

## 权利与商业范围

Three.js、Earcut、Poly2Tri 仍是第三方代码，按 MIT/ISC/BSD-3-Clause 条款使用；扫描纹理仍是 CC0。自写业务模块与这些组件的界限记录于 RIGHTS_BOUNDARY.json。不会声称借用的引擎已归我们独占。

现有根 MIT 许可不变，新模块第一次公开发布也在该范围内。自有实现与独家商用不是同一回事。将来确需闭源独占的新模块，必须在首次公开发布前明确其许可范围；不能仅靠更换文件名或许可证收回此前已合法授出的 MIT 权利。本记录不替代作者/雇员/外包权属证明、AI 表达可版权性判断、专利自由实施检索、商标与设计权检查、部署和合同审查。

原始版权与许可来源：Three.js r169 LICENSE；Mapbox Earcut v2.2.4 LICENSE；r3mi/poly2tri.js 固定提交 cb6b2220c70305c6b8c6483f2b1a2ad72616d070；PositionBasedDynamics LICENSE；Poly Haven license。各网址与具体用途见 RIGHTS_BOUNDARY.json。

## 执行清单

- [x] 没有生成图片冒充三维实现。
- [x] 已实际提交独立实现与候选生产链接源码。
- [x] 原三维几何、骨骼无关逻辑、抓手与物理有效载荷保留。
- [x] 原受保护版本不覆盖；没有强推、合并或改写历史。
- [ ] 候选 GPU/浏览器和关键交互验收。
- [ ] 候选公网固定页面验收。
- [ ] 用户批准新的微观随机纹路。
- [ ] 整套系统独占产权与商业法律放行。

本轮只提交源码候选和真实验证状态。未完成上述门禁前，不得标记交付完成，不得拿旧网页、静态截图或新免责声明替代验收。
