# 完整灰模动作绑定研究记录（2026-11-15）

## 范围与状态

本目录是隔离研究，人物基准是 `Photo-Body-Skin-R01-20261112/default-head` 的统一灰模函数生成显示；未改写另一边人物源码、已有动作工作台或引擎。用户允许将既有人物函数生成三角面作为实时显示候选；这里使用的显示网格、来源推导权重和阶段算子不等于直接函数求交，也不声称原函数母体转换完成。

本次已建立同一人物默认形态下的动作骨架、身体与头部控制计算、颈口修正和原面部处理的可重复研究路径。它尚未满足工作台播放和可视验收要求：原始高精细表面程序仍有大量逐帧 CPU 运算与显卡读回，实际慢得不能流畅播放；手指姿态、脚底、接缝和原示范动作还须进一步逐动作比较。严禁依据这里的测试把 `releaseReady`、`visualAccepted` 或表面绑定状态改成真。

## 具体结果

- `research/gray-action-skeleton.mjs` 使用固定人物形态计算完整骨架、头和颈的原始矩阵。`review/gray-action-skeleton-live-source-check-20261115.json` 中三个来源动作的八个姿态，身体、头与颈矩阵和原程序逐项一致。`review/gray-action-skeleton-all-library-sample-check-20261115.json` 对现有每个动作的头颈及来源中已有的手指轨道，检查二进制散列并运行首、中、末帧；这不是全动作身体表面、视觉或接触验收。CMU 来源本身只有粗粒度手指组，不可声称具有独立指节轨道。
- `research/gray-action-controls.mjs` 提供一个研究入口，将已核验的默认人物身份、动作骨架、头身控制和颈口阶段接在一起，姿态输入后只输出控制点；它不包含原面部后处理、细分画面或正式引擎格式。入口及损坏/版本拒绝检查见 `tools/test-gray-action-controls.mjs`。`review/gray-action-controls-all-library-sample-check-20261115.json` 另对每个动作首、中、末帧将其现有头颈/手指轨道通过骨架、头身控制和颈口修正；其余身体关节保持默认，故不等于完整动作或表面验收。
- `research/gray-cpu-controls.mjs` 使用固定形态的身体原函数显示控制数据、头部原权重及源派生偏移；`research/gray-display-neck-corrector.mjs` 按原顺序执行颈口、平滑和完整谐波。`review/gray-cpu-precontour-baseline-check-20261115.json` 对默认基准头身控制点逐分量一致。`review/gray-independent-skeleton-complete-surface-diagnostic-20261115.json` 从独立动作骨架出发，对三个实际姿态加入原人物身份、头型/眼睑、面部和嘴部处理后，原始细分表面位置及法线逐分量一致。另外对行走、奔跑、跳跃、踢腿、持枪等六个动作各取一帧，`review/gray-independent-skeleton-six-actions-source-check-20261115.json` 的位置及法线也逐分量一致。另对开门、爬梯、坐下起身、俯卧和跳跃各取一帧，见 `review/gray-independent-skeleton-npc-actions-source-check-20261115.json`，位置及法线也逐分量一致。这些只是限定默认人物的十五个姿态的源程序回放对照，不证明连续动作、全视角或动作库视觉通过。
- `research/gray-body-control-skin.mjs` 和 `research/gray-head-precontour-skin.mjs` 是独立显卡控制点实验。其浮点差异虽小，却可在眼部微小面片法线上放大，见 `review/gray-original-phase-order-diagnostic-20261115.json`；目前不可替代高精度路径或发布。
- 身体旧运行时默认打开额外关节体积修正，直接用它与原人物基准对应会产生偏差。实验关闭该层后，`review/gray-body-unmodified-coordinate-diagnostic-20261115.json` 的身体控制点在默认基准逐点精确对应；早期 `gray-body-raw-control-selectors-*` 和 `gray-body-exact-coordinate-diagnostic-*` 未通过，不能使用。
- `review/gray-body-digits-gpu-check-20261115.json` 对每根指节、掌骨及脚趾的源权重做逐关节影响检查；这是对控制点的独立数值检查，不是弯曲手型、脚底接触或画面验收。
- `review/gray-function-corner-resolution-20261115.json` 对三个待定口部显示角点恢复原函数方程并核验整个来源面；`review/gray-face-incidence-audit-20261115.json` 核验全部灰模显示面对应和朝向。其余显示对应仍是源派生候选；这些检查不证明完整原表面复刻验收。 三个不同动作的同机位离屏截图也与原程序逐像素相同，见 `review/gray-independent-preview-pixel-check-20261115.json`；不代表完整动态或接触通过。
- `tools/test-gray-independent-controls-preview.mjs` 不逐帧运行原人物完整 `compute`，而以动作骨架与控制点生成姿态，再调用原有的细分表面处理；在当前机器三个样本完成帧约 1.9–2.3 秒，见 `review/gray-independent-controls-motion-probe-20261115.json`。这是隔离试验的完成帧耗时，不是现有工作台 FPS，也未满足实时播放要求。新生成的画面在 `review/gray-independent-controls-probe-*.png`，可看见完整灰模，但不能以单张图片验收手脚接触或动态。
- 灰模专项隔离试验暂时跳过皮肤材质字段同步；`review/gray-no-skin-fields-comparison-20261115.json` 的三个样本位置和法线相同，`review/gray-no-skin-fields-preview-pixel-check-20261115.json` 的三张截图逐像素相同。与独立骨架组合后，`review/gray-independent-no-skin-fields-motion-probe-20261115.json` 记录三个完成帧约 0.82–0.88 秒；这些是不同进程的单帧试验，不能当持续播放 FPS。切换到需要皮肤的材质时必须恢复并重新准备原字段，目前尚未实现和验收切换，不可作为正式工作台优化。
- 灰模去除皮肤字段后的耗时定位见 `review/gray-no-skin-fields-deep-profile-20261115.json`：当前机型样本中嘴部细分和嘴部处理合计约 0.23 秒、鼻唇区域细分约 0.21–0.24 秒，后续还要处理其他层及完整绘制；这些是单帧阶段耗时，不可加总为各设备的固定时间或帧率。`research/gray-only-field-gate.mjs` 是隔离实验；实际从灰模恢复时，几何和耳部字段一致，但面部毛孔索引与数据不一致，见 `review/gray-only-field-gate-live-check-20261115.json`。原程序不经过灰模门控、姿态来回后字段一致；强制清除耳和面字段缓存后重测仍不一致，故原因尚未查明。见 `review/gray-original-material-repeat-check-20261115.json` 和 `review/gray-only-field-gate-live-r2-failed-20261115.json`。因此研究入口阻止直接切回皮肤，不得合并；需先查明原程序状态并完成恢复后的材质外观验收。
- `tools/build-gray-mouth-transport-cache.py` 生成的隔离口部缓存，在嘴部参数启用的四个样本中，复用和参数切换后重建均与原程序位置、法线逐项一致，见 `review/gray-mouth-cache-reuse-check-20261115.json`。默认嘴部参数没有触发该缓存，所测样本也未证明完整帧明显提速；不得将其作为默认播放加速或可发布方案。
- 整头刚性跟随会造成严重误差，`review/gray-rigid-head-diagnostic-20261115.json` 的抽样中最大偏差达厘米级；不能将头部作为一个刚体接入，也不能仅凭头部初始姿态的截图验收。

