# 动物集成工作台 · Animal Atlas V1.2

新增 **排练台**：多个动物当前形态进入共同场景，可编排位置、朝向、跟随 / 接近 / 避让 / 围绕关系和环境光，导出独立演示 HTML 或完整排练谱。当前演示整体位移，原骨骼动作仍在单动物工作台展示。平台负责仓库、接口、展示与移交，动物知识与生成规则由各自模块提供。[仓库与排练台标准、接入流程](docs/WAREHOUSE_STANDARD.md)。

本轮交付门禁：

- [x] 没有用生成图片代替真实三维实现。
- [x] 已实际修改生产源码。
- [x] 交付本体是可交互三维工作台；用户是否已打开不作推断。
- [x] 动物几何与原有姿态来自真实运行时；排练台当前使用烘焙姿态。
- [x] 镜头、选择、动作编排和参数控制可实际操作。
- [ ] 公网固定部署链接尚未建立；本地 file:// 真实后台浏览器已验证。GitHub 源码地址不是部署验收。
- [x] 如果只有截图而没有工作台，本轮判定失败；本轮包含独立 HTML 工作台。

默认导出 **靠谱烘焙 · 当前形态**（`.kaopu-bake.json`），保留基础几何、材质、当前参数和来源，可导回目录。内容封套 `kaopu/content@1` 保存模块知识与扩展；示例在 `examples/warehouse-content.kaopu.json`。网站接收烘焙文件可使用 `dist/kaopu-stage-runtime.js`，或直接嵌入导出的离线 HTML。后台验收：`node tools/test-rehearsal.mjs`。

主界面采用简洁布局：分类与动物目录在左侧，展示区在中央，参数固定最右侧。对象说明、来源与能力边界默认折叠；导入窗口展开“哪些模式可以成功导入？”可查看格式要求。导出格式的用途与限制可悬停查看，或打开右上角“使用说明”。

## 旋转展示台、收藏和删除

19 个动物与导入对象使用参考 Pandanus R05 的深色圆台、自动环绕及主光 / 环境光 / 轮廓光。参数栏固定在展示区最右侧，分开调整对象参数与展示光线。所有动物及导入对象可用左键左右 / 上下拖动观察，拖动时暂停自动环绕。展示区上方有 **添加收藏** 与 **删除**，每张缩略图也有收藏星标；内置删除乐谱可从“已删除”恢复。详见 [旋转展示台与操作说明](docs/ROTATING_DISPLAY.md)。

## 靠谱架构初版 / 导入动物

动物目录新增 **＋ 导入动物**，支持实际三维预览后加入目录：完整 K4/K5 程序化 `.txt` 谱、自包含 `.glb`、`.kaopu.json` 动物包、`.score.json` 乐谱与旧配方。窗口中列出每种格式的成功条件、大小限制、动作能力，并提供可直接导入的示例下载。新增右下角“靠谱乐谱 / 靠谱动物包”导出。

乐器负责生成或运行，乐谱负责形体和参数，按版本与模型 SHA256 匹配。导入对象保存在当前浏览器，刷新可恢复；分享或换浏览器请导出动物包。[初版架构、数据契约与支持边界](docs/KAOPU_ARCHITECTURE.md)。导入验收：`node tools/test-imports.mjs`。

双击同目录的 `打开动物集成工作台.html`，使用支持 WebGL2 的 Chrome 或 Edge。模型、运行时、缩略图均内嵌；不需要服务器或联网。文件约 103 MiB，第一次打开和大型模型切换需要几秒。每次只挂载当前动物工作台，减少 GPU 占用。

使用固定网页入口时，双击 `启动工作台.cmd`，然后访问 `http://127.0.0.1:8924/index.html`。启动器在后台运行服务，已有服务可重复使用；不会启动浏览器或占用鼠标。电脑重启后再次运行即可。仅在本机开放，不向公网发布。日志在 `qa/preview.out.log`、`qa/preview.err.log`。

## 从 GitHub 获取与构建

大文件以 4 MiB 分块保存在 `payloads/`，每块和原文件都有 SHA256。下载本目录后运行 `node tools/materialize.mjs`，会原样还原 `dist/animal-atlas-v1.2.0-offline.zip` 和四个动物源文件。解压 ZIP 后双击其中的 HTML；运行文件仍完全独立。分块用于避免本次网络大文件传输超时，不改变任何模型或运行时。

