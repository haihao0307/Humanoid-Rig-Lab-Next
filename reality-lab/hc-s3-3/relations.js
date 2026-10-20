/* Pure checks over actual pre-physics bindings and a separately recorded native outcome. */
(function(root){
'use strict';
const P=root.RealityProtocol||(typeof require==='function'?require('../hc-s2-1/protocol.js'):null);
const clone=x=>JSON.parse(JSON.stringify(x)),finite=x=>typeof x==='number'&&Number.isFinite(x),HASH=/^[0-9a-f]{64}$/;
const keys=['geometrySHA256','topologySHA256','stateSHA256','adapterFingerprint'];
function hasIdentity(a){return !!a&&keys.every(k=>HASH.test(a[k]||''));}
function equalIdentity(a,b){return hasIdentity(a)&&hasIdentity(b)&&keys.every(k=>a[k]===b[k]);}
function identityStatus(a,b){return !hasIdentity(a)||!hasIdentity(b)?'UNKNOWN':equalIdentity(a,b)?'PASS':'FAIL';}
function dictionary(base){const d=clone(base);for(const [id,label,unit,q]of [['panel_count','裁片数量','1','count'],['uv_error_m','显示材料坐标最大误差','m','length'],['weave_scale','牛仔显示织纹倍率','1','native_control']])d.measurements.push({id:'rf01.garment.'+id,label,domain:'garment',unit,quantity:q,definition:'来自冻结原工作台试穿前绑定的具名关系观测；不自动升级为实物测量或试穿认证。',owner:'tailor-workbench',requiredEvidence:['source identity','capture provenance'],notEquivalentTo:['physical certification']});P.validateDictionary(d);return d;}
function validate(x,expected){
 if(!x||x.schema!=='kaopu/garment-relations-observation@1'||x.version!=='RF01-S3.3')throw Error('OBSERVATION_SCHEMA_INVALID');
 P.source(x.source);if(!['repository','commit','path','sha256'].every(k=>x.source[k]===expected[k]))throw Error('SOURCE_PIN_MISMATCH');
 if(!x.capture||!Number.isFinite(Date.parse(x.capture.capturedAt))||x.capture.mode!=='native_prephysics_binding_capture'||x.capture.frame!==null||x.capture.lookId!=='D03'||!Number.isInteger(x.capture.requestGeneration)||x.capture.requestGeneration<1)throw Error('CAPTURE_SCOPE_INVALID');
 if(!x.sourceOutcome||typeof x.sourceOutcome.error!=='boolean'||typeof x.sourceOutcome.statusText!=='string'||!x.sourceOutcome.statusText||!Number.isInteger(x.sourceOutcome.committedGarmentCount)||x.sourceOutcome.committedGarmentCount<0||x.sourceOutcome.committedGarmentCount>2)throw Error('SOURCE_OUTCOME_REQUIRED');
 if(!x.authority||['sourceWriteAPI','repairAuthorized','productionInstalled','physicalCertification','manufacturingCertification','fitCertified'].some(k=>x.authority[k]!==false))throw Error('AUTHORITY_ESCALATION_REJECTED');
 if(!x.person||!Array.isArray(x.pieces)||x.pieces.length!==2)throw Error('GARMENT_SET_INVALID');
 const roles=new Set();for(const g of x.pieces){if(!['top','bottom'].includes(g.role)||roles.has(g.role))throw Error('DUPLICATE_ROLE');roles.add(g.role);if(typeof g.presetId!=='string'||!g.binding||!g.material||typeof g.materialID!=='string'||!g.acceptance)throw Error('BINDING_MISSING');if(!Array.isArray(g.panels)||g.panels.length<1||g.panels.length>100)throw Error('PANELS_INVALID');const ids=new Set();for(const p of g.panels){if(typeof p.id!=='string'||ids.has(p.id))throw Error('PANEL_ID_INVALID');ids.add(p.id);if(p.paperUnit!=='mm'||p.appearanceUnit!=='m')throw Error('UNIT_MISMATCH');if(!finite(p.maxUVErrorM)||p.maxUVErrorM<0)throw Error('UV_ERROR_INVALID');if(!Array.isArray(p.appearanceAxes)||p.appearanceAxes.length!==4||!p.appearanceAxes.every(finite))throw Error('AXES_INVALID');if(!Array.isArray(p.boundaryMm)||p.boundaryMm.length>10000||p.boundaryMm.some(e=>!Array.isArray(e)||e.length!==2||e.some(v=>!Array.isArray(v)||v.length!==2||!v.every(finite))))throw Error('BOUNDARY_INVALID');}if(!HASH.test(g.computedMaterialMeshSHA256||''))throw Error('MESH_HASH_INVALID');}
 if(!x.preservation||x.preservation.passed!==true||x.preservation.before!==x.preservation.after)throw Error('PRESERVATION_INVALID');
 return true;
}
function inspect(x,facts,d,{imported=false,scenario=false}={}){
 validate(x,facts.source);const output=[];
 for(const g of x.pieces){const checks=[],owner='tailor-workbench';const add=(id,status,message,expected=null,observed=null)=>checks.push(P.makeCheck(id,status,message,{owner,expected,observed,sourceRef:x.source.commit}));
  add('capture:provenance',imported?'UNKNOWN':scenario?'WARNING':'PASS',imported?'外部导入仅为声明；关系重新计算，不冒充本次原台读取':scenario?'人工反例副本，不是原台发生的新绑定缺陷':'原程序试穿前绑定的冻结捕获；不是成功显示的成衣或当前网页实时跟随');
  add('person:identity',identityStatus(g.binding.person,x.person.identity),'衣物目标人物的四项身份摘要与实际加载人物核对；缺项不猜测',x.person.identity,g.binding.person);
  add('person:actor',identityStatus(x.person.actorTargetIdentity,x.person.identity),'将交给物理的动作宿主与显示人物目标身份核对',x.person.identity,x.person.actorTargetIdentity);
  add('person:source_revision',x.person.sourceRevision==null?'UNKNOWN':x.person.sourceRevision===facts.manifest.personRevision?'PASS':'FAIL','人物源码提交与R10构建声明对照；它不是比例版本号',facts.manifest.personRevision,x.person.sourceRevision);
  const pr=x.person.explicitProportionRevision,gr=g.explicitProportionRevision;
  add('person:proportion_revision',pr==null||gr==null?'UNKNOWN':pr===gr?'PASS':'FAIL','只核对明确的proportion_revision/proportionRevision；不从源码提交或人体哈希推断',pr,gr);
  add('pattern:preset',g.binding.presetId===g.presetId?'PASS':'FAIL','准备的成衣对象与原裁片预设身份一致',g.presetId,g.binding.presetId);
  add('pattern:material_mesh_hash',g.binding.materialSHA256===g.computedMaterialMeshSHA256?'PASS':'FAIL','materialSHA256在原台指裁片材料网格，不是外观面料版本',g.binding.materialSHA256,g.computedMaterialMeshSHA256);
  add('pattern:grading',g.sourceTemplateBinding&&g.binding.sizeGrade?'PASS':'UNKNOWN','保留旧模板来源与新人物分级记录；旧人物不相同本身不判冲突',null,g.binding.sizeGrade||null);
  const catalog=facts.materials.find(m=>m.id===g.materialID);
  add('material:id',catalog&&g.material.id===g.materialID?'PASS':'FAIL','分配的面料ID必须能在冻结宿主目录解析',g.materialID,g.material.id);
  add('material:donor',catalog&&g.material.runtimeDonor===catalog.runtimeDonor?'PASS':'FAIL','材料供体声明必须与同一冻结目录一致',catalog?.runtimeDonor||null,g.material.runtimeDonor||null);
  const independent=facts.connections.entries.find(e=>e.family===g.material.family)?.lineage,donorCommit=String(g.material.runtimeDonor||'').split('@')[1]||null;
  add('material:independent_workbench',!independent?'UNKNOWN':donorCommit===independent.commit?'PASS':'WARNING','独立材料工作台通过不等于这件衣服已采用同版本；不同源只报告边界，不自动换材质',independent?.commit||null,donorCommit);
  if(g.material.family==='denim'){
   const scale=g.material.settings?.weaveScale,actual=g.material.geometry,base=catalog?.geometry;
   const matches=finite(scale)&&base&&actual&&Math.abs(actual.warpPitch-base.warpPitch*scale)<1e-8&&Math.abs(actual.weftPitch-base.weftPitch*scale)<1e-8;
   add('material:visual_scale',matches?'PASS':'FAIL','显示纱距=源纱距×显示倍率；这是原参数关系，不是实物经纬密度',{warp:base?.warpPitch*scale,weft:base?.weftPitch*scale},{warp:actual?.warpPitch,weft:actual?.weftPitch,unit:'mm'});
   add('material:physical_thickness',base&&actual?.thickness===base.thickness?'PASS':'FAIL','显示织纹倍率不应被误当成原物理厚度参数倍率；参数本身未实物标定',base?.thickness,actual?.thickness);
  }
  for(const p of g.panels){const expected=facts.axes[p.id],mat=p.appearanceAxes;
   add('axis:'+p.id,expected&&mat.every((v,i)=>v===expected[i])&&p.maxUVErrorM<=2e-7?'PASS':'FAIL','准备网格的显示UV与原mapPanelUV毫米→米变换核对：'+p.id,expected,{matrix:mat,maxErrorM:p.maxUVErrorM});
  }
  add('axis:physics','UNKNOWN','显示方向不证明物理各向异性已绑定；原字段若存在仍缺少与显示轴的映射证据',null,g.panels.map(p=>({id:p.id,field:p.physicsGrain})));
  add('axis:manufacturing','UNKNOWN','显示方向不是制造丝缕认证；不根据纸样形状推断经纬或裁剪要求');
  add('fit:target_static',g.acceptance.targetStaticPassed?'WARNING':'UNKNOWN',g.acceptance.targetStaticPassed?'静态标记存在，但本轮不把它当全面试穿认证':'旧模板静态通过不等于分级后的当前人物通过：'+(g.acceptance.targetStaticReason||'缺少目标证据'));
  add('fit:captured_runtime',imported?'UNKNOWN':x.sourceOutcome.error?'FAIL':'WARNING',imported?'外部文件声称的试穿运行结果未重新验证':x.sourceOutcome.error?'本次原程序报告失败，不能把已准备的裁片当作试穿成功：'+x.sourceOutcome.statusText:'原台已运行，但本关系检查没有授予完整动态试穿认证',null,x.sourceOutcome);
  add('fit:upstream_gate','WARNING','原R10发布仍未获整衣验收；保留已知动态布料失败边界',true,facts.manifest.fullGarmentAccepted);
  add('source:read_only',imported?'UNKNOWN':'PASS',imported?'文件中保护声明未在本浏览器重新实测':'试穿前只读观察与原数组解耦，受检值和冻结标记保持；没有源工作台写入接口');
  const max=Math.max(...g.panels.map(p=>p.maxUVErrorM));const measurements=[P.makeMeasurement(d,'rf01.garment.panel_count',g.panels.length,{basis:'runtime_computed',method:'原生准备packet.spec.panels.length'}),P.makeMeasurement(d,'rf01.garment.uv_error_m',max,{basis:'runtime_computed',method:'实际准备mesh UV与原mapPanelUV逐点比较'})];if(g.material.family==='denim')measurements.push(P.makeMeasurement(d,'rf01.garment.weave_scale',g.material.settings.weaveScale,{basis:'runtime_computed',method:'原生构造info.settings；无量纲显示控制'}));
  const id='garment-r10-d03-'+g.role;output.push(P.finalizeObject({schema:P.OBJECT_SCHEMA,objectId:id,domain:'garment',name:'D03 '+(g.role==='top'?'上衣':'下装')+' '+g.presetId+' · 试穿前绑定',sourceMode:imported?'imported_unverified':'fixed_snapshot',source:x.source,units:[{quantity:'length',unit:'mm',basis:'source_declared'}],frames:[],measurements,checks,defects:checks.filter(c=>['FAIL','WARNING','UNKNOWN'].includes(c.status)).map(c=>P.makeDefect(id,c,{sourceCommit:x.source.commit})),extensions:{capturedAt:x.capture.capturedAt,stage:'prepared_before_physics',live:false,scenario,sourceOutcome:x.sourceOutcome,material:g.material,panels:g.panels,person:x.person,originalBinding:g.binding,sourceTemplateBinding:g.sourceTemplateBinding,fieldSemantics:'materialSHA256 is material-domain geometry; not visual shader/material lineage'}},d));
 }
 return P.aggregate(output,d);
}
function parse(text){if(typeof text!=='string'||new TextEncoder().encode(text).length>2000000)throw Error('IMPORT_TOO_LARGE');return JSON.parse(text);}
const api=Object.freeze({dictionary,validate,inspect,parse,equalIdentity});root.GarmentRelations33=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
