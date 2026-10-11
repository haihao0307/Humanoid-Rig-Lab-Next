import '../../r02/src/main.mjs';
import * as T from 'three';
import * as K from './edge-kernel.mjs';
const $=s=>document.querySelector(s),f=(v,n=2)=>Number(v).toFixed(n);
const wait=setInterval(()=>{if(window.SHOE_R02?.ready){clearInterval(wait);try{install(window.SHOE_R02);}catch(e){$('#loading').hidden=false;$('#loading').textContent='R03 校准启动失败：'+e.message;console.error(e);}}},30);
function install(A){
 const data=A.data;let state=K.propose(data,A.exportState().lastDeltaPercent),active=false,pick=null,down=null,mark=.5,wire=false,report,meshes=[],maps={};
 const colors={a:'#14746c',b:'#b96936'},oldMode=A.mode;
 const button=document.createElement('button');button.id='edge-station';button.innerHTML='<b>06</b><span>原片配缝校准<small>R03-A · 真边界／方向／误差</small></span>';$('#modes').append(button);button.onclick=()=>activate();
 document.querySelector('.head-title span').textContent='R03 · A';document.title='KAOPU 鞋履研究台 · R03-A 原片配缝校准';
 document.querySelector('.left h1').innerHTML='原裁片配缝，<br>先把关系做清楚。';document.querySelector('.left .lead').textContent='保留原工程五个工位。本轮新增沿边定位、方向反转与毫米误差；原片不变，上楦关系仍待核准。';
 const edgeInput=document.createElement('input');edgeInput.type='file';edgeInput.accept='.json,application/json';edgeInput.hidden=true;edgeInput.id='edge-file';document.body.append(edgeInput);
 function say(text){$('#toast').textContent=text;$('#toast').style.display='block';clearTimeout(say.timer);say.timer=setTimeout(()=>$('#toast').style.display='none',5000);}
 function write(name,text){const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function clear(){const gs=new Set(),ms=new Set(),tx=new Set();A.root.traverse(o=>{if(o.geometry)gs.add(o.geometry);for(const m of (Array.isArray(o.material)?o.material:[o.material]).filter(Boolean)){ms.add(m);if(m.map)tx.add(m.map);}});A.root.clear();for(const g of gs)g.dispose();for(const m of ms)m.dispose();for(const t of tx)t.dispose();}
 function line(points,color){const g=new T.BufferGeometry().setFromPoints(points),o=new T.Line(g,new T.LineBasicMaterial({color,depthTest:true}));A.root.add(o);return o;}
 function label(text,p,color){const c=document.createElement('canvas');c.width=512;c.height=96;const ctx=c.getContext('2d');ctx.fillStyle='rgba(255,252,245,0.94)';ctx.fillRect(0,0,512,96);ctx.fillStyle=color;ctx.font='bold 48px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,48);const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;const s=new T.Sprite(new T.SpriteMaterial({map:texture,depthTest:false,depthWrite:false,toneMapped:false}));s.scale.set(112,21,1);s.position.copy(p);s.userData.labelTexture=texture;A.root.add(s);}
 function draw(fit=false){
  report=K.audit(data,state,A.exportState().lastDeltaPercent);clear();meshes=[];maps={};A.root.position.set(0,0,0);
  const selected=['a','b'].map(k=>data.panels.find(p=>p.objectIndex===state[k].panelId));
  const widths=selected.map(p=>p.bbox[1][0]-p.bbox[0][0]),gap=65,total=widths[0]+widths[1]+gap;
  for(const [i,k] of ['a','b'].entries()){
   const p=selected[i],min=p.bbox[0],max=p.bbox[1],cx=(min[0]+max[0])/2,cy=(min[1]+max[1])/2,dx=i===0?-total/2+widths[0]/2:total/2-widths[1]/2,th=max[2]-min[2];
   const toWorld=q=>new T.Vector3(q[0]-cx+dx,th+.25,-(q[1]-cy));maps[k]={toWorld,cx,cy,dx,z0:min[2],th};
   const pos=[];for(let j=0;j<p.positions.length;j+=3)pos.push(p.positions[j]-cx+dx,p.positions[j+2]-min[2],-(p.positions[j+1]-cy));
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(p.indices);g.computeVertexNormals();
   const mesh=new T.Mesh(g,new T.MeshStandardMaterial({color:k==='a'?'#b6c5b9':'#d5b997',roughness:.78,side:T.DoubleSide,wireframe:wire}));mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.calibrationSide=k;mesh.name='R03_NATIVE_P'+p.objectIndex;A.root.add(mesh);meshes.push(mesh);
   for(const footprint of p.footprints)for(const loop of [footprint.outer,...footprint.holes]){const pts=loop.map(toWorld);if(pts[0].distanceTo(pts.at(-1))>.00001)pts.push(pts[0].clone());line(pts,'#65665c');}
   const b=K.getBoundary(data,state[k]);const edge=line(K.edgePolyline(b,state[k]).map(toWorld),colors[k]);edge.name='R03_EDGE_'+k;
   const ballG=new T.SphereGeometry(.9,10,7),ballM=new T.MeshBasicMaterial({color:colors[k]});
   for(const m of report.marks){const dot=new T.Mesh(ballG,ballM);dot.position.copy(toWorld(m[k]));dot.name='R03_MARK_'+k+'_'+m.id;A.root.add(dot);}
   const h=new T.Mesh(new T.SphereGeometry(2.6,14,10),new T.MeshBasicMaterial({color:'#d8a62e'}));h.position.copy(toWorld(K.edgePoint(b,state[k],mark))).add(new T.Vector3(0,.6,0));h.name='R03_CURSOR_'+k;A.root.add(h);
   const mid=toWorld(K.edgePoint(b,state[k],.5)),ahead=toWorld(K.edgePoint(b,state[k],Math.min(.52,1))),dir=ahead.clone().sub(mid).normalize();
   if(dir.lengthSq()>.1){const arrow=new T.ArrowHelper(dir,mid,13,colors[k],4,2);arrow.position.y+=.6;A.root.add(arrow);}
   label(k.toUpperCase()+' · P'+p.objectIndex+' · '+f(th)+' mm',new T.Vector3(dx,th+3,(max[1]-min[1])/2+17),colors[k]);
   for(const [t,suffix]of [[0,'起'],[1,'止']]){const q=toWorld(K.edgePoint(b,state[k],t));q.z-=12;label(k.toUpperCase()+suffix,q,colors[k]);}
  }
  const a=A.root.getObjectByName('R03_CURSOR_a').position,b=A.root.getObjectByName('R03_CURSOR_b').position;const link=line([a,b],'#cba64d');link.name='R03_CORRESPONDENCE_ONLY';
  if(fit)A.setCamera('top');A.render();numbers();
 }
 function metric(id,name,unit='mm'){return `<div class="metric"><span>${name}</span><strong id="e-${id}"></strong><small>${unit}</small></div>`;}
 function inspector(){
  const choices=k=>data.panels.map(p=>`<option value="${p.objectIndex}" ${state[k].panelId===p.objectIndex?'selected':''}>P${p.objectIndex} · ${p.layer}</option>`).join('');
  let h='<p class="small">默认是按几何寻找的候选边，不是已确认的鞋缝。点「起点／终点」后，在对应原片外轮廓上点击。</p>';
  for(const k of ['a','b'])h+=`<section class="edge-side"><b style="color:${colors[k]}">${k.toUpperCase()} 边</b><select aria-label="${k.toUpperCase()} 原裁片" data-edge-panel="${k}">${choices(k)}</select><div class="pill-row"><button data-pick="${k}:start">选起点</button><button data-pick="${k}:end">选终点</button><button data-reverse="${k}">反转方向</button></div><details><summary>沿原边界的精确位置</summary>${['start','end'].map(t=>`<label>${t==='start'?'起点':'终点'} <output id="e-v-${k}-${t}">${f(state[k][t]*100,1)}%</output><input aria-label="${k} ${t}" type="range" min="0" max="99.9" step=".1" value="${state[k][t]*100}" data-edge-side="${k}" data-edge-end="${t}"></label>`).join('')}</details></section>`;
  h+='<div class="section-heading">实际边长与定位点</div>'+metric('a','A 实际边长')+metric('b','B 实际边长')+metric('diff','B − A 长度差')+metric('ratio','相对长度差','%')+metric('count','每边定位点','个')+`<label>目标定位间距 <output id="e-v-pitch">${f(state.pitchMm,1)} mm</output><input id="edge-pitch" aria-label="目标定位间距" type="range" min="1" max="12" step=".1" value="${state.pitchMm}"></label>`+metric('pitchA','A 实际间距')+metric('pitchB','B 实际间距')+'<label>对应位置 <output id="edge-mark-value"></output><input id="edge-mark" aria-label="对应位置" type="range" min="0" max="1" step=".01" value="'+mark+'"></label><p class="small">点沿真实边界弧长排布。黄色线只连接两边的同序定位点，不是已经生成的缝线。</p><button class="wide" id="edge-propose">重新生成未确认候选</button>';
  $('#inspect-title').textContent='原片边界与配缝候选';$('#inspect-body').innerHTML=h;numbers();
 }
 function numbers(){if(!active||!report)return;const values={a:f(report.aLengthMm),b:f(report.bLengthMm),diff:f(report.differenceMm),ratio:f(report.relativeDifferencePercent),count:report.marks.length,pitchA:f(report.pitchAmm),pitchB:f(report.pitchBmm)};for(const [k,v]of Object.entries(values))if($('#e-'+k))$('#e-'+k).textContent=v;
  for(const k of ['a','b'])for(const t of ['start','end'])if($('#e-v-'+k+'-'+t))$('#e-v-'+k+'-'+t).textContent=f(state[k][t]*100,1)+'%';
  if($('#e-v-pitch'))$('#e-v-pitch').textContent=f(state.pitchMm,1)+' mm';if($('#edge-mark-value'))$('#edge-mark-value').textContent=f(mark*100,0)+'%';
  $('#model-subtitle').textContent=`A ${f(report.aLengthMm)} mm / B ${f(report.bLengthMm)} mm · 差 ${f(report.differenceMm)} mm · 两片均为原始网格`;
  $('#gate-state').textContent=report.lastStale||report.lastDeformed?'鞋楦变化：原片不可视为已适配':'配缝候选未核准 · 禁止转为成鞋';
  $('#gate-detail').textContent='已有：真实边段、方向、毫米边长和同序定位点。仍缺：楦面对应、工艺语义、缝份、材料方向、绷楦与碰撞求解。';
  $('#station-status').textContent=pick?'请点 '+pick.side.toUpperCase()+' 边'+(pick.target==='start'?'起点':'终点'):'R03-A · 仅边界校准';
 }
 function activate(){active=true;oldMode('panels');button.classList.add('active');document.querySelectorAll('[data-mode]').forEach(b=>b.classList.remove('active'));$('#station-kicker').textContent='06 / NATIVE EDGE CALIBRATION';$('#station-title').textContent='原裁片配缝校准';$('#model-label').textContent='真实 CAD 裁片 · A / B 候选边';$('#boundary-note').textContent='实线与定位点来自原裁片外轮廓。配准、折叠、缝份和绷楦尚未实现；不能由这张配缝候选推断一双鞋已经做成。';$('#camera-hint').textContent='拖动旋转 · 滚轮缩放 · 选起止点后点击原片边缘';draw(true);inspector();}
 const deactivate=()=>{active=false;pick=null;button.classList.remove('active');};
 A.mode=name=>{deactivate();oldMode(name);};$('#modes').addEventListener('click',e=>{if(e.target.closest('[data-mode]'))deactivate();},true);
 function commit(next,rebuildInspector=false){try{const validated=K.validate(data,next);K.audit(data,validated,A.exportState().lastDeltaPercent);state=validated;draw();if(rebuildInspector)inspector();return true;}catch(e){say('校准未改动：'+e.message);return false;}}
 $('#inspect-body').addEventListener('click',e=>{if(!active)return;const p=e.target.closest('[data-pick]'),r=e.target.closest('[data-reverse]');if(p){const [side,target]=p.dataset.pick.split(':');pick={side,target};numbers();}if(r){const next=structuredClone(state);next[r.dataset.reverse]=K.reverseEdge(next[r.dataset.reverse]);commit(next,true);}if(e.target.id==='edge-propose'){state=K.propose(data,A.exportState().lastDeltaPercent);pick=null;draw(true);inspector();say('几何候选已重置；不是工艺认证。');}});
 $('#inspect-body').addEventListener('change',e=>{if(!active||!e.target.dataset.edgePanel)return;const k=e.target.dataset.edgePanel,id=Number(e.target.value),next=structuredClone(state);const p=data.panels.find(p=>p.objectIndex===id);next[k]={panelId:id,component:0,...K.suggestEdge(K.boundary(p.footprints[0].outer))};if(k==='b')next[k]=K.reverseEdge(next[k]);if(commit(next,true))draw(true);else inspector();});
 $('#inspect-body').addEventListener('input',e=>{if(!active)return;const el=e.target;if(el.id==='edge-mark'){mark=Number(el.value);draw();return;}const next=structuredClone(state);if(el.id==='edge-pitch')next.pitchMm=Number(el.value);else if(el.dataset.edgeSide)next[el.dataset.edgeSide][el.dataset.edgeEnd]=Number(el.value)/100;else return;if(!commit(next))inspector();});
 $('#canvas').addEventListener('pointerdown',e=>down=[e.clientX,e.clientY]);$('#canvas').addEventListener('pointerup',e=>{
  if(!active||!pick||!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;
  const r=$('#canvas').getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),A.camera);
  A.scene.updateMatrixWorld(true);const hit=ray.intersectObjects(meshes).find(h=>h.object.userData.calibrationSide===pick.side);if(!hit){say('请点击 '+pick.side.toUpperCase()+' 原片上的外边缘。');return;}
  const m=maps[pick.side],q=[hit.point.x+m.cx-m.dx,m.cy-hit.point.z],b=K.getBoundary(data,state[pick.side]),c=K.closest(b,q);if(c.distance>12){say('离外边缘太远；请靠近真实裁片外轮廓。');return;}
  const next=structuredClone(state);next[pick.side][pick.target]=(c.arcMm/b.length)%1;if(commit(next,true)){pick=null;numbers();}
 });
 for(const id of ['save','restore','export','import','reset','wire','overlay']){const original=$('#'+id).onclick;$('#'+id).onclick=e=>{
  if(!active)return original?.(e);try{
   if(id==='save'){localStorage.setItem('kaopu-shoe-r03-edge',JSON.stringify(state));say('配缝候选已保存；没有保存为合格成鞋。');}
   if(id==='restore'){const s=localStorage.getItem('kaopu-shoe-r03-edge');if(!s)throw Error('没有本机校准记录');commit(JSON.parse(s),true);}
   if(id==='export')write('KAOPU_SHOE_R03_EDGE_CANDIDATE.json',JSON.stringify({ ...state },null,2));
   if(id==='import')edgeInput.click();
   if(id==='reset'){original?.(e);state=K.propose(data,A.exportState().lastDeltaPercent);activate();}
   if(id==='wire'){wire=!wire;draw();}
   if(id==='overlay')say('本工位显示的就是只读原片，没有另造替代轮廓。');
  }catch(err){say(err.message);}
 };}
 edgeInput.onchange=async()=>{try{const file=edgeInput.files[0];if(!file)return;if(file.size>200000)throw Error('校准 JSON 超过 200 KB，已拒绝');if(commit(JSON.parse(await file.text()),true))say('校准已验证并导入。');}catch(e){say('拒绝导入：'+e.message);}finally{edgeInput.value='';}};
 window.SHOE_R03={ready:true,version:'R03-A',buildId:A.buildId,activate,exportState:()=>structuredClone(state),importState:s=>{const next=K.validate(data,s);state=next;activate();},report:()=>({...K.audit(data,state,A.exportState().lastDeltaPercent),active}),reverse:k=>{if(!['a','b'].includes(k))throw Error('未知边');const n=structuredClone(state);n[k]=K.reverseEdge(n[k]);commit(n,true);},sourceCheck:()=>meshes.map(mesh=>{const k=mesh.userData.calibrationSide,m=maps[k],p=data.panels.find(p=>p.objectIndex===state[k].panelId),v=mesh.geometry.attributes.position.array;let error=0;for(let i=0;i<v.length;i+=3)error=Math.max(error,Math.hypot(v[i]+m.cx-m.dx-p.positions[i],m.cy-v[i+2]-p.positions[i+1],v[i+1]+m.z0-p.positions[i+2]));return{panelId:p.objectIndex,sourceVertices:p.positions.length/3,displayVertices:v.length/3,sourceTriangles:p.indices.length/3,displayTriangles:mesh.geometry.index.count/3,indicesEqual:Array.from(mesh.geometry.index.array).every((v,i)=>v===p.indices[i]),sourceHoles:p.footprints.reduce((a,f)=>a+f.holes.length,0),maxBufferErrorMm:error};}),pickState:()=>pick};
 activate();
}
