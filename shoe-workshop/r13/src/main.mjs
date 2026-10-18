import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {buildStyle,STYLES} from './model.mjs';
import {DEFAULTS,validateParams} from './kernel.mjs';
import {StyleMaterials} from './materials.mjs';
import {unpackGeometry} from '../../r10/src/Pack.mjs';
import {Materials as LegacyMaterials} from '../../r10/src/Materials.mjs';
import {PRESETS,recipe as legacyRecipe} from '../../r10/src/Presets.mjs';
import {deformGeometry} from '../../r10/src/Shape.mjs';

const $=q=>document.querySelector(q),OLD='https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/cafab0889b612ed6cbf461683dfe2851909df3be/shoe-workshop/r10/public-lite.html';
const REF_IMAGES={
 penny:'https://cdn.shopify.com/s/files/1/0283/3917/5496/files/Boston28363A-C01C11.jpg?v=1691595791',
 chelsea:'https://cdn.shopify.com/s/files/1/0421/2421/4440/files/Chelsea825887A-C01C11_ba4df9c7-0f43-4003-91e2-9ee0585babae.jpg?v=1729065012',
 monk:'https://cdn.shopify.com/s/files/1/0469/2911/7347/files/Lowndes25170A-C01L11_db49d2d1-feca-4362-bf3f-2ed90dba2c18.jpg?v=1729254967',
 canvas:'https://www.superga.com/cdn/shop/files/UBS000010___999_d3c7bca7-9afa-4ce1-8696-691b5ea749b9.jpg?v=1781714904&width=1080'
};
const legacyStyle={id:'original',name:'原款 · R10',english:'ORIGINAL DERBY',tag:'原款结构与 12 组材料配方保留',colors:{upper:'#805638'},reference:OLD,features:['保留原 R10 完整鞋体','原分片皮革与包边','原鞋眼、连续针路与外底','12 组材料配方仍可切换']};
let state={schema:'kaopu/shoe-style@1',style:'penny',params:{...DEFAULTS},pair:false,compare:false,explode:false,clay:false,wire:false,section:false,seams:true,part:'all',legacyPreset:'P01',view:'hero'},current=[],group,legacy=null;
const stats={errors:[],changes:0,draws:0,generationMs:0,bootMs:0};
const start=performance.now();
function notice(s){$('#status').textContent=s;}
async function payload(id){const el=document.getElementById(id),bytes=Uint8Array.from(atob(el.textContent.trim()),c=>c.charCodeAt(0)),text=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();el.remove();return JSON.parse(text);}
const safeExternal=url=>window.open(url,'_blank','noopener,noreferrer');