## 使用边界与下一步

当前数据固定特定默认人物状态，体型、眼部、面部或档案变化必须使绑定失效并重新准备。为让动作骨架驱动头颈，研究状态使用 `owners.headRig=body`；原 `gnm` 头颈控制在此模式下的效果尚未迁移，不能因档案字段存在便宣称兼容。三维显示网格、源参考 ID、源派生形态和修正数据均须保留各自来源及版本身份。

原显示链依次包含身份处理、头型/眼睑、面部结构、延后嘴部处理及细分。不要绕过任何阶段或放宽误差掩盖裂缝。下一步应在数值及多视角逐项对照的前提下，迁移或加速这些阶段与法线计算，完成多个动作连续帧、手部及脚底接触验证，并测试形态/头部控制的失效和重建；确认能够实时播放后再接动作工作台、动作组合导入导出和自有引擎。临时 `gray-late-phases-*-research` 大型 HTML 仅为隔离对照页，可由 `tools/build-gray-late-phase-test.py` 重新生成，绝不能当引擎资源。


## 2026-11-15 WebGL2 与完整轨道后续试验

本节更新上面的运行时状态，但不改变未验收结论。当前隔离灰模页面使用源派生 WebGL2 细分、法线及部分平滑运算，并将显示表面与来源索引保留在显卡。原头面结构与接触修正仍部分在 CPU 主线程，细分阶段之间还有显卡读回；这不是完整的显卡常驻绑定或可实时交付的引擎运行时。无法初始化显卡计算或上下文丢失时回退到原灰模参考计算，回退后的来源位置与法线在测试样本中逐项相同。

