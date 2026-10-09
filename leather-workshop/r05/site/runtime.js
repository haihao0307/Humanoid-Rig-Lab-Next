import * as T from 'three';
import {buildContactField,mapSurfacePoint} from './contact-surface.mjs';
import {SewingAppearance} from './appearance.js';
import {LeatherKernel,PRESETS,DEFAULT,FINISHES} from '../../r02/site/leather.js';
import {SEAM_VERSION,SEAM_DEFAULT,SEAM_SOURCES,buildSeam,validateSeam,auditSeam} from './seam.mjs';
import {makeLeatherGeometry,cutFaceGeometry,makeThreadGeometry,fibreNormalTexture} from './geometry.js';
const $=id=>document.getElementById(id),errors=[];
let renderer,scene,camera,kernel,root,threadRoot,model,leatherMeshes=[],threadMeshes=[],cutMesh,cutMat,ready=false,dirty=true,tab='seam',view='home',hide=false,process=null,playing=false,last=0,acc=0;
let params={...SEAM_DEFAULT},look={...DEFAULT,...PRESETS.tan,preset:'tan',color:'#733b22',roughness:.45},threadColor='#dbc7a1',plies=true,revision=0;
let target=new T.Vector3(0,0,-4),distance=100,yaw=.18,pitch=.53;
const appearance=new SewingAppearance();let responseEnabled=true,lightRig=null;
const fibre=fibreNormalTexture(),clipping=[new T.Plane(new T.Vector3(0,0,-1),-5)];
function fail(e){errors.push(String(e?.stack||e));$('error').textContent=errors.at(-1);$('busy').hidden=true;playing=false;}
window.addEventListener('error',e=>fail(e.error||e.message));window.addEventListener('unhandledrejection',e=>fail(e.reason));
function dispose(root){if(!root)return;scene.remove(root);const gs=new Set(),ms=new Set();root.traverse(o=>{if(o.geometry&&!gs.has(o.geometry)){gs.add(o.geometry);o.geometry.dispose();}const a=Array.isArray(o.material)?o.material:[o.material];for(const m of a)if(m&&!ms.has(m)){ms.add(m);m.dispose();}});}
function bake(){look.resolution=innerWidth<700?1024:2048;kernel.bake(look);}
function threadMat(half){return new T.MeshPhysicalMaterial({color:view==='route'?(half==='A'?'#79a7b8':half==='B'?'#d68c57':threadColor):threadColor,roughness:.58,metalness:0,sheen:.25,anisotropy:.28,anisotropyRotation:0,side:T.FrontSide,sheenColor:new T.Color('#ddd1ba'),sheenRoughness:.85,map:plies?fibre.userData.albedo:null,normalMap:plies?fibre:null,normalScale:new T.Vector2(.22,.22),vertexColors:true});}
function needle(e){const g=new T.Group(),m=new T.MeshStandardMaterial({color:'#c6cbd0',metalness:.85,roughness:.26});const shaft=new T.Mesh(new T.CylinderGeometry(.105,.15,3.0,10),m);shaft.position.y=1.65;const tip=new T.Mesh(new T.ConeGeometry(.105,.50,10),m);tip.position.y=3.40;const eye=new T.Mesh(new T.TorusGeometry(.20,.055,5,14),m);eye.scale.y=1.65;g.add(shaft,tip,eye);g.position.fromArray(mapSurfacePoint(model,e.position));const d=new T.Vector3(...e.direction).normalize();if(d.lengthSq()<.01)d.set(0,1,0);g.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d);g.userData.half=e.half;return g;}
function rebuildThreads(){
 dispose(threadRoot);threadRoot=new T.Group();scene.add(threadRoot);threadMeshes=[];
 for(const r of model.routes){if(r.points.length<2)continue;const g=makeThreadGeometry(r.points.map(p=>mapSurfacePoint(model,p)),params.diameter,plies),mesh=new T.Mesh(g,threadMat(r.half));mesh.castShadow=true;mesh.receiveShadow=false;mesh.userData.routeId=r.id;mesh.userData.half=r.half;threadRoot.add(mesh);threadMeshes.push(mesh);}
 if(process)for(const e of model.needleEnds)threadRoot.add(needle(e));
 threadRoot.visible=!hide;dirty=true;
}
function surfaceMat(kind){
 if($('materialSource').value==='original'){
  if(kind==='grain'){const m=kernel.material.clone();m.side=T.FrontSide;return m;}
 }
 return kind==='grain'?appearance.grain(look):kind==='cut'?appearance.cut(look):appearance.flesh(look);
}
function rebuild(){
 model=buildSeam(params,process);model.contact=buildContactField(model,responseEnabled);dispose(root);root=new T.Group();scene.add(root);leatherMeshes=[];
 const data=makeLeatherGeometry(model);
 for(const s of data.surfaces){const m=surfaceMat(s.exposed&&s.side>0?'grain':s.exposed?'flesh':'inside'),obj=new T.Mesh(s.geometry,m);obj.receiveShadow=true;obj.castShadow=false;obj.userData.kind='leather';root.add(obj);leatherMeshes.push(obj);}
 for(const w of data.walls){const m=surfaceMat('cut'),obj=new T.Mesh(w.geometry,m);m.color.multiplyScalar(w.layer===0?1.06:.86);obj.castShadow=false;obj.receiveShadow=true;root.add(obj);leatherMeshes.push(obj);}
 cutMat=surfaceMat('cut');cutMesh=new T.Mesh(cutFaceGeometry(model),cutMat);root.add(cutMesh);rebuildThreads();applyViewMaterials();sync();revision++;
}
function applyViewMaterials(){
 for(const mesh of leatherMeshes){const m=mesh.material;m.clippingPlanes=view==='section'?clipping:[];m.side=view==='route'?T.DoubleSide:T.FrontSide;m.transparent=view==='route';m.opacity=view==='route'?.13:1;m.depthWrite=view!=='route';m.needsUpdate=true;mesh.castShadow=false;}
 cutMat.side=T.DoubleSide;cutMesh.visible=view==='section';for(const m of threadMeshes)m.material.color.set(view==='route'?(m.userData.half==='A'?'#79a7b8':m.userData.half==='B'?'#d68c57':threadColor):threadColor);
 threadRoot.visible=!hide;dirty=true;
}
function setView(k){
 if(!['home','macro','back','section','route'].includes(k))throw Error('视角无效');view=k;
 const h=model.holes[Math.floor((params.count-1)/2)],x=h.x;
 if(k==='home'){target.set(0,0,-3);distance=Math.max(110,model.width*1.85)*(innerWidth<700?1.5:1);yaw=.18;pitch=.62;}
 if(k==='macro'){target.set(x,0,-5);distance=27*(innerWidth<700?1.4:1);yaw=.14;pitch=.66;}
 if(k==='back'){target.set(0,0,-4);distance=Math.max(110,model.width*1.85)*(innerWidth<700?1.5:1);yaw=-.13;pitch=-.67;}
 if(k==='section'){target.set(x,0,-5);distance=25*(innerWidth<700?1.4:1);yaw=.15;pitch=.17;}
 if(k==='route'){target.set(x,0,-5);distance=32*(innerWidth<700?1.4:1);yaw=.25;pitch=.40;}
 document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===k));applyViewMaterials();sync();
}
function sync(){
 for(const [k]of specs){$(k).value=params[k];$(k+'Out').textContent=(k==='count'?params[k]:k==='holeAngle'?params[k]+'°':k==='tightness'?Math.round(params[k]*100)+'%':k==='tensionN'?params[k].toFixed(2)+' N':params[k].toFixed(2)+' mm');}
 $('type').value=params.type;$('rows').value=params.rows;$('colorThread').value=threadColor;$('plies').checked=plies;$('preset').value=look.preset;$('finishMaterial').value=look.finish;$('colorLeather').value=look.color;
 const a=auditSeam(model);if(model.contact)$('contactInfo').textContent=`局部皮面压陷 ${(-model.contact.stats.minDisplacementMM*1000).toFixed(1)} μm · 求解残差 ${model.contact.stats.relativeResidual.toExponential(1)} · 未标定`; $('stats').textContent=`${model.holes.length} 个真实孔 · ${a.passages} 段穿透 · ${a.totalThreadMM.toFixed(1)} mm 线长`;
 $('validation').textContent=`针路检查：${a.pointsOutsideHole===0?'穿孔段位于对应针孔内':'发现越界'}；两层总厚 ${model.totalThickness.toFixed(2)} mm。`;
 $('stage').textContent=process?`第 ${process.hole+1} 孔 · ${model.stage}`:view==='section'?'剖面：前半皮革仅为观察移除，线的内部路径保持原位':view==='route'?'A / B 为同一根线的两端；皮革透明，仅用于检查针路':view==='back'?'背面：线真实穿过皮革，不是正面线条的复制贴图':model.stage;
 $('methodNote').textContent=params.type==='saddle'?'A、B 是同一根线的两端。每个后续孔由两端反向穿过，正面与背面都有完整针脚。':'一根针带一根线，上下交替穿孔。正面与背面的可见针脚错开，不伪装成马鞍缝。';
 $('processHint').textContent=process?'针为局部截段示意 · 穿线步骤按教程规定，不是力学求解':'成品视图 · 鼠标拖动旋转，滚轮放大';
}
function setProcess(phase,hole=null){const j=hole??process?.hole??Math.floor(params.count/2);process={hole:Math.min(params.count-1,Math.max(1,j)),phase:Math.max(0,Math.min(1,phase))};const previousContact=model.contact;model=buildSeam(params,process);model.contact=previousContact;rebuildThreads();sync();revision++;}
function watch(){hide=false;$('hideThread').classList.remove('active');setProcess(0);setView('section');target.x=model.holes[process.hole].x-params.pitch/2;playing=true;}
function next(){playing=false;const seq=params.type==='saddle'?[0,.20,.40,.55,.75,1]:[0,.15,.60,1];if(!process)setProcess(0);else{const n=seq.find(x=>x>process.phase+.001);if(n!==undefined)setProcess(n);else setProcess(0,Math.min(params.count-1,process.hole+1));}}
function finish(){playing=false;process=null;rebuild();}
function switchTab(k){tab=k;$('workspace').hidden=k!=='seam';$('legacyPane').hidden=k!=='legacy';$('sources').hidden=k!=='sources';$('tabSeam').classList.toggle('active',k==='seam');$('tabLegacy').classList.toggle('active',k==='legacy');$('tabSource').classList.toggle('active',k==='sources');playing=false;if(k==='legacy'&&!$('legacy').srcdoc)$('legacy').srcdoc=new TextDecoder().decode(Uint8Array.from(atob($('legacyData').textContent),c=>c.charCodeAt(0)));dirty=true;}
function recipe(){return {schema:'kaopu/leather_sewing_recipe@1',version:SEAM_VERSION,seam:params,material:look,threadColor,plies,anchor:'LEATHER_R04_USER_ACCEPTED_20261009',frozenR04Modified:false};}
function loadRecipe(r){if(r.schema!=='kaopu/leather_sewing_recipe@1')throw Error('不是本缝制模块的配方');const p=validateSeam(r.seam);if(!PRESETS[r.material?.preset]||!FINISHES[r.material?.finish]||!/^#[\da-f]{6}$/i.test(r.material?.color)||!/^#[\da-f]{6}$/i.test(r.threadColor))throw Error('材质或颜色无效');params=p;look={...DEFAULT,...r.material};threadColor=r.threadColor;plies=r.plies!==false;playing=false;process=null;bake();rebuild();setView('home');}
function saveFile(obj,name){const a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}));a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),3000);}
function render(){if(!ready||tab!=='seam')return;const r=$('view').getBoundingClientRect(),w=Math.round(r.width),h=Math.round(r.height),dpr=Math.min(devicePixelRatio||1,1.5);if(w<1||h<1)return;if(renderer.domElement.width!==Math.round(w*dpr)||renderer.domElement.height!==Math.round(h*dpr)){renderer.setPixelRatio(dpr);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}camera.position.set(target.x+distance*Math.sin(yaw)*Math.cos(pitch),target.y+distance*Math.sin(pitch),target.z+distance*Math.cos(yaw)*Math.cos(pitch));camera.lookAt(target);renderer.render(scene,camera);$('ruler').style.width=(h/(2*Math.tan(T.MathUtils.degToRad(camera.fov/2)))*5/distance)+'px';$('status').textContent=`${SEAM_VERSION} · ${model.holes.length} 孔 · ${renderer.info.render.triangles.toLocaleString()} 三角形 · R04冻结校验由构建完成`;dirty=false;}
function tick(t){requestAnimationFrame(tick);const dt=last?Math.min(.06,(t-last)/1000):0;last=t;if(tab!=='seam'||document.hidden)return;if(playing&&process){acc+=dt;if(acc>.07){const f=process.phase+acc/6.0;acc=0;setProcess(Math.min(1,f));if(f>=1)playing=false;}}if(dirty)render();}
const specs=[['pitch','针距',2.5,5.5,.1],['diameter','线径',.24,.60,.02],['layerThickness','每层皮厚',.8,2.5,.1],['holeAngle','针孔方向',25,65,5],['tightness','线形收紧',0,1,.05],['count','每排针孔数',5,25,1],['tensionN','收线张力（演示输入）',0,2.4,.1]];
function ui(){for(const [k,label,min,max,step]of specs){const div=document.createElement('div');div.innerHTML=`<div class="field"><label for="${k}">${label}</label><output id="${k}Out"></output></div><input id="${k}" type="range" min="${min}" max="${max}" step="${step}">`;$('seamSliders').append(div);$(k).oninput=()=>{$(k+'Out').textContent=$(k).value;};$(k).onchange=()=>{params[k]=+$(k).value;playing=false;process=null;rebuild();if(k==='count'||k==='pitch')setView('home');};}
 for(const [k,v]of Object.entries(PRESETS))$('preset').add(new Option(v.name,k));for(const[k,v]of Object.entries(FINISHES))$('finishMaterial').add(new Option(v.name,k));
 for(const id of ['type','rows'])$(id).onchange=()=>{params[id]=id==='rows'?+$(id).value:$(id).value;process=null;playing=false;rebuild();};
 $('colorThread').oninput=()=>{threadColor=$('colorThread').value;for(const m of threadMeshes)m.material.color.set(threadColor);dirty=true;};$('plies').onchange=()=>{plies=$('plies').checked;rebuildThreads();};
 $('materialSource').onchange=()=>rebuild();$('raking').onclick=()=>{const on=$('raking').classList.toggle('active');lightRig.position.set(on?-65:-35,on?14:75,45);dirty=true;};
 $('noResponse').onpointerdown=e=>{e.preventDefault();responseEnabled=false;rebuild();};for(const ev of ['pointerup','pointercancel','blur'])window.addEventListener(ev,()=>{if(!responseEnabled){responseEnabled=true;rebuild();}});
 document.querySelectorAll('[data-tension]').forEach(b=>b.onclick=()=>{params.tensionN=+b.dataset.tension;params.tightness=params.tensionN===0?0:1;playing=false;process=null;rebuild();});
 $('preset').onchange=()=>{look={...look,...PRESETS[$('preset').value],preset:$('preset').value};bake();rebuild();};$('finishMaterial').onchange=()=>{const f=$('finishMaterial').value;look={...look,finish:f,roughness:FINISHES[f].roughness,coat:FINISHES[f].coat};bake();rebuild();};$('colorLeather').onchange=()=>{look.color=$('colorLeather').value;bake();rebuild();};
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));$('watch').onclick=watch;$('pause').onclick=()=>{if(!process)watch();else playing=!playing;};$('next').onclick=next;$('finish').onclick=finish;$('hideThread').onclick=()=>{hide=!hide;threadRoot.visible=!hide;$('hideThread').classList.toggle('active',hide);dirty=true;};
 $('tabSeam').onclick=()=>switchTab('seam');$('tabLegacy').onclick=()=>switchTab('legacy');$('tabSource').onclick=()=>switchTab('sources');$('useLegacy').onclick=()=>{const p=$('legacy').contentWindow.LEATHER_LAB?.params;if(!p)return;look={...p};bake();rebuild();switchTab('seam');};
 $('exportRecipe').onclick=()=>saveFile(recipe(),'KAOPU-sewing-recipe-r05.json');$('exportRoute').onclick=()=>saveFile({...recipe(),route:buildSeam(params),audit:auditSeam(buildSeam(params))},'KAOPU-sewing-route-r05.json');$('save').onclick=()=>{try{localStorage.setItem('kaopu-sewing-r05',JSON.stringify(recipe()));$('stage').textContent='缝制配方已保存';}catch(e){$('stage').textContent='浏览器存储不可用，请导出配方';}};$('restore').onclick=()=>{try{const s=localStorage.getItem('kaopu-sewing-r05');if(!s)return;loadRecipe(JSON.parse(s));}catch(e){$('stage').textContent='恢复失败：'+e.message;}};$('importBtn').onclick=()=>$('import').click();$('import').onchange=async()=>{try{const f=$('import').files[0];if(!f||f.size>100000)throw Error('文件过大');loadRecipe(JSON.parse(await f.text()));}catch(e){$('stage').textContent='导入失败：'+e.message;}};
 const pts=new Map();let pinch=0;$('view').onpointerdown=e=>{e.target.setPointerCapture(e.pointerId);pts.set(e.pointerId,[e.clientX,e.clientY]);};$('view').onpointermove=e=>{const p=pts.get(e.pointerId);if(!p)return;pts.set(e.pointerId,[e.clientX,e.clientY]);if(pts.size===2){const[a,b]=[...pts.values()],l=Math.hypot(a[0]-b[0],a[1]-b[1]);if(pinch)distance=Math.max(12,Math.min(300,distance*pinch/l));pinch=l;}else{yaw-=(e.clientX-p[0])*.006;pitch=Math.max(-1.5,Math.min(1.5,pitch+(e.clientY-p[1])*.006));}dirty=true;};for(const id of ['onpointerup','onpointercancel'])$('view')[id]=e=>{pts.delete(e.pointerId);pinch=0;};$('view').addEventListener('wheel',e=>{e.preventDefault();distance=Math.max(12,Math.min(300,distance*Math.exp(e.deltaY*.001)));dirty=true;},{passive:false});window.addEventListener('resize',()=>dirty=true);
}
async function boot(){try{await appearance.load(JSON.parse($('grainData').textContent));renderer=new T.WebGLRenderer({canvas:$('view'),antialias:true,preserveDrawingBuffer:true});renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.localClippingEnabled=true;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;scene=new T.Scene();scene.background=new T.Color('#29322d');camera=new T.PerspectiveCamera(32,1,.05,1000);kernel=new LeatherKernel(renderer);
 const env=new T.Scene();env.background=new T.Color('#333638');for(const [pos,w,h,power]of [[[-3,4,2],3,4,4],[[4,2,0],1.5,3,2.5],[[0,4,-4],4,1.5,3]]){const o=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:new T.Color(1,.97,.93).multiplyScalar(power),side:T.DoubleSide}));o.position.set(...pos);o.lookAt(0,0,0);env.add(o);}const pm=new T.PMREMGenerator(renderer);scene.environment=pm.fromScene(env,.04,.1,30).texture;scene.environmentIntensity=.70;pm.dispose();env.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});const light=new T.DirectionalLight('#fff2df',2.2);lightRig=light;light.position.set(-35,75,45);light.castShadow=true;light.shadow.mapSize.set(2048,2048);Object.assign(light.shadow.camera,{left:-75,right:75,top:55,bottom:-55,near:1,far:200});light.shadow.bias=-.00010;light.shadow.normalBias=.05;scene.add(light);const fill=new T.DirectionalLight('#d2e3ed',1.6);fill.position.set(40,-25,-35);scene.add(fill);ui();bake();rebuild();ready=true;setView('home');render();$('busy').hidden=true;requestAnimationFrame(tick);window.LEATHER_SEWING={ready:true,version:SEAM_VERSION,errors,get model(){return model;},get revision(){return revision;},recipe,loadRecipe,setView,switchTab,setProcess,finish,render,audit:()=>auditSeam(model),setParam:(k,v)=>{params=validateSeam({...params,[k]:v});process=null;playing=false;rebuild();},get contact(){return model.contact.stats;},setResponse:v=>{responseEnabled=!!v;rebuild();},get surfaces(){return leatherMeshes;},get threads(){return threadMeshes;}};
}catch(e){fail(e);}}
boot();