async function boot(){
 const scan=await payload('scan-data'),canvas=$('#canvas'),stage=$('#stage'),renderer=new T.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.localClippingEnabled=true;
 const scene=new T.Scene();scene.background=new T.Color('#e9e8e0');const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment();scene.environment=pmrem.fromScene(room,.05).texture;scene.environmentIntensity=.58;room.dispose();pmrem.dispose();
 const camera=new T.PerspectiveCamera(31,1,.005,30),orbit=new OrbitControls(camera,canvas);orbit.enableDamping=false;orbit.minDistance=.10;orbit.maxDistance=4;
 const key=new T.DirectionalLight('#fff1d8',3.4);key.position.set(-.65,1.0,.85);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-.85,right:.85,top:.85,bottom:-.85,near:.05,far:4});key.shadow.camera.updateProjectionMatrix();key.shadow.bias=-.000025;key.shadow.normalBias=.00012;scene.add(key,key.target);
 const fill=new T.DirectionalLight('#d8e6f3',1.15);fill.position.set(.8,.45,-.6);scene.add(fill,new T.HemisphereLight('#f7f9ef','#817760',.75));
 const bottomLight=new T.DirectionalLight('#fffae8',2.0);bottomLight.position.set(.4,-.7,.6);bottomLight.visible=false;scene.add(bottomLight);
 const floor=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshStandardMaterial({color:'#e9e8e1',roughness:1}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
 const materials=new StyleMaterials(renderer,scan);await materials.init();let oldMaterials=null,frame=null;
 const clipPlane=new T.Plane(new T.Vector3(-1,0,0),0);
 function render(){if(frame!==null)return;frame=requestAnimationFrame(()=>{frame=null;renderer.render(scene,camera);stats.draws++;});}
 orbit.addEventListener('change',render);
 function disposeGroup(g){if(!g)return;const geometries=new Set(),legacyMats=new Set();g.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);if(o.userData.legacyOwned)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>legacyMats.add(m));}});for(const a of geometries)a.dispose();for(const m of legacyMats){if(m.userData?.r10PrivateMaps){m.map?.dispose();m.normalMap?.dispose();}m.dispose();}g.removeFromParent();}
 function disposeLegacyMaterials(){if(!oldMaterials)return;const textures=new Set();for(const fabric of oldMaterials.fabrics.values())for(const texture of Object.values(fabric))if(texture?.isTexture)textures.add(texture);for(const texture of textures)texture.dispose();oldMaterials.fabrics.clear();oldMaterials.dispose();oldMaterials=null;}
 function applyClip(material){material.clippingPlanes=state.section?[clipPlane]:[];material.clipShadows=state.section;return material;}
 function meshFrom(d,style){
  let mats;if(d.geometry.groups.length){const roles=['rubber','elastic','webbing','edge','metal'].includes(d.role)?[d.role,d.role,d.role]:[d.role,'lining','cut'];mats=roles.map(role=>applyClip(materials.get(role,style,state)));}else mats=applyClip(materials.get(d.role,style,state));
  const m=new T.Mesh(d.geometry,mats);m.name=d.id;m.castShadow=m.receiveShadow=true;m.userData={...d,geometry:undefined,style:style.id};return m;
 }
 async function makeOriginal(){
  if(!legacy){const pack=await payload('shoe-data');legacy={...pack,meshes:pack.meshes.map(({geometry,...d})=>({...d,geometry:unpackGeometry(geometry)}))};}
  if(!state.clay&&!oldMaterials){oldMaterials=new LegacyMaterials(renderer,scan);await oldMaterials.init();}
  const p=PRESETS.find(p=>p.id===state.legacyPreset)||PRESETS[0],g=new T.Group();
  for(const d of legacy.meshes){const geo=deformGeometry(d.geometry,p.fit);let mat=state.clay?materials.get(d.kind==='sole'?'rubber':'leather',STYLES[0],state):oldMaterials.get(d,p);for(const m of(Array.isArray(mat)?mat:[mat])){m.wireframe=state.wire;applyClip(m);}const m=new T.Mesh(geo,mat);m.name=d.id;m.userData={...d,geometry:undefined,legacyOwned:!state.clay,name:d.id,style:'original'};m.castShadow=m.receiveShadow=true;g.add(m);}
  if(!state.clay){const partLeather=Object.fromEntries(legacy.meshes.filter(d=>d.kind==='part').map(d=>{const [id]=legacyRecipe(d.partId,p);return[d.partId,['canvas','denim','herringbone'].includes(id)?'heritage':id];}));oldMaterials.prepare({leatherId:'heritage',materialSet:'uniform',partLeather});}
  g.updateMatrixWorld(true);const b=new T.Box3().setFromObject(g),c=b.getCenter(new T.Vector3());for(const m of g.children)m.geometry.translate(-c.x,-b.min.y,-c.z);
  return {group:g,report:{id:'original',preservedSource:'cafab0889b612ed6cbf461683dfe2851909df3be',triangles:g.children.reduce((n,m)=>n+m.geometry.index.count/3,0),measuredBoundsMm:b.getSize(new T.Vector3()).toArray(),parts:g.children.map(m=>({id:m.name,name:m.name,kind:m.userData.kind}))}};
 }
 function visibility(){if(!group)return;group.traverse(o=>{if(!o.isMesh)return;const d=o.userData,thread=d.kind==='seam'||d.kind==='thread';o.visible=(!thread||state.seams)&&(state.part==='all'||d.id===state.part);const E=state.explode?(d.explode??[0,20,0]):[0,0,0];o.position.set(...E);});}
 function visibleBox(){const box=new T.Box3();group.updateMatrixWorld(true);group.traverse(o=>{if(o.isMesh&&o.visible)box.expandByObject(o);});if(box.isEmpty())box.setFromObject(group);return box;}
 function view(name){state.view=name;if(!group)return;const b=visibleBox(),c=b.getCenter(new T.Vector3()),size=b.getSize(new T.Vector3());let d=Math.max(size.y,size.x/camera.aspect,size.z*.77)/(2*Math.tan(camera.fov*Math.PI/360))*1.38;
  const dirs={hero:[.72,.69,1.04],side:[1,.1,.0],front:[0,.25,1],back:[.08,.23,-1],top:[0,1,.0001],bottom:[0,-1,.0001],detail:[.6,.65,1],join:[1,.4,.7]};
  if(name==='detail'){d*=.62;c.z+=size.z*.12;c.y+=size.y*.05;}
  if(name==='join'&&!state.compare&&state.part==='all'){
   d*=.35;
   if(state.style==='penny'){c.y=b.min.y+size.y*.36;c.z=b.min.z+size.z*.85;dirs.join=[.55,.85,.8];}
   else if(state.style==='chelsea'){c.x+=size.x*.24;c.y=b.min.y+size.y*.46;c.z=b.min.z+size.z*.31;dirs.join=[1,.22,.36];}
   else if(state.style==='monk'){c.x+=size.x*.28;c.y=b.min.y+size.y*.66;c.z=b.min.z+size.z*.43;dirs.join=[1,.6,.55];}
   else if(state.style==='canvas'){c.x+=size.x*.22;c.y=b.min.y+size.y*.33;c.z=b.min.z+size.z*.70;dirs.join=[1,.45,.75];}
  }
  camera.up.set(0,1,0);if(name==='top')camera.up.set(0,0,-1);if(name==='bottom')camera.up.set(0,0,1);camera.position.copy(c).addScaledVector(new T.Vector3(...(dirs[name]??dirs.hero)).normalize(),d);camera.near=Math.max(.002,d*.015);camera.far=15;camera.updateProjectionMatrix();orbit.target.copy(c);orbit.update();floor.position.y=b.min.y-.0007;floor.visible=name!=='bottom'&&!state.explode;bottomLight.visible=name==='bottom';
  document.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view===name));render();
 }
 function currentStyle(){return state.style==='original'?legacyStyle:STYLES.find(s=>s.id===state.style);}
 function updateReference(){const style=currentStyle(),el=$('#reference-image');el.hidden=state.style==='original';if($('#reference-panel').open&&REF_IMAGES[style.id]&&el.getAttribute('src')!==REF_IMAGES[style.id])el.src=REF_IMAGES[style.id];}
 function ui(){const s=currentStyle();$('#style-title').textContent=state.compare?'四种结构 · 同场对照':s.name;$('#style-en').textContent=state.compare?'FOUR STRUCTURAL FAMILIES':s.english;$('#style-desc').textContent=state.compare?'左后：乐福 · 右后：切尔西 · 左前：双搭扣 · 右前：帆布':s.tag;$('#feature-list').innerHTML=(state.compare?STYLES.map(s=>s.name+'：'+s.features[0]):s.features).map(x=>'<li>'+x+'</li>').join('');
  document.querySelectorAll('[data-style]').forEach(b=>b.classList.toggle('active',b.dataset.style===state.style&&!state.compare));
  for(const k of['explode','clay','wire','section','seams','compare'])$('#'+k).classList.toggle('active',state[k]);$('#single').classList.toggle('active',!state.pair);$('#pair').classList.toggle('active',state.pair);$('#pair').disabled=state.compare;
  for(const k of Object.keys(DEFAULTS)){const v=state.params[k];$('#'+k).value=v;$('#'+k+'-value').textContent=k==='length'||k==='width'?(100*v).toFixed(1)+'%':k==='bend'?v+'°':v.toFixed(k==='thickness'?2:1)+' mm';$('#'+k).disabled=state.style==='original';}
  const r=current.find(r=>r.id===state.style)||current[0];$('#dimensions').textContent=r?'外形 '+r.measuredBoundsMm.map(n=>n.toFixed(1)).join(' × ')+' mm（宽 × 高 × 长）':'';$('#geometry-stat').textContent=(current.reduce((n,r)=>n+r.triangles,0)*(state.pair&&!state.compare?2:1)/1000).toFixed(0)+'k 三角形 · 按需绘制';$('#stage-mode').textContent=state.explode?'厚裁片拆件':state.section?'截面检查':state.clay?'灰模结构':'成鞋检查';
  $('#part-select').innerHTML='<option value="all">全部部件</option>'+(r?.parts??[]).map(d=>'<option value="'+d.id+'">'+(d.name||d.id)+'</option>').join('');$('#part-select').value=state.part;$('#legacy-controls').hidden=state.style!=='original';$('#legacy-preset').value=state.legacyPreset;$('#build-label').textContent='R13 · '+__BUILD_ID__.slice(0,10);$('#part-label').textContent=state.part==='all'?'':($('#part-select').selectedOptions[0]?.textContent??'');updateReference();
 }
 async function change(next,{fit=true}={}){
  state={...state,...next,params:validateParams({...state.params,...next.params})};if(![...STYLES.map(s=>s.id),'original'].includes(state.style))throw Error('无效鞋款');state.part=next.part??'all';notice('正在生成独立裁片…');const t=performance.now(),candidate=new T.Group();candidate.name='SHOE_R13';current=[];
  const ids=state.compare?STYLES.map(s=>s.id):[state.style];
  for(let i=0;i<ids.length;i++){
   const id=ids[i],foot=new T.Group();let data;
   if(id==='original'){data=await makeOriginal();for(const m of [...data.group.children])foot.add(m);}else{data=buildStyle(id,state.params);for(const d of data.parts)foot.add(meshFrom(d,data.style));}
   current.push(data.report);foot.scale.setScalar(.001);foot.userData.style=id;foot.name=id;
   if(state.compare){foot.position.set((i%2-.5)*.235,0,(Math.floor(i/2)-.5)*.405);foot.rotation.y=.08;}else if(state.pair){foot.position.x=.069;const other=foot.clone(true);other.scale.x=-.001;other.position.x=-.069;candidate.add(other);}
   candidate.add(foot);
  }
  const previous=group;group=candidate;scene.add(group);disposeGroup(previous);if(!ids.includes('original')||state.clay)disposeLegacyMaterials();visibility();ui();if(fit)view(state.view);else render();stats.changes++;stats.generationMs=performance.now()-t;notice(state.style==='original'?'原 R10 鞋体已保留载入；新款在左侧选择':'已生成 · 尺寸、裁片、连接和闭合件来自同一鞋楦');
 }
 let operation=Promise.resolve();function queue(fn){operation=operation.then(fn).catch(e=>{stats.errors.push(String(e));notice('未完成：'+e.message);console.error(e);});return operation;}
 $('#styles').innerHTML=[...STYLES,legacyStyle].map((s,i)=>'<button class="style-button" data-style="'+s.id+'"><span class="number">'+(i===4?'—':String(i+1).padStart(2,'0'))+'</span><span><b>'+s.name+'</b><small>'+s.english+'</small></span><i class="chip" style="background:'+s.colors.upper+'"></i></button>').join('');
 $('#styles').onclick=e=>{const b=e.target.closest('[data-style]');if(b)queue(()=>change({style:b.dataset.style,compare:false,part:'all',view:'hero',params:{...DEFAULTS},explode:false,section:false}));};
 $('#compare').onclick=()=>queue(()=>change({compare:!state.compare,style:state.style==='original'?'penny':state.style,part:'all',view:'hero',explode:false,section:false}));
 for(const k of Object.keys(DEFAULTS)){$('#'+k).oninput=e=>{$('#'+k+'-value').textContent=k==='length'||k==='width'?(100*Number(e.target.value)).toFixed(1)+'%':e.target.value+(k==='bend'?'°':' mm');};$('#'+k).onchange=e=>{const value=Number(e.target.value);queue(()=>change({params:{...state.params,[k]:value}},{fit:false}));};}
 for(const k of['clay','wire','section'])$('#'+k).onclick=()=>queue(()=>change({[k]:!state[k],compare:k==='section'?false:state.compare,pair:k==='section'?false:state.pair},{fit:false}));
 for(const k of['explode','seams'])$('#'+k).onclick=()=>{state[k]=!state[k];visibility();ui();if(k==='explode')view(state.view);else render();};
 $('#single').onclick=()=>queue(()=>change({pair:false}));$('#pair').onclick=()=>queue(()=>change({pair:true,section:false}));document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>view(b.dataset.view));$('#reset-camera').onclick=()=>view('hero');
 $('#part-select').onchange=e=>{state.part=e.target.value;visibility();$('#part-label').textContent=state.part==='all'?'':e.target.selectedOptions[0].textContent;$('#part-note').textContent=state.part==='all'?'选择部件后可单独查看。':'当前仅显示该部件，可观察内外层与切边。';view(state.view);};
 $('#legacy-preset').innerHTML=PRESETS.map(p=>'<option value="'+p.id+'">'+p.id+' '+p.name+'</option>').join('');$('#legacy-preset').onchange=e=>queue(()=>change({legacyPreset:e.target.value}));
 $('#save').onclick=()=>{localStorage.setItem('kaopu-shoe-r13',JSON.stringify(state));notice('配方已保存');};$('#restore').onclick=()=>queue(()=>{const saved=localStorage.getItem('kaopu-shoe-r13');if(!saved)throw Error('暂无保存的配方');return change(JSON.parse(saved));});
 $('#export').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({...state,sourceCommit:__BUILD_ID__,measurements:current.map(r=>({id:r.id,boundsMm:r.measuredBoundsMm}))},null,2)],{type:'application/json'}));a.download='KAOPU-Shoe-R13-'+state.style+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);notice('JSON 配方已导出');};
 $('#reset').onclick=()=>queue(()=>change({params:{...DEFAULTS},part:'all',explode:false,clay:false,wire:false,section:false,seams:true,view:'hero'}));$('#old-workbench').onclick=()=>safeExternal(OLD);$('#previous-workbench').onclick=()=>safeExternal('https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/d27ef0f200257741fa67f1c6291418cf771443e9/shoe-workshop/r12/public-lite.html');$('#reference-link').onclick=()=>safeExternal(currentStyle().reference);$('#reference-panel').ontoggle=updateReference;
 const resize=new ResizeObserver(()=>{const b=stage.getBoundingClientRect();renderer.setSize(b.width,b.height,false);camera.aspect=b.width/b.height;camera.updateProjectionMatrix();if(group)view(state.view);});resize.observe(stage);
 const hash=new URLSearchParams(location.hash.slice(1));if(STYLES.some(s=>s.id===hash.get('style')))state.style=hash.get('style');
 await change({});$('#loading').hidden=true;stats.bootMs=performance.now()-start;
 window.SHOE_R13={ready:true,source:__BUILD_ID__,base:'fd6c7ca5a338f85ae6c6152b2b23ccf126687c5d',renderer,scene,camera,group:()=>group,state:()=>structuredClone(state),report:()=>({version:'R13.0',source:__BUILD_ID__,stats:{...stats},state:structuredClone(state),current:structuredClone(current),materials:materials.report(),capabilities:{proceduralStyles:4,legacyPreserved:true,coreNetworkRequired:false,manufacturing:false,physicalSolver:false,wearerFit:false}}),select:id=>queue(()=>change({style:id,compare:false,part:'all',params:{...DEFAULTS},explode:false,section:false,view:'hero'})),set:next=>queue(()=>change(next)),view,idle:async()=>{await operation;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));}};
}
boot().catch(e=>{stats.errors.push(String(e));$('#loading').innerHTML='<strong>未完成加载</strong><small></small>';$('#loading small').textContent=e.message;notice('无法运行三维：'+e.message);console.error(e);});
