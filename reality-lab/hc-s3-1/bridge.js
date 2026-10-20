/* Uses the existing RealityProtocol 0.2, without changing its source.
 * A schema bridge is not a physical or visual certification. */
(function(root){
'use strict';
const P=root.RealityProtocol||(typeof require==='function'?require('../hc-s2-1/protocol.js'):null);
const clone=x=>JSON.parse(JSON.stringify(x)),finite=x=>typeof x==='number'&&Number.isFinite(x);
const LIVE_IDS=['material.warp_spacing_m','material.weft_spacing_m','material.twill_repeat_m','material.stitch_pitch_m','material.visible_thread_width_m','material.thickness_m','material.yarn_diameter_m','material.linear_density_tex'];
const LIVE_UNITS=['m','m','m','m','m','m','m','tex'];
const LIVE_STATUS=['PASS','PASS','PASS','PASS','WARNING','UNKNOWN','UNKNOWN','UNKNOWN'];
const MAX_BYTES=1048576;
function parse(text){if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_BYTES)throw Error('INPUT_TOO_LARGE');return JSON.parse(text);}
function sameSource(a,b){return !!a&&!!b&&['repository','commit','path','sha256'].every(k=>a[k]===b[k]);}
function validateExport(x,expectedSource){
 if(!x||Array.isArray(x)||x.schema!=='kaopu/reality-workbench-export@1'||x.exporterVersion!=='0.3.1-a')throw Error('EXPORT_SCHEMA_UNSUPPORTED');
 if(x.objectId!=='fabric-denim-r17-2'||x.family!=='denim'||x.domain!=='fabric')throw Error('EXPORT_SCOPE_MISMATCH');
 P.source(x.source);if(!sameSource(x.source,expectedSource))throw Error('SOURCE_REVISION_MISMATCH');
 if(!x.capture||!Number.isInteger(x.capture.sequence)||x.capture.sequence<1||!Number.isFinite(Date.parse(x.capture.capturedAt)))throw Error('CAPTURE_ID_INVALID');
 if(!x.authorities||['sourceWriteAPI','repairAuthorized','physicalCertification','manufacturingCertification','productionReady'].some(k=>x.authorities[k]!==false))throw Error('AUTHORITY_ESCALATION_REJECTED');
 if(!Array.isArray(x.measurements)||x.measurements.length!==LIVE_IDS.length)throw Error('MEASUREMENT_SET_MISMATCH');
 for(let i=0;i<LIVE_IDS.length;i++){const m=x.measurements[i];if(m.id!==LIVE_IDS[i]||m.unit!==LIVE_UNITS[i]||m.status!==LIVE_STATUS[i])throw Error('MEASUREMENT_SEMANTICS_MISMATCH:'+LIVE_IDS[i]);if(i<5&&(!finite(m.value)||m.value<=0))throw Error('INVALID_POSITIVE_LENGTH');if(i>=5&&m.value!==null)throw Error('UNKNOWN_MUST_STAY_NULL');if(typeof m.method!=='string'||!m.method||m.basis!==(i<5?'runtime_computed':'unknown'))throw Error('MEASUREMENT_BASIS_MISMATCH');}
 const u=x.shaderInputs;if(!u||!['weaveScale','stitchPitch','threadWidth','readability','wash','light'].every(k=>finite(u[k])))throw Error('INVALID_SHADER_INPUTS');
 const expected=[.0254/60*u.weaveScale,.0254/40*u.weaveScale,.0254/60*4*u.weaveScale,u.stitchPitch,u.threadWidth];
 for(let i=0;i<5;i++)if(Math.abs(x.measurements[i].value-expected[i])>1e-12*Math.max(1,Math.abs(expected[i])))throw Error('MEASUREMENT_FORMULA_MISMATCH');
 if(!x.preservation||x.preservation.passed!==true||JSON.stringify(x.preservation.before)!==JSON.stringify(x.preservation.after))throw Error('PRESERVATION_CLAIM_INVALID');
 return true;
}
function dictionary(base,history){
 const d=clone(base),known=new Set(d.measurements.map(m=>m.id));
 const records=history.objects.flatMap(o=>o.measurements).concat(LIVE_IDS.map((id,i)=>({definitionId:id,label:id,unit:LIVE_UNITS[i]})));
 for(const m of records){let unit=m.unit;if(unit==='kg/m2')unit='g/m2';if(!P.UNITS.includes(unit))continue;const id='rf01.'+m.definitionId;if(known.has(id))continue;known.add(id);d.measurements.push({id,domain:'fabric',label:m.label,unit,quantity:unit==='m'?'length':unit==='g/m2'?'areal_density':unit==='tex'||unit==='denier'?'linear_density':'native_control',definition:'原始材料参数或观察量的有出处规范表示；具体范围和方法以每条记录为准，不等同实物标定。',owner:'material-workbench',notEquivalentTo:['physical specimen certification'],requiredEvidence:['source revision','basis','method']});}
 P.validateDictionary(d);return d;
}
function mappedMeasurement(m,dict,owner,sourceRef){
 const original=clone(m),id=m.definitionId||m.id;let value=m.value,unit=m.unit,conversion=null;
 if(unit==='kg/m2'){if(value!=null&&!finite(value))throw Error('AREAL_DENSITY_INVALID');value=value==null?null:value*1000;unit='g/m2';conversion={factor:1000,from:'kg/m2',to:'g/m2'};}
 if(!P.UNITS.includes(unit))return {unsupported:true,original};
 if(value!=null&&!finite(value))return {unsupported:true,original};
 const basis=['source_declared','runtime_computed','physical_measured','artistic','unknown'].includes(m.basis)?m.basis:m.value==null?'unknown':'source_declared';
 const mapped=P.makeMeasurement(dict,'rf01.'+id,value,{status:m.status,unit,basis,method:m.method||m.note||'source declaration',sourceRef,context:{originalRecord:original,originalBasis:m.basis,unitConversion:conversion,physicalCalibration:false}});
 if(m.status==='NOT_APPLICABLE')mapped.status='NOT_APPLICABLE';
 mapped.owner=owner;return {measurement:mapped,original};
}
function finalize(id,name,source,mode,rows,extraChecks,dict,extensions){
 const measurements=[],checks=[],unsupported=[];
 for(const row of rows){const q=mappedMeasurement(row,dict,extensions.owner,source.commit);if(q.unsupported){unsupported.push(q.original);checks.push(P.makeCheck('unsupported:'+(row.id||row.definitionId),'WARNING','共同协议当前不能无损表达此单位/值，已保留在扩展中：'+(row.unit||'?'),{owner:extensions.owner,detail:q.original}));}else {measurements.push(q.measurement);checks.push(P.makeCheck('measurement:'+q.measurement.id,q.measurement.status,q.measurement.method||q.measurement.label,{owner:extensions.owner,measurementId:q.measurement.id,observed:q.measurement.value}));}}
 checks.push(...extraChecks);
 const defects=checks.filter(c=>['FAIL','WARNING','UNKNOWN'].includes(c.status)).map(c=>P.makeDefect(id,c,{sourceCommit:source.commit}));
 return P.finalizeObject({schema:P.OBJECT_SCHEMA,objectId:id,domain:'fabric',name,sourceMode:mode,source,units:[{quantity:'length',unit:'m',basis:'source_declared'}],frames:[],measurements,checks,defects,preservation:extensions.preservation||null,extensions:{...extensions,unsupportedOriginalMeasurements:unsupported}},dict);
}
function live(x,dict,expectedSource,imported=false){
 validateExport(x,expectedSource);
 const extra=[P.makeCheck('source:transport',imported?'UNKNOWN':'PASS',imported?'导入报告只作为外部声明；不冒充本会话实时读取':'本会话从固定原生副本的只读回调读取'),P.makeCheck('source:preservation',imported?'UNKNOWN':'PASS',imported?'导入文件中的保护声明未重新实测':'同步读取前后受检状态/几何/着色器保持一致'),P.makeCheck('material:axis','WARNING','材料参考坐标已声明；未证明匹配裁缝铺材料轴'),P.makeCheck('physical:calibration','UNKNOWN','没有实物材料标定，不把GPU参数当实物真值'),P.makeCheck('source:nominal','WARNING','名义11针/30mm与实际上传节距分别保留；工艺容差未知',{expected:.03/11,observed:x.shaderInputs.stitchPitch})];
 return finalize(x.objectId,'牛仔 R17.2 · '+(imported?'导入观察':'实时观察'),x.source,imported?'imported_unverified':'live_read_only',x.measurements,extra,dict,{owner:'denim-workshop',exportSchema:x.schema,originalExport:clone(x),preservation:imported?null:x.preservation,capturedAt:x.capture.capturedAt,sourceAuthority:'candidate-native-copy-not-production-installation'});
}
function historyObject(o,dict){
 const s=o.source.visual||o.source;const source={repository:s.repository,commit:s.commit||s.sourceCommit||s.evidenceCommit,path:s.path,sha256:s.sha256||null};P.source(source);
 const extra=o.checks.map(c=>P.makeCheck('s3:'+c.code,c.status,c.message,{owner:o.source.owner}));
 extra.push(P.makeCheck('source:history','WARNING','这是S3固定证据，不是本会话重新读取的工作台'));
 if(o.source.physics)extra.push(P.makeCheck('source:split','WARNING','外观与物理来源分离，未自动合并版本'));
 return finalize(o.id,o.name,source,'fixed_snapshot',o.measurements,extra,dict,{owner:o.source.owner,originalSchema:'kaopu/reality-material-snapshot-set@1',originalS3Object:clone(o),originalDefects:clone(o.defects),sourceAuthority:'history'});
}
function diff(a,b){const old=new Map((a?.measurements||[]).map(x=>[x.id||x.definitionId,x]));return (b?.measurements||[]).map(n=>{const p=old.get(n.id||n.definitionId);return {id:n.id||n.definitionId,before:p?.value??null,after:n.value,unit:n.unit,changed:!p||p.unit!==n.unit||p.value!==n.value};}).filter(x=>x.changed);}
const api=Object.freeze({MAX_BYTES,LIVE_IDS,LIVE_UNITS,parse,sameSource,validateExport,dictionary,live,historyObject,diff});root.RealityBridge31=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
