/* Common read-only adapters for immutable S1 and S2. No source-workbench setters are exposed. */
(function(root){
'use strict';
const P=RealityProtocol;
const clone=P.clone;
function lowerStatus(value){const key=String(value||'unknown').toLowerCase();return ({pass:'PASS',fail:'FAIL',warning:'WARNING',unknown:'UNKNOWN',not_applicable:'NOT_APPLICABLE'})[key]||P.normalizeStatus(value);}
function toMeters(value,unit){const scale={m:1,mm:.001,cm:.01,in:.0254,ft:.3048};if(!(unit in scale)||typeof value!=='number'||!Number.isFinite(value))throw Error('无法换算长度：'+value+' '+unit);return value*scale[unit];}
function checksToDefects(objectId,checks,sourceCommit){return checks.filter(c=>['FAIL','WARNING','UNKNOWN'].includes(c.status)).map(c=>P.makeDefect(objectId,c,{sourceCommit,owner:c.owner||undefined}));}
function baseFromS1(report,objectId,dictionary){
 if(!report?.nativeReady||report.loadedId!==objectId||!report.document)throw Error('S1 原生对象尚未形成实时观察');
 const d=report.document,domain=objectId==='human-r07'?'human':'footwear',sourceMode='live_read_only';
 const source=P.source(d.source),units=[
  {quantity:'source_geometry_length',unit:d.units.geometry,basis:d.units.basis||'source_declared'},
  {quantity:'scene_length',unit:d.units.scene,basis:d.units.basis||'source_declared'},
  {quantity:'source_to_scene_scale',unit:'1',basis:d.units.basis||'source_declared',value:d.units.geometryToScene}
 ];
 const frames=d.frame?[{id:'asset_local',handedness:d.frame.handedness,up:d.frame.up,forward:d.frame.forward,toCanonicalBasis:clone(d.frame.toCanonicalBasis),lateralMeaning:d.frame.lateralMeaning??null,basis:d.frame.basis||'source_declared'}]:[];
 const ids=domain==='human'?['human.visible_bounds_x','human.visible_bounds_y','human.visible_bounds_z']:['footwear.visible_bounds_x','footwear.visible_bounds_y','footwear.visible_bounds_z'];
 const measurements=ids.map((id,i)=>P.makeMeasurement(dictionary,id,toMeters(d.dimensions.xyz[i],d.dimensions.unit),{basis:d.dimensions.basis,method:d.dimensions.method,sourceRef:'S1:'+d.assetId}));
 const semanticId=domain==='human'?'human.body_height':'footwear.last_length';
 measurements.push(P.makeMeasurement(dictionary,semanticId,null,{basis:'unknown',method:domain==='human'?'当前 S1 只有可见几何包围范围，缺少头顶/足底语义标记与比例版本。':'当前 S1 只有可见几何包围范围，缺少鞋楦身份、版本和制造测量方法。',sourceRef:'S1:'+d.assetId}));
 const checks=(report.validation?.rows||[]).map(row=>P.makeCheck('s1.'+row.id,lowerStatus(row.status),row.message,{category:'s1-declaration',owner:domain==='human'?'human-workbench':'shoe-workbench',detail:row.detail??null}));
 checks.push(P.makeCheck(domain==='human'?'semantic.body_height':'semantic.last_length','UNKNOWN',domain==='human'?'可见 Y 包围范围不能自动当成人体身高；需要语义地标、支撑平面和 proportion_revision。':'可见 Z 包围范围不能自动当作脚长、鞋内长或鞋楦长度；需要鞋楦语义与测量协议。',{category:'semantic-measurement',owner:domain==='human'?'human-workbench':'shoe-workbench',measurementId:semanticId}));
 if(d.preservation)for(const channel of ['geometry','camera','settings'])checks.push(P.makeCheck('preservation.'+channel,d.preservation[channel]?'PASS':'FAIL','读取前后受检 '+channel+' '+(d.preservation[channel]?'保持不变':'发生变化'),{category:'preservation',owner:domain==='human'?'human-workbench':'shoe-workbench'}));
 const object={schema:P.OBJECT_SCHEMA,objectId,domain,sourceMode,source,units,frames,measurements,checks,defects:[],preservation:clone(d.preservation||{}),camera:clone(d.camera||null),color:clone(d.color||null),evidence:clone(d.evidence||null),metadata:{sourceSystem:'REALITY-HC-S1',sourceVersion:report.version,nativeAssetId:d.assetId,observation:clone(d.observation||{}),nativeMeasurements:clone(d.nativeMeasurements||[]),freshObservation:true}};
 object.defects=checksToDefects(objectId,checks,source.commit);return P.finalizeObject(object,dictionary);
}
function baseFromS2(report,dictionary){
 if(!report?.loaded||!report.document||!report.validation)throw Error('S2 裁片观察尚未解锁');
 const d=report.document,r=report.validation,source=P.source(d.source),objectId='pattern-shorts-s2';
 const measurements=[
  P.makeMeasurement(dictionary,'pattern.panel_count',r.summary.panels,{basis:'runtime_computed',method:'S2 对固定观察数据重新检查',sourceRef:'S2:'+d.patternId}),
  P.makeMeasurement(dictionary,'pattern.seam_count',r.summary.seams,{basis:'runtime_computed',method:'按原有向 pairs 路径计数',sourceRef:'S2:'+d.patternId}),
  P.makeMeasurement(dictionary,'pattern.net_vertices',r.summary.netVertices,{basis:'runtime_computed',method:'S2 原始净样拓扑总计'}),
  P.makeMeasurement(dictionary,'pattern.material_vertices',r.summary.materialVertices,{basis:'runtime_computed',method:'S2 原始材料拓扑总计'}),
  P.makeMeasurement(dictionary,'pattern.net_triangles',r.summary.netTriangles,{basis:'runtime_computed',method:'S2 原始净样拓扑总计'}),
  P.makeMeasurement(dictionary,'pattern.material_triangles',r.summary.materialTriangles,{basis:'runtime_computed',method:'S2 原始材料拓扑总计'}),
  P.makeMeasurement(dictionary,'pattern.reduced_vertices',r.summary.reducedVertices,{basis:'runtime_computed',method:'实际偏移小于标称留量的记录化顶点'}),
  P.makeMeasurement(dictionary,'pattern.zero_offset_panel_count',(r.summary.zeroOffsetPanels||[]).length,{basis:'runtime_computed',method:'至少一个局部端点偏移为零的裁片数'}),
  P.makeMeasurement(dictionary,'pattern.max_seam_declaration_error',toMeters(r.summary.maxSeamDeclarationErrorMm,'mm'),{basis:'runtime_computed',method:'有向配缝路径复算与声明长度最大绝对残差'}),
  P.makeMeasurement(dictionary,'pattern.max_paired_edge_mismatch',toMeters(r.summary.maxPairedEdgeMismatchMm??0,'mm'),{basis:'runtime_computed',method:'接缝两侧有向路径最大绝对差'})
 ];
 for(const panel of r.panels||[]){
  const width=panel.cutBoxMm.max[0]-panel.cutBoxMm.min[0],height=panel.cutBoxMm.max[1]-panel.cutBoxMm.min[1];
  measurements.push(P.makeMeasurement(dictionary,'pattern.panel.cut_width',toMeters(width,'mm'),{id:'pattern.panel.'+panel.id+'.cut_width',basis:'runtime_computed',method:'实际裁切线局部 U 包围范围',context:{panelId:panel.id}}));
  measurements.push(P.makeMeasurement(dictionary,'pattern.panel.cut_height',toMeters(height,'mm'),{id:'pattern.panel.'+panel.id+'.cut_height',basis:'runtime_computed',method:'实际裁切线局部 V 包围范围',context:{panelId:panel.id}}));
 }
 for(const id of ['pattern.waist_seam_length','pattern.outseam_length','pattern.inseam_length'])measurements.push(P.makeMeasurement(dictionary,id,null,{basis:'unknown',method:'S2.1 尚未将多裁片语义路径聚合成此成衣级测量；保留未知，不能从包围框推测。'}));
 const checks=(r.rows||[]).map(row=>P.makeCheck('s2.'+row.id,lowerStatus(row.state),row.message,{category:'pattern-source',owner:'tailor-workbench',detail:row.detail??null}));
 checks.push(P.makeCheck('pattern.target.proportion_revision',d.target?.proportionRevision==null?'UNKNOWN':'PASS',d.target?.proportionRevision==null?'纸样目标未提供 proportion_revision，不能冒认已适配当前 R07。':'纸样目标绑定版本已声明。',{category:'binding',owner:'tailor-workbench',observed:d.target?.proportionRevision??null,expected:'explicit proportion_revision'}));
 checks.push(P.makeCheck('pattern.source.live_connection','WARNING','S2 当前是固定源快照，不是正在运行的裁缝铺实时连接；源变化后必须产生新观察版本。',{category:'integration',owner:'reality-coordinator',observed:'fixed_snapshot',expected:'future read-only live export'}));
 checks.push(P.makeCheck('pattern.manufacturing','UNKNOWN','当前端点偏移、零严格交叉和接缝残差没有构成制造、试穿或工艺认证。',{category:'certification',owner:'tailor-workbench'}));
 const units=[{quantity:'pattern_length',unit:d.units.pattern,basis:'source_declared'},{quantity:'scene_length',unit:d.units.scene,basis:'source_declared'},{quantity:'pattern_to_scene_scale',unit:'1',basis:'source_declared',value:d.units.patternToScene}];
 const frames=[{id:'pattern_local',handedness:'right',up:'+V',forward:'planar',basis:'source_declared',note:'二维裁片 U/V 平面；显示时统一 mm→m 与仅用于排布的平移，不单片缩放。'}];
 const object={schema:P.OBJECT_SCHEMA,objectId,domain:'pattern',sourceMode:'fixed_snapshot',source,units,frames,measurements,checks,defects:[],preservation:{sourceCoordinates:true,topology:true,seams:true,allowances:true},camera:null,color:null,evidence:{origin:report.origin,sourceSystem:'REALITY-HC-S2'},metadata:{sourceSystem:'REALITY-HC-S2',sourceVersion:report.version,patternId:d.patternId,patternVersion:d.patternVersion,target:clone(d.target),render:clone(report.render),liveConnection:false,freshObservation:report.origin==='verified-build'}};
 object.defects=checksToDefects(objectId,checks,source.commit);return P.finalizeObject(object,dictionary);
}
function waitFor(test,timeout=240000){return new Promise((resolve,reject)=>{const start=performance.now();(function poll(){try{const value=test();if(value)return resolve(value);}catch(error){return reject(error);}if(performance.now()-start>timeout)return reject(Error('等待固定工作台就绪超时'));setTimeout(poll,120);})();});}
function adapterShell(identity,reader){let last=null;return Object.freeze({
 identity:()=>clone(identity),
 source:()=>clone(last?.source||identity.source),
 units:()=>clone(last?.units||[]),
 frames:()=>clone(last?.frames||[]),
 measurements:()=>clone(last?.measurements||[]),
 checks:()=>clone(last?.checks||[]),
 defects:()=>clone(last?.defects||[]),
 preservation:()=>clone(last?.preservation||{}),
 read:async(runtime,options={})=>{last=await reader(runtime,options);return clone(last);},
 report:()=>clone(last)
 });}
function createS1Adapter(objectId,dictionary){
 const domain=objectId==='human-r07'?'human':objectId==='shoe-r12'?'footwear':null;if(!domain)throw Error('未知S1对象：'+objectId);
 return adapterShell({objectId,domain,source:{repository:'haihao0307/Humanoid-Rig-Lab-Next',commit:'4b9d26b4edc6f197823d8bcebd9fd242ce99d1ff',path:'reality-lab/hc-s1/preview.html',sha256:'94939009131344eb539a6e60414d001b1619e0d33944aef84517a81354f5f836'}},async runtime=>{
  const api=await waitFor(()=>runtime.__REALITY_LAB__);api.select(objectId);await api.loadNative();api.observe();const report=api.report();return baseFromS1(report,objectId,dictionary);
 });
}
function createS2Adapter(dictionary){
 return adapterShell({objectId:'pattern-shorts-s2',domain:'pattern',source:{repository:'haihao0307/Humanoid-Rig-Lab-Next',commit:'8890bda261784ba14a79ea277bbb14bd547376ad',path:'reality-lab/hc-s2/releases/s2-893fe414335d/preview.html',sha256:'888479a0fc1070a00e161c9af937fc43bc1db871a88e8c37d87d0326e0b3fcce'}},async(runtime,options)=>{
  const api=await waitFor(()=>runtime.__REALITY_S2__);if(!api.report().loaded){const input=runtime.document.getElementById('key-input');if(!input)throw Error('S2固定页面缺少访问入口');input.value=options.key||'';await api.unlock();await waitFor(()=>api.report().loaded,30000);}return baseFromS2(api.report(),dictionary);
 });
}
const api=Object.freeze({toMeters,baseFromS1,baseFromS2,createS1Adapter,createS2Adapter,waitFor});
root.RealityCommonAdapters=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
