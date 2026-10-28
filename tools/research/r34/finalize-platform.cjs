'use strict';
// Reconcile the existing P1-P5 route and delivery with the product audit.
const fs = require('fs');
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const write = (f, value) => fs.writeFileSync(f, JSON.stringify(value, null, 2) + '\n');
const must = (condition, message) => { if (!condition) throw Error(message); };
const build = read('BUILD-R34.json');
const cap = read('qa/platform-r34/capabilities.json');
const ui = read('qa/platform-r34/ui-roundtrip.json');
const depths = read('qa/platform-r34/pose-depth-comparison.json');
const legacy = read('qa/platform-r34/legacy-r20.json');
const edges = read('qa/platform-r34/edge-interaction.json');
must(read('BUILD.json').selectedVersion === 'R34' && cap.passed && ui.passed && depths.completed && legacy.completed && edges.passed, 'R34 capability checks are incomplete');
must(cap.artifactSHA256 === build.sha256 && edges.artifactSHA256 === build.sha256, 'Checks refer to a different workbench');
must(legacy.result.ignoredResearchCalibration && legacy.result.bodyCalibrationPreserved, 'Legacy scope changed');
must(Object.values(depths.comparisons).every(x => x.changedSilhouettePixels === 0 && x.depthDifferenceMM.maximum === 0), 'Sampled pose geometry changed');
const route = read('BODY-ROADMAP.json');
must(route.tasks.map(x => x.id).join(',') === 'P1,P2,P3,P4,P5', 'Fixed P1-P5 categories changed');
const task = id => route.tasks.find(t => t.id === id);
const sub = (id, child) => task(id).subtasks.find(t => t.id === child);
Object.assign(route, {
  reviewedDate: '2026-10-28',
  basis: '用户要求核查身体既有效果、参数、动作和人体生成平台实际可用性，并精简无使用价值的旧任务。',
  currentProductVersion: 'R34', currentMainTask: 'P4', currentSubtask: 'P4.2', projectComplete: false,
  acceptanceMeaning: 'mainTasksAccepted 是五个大类的整体验收数，不是已实现功能数量。',
  productPriorities: ['P4.2', 'P3.3', 'P2.4', 'P1/P2', 'P5', 'P4.1/P4.3'],
  priorityChange: 'R33 的转动锯齿修复已完成后台检查，用户视觉复核仍开放；按本轮平台功能核查优先恢复体型与姿势变化后的皮肤。',
  capabilityReview: 'docs/PLATFORM-CAPABILITIES-R34.md',
  policy: [
    '保留 P1～P5 原编号；按实际外观、可调参数、动作、存档和平台联动确定顺序。',
    '以当前人物为身体基准，不把原数据表面分析、一比一对照、来源独立逐区重写或中性校准设为平台使用前置条件。',
    '参考与来源历史如实保留；既有人物档案、身体参数和独立头部数据不因路线精简删除。',
    '人物继续以函数直接求交显示，不生成人物三角面；身体范围与独立头部项目保持。',
    '检查实际可操作三维页面与常用状态；不抢用户鼠标，不批量截图。',
    '缓存、资源和设备优化以实际性能需求推进，不把独立研究排在可用功能之前。'
  ]
});
Object.assign(task('P1'), { title: '体型、整体形态与身体比例', doneWhen: '常用体型可调整和回退；胸肩、腰腹、骨盆与支撑比例在实际使用中自然，已测范围明确。' });
Object.assign(sub('P1', 'P1.2'), { title: '体型档与当前人物回退', doneWhen: '保留当前人物和存档，可按实际需要保存与恢复体型；中性校准不是使用平台的前置条件。', stillNeeds: '继续核实真实使用中的体型档、恢复和不支持状态；不以中性校准研究阻塞平台。' });
Object.assign(task('P2'), { title: '轮廓、连接与动作变形', existing: 'R33 的轮廓及转动抗锯齿已做后台检查；R34 把支持的 A 骨架姿势由灰色结构显示改为肤色预览。连续动画和全部动作变形尚未完成。' });
Object.assign(sub('P2', 'P2.edge'), { latestEvidence: 'R33 的常规和高 DPI 拖动检查以及 R34 的实际拖动与停稳检查记录在 qa/edges-r33 和 qa/platform-r34。', stillNeeds: '用户在实际三维页检查常用角度；更多设备、极端形态及动作组合尚未逐一覆盖。' });
Object.assign(sub('P2', 'P2.4'), { title: '姿势编辑、连续动作与骨架支持', latestEvidence: 'R34 受支持的 A 骨架姿势可显示肤色预览；六个动作按钮实际上是静态姿势。B 骨架默认状态可切换，实测屈髋膝组合未接通。', stillNeeds: '接入连续播放、完善实际使用的 B 骨架与关节限位，并核查组合动作自然度。' });
Object.assign(task('P3'), { title: '身体函数、参数与人物档案', doneWhen: '身体保持函数求交，常用体型和局部参数可用，实际已有的调整与完整档案能够兼容；不以来源独立或逐区替换为前置门槛。', execution: '按平台需要补齐实际生效的参数、旧档效果和兼容性；不为替换来源而重写现有表面。' });
Object.assign(sub('P3', 'P3.3'), { title: '参数生效与既有人物档案兼容', status: 'partial_not_accepted', latestEvidence: '完整人物样本的网页保存和读取往返通过。真实 R20 档案的躯干、手足等改形标记保留，但当前工作台不应用。', stillNeeds: '补齐实际需要的年龄、性别等参数；恢复有用的旧档身体效果，同时保留头部与未知字段。' });
Object.assign(task('P4'), { title: '皮肤、显示和实际性能', existing: '默认固定人物具有原皮肤、肌理与一部分阴影散射。R34 可在 A 骨架姿势中保持肤色预览；连续身体上的完整原皮肤、调节、动态阴影与散射尚未接入。', doneWhen: '常用体型和姿势下的皮肤、细节、光照和调节可用；按实际设备需求保证加载和交互。' });
Object.assign(sub('P4', 'P4.1'), { title: '按实际需要优化加载、缓存与更新', stillNeeds: '根据实际等待、卡顿、资源占用和设备需求选择优化，不独立追求重写。' });
Object.assign(sub('P4', 'P4.2'), { title: '体型与姿势变化后的完整皮肤效果', latestEvidence: '固定人物原皮肤粗糙度实测改变画面；动态身体当前仅有肤色预览，原皮肤控件被禁用，动态阴影、散射及完整光学未接通。', stillNeeds: '恢复动态身体的皮肤细节和调节、光照、阴影与散射，并用常用体型和姿势检查真实效果。' });
Object.assign(sub('P4', 'P4.3'), { title: '按目标设备和场景验证', stillNeeds: '按实际部署和使用需求检查不同设备及场景；具体性能瓶颈出现时再优化。' });
Object.assign(task('P5'), { title: '头身接口、附件与平台整合', doneWhen: '与独立头部项目完成共同坐标、颈口和材质衔接，附件跟随及完整人物存档联调；不越界修改独立头部项目。' });
write('BODY-ROADMAP.json', route);
if (!fs.existsSync('DELIVERY-R33.json')) fs.copyFileSync('DELIVERY.json', 'DELIVERY-R33.json');
const delivery = read('DELIVERY-R33.json');
const now = new Date().toISOString();
const url = 'http://127.0.0.1:8914/workbench?v=R34-' + build.sha256.slice(0, 8);
Object.assign(delivery, {
  schema: 'body-delivery-r34/1', version: 'R34', updatedUTC: now,
  workbench: { file: build.file, sha256: build.sha256, bytes: build.bytes, url },
  previousDelivery: 'DELIVERY-R33.json',
  route: 'EXECUTION-ROUTE.md', roadmap: 'BODY-ROADMAP.json', capabilityReview: route.capabilityReview,
  currentMainTask: route.currentMainTask, currentSubtask: route.currentSubtask,
  remaining: route.tasks.map(t => ({ id: t.id, status: t.status, task: t.title })),
  projectComplete: false, bodyReconstructionComplete: false, visualAccepted: false,
  platformCapabilities: {
    defaultOriginalBodySkin: true, defaultSkinControlsSampled: true,
    supportedARigPoseSkinPreview: true, dynamicFullOriginalSkin: false,
    dynamicOriginalShadows: false, dynamicOriginalDiffusion: false,
    supportedShapeControls: ['weight', 'muscle', 'height', 'proportions', 'cupsize', 'firmness'],
    supportedLocalControls: 117, allControlCombinationsVerified: false,
    continuousAgeAndSexOnBodyPath: false, staticPoseButtons: 6, continuousAnimation: false,
    rigBDefaultAvailable: true, rigBBendSampleAvailable: false,
    completePersonArchiveSampleRoundTrip: true, legacyR20BodyEffectsApplied: false,
    completePersonVisualIntegration: false
  },
  evidence: { ...delivery.evidence, platformCapabilities: 'qa/platform-r34/capabilities.json', platformUI: 'qa/platform-r34/ui-roundtrip.json', r20Archive: 'qa/platform-r34/legacy-r20.json', poseGeometry: 'qa/platform-r34/pose-depth-comparison.json', r34EdgeInteraction: 'qa/platform-r34/edge-interaction.json' }
});
write('DELIVERY.json', delivery);
const anchor = read('TASK_ANCHOR.json');
if (!anchor.previousR33Task) anchor.previousR33Task = { stageStartedUTC: anchor.stageStartedUTC, hardStopUTC: anchor.hardStopUTC, currentMainTask: anchor.currentMainTask, currentSubtask: anchor.currentSubtask, lastVerifiedBuildHash: anchor.lastVerifiedBuildHash };
Object.assign(anchor, {
  updatedUTC: now, latestCheckpointUTC: now, latestAuditUTC: now,
  stageStartedUTC: '2026-10-28T03:19:51Z', hardStopUTC: '2026-10-28T06:19:51Z',
  workingBuild: 'BUILD-SOURCE-R33.json', companionBuild: 'BUILD-R34.json', workingViewer: url,
  status: '已核查身体平台实际功能并让受支持 A 骨架姿势保留肤色预览；完整动态皮肤与平台仍未完成。',
  stage: '平台功能核查与 R34 姿势肤色预览', stageStatus: '样本检查通过；动态皮肤、连续动画、旧档实际效果与总平台整合未完成',
  latestAudit: 'docs/PLATFORM-CAPABILITIES-R34.md', currentMainTask: route.currentMainTask, currentSubtask: route.currentSubtask,
  nextPriority: 'P4.2：恢复体型和姿势变化后的可调皮肤、细节、光照、阴影与散射；继续 P3.3 参数和旧档效果。',
  remaining: delivery.remaining, lastVerifiedBuildHash: build.sha256,
  projectComplete: false, currentIterationProjectComplete: false
});
write('TASK_ANCHOR.json', anchor);
console.log(JSON.stringify({ version: build.version, workbench: url, current: route.currentSubtask, priorities: route.productPriorities }));
