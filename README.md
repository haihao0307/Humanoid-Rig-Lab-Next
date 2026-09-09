# 函数生成人体工作台

人体由截面、曲线、骨骼关系和数值参数生成。交付文件不含预制网格、扫描模型、图片贴图、烘焙顶点数组、动作捕捉文件或语音模型。WebGL 在运行时生成显示缓冲区；`index.html` 中压缩的是可读 HTML/JavaScript 源码。

这是程序生成版本，外形不承诺复现此前的参考模型。器官、血管与神经为函数生成的示意结构。个体解剖准确性、运行表现及视觉效果尚未验证。

## 打开与修改

Windows 双击 `1_启动贾维斯.cmd`；macOS / Linux 运行 `python3 server/start_server.py --open --page index.html`。本地服务需要 Python 3.9+。浏览器需要 WebGL2 和 DecompressionStream。

可用功能包括男女母体、关节与局部形体、肌肉能力、连续皮肤和分层、毛囊与短发、基本动作、场景编辑、语言控制及简化热环境响应。语音识别为可选安装，相关组件与模型存放在工作台之外。

编辑源码后，使用 Node.js 24 装配和检查文件：

```sh
node tools/build-pure.mjs
node tools/check-pure.mjs
```

这些命令只读取、解析和装配文件，不启动网页、模拟、浏览器或 GPU。只保留一个生成入口 `index.html`，不保存额外的运行时副本。

| 文件 | 职责 |
| --- | --- |
| `source/assembly.json` | 唯一装配清单 |
| `source/runtime.template.js` | 数学、关节、人体主类、渲染和行为的装配骨架 |
| `body/` | 人体截面、肌肉附着、皮肤、毛发、形体和生理参数 |
| `source/*.template.html` | 工作台、身体与认知页面的可读模板 |
| `control/`、`language/`、`voice/`、`ui/`、`visual/`、`world/` | 装配清单实际使用的功能源码 |
| `server/` | 本机服务和可选语音组件安装代码 |

皮肤与内层共享同一变形表面；区域厚度向内构建边界。肌肉容量影响对应半径、下肢组织场和出力估算。上述耦合为有边界的工程近似，不是完整生物力学仿真。

## 人物配方与靠谱方法

“人物设置 → NPC 母体 → 导出人物配方与依据”生成 JSON；也可以调用 `HumanLab.dna.export()`。定义保存身份、种子、比例、能力和生成函数引用，瞬时疲劳与热状态另列。配方不保存生成网格。相同生成版本下可用 `HumanLab.npc.preview(document.definition)` 重建人物定义；当前不支持动画状态续播。

`body/HumanDNAContract.json` 固定了所读取的 KAOPU / TLO / Object DNA 文件版本与 Git blob 哈希，保留 Observation、Claim、来源关系、单位、坐标、时间、Unknown 和验收状态。它是本项目的候选适配器，不宣称实现了正式通用 KAOPU 编码。

学习来源：

- [靠谱命名与最小语义](https://github.com/haihao0307/guilin-dem-pipeline/blob/f254721b7e3e23cb35b7b660fa9441dc6cef9796/docs/mother_coordination/world_knowledge_lab_v1/core/KAOPU_FORMAT_DECISION_R1_20260909.md)
- [Object DNA 规则与参考资产分离](https://github.com/haihao0307/guilin-dem-pipeline/blob/f254721b7e3e23cb35b7b660fa9441dc6cef9796/docs/mother_coordination/world_knowledge_lab_v1/core/OBJECT_DNA_CORE_CHARTER_R1.md)
- [Pixar OpenSubdiv](https://www.pixar.com/technology-libraries)：参考细分曲面方法，项目使用自己的截面与拓扑生成代码。
- 人体关系与皮肤、毛囊参考分别见 `body/HumanBiology.json`、`body/SkinLayerProfiles.json`、`body/HairFollicles.js`。其中工程系数和个体测量有明确区别。

本次仅做文件解析、依赖核对、压缩还原和哈希验证；`runtimeVerified=false`、`visualAcceptance=false`、`productionReady=false`。

## 仓库范围

当前 `main` 保存本人物工作台。鸟类与鲨鱼继续使用原分支：[鸟类](https://github.com/haihao0307/Humanoid-Rig-Lab-Next/tree/experiment/procedural-bird-language-lab-v1)、[鲨鱼](https://github.com/haihao0307/Humanoid-Rig-Lab-Next/tree/experiment/shark-ocean-agent-v1)。旧主分支内容保留在 Git 历史中。