原 235 MB 皮肤图谱不在灰模入口加载，原眼睑几何初始化与表面修正仍保留。其余内嵌来源数据保留全部记录，非图像内容按原始字节拆成内容寻址本地文件，读取时校验 SHA-256；这只是研究页的资源组织，不是原函数的替代档案。新旧冷启动页面对三个不同动作的表面各层、法线、索引及最终画面一致，见 `review/gray-externalized-reference-fresh-comparison-20261115.json`。皮肤和睫毛视图不属于此入口，也不支持从灰模切回。

`review/gray-gpu-hybrid-cumulative-source-diagnostic-20261115.json` 比较不同动作姿态的 CPU 和 WebGL2 层链；`review/gray-gpu-motion-sample-source-check-20261115.json` 再对三个动作采样多个时刻。显卡浮点结果并非逐位相同，后者样本最大位置距离约 0.00036 毫米、最大法线夹角约 0.22 度；没有以此放宽原表面验收，也不能推断未采样动作、全部状态或全部相机均通过。早期直接用骨骼插值代替高精细修正的候选产生更大局部法线差异，保留在 `review/gray-resident-skinning-source-diagnostic-20261115.json`，未用于当前页面。

页面选择动作时一次读取并校验完整身体轨道，播放时不再分段请求，缓存最近使用动作。动作自身的帧时间驱动播放调度和右上角来源示范；计算跟不上时跳过过时画面以保持动作时长，并显示真实完成帧率。未知来源帧率仍仅可逐帧查看。`review/gray-complete-body-track-check-20261115.json` 比较了多种来源动作的原分段边界和较长动作；这不是全动作视觉或接触验收。

实际完成帧、动作切换、跨分段播放及异常回退见 `review/gray-gpu-workbench-end-to-end-20261115.json`。最近一次冷启动测得约 27 秒，四种动作连续完成约 3.1–3.4 帧/秒，普通动作首次切换约 0.35 秒，较长样本约 0.94 秒；同机另一轮约 4.4–4.6 帧/秒，设备负载会影响结果。`review/gray-live-workbench-stage-profile-20261115.json` 的阶段耗时有包含关系，不可直接相加。优先后续工作仍是把相邻原细分、嘴部、眼睑及法线阶段连续留在显卡，减少每帧同步和数据传输，并在不省略源层及约束的前提下复核完整头颈、手指、脚底接触和多视角结果。

本轮灰模页面另外停止传播不会被显示的颜色与材质字段，并只在嘴部性能参数全部为零时跳过对应空运算。`review/gray-gpu-material-gate-source-check-20261115.json` 和 `review/gray-lip-zero-gate-source-check-20261115.json` 对照了源位置、法线与相关字段；后者也检查了非零参数时恢复原计算。这些门控不支持皮肤或睫毛视图。快速切换期间旧来源示范会隐藏，直到新示范同步后再显示，见 `review/gray-rapid-action-switch-20261115.json`。嘴部 GPU 包络及其他缓存候选未稳定改善整帧耗时，未设置为默认，后续显卡常驻改造计划见 `research/gray-workbench/GPU-RESIDENCY-NEXT.md`。
