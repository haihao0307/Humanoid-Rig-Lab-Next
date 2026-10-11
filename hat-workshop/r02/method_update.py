"""Append the concrete takeover/feedback rules without replacing V1.1 or old production files."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parent
REPO=ROOT.parents[1]
DOCS=REPO/'docs/workbench-build-system'
DOCS.mkdir(parents=True,exist_ok=True)
text='''# 工作台接手与反馈闭环增补（帽子 R02 实作）

日期：2026-10-11。增补于既有 V1.1，不废弃复刻优先方法，不声明其他分支已自动采用。

## 用户本轮给出的实际要求

从固定提交 `448f503fe17536583e0c64d58123b67ae578f4d0` 的 `hat-workshop/r01/index.html` 接手；先实际修改帽子工作台并交付网页，用户看过后再提出修改意见；继续修帽子时，从真实对话中提取信息，补充平台框架规则；直接修改 GitHub。

本轮还没有收到用户对 R02 外观的评价。下面的缺陷来自源码、自检和旧分支已披露问题，不能写成用户已经确认的新意见。未来意见栏保持 pending。

## 1. 冻结“看见的是哪一版”，不只冻结分支名

接手记录必须同时包含：用户网页 SHA、该构建的源码 SHA、当前分支 head、原有失败项和保护范围。读现有交接记录后核对真实文件。分支 head 可能只追加文档，不能把文档提交误称新画面，也不能用更新但未验证的模型替换用户指定基线。

本例 R01 固定 HTML 的 SHA256 为 `41cd9a3059ffb66c41e2c7c7badce2eee63ebb07e4ab42facf76cdfd2c707568`。R02 从已读的 R01 最新记录节点 017b9cde 分出，但读取的网页必须仍逐字节等于上述基线。原 R01 目录、人物来源数据和其他工作台不改。

## 2. 建好框架不等于自动具备顶尖质量

把“许可可用的资产老师”“顶尖视觉老师”“代码方法老师”分别标记。现有 MakeHuman 帽型可以保住三维与来源链，但不能仅因代码可取得，就把它认证为影视级标杆。迁移到另一个渲染器也不是原渲染器的一比一复刻。

框架应要求每轮指出最大可见差距和具体样本。普通执行者仍会受到老师的资产质量、UV、法线、渲染依赖、显存、网络、接触求解和人工视觉审核约束。方法文件不是无人值守执行器，不能保证任意对象快速达到最终质量。

## 3. 大目录不得拖住第一件可操作对象

分别记录：HTML 本身字节、首件所需资源总字节、首帧、可交互时刻、完整目录就绪时刻、切换延迟、测试设备。不得以“页面外壳很小”冒称全套内容很小或瞬时加载。

公开页面可按需读取固定提交下的资源；每个包保留内容哈希并校验。离线单体 HTML 保留相同几何与完整贴图，另做 file:// 零核心网络测试。公共轻入口与离线入口是两种交付形态，不相互冒充。不能靠缩小法线贴图或更换低质量模型来掩盖加载问题。

三维缩略图可在构建阶段由同一份真实数据渲染并缓存；它们不是对象本体，点击后必须打开真实可转动、可检查的模型。禁止把来源照片或生成图冒称运行时三维。

## 4. 对象切换是资源事务，不只是换一个名字

新对象的网格、贴图和头形应在验证完成后提交；过期异步结果丢弃并释放，失败保留上一件有效对象。无效 ID 不得把 busy 永久置为 true。部分贴图失败也必须释放已成功分配的资源。缩略图失败只影响该项，不阻断主视图。

回归至少包含：快速连续点三件、无效对象、材质加载错误、三种头形、重复切换、导入非法参数、旧版配方的明确迁移或明确拒绝。不允许 silent fallback 冒称新对象已载入。

## 5. UV、几何、材料和贴合的修正分别验收

R01 的细分移动了几何顶点，却保持原 UV 顶点不动。R02 在针织帽上试验保持接缝身份的连续 UV 细分；原纹理和运行时顶点字节保持，原 UV 保留在对照模式中。是否改善可见翻边仍须查看原版/候选实际图，不由“算法正确”自动批准。

空顶帽的头部贴合从原有整头宽深倍率，增加基于原头形水平截面包络的受限静态校准。测到的是默认姿势下的顶点及三角形中心采样，不是精确连续碰撞、软组织压力或佩戴舒适度。不得缩小头部来隐藏穿插，不把三个静态样本当成 36 人物实时接入。

## 6. 用户反馈先成为可重现缺陷，再成为规则

一条反馈保存：用户原话或有标记的摘要、日期、帽型/样本、网页及源码版本、镜头、配方、要保护的部分、具体不接受之处、假设、改动文件、失败与复测证据、当前范围内的验收状态。

流程：真实反馈 → 定位可重现问题 → 小范围改动 → 相同条件前后对照 → 加入回归 → 用户审核 → 仅对被确认范围更新认可基线。

不能预填未来反馈、把助手自查写成用户意见，或让用户填写底层参数解决算法问题。网页反馈记录只保存在本机，导出包含配方与相机；没有暗中上传，也没有自动提交 GitHub。用户在对话里直接描述同样有效，执行端负责补齐内部记录。

只有可迁移的根因进入通用规则。某款帽子的原点或 9 mm 前移属于该样本配方，不能变成所有帽子的通用常量。

## 7. 机器通过、视觉接受和物理就绪分别记账

测试数、提交数、文件数不代表质量。至少分别保存 `runtimeVerified`、`sourceFidelityReviewed`、`userVisualAccepted`、`staticFitSampled`、`continuousCollisionVerified`、`dynamicWearVerified`、`physicalPhoneVerified`。

同一助手自查属于 self-review，不写成独立专家批准。手机 390×844 是视口模拟，不是手机实机。网页外壳加载、canvas 非空、截图采样、参数响应、真实形态是否好看，属于不同证据层。

## 执行文件

帽子实现：`hat-workshop/r02/upgrade.py` 生成可读 app.js 与 shell.html；`build.py` 保留来源并构建两种入口；`qa.py` 执行真实浏览器测试；`CORRECTION_REPORT.json` 记录静态采样范围；`DELIVERY.json` 仅在公网实际验证完成后写入。

首次交付后的下一步是等待用户对该固定网页的具体反馈，不自动假设认可，也不启动无关物理或其他工作台重写。
'''
(DOCS/'FEEDBACK_LOOP_HAT_R02.md').write_text(text)
for path,addition in [
 (REPO/'WORKBENCH_BUILD_SYSTEM.md','\n\n## 帽子 R02 实作增补（2026-10-11）\n\n接手和用户反馈按[工作台接手与反馈闭环](docs/workbench-build-system/FEEDBACK_LOOP_HAT_R02.md)执行。保留V1.1复刻优先主线；新增固定网页与源码身份核查、首件加载与完整目录分开计量、异步对象切换事务、原版/修正版对照，以及真实意见转缺陷/回归/规则的流程。用户尚未评价R02，不预填认可。\n'),
 (DOCS/'RUNBOOK.md','\n\n## 接手后的先交付、再反馈、再完善规则\n\n使用[帽子R02反馈闭环增补](FEEDBACK_LOOP_HAT_R02.md)。当前明确范围内先修源码并验证固定网页；用户反馈由执行端绑定版本、配方与镜头，形成回归后再提炼通用规则。网页能运行不等于影视级，静态采样不等于动态碰撞，未来反馈保持pending。\n')]:
 content=path.read_text()
 if 'FEEDBACK_LOOP_HAT_R02.md' not in content:path.write_text(content+addition)
record={'schema':'kaopu.workbench.feedback/1','userObservation':None,'status':'awaiting-user-feedback','source':{'baselineSha':'448f503fe17536583e0c64d58123b67ae578f4d0','headAtTakeover':'017b9cde7ad56f803b25d6ab59b2f881741eb3e5'},'objectId':None,'recipe':None,'camera':None,'protectedFeatures':[],'hypothesis':None,'changedFiles':[],'regressionEvidence':[],'userAccepted':False,'scopeOfAcceptance':None}
(ROOT/'FEEDBACK.template.json').write_text(json.dumps(record,ensure_ascii=False,indent=2))
(ROOT/'SESSION_LOG.md').write_text('''# 帽子工作台 R02 接手记录

2026-10-11，用户指定448f503f的R01页面接手，要求先修并交网页，再按其实际反馈继续修改，同时把经验补入平台规则，直接提交GitHub。

已读旧Draft PR #37、R01生产源码与manifest、旧实际浏览器artifact、根AGENTS、WORKBENCH_BUILD_SYSTEM V1.1及RUNBOOK。最新旧分支记录017b9cde没有改变用户给出的网页字节。

本轮修改范围：独立r02目录、专用工作流、方法增补与入口追加。旧r01、人物源数据、皮革/裁缝/鞋履等其他工作台冻结。修正内容包括连续UV细分、三头形空顶帽静态校准、轻量公网入口与无损按需包、异步选择/回滚、原版对照、配方迁移和反馈记录。

本地数值试验只是一份self-review，不能替代浏览器视觉判断。最终构建和公网证据以本目录qa及DELIVERY.json为准；DELIVERY不存在或publicVerified不为true时，网页交付仍未完成。

用户对R02视觉反馈：pending。没有虚构其他员工意见或独立专家批准。物理碰撞、头发、实时36人物集成和影视级最终质量均未被本轮认证。

- [x] 没有用生成图片代替真实三维实现。
- [x] 实际生产源码由upgrade.py生成并随构建提交。
- [ ] 用户视觉认可（待用户测试）。
- [ ] 物理/动态穿戴认证（本轮范围外）。
- 公网和单体真实浏览器门禁必须由qa与DELIVERY记录，不能由本文预填通过。
''')
(ROOT/'README.md').write_text('''# KAOPU Hat Atelier R02

接手固定R01，保留11款原帽型及原2K颜色/法线字节。运行`python hat-workshop/r02/upgrade.py`生成app.js与shell.html，`python hat-workshop/r02/build.py --assets`校验并派生无损资源；`--pages --data-sha <fixed SHA> --source-sha <source SHA>`生成轻量index.html和单文件standalone.html。

公开页面只在用户选择时加载对应帽型，试戴才加载静态头形。所有外部包地址为固定SHA并由浏览器校验SHA256。单体HTML包含相同资产，独立执行file://测试。三维目录缩略图由该运行时在构建阶段渲染，不使用生成图片或来源照片替代模型。

原R01位置数据、颜色贴图、法线贴图不改。针织帽的UV修正及空顶帽静态校准可关闭，也可按住对照。修正不是“影视级通过”或“物理通过”。本轮意见记录本地保存且可导出，不自动上传。

构建、QA、固定网页和SHA：见BUILD_MANIFEST.json、CORRECTION_REPORT.json、qa/local/report.json、qa/public/report.json与DELIVERY.json。不存在DELIVERY或publicVerified不是true时，公开交付未完成。

方法增补见 ../../docs/workbench-build-system/FEEDBACK_LOOP_HAT_R02.md（仓库根docs路径）；下一步仅依据用户对固定网页的实际反馈继续修，不预填认可，不合并或强推。
''')
print('Updated two method entry points and wrote scoped feedback rules; user acceptance remains pending.')
