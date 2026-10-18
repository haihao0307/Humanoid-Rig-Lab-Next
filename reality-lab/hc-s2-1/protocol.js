/* KAOPU Reality Foundation HC S2.1. Pure data contract; no source-workbench write API. */
(function(root){
'use strict';
const VERSION='0.2.0';
const OBJECT_SCHEMA='kaopu/reality-object@0.2';
const BUNDLE_SCHEMA='kaopu/reality-foundation-bundle@0.2';
const DEFECT_SCHEMA='kaopu/reality-defect@0.2';
const STATUSES=Object.freeze(['PASS','FAIL','WARNING','UNKNOWN','NOT_APPLICABLE']);
const DOMAINS=Object.freeze(['human','footwear','pattern','garment','fabric']);
const SOURCE_MODES=Object.freeze(['live_read_only','fixed_snapshot','imported_unverified','registered_only']);
const BASES=Object.freeze(['source_declared','runtime_computed','physical_measured','artistic','unknown']);
const SEVERITY=Object.freeze({FAIL:'critical',WARNING:'warning',UNKNOWN:'info'});
const UNITS=Object.freeze(['m','mm','cm','in','ft','1','m2','mm2','g/m2','tex','denier','px']);
const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const plain=value=>value&&typeof value==='object'&&!Array.isArray(value);
function normalizeStatus(value){
 const key=String(value??'').trim().toUpperCase().replace(/[\s\/-]+/g,'_');
 const aliases={OK:'PASS',PASSED:'PASS',ERROR:'FAIL',CONFLICT:'FAIL',WARN:'WARNING',UNRESOLVED:'UNKNOWN',NA:'NOT_APPLICABLE',N_A:'NOT_APPLICABLE'};
 const status=aliases[key]||key;
 if(!STATUSES.includes(status))throw Error('未知状态：'+String(value));
 return status;
}
function hashId(value){
 let h=2166136261;for(const c of String(value)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');
}
function validateDictionary(dictionary){
 if(!plain(dictionary)||dictionary.schema!=='kaopu/reality-measurement-dictionary@1')throw Error('测量字典协议不正确');
 if(!Array.isArray(dictionary.measurements)||!dictionary.measurements.length)throw Error('测量字典为空');
 const ids=new Set();
 for(const item of dictionary.measurements){
  if(!plain(item)||typeof item.id!=='string'||!item.id)throw Error('测量定义缺少ID');
  if(ids.has(item.id))throw Error('测量定义重复：'+item.id);ids.add(item.id);
  if(!DOMAINS.includes(item.domain))throw Error('测量定义越界：'+item.id);
  if(typeof item.quantity!=='string'||!item.quantity)throw Error('测量定义缺少量纲：'+item.id);
  if(!UNITS.includes(item.unit))throw Error('测量定义使用未知单位：'+item.id+' / '+item.unit);
  if(typeof item.definition!=='string'||item.definition.length<8)throw Error('测量定义不完整：'+item.id);
  if(typeof item.owner!=='string'||!item.owner)throw Error('测量定义缺少责任工作台：'+item.id);
 }
 return Object.freeze({byId:Object.freeze(Object.fromEntries(dictionary.measurements.map(item=>[item.id,Object.freeze(clone(item))]))),ids:Object.freeze([...ids])});
}
function source(value){
 if(!plain(value))throw Error('对象缺少来源');
 if(typeof value.repository!=='string'||!/^[\w.-]+\/[\w.-]+$/.test(value.repository))throw Error('来源仓库无效');
 if(typeof value.commit!=='string'||!/^[0-9a-f]{40}$/.test(value.commit))throw Error('来源必须绑定完整提交');
 if(typeof value.path!=='string'||!value.path||value.path.startsWith('/')||value.path.split('/').includes('..'))throw Error('来源路径无效');
 if(value.sha256!=null&&(!/^[0-9a-f]{64}$/.test(value.sha256)))throw Error('来源摘要格式错误');
 return {repository:value.repository,commit:value.commit,path:value.path,sha256:value.sha256??null};
}
function makeMeasurement(dictionary,definitionId,value,options={}){
 const index=validateDictionary(dictionary),definition=index.byId[definitionId];
 if(!definition)throw Error('未登记测量：'+definitionId);
 const status=value===null||value===undefined?'UNKNOWN':normalizeStatus(options.status||'PASS');
 if(value!==null&&value!==undefined){
  if(!finite(value))throw Error('测量必须是有限数值：'+definitionId);
  if(definition.quantity==='count'&&(!Number.isInteger(value)||value<0))throw Error('计数必须为非负整数：'+definitionId);
 }
 const unit=options.unit||definition.unit;
 if(unit!==definition.unit)throw Error('测量单位与字典不一致：'+definitionId+' 应为 '+definition.unit+'，收到 '+unit);
 const basis=options.basis||'unknown';if(!BASES.includes(basis))throw Error('测量依据无效：'+definitionId);
 return {id:options.id||definitionId,definitionId,label:definition.label,value:value??null,unit,status,basis,method:options.method||null,context:clone(options.context||{}),sourceRef:options.sourceRef||null,notEquivalentTo:clone(definition.notEquivalentTo||[]),requiredEvidence:clone(definition.requiredEvidence||[]),owner:definition.owner};
}
function makeCheck(id,status,message,options={}){
 if(typeof id!=='string'||!id)throw Error('检查项缺少ID');
 if(typeof message!=='string'||!message)throw Error('检查项缺少说明：'+id);
 return {id,status:normalizeStatus(status),message,category:options.category||'contract',owner:options.owner||null,sourceRef:options.sourceRef||null,measurementId:options.measurementId||null,expected:clone(options.expected??null),observed:clone(options.observed??null),detail:clone(options.detail??null)};
}
function makeDefect(objectId,check,options={}){
 const status=normalizeStatus(check.status);
 if(!['FAIL','WARNING','UNKNOWN'].includes(status))throw Error('PASS或不适用项不能形成缺陷：'+check.id);
 const code=options.code||check.id;
 return {schema:DEFECT_SCHEMA,id:options.id||('defect:'+objectId+':'+hashId(code+'|'+check.message)),objectId,code,severity:options.severity||SEVERITY[status],state:'OPEN',owner:options.owner||check.owner||'reality-coordinator',sourceCommit:options.sourceCommit||null,measurementId:check.measurementId||null,message:check.message,expected:clone(check.expected),observed:clone(check.observed),detail:clone(check.detail),repairAuthorized:false,verificationRequired:true,createdBy:'REALITY-HC-S2.1',createdAt:options.createdAt||null};
}
function verifyAdapter(adapter){
 const methods=['identity','source','units','frames','measurements','checks','defects','preservation'];
 if(!adapter||typeof adapter!=='object')throw Error('适配器不存在');
 for(const name of methods)if(typeof adapter[name]!=='function')throw Error('适配器缺少方法：'+name);
 if(typeof adapter.read!=='function')throw Error('适配器缺少只读read方法');
 if('write' in adapter)throw Error('S2.1适配器禁止暴露write接口');
 return true;
}
function finalizeObject(candidate,dictionary){
 const index=validateDictionary(dictionary);
 if(!plain(candidate)||candidate.schema!==OBJECT_SCHEMA)throw Error('对象协议不正确');
 if(typeof candidate.objectId!=='string'||!/^[a-zA-Z0-9_.:-]{1,160}$/.test(candidate.objectId))throw Error('对象身份无效');
 if(!DOMAINS.includes(candidate.domain))throw Error('对象领域越界：'+candidate.domain);
 if(!SOURCE_MODES.includes(candidate.sourceMode))throw Error('来源模式无效：'+candidate.sourceMode);
 const result=clone(candidate);result.source=source(candidate.source);
 if(!Array.isArray(result.units))throw Error('单位声明必须为数组');
 for(const item of result.units){
  if(!plain(item)||typeof item.quantity!=='string'||!item.quantity)throw Error('单位声明缺少量纲');
  if(!UNITS.includes(item.unit))throw Error('未知单位声明：'+item.unit);
  if(!BASES.includes(item.basis||'unknown'))throw Error('单位声明依据无效');
 }
 if(!Array.isArray(result.frames))throw Error('坐标框架必须为数组');
 if(!Array.isArray(result.measurements))throw Error('测量必须为数组');
 for(const m of result.measurements){
  const definition=index.byId[m.definitionId];if(!definition)throw Error('对象含未登记测量：'+m.definitionId);
  if(m.unit!==definition.unit)throw Error('对象测量单位错误：'+m.id);
  if(!STATUSES.includes(normalizeStatus(m.status)))throw Error('对象测量状态错误：'+m.id);
  if(m.value!=null&&!finite(m.value))throw Error('对象测量数值无效：'+m.id);
 }
 if(!Array.isArray(result.checks))throw Error('检查项必须为数组');
 const checkIds=new Set();for(const c of result.checks){c.status=normalizeStatus(c.status);if(checkIds.has(c.id))throw Error('检查ID重复：'+c.id);checkIds.add(c.id);}
 const counts=Object.fromEntries(STATUSES.map(status=>[status,0]));for(const c of result.checks)counts[c.status]++;
 if(!Array.isArray(result.defects))result.defects=[];
 const defectIds=new Set();for(const d of result.defects){if(d.schema!==DEFECT_SCHEMA||d.objectId!==result.objectId)throw Error('缺陷协议或对象不匹配');if(defectIds.has(d.id))throw Error('缺陷ID重复：'+d.id);defectIds.add(d.id);d.repairAuthorized=false;d.verificationRequired=true;}
 result.status=counts.FAIL?'REJECTED':counts.WARNING||counts.UNKNOWN?'PARTIAL':'VALID';
 result.counts=counts;
 result.hostModified=false;result.physicalCertification=false;result.manufacturingCertification=false;result.aestheticAcceptance=false;result.productionReady=false;
 result.contractVersion=VERSION;
 return result;
}
function aggregate(objects,dictionary){
 if(!Array.isArray(objects)||!objects.length)throw Error('汇总对象为空');
 const normalized=objects.map(object=>finalizeObject(object,dictionary));
 const counts=Object.fromEntries(STATUSES.map(status=>[status,0]));const defects=[];
 for(const object of normalized){for(const status of STATUSES)counts[status]+=object.counts[status];defects.push(...object.defects);}
 return {schema:BUNDLE_SCHEMA,version:VERSION,objects:normalized,counts,defects,status:counts.FAIL?'REJECTED':counts.WARNING||counts.UNKNOWN?'PARTIAL':'VALID',sourceWriteAPI:false,automaticRepair:false,physicalCertification:false,manufacturingCertification:false,aestheticAcceptance:false,productionReady:false};
}
function defectBundle(objects,dictionary){const bundle=aggregate(objects,dictionary);return {schema:'kaopu/reality-defect-bundle@0.2',version:VERSION,generatedAt:null,sourceObjects:bundle.objects.map(o=>({objectId:o.objectId,domain:o.domain,commit:o.source.commit})),defects:bundle.defects.map(d=>({...d,repairAuthorized:false,verificationRequired:true})),automaticRepair:false};}
const api=Object.freeze({VERSION,OBJECT_SCHEMA,BUNDLE_SCHEMA,DEFECT_SCHEMA,STATUSES,DOMAINS,SOURCE_MODES,BASES,UNITS,clone,normalizeStatus,validateDictionary,source,makeMeasurement,makeCheck,makeDefect,verifyAdapter,finalizeObject,aggregate,defectBundle});
root.RealityProtocol=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
