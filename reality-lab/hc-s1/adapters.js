/* Reads existing public native APIs. No setters, render calls, normalization, or writes. */
(function(root){
'use strict';
const I=[1,0,0,0,1,0,0,0,1];
const finite=x=>typeof x==='number'&&Number.isFinite(x);
function meshes(group){const out=[];function visit(o,visible){if(!o)return;visible=visible&&o.visible!==false;if(visible&&o.geometry?.attributes?.position)out.push(o);if(visible)for(const c of o.children||[])visit(c,visible);}visit(group,true);return out;}
function cameraRecord(c,renderer){const canvas=renderer.domElement;return {projection:c.isPerspectiveCamera?'perspective':c.isOrthographicCamera?'orthographic':'unknown',fovYDeg:c.fov??null,aspect:c.aspect??null,zoom:c.zoom??1,near:c.near,far:c.far,position:[c.position.x,c.position.y,c.position.z],worldMatrix:Array.from(c.matrixWorld.elements),projectionMatrix:Array.from(c.projectionMatrix.elements),bufferPx:[canvas.width,canvas.height],cssPx:[canvas.clientWidth,canvas.clientHeight],filmGaugeMetadata:c.filmGauge??null,calibrated:false,method:'read current native camera; filmGauge alone is not lens calibration'};}
function guard(nodes,camera,settings){
 let bytes=0;const arrays=[];
 for(const n of nodes){
  const g=n.geometry;
  for(const [key,a]of [['position',g.attributes.position],['normal',g.attributes.normal],['csRest',g.attributes.csRest],['index',g.index]])if(a?.array){
   const v=new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength);bytes+=v.byteLength;if(bytes>96*1024*1024)throw Error('只读保护快照超过 96 MiB 上限；未读取或修改对象');arrays.push({key,live:v,copy:v.slice()});
  }
 }
 return {arrays,bytes,transforms:JSON.stringify(nodes.map(n=>Array.from(n.matrixWorld.elements))),camera:JSON.stringify(cameraRecord(camera.camera,camera.renderer)),settings:JSON.stringify(settings())};
}
function unchanged(g,nodes,camera,settings){let same=true;for(const r of g.arrays){if(r.live.byteLength!==r.copy.byteLength){same=false;break;}for(let i=0;i<r.copy.length;i++)if(r.live[i]!==r.copy[i]){same=false;break;}if(!same)break;}
 return {geometry:same&&g.transforms===JSON.stringify(nodes.map(n=>Array.from(n.matrixWorld.elements))),camera:g.camera===JSON.stringify(cameraRecord(camera.camera,camera.renderer)),settings:g.settings===JSON.stringify(settings())};}
function rawWorldBounds(nodes){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];let vertices=0,triangles=0;
 for(const node of nodes){const g=node.geometry,p=g.attributes.position,m=node.matrixWorld?.elements;if(!m||m.length!==16)throw Error('缺少原生世界矩阵');
  if(node.matrixWorldNeedsUpdate)throw Error('原生矩阵尚未更新；本观察器不擅自执行更新，请待原台出画后重读');
  if(p.count>3000000)throw Error('单网格超出同步检查预算');
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);const v=[m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]];for(let j=0;j<3;j++){if(!finite(v[j]))throw Error('检测到无效顶点或变换');min[j]=Math.min(min[j],v[j]);max[j]=Math.max(max[j],v[j]);}}
  vertices+=p.count;triangles+=(g.index?.count??p.count)/3;
 }
 if(!vertices)throw Error('当前对象没有可观察的可见几何');
 return {min,max,xyz:max.map((v,i)=>v-min[i]),vertices,triangles,method:'CPU position attributes transformed by existing matrixWorld; not a readback of final vertex-shader deformation'};
}
function isReady(w,id){try{return id==='human-r07'?!!w.__HEAD_PROC__?.ready:id==='shoe-r12'?!!w.SHOE_R12?.ready:false;}catch{return false;}}
function capture(w,entry){
 let camera,renderer,group,settings,native,units,frame;
 if(entry.id==='shoe-r12'){
  native=w.SHOE_R12;if(!native?.ready)throw Error('原生 R12 尚未就绪');
  camera=native.camera;renderer=native.renderer;group=native.group();settings=()=>native.state();
  units={geometry:'mm',scene:'m',geometryToScene:.001,basis:'source_declared'};
  frame={handedness:'right',up:'+Y',forward:'+Z',toCanonicalBasis:I.slice(),lateralMeaning:null,basis:'source_declared'};
 }else if(entry.id==='human-r07'){
  if(!w.__HEAD_PROC__?.ready||!w.__IDENTITY_QA__?.viewer)throw Error('原生 R07 尚未就绪');
  native=w.__IDENTITY_QA__.viewer();camera=native.camera;renderer=native.renderer;group=native.mesh;
  settings=()=>({head:w.headProceduralSkin?.settings?.()??null,body:w.bodyProceduralSkin?.settings?.()??null});
  units={geometry:'m',scene:'m',geometryToScene:1,basis:'source_declared'};
  frame={handedness:'right',up:'+Y',forward:'+Z',toCanonicalBasis:I.slice(),lateralMeaning:null,basis:'project_contract_declared_not_anatomical_verification'};
 }else throw Error('此板块尚未接入只读运行时；不能伪造读数');
 const nodes=meshes(group),ctx={camera,renderer},before=guard(nodes,ctx,settings),t=performance.now();
 const box=rawWorldBounds(nodes),preservation=unchanged(before,nodes,ctx,settings);
 const record={schema:'kaopu/reality-observation@1',assetId:entry.id,domain:entry.domain,source:{repository:entry.repository,commit:entry.commit,path:entry.path,sha256:entry.sha256},units,frame,dimensions:{xyz:box.xyz,unit:'m',basis:'runtime_computed',method:box.method},camera:cameraRecord(camera,renderer),color:{working:'srgb-linear',output:renderer.outputColorSpace??null,toneMappingCode:renderer.toneMapping??null,exposure:renderer.toneMappingExposure??null,basis:'read native renderer; no color transform applied'},evidence:{confidence:null,confidenceMethod:null,uncertaintyM:null,method:'synchronous read-only native API and visible CPU geometry observation'},preservation,observation:{capturedAt:new Date().toISOString(),nativeMeshCount:nodes.length,vertices:box.vertices,triangles:box.triangles,boundsMin:box.min,boundsMax:box.max,guardBytes:before.bytes,readMs:performance.now()-t,checkedChannels:['position','normal where present','csRest where present','index','visible mesh world matrices','camera','head/body skin settings or R12 design state'],notChecked:['all application state','final shader displaced bounds','swept collision volume','anatomical dimensions','physical sample','manufacturing fit','display calibration'],authoritativeHostModified:false}};
 if(entry.id==='shoe-r12'){
  const s=native.state();record.assetId='shoe-r12:'+s.style;record.nativeMeasurements=native.report().current.map(r=>({id:r.id,xyz:r.measuredBoundsMm,unit:'mm',basis:'native_geometry_report',notPhysicalMeasurement:true}));
  record.observation.presentation={pair:s.pair,compare:s.compare,explode:s.explode,part:s.part};
  record.observation.note='场景包围范围可含成双、拆件或多款排布；不等于单鞋鞋长、脚长、鞋码或制鞋楦尺寸。length/width 参数是倍率，不是毫米。';
 }else record.observation.note='人物范围仅为当前可见 CPU 网格及已有世界矩阵，不自动当作身高。轮廓可能受原生顶点着色器继续影响。';
 return record;
}
function importShoeRecipe(doc,entry){
 if(doc.schema!=='kaopu/shoe-style@1'||!Array.isArray(doc.measurements)||doc.measurements.length<1||doc.measurements.length>8)throw Error('不是已支持的 R12 鞋款设计配方');
 if(doc.sourceCommit!==entry.sourceImplementation)throw Error('鞋款源实现不是本次固定 R12；需要重新登记适配，不自动猜测');
 const m=doc.measurements[0];if(!Array.isArray(m.boundsMm)||m.boundsMm.length!==3||!m.boundsMm.every(finite))throw Error('鞋款尺寸数据无效');
 return {schema:'kaopu/reality-observation@1',assetId:'shoe-r12:import',domain:'footwear',source:{repository:entry.repository,commit:entry.commit,path:entry.path,sha256:entry.sha256},units:{geometry:'mm',scene:'m',geometryToScene:.001},frame:{handedness:'right',up:'+Y',forward:'+Z',toCanonicalBasis:I.slice(),lateralMeaning:null},dimensions:{xyz:m.boundsMm.slice(),unit:'mm',basis:'source_declared',method:'imported R12 design export; untrusted local file, not a live observation'},camera:null,color:null,evidence:{confidence:null},observation:{sourceType:'user_import',nativeRuntimeVerified:false,notManufacturing:true}};
}
root.RealityAdapters=Object.freeze({capture,isReady,importShoeRecipe,rawWorldBounds});
if(typeof module!=='undefined'&&module.exports)module.exports=root.RealityAdapters;
})(globalThis);
