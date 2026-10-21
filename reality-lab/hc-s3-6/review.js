(function(root){
'use strict';const P=root.RealityProtocol||(typeof require==='function'?require('../hc-s2-1/protocol.js'):null),copy=x=>JSON.parse(JSON.stringify(x));
const NAMES={baseline:'原循环对照',progressive:'渐进适配事务',cancel:'实际消息取消',fault:'真实第3步后故障注入'};
function validate(record,expected){
 if(!record||record.schema!=='kaopu/fitting-transaction-observation@1'||!Object.keys(NAMES).includes(record.case))throw Error('SCHEMA_OR_CASE_INVALID');
 P.source(record.source);if(['repository','commit','path','sha256'].some(k=>record.source[k]!==expected.source[k]))throw Error('SOURCE_PIN_MISMATCH');
 if(record.moduleSHA256!==expected.moduleSHA256||record.nativeRun!==expected.nativeRun)throw Error('EVIDENCE_VERSION_MISMATCH');
 if(record.productionInstalled!==false||record.fitCertified!==false)throw Error('AUTHORITY_ESCALATION_REJECTED');
 const r=record.result;if(!r||!['COMMITTED','CANCELLED','FAILED_ROLLED_BACK','NATIVE_FAILED'].includes(r.status)||!Array.isArray(r.steps)||r.steps.length>48)throw Error('RESULT_INVALID');
 if(r.originalGate!==1.45)throw Error('GATE_CHANGED');
 for(let i=0;i<r.steps.length;i++){const s=r.steps[i];if(s.step!==i+1||!Array.isArray(s.maxActiveRatios)||s.maxActiveRatios.length!==2||s.maxActiveRatios.some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0))throw Error('STEP_INVALID');if(record.case!=='baseline'&&(s.fraction!==Math.min(s.step/32,1)||s.jsWasmMetricErrorM!==0||s.bodyPreviousErrorM!==0))throw Error('SCHEDULE_OR_COHERENCE_INVALID');}
 if(r.status==='COMMITTED'&&(r.steps.length!==48||r.committedRuntimeRevision!==1))throw Error('INCOMPLETE_COMMIT');
 if(['CANCELLED','FAILED_ROLLED_BACK'].includes(r.status)&&(!r.rollback?.exact||!r.independentRollback?.equal||r.committedRuntimeRevision!==0))throw Error('ROLLBACK_EVIDENCE_INVALID');
 return true;
}
function object(record,facts,dictionary,imported=false){
 validate(record,facts);const r=record.result,c=[],add=(id,status,message,detail)=>c.push(P.makeCheck(id,status,message,{owner:'garment-fitting',detail:detail||null}));
 add('evidence:source',imported?'UNKNOWN':'PASS',imported?'外部文件仅为未复验声明，不提升成当前运行证据':'固定原生试验与来源、模块版本匹配；本页不是重新运行物理');
 add('solver:gate','PASS','保留原1.45工程保护值、原时间步与原求解核；不是实物材料伸长认证');
 const expectedAbort=['cancel','fault'].includes(record.case);
 add('fit:initialization',expectedAbort?'NOT_APPLICABLE':r.status==='COMMITTED'?'PASS':'FAIL',expectedAbort?'此条件主动测试中断，不要求提交试穿':'此条件原生48步适配'+(r.status==='COMMITTED'?'已完成':'未完成，不能升级为成功'));
 if(record.case!=='baseline'){
  add('transaction:metric','PASS','实际各步JS和WASM参考度量一致，按源→目标逐步更新');
  add('transaction:previous','PASS','人体插值起点等于上一步已完成体型');
  add('transaction:restore',r.rollback?imported?'UNKNOWN':r.rollback.exact&&r.independentRollback.equal?'PASS':'FAIL':'NOT_APPLICABLE',r.rollback?'声明状态逐字节恢复，并另用SHA256核对；外部导入不能当重新实测':'该条件已提交，没有发生恢复分支');
  add('transaction:revision','PASS',r.status==='COMMITTED'?'全部48步成功后才提交本地运行revision 1':'中断后仍为入口revision 0，试算步骤没有提交');
 }
 add('contact:retained','WARNING','S3.5已发现运动接触失败，历史结果保留；本轮未重做动态接触认证',facts.previousContact);
 add('fit:dynamic','UNKNOWN','初始化完成、事务恢复与动态无穿插是不同验收；后者未完成');
 add('source:production','NOT_APPLICABLE','只在隔离原生候选中接入；原工作分支、UI和网址未安装或合并');
 const id='fit-d03-'+record.case;return P.finalizeObject({schema:P.OBJECT_SCHEMA,objectId:id,domain:'garment',name:NAMES[record.case],sourceMode:imported?'imported_unverified':'fixed_snapshot',source:record.source,units:[],frames:[],measurements:[],checks:c,defects:c.filter(x=>['FAIL','WARNING','UNKNOWN'].includes(x.status)).map(x=>P.makeDefect(id,x,{sourceCommit:record.source.commit})),extensions:{observation:copy(record),live:false,fitCertified:false,originalRuntimeInstalled:false}},dictionary);
}
root.FittingReview36=Object.freeze({NAMES,validate,object});if(typeof module!=='undefined'&&module.exports)module.exports=root.FittingReview36;
})(globalThis);