重新构建：安装 Node.js 后，在本目录运行 `npm install`、`npm run build`。Windows 可运行 `powershell -ExecutionPolicy Bypass -File tools/package-offline.ps1` 更新离线 ZIP 与校验清单。`npm run preview` 提供本地网页入口。

`npm run build` 会先自动验证并还原分块，已存在的本地文件若与清单不一致则停止，防止覆盖本机修改。源码、内嵌模型源文件、第三方依赖与来源记录均在本目录；`qa` 中保留最终 UI 截图及功能检查报告。浏览器收藏、删除记录与新导入动物属于本机用户数据，不随 Git 提交上传。

## 第一版内容

共 19 个动物条目，包含同种动物的不同工作台版本：

- 海洋水域：大型鱼、大白鲨。
- 陆地动物：家猪、中华田园犬、中国狸花猫、家猫动作版、短毛犬参数版、灰虎斑猫参数版、灰狼、北极熊、陆龟。
- 鸟类天空：珠颈斑鸠、白头海雕、密克罗尼西亚椋鸟、帕劳果鸠、白燕鸥、家鸡。
- 岸滩生物：普通螃蟹、椰子蟹。

左侧类别与四列真实模型缩略图，最右侧参数栏切换“对象 / 展示与光线”，中心使用原有三维模型和统一旋转展示台，可切回原栖息环境。支持搜索、收藏、单动物参数保存、恢复默认、参数配方导入。鱼支持单体与原有 30 条独立互动鱼群。没有加入人物模型。

年龄 / 生长需要每个物种真实的生长模型；现有源码没有这些模型，因此明确显示未开放。鸡与 K4/K5 参数动物为静态检查，其余动作沿用各自原工作台。模型本身的质量、参考来源、待验收边界不因平台集成而改变。

## 导出和嵌入

右下角选择格式，再点击 **导出对象**：

| 格式 | 保存内容 | 适合用途 |
| --- | --- | --- |
| `.glb` | 当前姿态的对象网格、基础 PBR/顶点颜色、鱼体内嵌纹理、参数元数据 | 导入其他 Three.js / glTF 网页世界 |
| `.animal.html` | 原有完整模型、材质、动作、展示环境和当前参数 | 独立运行，或嵌入其他网页 |
| `.animal.json` | 动物 ID、源码版本指纹和参数 | 在同版平台恢复继续编辑 |

GLB 排除展示环境，并将对象移到水平中心、底部 Y=0。鱼群演示时 GLB 导出选中的单条鱼；完整互动鱼群请用独立 HTML。GLB 是当前姿态的静态网格，不包含原自定义动画系统、骨架控制器和程序化着色器；需要这些功能时使用 HTML。某些原模型没有真实尺寸标定，Y 向上与米制元数据沿用原工作台建模单位，不能作为动物测量依据。

加载 GLB 的例子（使用你的项目中已配置的 Three.js）：

```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const animal = await new GLTFLoader().loadAsync('/animals/pig.glb');
scene.add(animal.scene);
animal.scene.position.set(0, 0, 0);
```

完整运行时嵌入：

```html
<iframe id="animal" src="./fish.animal.html"
  style="width:100%;height:600px;border:0" title="动物演示"></iframe>
```

独立文件加载完成后提供 `window.AnimalRuntime`。同源 iframe 可调用：

```js
const runtime = document.querySelector('#animal').contentWindow.AnimalRuntime;
runtime.configuration();
runtime.set('group', true); // 鱼工作台专用参数
runtime.playAction('CRUISE');
runtime.pause();
runtime.resume();
```

不同动物参数键和动作 ID 不相同，以 `qa/BROWSER_REPORT.json` 的 controls/actions 为准。跨域网页不能直接读取 iframe 的 window；平台内部另有按窗口和频道校验的消息桥接。API 不会把原动画系统伪装成统一骨架格式。

## 源码与来源

本平台位于独立新目录。`assets/` 是既有工作台源码快照，构建时只在副本内插入显示/参数/导出适配；原动物项目文件未修改。

