import * as T from 'three';
import {LeatherKernel,PRESETS,DEFAULT} from '../../r02/site/leather.js';
import {PROFILES} from '../../r03/site/physics.mjs';
const $=s=>document.getElementById(s),VERSION='R04.0',errors=[];
let renderer,scene,camera,kernel,worker,cloth,wire,mid,assembly,stone,ghost,clips=[],active='stone',tab='live',state=null,playing=false,busy=false,ready=false,epoch=0,seq=0,yaw=.43,pitch=.69,dist=.59,wireOn=false,ghostOn=false,look,trace=[],pending=new Map(),lastBatch=0,actualSpeed=0,operation=0,drag=null,pointer=null;
const center=new T.Vector3(0,.008,0),mouse=new T.Vector2(),ray=new T.Raycaster(),dragPlane=new T.Plane(new T.Vector3(0,1,0),0);
const metal=new T.MeshStandardMaterial({color:'#79817f',metalness:.75,roughness:.36}),dark=new T.MeshStandardMaterial({color:'#333d3d',metalness:.5,roughness:.6}),gold=new T.MeshStandardMaterial({color:'#af8954',metalness:.75,roughness:.4});
const stoneSurface=new T.MeshStandardMaterial({color:'#9f9b8f',roughness:.92}),ghostSurface=new T.LineBasicMaterial({color:'#ab9980',transparent:true,opacity:.6});
const back=new T.MeshStandardMaterial({color:'#57442f',roughness:.96,side:T.FrontSide}),edgeMat=new T.MeshStandardMaterial({color:'#573924',roughness:.92,side:T.DoubleSide}),wireMat=new T.MeshBasicMaterial({color:'#c8ded7',wireframe:true,transparent:true,opacity:.27});
function fail(e){errors.push(String(e?.stack||e));$('error').textContent=errors.at(-1);playing=false;$('loading').hidden=true;}
window.addEventListener('error',e=>fail(e.error||e.message));window.addEventListener('unhandledrejection',e=>fail(e.reason));
function ask(op,args={}){const id=++seq;return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});worker.postMessage({op,id,...args});});}
function save(data,name,type='application/json'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([typeof data==='string'?data:JSON.stringify(data,null,2)],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),10000);}
function mat(p){look=p?{...p}:{...DEFAULT,...PRESETS[$('look').value],preset:$('look').value};look.resolution=innerWidth<700?1024:2048;kernel.bake(look);back.color.set(look.color).multiplyScalar(.62);edgeMat.color.set(look.color).multiplyScalar(.65);if(cloth)cloth.material=[kernel.material,back,edgeMat];}
function dispose(group){if(!group)return;scene.remove(group);const seen=new Set();group.traverse(o=>{if(o.geometry&&!seen.has(o.geometry)){seen.add(o.geometry);o.geometry.dispose();}});}
function box(w,h,d,material,x,y,z,parent){const m=new T.Mesh(new T.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function jaw(cx,cz,w,d,isRight=false){const g=new T.Group();g.position.set(cx,0,cz);const t=state.thickness;box(w,.004,d,isRight?gold:metal,0,t/2+.002,0,g);box(w,.0035,d,metal,0,-t/2-.00175,0,g);
 for(const z of d>.1?[-d*.38,d*.38]:[0]){const bolt=new T.Mesh(new T.CylinderGeometry(.0016,.0016,.007,12),dark);bolt.position.set(0,.005,z);g.add(bolt);}
 box(w*.7,.058,d>.1?.014:d*.6,dark,0,-.033,0,g);assembly.add(g);g.userData.rightClamp=isRight;return g;}
function build(){dispose(assembly);assembly=new T.Group();scene.add(assembly);clips=[];
 const n=state.positions.length/3,pos=new Float32Array(n*3),tris=Array.from(state.triangles),top=[];for(let i=0;i<tris.length;i+=3)top.push(tris[i],tris[i+2],tris[i+1]);
 mid=new T.BufferGeometry();mid.setAttribute('position',new T.BufferAttribute(pos,3));mid.setIndex(top);
 const geo=new T.BufferGeometry(),idx=[],uv=new Float32Array(n*4),t=state.thickness;
 idx.push(...top);for(let i=0;i<tris.length;i++)idx.push(tris[i]+n);const edgeStart=idx.length;for(const [a,b]of state.boundary)idx.push(a,b,a+n,b,b+n,a+n);
 for(let s=0;s<2;s++)for(let i=0;i<n;i++){uv[2*(s*n+i)]=(state.rest[3*i]+.12)/.096;uv[2*(s*n+i)+1]=(state.rest[3*i+2]+.12)/.096;}
 geo.setAttribute('position',new T.BufferAttribute(new Float32Array(n*6),3));geo.setAttribute('normal',new T.BufferAttribute(new Float32Array(n*6),3));geo.setAttribute('uv',new T.BufferAttribute(uv,2));geo.setAttribute('uv1',geo.attributes.uv.clone());geo.setIndex(idx);geo.addGroup(0,top.length,0);geo.addGroup(top.length,tris.length,1);geo.addGroup(edgeStart,idx.length-edgeStart,2);
 cloth=new T.Mesh(geo,[kernel.material,back,edgeMat]);cloth.castShadow=true;cloth.receiveShadow=true;wire=new T.Mesh(mid,wireMat);wire.visible=wireOn;assembly.add(cloth,wire);
 const outline=[];for(const [a,b]of state.boundary)for(const id of [a,b])outline.push(state.rest[id*3],.001,state.rest[id*3+2]);const gg=new T.BufferGeometry();gg.setAttribute('position',new T.Float32BufferAttribute(outline,3));ghost=new T.LineSegments(gg,ghostSurface);ghost.visible=ghostOn;assembly.add(ghost);
 if(active==='stone'){for(const x of [-.1125,.1125])for(const z of [-.1125,.1125])clips.push(jaw(x,z,.022,.022));const gm=new T.SphereGeometry(state.stone.radius,40,28);stone=new T.Mesh(gm,stoneSurface);stone.castShadow=true;stone.receiveShadow=true;assembly.add(stone);}
 else{clips.push(jaw(-.129,0,.022,.19),jaw(.129,0,.022,.19,true));stone=null;}
 updateGeometry();
}
function updateGeometry(){if(!state||!cloth)return;const n=state.positions.length/3;mid.attributes.position.array.set(state.positions);mid.attributes.position.needsUpdate=true;mid.computeVertexNormals();mid.computeBoundingSphere();const normals=mid.attributes.normal.array,p=cloth.geometry.attributes.position.array,nor=cloth.geometry.attributes.normal.array;
 for(let i=0;i<n;i++)for(let side=0;side<2;side++){const sign=side===0?1:-1,k=(side*n+i)*3;for(let j=0;j<3;j++){p[k+j]=state.positions[3*i+j]+sign*normals[3*i+j]*state.thickness/2;nor[k+j]=sign*normals[3*i+j];}}
 cloth.geometry.attributes.position.needsUpdate=true;cloth.geometry.attributes.normal.needsUpdate=true;cloth.geometry.computeBoundingSphere();
 if(stone){stone.position.fromArray(state.stone.pos);stone.visible=state.stone.visible;}
 if(active==='clamp'&&clips.length===2){const pull=state.report.clampPullMM/2000;clips[0].position.x=-.129-pull;clips[1].position.x=.129+pull;}
}
function receive(f){if(f.epoch!==epoch)return;const previous=state;state=f;if(!previous||previous.epoch!==f.epoch||previous.mode!==f.mode)build();else updateGeometry();metrics();}
function metrics(){if(!state)return;const r=state.report;$('loading').hidden=true;
 if(active==='stone'){$('m1').textContent=r.centerSagMM.toFixed(2);$('m2').textContent=((r.maxStretch-1)*100).toFixed(2);$('m3').textContent=r.timeS.toFixed(2);$('l1').textContent='中心下垂 / mm';$('l2').textContent='最大局部伸长 / %';$('l3').textContent='物理时间 / s';$('hint').textContent=r.failed?'求解已停止：'+r.failed:r.stoneActive?'石块与皮面共同受力。点击“取走石块”继续看恢复。':playing?'石块已取走 / 尚未投放；皮面继续在重力下恢复与平衡。':'点击“投放石块”。底下网格是地面，不是皮面的固定高度。';$('diagnostic').textContent=`接触压入 ${r.penetrationMM.toFixed(4)} mm · 夹持误差 ${r.pinErrorMM.toExponential(1)} mm · 子步残差 ${(r.residualN||0).toExponential(1)} N。密度、弯曲、阻尼为假设值。`;
  if(!trace.length||r.timeS!==trace.at(-1).timeS)trace.push({timeS:r.timeS,centerSagMM:r.centerSagMM,maxStretch:r.maxStretch,penetrationMM:r.penetrationMM,energyJ:r.totalEnergyJ,stoneActive:r.stoneActive});
 }else{$('m1').textContent=r.forceN.toFixed(1);$('m2').textContent=(r.nominalStrain*100).toFixed(2);$('m3').textContent=r.clampPullMM.toFixed(2);$('l1').textContent='夹子反力 / N';$('l2').textContent='名义伸长 / %';$('l3').textContent='两夹子总位移 / mm';$('hint').textContent=r.converged?'当前载荷已求平衡。拖金色夹子，或回位观察弹性卸载。':'正在求平衡；尚未收敛的数值不作验收。';$('diagnostic').textContent=`自由节点残差 ${r.residualN.toExponential(2)} N · ${r.iterations} 次迭代 · 局部最大伸长 ${((r.maxPrincipalStretch-1)*100).toFixed(2)}%。这是准静态状态，不是物理时间。`;
  trace.push({nominalStrain:r.nominalStrain,forceN:r.forceN,residualN:r.residualN,converged:r.converged});
 }
 if(trace.length>3000)trace.splice(0,100);plot();$('pause').textContent=playing?'暂停':'继续重力';
 $('status').textContent=`${VERSION} · ${active==='stone'?'隐式动力学 / 实际约 '+actualSpeed.toFixed(2)+'×':'非线性夹持力平衡'} · Worker 求解 · 原 R02 材质`;
}
function plot(){const data=trace.slice(-600),points=active==='stone'?data.map(p=>[p.timeS,p.centerSagMM]):data.map(p=>[p.nominalStrain*100,p.forceN]);if(!points.length)return;const xx=Math.max(.01,...points.map(p=>p[0])),yy=Math.max(.01,...points.map(p=>p[1]))*1.05;const xy=points.map(p=>`${32+232*p[0]/xx},${100-77*p[1]/yy}`).join(' ');$('chart').innerHTML=`<path d="M32 20V100H271" stroke="#637171" fill="none"/><polyline points="${xy}" stroke="#cbb18c" fill="none" stroke-width="1.5"/><text x="32" y="13">${active==='stone'?'中心下垂 mm':'夹子反力 N'}</text><text x="27" y="26" text-anchor="end">${yy.toFixed(1)}</text><text x="267" y="119" text-anchor="end">${xx.toFixed(2)} ${active==='stone'?'s':'%'}</text>`;}
function options(){const p=$('profile').value;return {profile:p,angle:+$('angleOut').dataset.value||0,thickness:active==='stone'?PROFILES[p].thickness/1000:PROFILES[p].thickness,stoneMass:+$('mass').value/1000,dropHeight:+$('height').value/1000};}
async function reset(mode=active){playing=false;operation++;active=mode;epoch++;lastBatch=0;actualSpeed=0;state=null;trace=[];$('loading').hidden=false;$('modeStone').classList.toggle('active',mode==='stone');$('modeClamp').classList.toggle('active',mode==='clamp');$('stoneControls').hidden=mode!=='stone';$('clampControls').hidden=mode!=='clamp';$('title').textContent=mode==='stone'?'落石 / 真实承重与恢复':'夹子 / 真实拉伸与卸载';$('subtitle').textContent=mode==='stone'?'240 × 240 mm · 四角面夹持 · 皮革与石块共同求解':'240 × 180 mm · 两端整边夹持 · 内部节点求平衡';$('physicalNote').textContent=`${PROFILES[$('profile').value].name}；厚度 ${PROFILES[$('profile').value].thickness} mm。落石密度假设700 kg/m³，弯曲刚度0.002 N·m。`;
 await ask('init',{mode,epoch,options:options()});setView('home');ready=true;}
async function doDrop(){lastBatch=0;await ask('drop');playing=true;metrics();}
async function doRemove(){lastBatch=0;await ask('remove');playing=true;metrics();}
async function pull(value){playing=false;const v=Math.max(0,Math.min(.1,value));$('pull').value=v;$('pullOut').textContent=(v*100).toFixed(1)+'%';await ask('clamp',{strain:v});}
async function cycle(){const id=++operation,target=+$('pull').value;for(let i=1;i<=12;i++){if(id!==operation||active!=='clamp')return;await pull(target*i/12);await new Promise(r=>setTimeout(r,80));}await new Promise(r=>setTimeout(r,800));for(let i=11;i>=0;i--){if(id!==operation||active!=='clamp')return;await pull(target*i/12);await new Promise(r=>setTimeout(r,80));}}
function setView(which){yaw=which==='side'?.25:which==='top'?0:.43;pitch=which==='side'?.18:which==='top'?1.55:.69;dist=which==='macro'?.34:innerWidth<700?.93:.62;center.set(0,which==='side'?.008:.010,0);}
function switchTab(id){playing=false;operation++;tab=id;$('live').hidden=id!=='live';$('legacyPane').hidden=id!=='legacy';$('source').hidden=id!=='source';for(const[k,n]of[['tabLive','live'],['tabLegacy','legacy'],['tabSource','source']])$(k).classList.toggle('active',id===n);
 if(id==='legacy'&&!$('legacy').srcdoc)$('legacy').srcdoc=new TextDecoder().decode(Uint8Array.from(atob($('legacyData').textContent),c=>c.charCodeAt(0)));}
function worldAt(ev){const r=$('view').getBoundingClientRect();mouse.set((ev.clientX-r.left)/r.width*2-1,1-(ev.clientY-r.top)/r.height*2);ray.setFromCamera(mouse,camera);return ray.ray.intersectPlane(dragPlane,new T.Vector3());}
async function loop(t){requestAnimationFrame(loop);if(!ready||tab!=='live'||document.hidden)return;
 if(playing&&active==='stone'&&!busy){busy=true;const token=epoch,start=performance.now();ask('step',{count:2}).then(()=>{if(token===epoch){const now=performance.now();actualSpeed=.008333/((now-(lastBatch||start))/1000);lastBatch=now;if(state.report.failed)playing=false;}const delay=Math.max(0,1000*.008333/+$('speed').value-(performance.now()-start));setTimeout(()=>busy=false,delay);}).catch(e=>{busy=false;fail(e);});}
 const r=$('view').getBoundingClientRect(),w=Math.round(r.width),h=Math.round(r.height);if(w<=0||h<=0)return;const dpr=Math.min(devicePixelRatio||1,1.6);if(renderer.domElement.width!==Math.round(w*dpr)||renderer.domElement.height!==Math.round(h*dpr)){renderer.setPixelRatio(dpr);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
 camera.position.set(center.x+dist*Math.sin(yaw)*Math.cos(pitch),center.y+dist*Math.sin(pitch),center.z+dist*Math.cos(yaw)*Math.cos(pitch));camera.lookAt(center);renderer.render(scene,camera);
}
function ui(){
 $('modeStone').onclick=()=>reset('stone');$('modeClamp').onclick=()=>reset('clamp');$('drop').onclick=doDrop;$('remove').onclick=doRemove;$('reset').onclick=()=>reset();$('resetClamp').onclick=()=>reset();$('pause').onclick=()=>{playing=!playing;lastBatch=0;metrics();};
 for(const id of ['mass','height']){$(id).oninput=()=>$(id+'Out').textContent=$(id).value+(id==='mass'?' g':' mm');$(id).onchange=()=>reset();}
 $('profile').onchange=()=>reset();document.querySelectorAll('[data-angle]').forEach(b=>b.onclick=()=>{$('angleOut').dataset.value=b.dataset.angle;$('angleOut').textContent=b.dataset.angle+'°';document.querySelectorAll('[data-angle]').forEach(a=>a.classList.toggle('active',a===b));reset();});
 $('look').onchange=()=>mat();$('pull').oninput=()=>{$('pullOut').textContent=(+$('pull').value*100).toFixed(1)+'%';};$('pull').onchange=()=>{operation++;pull(+$('pull').value);};$('pullNow').onclick=()=>{operation++;pull(+$('pull').value);};$('release').onclick=()=>{operation++;pull(0);};$('cycle').onclick=cycle;
 for(const id of ['home','side','top','macro'])$(id).onclick=()=>setView(id);$('wire').onclick=()=>{wireOn=!wireOn;if(wire)wire.visible=wireOn;$('wire').classList.toggle('active',wireOn);};$('ghost').onclick=()=>{ghostOn=!ghostOn;if(ghost)ghost.visible=ghostOn;$('ghost').classList.toggle('active',ghostOn);};
 $('tabLive').onclick=()=>switchTab('live');$('tabLegacy').onclick=()=>switchTab('legacy');$('tabSource').onclick=()=>switchTab('source');
 $('useLegacy').onclick=()=>{const win=$('legacy').contentWindow;if(!win?.LEATHER_PHYSICS?.ready)return;let p=win.LEATHER_PHYSICS.result().visualMaterial;try{const inner=win.document.getElementById('legacy');if(inner?.contentWindow?.LEATHER_LAB)p=inner.contentWindow.LEATHER_LAB.params;}catch{}mat(p);switchTab('live');};
 $('export').onclick=async()=>{playing=false;const r=await ask('snapshot');save({...r.snapshot,history:trace,visualMaterial:look},'KAOPU_Leather_R04_Result.json');};
 $('view').onpointerdown=e=>{$('view').setPointerCapture(e.pointerId);const p=worldAt(e);const hits=active==='clamp'&&clips[1]?ray.intersectObject(clips[1],true):[];if(hits.length&&p){operation++;drag={x:p.x,start:state.report.clampPullMM/1000};$('hint').textContent='拖动右夹子：请求位移由材料力平衡求解。';}else pointer={x:e.clientX,y:e.clientY};};
 let pendingDrag=null,dragBusy=false;
 $('view').onpointermove=e=>{if(drag){const p=worldAt(e);if(!p)return;pendingDrag=Math.max(0,Math.min(.1,(drag.start+2*(p.x-drag.x))/.24));if(!dragBusy){dragBusy=true;const v=pendingDrag;pendingDrag=null;pull(v).finally(()=>{dragBusy=false;});}}else if(pointer){yaw-=(e.clientX-pointer.x)*.005;pitch=Math.max(-.8,Math.min(1.56,pitch+(e.clientY-pointer.y)*.005));pointer={x:e.clientX,y:e.clientY};}};
 for(const id of ['onpointerup','onpointercancel'])$('view')[id]=()=>{drag=null;pointer=null;if(pendingDrag!==null){const v=pendingDrag;pendingDrag=null;pull(v);}};
 $('view').addEventListener('wheel',e=>{e.preventDefault();dist=Math.max(.23,Math.min(1.5,dist*Math.exp(e.deltaY*.001)));},{passive:false});
}
try{
 renderer=new T.WebGLRenderer({canvas:$('view'),antialias:true,preserveDrawingBuffer:true});renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
 scene=new T.Scene();scene.background=new T.Color('#252e30');camera=new T.PerspectiveCamera(36,1,.001,6);kernel=new LeatherKernel(renderer);
 const es=new T.Scene();es.background=new T.Color('#3a4040');for(const[p,w,h,power]of[[[-3,4,2],3,4,5],[[4,2,-1],2,4,3],[[0,4,-4],4,2,4]]){const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:new T.Color(1,.97,.91).multiplyScalar(power),side:T.DoubleSide}));m.position.set(...p);m.lookAt(0,0,0);es.add(m);}const pm=new T.PMREMGenerator(renderer);scene.environment=pm.fromScene(es,.04,.1,30).texture;scene.environmentIntensity=.8;pm.dispose();es.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
 const sun=new T.DirectionalLight(0xffffff,2.2);sun.position.set(-.35,.6,.35);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-.3,right:.3,top:.3,bottom:-.3,near:.1,far:2});sun.shadow.normalBias=.00025;sun.shadow.bias=-.00001;scene.add(sun);const fill=new T.DirectionalLight('#dbe6ed',.35);fill.position.set(.3,.15,-.4);scene.add(fill);
 const floor=new T.Mesh(new T.PlaneGeometry(3,3),new T.MeshStandardMaterial({color:'#293538',roughness:.9}));floor.rotation.x=-Math.PI/2;floor.position.y=-.062;floor.receiveShadow=true;scene.add(floor);const grid=new T.GridHelper(.75,30,'#47585a','#334648');grid.position.y=-.0619;scene.add(grid);
 const blob=new Blob([WORKER_CODE],{type:'text/javascript'});worker=new Worker(URL.createObjectURL(blob));worker.onerror=fail;worker.onmessage=e=>{const f=e.data,p=pending.get(f.id);pending.delete(f.id);if(f.error){p?.reject(Error(f.error));return;}if(f.positions)receive(f);p?.resolve(f);};ui();mat();
 window.LEATHER_DYNAMICS={version:VERSION,errors,get ready(){return ready;},get state(){return state;},get visualMaterial(){return look;},get playing(){return playing;},pause:()=>{playing=false;},reset,drop:async()=>{await doDrop();playing=false;},remove:async()=>{await doRemove();playing=false;},pull,switchTab,setView,command:ask,advance:async(seconds)=>{playing=false;const count=Math.round(seconds*240);let f;for(let i=0;i<count;i+=12)f=await ask('step',{count:Math.min(12,count-i)});return f;},snapshot:()=>ask('snapshot')};
 reset().then(()=>requestAnimationFrame(loop)).catch(fail);
}catch(e){fail(e);}
