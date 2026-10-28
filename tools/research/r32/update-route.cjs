'use strict';
// Record the user's 2026-10-28 change of direction without deleting history.
const fs=require('fs');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const write=(f,x)=>fs.writeFileSync(f,JSON.stringify(x,null,2)+'\n');
if(!fs.existsSync('docs/BODY-ROADMAP-R31-HISTORY.json'))fs.copyFileSync('BODY-ROADMAP.json','docs/BODY-ROADMAP-R31-HISTORY.json');
if(!fs.existsSync('docs/EXECUTION-ROUTE-HISTORY-THROUGH-R31.md'))fs.copyFileSync('EXECUTION-ROUTE.md','docs/EXECUTION-ROUTE-HISTORY-THROUGH-R31.md');
const route=read('BODY-ROADMAP.json'),tasks=Object.fromEntries(route.tasks.map(t=>[t.id,t]));
Object.assign(route,{reviewedDate:'2026-10-28',currentProductVersion:'R32',currentMainTask:'P2',currentSubtask:'P2.edge',mainTasksAccepted:0,projectComplete:false,acceptanceTolerance:null,
 basis:'2026-10-28 用户新要求：以当前人物为基础迭代，外观与参数可调优先，首先修复轮廓锯齿。',
 review:'docs/EXECUTION-ROUTE-HISTORY-THROUGH-R31.md',
 policy:['保留 P1～P5 的整体范围；按用户当前需要处理轮廓锯齿，之后继续身体质量与参数。','当前身体是工作基准，按实际三维效果和用户反馈迭代；不将原数据表面分析、一比一对照或来源独立作为前置条件。','保留真实的参考和来源历史，不把现有来源派生数据宣称为无来源；也不以是否来源派生否定当前画面。','人物继续以函数直接求交显示，不生成人物三角面；身体范围、头部独立项目、参数和完整人物档案保持。','在不抢鼠标的前提下检查实际页面、体型、动作与正常观察距离；不批量截图。']});
