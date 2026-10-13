import {compute,workerStats,guard,aborted,waitWithSignal} from './worker-client.mjs';
import {fetchDetail,detailStats,clearDetailMemory} from './detail-loader.mjs';
import {RuntimeGeometryCache} from './runtime-cache.mjs';
import {hairContactPlan} from './hair-contract.mjs';
import {sha256Bytes} from './hash.mjs';
import {HEAD_SCHEMA,decodeHeadInput,exportHeadInput} from './head-contract.mjs';
import {FIT_CONTRACT,REVIEWED_HATS,FIXED_FIELDS,assertLockedSettings,checkHeadRange,checkGeometry,lockedRecord} from './fit-contract.mjs';
import {materialSection} from './section.mjs';

import {buildInnerShell} from './shell.mjs';
import {CONSTRUCTION,MOTHER_VERSION,FIT_SPECS,PARAM_DEFAULTS,subtypeDefaults,validateMother,regenerate,sectionProfile,sample,measurements,categoryPresets} from './core.mjs';
import {installSurface,updateSurface} from './surface.mjs';
import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
const $=id=>document.getElementById(id),next=()=>new Promise(r=>requestAnimationFrame(r));
const DEFAULT={...PARAM_DEFAULTS,id:'cable',dye:'original',width:1,depth:1,height:1,lift:0,tilt:0,roughness:.86,detail:1,sheen:.65,view:'wear',head:0,light:'studio',layer:'material',repair:true};
const COLORS={original:null,sand:'#d6b894',navy:'#293e55',moss:'#61705c',wine:'#794149',pearl:'#b9b7ab'};
const SCHEMA='kaopu.hat.recipe/1';let cameraMode='three';let D,state={...DEFAULT},token=0,asset=null,hat=null,person=null,rotating=false,framePending=false,busy=false,ready=false,compare=false,thumbsReady=0;
const storage='kaopu.hat-r09.recipe';let renderSerial=0;let saveWarning='';let headToken=0,firstFrameMS=null;const catalogueFailures=[],recipesByHat=new Map();let activeSelection=null,detailJob=null,lastRequested=null;const selectionEvents=[];
function message(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}
const derivedCache=new RuntimeGeometryCache();const profileIds=new WeakMap();let profileSerial=0;
function profileIdentity(hp){if(!hp)return 0;if(!profileIds.has(hp))profileIds.set(hp,++profileSerial);return profileIds.get(hp);}
const assetCache=new Map();const CACHE_LIMIT=6,CACHE_BYTES=112*1024*1024;let lastSwitch=null;const switchHistory=[];
function estimateAsset(a){
 const buffers=new Set();const add=v=>{if(ArrayBuffer.isView(v)){buffers.add(v.buffer);return;}if(v&&typeof v==='object'&&!Array.isArray(v))for(const x of Object.values(v))add(x);};
 add(a.mesh);for(const fit of a.fitResults?.values()||[])add(fit);
 for(const object of [a.object,a.sweatMesh,a.innerMesh,a.sectionMesh]){for(const attr of Object.values(object?.geometry?.attributes||{}))add(attr.array);add(object?.geometry?.index?.array);}
 let bytes=[...buffers].reduce((sum,b)=>sum+b.byteLength,0)*2;
 for(const t of Object.values(a.maps)){const im=t.image;bytes+=(im?.width||0)*(im?.height||0)*4*(1+4/3);}
 return bytes;
}
function retainAsset(a){if(!a||a.disposed)return;const id=a.meta.id,old=assetCache.get(id);if(old&&old!==a)disposeAsset(old);assetCache.delete(id);assetCache.set(id,a);let bytes=()=>[...assetCache.values()].reduce((n,a)=>n+estimateAsset(a),0);while(assetCache.size>CACHE_LIMIT||bytes()>CACHE_BYTES){const id=assetCache.keys().next().value,evicted=assetCache.get(id);assetCache.delete(id);disposeAsset(evicted);}}
function acquireCached(id){if(asset?.meta.id===id&&!asset.disposed)return asset;const a=assetCache.get(id);if(a){assetCache.delete(id);return a;}return null;}
function fitSignature(s,hp){return JSON.stringify([D?.sourceHash,s.id,s.head,profileIdentity(hp),hp?.ymax,...Object.keys(PARAM_DEFAULTS).filter(k=>!['cutaway','showMeasurements','showClearance','textureMode','grainStrength','weaveMM','customColor','useCustomColor'].includes(k)).map(k=>s[k])]);}
function solveAsset(a,s,hp){const key=fitSignature(s,hp),result=a.fitResults?.get(key);if(!result)throw Error('当前头形尚未在线程中完成适配，请重新选择本款');return result;}
function cacheReport(){return {geometryCache:derivedCache.report(),detailCache:detailStats(),startup:globalThis.__hatStartupStats||{},idleAssets:assetCache.size,maxIdleAssets:CACHE_LIMIT,estimatedIdleBytes:[...assetCache.values()].reduce((n,a)=>n+estimateAsset(a),0),byteLimit:CACHE_BYTES,packageEntries:dataCache.size,lastSwitch,history:[...switchHistory],worker:workerStats(),activeSelection:activeSelection?{id:activeSelection.id,stage:activeSelection.stage,elapsedMS:performance.now()-activeSelection.started}:null,selectionEvents:[...selectionEvents],networkRequiredForSwitch:false,detailState:asset?.detailState||'none'};}
function lightMeta(meta){const {textures,renderedThumbnail,teacherThumbnail,...rest}=meta;return rest;}
function event(kind,id,extra={}){selectionEvents.push({kind,id,at:performance.now(),...extra});if(selectionEvents.length>64)selectionEvents.shift();}
function phase(ctx,text){guard(ctx.signal);ctx.stage=text;if(activeSelection===ctx){message(text+' · '+ctx.title);const el=$('load-stage');if(el)el.textContent=text;}}
function detailMessage(text){if($('detail-status'))$('detail-status').textContent=text;}
function stopDetail(){if(detailJob){detailJob.abort();detailJob=null;}}
function queueDetail(a){
 stopDetail();
 if(a.maps.normal){a.detailState='ready';detailMessage('原始高清表面已就绪');return;}
 if(!a.meta.normalSource){a.detailState='not-required';detailMessage('本款原色与材质已完整显示');return;}
 const controller=new AbortController();detailJob=controller;a.detailState='waiting';
 detailMessage('帽形与原色已显示；高清表面独立准备，不影响换帽');
 setTimeout(async()=>{
  let url=null,t=null;
  try{
   guard(controller.signal);a.detailState='loading';
   const bytes=await fetchDetail(a.meta.normalSource,{signal:controller.signal,onProgress:(done,total,stage)=>{if(asset===a&&!controller.signal.aborted)detailMessage(`${stage} ${Math.round(done/1024)} / ${Math.round(total/1024)} KB · 可随时换帽`);}});
   guard(controller.signal);url=URL.createObjectURL(new Blob([bytes],{type:'image/webp'}));
   t=await localTexture(url,'normal',controller.signal);guard(controller.signal);
   if(a.disposed||asset!==a){t.dispose();return;}
   a.maps.normal=t;a.material.normalMap=t;a.material.needsUpdate=true;a.detailState='ready';syncUI();requestRender();detailMessage('原始高清表面已就绪');
  }catch(e){if(t&&a.maps.normal!==t)t.dispose();if(!controller.signal.aborted&&asset===a){a.detailState='retry';detailMessage('高清表面暂未载入；帽形与原色可用，可点击“重试高清表面”');event('detail-failed',a.meta.id,{message:e.message});}}
  finally{if(url)URL.revokeObjectURL(url);if(detailJob===controller)detailJob=null;}
 },80);
}
async function localTexture(url,key,signal){
 guard(signal);let timer,abandoned=false;const p=new T.TextureLoader().loadAsync(url).then(t=>{
  if(abandoned||signal?.aborted){t.dispose();throw signal?.reason||aborted();}
  t.colorSpace=key==='color'?T.SRGBColorSpace:T.NoColorSpace;t.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);return t;
 });
 try{return await waitWithSignal(Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('本地材质解码超时')),12000);})]),signal);}catch(e){abandoned=true;throw e;}finally{clearTimeout(timer);}
}
async function prepareAssetFit(a,s,hp,ctx){
 const key=fitSignature(s,hp);a.fitResults??=new Map();if(a.fitResults.has(key))return;
 phase(ctx,'按当前头形量配');const {fit}=await compute('fit',{mesh:a.mesh,meta:lightMeta(a.meta),settings:s,profile:hp},{signal:ctx.signal,onStage:t=>phase(ctx,t)});guard(ctx.signal);
 a.fitResults.set(key,fit);while(a.fitResults.size>4)a.fitResults.delete(a.fitResults.keys().next().value);derivedCache.set(a.meta.id,{mesh:a.mesh,fitResults:a.fitResults});
}
const dataCache=new Map();
async function readPackage(meta){
 if(meta.mother||meta.p||meta.rawPositions)return meta;
 throw Error('页面缺少内置配方；请重新打开固定版本，不会无限等待外部资源');
}
async function readHead(index){const h=D.native.heads[index];if(!h)throw Error('未知头形');return readPackage(h);}
function selectionError(e){if(e?.name==='AbortError')return;if(activeSelection)return;message(e.message+'；旧对象仍保留，可重试或直接换帽。',true);$('loading').hidden=Boolean(asset);}
function currentFeedback(){return{schema:'kaopu.workbench.feedback/1',version:D.version,sourceCommit:D.sourceCommit,baseline:D.baseline,recipe:recipe(),camera:{position:camera.position.toArray(),target:controls.target.toArray()},observation:$('feedback-text')?.value||'',scope:$('feedback-scope')?.value||'visual',userAccepted:false,recordedAt:new Date().toISOString()};}
function updateQualityBase(){if(!asset)return;const m=asset.mesh;$('quality-note').textContent=`${CONSTRUCTION[state.id].label}。${m.controlCount}个来源控制点 → 程序细分生成${m.position.length/3}个显示顶点。保留署名与原贴图；不是从零纯解析模型，也不是纱线级物理。`;}
async function unpack64(s,type){const bytes=Uint8Array.from(atob(s),c=>c.charCodeAt(0));const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));return new type(await new Response(stream).arrayBuffer());}
async function decodeGeometry(data){if(data.rawPositions){const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(data.rawPositions),3));g.setIndex(new T.BufferAttribute(new Uint32Array(data.rawIndex),1));g.computeVertexNormals();g.computeBoundingBox();return g;}const [p,n,u,i]=await Promise.all([unpack64(data.p,Float32Array),data.n?unpack64(data.n,Float32Array):null,data.u?unpack64(data.u,Float32Array):null,unpack64(data.i,Uint32Array)]);const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(p,3));if(n)g.setAttribute('normal',new T.BufferAttribute(n,3));if(u)g.setAttribute('uv',new T.BufferAttribute(u,2));g.setIndex(new T.BufferAttribute(i,1));if(!n)g.computeVertexNormals();g.computeBoundingBox();return g;}
const canvas=$('canvas'),renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.75));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.85;renderer.shadowMap.enabled=true;renderer.localClippingEnabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
const scene=new T.Scene();scene.background=new T.Color(0xe6e1d7);scene.fog=new T.Fog(0xe6e1d7,1.1,4);const camera=new T.PerspectiveCamera(34,1,.001,20),controls=new OrbitControls(camera,canvas);controls.enableDamping=false;controls.minDistance=.1;controls.maxDistance=2.4;controls.maxPolarAngle=Math.PI*.96;controls.addEventListener('change',requestRender);controls.addEventListener('start',()=>{rotating=false;$('rotate').setAttribute('aria-pressed','false');});
const room=new RoomEnvironment(),pmrem=new T.PMREMGenerator(renderer),env=pmrem.fromScene(room,.04);scene.environment=env.texture;room.dispose();pmrem.dispose();
const hemi=new T.HemisphereLight(0xffffff,0xb8aa94,.7),key=new T.DirectionalLight(0xfff0da,1.7),fill=new T.DirectionalLight(0xdbe8ff,.45),rim=new T.DirectionalLight(0xffffff,.85);key.position.set(-.6,.85,.8);fill.position.set(.6,.28,.4);rim.position.set(.35,.6,-.8);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-.6;key.shadow.camera.right=.6;key.shadow.camera.top=.65;key.shadow.camera.bottom=-.6;key.shadow.camera.near=.05;key.shadow.camera.far=3;key.shadow.bias=-.00012;key.shadow.normalBias=.00055;key.shadow.radius=3;scene.add(hemi,key,fill,rim,key.target);
const stage=new T.Group();scene.add(stage);const floor=new T.Mesh(new T.PlaneGeometry(8,8),new T.MeshStandardMaterial({color:0xe6e1d7,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.049;floor.receiveShadow=true;scene.add(floor);
const plinth=new T.Mesh(new T.CylinderGeometry(.205,.209,.04,128),new T.MeshStandardMaterial({color:0xd2c9ba,roughness:.9}));plinth.position.y=-.025;plinth.receiveShadow=true;plinth.castShadow=true;scene.add(plinth);
function requestRender(){if(framePending)return;framePending=true;requestAnimationFrame(()=>{framePending=false;render();});}
function render(){if(!asset)return;renderer.render(scene,camera);renderSerial++;if(firstFrameMS===null)firstFrameMS=performance.now();if(rotating&&!document.hidden){stage.rotation.y+=.006;requestRender();}}
function resize(){const r=$('viewport').getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();requestRender();}new ResizeObserver(resize).observe($('viewport'));
function disposeAsset(a){if(!a||a.disposed)return;if(a.sweatMesh){a.sweatMesh.geometry.dispose();a.sweatMesh.material.dispose();a.sweatMesh=null;}if(a.sectionMesh){a.sectionMesh.geometry.dispose();a.sectionMesh.material.dispose();a.sectionMesh=null;}if(a.innerMesh){a.innerMesh.geometry.dispose();a.innerMesh.material.dispose();a.innerMesh=null;}a.disposed=true;a.geometry.dispose();a.material.dispose();Object.values(a.maps).forEach(t=>t.dispose());}
async function loadAsset(meta,settings,hp,ctx){
 meta=await readPackage(meta);guard(ctx.signal);if(!meta.mother)throw Error('缺少程序母体配方');
 const start=performance.now(),cached=derivedCache.get(meta.id),signature=fitSignature(settings,hp);
 let mesh=cached?.mesh,fitResults=cached?.fitResults||new Map(),fit=fitResults.get(signature),workerMS=0;
 const generationReused=!!mesh,fitReused=!!fit;
 if(!mesh){phase(ctx,'在线程中生成帽型');({mesh,fit,workerMS}=await compute('build',{meta:lightMeta(meta),settings,profile:hp},{signal:ctx.signal,onStage:t=>phase(ctx,t)}));}
 else if(!fit){phase(ctx,'复用原帽型并量配');({fit,workerMS}=await compute('fit',{mesh,meta:lightMeta(meta),settings,profile:hp},{signal:ctx.signal,onStage:t=>phase(ctx,t)}));}
 else phase(ctx,'复用本页已生成帽型与量配结果');
 guard(ctx.signal);fitResults.set(signature,fit);while(fitResults.size>4)fitResults.delete(fitResults.keys().next().value);
 derivedCache.set(meta.id,{mesh,fitResults});
 phase(ctx,'解码内置原色');const maps={};let geometry=null;
 try{
  maps.color=await localTexture(meta.textures.color,'color',ctx.signal);guard(ctx.signal);
  geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(mesh.position,3));geometry.setAttribute('normal',new T.BufferAttribute(mesh.normal,3));geometry.setAttribute('uv',new T.BufferAttribute(mesh.uv,2));geometry.setIndex(new T.BufferAttribute(mesh.index,1));geometry.computeBoundingBox();
  const material=new T.MeshPhysicalMaterial({map:maps.color,normalMap:null,normalScale:new T.Vector2(.8,.8),color:new T.Color().setRGB(...(meta.diffuseColor||[1,1,1])),roughness:.86,metalness:0,sheen:.65,sheenColor:new T.Color(.45,.42,.38),sheenRoughness:.85,specularIntensity:.18,side:T.DoubleSide,alphaTest:.25,envMapIntensity:.45});
  const uniforms=installSurface(T,material);
  return {geometry,material,maps,uniforms,meta,mesh,generationMS:performance.now()-start,workerMS,generationReused,fitReused,fitSource:null,fitKey:null,fitResult:null,fitResults};
 }catch(e){geometry?.dispose();Object.values(maps).forEach(t=>t.dispose());throw e;}
}
function changed(){state.layer='material';apply();persist();}
function persist(){try{localStorage.setItem(storage,JSON.stringify(recipe()));}catch(e){saveWarning='此浏览器未允许本地保存；可导出配方。';}}
function recipe(){return{schema:SCHEMA,version:D.version,sourceCommit:D.sourceCommit,sourceId:state.id,settings:{...state},nativeHeadId:D.native.heads[state.head].id,headMeshSHA256:person?sha256Bytes(new Uint8Array(person.geometry.attributes.position.array.buffer)):null,baseline:D.baseline,fitModel:'measured-bearing-interface/r07',motherId:state.id,motherVersion:MOTHER_VERSION,proceduralRepresentation:'attributed control net + regenerated subdivision + semantic fields',measurements:asset?.fitResult?.measurement||null,fitDiagnostics:asset?.fitResult?.diagnostics||null,sizingContract:lockedRecord(state.id,D.native.heads[state.head].id,asset?.fitResult?.measurement),physicalFitValidated:false};}
function validate(input){if(!input||input.schema!==SCHEMA||!((input.version===D.version&&input.sourceCommit===D.sourceCommit)||(input.version==='HAT-R08.0'&&input.sourceCommit==='863236dade1ea5c6bb7d4b65ad759d797034419f')||(input.version==='HAT-R07.1'&&input.sourceCommit==='2b76a1b77a4a11e3f6c936c29ebff9b5cbe99013')||(input.version==='HAT-R01.0'&&input.sourceCommit==='ed35e97be7de8b1842f679980b9bd48da911d2e3')||(input.version==='HAT-R02.0'&&input.sourceCommit==='3997dec0a153840432cb445b57481707f29d73ea')))throw Error('配方版本不匹配；未改变当前帽子');const s=input.settings?{...subtypeDefaults(input.settings.id),...input.settings,repair:input.settings.repair??true}:null;if(!s||!D.hats.some(x=>x.id===s.id)||!Object.hasOwn(COLORS,s.dye))throw Error('未知帽型或配色');for(const [k,lo,hi]of[['width',.9,1.12],['depth',.9,1.12],['height',.85,1.2],['lift',-.035,.045],['tilt',-15,15],['roughness',.45,1],['detail',0,1.7],['sheen',0,1],['head',0,D.native.heads.length-1]])if(!Number.isFinite(s[k])||s[k]<lo||s[k]>hi)throw Error('非法参数：'+k);if(typeof s.repair!=='boolean'||!Number.isInteger(s.head)||!['product','wear'].includes(s.view)||!['studio','neutral','raking'].includes(s.light)||!['material','clay','wire','normal'].includes(s.layer))throw Error('无效显示配置');validateMother(s);assertLockedSettings(s);return Object.fromEntries(Object.keys(DEFAULT).map(k=>[k,s[k]]));}
async function restore(input){const valid=validate(input);if(input.nativeHeadId){const j=D.native.heads.findIndex(h=>h.id===input.nativeHeadId);if(j<0)throw Error('配方引用的头形尚未载入；请先导入对应头形，不以其他人物代替');valid.head=j;}if(input.headMeshSHA256){const h=await readHead(valid.head),p=h.rawPositions||await unpack64(h.p,Float32Array);if(sha256Bytes(new Uint8Array(p.buffer,p.byteOffset,p.byteLength))!==input.headMeshSHA256)throw Error('头形几何哈希不匹配，未恢复配方');}await select(valid.id,valid);persist();return recipe();}
function metrics(){if(!hat)return null;hat.updateMatrixWorld(true);const box=new T.Box3().setFromObject(hat),size=box.getSize(new T.Vector3());return{hat:state.id,triangles:asset.geometry.index.count/3,vertices:asset.geometry.attributes.position.count,widthMM:size.x*1000,heightMM:size.y*1000,depthMM:size.z*1000,view:state.view,headId:D.native.heads[state.head].id,sourceCommit:D.sourceCommit,rendererCalls:renderer.info.render.calls,geometryCount:renderer.info.memory.geometries,textureCount:renderer.info.memory.textures,hatVisible:hat.visible,headVisible:person?.visible||false,shell:asset.fitResult?.diagnostics?.shell||null,motherVersion:MOTHER_VERSION,controlPoints:asset.mesh.controlCount,generatedVertices:asset.mesh.position.length/3,generationMS:asset.generationMS,fit:asset.fitResult?.diagnostics||null,measuredHead:asset.fitResult?.measurement||null};}
const clay=new T.MeshStandardMaterial({color:0xc6c1b8,roughness:.9,side:T.DoubleSide}),normal=new T.MeshNormalMaterial({side:T.DoubleSide});
const cutPlane=new T.Plane(new T.Vector3(-1,0,0),0);
const headProfiles=new Map(),measurementGroup=new T.Group(),clearanceMaterial=new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide});stage.add(measurementGroup);
function clearMeasurement(){for(const child of [...measurementGroup.children]){child.geometry.dispose();child.material.dispose();measurementGroup.remove(child);}}
function measurementOverlay(profile,s){clearMeasurement();if(!profile||s.view!=='wear'||!s.showMeasurements||compare)return;const mm=measurements(profile,s.wearBandMM/1000),line=(pts,loop,color)=>{const g=new T.BufferGeometry().setFromPoints(pts.map(p=>new T.Vector3(...p))),mat=new T.LineBasicMaterial({color,depthTest:false,transparent:true,opacity:.8});const l=loop?new T.LineLoop(g,mat):new T.Line(g,mat);l.renderOrder=20;measurementGroup.add(l);};line(mm.ring.map(p=>[p[0],mm.bandY,p[1]]),true,0x247784);
 for(const angle of [0,Math.PI/2]){const pts=[];for(let side=0;side<2;side++)for(let j=0;j<64;j++){const f=side?1-j/63:j/63,y=mm.bandY+f*(profile.ymax-mm.bandY-.0002),a=angle+side*Math.PI,p=sample(profile,y,a);pts.push([p.center[0]+p.r*Math.cos(a),y,p.center[1]+p.r*Math.sin(a)]);}line(pts,false,angle?0xbb7848:0x668750);}}
