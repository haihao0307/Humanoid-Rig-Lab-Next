import * as T from 'three';
import {FINISHES} from '../../r02/site/leather.js';
import {CATALOGUE,AtelierMaterials} from './catalogue.js';
import {PRODUCT_SPECS,makeProduct,productMaterials,setProductMaterial,productAudit,patternSVG} from './products.js';
const $=id=>document.getElementById(id),V=(...p)=>new T.Vector3(...p);
const VERSION='R06.1',errors=[],BASE='e86c36c8c34b1f2b57cc5462459ee2f490e556af';
let renderer,scene,camera,key,fill,rim,environment,thumbScene,thumbCamera,library,hero,heroMats;
let product='wallet',material='heritage',mode='products',light='studio',manualMaterial=false;
let ready=false,dirty=true,allDirty=true,turning=false,hover=null,last=0,lastHover=0,revision=0;
let yaw=.30,pitch=.30,distance=310,target=V(0,43,0),radius=85,view='home';
const productThumbs=new Map(),materialCards=[],productCards=[];
let sampleThumb=null,physicsRoot=null,physCloth=null,physMid=null,physStone=null,physState=null,worker=null;
let workerEpoch=0,workerId=0,physicsPlaying=false,physicsBusy=false,actualSpeed=0,workerPending=new Map(),physicsTrace=[];
function fail(e){const msg=String(e?.stack||e);errors.push(msg);$('error').hidden=false;$('error').textContent=msg;$('busy').hidden=true;physicsPlaying=false;}
window.addEventListener('error',e=>fail(e.error||e.message));window.addEventListener('unhandledrejection',e=>fail(e.reason));
function fitGround(root){root.updateMatrixWorld(true);const box=new T.Box3().setFromObject(root),dy=.7-box.min.y;root.position.y+=dy;if(root.userData.center?.isVector3)root.userData.center.y+=dy;root.updateMatrixWorld(true);return new T.Box3().setFromObject(root);}
function destroyGeometry(root){if(!root)return;root.removeFromParent();const seen=new Set();root.traverse(o=>{if(o.geometry&&!seen.has(o.geometry)){seen.add(o.geometry);o.geometry.dispose();}if(o.userData.logo){o.material.map?.dispose();o.material.dispose();}});}
function makeEnvironment(){const es=new T.Scene();es.background=new T.Color('#414640');
 for(const [pos,w,h,power,col]of[[[-3.5,4.2,3],3.4,5.2,5.2,'#fff8ec'],[[4.0,2.4,1],1.4,4.4,3.2,'#ebf1f2'],[[0,4.8,-3.5],4.2,1.4,4.4,'#fff8eb']]){const p=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:new T.Color(col).multiplyScalar(power),side:T.DoubleSide}));p.position.set(...pos);p.lookAt(0,0,0);es.add(p);}const gen=new T.PMREMGenerator(renderer);const env=gen.fromScene(es,.05,.1,30);gen.dispose();es.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});return env;
}
function initRenderer(){
 renderer=new T.WebGLRenderer({canvas:$('sceneCanvas'),antialias:true,alpha:false,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.setSize(innerWidth,innerHeight,false);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.autoClear=false;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.VSMShadowMap;renderer.shadowMap.autoUpdate=false;
 environment=makeEnvironment();scene=new T.Scene();scene.background=new T.Color('#ebe8e0');scene.environment=environment.texture;scene.environmentIntensity=.85;
 camera=new T.PerspectiveCamera(34,1,.6,6000);
 key=new T.DirectionalLight('#fff0db',2.25);key.position.set(-430,690,430);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-220,right:220,top:220,bottom:-220,near:5,far:2300});key.shadow.bias=-.00007;key.shadow.normalBias=.10;key.shadow.radius=8;key.shadow.blurSamples=12;scene.add(key,key.target);
 fill=new T.DirectionalLight('#e0eaf0',.70);fill.position.set(460,270,80);scene.add(fill);
 rim=new T.DirectionalLight('#fff6e9',1.2);rim.position.set(0,510,-470);scene.add(rim);
 const floor=new T.Mesh(new T.PlaneGeometry(7000,7000),new T.MeshStandardMaterial({color:'#dddcd2',roughness:.90}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
 thumbScene=new T.Scene();thumbScene.background=new T.Color('#e7e7dd');thumbScene.environment=environment.texture;thumbScene.environmentIntensity=.85;const tl=new T.DirectionalLight('#fff4e4',2.15);tl.position.set(-200,400,230);thumbScene.add(tl);const tf=new T.DirectionalLight('#dfe8e9',.85);tf.position.set(200,150,-50);thumbScene.add(tf);thumbCamera=new T.PerspectiveCamera(34,1,.5,4000);
}
function setLight(id){if(!['studio','neutral','rake'].includes(id))throw Error('无效布光');light=id;
 for(const[k,v]of[['lightStudio','studio'],['lightNeutral','neutral'],['lightRake','rake']])$(k).classList.toggle('active',v===id);
 if(id==='studio'){key.position.set(-430,690,430);key.color.set('#fff0db');key.intensity=2.25;fill.intensity=.70;rim.intensity=1.2;scene.environmentIntensity=.85;renderer.toneMappingExposure=1.05;}
 if(id==='neutral'){key.position.set(-180,650,500);key.color.set('#ffffff');key.intensity=1.8;fill.intensity=1.0;rim.intensity=.50;scene.environmentIntensity=.72;renderer.toneMappingExposure=1.00;}
 if(id==='rake'){key.position.set(-650,125,220);key.color.set('#fff2dd');key.intensity=3.1;fill.intensity=.45;rim.intensity=.65;scene.environmentIntensity=.52;renderer.toneMappingExposure=1.05;}
 renderer.shadowMap.needsUpdate=true;dirty=true;allDirty=true;revision++;
}
function setView(id){view=id;const box=mode==='physics'?new T.Box3(V(-135,0,-135),V(135,154,135)):new T.Box3().setFromObject(hero);
 const size=box.getSize(V()),center=box.getCenter(V());target.copy(center);radius=Math.max(size.x,size.y,size.z)/2;const aspect=Math.max(.45,$('stage').clientWidth/Math.max(1,$('stage').clientHeight));distance=radius/Math.tan(T.MathUtils.degToRad(17))*1.20/Math.min(1,aspect);
 yaw=.32;pitch=.32;if(product==='belt'&&mode==='products'){yaw=.62;pitch=.80;}if(product==='swatch'&&mode==='products'){yaw=.18;pitch=.85;}if(product==='hat'&&mode==='products'){yaw=.27;pitch=.35;}
 if(mode==='physics'){yaw=.42;pitch=.63;distance*=.92;}
 if(id==='front'){yaw=0;pitch=.04;if(product==='belt'||product==='swatch')pitch=1.43;}
 if(id==='back'){yaw=Math.PI+.08;pitch=.13;if(product==='swatch')pitch=-.5;}
 if(id==='macro'){distance*=.43;pitch=.32;yaw=.18;if(product==='wallet'){target.set(15,hero.position.y-14,5);distance=106;}if(product==='belt'){const b=hero.userData.frame(0);target.copy(b.p).applyMatrix4(hero.matrixWorld);distance=160;yaw=1.2;pitch=.46;}if(product==='bag'){target.set(0,125,40);distance=200;}if(product==='hat'){target.set(0,65,90);distance=200;}if(product==='swatch'){target.set(5,24,0);distance=95;pitch=.85;}if(mode==='physics'){target.set(0,91,0);distance=240;pitch=.53;}}
 if(id!=='macro'){
  const zAxis=V(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));
  const xAxis=V().crossVectors(V(0,1,0),zAxis).normalize(),yAxis=V().crossVectors(zAxis,xAxis);
  const tangent=Math.tan(T.MathUtils.degToRad(camera.fov/2)),margin=.86;let required=25;
  for(const x of[box.min.x,box.max.x])for(const y of[box.min.y,box.max.y])for(const z of[box.min.z,box.max.z]){
   const q=V(x,y,z).sub(target),along=q.dot(zAxis);
   required=Math.max(required,along+Math.abs(q.dot(xAxis))/(tangent*aspect*margin),along+Math.abs(q.dot(yAxis))/(tangent*margin));
  }
  distance=required;
 }
 const h=Math.max(150,radius*1.75);Object.assign(key.shadow.camera,{left:-h,right:h,top:h,bottom:-h});key.shadow.camera.updateProjectionMatrix();key.target.position.copy(center);key.target.updateMatrixWorld();renderer.shadowMap.needsUpdate=true;
 for(const[k,v]of[['viewHome','home'],['viewFront','front'],['viewBack','back'],['viewMacro','macro']])$(k).classList.toggle('active',id===v);dirty=true;revision++;
}
function selectMaterial(id,manual=true){if(!CATALOGUE.some(c=>c.id===id))throw Error('无效材质');renderer.setScissorTest(false);material=id;if(manual)manualMaterial=true;const entry=library.select(id);if(hero){setProductMaterial(hero,entry.material);hero.traverse(o=>{if(!o.userData.leather&&o.material?.userData?.catalogueId)o.material=entry.material;});}if(physCloth)physCloth.material[0]=entry.material;materialCards.forEach(o=>o.button.classList.toggle('active',o.id===id));updateDetails();allDirty=dirty=true;revision++;return entry;}
function selectProduct(id){if(!PRODUCT_SPECS[id])throw Error('无效产品');if(mode!=='products')switchMode('products');product=id;destroyGeometry(hero);hero=null;
 if(!manualMaterial)selectMaterial(PRODUCT_SPECS[id].defaultMaterial,false);
 heroMats=productMaterials(library.hero.material);hero=makeProduct(id,heroMats);fitGround(hero);scene.add(hero);productCards.forEach(o=>o.button.classList.toggle('active',o.id===id));updateDetails();setView('home');allDirty=true;revision++;
}
function updateDetails(){const c=CATALOGUE.find(c=>c.id===material),s=PRODUCT_SPECS[product];$('materialName').textContent=c.name;$('materialDescription').textContent=c.description;$('finishName').textContent=c.source==='r05'?'真实粒面 / 独立底色、法线、粗糙度':FINISHES[library.hero?.params?.finish||'aniline'].name;
 $('heroTitle').textContent=mode==='physics'?'皮料的承重与恢复':s.name;$('heroEyebrow').textContent=mode==='physics'?'PHYSICAL STUDY / PRESERVED R04':s.en;
 $('heroSubtitle').textContent=mode==='physics'?'统一物理单位 · 四角夹持 · 球体与皮料双向接触':s.subtitle;
 $('productSize').textContent=mode==='physics'?'240 × 240 mm · '+({NL:'1.39',PNL:'1.16',AL:'1.06'})[$('profile').value]+' mm':s.size;
 $('qualityState').textContent=mode==='physics'?'论文配方演示 · 未实物标定':'三维结构候选 · 待你验收';$('stageLabel').textContent=mode==='physics'?'SOLVER POSITIONS / NO PRESCRIBED DEFORMATION':'CONSTRUCTED IN MILLIMETRES';
 $('showPattern').textContent=['wallet','belt'].includes(product)?'查看 1:1 纸样':'本款纸样尚未定版';$('showPattern').disabled=!['wallet','belt'].includes(product);$('showPattern').style.opacity=$('showPattern').disabled?.5:1;
 $('productState').textContent=['wallet','belt'].includes(product)?'提供尺寸与孔位一致的试作纸样，仍需废皮打样。成品造型不冒称整衣物理。':'本款可旋转检查材料与结构；尚未提供可用纸样或整件产品的物理求解。';
 $('productControls').hidden=mode==='physics';$('physicsControls').hidden=mode!=='physics';
}
function createCards(){
 let family='';for(const [i,c]of CATALOGUE.entries()){if(c.family!==family){family=c.family;const el=document.createElement('div');el.className='family';el.textContent=family==='inherited'?'01 / INHERITED MATERIALS':'02 / FINISH & SOURCE VARIANTS';$('materialGrid').append(el);}
 const b=document.createElement('button');b.className='material-card';b.dataset.material=c.id;b.innerHTML=`<span class="number">${String(i+1).padStart(2,'0')}</span><div class="thumb" aria-hidden="true"></div><span class="label">${c.name}</span><span class="tag">${c.tag}</span>`;b.onclick=()=>selectMaterial(c.id);$('materialGrid').append(b);const entry={id:c.id,button:b,element:b.querySelector('.thumb'),type:'material'};materialCards.push(entry);b.onpointerenter=()=>{hover=entry;};b.onpointerleave=()=>{hover=null;allDirty=true;};}
 for(const id of ['wallet','belt','bag','hat','swatch']){const s=PRODUCT_SPECS[id],b=document.createElement('button');b.className='product-card';b.dataset.product=id;b.innerHTML=`<div class="thumb" aria-hidden="true"></div><b>${s.name}</b><span class="note">${['wallet','belt'].includes(id)?'3D / PATTERN':'3D / STUDY'}</span>`;b.onclick=()=>selectProduct(id);$('collection').append(b);const e={id,button:b,element:b.querySelector('.thumb'),type:'product'};productCards.push(e);b.onpointerenter=()=>{hover=e;};b.onpointerleave=()=>{hover=null;allDirty=true;};}
}
function initThumbs(){for(const id of ['wallet','belt','bag','hat','swatch']){const s=PRODUCT_SPECS[id],m=productMaterials(library.small.get(s.defaultMaterial).material),o=makeProduct(id,m);const box=fitGround(o);o.userData.thumbnailBox=box;o.userData.baseRotation=o.rotation.y;productThumbs.set(id,o);}sampleThumb=makeProduct('swatch',productMaterials(library.small.get('heritage').material));fitGround(sampleThumb);}
function visibleViewport(el){const r=el.getBoundingClientRect();if(r.bottom<=0||r.top>=innerHeight||r.right<=0||r.left>=innerWidth||r.width<2||r.height<2)return null;renderer.setViewport(r.left,innerHeight-r.bottom,r.width,r.height);renderer.setScissor(Math.max(0,r.left),Math.max(0,innerHeight-r.bottom),Math.min(innerWidth,r.right)-Math.max(0,r.left),Math.min(innerHeight,r.bottom)-Math.max(0,r.top));renderer.setScissorTest(true);return r;}
function renderThumb(entry,time=0){const r=visibleViewport(entry.element);if(!r)return;
 const obj=entry.type==='material'?sampleThumb:productThumbs.get(entry.id);if(entry.type==='material')setProductMaterial(obj,library.small.get(entry.id).material);
 const base=obj.userData.baseRotation||0,old=obj.rotation.y;obj.rotation.y=base+(entry===hover?Math.sin(time*.0006)*.65:0);thumbScene.add(obj);obj.updateMatrixWorld(true);
 const box=new T.Box3().setFromObject(obj),sz=box.getSize(V()),center=box.getCenter(V());const rr=Math.max(sz.x,sz.y,sz.z)/2;const aspect=r.width/r.height;const d=rr/Math.tan(T.MathUtils.degToRad(17))*1.16/Math.min(1,aspect);let ya=.28,pi=.43;if(entry.type==='material'||entry.id==='swatch')pi=.92;if(entry.id==='belt'){pi=.83;ya=.5;}
 thumbCamera.aspect=aspect;thumbCamera.updateProjectionMatrix();thumbCamera.position.set(center.x+d*Math.sin(ya)*Math.cos(pi),center.y+d*Math.sin(pi),center.z+d*Math.cos(ya)*Math.cos(pi));thumbCamera.lookAt(center);renderer.clear(true,true,true);renderer.render(thumbScene,thumbCamera);thumbScene.remove(obj);obj.rotation.y=old;
}
function render(t=0){if(!ready||mode==='baseline')return;allDirty=true;const w=innerWidth,h=innerHeight,dpr=Math.min(devicePixelRatio||1,1.5);if(renderer.domElement.width!==Math.round(w*dpr)||renderer.domElement.height!==Math.round(h*dpr)){renderer.setPixelRatio(dpr);renderer.setSize(w,h,false);allDirty=true;}
 if(allDirty){renderer.setScissorTest(false);renderer.setClearColor('#ebe8e0');renderer.clear(true,true,true);}
 const r=visibleViewport($('stage'));if(r){camera.aspect=r.width/r.height;camera.updateProjectionMatrix();camera.position.set(target.x+distance*Math.sin(yaw)*Math.cos(pitch),target.y+distance*Math.sin(pitch),target.z+distance*Math.cos(yaw)*Math.cos(pitch));camera.lookAt(target);renderer.clear(true,true,true);renderer.render(scene,camera);}
 if(allDirty){for(const e of [...materialCards,...productCards])renderThumb(e,t);}else if(hover&&t-lastHover>50){renderThumb(hover,t);lastHover=t;}
 const millimetres=radius<80?20:50;const rw=r?r.height*millimetres/(2*Math.tan(T.MathUtils.degToRad(17))*distance):30;$('ruler').style.width=rw+'px';$('rulerText').textContent=millimetres+' mm';$('status').textContent=`${VERSION} · 源码 ${BUILD_INFO.sourceCommit.slice(0,8)} · ${renderer.info.memory.geometries} 几何 · ${library.hero?.params?.resolution||'scan'} 材质级别`;
 dirty=false;allDirty=false;
}
function loop(t){requestAnimationFrame(loop);if(!ready||document.hidden)return;const dt=last?Math.min(.08,(t-last)/1000):0;last=t;if(mode==='baseline')return;if(turning){yaw+=dt*.18;dirty=true;}if(hover&&t-lastHover>50)dirty=true;
 if(mode==='physics'&&physicsPlaying&&!physicsBusy&&physState&&!physState.report.failed){physicsBusy=true;const start=performance.now();askWorker('step',{count:4}).then(()=>{actualSpeed=(4/240)/Math.max(.001,(performance.now()-start)/1000);physicsBusy=false;}).catch(e=>{physicsBusy=false;fail(e);});}
 if(dirty||allDirty)render(t);
}
async function switchMode(next){if(!['products','physics','baseline'].includes(next))throw Error('无效工作区');mode=next;physicsPlaying=false;turning=false;$('autoRotate').classList.remove('active');
 $('tabProducts').classList.toggle('active',next==='products');$('tabPhysics').classList.toggle('active',next==='physics');$('tabBaseline').classList.toggle('active',next==='baseline');$('baselinePane').hidden=next!=='baseline';$('layout').style.visibility=next==='baseline'?'hidden':'visible';$('sceneCanvas').hidden=next==='baseline';
 if(hero)hero.visible=next==='products';if(physicsRoot)physicsRoot.visible=next==='physics';
 if(next==='baseline'){if(!$('baselineFrame').srcdoc){const bytes=Uint8Array.from(atob(BASELINE_GZIP),c=>c.charCodeAt(0));const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));$('baselineFrame').srcdoc=await new Response(stream).text();}return;}
 if(next==='physics'){if(!physState)await resetPhysics();else physicsPlaying=true;}
 updateDetails();setView('home');allDirty=dirty=true;
}
function askWorker(op,args={}){if(!worker)throw Error('物理 Worker 未初始化');const id=++workerId;return new Promise((resolve,reject)=>{workerPending.set(id,{resolve,reject});worker.postMessage({id,op,...args});});}
function initWorker(){const url=URL.createObjectURL(new Blob([WORKER_CODE],{type:'text/javascript'}));worker=new Worker(url);URL.revokeObjectURL(url);worker.onerror=e=>fail(e.message);worker.onmessage=e=>{const f=e.data,p=workerPending.get(f.id);workerPending.delete(f.id);if(f.error){p?.reject(Error(f.error));return;}try{try{if(f.epoch===workerEpoch&&f.positions)receivePhysics(f);p?.resolve(f);}catch(error){p?.reject(error);fail(error);}}catch(error){p?.reject(error);fail(error);}};}
async function resetPhysics(){physicsPlaying=false;workerEpoch++;physState=null;physicsTrace=[];if(!worker)initWorker();const id=$('profile').value;await askWorker('init',{mode:'stone',epoch:workerEpoch,options:{profile:id,thickness:({NL:1.39,PNL:1.16,AL:1.06})[id]/1000,stoneMass:.045,dropHeight:.04}});physicsPlaying=mode==='physics';updateDetails();setView('home');}
function physicsBox(w,h,d,mat,x,y,z){const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;physicsRoot.add(m);return m;}
function buildPhysics(f){destroyGeometry(physicsRoot);physicsRoot=new T.Group();physicsRoot.position.y=90;physicsRoot.visible=mode==='physics';scene.add(physicsRoot);const n=f.positions.length/3,tri=Array.from(f.triangles),top=[];for(let i=0;i<tri.length;i+=3)top.push(tri[i],tri[i+2],tri[i+1]);
 physMid=new T.BufferGeometry();physMid.setAttribute('position',new T.Float32BufferAttribute(new Float32Array(n*3),3));physMid.setIndex(top);
 const g=new T.BufferGeometry(),idx=[...top,...tri.map(v=>v+n)],uv=new Float32Array(n*4);const edgeStart=idx.length;for(const[a,b]of f.boundary)idx.push(a,b,a+n,b,b+n,a+n);
 for(let side=0;side<2;side++)for(let i=0;i<n;i++){uv[2*(side*n+i)]=(f.rest[3*i]+.12)*1000/96;uv[2*(side*n+i)+1]=(f.rest[3*i+2]+.12)*1000/96;}
 g.setAttribute('position',new T.Float32BufferAttribute(new Float32Array(n*6),3));g.setAttribute('normal',new T.Float32BufferAttribute(new Float32Array(n*6),3));g.setAttribute('uv',new T.BufferAttribute(uv,2));g.setIndex(idx);g.addGroup(0,top.length,0);g.addGroup(top.length,tri.length,1);g.addGroup(edgeStart,idx.length-edgeStart,2);
 physCloth=new T.Mesh(g,productMaterials(library.hero.material).shell);physCloth.castShadow=physCloth.receiveShadow=true;physCloth.userData.leather=true;physicsRoot.add(physCloth);
 const metal=new T.MeshStandardMaterial({color:'#788477',roughness:.35,metalness:.78}),dark=new T.MeshStandardMaterial({color:'#39483a',roughness:.53,metalness:.45});
 for(const x of[-112.5,112.5])for(const z of[-112.5,112.5]){physicsBox(23,4,23,metal,x,f.thickness*500+2,z);physicsBox(23,3.5,23,metal,x,-f.thickness*500-1.75,z);physicsBox(12,83,12,dark,x,-47,z);for(const zz of[-6,6]){const bolt=new T.Mesh(new T.CylinderGeometry(1.6,1.6,7,12),dark);bolt.position.set(x,5,z+zz);physicsRoot.add(bolt);}}
 const stoneMat=new T.MeshStandardMaterial({color:'#9d9b8a',roughness:.94});physStone=new T.Mesh(new T.SphereGeometry(16,48,32),stoneMat);physStone.castShadow=physStone.receiveShadow=true;physicsRoot.add(physStone);
}
function receivePhysics(f){const fresh=!physState;physState=f;if(fresh)buildPhysics(f);const n=f.positions.length/3;const a=physMid.attributes.position.array;for(let i=0;i<a.length;i++)a[i]=f.positions[i]*1000;physMid.attributes.position.needsUpdate=true;physMid.computeVertexNormals();
 const nn=physMid.attributes.normal.array,p=physCloth.geometry.attributes.position.array,no=physCloth.geometry.attributes.normal.array;for(let i=0;i<n;i++)for(let side=0;side<2;side++){const sign=side?-1:1,k=(side*n+i)*3;for(let j=0;j<3;j++){p[k+j]=a[3*i+j]+sign*nn[3*i+j]*f.thickness*500;no[k+j]=sign*nn[3*i+j];}}
 physCloth.geometry.attributes.position.needsUpdate=true;physCloth.geometry.attributes.normal.needsUpdate=true;physCloth.geometry.computeBoundingSphere();physStone.position.fromArray(f.stone.pos).multiplyScalar(1000);physStone.visible=f.stone.visible;const r=f.report;
 $('physicsInfo').textContent=`物理时间 ${r.timeS.toFixed(3)} s\n中心下垂 ${r.centerSagMM.toFixed(3)} mm\n皮样质量 ${(r.massKg*1000).toFixed(3)} g\n接触力 ${r.contactForceN.toFixed(4)} N\n接触压入 ${r.penetrationMM.toFixed(5)} mm\n夹持误差 ${r.pinErrorMM.toExponential(1)} mm\n当前残差 ${Number.isFinite(r.residualN)?r.residualN.toExponential(1):'尚未求解'} N\n计算速度 ${actualSpeed.toFixed(2)}×`;
 $('pausePhysics').textContent=physicsPlaying?'暂停计算':'继续计算';if(r.failed){physicsPlaying=false;fail('物理求解停止：'+r.failed);}
 physicsTrace.push({timeS:r.timeS,sagMM:r.centerSagMM,contactForceN:r.contactForceN,penetrationMM:r.penetrationMM,finite:r.finite});if(physicsTrace.length>2400)physicsTrace.shift();renderer.shadowMap.needsUpdate=true;dirty=true;revision++;
}
function frameAudit(){hero.updateMatrixWorld(true);camera.updateMatrixWorld(true);const b=new T.Box3().setFromObject(hero),points=[];for(const x of[b.min.x,b.max.x])for(const y of[b.min.y,b.max.y])for(const z of[b.min.z,b.max.z])points.push(V(x,y,z).project(camera).toArray());return{maxAbsX:Math.max(...points.map(p=>Math.abs(p[0]))),maxAbsY:Math.max(...points.map(p=>Math.abs(p[1]))),inDepth:points.every(p=>p[2]>-1&&p[2]<1),points};}
function recipe(){return{schema:'kaopu/leather-atelier@1',version:VERSION,sourceCommit:BUILD_INFO.sourceCommit,baseline:BASE,product:PRODUCT_SPECS[product],productAudit:productAudit(hero),material:library.recipe(material),lighting:light,physicalSpecimen:physState?{config:physState.config,report:physState.report,trace:physicsTrace.slice(-60)}:null,limitations:['Product shapes are dimensioned constructions, not solved full-garment physics','Only belt and card-holder prototype patterns available','Material appearance is not a measured mechanical calibration','Inherited R04 has no self-collision, friction, tearing or permanent folds']};}
function saveText(text,name,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
function setupUI(){
 $('tabProducts').onclick=()=>switchMode('products');$('tabPhysics').onclick=()=>switchMode('physics');$('tabBaseline').onclick=()=>switchMode('baseline');
 for(const[k,v]of[['viewHome','home'],['viewFront','front'],['viewBack','back'],['viewMacro','macro']])$(k).onclick=()=>setView(v);
 for(const[k,v]of[['lightStudio','studio'],['lightNeutral','neutral'],['lightRake','rake']])$(k).onclick=()=>setLight(v);
 $('autoRotate').onclick=()=>{turning=!turning;$('autoRotate').classList.toggle('active',turning);dirty=true;};
 $('showPattern').onclick=()=>{$('patternPreview').innerHTML=patternSVG(product);$('patternDialog').showModal();};$('closePattern').onclick=()=>$('patternDialog').close();$('downloadPattern').onclick=()=>saveText(patternSVG(product),`KAOPU-${product}-prototype-1to1-mm.svg`,'image/svg+xml');
 $('showRecipe').onclick=()=>{$('recipeText').textContent=JSON.stringify(recipe(),null,2);$('recipeDialog').showModal();};$('closeRecipe').onclick=()=>$('recipeDialog').close();$('downloadRecipe').onclick=()=>saveText(JSON.stringify(recipe(),null,2),`KAOPU-${product}-${material}-R061.json`,'application/json');
 $('dropStone').onclick=async()=>{await askWorker('drop');physicsPlaying=true;};$('removeStone').onclick=async()=>{await askWorker('remove');physicsPlaying=true;};$('pausePhysics').onclick=()=>{physicsPlaying=!physicsPlaying;$('pausePhysics').textContent=physicsPlaying?'暂停计算':'继续计算';};$('resetPhysics').onclick=()=>resetPhysics();$('profile').onchange=()=>resetPhysics();
 const pointers=new Map();let pinch=0;const el=$('stage');el.onpointerdown=e=>{el.setPointerCapture(e.pointerId);pointers.set(e.pointerId,[e.clientX,e.clientY]);turning=false;$('autoRotate').classList.remove('active');};el.onpointermove=e=>{const old=pointers.get(e.pointerId);if(!old)return;pointers.set(e.pointerId,[e.clientX,e.clientY]);if(pointers.size===2){const[a,b]=[...pointers.values()],d=Math.hypot(a[0]-b[0],a[1]-b[1]);if(pinch)distance=Math.max(25,Math.min(3000,distance*pinch/d));pinch=d;}else{yaw-=(e.clientX-old[0])*.006;pitch=Math.max(-1.47,Math.min(1.47,pitch+(e.clientY-old[1])*.005));}dirty=true;};for(const name of['onpointerup','onpointercancel'])el[name]=e=>{pointers.delete(e.pointerId);pinch=0;};el.addEventListener('wheel',e=>{e.preventDefault();distance=Math.max(25,Math.min(3000,distance*Math.exp(e.deltaY*.001)));dirty=true;},{passive:false});
 window.addEventListener('resize',()=>{if(ready&&mode!=='baseline')setView(view);allDirty=dirty=true;});window.addEventListener('scroll',()=>{allDirty=dirty=true;},{passive:true,capture:true});
}
async function boot(){initRenderer();createCards();setupUI();library=new AtelierMaterials(renderer,JSON.parse($('scanData').textContent));await library.init((i,n)=>{$('loadingText').textContent=`正在准备三维皮料 ${i} / ${n}`;});selectMaterial('heritage',false);initThumbs();selectProduct('wallet');ready=true;$('busy').hidden=true;render();requestAnimationFrame(loop);
 window.LEATHER_ATELIER={ready:true,version:VERSION,errors,get mode(){return mode;},get product(){return product;},get material(){return material;},get revision(){return revision;},get physics(){return physState?.report||null;},get physicsTrace(){return physicsTrace;},get physicsPlaying(){return physicsPlaying;},selectProduct,selectMaterial,setLight,setView,switchMode,render,recipe,frameAudit,patternSVG,audit:()=>productAudit(hero),snapshot:()=>({mode,product,material,light,revision,errors:[...errors],audit:productAudit(hero),thumbs:{materials:materialCards.length,products:productCards.length},baseline:BASE,sourceCommit:BUILD_INFO.sourceCommit}),pausePhysics:()=>{physicsPlaying=false;},physicsCommand:async(op)=>{physicsPlaying=false;return askWorker(op,op==='step'?{count:4}:{});},advancePhysics:async(steps)=>{physicsPlaying=false;for(let i=0;i<steps;i+=24)await askWorker('step',{count:Math.min(24,steps-i)});return physState.report;}};
}
boot().catch(fail);