const sub=(task,id)=>task.subtasks.find(s=>s.id===id);
tasks.P1.existing='以当前人物为身体基准；已有体型、局部控制及可回退档案。胸肩、腰腹和骨盆的视觉质量及骨软关系仍可按实际需要继续改善。';
Object.assign(sub(tasks.P1,'P1.1'),{title:'当前躯干形体与参数检查',scope:'以当前人物为基准检查胸肩、腰腹、骨盆及可调参数。',doneWhen:'正常距离和多角度观察效果可用，参数调整保持自然且可回退。',stillNeeds:'按用户实际观察继续改善局部形体和参数响应；无需重新开展原数据表面验收。'});
sub(tasks.P1,'P1.2').stillNeeds='成人基准用途和不支持的状态仍可后续改进；保留当前人物与档案回退。';
Object.assign(sub(tasks.P1,'P1.3'),{doneWhen:'明确支撑与软组织的控制关系，尽量使胖瘦调整自然并兼容旧档。',stillNeeds:'支撑与软组织仍有耦合，可结合实际体型调整继续改善。'});
Object.assign(sub(tasks.P1,'P1.4'),{doneWhen:'胸肩、腰腹和骨盆在常用角度与体型变化下保持自然。',stillNeeds:'按当前三维效果和用户反馈继续调整，无需等待原数据一比一对照。'});
tasks.P2.existing='当前优先处理身体轮廓显示锯齿；A 驱动身体关节及局部体型控制已经接入，连接、动作自然度和 B 驱动仍需继续完善。';
if(!sub(tasks.P2,'P2.edge'))tasks.P2.subtasks.unshift({id:'P2.edge',title:'人体轮廓锯齿和显示采样',status:'partial_not_accepted'});
Object.assign(sub(tasks.P2,'P2.edge'),{doneWhen:'正常距离、缩放、旋转和常用体型动作下的轮廓锯齿明显减轻，参数、档案和交互保留；实际效果等待用户观察。',latestEvidence:'R32 将屏幕边缘滤波与受预算约束的显示采样接入当前、连续体型和动作画面；具体检查见 qa/edges-r32。',stillNeeds:'继续检查不同显示设备、极端角度和体型的轮廓质量及性能，由用户在实际三维页判断是否还需调整。'});
sub(tasks.P2,'P2.4').stillNeeds='关节轴向与自然限位、肩髋肘膝腕踝及手足细节、多动作视觉检查和 B 驱动修正。';
Object.assign(tasks.P3,{title:'函数表面、参数和绑定',doneWhen:'人物保持函数直接求交和可调整参数，形体及动作满足实际效果，完整档案兼容；不把来源独立设为前置门槛。',existing:'当前函数化表面和动态颈口已接入工作页，保留历史来源与已实现参数；继续按视觉质量和实际调整需求改进。',execution:'按具体身体部位和参数需求迭代，无需先替换所有来源派生分区。'});
Object.assign(sub(tasks.P3,'P3.1'),{title:'躯干函数与变量',latestEvidence:'现有连续体型、局部控制和动态颈口已接入工作页。',stillNeeds:'针对实际视觉与控制反馈完善躯干函数和参数。'});
Object.assign(sub(tasks.P3,'P3.2'),{title:'四肢、关节与手足函数',stillNeeds:'完善实际四肢、关节、手足外观和可调动作。'});
tasks.P4.existing='已有缓存、皮肤与灯光，R32 增加轮廓显示抗锯齿；动态阴影、散射、更多设备性能和跨场景仍需改进。';
sub(tasks.P4,'P4.2').stillNeeds='皮肤质感、动态阴影、光照及不同场景下的实际效果仍需改善。';
write('BODY-ROADMAP.json',route);
const anchor=read('TASK_ANCHOR.json');Object.assign(anchor,{updatedUTC:new Date().toISOString(),stageStartedUTC:'2026-10-28T02:27:37Z',hardStopUTC:'2026-10-28T05:27:37Z',currentBuild:'BUILD.json',workingBuild:'BUILD-SOURCE-R32.json',companionBuild:'BUILD-R32.json',currentMainTask:'P2',currentSubtask:'P2.edge',status:'当前人物迭代：优先修复轮廓锯齿，保留参数、动作与档案',projectComplete:false,nextPriority:'以实际三维效果和用户反馈继续改善轮廓、连接、动作和可调参数；不再以前期原数据表面分析为前置。',remaining:route.tasks.map(t=>({id:t.id,status:t.status,task:t.title}))});write('TASK_ANCHOR.json',anchor);
fs.writeFileSync('EXECUTION-ROUTE.md',`# 身体三维迭代路线\n\n2026-10-28 用户明确更新：以当前人物为基础继续迭代，外观达到用户需要且参数可调即可；不再将原数据表面分析、一比一对照或摆脱来源派生作为前置条件。当前身体由既有参考、数据和多轮迭代形成，历史来源如实保留。旧路线仅作[历史记录](docs/EXECUTION-ROUTE-HISTORY-THROUGH-R31.md)。\n\n当前优先级是 **P2.edge 人体轮廓锯齿**。R32 在默认人物、连续体型及动作画面加入显示采样和边缘抗锯齿，保留身体函数求交、现有参数、动作和完整人物档案；不生成人物三角面。实际三维页面为交付重点，后台只做必要检查，不抢用户鼠标或批量拍照。\n\n后续仍使用固定的 P1～P5 分类，具体内容和状态见 [BODY-ROADMAP.json](BODY-ROADMAP.json)：\n\n1. P1：整体体型、胸肩腰腹骨盆和支撑/软组织控制。\n2. P2：轮廓、连接、手足细节和动作变形；当前优先处理锯齿。\n3. P3：函数表面、形态变量和绑定，兼容现有参数与档案。\n4. P4：显示性能、缓存、皮肤、光照与跨场景。\n5. P5：头身接口、附件跟随和平台整合；独立头部项目不越界修改。\n\n各项按实际观察与用户反馈推进，不把技术通过或版本号当作全部项目完成。保留参考和来源事实，不将历史数据包装为无来源。\n`);
console.log(JSON.stringify({current:route.currentSubtask,version:route.currentProductVersion}));
