(function(root){
'use strict';
const P=root.RealityProtocol||(typeof require==='function'?require('../hc-s2-1/protocol.js'):null);
const A=root.RealityBridge31||(typeof require==='function'?require('../hc-s3-1/bridge.js'):null);
const copy=x=>JSON.parse(JSON.stringify(x)),finite=x=>typeof x==='number'&&Number.isFinite(x);
const SPECS=[
 ['knit.grid_columns','生成针目列数','1','PASS','runtime_computed'],['knit.grid_rows','生成针目行数','1','PASS','runtime_computed'],
 ['knit.column_pitch_m','生成列间距（局部X）','m','PASS','runtime_computed'],['knit.row_pitch_m','生成行间距（局部Y）','m','PASS','runtime_computed'],
 ['knit.carrier_nominal_diameter_m','载纱名义直径','m','WARNING','source_declared'],['knit.carrier_sample_diameter_m','载纱截面采样直径','m','WARNING','runtime_computed'],
 ['knit.short_fiber_instances','短绒实例数','1','PASS','runtime_computed'],['knit.surface_fiber_instances','贴伏长纤维实例数','1','PASS','runtime_computed'],
 ['knit.fuzz_density_control','短绒密度控制值','1','PASS','runtime_computed'],['knit.length_multiplier','短绒长度倍率','1','PASS','runtime_computed'],
 ['knit.short_fiber_sample_offset_m','短绒样本端点偏移','m','WARNING','runtime_computed'],['knit.physical_thickness_m','实物厚度','m','UNKNOWN','unknown'],
 ['knit.areal_density_g_m2','实物面密度','g/m2','UNKNOWN','unknown'],['knit.linear_density_tex','纱线Tex','tex','UNKNOWN','unknown']
];
function dictionary(base,history){const d=A.dictionary(base,history);for(const [id,label,unit] of SPECS){if(d.measurements.some(m=>m.id==='rf01.'+id))throw Error('DICTIONARY_COLLISION');d.measurements.push({id:'rf01.'+id,label,domain:'fabric',unit,quantity:id.includes('instances')||id.includes('grid_')?'count':unit==='m'?'length':unit==='g/m2'?'areal_density':unit==='tex'?'linear_density':'native_control',definition:'保留版P02针织工作台的具名生成量或独立未确认物理量；不能与R15历史工程估计直接合并。',owner:'knit-public-p02',requiredEvidence:['source pin','measurement method','native build/frame'],notEquivalentTo:['physical sample certification','R15 engineering estimate']});}P.validateDictionary(d);return d;}
function validate(x,source){
 if(!x||x.schema!=='kaopu/reality-workbench-export@1'||x.exporterVersion!=='0.3.1-b')throw Error('EXPORT_SCHEMA_UNSUPPORTED');
 if(x.objectId!=='fabric-knit-public-p02-c2'||x.domain!=='fabric'||x.family!=='knit')throw Error('EXPORT_IDENTITY_MISMATCH');P.source(x.source);if(!A.sameSource(x.source,source))throw Error('SOURCE_REVISION_MISMATCH');
 if(!x.capture||!Number.isInteger(x.capture.sequence)||x.capture.sequence<1||!Number.isFinite(Date.parse(x.capture.capturedAt))||!Number.isInteger(x.capture.nativeBuild)||x.capture.nativeBuild<1||!finite(x.capture.elapsedMs)||x.capture.elapsedMs<0)throw Error('CAPTURE_INVALID');
 if(!['metadata_and_samples','full_cpu_arrays'].includes(x.capture.integrityMode))throw Error('INTEGRITY_SCOPE_INVALID');
 if(!x.authorities||['sourceWriteAPI','repairAuthorized','physicalCertification','manufacturingCertification','productionReady'].some(k=>x.authorities[k]!==false))throw Error('AUTHORITY_ESCALATION_REJECTED');
 if(!x.capabilities||['clothPhysics','materialSpaceBindingToGarment','physicalCalibration'].some(k=>x.capabilities[k]!==false))throw Error('UNPROVEN_CAPABILITY');
 if(!Array.isArray(x.measurements)||x.measurements.length!==SPECS.length)throw Error('MEASUREMENT_SET_MISMATCH');
 for(let i=0;i<SPECS.length;i++){const [id,,unit,status,basis]=SPECS[i],m=x.measurements[i];if(!m||m.id!==id||m.unit!==unit||m.status!==status||m.basis!==basis||typeof m.method!=='string'||!m.method)throw Error('MEASUREMENT_SEMANTICS_MISMATCH:'+id);if(i>=11&&m.value!==null)throw Error('UNKNOWN_MUST_STAY_NULL');if(i<11&&(!finite(m.value)||m.value<0))throw Error('MEASUREMENT_NUMBER_INVALID');}
 const g=x.geometry,u=x.shaderInputs,r=x.requested;if(!g||g.gridColumns!==16||g.gridRows!==20||g.carrierVertices!==270400||g.carrierTriangles!==491520||g.shortInstances!==307200||g.surfaceInstances!==30720)throw Error('NATIVE_GEOMETRY_LAYOUT_MISMATCH');
 if(!u||!finite(u.length)||!finite(u.density)||typeof u.active!=='boolean')throw Error('GPU_INPUT_INVALID');
 if(!r||!['fiber','carrier'].includes(r.mode)||!['jersey','rib'].includes(r.shape)||!['plain','stripe','diamond'].includes(r.pattern)||!/^#[0-9a-f]{6}$/i.test(r.color))throw Error('NATIVE_REQUEST_INVALID');
 for(const k of ['fuzz','length','detail','twist','mottle'])if(!finite(r[k])||r[k]<0||r[k]>1.6)throw Error('NATIVE_REQUEST_INVALID');
 if(u.active!==(r.mode==='fiber'))throw Error('DRAW_ACTIVITY_MISMATCH');
 const v=x.measurements.map(m=>m.value),close=(a,b,t=2e-8)=>finite(a)&&finite(b)&&Math.abs(a-b)<=t;
 if(v[0]!==16||v[1]!==20||!close(v[2],.0058)||!close(v[3],.0029)||v[4]!==.00172||v[6]!==307200||v[7]!==30720||v[8]!==(u.active?r.fuzz:0)||v[9]!==r.length)throw Error('OBSERVATION_RELATION_MISMATCH');
 if(u.active&&(!close(u.length,r.length,2e-6)||!close(u.density,r.fuzz,2e-6)))throw Error('NATIVE_FRAME_PENDING');
 if(!Array.isArray(g.sampleStrand)||!Array.isArray(g.sampleCurve)||g.sampleStrand.length!==3||g.sampleCurve.length!==3||![...g.sampleStrand,...g.sampleCurve].every(finite))throw Error('FIBER_SAMPLE_INVALID');
 if(!close(v[10],Math.hypot(...g.sampleStrand.map((p,i)=>(p+g.sampleCurve[i])*u.length)),1e-12))throw Error('SAMPLE_FORMULA_MISMATCH');
 if(!x.preservation||x.preservation.passed!==true||typeof x.preservation.before!=='string'||x.preservation.before!==x.preservation.after||!x.preservation.scope)throw Error('PRESERVATION_INVALID');
 return true;
}
function knit(x,d,source,imported=false){
 validate(x,source);const measurements=x.measurements.map(m=>P.makeMeasurement(d,'rf01.'+m.id,m.value,{status:m.status,unit:m.unit,basis:m.basis,method:m.method,sourceRef:source.commit,context:{originalRecord:copy(m),physicalCalibration:false}}));
 const checks=measurements.map(m=>P.makeCheck('measurement:'+m.definitionId,m.status,m.method,{measurementId:m.definitionId,owner:'knit-public-p02',observed:m.value}));
 checks.push(P.makeCheck('source:transport',imported?'UNKNOWN':'PASS',imported?'导入报告没有在本次原生实例复验':'从保留版P02 C2当前实例只读获取',{owner:'reality-platform'}));
 checks.push(P.makeCheck('source:preservation',imported?'UNKNOWN':'PASS',imported?'文件中自述的不变性不是本次实测':'本次同步读取前后受检范围一致：'+x.capture.integrityMode));
 checks.push(P.makeCheck('native:draw',x.shaderInputs.active?'PASS':'NOT_APPLICABLE',x.shaderInputs.active?'短绒当前参与绘制，GPU数值与当前设置匹配':'短绒当前隐藏；最近上传uniform不得称为当前画面贡献'));
 checks.push(P.makeCheck('physical:solver','NOT_APPLICABLE','本P02外观样片没有布料物理解算；不能从旧R15借用物性'));
 checks.push(P.makeCheck('material:binding','UNKNOWN','当前样片材料参考坐标尚未绑定成衣裁片/人物版本',{owner:'knit-public-p02'}));
 checks.push(P.makeCheck('source:legacy','WARNING','S3中的R15针织历史与当前P02是不同对象，原历史继续保留',{owner:'reality-platform'}));
 const candidate={schema:P.OBJECT_SCHEMA,objectId:x.objectId,domain:'fabric',name:'毛衣 KNIT-P02 C2 · '+(imported?'导入观察':'原生观察'),sourceMode:imported?'imported_unverified':'live_read_only',source:copy(source),units:[{quantity:'length',unit:'m',basis:'source_declared'}],frames:[],measurements,checks,defects:checks.filter(c=>['FAIL','WARNING','UNKNOWN'].includes(c.status)).map(c=>P.makeDefect(x.objectId,c,{sourceCommit:source.commit})),preservation:imported?null:copy(x.preservation),extensions:{owner:'knit-public-p02',originalExport:copy(x),sourceAuthority:'retained-public-native-copy-not-production-installation',capturedAt:x.capture.capturedAt,unsupportedOriginalMeasurements:[]}};
 return P.finalizeObject(candidate,d);
}
function normalize(x,d,sources,imported=false){if(x?.family==='knit')return knit(x,d,sources.knit,imported);if(x?.family==='denim')return A.live(x,d,sources.denim,imported);throw Error('EXPORT_FAMILY_UNSUPPORTED');}
const api=Object.freeze({SPECS,dictionary,validate,knit,normalize,parse:A.parse,diff:A.diff,historyObject:A.historyObject,MAX_BYTES:A.MAX_BYTES});root.RealityKnitBridge=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
