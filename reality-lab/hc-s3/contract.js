/* KAOPU Reality HC S3. Pure validation and reporting; no source workbench writes. */
(function(root){
'use strict';
const VERSION='0.3.0';
const SCHEMA='kaopu/reality-material-snapshot-set@1';
const STATUS=Object.freeze(['PASS','FAIL','WARNING','UNKNOWN','NOT_APPLICABLE']);
const STATUS_LABEL=Object.freeze({PASS:'已核对',FAIL:'明确冲突',WARNING:'已有风险',UNKNOWN:'缺少证据',NOT_APPLICABLE:'当前不适用'});
const DEFINITIONS=Object.freeze({
 'material.warp_spacing_m':{label:'经纱中心间距',unit:'m',dimension:'length'},
 'material.weft_spacing_m':{label:'纬纱中心间距',unit:'m',dimension:'length'},
 'material.twill_repeat_m':{label:'织纹重复尺度',unit:'m',dimension:'length'},
 'material.loop_pitch_m':{label:'针目节距',unit:'m',dimension:'length'},
 'material.stitch_pitch_m':{label:'针脚节距',unit:'m',dimension:'length'},
 'material.visible_thread_width_m':{label:'可见线宽',unit:'m',dimension:'length'},
 'material.yarn_diameter_m':{label:'纱线几何直径',unit:'m',dimension:'length'},
 'material.thickness_m':{label:'材料厚度',unit:'m',dimension:'length'},
 'material.grain_repeat_m':{label:'皮纹重复尺度',unit:'m',dimension:'length'},
 'material.areal_density_kg_m2':{label:'面密度',unit:'kg/m2',dimension:'areal_density'},
 'material.linear_density_tex':{label:'线密度 Tex',unit:'tex',dimension:'linear_density'},
 'material.linear_density_denier':{label:'线密度 Denier',unit:'denier',dimension:'linear_density'},
 'material.knit_gauge':{label:'针织机号 / 针目密度',unit:'gauge',dimension:'construction'},
 'material.material_axis_u':{label:'材料 U 轴语义',unit:'axis',dimension:'axis'},
 'material.texture_scale_native':{label:'原生显示尺度',unit:'1',dimension:'native_control'},
 'physics.stretch_warp_N_m':{label:'方向一拉伸参数',unit:'N/m',dimension:'solver_parameter'},
 'physics.stretch_weft_N_m':{label:'方向二拉伸参数',unit:'N/m',dimension:'solver_parameter'},
 'physics.shear_N_m':{label:'剪切参数',unit:'N/m',dimension:'solver_parameter'},
 'physics.friction':{label:'摩擦参数',unit:'1',dimension:'solver_parameter'}
});
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const clone=x=>JSON.parse(JSON.stringify(x));
function countStatuses(rows){const out=Object.fromEntries(STATUS.map(x=>[x,0]));for(const row of rows||[])if(STATUS.includes(row.status))out[row.status]++;return out;}
function validateMeasurement(m){const errors=[];if(!m||typeof m!=='object')return ['measurement must be object'];const d=DEFINITIONS[m.definitionId];if(!d)errors.push('unknown definitionId '+String(m.definitionId));if(!STATUS.includes(m.status))errors.push('invalid status '+String(m.status));if(d&&m.unit!==d.unit)errors.push(m.definitionId+' expected '+d.unit+' but got '+String(m.unit));if(['UNKNOWN','NOT_APPLICABLE'].includes(m.status)){if(m.value!==null&&d?.dimension!=='native_control')errors.push(m.definitionId+' '+m.status+' must use null value unless it is a separately declared native control');if(d?.dimension==='native_control'&&m.value!==null&&!finite(m.value)&&typeof m.value!=='string')errors.push(m.definitionId+' native control value invalid');}else if(!finite(m.value)&&typeof m.value!=='string')errors.push(m.definitionId+' requires a finite number or explicit string value');if(d?.dimension==='length'&&['tex','denier'].includes(m.unit))errors.push('linear density cannot be a geometric length');if(d?.dimension==='linear_density'&&m.unit==='m')errors.push('Tex or Denier cannot be stored as metres');if(!m.basis)errors.push(m.definitionId+' basis missing');if(!m.note)errors.push(m.definitionId+' note missing');return errors;}
function validateDefect(d){const errors=[];if(!d||typeof d!=='object')return ['defect must be object'];for(const key of ['id','code','owner','expected','observed'])if(typeof d[key]!=='string'||!d[key])errors.push('defect '+key+' missing');if(!['FAIL','WARNING','UNKNOWN'].includes(d.status))errors.push('defect status must be FAIL, WARNING or UNKNOWN');if(d.repairAuthorized!==false)errors.push('Reality Foundation cannot authorize source repair');if(d.verificationRequired!==true)errors.push('defect must require re-verification');return errors;}
function validateObject(o){const errors=[];if(!o||typeof o!=='object')return ['object missing'];for(const key of ['id','family','name','mode','summary'])if(typeof o[key]!=='string'||!o[key])errors.push(key+' missing');if(!Number.isInteger(o.priority)||o.priority<1)errors.push('priority invalid');if(!o.source||typeof o.source!=='object')errors.push('source missing');if(!Array.isArray(o.measurements)||!o.measurements.length)errors.push('measurements missing');else for(const m of o.measurements)errors.push(...validateMeasurement(m).map(e=>o.id+': '+e));if(!Array.isArray(o.checks))errors.push('checks missing');else for(const c of o.checks){if(!STATUS.includes(c.status))errors.push(o.id+': invalid check status');if(!c.code||!c.message)errors.push(o.id+': incomplete check');}if(!Array.isArray(o.defects))errors.push('defects missing');else for(const d of o.defects)errors.push(...validateDefect(d).map(e=>o.id+': '+e));return errors;}
function validateSet(data){const errors=[];if(!data||typeof data!=='object')return {passed:false,errors:['root must be object']};if(data.schema!==SCHEMA)errors.push('schema mismatch');if(data.version!=='REALITY-HC-S3')errors.push('version mismatch');if(JSON.stringify(data.statusVocabulary)!==JSON.stringify(STATUS))errors.push('status vocabulary mismatch');if(!Array.isArray(data.objects)||data.objects.length!==7)errors.push('exactly seven material objects required');else {const ids=new Set(),families=new Set(),priorities=[];for(const o of data.objects){if(ids.has(o.id))errors.push('duplicate id '+o.id);ids.add(o.id);if(families.has(o.family))errors.push('duplicate family '+o.family);families.add(o.family);priorities.push(o.priority);errors.push(...validateObject(o));}if(JSON.stringify([...priorities].sort((a,b)=>a-b))!==JSON.stringify([1,2,3,4,5,6,7]))errors.push('priority order must be 1..7');for(const family of ['denim','knit','leather','silk','cotton','acrylic','linen'])if(!families.has(family))errors.push('missing family '+family);}if(!Array.isArray(data.registeredOnly)||!data.registeredOnly.some(x=>x.id==='garment-s5'&&x.status==='registered-only'))errors.push('garment registered-only entry missing');return {passed:errors.length===0,errors};}
function objectReport(o){const rows=[...(o.measurements||[]),...(o.checks||[])];return {id:o.id,family:o.family,name:o.name,mode:o.mode,statuses:countStatuses(rows),measurements:clone(o.measurements),checks:clone(o.checks),defects:clone(o.defects),source:clone(o.source),nativeParameters:clone(o.nativeParameters||[]),summary:o.summary,writeAPI:false,automaticRepair:false,physicalCertification:false,manufacturingCertification:false,aestheticAcceptance:false,productionReady:false};}
function coverage(o){const expected=['material.thickness_m','material.warp_spacing_m','material.weft_spacing_m','material.yarn_diameter_m','material.stitch_pitch_m','material.linear_density_tex','material.linear_density_denier'];const by=new Map((o.measurements||[]).map(m=>[m.definitionId,m]));return expected.map(id=>{const m=by.get(id);return {definitionId:id,label:DEFINITIONS[id].label,status:m?.status||'UNKNOWN',value:m?.value??null,unit:m?.unit||DEFINITIONS[id].unit,note:m?.note||'当前对象未提供此项。'};});}
function pixelFootprint({distanceM,fovYDeg,heightPx,featureMm,zoom=1}){if(![distanceM,fovYDeg,heightPx,featureMm,zoom].every(finite)||distanceM<=0||heightPx<=0||featureMm<0||zoom<=0||fovYDeg<=0||fovYDeg>=180)throw Error('invalid footprint input');const mmPerPixel=2000*distanceM*Math.tan(fovYDeg*Math.PI/360)/(heightPx*zoom);return {mmPerPixel,featurePixels:featureMm/mmPerPixel,assumption:'透视相机；样本平面垂直视轴；不包含斜角、镜头模糊、TAA、mipmap 或人眼可见性保证。'};}
function defectBundle(data){return {schema:'kaopu/reality-defect-bundle@1',version:'REALITY-HC-S3',generatedAt:new Date().toISOString(),repairAuthorized:false,verificationRequired:true,items:data.objects.flatMap(o=>(o.defects||[]).map(d=>({...clone(d),objectId:o.id,family:o.family,source:clone(o.source)})))};}
const api=Object.freeze({VERSION,SCHEMA,STATUS,STATUS_LABEL,DEFINITIONS,countStatuses,validateMeasurement,validateDefect,validateObject,validateSet,objectReport,coverage,pixelFootprint,defectBundle,clone});
root.RealityMaterialContract=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
