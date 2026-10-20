(function(root){
'use strict';
const P=root.RealityProtocol||(typeof require==='function'?require('../hc-s2-1/protocol.js'):null);
const CASES=['baseline','previous-only','metric-only','combined'],NAMES={'baseline':'原版对照','previous-only':'只推进人体插值起点','metric-only':'只采用分级纸样度量','combined':'两项同时调整'};
const finite=x=>typeof x==='number'&&Number.isFinite(x),copy=x=>JSON.parse(JSON.stringify(x));
function validate(data,expected){
 if(!data||data.schema!=='kaopu/metric-contact-review@1'||data.cases?.length!==4)throw Error('REVIEW_SCHEMA_INVALID');
 if(data.productionChanged!==false||data.fitCertified!==false)throw Error('AUTHORITY_ESCALATION');
 const seen=new Set();for(const c of data.cases){if(!CASES.includes(c.case)||seen.has(c.case))throw Error('CASE_SET_INVALID');seen.add(c.case);if(c.schema!=='kaopu/metric-contact-case@1'||c.passed!==true)throw Error('CASE_EVIDENCE_INCOMPLETE');
  for(const k of ['repository','commit','directory'])if(c.source[k]!==expected[k])throw Error('SOURCE_PIN_MISMATCH');
  if(c.productionChanged!==false||c.dynamicFitCertified!==false)throw Error('CASE_AUTHORITY_ESCALATION');
  if(typeof c.outcome?.error!=='boolean'||!Number.isInteger(c.outcome.committed)||typeof c.initializationAccepted!=='boolean')throw Error('OUTCOME_MISSING');
  if(c.initializationAccepted!==(!c.outcome.error&&c.outcome.committed===2))throw Error('OUTCOME_INCONSISTENT');
  const p=c.probe;if(!p||p.variant!==c.case||p.limit!==1.45||p.focus.edgeIndex!==3289||p.focus.particles.join(',')!=='1142,1177'||p.errors.length)throw Error('PROBE_IDENTITY_MISMATCH');
  if(!Array.isArray(p.gates)||!p.gates.length||p.gates.length>48||p.gates.length!==p.steps.length)throw Error('GATE_SEQUENCE_INVALID');
  if(p.completedFitting&&p.gates.length!==48)throw Error('INCOMPLETE_FITTING_CLAIM');
  const expectGraded=['metric-only','combined'].includes(c.case),expectPrevious=['previous-only','combined'].includes(c.case);
  if(c.patches.gradedRest!==expectGraded||c.patches.advancePrevious!==expectPrevious||c.patches.wasmChanged!==false||c.patches.guard!=='>1.45')throw Error('PATCH_DECLARATION_MISMATCH');
  const samples=[p.initial.focus,...p.gates.map(g=>g.focus)];for(const f of samples){if(!['lengthM','activeRestM','sourceRestM','targetRestM','activeRatio','sourceRatio','targetRatio','packedRestM'].every(k=>finite(f[k])&&f[k]>0))throw Error('FOCUS_NUMBER_INVALID');for(const [ratio,ref]of [['activeRatio','activeRestM'],['sourceRatio','sourceRestM'],['targetRatio','targetRestM']])if(Math.abs(f[ratio]-f.lengthM/f[ref])>1e-10)throw Error('RATIO_FORMULA_MISMATCH');if(f.packedRestM!==f.activeRestM)throw Error('CPU_WASM_METRIC_SPLIT');if(Math.abs(f.activeRestM-f[expectGraded?'targetRestM':'sourceRestM'])>1e-12)throw Error('ACTIVE_METRIC_UNDECLARED');}
  p.gates.forEach((g,i)=>{if(g.fitStep!==i||g.scan.length!==2||!g.scan.every(s=>['maxActiveRatio','maxSourceRatio','maxTargetRatio'].every(k=>finite(s[k])&&s[k]>0)))throw Error('GATE_SEQUENCE_INVALID');});
  for(const s of p.steps)if(!s.body||!['maxPreviousMismatchM','maxFirstSubstepJumpM','maxTargetIncrementM'].every(k=>finite(s.body[k])&&s.body[k]>=0))throw Error('BODY_OBSERVATION_INVALID');
  if(p.predictions.some(v=>!finite(v.maxResidualM)||v.maxResidualM<0))throw Error('PREDICTION_INVALID');
 }
 return true;
}
function row(c){const p=c.probe,last=p.gates.at(-1),top=p.metrics.find(m=>m.role==='top');return {id:c.case,name:NAMES[c.case],initializationAccepted:c.initializationAccepted,completedFitting:p.completedFitting,observedSteps:p.gates.length,completedSteps:p.completedFitting?48:Math.max(0,p.gates.length-1),failedStep:p.failure? p.failure.fitStep+1:null,lastTopActiveRatio:last.scan[0].maxActiveRatio,lastTopSourceRatio:last.scan[0].maxSourceRatio,lastTopTargetRatio:last.scan[0].maxTargetRatio,focusLengthMm:last.focus.lengthM*1000,focusActiveRatio:last.focus.activeRatio,focusSourceRatio:last.focus.sourceRatio,focusTargetRatio:last.focus.targetRatio,sourceRestMm:last.focus.sourceRestM*1000,targetRestMm:last.focus.targetRestM*1000,maxPreviousMismatchMm:Math.max(...p.steps.map(s=>s.body.maxPreviousMismatchM))*1000,maxFirstSubstepJumpMm:Math.max(...p.steps.map(s=>s.body.maxFirstSubstepJumpM))*1000,maxReverseVertexCount:Math.max(...p.steps.map(s=>s.body.reversedVertexCount)),gradedAreaM2:top.area.gradedM2,sourceAreaM2:top.area.sourceM2,massKg:top.particleMassKg,densityKgM2:top.densityKgM2,productionInstalled:false,dynamicFitCertified:false};}
function bundle(data,expected,{imported=false}={}){validate(data,expected);const objects=data.cases.map(c=>{const r=row(c),checks=[],add=(id,status,message,observed)=>checks.push(P.makeCheck(id,status,message,{owner:'tailor-workbench',observed}));
 add('evidence:origin',imported?'UNKNOWN':'PASS',imported?'外部文件仅为声明，未重新运行原生试验':'本构建绑定的原生对照记录；不是当前网页实时求解',c.code.commit);
 add('fitting:init',imported?'UNKNOWN':c.initializationAccepted?'PASS':'FAIL',c.initializationAccepted?'完成原生初始化；仍不是动态穿着认证':'原生初始化仍失败；没有放宽原保护门',c.outcome);
 add('metric:denominator',c.patches.gradedRest?'WARNING':'PASS',c.patches.gradedRest?'本候选采用分级度量，必须同时查看旧度量，不能只比较变小的比值':'此条件保留旧模板实际参考度量',{sourceMm:r.sourceRestMm,targetMm:r.targetRestMm,activeRatio:r.focusActiveRatio,sourceRatio:r.focusSourceRatio});
 add('body:continuity',imported?'UNKNOWN':r.maxPreviousMismatchMm<=.001?'PASS':'FAIL','人体每步插值起点与前一完成体型的差异；这是时序连续性，不是布料合格证明',r.maxPreviousMismatchMm);
 add('metric:mass-area','PASS','原质量按分级纸样面积形成；与参考边长的版本语义分别登记',{massKg:r.massKg,densityKgM2:r.densityKgM2,gradedAreaM2:r.gradedAreaM2});
 add('guard:unchanged',imported?'UNKNOWN':'PASS','原1.45工程门、WASM、时间步与回滚未改；该门不等于实物标定',1.45);
 add('fit:dynamic','UNKNOWN','本轮没有全款式、完整动作与连续接触认证；初始化通过不能消除原R10动态缺陷',c.walkSmoke||null);
 add('production:installed','NOT_APPLICABLE','只在独立试验响应中执行候选；原生产源未安装',false);
 const id='rf01-s35-'+c.case;return P.finalizeObject({schema:P.OBJECT_SCHEMA,objectId:id,domain:'garment',name:NAMES[c.case],sourceMode:imported?'imported_unverified':'fixed_snapshot',source:{repository:expected.repository,commit:expected.commit,path:expected.directory+'/live-cloth-worker.mjs'},units:[{quantity:'length',unit:'m',basis:'runtime_computed'}],frames:[],measurements:[],checks,defects:checks.filter(q=>['FAIL','UNKNOWN','WARNING'].includes(q.status)).map(q=>P.makeDefect(id,q,{sourceCommit:expected.commit})),extensions:{experiment:true,live:false,summary:r,sourceOutcome:c.outcome,patches:c.patches,rootCauseFullyProven:false,repairPromoted:false}},data.dictionary);});return P.aggregate(objects,data.dictionary);}
function parse(text){if(typeof text!=='string'||new TextEncoder().encode(text).length>10000000)throw Error('IMPORT_TOO_LARGE');return JSON.parse(text);}
const api=Object.freeze({CASES,NAMES,validate,row,bundle,parse});root.MetricContact35=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
