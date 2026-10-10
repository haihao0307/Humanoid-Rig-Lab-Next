import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {STYLES,createShoe,explodeShoe,disposeShoe} from './geometry.mjs';
import {MATERIALS,COLOURS,palette,disposePalette,makeEnvironment} from './materials.mjs';
const $=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)],V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const VERSION='R01.2';
const defaults=()=>({schema:'kaopu-shoe-config/1',version:VERSION,person:'standard',style:'derby',material:'smooth',colour:'#683920',fit:{toe:12,ease:3.8,instep:3},mode:'studio',light:'studio',lightAngle:0,view:'hero',wireframe:false,xray:false});
let state=defaults(),pack,renderer,camera,scene,controls,model,pal,bodyMesh,measurementGroup,dirty=1,rotate=false,thumbReady=false,ready=false,rendered=0,buildId=globalThis.__SHOE_BUILD__||'development',rebuildCount=0;
const objects=new T.Group();
function toast(s){$('#toast').textContent=s;$('#toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),3500);}
function fail(e){console.error(e);$('#loading').style.display='flex';$('#loading').innerHTML='<b>未能载入三维工作台</b><span></span>';$('#loading span').textContent=e.message||String(e);$('#status').textContent='载入失败：'+e.message;window.SHOE_QA.error=String(e);}
function saveFile(data,name,type='application/json'){const blob=data instanceof Blob?data:new Blob([data],{type});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function config(){return {...structuredClone(state),source:{repo:'haihao0307/guilin-dem-pipeline',commit:pack.sourceCommit,bodyPack:pack.schema,proportionRevision:currentBody().proportionRevision,sourceModelSha256:pack.sourceModelSha256},units:'millimetre',scope:'static-shoe-design-not-physical-fit'};}
function currentBody(){return pack.bodies.find(b=>b.id===state.person);}
function currentStyle(){return STYLES.find(s=>s.id===state.style);}
function validateConfig(s){if(s.schema!=='kaopu-shoe-config/1'||!STYLES.some(x=>x.id===s.style)||!pack.bodies.some(x=>x.id===s.person)||!MATERIALS[s.material]||!/^#[0-9a-f]{6}$/i.test(s.colour))throw Error('不是兼容的鞋履配置，当前方案未改变');
 if(s.source&&(s.source.commit!==pack.sourceCommit||s.source.sourceModelSha256!==pack.sourceModelSha256))throw Error('人台来源版本不匹配，拒绝覆盖');for(const [k,min,max]of [['toe',5,25],['ease',1,9],['instep',1,12]])if(!Number.isFinite(s.fit?.[k])||s.fit[k]<min||s.fit[k]>max)throw Error('余量参数无效，当前方案未改变');
 if(!['hero','side','front','top','sole','macro'].includes(s.view)||!['studio','wear','person','exploded','measure','last'].includes(s.mode)||!['studio','dark','warm'].includes(s.light))throw Error('未知视图参数');return {...defaults(),...s,fit:{...s.fit},wireframe:!!s.wireframe,xray:!!s.xray,lightAngle:T.MathUtils.clamp(Number(s.lightAngle)||0,-180,180)};
}
function setState(patch,{resetCamera=false}={}){state={...state,...patch,fit:{...state.fit,...(patch.fit||{})}};rebuild();syncUI();if(resetCamera)goCamera('hero');dirty=1;}
function geometryForBody(b){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(b.positions,3));g.setIndex(pack.faces);g.computeVertexNormals();return g;}
function disposeMeasurements(){if(!measurementGroup)return;measurementGroup.traverse(o=>{o.geometry?.dispose();if(o.material){o.material.map?.dispose();o.material.dispose();}});objects.remove(measurementGroup);measurementGroup=null;}
function textSprite(text,pos){const c=document.createElement('canvas');c.width=512;c.height=100;const q=c.getContext('2d');q.fillStyle='#f7f3e8';q.fillRect(0,0,512,100);q.fillStyle='#51432d';q.font='42px sans-serif';q.textAlign='center';q.fillText(text,256,65);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;const s=new T.Sprite(new T.SpriteMaterial({map:t,depthTest:false}));s.position.copy(pos);s.scale.set(.09,.0176,1);s.renderOrder=5;return s;}
function buildMeasurements(b,lift){const group=new T.Group();for(const f of b.feet){for(const [key,col]of [['ball','#9b6030'],['instep','#557c7c']]){const seg=[];for(const pair of f[key].segments)for(const p of pair)seg.push(p[0]+f.ankleX,p[1]+lift,p[2]+f.heelZ);const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(seg,3));group.add(new T.LineSegments(g,new T.LineBasicMaterial({color:col,depthTest:false})));}
 const x=f.ankleX+f.sign*(f.width*.61+.012),y=lift+.005,z=f.heelZ;
 const pts=[V(x,y,z),V(x,y,z+f.length),V(x-.004,y,z+f.length-.006),V(x,y,z+f.length),V(x+.004,y,z+f.length-.006)];group.add(new T.Line(new T.BufferGeometry().setFromPoints(pts),new T.LineBasicMaterial({color:'#74603e',depthTest:false})));
 group.add(textSprite(`${f.side==='L'?'左':'右'} ${Math.round(f.length*1000)} mm`,V(x+f.sign*.02,.13,z+f.length*.6)));
 }return group;}
function rebuild(){
 if(!scene||!pack)return;
 if(model){for(const s of [...model.children])disposeShoe(s);objects.remove(model);}
 if(pal)disposePalette(pal);pal=palette(state.material,state.colour);
 if(state.wireframe)for(const m of Object.values(pal))m.wireframe=true;
 if(state.xray){for(const k of ['skin','lining','edge']){pal[k].transparent=true;pal[k].opacity=.36;pal[k].depthWrite=false;}}
 model=new T.Group();model.name='鞋履装配';objects.add(model);
 const b=currentBody(),style=currentStyle(),bodyMode=['wear','person','measure'].includes(state.mode),sole=style.sole*b.feet[0].length/.261;
 b.feet.forEach((f,i)=>{
  const shoe=createShoe(f,style,pal,state.fit);
  if(bodyMode){shoe.position.set(f.ankleX,0,f.heelZ-.004);}else{shoe.position.set((i===0?1:-1)*.081,0,i===0?-.013:.009);shoe.rotation.y=i===0?-.11:.08;}
  if(state.mode==='exploded'){shoe.position.y=.024;explodeShoe(shoe,1);}
  if(state.mode==='measure')shoe.visible=false;
  if(state.mode==='last'){for(const [k,g]of Object.entries(shoe.userData.components))g.visible=['last','outsole','welt'].includes(k);}
  model.add(shoe);
 });
 if(bodyMesh){objects.remove(bodyMesh);bodyMesh.geometry.dispose();bodyMesh.material.dispose();bodyMesh=null;}
 if(bodyMode){
  bodyMesh=new T.Mesh(geometryForBody(b),new T.MeshPhysicalMaterial({color:state.mode==='measure'?'#b5b3a9':'#b0ada3',roughness:.52,metalness:0,clearcoat:.08,clearcoatRoughness:.45}));bodyMesh.name='同源 Anny 静态人台';bodyMesh.position.y=state.mode==='measure'?0:sole;bodyMesh.castShadow=true;bodyMesh.receiveShadow=true;objects.add(bodyMesh);
 }
 disposeMeasurements();if(state.mode==='measure'){measurementGroup=buildMeasurements(b,0);objects.add(measurementGroup);}
 rebuildCount++;renderer.shadowMap.needsUpdate=true;dirty=1;
}
function updateLight(){const dark=state.light==='dark',warm=state.light==='warm';document.body.classList.toggle('dark-stage',dark);scene.background=new T.Color(dark?'#292b2e':warm?'#d7c6ac':'#e8e5df');scene.getObjectByName('floor').material.color.set(dark?'#292b2e':warm?'#cbbba0':'#d7d4cc');renderer.toneMappingExposure=dark?1.0:warm?.96:1.02;scene.environmentRotation.y=state.lightAngle* Math.PI/180;const key=scene.getObjectByName('keyLight'),a=state.lightAngle* Math.PI/180;key.position.set(-.5*Math.cos(a)+.5*Math.sin(a),1.2,.5*Math.cos(a)+.5*Math.sin(a));key.color.set(warm?'#ffe2b1':'#fff7e8');renderer.shadowMap.needsUpdate=true;dirty=1;}
function goCamera(view='hero'){
 state.view=view;
 const bodyMode=['wear','measure'].includes(state.mode),full=state.mode==='person',exploded=state.mode==='exploded',L=model.children[0]?.userData.S.L||.28;
 let target=V(0,exploded?.087:currentStyle().boot?.108:.052,bodyMode?.08:L*.49),pos;
 if(full){target=V(0,currentBody().height*.48,.025);pos=V(1.1,currentBody().height*.76,2.7);controls.minDistance=.45;controls.maxDistance=5;}
 else{const wide=bodyMode?1.58:currentStyle().boot?1.2:1;const map={hero:[.49,.34,.59],side:[.64,.18,.15],front:[0,.19,.79],top:[.015,.83,.14],sole:[.36,-.57,.43],macro:[.20,.155,.35]};const a=map[view]||map.hero;pos=V(...a).multiplyScalar(wide);if(bodyMode)target.z=.08;if(exploded){pos.y+=.09;target.y+=.017;}if(view==='macro'){target=V(.075,.057,L*.58);pos=target.clone().add(V(.085,.063,.118));}controls.minDistance=.055;controls.maxDistance=2.5;}
 scene.getObjectByName('floor').visible=view!=='sole';camera.position.copy(pos);controls.target.copy(target);controls.update();all('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));dirty=1;
}
function syncUI(){
 const s=currentStyle(),b=currentBody(),f=b.feet[0];$('#style-en').textContent=s.en;$('#style-name').textContent=s.name;$('#style-desc').textContent=s.desc;
 all('.shoe-card').forEach(e=>e.classList.toggle('active',e.dataset.style===s.id));all('[data-person]').forEach(e=>e.classList.toggle('active',e.dataset.person===b.id));all('[data-material]').forEach(e=>e.classList.toggle('active',e.dataset.material===state.material));all('[data-colour]').forEach(e=>e.classList.toggle('active',e.dataset.colour===state.colour));all('[data-mode]').forEach(e=>e.classList.toggle('active',e.dataset.mode===state.mode));all('[data-light]').forEach(e=>e.classList.toggle('active',e.dataset.light===state.light));
 $('#person-note').textContent=`${b.label} · 身高 ${(b.height*100).toFixed(1)} cm`;
 $('#metrics').innerHTML=[['左脚长',f.length*1000],['跖部截面宽',f.ball.width*1000],['跖部截面围',f.ball.girth*1000],['脚背截面围',f.instep.girth*1000]].map(([l,v])=>`<div class="metric"><span>${l}</span><b>${v.toFixed(1)}</b><small>mm</small></div>`).join('');
 $('#material-note').textContent=MATERIALS[state.material].note;$('#colour-name').textContent=COLOURS.find(x=>x[1]===state.colour)?.[0]||state.colour;
 for(const k of ['toe','ease','instep']){$('#'+k).value=state.fit[k];$('#'+k+'-out').textContent=state.fit[k]+' mm';}
 $('#light').value=state.lightAngle;$('#light-out').textContent=state.lightAngle+'°';$('#wireframe').checked=state.wireframe;$('#xray').checked=state.xray;
 const captions={studio:'独立成鞋展示 · 拖动旋转，滚轮缩放',wear:'同源人台上脚 · 静态外观，不是舒适度检验',person:'原生 Anny 身体快照 · 不改写人体形状',exploded:'真实组件拆解 · 外底 / 内衬 / 鞋面 / 五金',measure:'网格截面与足长 · 棕色跖围，青色脚背截面',last:'视觉设计鞋楦 · 不作为制造或医疗数据'};$('#mode-caption').textContent=captions[state.mode];$('#build-label').textContent=VERSION+' · '+buildId.slice(0,7);
 updateLight();
}
function initUI(){
 $('#catalog').innerHTML=STYLES.map((s,i)=>`<button class="shoe-card ${i?'':'active'}" data-style="${s.id}"><img alt="${s.name}的三维渲染缩略图" width="320" height="180"><span class="card-text"><b>${s.name}</b><small>0${i+1}</small></span></button>`).join('');
 $('#persons').innerHTML=pack.bodies.map(b=>`<button data-person="${b.id}">${b.name}</button>`).join('');
 $('#materials').innerHTML=Object.entries(MATERIALS).map(([k,v])=>`<button data-material="${k}">${v.name}</button>`).join('');
 $('#colours').innerHTML=COLOURS.map(([name,c])=>`<button data-colour="${c}" style="background:${c}" title="${name}" aria-label="${name}"></button>`).join('');
 all('[data-style]').forEach(b=>b.onclick=()=>{const s=STYLES.find(x=>x.id===b.dataset.style);setState({style:s.id,material:s.material,colour:s.colour},{resetCamera:true});});
 all('[data-person]').forEach(b=>b.onclick=()=>setState({person:b.dataset.person},{resetCamera:true}));all('[data-material]').forEach(b=>b.onclick=()=>setState({material:b.dataset.material}));all('[data-colour]').forEach(b=>b.onclick=()=>setState({colour:b.dataset.colour}));all('[data-mode]').forEach(b=>b.onclick=()=>setState({mode:b.dataset.mode},{resetCamera:true}));all('[data-view]').forEach(b=>b.onclick=()=>goCamera(b.dataset.view));all('[data-light]').forEach(b=>b.onclick=()=>{state.light=b.dataset.light;syncUI();});
 let timer;for(const k of ['toe','ease','instep'])$('#'+k).oninput=e=>{const value=Number(e.target.value);$('#'+k+'-out').textContent=value+' mm';state.fit[k]=value;clearTimeout(timer);timer=setTimeout(()=>{rebuild();syncUI();},90);};
 $('#light').oninput=e=>{state.lightAngle=Number(e.target.value);$('#light-out').textContent=state.lightAngle+'°';updateLight();};
 $('#wireframe').onchange=e=>setState({wireframe:e.target.checked});$('#xray').onchange=e=>setState({xray:e.target.checked});
 $('#spin').onclick=()=>{rotate=!rotate;$('#spin').classList.toggle('active',rotate);controls.autoRotate=rotate;controls.autoRotateSpeed=.8;dirty=1;};
 $('#save').onclick=()=>{try{localStorage.setItem('kaopu-shoe-r01',JSON.stringify(config()));toast('方案已保存在当前浏览器');}catch{toast('浏览器限制本地保存，请导出配置');}};
 $('#restore').onclick=()=>{try{const s=localStorage.getItem('kaopu-shoe-r01');if(!s)throw Error('当前浏览器没有已保存方案');state=validateConfig(JSON.parse(s));rebuild();syncUI();goCamera();toast('已恢复保存的方案');}catch(e){toast(e.message);}};
 $('#reset').onclick=()=>{state=defaults();rebuild();syncUI();goCamera();toast('已恢复初始鞋款与适配余量');};
 $('#export').onclick=()=>{saveFile(JSON.stringify(config(),null,2),`KAOPU-Shoe-${state.style}-${state.person}-R01.json`);toast('已导出版本化鞋履配置');};
 $('#import').onclick=()=>$('#import-file').click();$('#import-file').onchange=async e=>{try{const f=e.target.files?.[0];if(!f)return;if(f.size>100000)throw Error('配置文件过大');const next=validateConfig(JSON.parse(await f.text()));state=next;rebuild();syncUI();goCamera();toast('配置已导入');}catch(e){toast(e.message);}finally{e.target.value='';}};
 $('#capture').onclick=()=>{renderer.render(scene,camera);renderer.domElement.toBlob(b=>{if(b)saveFile(b,`KAOPU-Shoe-${state.style}-${state.mode}-R01.png`,'image/png');});};
 $('#sources').onclick=()=>$('#source-dialog').showModal();$('#close-dialog').onclick=()=>$('#source-dialog').close();
}
async function loadPack(){
 const embedded=$('#body-data');if(embedded){const data=Uint8Array.from(atob(embedded.textContent.trim()),c=>c.charCodeAt(0));const stream=new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'));return JSON.parse(await new Response(stream).text());}
 const r=await fetch('./assets/body-pack.json');if(!r.ok)throw Error('人台数据缺失');return r.json();
}
function resize(){if(!renderer)return;const r=$('#viewport').getBoundingClientRect();renderer.setPixelRatio(Math.min(devicePixelRatio,2));if(renderer.domElement.width!==Math.round(r.width*renderer.getPixelRatio())||renderer.domElement.height!==Math.round(r.height*renderer.getPixelRatio()))renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();dirty=1;}
function stats(){let triangles=0,vertices=0,invalid=0,meshes=0;const visit=o=>{if(!o.visible)return;if(o.geometry){const a=o.geometry.attributes.position;vertices+=a.count;triangles+=(o.geometry.index?.count||a.count)/3*(o.isInstancedMesh?o.count:1);for(const x of a.array)if(!Number.isFinite(x))invalid++;meshes++;}for(const c of o.children)visit(c);};visit(objects);return {version:VERSION,buildId,ready,thumbReady,mode:state.mode,style:state.style,person:state.person,triangles:Math.round(triangles),vertices,meshes,invalid,rebuildCount,rendered,drawCalls:renderer?.info.render.calls,geometryCount:renderer?.info.memory.geometries,textureCount:renderer?.info.memory.textures,sourceCommit:pack?.sourceCommit,config:config(),shoeDimensions:model?.children.map(s=>s.userData.dimensions),bodyPositionSha:currentBody()?.positionsSha256};}
async function thumbnails(){
 const R=new T.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});R.setSize(340,180);R.setPixelRatio(1);R.outputColorSpace=T.SRGBColorSpace;R.toneMapping=T.ACESFilmicToneMapping;R.toneMappingExposure=1.02;
 const s=new T.Scene();s.environmentIntensity=.72;s.background=new T.Color('#eeeae2');const env=makeEnvironment(R);s.environment=env;const key=new T.DirectionalLight('#fff4de',2.1);key.position.set(-.3,1,.6);s.add(key,new T.HemisphereLight('#ffffff','#655747',1.4));const c=new T.PerspectiveCamera(31,340/180,.001,10);c.position.set(.39,.22,.42);c.lookAt(0,.052,.14);
 for(const style of STYLES){if(style.boot){c.position.set(.46,.29,.48);c.lookAt(0,.102,.14);}else{c.position.set(.39,.22,.42);c.lookAt(0,.052,.14);}const p=palette(style.material,style.colour),shoe=createShoe(pack.bodies[0].feet[0],style,p,defaults().fit);s.add(shoe);R.render(s,c);$(`[data-style="${style.id}"] img`).src=R.domElement.toDataURL('image/webp',.82);s.remove(shoe);disposeShoe(shoe);disposePalette(p);await new Promise(r=>setTimeout(r,20));}
 env.dispose();R.dispose();R.forceContextLoss();thumbReady=true;dirty=1;
}
window.SHOE_QA={ready:false,stats,config,async sourceBodyCheck(){if(!bodyMesh)return {available:false};const a=bodyMesh.geometry.attributes.position.array,buf=await crypto.subtle.digest('SHA-256',a),hash=Array.from(new Uint8Array(buf),b=>b.toString(16).padStart(2,'0')).join('');return {available:true,matches:hash===currentBody().positionsSha256,hash};},setStyle(id){const s=STYLES.find(x=>x.id===id);if(!s)throw Error('Unknown shoe');setState({style:id,material:s.material,colour:s.colour},{resetCamera:true});},setMode(mode){setState({mode},{resetCamera:true});},setPerson(person){setState({person},{resetCamera:true});},setMaterial(material){setState({material});},setFit(fit){setState({fit});},setLight(light){state.light=light;syncUI();},camera:goCamera,validateConfig,render(){renderer.render(scene,camera);},getState(){return structuredClone(state);}};
async function main(){
 pack=await loadPack();
 renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;renderer.debug.checkShaderErrors=true;$('#viewport').appendChild(renderer.domElement);
 scene=new T.Scene();scene.add(objects);scene.environment=makeEnvironment(renderer);scene.environmentIntensity=.72;
 camera=new T.PerspectiveCamera(32,1,.001,20);controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=false;controls.dampingFactor=.085;controls.addEventListener('change',()=>{dirty=1;});controls.maxPolarAngle=Math.PI*.95;
 const floor=new T.Mesh(new T.PlaneGeometry(15,15),new T.MeshStandardMaterial({color:'#d7d4cc',roughness:.96}));floor.name='floor';floor.rotation.x=-Math.PI/2;floor.position.y=-.0006;floor.receiveShadow=true;scene.add(floor);
 const key=new T.DirectionalLight('#fff7e8',2.3);key.name='keyLight';key.position.set(-.5,1.2,.5);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-1.3;key.shadow.camera.right=1.3;key.shadow.camera.top=2.3;key.shadow.camera.bottom=-1;key.shadow.camera.near=.05;key.shadow.camera.far=5;key.shadow.bias=-.00005;key.shadow.normalBias=.00065;key.shadow.radius=3;scene.add(key);
 const fill=new T.DirectionalLight('#e4ebfa',1.0);fill.position.set(.7,.65,-.6);scene.add(fill,new T.HemisphereLight('#fff6e8','#81705b',.65));
 initUI();rebuild();syncUI();resize();goCamera();new ResizeObserver(resize).observe($('#viewport'));
 $('#loading').style.display='none';window.SHOE_QA.ready=ready=true;$('#status').textContent='WebGL2 · 参数化鞋型 / 同源人台 · 静态候选';
 function loop(){requestAnimationFrame(loop);if(document.hidden)return;if(dirty>0||rotate){controls.update();renderer.render(scene,camera);rendered++;dirty--;}}
 loop();await thumbnails();$('#status').textContent='R01.2 · 6 种结构 / 3 位人台 / 5 种材质 · 无外部鞋模';
}
main().catch(fail);
