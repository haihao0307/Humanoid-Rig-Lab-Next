/* Additive factory in the SHA256-pinned original R17 closure. No source setters. */
(function makeLeatherObserver(access,source){
'use strict';
const copy=x=>JSON.parse(JSON.stringify(x));
function freeze(x){if(x&&typeof x==='object'){Object.freeze(x);for(const v of Object.values(x))freeze(v);}return x;}
const pin=freeze(copy(source));let sequence=0;
function hashText(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');}
function hashBytes(a){const b=new Uint8Array(a.buffer,a.byteOffset,a.byteLength);let h=2166136261;for(let i=0;i<b.length;i++){h^=b[i];h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');}
function arrayState(a,full){if(!a)return null;const indexes=[0,1,2,Math.floor(a.length/2),a.length-3,a.length-2,a.length-1].filter(i=>i>=0&&i<a.length);return {length:a.length,bytes:a.byteLength,samples:indexes.map(i=>[i,a[i]]),hash:full?hashBytes(a):null};}
function attribute(a,full){return {count:a.count,itemSize:a.itemSize,version:a.version||0,gpuOnly:!!a.isGLBufferAttribute,data:a.array?arrayState(a.array,full):null};}
function mat(m){return {uuid:m.uuid,version:m.version,roughness:m.roughness,metalness:m.metalness,clearcoat:m.clearcoat,color:m.color?.toArray(),normalScale:m.normalScale?.toArray(),map:m.map?.uuid,normalMap:m.normalMap?.uuid,onBeforeCompile:String(m.onBeforeCompile),vertexShader:m.vertexShader,fragmentShader:m.fragmentShader};}
function protectedState(n,full){const r=n.hero.userData.rig,s=n.solver;return JSON.stringify({product:n.product,material:n.material,mode:n.mode,config:n.config,revision:n.revision,dirty:n.dirty,allDirty:n.allDirty,root:n.hero.uuid,rootMatrix:n.hero.matrix.elements,rootWorld:n.hero.matrixWorld.elements,rootNeeds:n.hero.matrixWorldNeedsUpdate,camera:{matrix:n.camera.matrix.elements,world:n.camera.matrixWorld.elements,projection:n.camera.projectionMatrix.elements},light:n.light,exposure:n.renderer.toneMappingExposure,skinSource:r.skinSource,pixels:arrayState(r.pixels,full),textureVersion:r.texture.version,cache:{version:r.poseCache?.version,updates:r.poseCache?.updates},solver:{positions:arrayState(s.x,full),rest:arrayState(s.rest,full),config:s.cfg,report:s._report,active:s._active,grab:s.grab,pending:s.pending.size,pendingPose:s.pendingPose,received:s.receivedPoses,applied:s.appliedPoses,inputSequence:s.inputSequence,inputEpoch:s.inputEpoch,appliedMeta:s.appliedPoseMeta},meshes:r.meshes.map(o=>({uuid:o.uuid,matrix:o.matrix.elements,world:o.matrixWorld.elements,needs:o.matrixWorldNeedsUpdate,attributes:Object.fromEntries(Object.entries(o.geometry.attributes).map(([k,a])=>[k,attribute(a,full)])),index:o.geometry.index?attribute(o.geometry.index,full):null,materials:(Array.isArray(o.material)?o.material:[o.material]).map(mat)}))});}
function read(options={}){
 if(!options||typeof options!=='object'||Object.keys(options).some(k=>k!=='fullIntegrity')||(options.fullIntegrity!==undefined&&typeof options.fullIntegrity!=='boolean'))throw Error('READ_OPTIONS_INVALID');
 const start=performance.now(),n=access(),full=options.fullIntegrity===true;
 if(!n.ready||!n.hero||!n.solver||n.solver.disposed)throw Error('NATIVE_NOT_READY');
 if(n.mode!=='products')throw Error('NATIVE_MODE_UNSUPPORTED:仅成品模式已接入；试样物理与基线页未接入');
 if(n.version!=='R17.0-B1'||!n.spec)throw Error('NATIVE_IDENTITY_CHANGED');
 const r=n.hero.userData.rig,s=n.solver;
 if(n.renderer.getContext().isContextLost())throw Error('NATIVE_CONTEXT_LOST');
 if(n.dirty||n.allDirty||s.pendingPose||s.pending.size||!r.poseCache||r.poseCache.version!==r.texture.version)throw Error('NATIVE_FRAME_PENDING');
 if(n.hero.matrixWorldNeedsUpdate||r.parts.some(p=>p.mesh.matrixWorldNeedsUpdate))throw Error('NATIVE_FRAME_PENDING');
 const before=protectedState(n,full),parts=[];
 for(const p of r.parts){
  const g=p.mesh.geometry,count=g.userData.paperVertices;
  if(!Number.isInteger(count)||count<1||!Number.isFinite(p.t)||p.t<=0)throw Error('NATIVE_PANEL_LAYOUT_INVALID');
  const ids=[...new Set(Array.from({length:Math.min(16,count)},(_,i)=>Math.round(i*(count-1)/(Math.min(16,count)-1||1))))];
  const distances=ids.map(i=>n.evaluate(p.mesh,r,i).distanceTo(n.evaluate(p.mesh,r,i+count))*.001);
  if(!distances.every(v=>Number.isFinite(v)&&v>=0))throw Error('NATIVE_SHELL_SAMPLE_INVALID');
  parts.push({id:p.name,index:p.index,designThicknessM:p.t*.001,sampledMinM:Math.min(...distances),sampledMaxM:Math.max(...distances),sampleVertexIds:ids,sampledDistancesM:distances,paperVertices:count,unit:'m',method:'16-or-fewer evenly indexed inner/outer pairs; original pure embedding evaluator and already-rendered world matrices; native mm converted to m'});
 }
 if(!parts.length)throw Error('NATIVE_PANEL_LAYOUT_INVALID');
 const seams=r.seams.map(q=>({id:q.id,pitchM:q.pitch*.001,holeCount:q.holes.length}));
 if(!seams.length||!seams.every(q=>Number.isFinite(q.pitchM)&&q.pitchM>0&&Number.isInteger(q.holeCount)))throw Error('NATIVE_SEAM_DATA_INVALID');
 const low=a=>Math.min(...a),high=a=>Math.max(...a);
 const values=[
 ['leather.thickness_scale','原生厚度倍率',n.config.thicknessScale,'1','PASS','runtime_computed','当前原生控制；无量纲，不等于毫米'],
 ['leather.primary_design_thickness_m','主片配方目标厚度',n.spec.t*n.config.thicknessScale*.001,'m','PASS','source_declared','产品主片名义厚度 × 当前倍率；附属裁片可有不同厚度'],
 ['leather.panel_design_min_m','生成裁片厚度最小值',low(parts.map(p=>p.designThicknessM)),'m','PASS','runtime_computed','读取已生成part.t；它进入数字几何/物理，不是实物测厚'],
 ['leather.panel_design_max_m','生成裁片厚度最大值',high(parts.map(p=>p.designThicknessM)),'m','PASS','runtime_computed','多裁片逐项读取，不把主片厚度套给全部部件'],
 ['leather.sampled_shell_min_m','当前壳面采样间距最小值',low(parts.map(p=>p.sampledMinM)),'m','WARNING','runtime_computed','原变形公式与已呈现矩阵的内外表面配对距离；含缝口压缩，仅有限采样'],
 ['leather.sampled_shell_max_m','当前壳面采样间距最大值',high(parts.map(p=>p.sampledMaxM)),'m','WARNING','runtime_computed','不是每个位置的全局极值，也不是实物皮料厚度'],
 ['leather.requested_stitch_pitch_m','原生请求针距',n.config.pitch*.001,'m','PASS','source_declared','原工艺控制的请求值；生成针路节距另列'],
 ['leather.seam_pitch_min_m','生成针路节距最小值',low(seams.map(q=>q.pitchM)),'m','PASS','runtime_computed','读取当前SeamPath.pitch；不自动等于弯曲后每两个孔的空间弦长'],
 ['leather.seam_pitch_max_m','生成针路节距最大值',high(seams.map(q=>q.pitchM)),'m','PASS','runtime_computed','当前生成针路参数的范围'],
 ['leather.thread_nominal_diameter_m','数字缝线名义直径',n.config.threadDiameter*.001,'m','WARNING','source_declared','数字缝线构造输入，不是纤维直径或Tex'],
 ['leather.physical_thickness_m','实物皮料厚度',null,'m','UNKNOWN','unknown','没有本材料试样、压力与测厚方法证据'],
 ['leather.areal_density_g_m2','实物面密度',null,'g/m2','UNKNOWN','unknown','求解器密度假设不能代替实物面密度'],
 ['leather.linear_density_tex','缝线Tex',null,'tex','UNKNOWN','unknown','数字几何线径不能直接反推Tex'],
 ['leather.solver_dt_s','当前求解器时间步',s.cfg.dt,'s','PASS','runtime_computed','读取本原生求解器配置，不改变或推进物理'],
 ['leather.solver_substeps','当前子步数',s.cfg.substeps,'1','PASS','runtime_computed','只是当前解算设置，不代表收敛或实物标定']
 ].map(([id,label,value,unit,status,basis,method])=>({id,label,value,unit,status,basis,method}));
 const after=protectedState(access(),full);if(before!==after)throw Error('READ_PRESERVATION_FAILED');
 return freeze({schema:'kaopu/reality-workbench-export@1',exporterVersion:'0.3.1-c',objectId:'fabric-leather-r17-'+n.product,domain:'fabric',family:'leather',productId:n.product,materialId:n.material,source:copy(pin),capture:{capturedAt:new Date().toISOString(),sequence:++sequence,nativeRevision:n.revision,nativeFrame:n.draws,rootInstance:n.hero.uuid,poseVersion:r.texture.version,cachePoseVersion:r.poseCache.version,solverAppliedPoses:s.appliedPoses,solverStep:s._report.steps||0,integrityMode:full?'full_cpu_arrays':'metadata_and_samples',elapsedMs:performance.now()-start},requested:copy(n.config),measurements:values,parts,seams,solver:{version:n.version,configuration:copy(s.cfg),lastReport:copy(s._report),reportScope:'last main-thread worker report associated with settled rendered data, not new physical validation',active:s._active,receivedPoses:s.receivedPoses,appliedPoses:s.appliedPoses,physicalCalibration:false},materialSpace:{nativeWorldUnit:'mm',exportUnit:'m',conversionFactor:.001,garmentBindingVerified:false},preservation:{passed:true,before:hashText(before),after:hashText(after),comparedTextLength:before.length,method:'exact synchronous serialized read-set equality before compact FNV diagnostic serialization; not a digital signature',scope:full?'complete available CPU geometry/pose arrays, settings, cached matrices and material sources':'metadata and selected CPU samples, cached matrices, settings and material sources',notChecked:['GPU cache buffer contents readback','every shell surface point','worker internal memory','physical specimen properties']},authorities:{sourceWriteAPI:false,repairAuthorized:false,physicalCertification:false,manufacturingCertification:false,productionReady:false}});
}
return Object.freeze({version:'0.3.1-c',source:pin,read,exportJSON:()=>JSON.stringify(read(),null,2)});
})
