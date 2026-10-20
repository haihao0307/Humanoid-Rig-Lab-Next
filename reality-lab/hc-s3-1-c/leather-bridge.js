(function(root){
'use strict';
const P=root.RealityProtocol||(typeof require==='function'?require('../hc-s2-1/protocol.js'):null),K=root.RealityKnitBridge||(typeof require==='function'?require('../hc-s3-1-b/knit-bridge.js'):null);
const copy=x=>JSON.parse(JSON.stringify(x)),finite=x=>typeof x==='number'&&Number.isFinite(x),PRODUCTS=Object.freeze({wallet:1.2,belt:3.2,bag:2,cowboy:1.8,pirate:1.8,swatch:1.4});
const SPECS=[
 ['leather.thickness_scale','厚度倍率','1','PASS','runtime_computed'],
 ['leather.primary_design_thickness_m','主片配方目标厚度','m','PASS','source_declared'],
 ['leather.panel_design_min_m','生成裁片厚度最小值','m','PASS','runtime_computed'],['leather.panel_design_max_m','生成裁片厚度最大值','m','PASS','runtime_computed'],
 ['leather.sampled_shell_min_m','当前壳面采样间距最小值','m','WARNING','runtime_computed'],['leather.sampled_shell_max_m','当前壳面采样间距最大值','m','WARNING','runtime_computed'],
 ['leather.requested_stitch_pitch_m','原生请求针距','m','PASS','source_declared'],['leather.seam_pitch_min_m','生成针路节距最小值','m','PASS','runtime_computed'],['leather.seam_pitch_max_m','生成针路节距最大值','m','PASS','runtime_computed'],
 ['leather.thread_nominal_diameter_m','数字缝线名义直径','m','WARNING','source_declared'],
 ['leather.physical_thickness_m','实物皮料厚度','m','UNKNOWN','unknown'],['leather.areal_density_g_m2','实物面密度','g/m2','UNKNOWN','unknown'],['leather.linear_density_tex','缝线Tex','tex','UNKNOWN','unknown'],
 ['leather.solver_dt_s','当前求解器时间步','s','PASS','runtime_computed'],['leather.solver_substeps','当前子步数','1','PASS','runtime_computed']
];
function dictionary(base,history){const d=K.dictionary(base,history);for(const [id,label,unit] of SPECS){if(!P.UNITS.includes(unit))continue;if(d.measurements.some(m=>m.id==='rf01.'+id))throw Error('DICTIONARY_COLLISION');d.measurements.push({id:'rf01.'+id,label,domain:'fabric',unit,quantity:id.endsWith('substeps')?'count':unit==='m'?'length':unit==='g/m2'?'areal_density':unit==='tex'?'linear_density':'native_control',definition:'R17原生成参数或已经呈现的数字壳面有限采样；不等于有压力和试样条件的实物测量。',owner:'leather-workshop-r17',requiredEvidence:['pinned source','product identity','method','pose version'],notEquivalentTo:['physical leather calibration','manufacturing acceptance']});}P.validateDictionary(d);return d;}
function validate(x,source){
 if(!x||x.schema!=='kaopu/reality-workbench-export@1'||x.exporterVersion!=='0.3.1-c')throw Error('EXPORT_SCHEMA_UNSUPPORTED');
 if(x.family!=='leather'||x.domain!=='fabric'||!Object.hasOwn(PRODUCTS,x.productId)||x.objectId!=='fabric-leather-r17-'+x.productId)throw Error('EXPORT_IDENTITY_MISMATCH');
 P.source(x.source);if(!source||!['repository','commit','path','sha256'].every(k=>x.source[k]===source[k]))throw Error('SOURCE_REVISION_MISMATCH');
 if(typeof x.materialId!=='string'||!x.materialId||x.materialId.length>100)throw Error('MATERIAL_ID_INVALID');
 const c=x.capture;if(!c||!Number.isInteger(c.sequence)||c.sequence<1||!Number.isFinite(Date.parse(c.capturedAt))||!finite(c.elapsedMs)||c.elapsedMs<0||!['metadata_and_samples','full_cpu_arrays'].includes(c.integrityMode))throw Error('CAPTURE_INVALID');
 for(const k of ['nativeRevision','nativeFrame','poseVersion','cachePoseVersion','solverAppliedPoses','solverStep'])if(!Number.isInteger(c[k])||c[k]<0)throw Error('CAPTURE_INVALID');
 if(c.poseVersion!==c.cachePoseVersion)throw Error('POSE_VERSION_MISMATCH');
 if(!x.authorities||['sourceWriteAPI','repairAuthorized','physicalCertification','manufacturingCertification','productionReady'].some(k=>x.authorities[k]!==false))throw Error('AUTHORITY_ESCALATION_REJECTED');
 if(!x.materialSpace||x.materialSpace.nativeWorldUnit!=='mm'||x.materialSpace.exportUnit!=='m'||x.materialSpace.conversionFactor!==.001||x.materialSpace.garmentBindingVerified!==false)throw Error('MATERIAL_SPACE_INVALID');
 if(!Array.isArray(x.measurements)||x.measurements.length!==SPECS.length)throw Error('MEASUREMENT_SET_MISMATCH');
 for(let i=0;i<SPECS.length;i++){const [id,,unit,status,basis]=SPECS[i],m=x.measurements[i];if(!m||m.id!==id||m.unit!==unit||m.status!==status||m.basis!==basis||typeof m.method!=='string'||!m.method)throw Error('MEASUREMENT_SEMANTICS_MISMATCH:'+id);if(i>=10&&i<=12){if(m.value!==null)throw Error('UNKNOWN_MUST_STAY_NULL');}else if(!finite(m.value)||m.value<0)throw Error('MEASUREMENT_NUMBER_INVALID');}
 if(!Array.isArray(x.parts)||x.parts.length<1||x.parts.length>512||!Array.isArray(x.seams)||x.seams.length<1||x.seams.length>4096)throw Error('PARTS_OR_SEAMS_INVALID');
 const names=new Set();for(const p of x.parts){if(!p||typeof p.id!=='string'||!p.id||names.has(p.id)||p.unit!=='m'||!finite(p.designThicknessM)||p.designThicknessM<=0||!Number.isInteger(p.paperVertices)||p.paperVertices<1)throw Error('PANEL_INVALID');names.add(p.id);
  if(!Array.isArray(p.sampleVertexIds)||!Array.isArray(p.sampledDistancesM)||p.sampleVertexIds.length<1||p.sampleVertexIds.length>16||p.sampleVertexIds.length!==p.sampledDistancesM.length||!p.sampleVertexIds.every(i=>Number.isInteger(i)&&i>=0&&i<p.paperVertices)||!p.sampledDistancesM.every(v=>finite(v)&&v>=0))throw Error('SHELL_SAMPLE_INVALID');
  if(p.sampledMinM!==Math.min(...p.sampledDistancesM)||p.sampledMaxM!==Math.max(...p.sampledDistancesM))throw Error('SHELL_RANGE_INVALID');
 }
 for(const s of x.seams){
  if(!s||typeof s.id!=='string'||!finite(s.pitchM)||s.pitchM<=0||!Number.isInteger(s.holeCount)||s.holeCount<2||!finite(s.pathLengthM)||s.pathLengthM<=0||!Number.isInteger(s.intervalCount)||s.intervalCount<1||typeof s.knotHoles!=='boolean'||!Number.isInteger(s.controlPointCount)||s.controlPointCount<2||!finite(s.requestedPitchM)||s.requestedPitchM<=0)throw Error('SEAM_INVALID');
  if(s.intervalCount!==s.holeCount-1||Math.abs(s.pitchM-s.pathLengthM/s.intervalCount)>1e-12)throw Error('SEAM_INTERVAL_RELATION_MISMATCH');
  const intervals=s.knotHoles?s.controlPointCount-1:Math.max(4,Math.round(s.pathLengthM/s.requestedPitchM));
  if(s.intervalCount!==intervals)throw Error('SEAM_COUNT_RELATION_MISMATCH');
 }
 const r=x.requested,v=x.measurements.map(m=>m.value),close=(a,b)=>finite(a)&&finite(b)&&Math.abs(a-b)<=1e-12;
 if(!r||!finite(r.thicknessScale)||r.thicknessScale<=0||!finite(r.pitch)||r.pitch<=0||!finite(r.threadDiameter)||r.threadDiameter<=0)throw Error('REQUEST_INVALID');
 if(x.seams.some(s=>!close(s.requestedPitchM,r.pitch*.001)))throw Error('SEAM_REQUEST_MISMATCH');
 const expected=[r.thicknessScale,PRODUCTS[x.productId]*r.thicknessScale*.001,Math.min(...x.parts.map(p=>p.designThicknessM)),Math.max(...x.parts.map(p=>p.designThicknessM)),Math.min(...x.parts.map(p=>p.sampledMinM)),Math.max(...x.parts.map(p=>p.sampledMaxM)),r.pitch*.001,Math.min(...x.seams.map(s=>s.pitchM)),Math.max(...x.seams.map(s=>s.pitchM)),r.threadDiameter*.001];
 for(let i=0;i<expected.length;i++)if(!close(v[i],expected[i]))throw Error('OBSERVATION_RELATION_MISMATCH:'+SPECS[i][0]);
 const s=x.solver;if(!s||s.version!=='R17.0-B1'||s.physicalCalibration!==false||!s.configuration||!finite(s.configuration.dt)||s.configuration.dt<=0||!Number.isInteger(s.configuration.substeps)||s.configuration.substeps<1||v[13]!==s.configuration.dt||v[14]!==s.configuration.substeps)throw Error('SOLVER_SEMANTICS_INVALID');
 if(!x.preservation||x.preservation.passed!==true||typeof x.preservation.before!=='string'||x.preservation.before!==x.preservation.after||!x.preservation.scope)throw Error('PRESERVATION_INVALID');
 return true;
}
function leather(x,d,source,imported=false){
 validate(x,source);const measurements=[],unsupported=[],checks=[];
 for(const m of x.measurements){if(!P.UNITS.includes(m.unit)){unsupported.push(copy(m));checks.push(P.makeCheck('unsupported:'+m.id,'WARNING','共同协议尚未登记 '+m.unit+'；原值和单位保留在扩展，不伪装成无量纲。',{owner:'reality-platform',detail:m}));continue;}
  const n=P.makeMeasurement(d,'rf01.'+m.id,m.value,{unit:m.unit,status:m.status,basis:m.basis,method:m.method,sourceRef:source.commit,context:{originalRecord:copy(m),productId:x.productId,physicalCalibration:false}});measurements.push(n);checks.push(P.makeCheck('measurement:'+n.id,n.status,n.method,{owner:'leather-workshop-r17',measurementId:n.id,observed:n.value}));
 }
 checks.push(P.makeCheck('source:transport',imported?'UNKNOWN':'PASS',imported?'导入记录未经本次原生实例复验':'当前固定R17原生副本同步读取'));
 checks.push(P.makeCheck('source:preservation',imported?'UNKNOWN':'PASS',imported?'文件中的保护声明不等于新实测':'读取前后受检状态一致，未更新矩阵或推进物理'));
 const pitchDifference=x.seams.some(s=>Math.abs(s.pitchM-s.requestedPitchM)>1e-12);
 checks.push(P.makeCheck('seam:integer-distribution',pitchDifference?'WARNING':'PASS',pitchDifference?'请求针距与实际生成针距不同：原程序依据路径长度分配整数间隔。各针路长度、数量和计算关系已保留，未给制造公差，不能自动判工艺不合格。':'生成针距与请求值在本次数字计算中一致；不是实物工艺认证。',{owner:'leather-workshop-r17'}));
 checks.push(P.makeCheck('shell:sampling','WARNING','每片最多16对内外表面采样，不是全网格碰撞、制造厚度或全局极值认证。',{owner:'leather-workshop-r17'}));
 checks.push(P.makeCheck('solver:calibration','UNKNOWN','现有物理配置可读取，但材料、密度与测量条件未完成实物标定。',{owner:'leather-workshop-r17'}));
 checks.push(P.makeCheck('material:binding','UNKNOWN','未绑定外部裁片材料轴与人物比例版本。',{owner:'tailor-workbench'}));
 const out={schema:P.OBJECT_SCHEMA,objectId:x.objectId,domain:'fabric',name:'皮革 R17 · '+x.productId+' · '+(imported?'导入观察':'原生观察'),sourceMode:imported?'imported_unverified':'live_read_only',source:copy(source),units:[{quantity:'length',unit:'m',basis:'runtime_computed'}],frames:[],measurements,checks,defects:checks.filter(c=>['FAIL','WARNING','UNKNOWN'].includes(c.status)).map(c=>P.makeDefect(x.objectId,c,{sourceCommit:source.commit})),preservation:imported?null:copy(x.preservation),extensions:{owner:'leather-workshop-r17',originalExport:copy(x),capturedAt:x.capture.capturedAt,unsupportedOriginalMeasurements:unsupported,sourceAuthority:'isolated-original-native-copy-not-production-installation'}};
 return P.finalizeObject(out,d);
}
function normalize(x,d,sources,imported=false){return x?.family==='leather'?leather(x,d,sources.leather,imported):K.normalize(x,d,sources,imported);}
root.RealityLeatherBridge=Object.freeze({SPECS,PRODUCTS,dictionary,validate,leather,normalize,parse:K.parse,diff:K.diff,historyObject:K.historyObject,MAX_BYTES:K.MAX_BYTES});
if(typeof module!=='undefined'&&module.exports)module.exports=root.RealityLeatherBridge;
})(globalThis);
