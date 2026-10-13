/* Independent workbench, camera, lifecycle, rendering and persistence. */
(function(G){
'use strict';const H=G.HAT10,T=G.OwnHatThree,$=id=>document.getElementById(id);
H.build=G.HAT10_BUILD||{source:'LOCAL',version:H.version};
let renderer,scene,camera,lights,envRT,active=null,form=H.defaults(location.hash.slice(1).split('=')[1]||'pinch');
if(!H.categories.some(c=>c.id===form.id))form=H.defaults();
let pendingSpec='',pending=null,serial=0,ready=false,mode='product',view='three',frame=0,spin=false,section=false,wire=false,comparison=null;
let yaw=.58,pitch=.38,distance=.68,target=new T.Vector3(0,.06,0),headGroup=null;
const cache=new Map(),errors=[],clicks=[],metrics={headBuilds:0,ignoredDuplicates:0,generated:0,cacheHits:0,draws:0,shadowPasses:0,workerCancelled:0,workerTimeouts:0,thumbs:0,thumbnailOutput:'display-srgb-tone-mapped',boot:performance.now()};
const workerText=$('own-worker').textContent;
const workerURL=URL.createObjectURL(new Blob([workerText],{type:'text/javascript'}));
const clipping=new T.Plane(new T.Vector3(-1,0,0),0);
function status(t){$('status').textContent=t;}
function shapeKey(s){const n={...s};delete n.detail;delete n.color;delete n.seed;return JSON.stringify(n);}
function dispose(group){group.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();});}
function newWorker(s,lod=0){
 const worker=new Worker(workerURL);let settled=false;
 const promise=new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{if(settled)return;settled=true;worker.terminate();metrics.workerTimeouts++;reject(Error('生成超过时限，已保留当前帽子。'));},8000);
  worker.onmessage=e=>{if(settled)return;settled=true;clearTimeout(timer);worker.terminate();e.data.error?reject(Error(e.data.error)):resolve(e.data);};
  worker.onerror=e=>{if(settled)return;settled=true;clearTimeout(timer);worker.terminate();reject(Error(e.message||'生成线程异常'));};
  worker.postMessage({spec:s,lod});
  worker._stop=()=>{if(settled)return;settled=true;clearTimeout(timer);worker.terminate();reject(Error('selection-cancelled'));};
 });
 return{promise,cancel:()=>worker._stop(),worker};
}
function makeModel(data,s){
 const group=new T.Group(),c=H.categories.find(c=>c.id===s.id);
 for(const p of data.pieces){
  const geom=new T.BufferGeometry();geom.setAttribute('position',new T.BufferAttribute(p.position,3));geom.setAttribute('normal',new T.BufferAttribute(p.normal,3));geom.setAttribute('uv',new T.BufferAttribute(p.uv,2));geom.setIndex(new T.BufferAttribute(p.index,1));
  const materials=p.groups.map(g=>H.makeMaterial(c,s,g.role));p.groups.forEach((g,i)=>geom.addGroup(g.start,g.count,i));
  const mesh=new T.Mesh(geom,materials);mesh.name=p.name;mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
 }
 group.userData={data,surface:{color:s.color,detail:s.detail,seed:s.seed}};return group;
}
function appearance(group,s){
 const c=H.categories.find(c=>c.id===s.id);
 group.traverse(o=>{if(!o.material)return;for(const m of o.material){
  const role=m.userData.role,col=new T.Color(s.color||c.color);
  if(role==='trim')col.set(c.trim);if(role==='lining')col.set('#59564e');if(role==='thread')col.lerp(new T.Color('#c5bcab'),.28);if(role==='underbrim')col.multiplyScalar(.92);
  m.color.copy(col);if(m.userData.uniforms){m.userData.uniforms.ownDetail.value=s.detail;m.userData.uniforms.ownSeed.value=(c.seed+s.seed)*.017;}
  m.wireframe=wire;m.clippingPlanes=section?[clipping]:null;
 }});
}
function evict(){let bytes=[...cache.values()].reduce((a,x)=>a+x.data.stats.bytes,0);for(const[k,r]of cache){if(cache.size<=11&&bytes<=32*1024*1024)break;if(r===active)continue;cache.delete(k);bytes-=r.data.stats.bytes;dispose(r.group);}}
function dirty(){renderer.shadowMap.needsUpdate=true;drawSoon();}
function drawSoon(){if(frame)return;frame=requestAnimationFrame(()=>{frame=0;draw();});}
function draw(){if(!renderer||!active)return;if(frame){cancelAnimationFrame(frame);frame=0;}camera.position.set(target.x+distance*Math.sin(yaw)*Math.cos(pitch),target.y+distance*Math.sin(pitch),target.z+distance*Math.cos(yaw)*Math.cos(pitch));camera.lookAt(target);if(renderer.shadowMap.needsUpdate)metrics.shadowPasses++;renderer.render(scene,camera);metrics.draws++;if(spin&&!document.hidden){yaw+=.009;drawSoon();}}
function frameView(v='three'){
 view=v;const b=active?.data.bounds||{min:[-.16,0,-.16],max:[.16,.18,.16]},h=b.max[1]-b.min[1],w=Math.max(b.max[0]-b.min[0],b.max[2]-b.min[2]);
 target.set(0,mode==='fit'?-.025:(b.max[1]+b.min[1])*.5,0);distance=mode==='fit'?.84:Math.max(.50,w*2.00,h*2.90);
 const poses={three:[.58,.38],front:[0,.14],side:[Math.PI/2,.08],back:[Math.PI,.12],top:[0,1.51],inside:[.15,-1.18]};[yaw,pitch]=poses[v]||poses.three;
 if(v==='inside'){headGroup.visible=false;floor.visible=false;}else{headGroup.visible=mode==='fit';floor.visible=true;}
 $('part-label').textContent=v==='inside'?'内衬 / 闭合帽檐 / 实体厚度':mode==='fit'?'程序化测试头 · 静态量配':'独立产品视图';
 dirty();
}
function makeHead(s){
 const p=[],idx=[],N=72,M=60,head=H.headShape(s),bump=(v,c,w)=>Math.exp(-(((v-c)/w)**2));
 for(let j=0;j<=M;j++)for(let i=0;i<=N;i++){
  const t=i/N*Math.PI*2,y=-.185+.285*j/M,cs=Math.cos(t),sn=Math.sin(t);
  let r=y>=-.025?H.headRadius(y):Math.sqrt(Math.max(.00005,1-((y+.027)/.16)**2))*1.02;
  let x=head.a*r*sn,z=head.b*r*cs;
  if(y<0){const forward=Math.max(cs,0)**16;z+=forward*(.027*bump(y,-.079,.025)-.009*bump(y,-.052,.011)+.006*bump(y,-.031,.012)+.005*bump(y,-.126,.014));x*=1-.13*bump(y,-.151,.038);}
  p.push(x,y,z);
 }
 for(let j=0;j<M;j++)for(let i=0;i<N;i++){const a=j*(N+1)+i,b=a+1,c=a+N+1;idx.push(a,b,c+1,a,c+1,c);}
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(p,3));geometry.setIndex(idx);geometry.computeVertexNormals();
 const mat=new T.MeshStandardMaterial({color:'#b6b0a3',roughness:.82});const g=new T.Group(),face=new T.Mesh(geometry,mat);face.castShadow=true;face.receiveShadow=true;g.add(face);
 for(const side of [-1,1]){const ear=new T.Mesh(new T.SphereGeometry(1,20,16),mat.clone());ear.scale.set(.010,.025,.013);ear.position.set(side*(head.a+.003),-.071,-.008);ear.castShadow=true;g.add(ear);}
 const neck=new T.Mesh(new T.CylinderGeometry(.038,.057,.080,40),mat.clone());neck.position.y=-.218;neck.castShadow=true;g.add(neck);
 return g;
}
let floor,headKey='';
function replaceHead(){
 const key=JSON.stringify([form.head,form.circumference]);
 if(!headGroup||key!==headKey){if(headGroup){scene.remove(headGroup);dispose(headGroup);}headGroup=makeHead(form);headKey=key;metrics.headBuilds++;scene.add(headGroup);}
 headGroup.visible=mode==='fit';floor.position.y=mode==='fit'?-.265:active.data.bounds.min[1]-.011;
}
async function select(s,reason='selection'){
 try{s=H.sanitize(s);}catch(e){status(e.message);return false;}
 const intent=JSON.stringify(s);if(pending&&pendingSpec===intent){metrics.ignoredDuplicates++;return false;}pendingSpec=intent;
 const token=++serial,t0=performance.now();if(pending){pending.cancel();pending=null;metrics.workerCancelled++;}
 ready=false;status('正在按自有参数谱生成…');$('cancel').hidden=false;
 const key=shapeKey(s);let record=cache.get(key),hit=!!record;
 try{
  if(record){cache.delete(key);cache.set(key,record);metrics.cacheHits++;}
  else{
   pending=newWorker(s);const data=await pending.promise;if(token!==serial)return false;
   pending=null;metrics.generated++;record={data,group:makeModel(data,s)};cache.set(key,record);
  }
  if(token!==serial)return false;
  if(active)scene.remove(active.group);active=record;form=s;appearance(record.group,s);scene.add(record.group);replaceHead();evict();
  ready=false;$('cancel').hidden=true;frameView(view);draw();if(errors.some(e=>e.startsWith('shader:')))throw Error('材质编译失败，不能作为已就绪帽子。');ready=true;
  const dt=performance.now()-t0;clicks.push({id:s.id,reason,cacheHit:hit,readyMS:dt,generationMS:record.data.stats.generationMS});if(clicks.length>300)clicks.shift();
  const c=H.categories.find(c=>c.id===s.id);$('hat-name').textContent=c.name;$('design').textContent=c.design;$('description').textContent=c.summary;
  $('triangles').textContent=record.data.stats.triangles.toLocaleString();$('weight').textContent=(record.data.stats.bytes/1048576).toFixed(2)+' MiB';
  $('fit-note').textContent='帽口按 '+s.circumference.toFixed(1)+' cm / '+H.heads.find(h=>h.id===s.head).name+' 生成；静态松量 '+s.ease.toFixed(1)+' mm。'+(record.data.stats.heightFitClamped?' 冠高已受头顶安全空间约束。':'');
  status((hit?'复用自有几何':'自有谱生成')+' · 准备 '+Math.round(dt)+' ms · 材质已就绪');
  syncUI();location.hash='hat='+s.id;return true;
 }catch(e){if(token!==serial||e.message==='selection-cancelled')return false;pending=null;ready=!!active&&!errors.some(e=>e.startsWith('shader:'));$('cancel').hidden=true;status(e.message);errors.push(e.message);return false;}
}
function cancel(){serial++;if(pending){pending.cancel();pending=null;metrics.workerCancelled++;}ready=!!active;$('cancel').hidden=true;status('已取消，保留上一顶帽子。');}
function syncUI(){for(const k of Object.keys(H.parameters)){const e=$('p-'+k);if(e)e.value=form[k];updateLabel(k);}if($('head'))$('head').value=form.head;$('color').value=form.color||H.categories.find(c=>c.id===form.id).color;document.querySelectorAll('.hat-card').forEach(e=>e.setAttribute('aria-pressed',String(e.dataset.id===form.id)));}
function updateLabel(k){const el=$('o-'+k);if(!el)return;const v=Number($('p-'+k).value);el.textContent=k==='circumference'?v.toFixed(1)+' cm':k==='ease'?v.toFixed(1)+' mm':k==='detail'?v.toFixed(2):v.toFixed(2)+' ×';}
function saveFile(name,text,type='application/json'){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}
async function thumbnails(){
 // R102: the same display framebuffer applies ACES and sRGB, unlike raw linear target bytes.
 const tc=new T.PerspectiveCamera(36,220/146,.005,4),ts=new T.Scene();
 ts.background=scene.background.clone();ts.environment=scene.environment;ts.environmentIntensity=scene.environmentIntensity;
 for(const source of [scene.children.find(o=>o.isHemisphereLight),lights.key,lights.fill]){const light=source.clone();light.castShadow=false;ts.add(light);} 
 for(const c of H.categories){
  while(pending)await new Promise(r=>setTimeout(r,120));await new Promise(r=>setTimeout(r,50));
  try{
   const w=newWorker(H.defaults(c.id),1),data=await w.promise,model=makeModel(data,H.defaults(c.id));ts.add(model);
   const h=data.bounds.max[1]-data.bounds.min[1],wide=Math.max(data.bounds.max[0]-data.bounds.min[0],data.bounds.max[2]-data.bounds.min[2]),d=Math.max(.56,wide*2.2,h*3.4);tc.position.set(d*.52,d*.38+(data.bounds.max[1]+data.bounds.min[1])/2,d*.80);tc.lookAt(0,(data.bounds.max[1]+data.bounds.min[1])/2,0);
   const was=renderer.getRenderTarget(),size=renderer.getSize(new T.Vector2());
   const cn=document.createElement('canvas');cn.width=220;cn.height=146;
   try{renderer.setRenderTarget(null);renderer.setSize(220,146,false);renderer.render(ts,tc);cn.getContext('2d').drawImage(renderer.domElement,0,0,220,146);}
   finally{renderer.setSize(size.x,size.y,false);renderer.setRenderTarget(was);draw();}
   document.querySelector(`.hat-card[data-id="${c.id}"] img`).src=cn.toDataURL('image/webp',.84);metrics.thumbs++;ts.remove(model);dispose(model);dirty();
  }catch(e){errors.push('thumbnail '+c.id+': '+e.message);}
 }
 // No extra renderer, render target or persistent thumbnail GPU geometry is retained.
}
function boot(){
 const canvas=$('canvas');renderer=new T.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true,alpha:false,powerPreference:'high-performance'});
 renderer.debug.checkShaderErrors=true;renderer.debug.onShaderError=(gl,program,vs,fs)=>{const text='shader: '+[gl.getProgramInfoLog(program),gl.getShaderInfoLog(vs),gl.getShaderInfoLog(fs)].filter(Boolean).join(' | ');errors.push(text);console.error(text);};
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.16;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;renderer.localClippingEnabled=true;
 scene=new T.Scene();scene.background=new T.Color('#deded7');camera=new T.PerspectiveCamera(36,1,.003,10);
 envRT=H.makeEnvironment(renderer);scene.environment=envRT.texture;scene.environmentIntensity=.70;
 const hemi=new T.HemisphereLight('#fff9ef','#727469',1.35);scene.add(hemi);
 const key=new T.DirectionalLight('#fff4e5',3.4);key.position.set(-.55,.65,.65);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-.45;key.shadow.camera.right=.45;key.shadow.camera.top=.5;key.shadow.camera.bottom=-.45;key.shadow.camera.near=.02;key.shadow.camera.far=2.8;key.shadow.bias=-.0001;key.shadow.normalBias=.0005;scene.add(key);
 const fill=new T.DirectionalLight('#e1ecf1',1.0);fill.position.set(.5,.24,-.6);scene.add(fill);lights={key,fill};
 floor=new T.Mesh(new T.PlaneGeometry(4,4),new T.MeshStandardMaterial({color:'#d1d0c7',roughness:.93}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
 const resize=()=>{const r=canvas.parentElement.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();drawSoon();};new ResizeObserver(resize).observe(canvas.parentElement);resize();
 let down=null;
 canvas.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener('pointermove',e=>{if(!down)return;yaw-=(e.clientX-down.x)*.008;pitch=Math.max(-1.5,Math.min(1.5,pitch+(e.clientY-down.y)*.006));down={x:e.clientX,y:e.clientY};drawSoon();});
 const up=()=>down=null;canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);canvas.addEventListener('wheel',e=>{e.preventDefault();distance=Math.max(.23,Math.min(2,distance*Math.exp(e.deltaY*.001)));drawSoon();},{passive:false});
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();ready=false;status('图形上下文丢失，请重新载入；已保存的配方不会删除。');});
 window.addEventListener('error',e=>errors.push(e.message));document.addEventListener('visibilitychange',()=>{if(!document.hidden)drawSoon();});
 const cards=$('catalogue');for(const c of H.categories){const button=document.createElement('button');button.className='hat-card';button.dataset.id=c.id;button.innerHTML=`<img alt="${c.name}三维缩略图"><span>${c.name}</span><small>${c.design.split(' · ')[0]}</small>`;button.onclick=()=>select({...H.defaults(c.id),head:form.head,circumference:form.circumference},'card');cards.append(button);}
 $('head').innerHTML=H.heads.map(h=>`<option value="${h.id}">${h.name}</option>`).join('');$('head').onchange=()=>select({...form,head:$('head').value},'head');
 const labels={circumference:'头围',height:'帽冠高度',brim:'帽檐尺度',fullness:'冠体饱满度',thickness:'实体厚度',ease:'帽口松量',detail:'表面细节'};
 for(const[k,r]of Object.entries(H.parameters)){
  const row=document.createElement('label');row.className='parameter';row.innerHTML=`<span>${labels[k]}<output id="o-${k}"></output></span><input id="p-${k}" type="range" min="${r[0]}" max="${r[1]}" step="${k==='circumference'||k==='ease'?.1:.01}" value="${r[2]}">`;$('parameters').append(row);
  $('p-'+k).oninput=()=>{updateLabel(k);if(k==='detail'&&active){form.detail=Number($('p-detail').value);appearance(active.group,form);drawSoon();}};
  $('p-'+k).onchange=()=>{if(k!=='detail')select({...form,[k]:Number($('p-'+k).value)},'parameter');};
 }
 $('color').oninput=()=>{if(!active)return;form.color=$('color').value;appearance(active.group,form);drawSoon();};
 $('view-mode').onchange=()=>{mode=$('view-mode').value;if(active){replaceHead();frameView('three');}};
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{if(active)frameView(b.dataset.view);});
 $('rotate').onclick=()=>{spin=!spin;$('rotate').setAttribute('aria-pressed',spin);drawSoon();};
 $('section').onclick=()=>{if(!active)return;section=!section;$('section').setAttribute('aria-pressed',section);appearance(active.group,form);dirty();};
 $('wire').onclick=()=>{if(!active)return;wire=!wire;$('wire').setAttribute('aria-pressed',wire);appearance(active.group,form);drawSoon();};
 $('light').onchange=()=>{const rake=$('light').value==='raking';lights.key.position.set(rake?-.6:-.55,rake?.10:.65,.65);lights.fill.intensity=rake?.35:1;dirty();};
 $('reset').onclick=()=>select(H.defaults(form.id),'reset');$('cancel').onclick=cancel;
 $('variant').onclick=()=>select({...form,height:.87+Math.random()*.30,brim:.78+Math.random()*.45,fullness:.94+Math.random()*.14,seed:Math.floor(Math.random()*9999)},'variant');
 $('save').onclick=()=>{try{localStorage.setItem('kaopu-owned-hat-spectrum-v1',JSON.stringify(form));status('自有配方已保存。');}catch(e){status('浏览器拒绝保存，请使用导出配方。');}};
 $('load').onclick=()=>{try{const text=localStorage.getItem('kaopu-owned-hat-spectrum-v1');if(!text)throw Error('暂无自有配方');select(H.sanitize(JSON.parse(text)),'restore');}catch(e){status(e.message);}};
 $('export').onclick=()=>saveFile('kaopu-hat-'+form.id+'.json',JSON.stringify(form,null,2));
 $('import').onclick=()=>$('import-file').click();$('import-file').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>100000)throw Error('配方文件过大');await select(H.sanitize(JSON.parse(await f.text())),'import');}catch(e){status('配方未应用：'+e.message);}finally{e.target.value='';}};
 $('clear').onclick=()=>{for(const[k,r]of cache){if(r!==active){dispose(r.group);cache.delete(k);}}status('已释放闲置几何；当前帽子与保存配方保留。');};
 $('compare').onclick=()=>{if(!comparison){comparison={...form};select(H.defaults(form.id),'compare-default');$('compare').textContent='返回我的调整';}else{select(comparison,'compare-return');comparison=null;$('compare').textContent='初始配方对照';}};
 $('version').textContent='R10.2 · '+String(H.build.source).slice(0,10);
 select(form,'boot').then(ok=>{if(ok){metrics.bootReadyMS=performance.now()-metrics.boot;setTimeout(thumbnails,800);}});
 G.ownedHat={version:H.version,source:H.build.source,diagnostics:()=>({renderer:renderer.getContext().getParameter(renderer.getContext().RENDERER),three:T.REVISION,drawCalls:renderer.info.render.calls,programCount:renderer.info.programs.length,gpuGeometries:renderer.info.memory.geometries}),ready:()=>ready,recipe:()=>({...form}),set:patch=>select({...form,...patch},'api'),restore:s=>select(s,'restore-api'),frame:frameView,cancel,stats:()=>({metrics:{...metrics},clicks:[...clicks],cacheSize:cache.size,cacheBytes:[...cache.values()].reduce((a,x)=>a+x.data.stats.bytes,0),current:active?.data.stats,errors:[...errors],thumbs:metrics.thumbs}),geometry:()=>active?.data,render:()=>{draw();return canvas.toDataURL('image/png');},clear:()=>{$('clear').click();},hash:()=>{let h=2166136261;for(const p of active.data.pieces){const b=new Uint8Array(p.position.buffer);for(const v of b){h^=v;h=Math.imul(h,16777619);}}return(h>>>0).toString(16);}};
}
try{boot();}catch(e){errors.push(e.message);status('启动失败：'+e.message);console.error(e);}
})(globalThis);