- [Humanoid-Rig-Lab-Next](https://github.com/haihao0307/Humanoid-Rig-Lab-Next)：鱼 R13、海雕 R07、帕劳三鸟 R04、Cat V4.40、螃蟹 R11；家鸡采用 `codex/chicken-r984-natural-head` 的 R9.8.4 文件。
- [guilin-dem-pipeline](https://github.com/haihao0307/guilin-dem-pipeline/tree/work/kaopu-mammal-r06-cat-dog-integration-20260930)：K5 哺乳动物与 K4 四足动物谱，固定提交 `748f8793ea7ca84c30a2c441b6a63ce5c95ce13a`。
- 本机 FiveSpecies Full Project 最新独立工作台快照：猪 V3.5、田园犬 V3.3、狸花猫 / 斑鸠 V3.6、鲨鱼。对应 `assets/life-*.html`。

具体原始与适配后 SHA256、来源说明、构建时间和成品指纹保存在 `SOURCE_MANIFEST.json`。原动物文件的作者、参考模型、许可和声明均保留在各自完整 HTML 中；集成不会改变它们。`assets/chicken-r91.html` 是探索阶段保存的旧快照，不参加构建，实际使用的是 R9.8.4。

`vendor/three*.js` 为 Three.js r180（MIT）；测试用 GLTFLoader 与 BufferGeometryUtils 来自 [Three.js 官方 r180](https://github.com/mrdoob/three.js/tree/r180/examples/jsm)。其余 `vendor/mammal` / `vendor/quad` 是上述提交的原始动物引擎和谱。没有为平台额外下载第三方动物模型。

## 开发与验证

`src/catalog.js` 管理条目和能力；`src/bridge.js` 适配原运行时；`src/native.js` 承载原 K4/K5；`src/reference-water-entry.js` / `src/reference-water-runtime.js` 接入参考海底；`src/beach.js` 承载 Tidewater 沙滩适配；`src/glb.js` 打包静态对象。

```powershell
npm install
npm run build
npm test
npm run test:exports
npm run test:studio
npm run test:mouse
npm run test:imports
```

当前电脑可复用已安装的 esbuild 和 Playwright，无需安装也可以运行脚本。构建不下载模型。浏览器验证在后台无头模式运行，不占用桌面鼠标。

- `qa/BROWSER_REPORT.json`：19 条目加载、可用参数/动作、实际画布和错误检查。
- `qa/FUNCTIONAL_REPORT.json`：19 个真实 GLB 下载、二进制顶点/索引检查、官方 GLTFLoader 重新载入并渲染；每种适配器及全部生命世界独立 HTML 参数与暂停状态往返验证；分类搜索、30 鱼群、快速切换、移动布局检查。
- `qa/exports/*-imported.png`：导出文件重新导入后的实际截图。
- `qa/fish.png`、`qa/pig.png` 等：当前平台的真实后台截图。

这些是集成和导出功能检查，不是原模型造型质量或生物行为真实性的认证。


## 海底与沙滩更新

海底参考场景、Tidewater 的固定提交与许可证、具体复用算法、自有程序化优化和兼容范围见 [场景移植说明](docs/SCENE_MIGRATION.md)。改动涉及的对象已经接入场景开关；鱼与鲨鱼开放水体和海草参数。构建前运行 `node tools/prepare-reference.mjs`。

## 本次归档范围与验收边界

本次将已完成的 V1.2 工作台归档到总仓库的 `animal-atlas/` 新目录，保留已有动物与人物源码，不将归档当作新的模型制作或视觉验收。

- [x] 没有用生成图片代替真实三维实现。
- [x] 已实际修改生产源码；本次上传保存已有改动。
- [x] 用户看到的是可交互三维工作台。
- [x] 动物几何、骨骼和动作来自真实运行时。
- [x] 镜头、选择、动作与参数控制已有实际操作检查。
- [ ] 公网固定工作台链接未部署；真实浏览器和本地离线运行检查已完成。
- [x] 若只有截图而没有工作台，则不能判定完成；本目录同时保存运行时、源码及独立 HTML 压缩包。

原始 standalone HTML 仍可双击打开，核心运行不依赖服务器或外置资源。GitHub 中保存 ZIP 只是规避普通 Git 单文件大小限制。机器检查不代表用户已批准所有物种的形体质量，`visualAcceptance` 与 `productionReady` 不自动升级。

## 灰白训练台与活动烘焙

工作台导出“靠谱烘焙 · 形态与生命活动”，在排练台点击“导入对象 / 排练谱”。保留形态参数，有原生动作的动物默认继续生命活动，右侧可暂停单体或选择原生动作。静态模块保持静态。排练台为灰白、明亮、无网格空间，可调光线。完整排练谱和独立 HTML 都携带活动运行器，导出页可离线运行。详细格式与版本要求见 docs/WAREHOUSE_STANDARD.md。

后台检查：`node tools/test-live-rehearsal.mjs`。
