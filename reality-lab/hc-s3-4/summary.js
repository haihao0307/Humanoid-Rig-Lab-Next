(function(root){
'use strict';
const finite=x=>typeof x==='number'&&Number.isFinite(x),copy=x=>JSON.parse(JSON.stringify(x));
const PIN='c5c0bedbc35f24cbb35426ab9c14b74ca7fc5f49';
function validate(d){
 if(!d||d.schema!=='kaopu/first-fault-evidence@1'||d.passed!==true)throw Error('DIAGNOSIS_NOT_VERIFIED');
 if(d.source?.commit!==PIN||d.source?.repository!=='haihao0307/guilin-dem-pipeline')throw Error('SOURCE_PIN_MISMATCH');
 if(d.repairApplied!==false||d.sourceFitAccepted!==false)throw Error('AUTHORITY_ESCALATION');
 const t=d.trace;if(!t||t.limit!==1.45||t.operator!=='>'||t.truncated||!Array.isArray(t.errors)||t.errors.length)throw Error('TRACE_INVALID');
 if(!t.firstCrossing||!t.gate||!t.failure||!Array.isArray(t.events)||!t.events.length)throw Error('TRACE_INCOMPLETE');
 if(!t.events.every((e,i)=>Number.isInteger(e.sequence)&&e.sequence===i+1&&typeof e.stage==='string'&&Array.isArray(e.states)&&e.states.length===2))throw Error('EVENT_ORDER_INVALID');
 for(const e of t.events)for(const s of e.states)if(!finite(s.maxRatio)||!finite(s.minRatio)||!Number.isInteger(s.maxEdgeIndex)||s.maxEdgeIndex<0||s.invalidCount!==0)throw Error('EVENT_VALUES_INVALID');
 for(const row of t.gate.edges)for(const e of row.top){if(!finite(e.lengthM)||!finite(e.restM)||e.restM<=0||Math.abs(e.ratio-e.lengthM/e.restM)>1e-12||!e.panelId||!Number.isInteger(e.edgeIndex))throw Error('EDGE_RELATION_INVALID');}
 if(!t.gate.event.states.some(s=>s.maxRatio>1.45))throw Error('ORIGINAL_FAILURE_NOT_REPRODUCED');
 for(const name of ['initialState','entryState','gateState','rollbackState'])if(d.comparisons?.[name]?.identical!==true)throw Error('OBSERVER_PARITY_MISSING');
 if(d.runs.baseline.status!==d.runs.traced.status||d.runs.baseline.committed!==0||d.runs.traced.committed!==0)throw Error('SOURCE_OUTCOME_CHANGED');
 return true;
}
function terminal(t){
 const audit=t.gate.originalAudits.find(a=>a.maxEdgeStretch>t.limit);if(!audit)throw Error('ACTUAL_GUARD_AUDIT_MISSING');
 const si=t.gate.event.states.findIndex(s=>s.role===audit.role),edge=t.gate.edges.find(g=>g.role===audit.role).top[0],end=t.gate.event.sequence-1;
 let start=end;while(start>0&&t.events[start-1].states[si].maxRatio>t.limit)start--;
 let last=end;while(last>0&&t.events[last-1].states[si].maxRatio===edge.ratio&&t.events[last-1].states[si].maxEdgeIndex===edge.edgeIndex)last--;
 const f=t.firstCrossing,fi=f.worstEdge.solver,recovery=t.events.slice(f.event.sequence).find(e=>e.states[fi].maxRatio<=t.limit)||null;
 return {role:audit.role,edge:copy(edge),originalAudit:copy(audit),fittingStepOneBased:t.failure.fitStep+1,substepOneBased:t.gate.event.substep+1,persistentRoleCrossing:{before:start?copy(t.events[start-1]):null,after:copy(t.events[start])},lastIncreaseBeforeGate:{before:last?copy(t.events[last-1]):null,after:copy(t.events[last])},firstTransientRecoveredAt:recovery?copy(recovery):null,firstTransientIsTerminalCauseProven:false,ratioAgainstGradedReference:edge.targetRestM?edge.lengthM/edge.targetRestM:null,excessAboveOriginalLimitM:edge.lengthM-edge.restM*t.limit};
}
function summarize(d){validate(d);const t=d.trace,f=t.firstCrossing,gate=t.gate;
 return {schema:'kaopu/first-fault-summary@1',source:copy(d.source),firstObserved:copy(f),terminal:terminal(t),guard:{limit:t.limit,quantity:'edge_length/rest_length',edgeMaxima:copy(gate.edges),event:copy(gate.event),nativeAudits:copy(gate.originalAudits)},failure:copy(t.failure),rollback:{checkedBuffersExactlyRestored:d.rollbackExact,differences:copy(d.rollbackDifferences)},observerParity:true,sourceFitAccepted:false,repairApplied:false,physicalCertification:false,localizationResolution:'after individual native batch operations; not inside a WASM kernel',rootCauseProven:false,interpretation:f.initialCondition?'超限在已构造的初始状态就存在；不能归咎于之后某次投影。':'最早瞬时跨线与最终触发原门禁分开核对；操作边界定位不单独证明充分根因。'};
}
function buildCommon(d,P,base){const s=summarize(d),dict=copy(base);dict.measurements.push({id:'rf01.failure.max_edge_ratio',domain:'garment',label:'原保护门首先拒绝的最大边长比',unit:'1',quantity:'ratio',definition:'current edge length divided by original audited rest length; engineering check, not material calibration',owner:'tailor-workbench',requiredEvidence:['source pin','actual original guard','unchanged arithmetic'],notEquivalentTo:['material certification']});P.validateDictionary(dict);
 const max=s.terminal.originalAudit.maxEdgeStretch,id='garment-r10-d03-init-fault';const source={repository:d.source.repository,commit:d.source.commit,path:d.source.directory+'/wasm-cloth.mjs',sha256:d.source.files['wasm-cloth.mjs']};
 const checks=[P.makeCheck('fit:original_guard','FAIL','原生工程保护门触发；仍未完成D03试穿',{expected:1.45,observed:max,owner:'tailor-workbench'}),P.makeCheck('diagnostic:parity','PASS','最小观察与逐阶段观察的四组数值边界状态逐字节一致'),P.makeCheck('diagnostic:rollback',d.rollbackExact?'PASS':'FAIL',d.rollbackExact?'受检数值状态精确回到本步入口':'存在未恢复的受检字段，见差异清单',{observed:d.rollbackDifferences,owner:'tailor-workbench'}),P.makeCheck('cause:mechanism','UNKNOWN','只定位观测边界与具体边，尚未证明充分根因，未实施修复')];
 const object=P.finalizeObject({schema:P.OBJECT_SCHEMA,objectId:id,domain:'garment',name:'D03 初始化原门禁超限定位',sourceMode:'fixed_snapshot',source,units:[],frames:[],measurements:[P.makeMeasurement(dict,'rf01.failure.max_edge_ratio',max,{unit:'1',basis:'runtime_computed',method:'原保护门实际执行的audit最大值，与独立逐边扫描核对'})],checks,defects:checks.filter(c=>['FAIL','UNKNOWN','WARNING'].includes(c.status)).map(c=>P.makeDefect(id,c,{sourceCommit:source.commit})),extensions:{summary:s,live:false,rootCauseProven:false}},dict);
 return {bundle:P.aggregate([object],dict),defects:P.defectBundle([object],dict)};
}
const api=Object.freeze({validate,summarize,buildCommon});root.FirstFault34=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