function apply(){
 if(!hat)return;const isReference=compare||state.repair===false,s=isReference?{...DEFAULT,...subtypeDefaults(state.id),id:state.id,view:state.view,head:state.head,light:state.light}:state,meta=asset.meta,head=D.native.heads[s.head],profile=headProfiles.get(s.head);stage.rotation.y=0;
 const fitStamp=JSON.stringify([isReference,s.id,s.head,...Object.keys(PARAM_DEFAULTS).filter(k=>!['cutaway','showMeasurements','showClearance','textureMode','grainStrength','weaveMM','customColor','useCustomColor'].includes(k)).map(k=>s[k])]);
 if(asset.fitKey!==fitStamp){
  if(isReference){asset.geometry.setIndex(new T.BufferAttribute(asset.mesh.index,1));asset.fitResult=null;asset.geometry.attributes.position.array=asset.mesh.position;asset.geometry.attributes.normal.array=asset.mesh.normal;}
  else{asset.fitResult=solveAsset(asset,s,profile);asset.geometry.setIndex(new T.BufferAttribute(asset.fitResult.index||asset.mesh.index,1));asset.geometry.attributes.position.array=asset.fitResult.position;asset.geometry.attributes.normal.array=asset.fitResult.normal;asset.geometry.setAttribute('color',new T.BufferAttribute(asset.fitResult.colors,3));}
  asset.geometry.attributes.position.needsUpdate=true;asset.geometry.attributes.normal.needsUpdate=true;asset.geometry.computeBoundingBox();asset.geometry.computeBoundingSphere();asset.fitKey=fitStamp;
  if(asset.sectionMesh){hat.remove(asset.sectionMesh);asset.sectionMesh.geometry.dispose();asset.sectionMesh.material.dispose();asset.sectionMesh=null;}
  if(asset.sweatMesh){hat.remove(asset.sweatMesh);asset.sweatMesh.geometry.dispose();asset.sweatMesh.material.dispose();asset.sweatMesh=null;}
  if(!isReference&&asset.fitResult?.sweatband){const b=asset.fitResult.sweatband,g=new T.BufferGeometry();for(const [key,size] of [['position',3],['normal',3],['uv',2]])g.setAttribute(key,new T.BufferAttribute(b[key],size));g.setIndex(new T.BufferAttribute(b.index,1));const m=new T.MeshStandardMaterial({map:asset.maps.color,color:0x55514b,roughness:.92,side:T.DoubleSide});asset.sweatMesh=new T.Mesh(g,m);asset.sweatMesh.name='R06 real inner sweatband';hat.add(asset.sweatMesh);}
  if(asset.innerMesh){hat.remove(asset.innerMesh);asset.innerMesh.geometry.dispose();asset.innerMesh.material.dispose();asset.innerMesh=null;}
  if(!isReference&&CONSTRUCTION[state.id].mode.startsWith('knit')){const layer=buildInnerShell(T,{...asset.mesh,index:asset.fitResult.index||asset.mesh.index},asset.fitResult.position,asset.fitResult.normal,asset.fitResult.shellThickness||s.materialMM/1000,asset.meta);const imat=new T.MeshStandardMaterial({map:asset.maps.color,color:asset.material.color.clone().multiplyScalar(.82),roughness:.94,side:T.DoubleSide});asset.innerMesh=new T.Mesh(layer.geometry,imat);asset.innerMesh.name='R04 real inner textile and closed material edge';asset.innerMesh.castShadow=true;asset.innerMesh.receiveShadow=true;hat.add(asset.innerMesh);asset.fitResult.diagnostics.shell=layer.report;asset.sectionMesh=materialSection(T,asset.mesh,asset.fitResult.position,layer.geometry.attributes.position.array,asset.meta);hat.add(asset.sectionMesh);}

 }
 for(const mat of [asset.material,clay,normal,clearanceMaterial,asset.innerMesh?.material,asset.sweatMesh?.material].filter(Boolean)){mat.clippingPlanes=s.cutaway&&!isReference?[cutPlane]:[];mat.clipShadows=true;}
 if(asset.sectionMesh)asset.sectionMesh.visible=!!s.cutaway&&!isReference;
 hat.material=s.showClearance&&!isReference?clearanceMaterial:s.layer==='clay'?clay:s.layer==='normal'?normal:asset.material;asset.material.wireframe=s.layer==='wire';asset.material.roughness=s.roughness;asset.material.sheen=s.sheen;asset.material.normalScale.set(s.textureMode==='source'?s.detail*.8:0,s.textureMode==='source'?s.detail*.8:0);updateSurface(asset.uniforms,s,COLORS);
 hat.position.set(0,0,0);hat.rotation.set(0,0,0);hat.scale.set(1,1,1);
 if(isReference&&s.view==='wear'){const sx=head.headWidthM/.148,sz=head.headDepthM/.19221,sy=(sx+sz)/2;hat.scale.set(sx,sy,sz);if(meta.fitCorrection){const f=meta.fitCorrection[s.head];hat.scale.x*=f.scaleX;hat.scale.z*=f.scaleZ;}hat.position.set(...meta.origin).multiply(hat.scale).multiplyScalar(-1);if(meta.fitCorrection)hat.position.z+=meta.fitCorrection[s.head].forward||0;}
 else if(!isReference&&!s.autoFit){hat.scale.set(s.width,s.height,s.depth);hat.rotation.z=T.MathUtils.degToRad(s.tilt);hat.position.y=s.lift;}
 if(s.view==='product'){const b=asset.geometry.boundingBox,c=b.getCenter(new T.Vector3());hat.position.set(-c.x*hat.scale.x,-b.min.y*hat.scale.y+.017,-c.z*hat.scale.z);hat.rotation.set(0,0,0);plinth.visible=cameraMode!=='inside';floor.position.y=-.049;}else{plinth.visible=false;floor.position.y=-.46;}
 if(person)person.visible=s.view==='wear';
 if(s.light==='studio'){key.position.set(-.6,.85,.8);key.intensity=1.7;fill.intensity=.45;rim.intensity=.85;hemi.intensity=.7;renderer.toneMappingExposure=.85;}
 if(s.light==='neutral'){key.position.set(.1,.9,.7);key.intensity=1.2;fill.intensity=.7;rim.intensity=.35;hemi.intensity=.85;renderer.toneMappingExposure=.85;}
 if(s.light==='raking'){key.position.set(-.9,.15,.25);key.intensity=2.3;fill.intensity=.18;rim.intensity=.7;hemi.intensity=.4;renderer.toneMappingExposure=.9;}
 floor.visible=cameraMode!=='inside';measurementOverlay(profile,state);syncUI();syncMotherUI();updateQuality();requestRender();const m=metrics();$('dimensions').textContent=`${m.widthMM.toFixed(0)} × ${m.heightMM.toFixed(0)} × ${m.depthMM.toFixed(0)} mm`;
}
function frame(view='three'){if(!hat)return;cameraMode=view;floor.visible=view!=='inside';plinth.visible=state.view==='product'&&view!=='inside';stage.rotation.y=0;const b=new T.Box3().setFromObject(hat);if(state.view==='wear'){const h=D.native.heads[state.head];b.union(new T.Box3(new T.Vector3(-h.headWidthM*.66,-.19,-h.headDepthM*.55),new T.Vector3(h.headWidthM*.66,.1,h.headDepthM*.68)));}const size=b.getSize(new T.Vector3()),c=b.getCenter(new T.Vector3());let d=Math.max(size.y,size.x/camera.aspect,size.z)*1.85;d=Math.max(d,.36);const dirs={three:[1,.65,1.5],front:[0,.25,1],side:[1,.25,.03],back:[0,.3,-1],top:[.03,1,.03],inside:[.25,-.8,1],detail:[.4,.3,1]};const dir=new T.Vector3(...(dirs[view]||dirs.three)).normalize();if(view==='detail')d*=.56;camera.position.copy(c).addScaledVector(dir,d);controls.target.copy(c);controls.update();requestRender();}
const preparedHeads=new Map();
async function prepareHead(index,ctx){
 if(preparedHeads.has(index))return preparedHeads.get(index);
 phase(ctx,'读取内置头形');const h=await readHead(index),g=await waitWithSignal(decodeGeometry(h).then(g=>{if(ctx.signal.aborted){g.dispose();throw ctx.signal.reason||aborted();}return g;}),ctx.signal);
 try{
  guard(ctx.signal);phase(ctx,'在线程中测量头形');
  const {profile}=await compute('head',{position:g.attributes.position.array,index:g.index.array},{signal:ctx.signal});guard(ctx.signal);
  const value={geometry:g,profile};preparedHeads.set(index,value);headProfiles.set(index,profile);
  while(preparedHeads.size>4){const k=[...preparedHeads.keys()].find(k=>k!==index&&preparedHeads.get(k).geometry!==person?.geometry);if(k===undefined)break;preparedHeads.get(k).geometry.dispose();preparedHeads.delete(k);headProfiles.delete(k);}
  return value;
 }catch(e){g.dispose();throw e;}
}
function commitHead(index,prepared,view){
 if(person)person.geometry=prepared.geometry;
 else{person=new T.Mesh(prepared.geometry,new T.MeshStandardMaterial({color:0xc8bdae,roughness:.72}));person.castShadow=true;person.receiveShadow=true;person.name='Unmodified target head in declared measurement frame';stage.add(person);}
 person.visible=view==='wear';
}
async function headGeometry(index=state.head,fitState={...state,head:index},candidateAsset=asset){
 const ctx={signal:new AbortController().signal,title:D.native.heads[index]?.title||'头形'};
 if(activeSelection)activeSelection.controller.abort(aborted());
 const p=await prepareHead(index,ctx);if(candidateAsset)await prepareAssetFit(candidateAsset,fitState,p.profile,ctx);
 commitHead(index,p,fitState.view);state.head=index;return true;
}
function cancelSelection(){
 const ctx=activeSelection;if(!ctx)return;ctx.controller.abort(aborted());activeSelection=null;busy=false;
 document.querySelectorAll('.hat-card').forEach(b=>b.removeAttribute('data-pending'));$('cancel-load').hidden=true;
 message('已取消待切换任务；当前帽子保留，可继续选择');event('cancel',ctx.id);
}
function select(id,settings=null){
 const meta=D.hats.find(x=>x.id===id);if(!meta)return Promise.reject(Error('未知帽型；保留当前对象'));
 const signature=JSON.stringify([id,settings]);
 if(activeSelection?.signature===signature){event('deduplicated-click',id);return activeSelection.promise;}
 if(activeSelection){activeSelection.controller.abort(aborted());event('superseded',activeSelection.id,{next:id});}
 stopDetail();
 const controller=new AbortController(),ctx={controller,signal:controller.signal,signature,id,title:meta.title,started:performance.now(),stage:'准备切换',promise:null};
 activeSelection=ctx;lastRequested={id,settings};busy=true;compare=false;$('compare').classList.remove('holding');
 document.querySelectorAll('.hat-card').forEach(b=>b.toggleAttribute('data-pending',b.dataset.id===id));$('cancel-load').hidden=false;
 event('request',id);phase(ctx,'准备切换');
 const timeout=setTimeout(()=>controller.abort(new Error('本次准备超过25秒，已停止；请重试或直接选择其他帽子')),25000);
 ctx.promise=(async()=>{
  let a=null;const switchStart=ctx.started,t=++token;let fromCache=false,loadEnd=switchStart;
  if(asset)recipesByHat.set(state.id,{...state});
  const candidate=settings||{...DEFAULT,...subtypeDefaults(id),...(recipesByHat.get(id)||{}),id,view:state.view,head:state.head,light:state.light};
  try{
   await waitWithSignal(new Promise(r=>setTimeout(r,0)),ctx.signal);guard(ctx.signal);
   const prepared=await prepareHead(candidate.head,ctx);guard(ctx.signal);
   a=acquireCached(id);fromCache=!!a;
   if(!a)a=await loadAsset(meta,candidate,prepared.profile,ctx);else await prepareAssetFit(a,candidate,prepared.profile,ctx);
   guard(ctx.signal);loadEnd=performance.now();phase(ctx,'提交新帽子');
   const old=asset,oldHat=hat;commitHead(candidate.head,prepared,candidate.view);asset=a;state=candidate;
   hat=a.object||new T.Mesh(a.geometry,a.material);a.object=hat;hat.name=id;hat.castShadow=true;hat.receiveShadow=true;
   stage.add(hat);if(oldHat&&oldHat!==hat)stage.remove(oldHat);if(old&&old!==a)retainAsset(old);
   apply();frame();ready=true;$('loading').hidden=true;$('title').textContent=meta.title;$('eyebrow').textContent=`${meta.category} / ${id.toUpperCase()}`;
   $('source-note').textContent=`原帽型 / 贴图：${meta.author} · ${meta.licence}。控制网驱动程序生成与量配；原色内置，高清表面独立加载。`;
   $('teacher-image').src=meta.teacherThumbnail;$('teacher-link').href=meta.referenceURL;updateQuality();
   document.querySelectorAll('.hat-card').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.id===id)));
   const url=new URL(location.href);if(url.search.startsWith('?https://'))url.hash='hat='+id;else url.searchParams.set('hat',id);try{history.replaceState(null,'',url);}catch{}
   persist();render();const preparedMS=performance.now()-switchStart;
   lastSwitch={id,cacheHit:fromCache,generationReused:fromCache||a.generationReused,fitReused:fromCache||a.fitReused,loadMS:loadEnd-switchStart,prepareMS:preparedMS,firstFrameMS:preparedMS,workerMS:a.workerMS||0,originalColorReady:true,detailReady:!!a.maps.normal};
   switchHistory.push(lastSwitch);if(switchHistory.length>64)switchHistory.shift();event('shown',id,{wallMS:preparedMS});
   message(saveWarning||`${meta.title}已显示 · ${fromCache?'渲染缓存':a.fitReused?'生成结果复用':a.generationReused?'原帽型复用':'程序生成'} ${Math.round(preparedMS)} ms · 拖动旋转 / 滚轮拉近`);
   queueDetail(a);return metrics();
  }catch(e){
   if(a&&a!==asset&&!a.disposed)retainAsset(a);
   if(ctx.signal.aborted&&ctx.signal.reason?.name==='AbortError')return null;
   if(activeSelection===ctx){event('failed',id,{message:e.message});message(e.message+'；旧帽子保留，可重试或直接换帽。',true);}
   throw e;
  }finally{
   clearTimeout(timeout);
   if(activeSelection===ctx){activeSelection=null;busy=false;document.querySelectorAll('.hat-card').forEach(b=>b.removeAttribute('data-pending'));$('cancel-load').hidden=true;}
  }
 })();return ctx.promise;
}
function syncUI(){if($('repair'))$('repair').checked=state.repair!==false;$('detail').disabled=!asset.maps.normal;for(const k of['width','depth','height','lift','tilt','roughness','detail','sheen']){if($(k))$(k).value=state[k];if($(k+'-v'))$(k+'-v').textContent=['width','depth','height'].includes(k)?Math.round(state[k]*100)+'%':k==='lift'?(state[k]*1000).toFixed(0)+' mm':k==='tilt'?state[k]+'°':state[k].toFixed(2);}$('wear').setAttribute('aria-pressed',String(state.view==='wear'));$('product').setAttribute('aria-pressed',String(state.view==='product'));$('head-select').value=state.head;$('fit-controls').hidden=state.view!=='wear';$('head-info').textContent=state.view==='wear'?`目标头形：${D.native.heads[state.head].title} · 原人物几何不变；量配基准已声明`:'单帽观察 · 保留来源形态与材质层次';document.querySelectorAll('[data-dye]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.dye===state.dye)));document.querySelectorAll('[data-layer]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.layer===state.layer)));document.querySelectorAll('[data-light]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.light===state.light)));}
function download(name,text,type='application/json'){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);}
async function thumbnails(){
 for(const h of D.hats){const img=document.querySelector(`.hat-card[data-id="${h.id}"] img`);if(!h.renderedThumbnail){catalogueFailures.push({id:h.id,message:'缺少原目录缩略图'});continue;}img.src=h.renderedThumbnail;img.dataset.rendered='true';thumbsReady++;}
 $('count').textContent=thumbsReady+' 款真实三维';
}
async function boot(){const started=performance.now(),packed=$('payload').textContent.trim();
 const loaded=await compute('payload',{base64:packed},{onStage:t=>message(t),timeout:25000});D=loaded.payload;
 globalThis.__hatStartupStats??={};globalThis.__hatStartupStats.payloadMS=performance.now()-started;globalThis.__hatStartupStats.payloadWorkerMS=loaded.workerMS;
 $('payload').remove();$('build-id').textContent=D.version+' · '+D.sourceCommit.slice(0,8);$('catalogue').innerHTML=D.hats.map((x,i)=>`<button class="hat-card" data-id="${x.id}" aria-pressed="false"><div class="thumb"><img alt="${x.title}的真实三维缩略图"><span>${String(i+1).padStart(2,'0')}</span></div><strong>${x.title}</strong><small>${x.category} · ${x.author}</small></button>`).join('');$('catalogue').addEventListener('click',e=>{const b=e.target.closest('[data-id]');if(b)select(b.dataset.id).catch(selectionError);});$('filters').addEventListener('click',e=>{const b=e.target.closest('[data-category]');if(!b)return;document.querySelectorAll('[data-category]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));document.querySelectorAll('.hat-card').forEach(x=>x.hidden=b.dataset.category!=='all'&&D.hats.find(h=>h.id===x.dataset.id).category!==b.dataset.category);});
 $('head-select').innerHTML=D.native.heads.map((h,i)=>`<option value="${i}">${h.title}</option>`).join('');$('head-select').onchange=()=>select(state.id,{...state,head:Number($('head-select').value)}).catch(selectionError);
 for(const k of['width','depth','height','lift','tilt','roughness','detail','sheen'])$(k).oninput=()=>{state[k]=Number($(k).value);changed();};for(const el of document.querySelectorAll('[data-dye]'))el.onclick=()=>{state.dye=el.dataset.dye;state.useCustomColor=false;changed();};for(const el of document.querySelectorAll('[data-light]'))el.onclick=()=>{state.light=el.dataset.light;apply();persist();};for(const el of document.querySelectorAll('[data-layer]'))el.onclick=()=>{state.layer=el.dataset.layer;apply();};for(const el of document.querySelectorAll('[data-camera]'))el.onclick=()=>frame(el.dataset.camera);
 for(const view of['wear','product'])$(view).onclick=async()=>{try{if(view==='wear'&&!person)await headGeometry();state.view=view;apply();frame();persist();}catch(e){selectionError(e);}};$('rotate').onclick=()=>{rotating=!rotating;$('rotate').setAttribute('aria-pressed',String(rotating));requestRender();};$('reset').onclick=()=>{recipesByHat.delete(state.id);select(state.id,{...DEFAULT,...subtypeDefaults(state.id),id:state.id,view:state.view,head:state.head,light:state.light}).catch(selectionError);};const stopCompare=()=>{if(compare){compare=false;apply();$('compare').classList.remove('holding');}};$('compare').onpointerdown=e=>{e.preventDefault();compare=true;$('compare').setPointerCapture(e.pointerId);$('compare').classList.add('holding');apply();};$('compare').onpointerup=stopCompare;$('compare').onlostpointercapture=stopCompare;$('compare').onkeydown=e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();compare=true;apply();}};$('compare').onkeyup=stopCompare;$('compare').onpointercancel=stopCompare;window.addEventListener('blur',stopCompare);
 $('export').onclick=()=>download('hat-'+state.id+'.json',JSON.stringify(recipe(),null,2));$('import').onclick=()=>$('file').click();$('file').onchange=async()=>{try{const file=$('file').files[0];if(!file)return;if(file.size>100000)throw Error('配方文件过大');await restore(JSON.parse(await file.text()));message('配方已恢复');}catch(e){message(e.message,true);}finally{$('file').value='';}};
 $('about').onclick=()=>$('about-dialog').showModal();$('close-dialog').onclick=()=>$('about-dialog').close();$('credits').innerHTML=D.hats.map(x=>`<p>${x.title}：${x.author} · ${x.licence}</p>`).join('');
 $('cancel-load').onclick=cancelSelection;$('retry-load').onclick=()=>{if(lastRequested)select(lastRequested.id,lastRequested.settings).catch(selectionError);};$('clear-cache').onclick=clearRuntimeCaches;$('retry-detail').onclick=()=>{if(asset)queueDetail(asset);};
 initMotherUI();let start={...DEFAULT,...subtypeDefaults('cable')};try{const saved=localStorage.getItem(storage)||localStorage.getItem('kaopu.hat-r08.recipe');if(saved)start=validate(JSON.parse(saved));}catch(e){}
 $('repair').onchange=()=>{state.repair=$('repair').checked;apply();persist();};$('feedback-export').onclick=()=>download('hat-feedback-'+state.id+'.json',JSON.stringify(currentFeedback(),null,2));$('feedback-save').onclick=()=>{try{localStorage.setItem('kaopu.hat.feedback.draft',JSON.stringify(currentFeedback()));$('feedback-status').textContent='记录已保存在此浏览器；没有自动发送。';}catch(e){$('feedback-status').textContent='本地保存失败，请导出记录。';}};try{const f=JSON.parse(localStorage.getItem('kaopu.hat.feedback.draft'));if(f?.observation)$('feedback-text').value=f.observation;}catch{};document.addEventListener('visibilitychange',()=>{if(document.hidden)stopDetail();else{requestRender();if(asset&&!busy)queueDetail(asset);}});const pageURL=new URL(location.href);const requested=pageURL.searchParams.get('hat')||new URLSearchParams(pageURL.hash.slice(1)).get('hat');if(requested&&D.hats.some(x=>x.id===requested))start={...DEFAULT,...subtypeDefaults(requested),id:requested};try{await select(start.id,start);}catch(e){selectionError(e);}
 installHeadTools();installHairTools();window.hatLab={clearRuntimeCaches,cancel:cancelSelection,retryDetail:()=>queueDetail(asset),performance:cacheReport,debugBandVisible:v=>{if(asset.sweatMesh)asset.sweatMesh.visible=v;render();},debugParts:()=>({asset,hat,person,scene,camera,controls}),hairPlan:currentHairPlan,bandGeometryHash:()=>asset.fitResult?.sweatband?sha256Bytes(new Uint8Array(asset.fitResult.sweatband.position.buffer)):null,innerGeometryHash:()=>asset.innerMesh?sha256Bytes(new Uint8Array(asset.innerMesh.geometry.attributes.position.array.buffer)):null,geometryHash:()=>sha256Bytes(new Uint8Array(asset.geometry.attributes.position.array.buffer)),headGeometryHash:()=>sha256Bytes(new Uint8Array(person.geometry.attributes.position.array.buffer)),renderSerial:()=>renderSerial,importHead,headInput:()=>{const h=D.native.heads[state.head];return exportHeadInput(h.id,h.title,person.geometry.attributes.position.array,person.geometry.index.array);},contract:()=>lockedRecord(state.id,D.native.heads[state.head].id,asset.fitResult?.measurement),capture:()=>renderer.domElement.toDataURL('image/png'),debugGeometry:()=>({position:Array.from(asset.geometry.attributes.position.array),normal:Array.from(asset.geometry.attributes.normal.array),index:Array.from(asset.geometry.index.array),groups:Array.from(asset.mesh.groups),sweatband:asset.fitResult?.sweatband?{position:Array.from(asset.fitResult.sweatband.position),index:Array.from(asset.fitResult.sweatband.index)}:null,inner:asset.innerMesh?Array.from(asset.innerMesh.geometry.attributes.position.array):null}),cameraPose:()=>({position:camera.position.toArray(),target:controls.target.toArray()}),setCamera:p=>{camera.position.fromArray(p.position);controls.target.fromArray(p.target);controls.update();requestRender();},mother:()=>({schema:MOTHER_VERSION,recipe:asset.meta.mother,settings:{...state},measurement:asset.fitResult?.measurement||null,diagnostics:asset.fitResult?.diagnostics||null,derivedFrom:asset.meta.author,licence:asset.meta.licence}),presets:()=>REVIEWED_HATS.includes(state.id)?categoryPresets(state.id).slice(0,1):categoryPresets(state.id),setPreset:id=>{if(REVIEWED_HATS.includes(state.id)&&id!=='standard')throw Error('本轮锁定标准母型，材质仍可独立更改');const p=categoryPresets(state.id).find(p=>p.id===id);if(!p)throw Error('未知预设');state={...state,...p.values,width:1,height:1,depth:1,lift:0,tilt:0};apply();frame();persist();return recipe();},isComparing:()=>compare,measurement:()=>headProfiles.has(state.head)?measurements(headProfiles.get(state.head),state.wearBandMM/1000):null,baselinePositions:()=>Array.from(asset.mesh.position),version:D.version,sourceCommit:D.sourceCommit,ready:()=>ready&&!busy,firstFrameMS:()=>firstFrameMS,issues:()=>catalogueFailures,feedback:currentFeedback,thumbnailMap:()=>Object.fromEntries([...document.querySelectorAll('.hat-card')].map(b=>[b.dataset.id,b.querySelector('img').src])),thumbnails:()=>thumbsReady,catalogue:()=>D.hats.map(({id,title,author,licence})=>({id,title,author,licence})),select,metrics,recipe,restore,validate,frame,set:async values=>{const s=validate({...recipe(),settings:{...state,...values}});if(s.id!==state.id)return select(s.id,s);if(!person||s.head!==state.head)return select(s.id,s);state=s;apply();return metrics();},headHashes:()=>D.native.heads.map(h=>({id:h.id,hash:h.fullPositionsSHA256})),headPositions:()=>person?Array.from(person.geometry.attributes.position.array):[],currentPositions:()=>Array.from(hat.geometry.attributes.position.array),render:()=>{render();return renderer.domElement.toDataURL('image/png');}};
 $('loading').hidden=true;requestRender();thumbnails().catch(selectionError);
}

const motherNumeric=['materialMM','wearPitchDeg','wearBandMM','hairMM','clearanceMM','crownMM','brimFactor','brimCurve','bandFactor','crownFullness','backLeanMM','negativeEase','weaveMM','grainStrength'];
function syncMotherUI(){
 const spec=FIT_SPECS[state.id],knit=spec.mode==='stretch-cap';for(const k of motherNumeric){$(k).value=state[k];$(k+'-v').textContent=k==='negativeEase'?(state[k]*100).toFixed(0)+'%':k.endsWith('MM')||k==='weaveMM'?state[k].toFixed(1)+' mm':state[k].toFixed(2);}
 for(const k of ['cutaway','autoFit','showMeasurements','showClearance','useCustomColor'])$(k).checked=state[k];$('textureMode').value=state.textureMode;$('customColor').value=state.customColor;$('negativeEase').disabled=!knit;$('crownMM').min=knit?0:-20;for(const k of ['brimFactor','brimCurve'])$(k).disabled=knit;
 for(const k of ['width','height','depth','lift','tilt'])$(k).disabled=state.autoFit;
 $('fit-family').textContent=CONSTRUCTION[state.id].label;$('materialMM').disabled=!CONSTRUCTION[state.id].mode.startsWith('knit');$('bandFactor').disabled=true;$('mother-presets').innerHTML=categoryPresets(state.id).map(p=>`<button data-mother-preset="${p.id}">${p.title}</button>`).join('');
 const m=headProfiles.has(state.head)?measurements(headProfiles.get(state.head),state.wearBandMM/1000):null,d=asset.fitResult?.diagnostics;
 $('head-readout').textContent=m?`佩戴圈软尺包络 ${m.headCircumferenceMM.toFixed(1)} mm；横宽 ${m.widthMM.toFixed(1)} / 前后深 ${m.depthMM.toFixed(1)} mm。前后冠弧 ${m.frontBackArcMM.toFixed(1)} / 左右冠弧 ${m.sideToSideArcMM.toFixed(1)} mm。`: '等待头形三角网测量';
 $('fit-readout').textContent=d?`${CONSTRUCTION[state.id].label}。${d.shell?'帽身标称层厚 '+d.shell.materialThicknessMM.toFixed(1)+' mm；'+d.shell.rimEdges+' 条边已封口。':'原有实体/分片关系随整帽变换保留。'}承托区与造型区不是压力图；不做逐点贴皮推挤。`: 'R02外观基线对照；不是本轮厚度验收。';
}
function initMotherUI(){for(const k of motherNumeric)$(k).oninput=()=>{try{const candidate={...state,[k]:Number($(k).value)};validateMother(candidate);assertLockedSettings(candidate);state=candidate;apply();persist();}catch(e){message(e.message,true);}};
 for(const k of ['cutaway','autoFit','showMeasurements','showClearance','useCustomColor'])$(k).onchange=()=>{state[k]=$(k).checked;apply();persist();};$('textureMode').onchange=()=>{state.textureMode=$('textureMode').value;apply();persist();};$('customColor').oninput=()=>{state.customColor=$('customColor').value;state.useCustomColor=true;apply();persist();};
 $('mother-presets').onclick=e=>{const b=e.target.closest('[data-mother-preset]');if(b){const p=categoryPresets(state.id).find(x=>x.id===b.dataset.motherPreset);state={...state,...p.values,width:1,height:1,depth:1,lift:0,tilt:0};apply();frame();persist();}};
 $('mother-export').onclick=()=>download('hat-mother-'+state.id+'.json',JSON.stringify({schema:MOTHER_VERSION,sourceCommit:D.sourceCommit,mother:asset.meta.mother,settings:{...state},measurements:asset.fitResult?.measurement||null,attribution:{author:asset.meta.author,licence:asset.meta.licence,reference:asset.meta.referenceURL},note:'Control net and generator recipe, not a baked fitted mesh; source textures remain external licensed inputs.'},null,2));
}

function fatal(e){console.error(e);message('运行失败：'+e.message,true);$('loading').hidden=false;$('loading').textContent='未完成载入：'+e.message;}
boot().catch(fatal);

function updateQuality(){
 updateQualityBase();const locked=REVIEWED_HATS.includes(state.id);
 if(locked){$('quality-note').textContent+=' 本轮锁定结构、材料厚度和戴位；换头重新计算，调色不改尺寸。';for(const k of [...FIXED_FIELDS,'width','depth','height','lift','tilt'])if($(k))$(k).disabled=true;$('mother-presets').innerHTML='<button data-mother-preset="standard">恢复本款调好预设</button>';$('fit-family').textContent='R07 尺寸规则锁定 / '+CONSTRUCTION[state.id].label;}
 else{$('quality-note').textContent+=' 该款继承R04，本轮没有将它列为全类别验证范围。';}
 $('contract-status').textContent=locked?'母型固定 · 当前头形独立量配 · 不累积变形':'未标定帽型 · 禁止猜测适配';
 const d=asset.fitResult?.diagnostics;
 if(locked&&d){const q=d.supportSection;$('fit-readout').textContent=(q?`当前承托截面 ${q.coveredDirections}/${q.directions} 方向可测；径向间距中位 ${q.medianMM.toFixed(2)} mm。`:'实际帽口按锁定定义重新量配。')+' 帽冠空间、材料厚度另记；这里不是压力图。';}
}
async function importHead(input){if(!REVIEWED_HATS.includes(state.id))throw Error('请先选择本轮锁定帽型，再导入目标头形');
 const h=decodeHeadInput(input);if(D.native.heads.some(x=>x.id===h.id))throw Error('头形ID已存在；请使用新的ID，禁止覆盖原人物');
 const bytes=new Uint8Array(h.rawPositions.buffer),hash=sha256Bytes(bytes);h.fullPositionsSHA256=hash;
 const idx=D.native.heads.length;D.native.heads.push(h);try{await headGeometry(idx,{...state,head:idx});apply();frame();$('head-select').innerHTML=D.native.heads.map((x,i)=>`<option value="${i}"></option>`).join('');[...$('head-select').options].forEach((o,i)=>o.textContent=D.native.heads[i].title);$('head-select').value=idx;message('头形已按声明的坐标基准读取；未缩放其形状。');return {id:h.id,hash,measurement:measurements(headProfiles.get(idx),state.wearBandMM/1000)};}catch(e){D.native.heads.pop();headProfiles.delete(idx);throw e;}
}
function installHeadTools(){
 $('head-export').onclick=()=>{const h=D.native.heads[state.head];download('head-fit-'+h.id+'.json',JSON.stringify(exportHeadInput(h.id,h.title,person.geometry.attributes.position.array,person.geometry.index.array)));};
 $('head-import').onclick=()=>$('head-file').click();$('head-file').onchange=async()=>{try{const f=$('head-file').files[0];if(!f)return;if(f.size>40000000)throw Error('头形文件超过40 MB上限');await importHead(JSON.parse(await f.text()));}catch(e){message(e.message,true);}finally{$('head-file').value='';}};
}

function currentHairPlan(){return hairContactPlan({headId:D.native.heads[state.head].id,headHash:sha256Bytes(new Uint8Array(person.geometry.attributes.position.array.buffer)),hatId:state.id,hatHash:sha256Bytes(new Uint8Array(asset.geometry.attributes.position.array.buffer)),sourceCommit:D.sourceCommit,hasInnerWall:!!asset.innerMesh,hasSweatband:!!asset.sweatMesh,construction:lockedRecord(state.id,D.native.heads[state.head].id,asset.fitResult?.measurement)});}
function installHairTools(){
 $('hair-plan-export').onclick=()=>download('hat-hair-interface-'+state.id+'.json',JSON.stringify(currentHairPlan(),null,2));
 $('seating-export').onclick=()=>download('hat-seating-'+state.id+'.json',JSON.stringify({schema:'kaopu.hat-seating/1',geometrySpace:'calibrated-head-local',units:'m',hatGeometryHash:sha256Bytes(new Uint8Array(asset.geometry.attributes.position.array.buffer)),headGeometryHash:sha256Bytes(new Uint8Array(person.geometry.attributes.position.array.buffer)),recipe:recipe(),hairCouplingState:'DEFERRED',physicalDonningVerified:false},null,2));
}

function clearRuntimeCaches(){
 cancelSelection();stopDetail();
 for(const a of assetCache.values())if(a!==asset)disposeAsset(a);
 assetCache.clear();derivedCache.clear();clearDetailMemory();
 message('临时缓存已释放；当前帽子和已保存配方保留。再次选帽会重新准备。');
 if(asset)queueDetail(asset);return cacheReport();
}
