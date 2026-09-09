/* Inspection UI for the same full-body surface. No duplicate shoulder actor. */
class ShoulderWorkbench {
 constructor(lab){
  this.lab=lab;this.h=lab.human;this.active=false;this.playing=false;this.busy=false;this.clock=0;this.mode='clay';this.lastView='threequarter';this.side='both';this.surfaceRevision=2;
  this.draft={...(this.h.shoulderShape||SHOULDER_SHAPE_DEFAULT)};
  this.pose={abduction:4,flexion:0,twist:0,elbow:7};this.makeUI();
  lab.renderer.canvas.addEventListener('webglcontextlost',()=>{this.stop();this.status('图形上下文已丢失。请关闭其他高负载页面，再重新打开本页。当前参数仍可导出。',true);});
 }
 makeUI(){
  const labels={deltoidFullness:'三角肌包覆',upperArmWidth:'上臂粗细',bicepsVolume:'上臂前侧体积',tricepsVolume:'上臂后侧体积',clavicleRelief:'锁骨表面起伏',axillaryFold:'腋褶体积',girdleSetback:'肩带后收',posteriorShoulderDepth:'肩后侧深度'};
  const control=(key,label,lo,hi,value,group,step)=>`<label class="sh-control"><span>${label}<small>${group==='pose'?'度':'倍数'}</small></span><div><input type="range" data-sh-${group}="${key}" min="${lo}" max="${hi}" step="${step}" value="${value}"><input type="number" aria-label="${label}" data-sh-${group}="${key}" min="${lo}" max="${hi}" step="${step}" value="${value}"></div></label>`;
  const el=document.createElement('section');el.id='sh-root';el.hidden=true;
  el.innerHTML=`<header class="sh-top"><div><small>JARVIS / ANATOMY STUDIO</small><strong>肩带、锁骨与上臂 <em>V1.16.0</em></strong></div><button id="sh-close">返回原场景</button></header>
  <div class="sh-heading"><small>02 / SHOULDER GIRDLE</small><h1>肩胸两层结构</h1><p>固定结构基底 · 可变软组织 · 正侧背对照</p></div>
  <aside class="sh-panel"><div class="sh-lock">手掌 · 手腕 · 前臂 <b>V1.12.1 已固定</b><p>本轮只改变肩带绑定位置、肩胸过渡和近端上臂；已固定局部形状不重做。</p></div>
   <details open><summary>形体参数</summary><div>${Object.entries(labels).map(([k,label])=>control(k,label,...SHOULDER_SHAPE_LIMITS[k],this.draft[k],'shape',.01)).join('')}</div>
   <div class="sh-actions"><button id="sh-apply" class="sh-primary">应用形体</button><button id="sh-reset">恢复默认</button></div><p class="sh-note">默认骨架已采用 V1.16 肩带后收基线。这里的倍率只做有限微调，不改变肱骨、前臂或手部骨长。</p></details>
   <details open><summary>活动检查</summary><select id="sh-side" aria-label="检查侧别"><option value="both">双侧同步</option><option value="right">右侧</option><option value="left">左侧</option></select>
   <div class="sh-presets">${[['rest','自然垂臂'],['a','A 姿态'],['side','侧抬 80°'],['reach','前伸 75°'],['bend','屈肘'],['high','斜上举']].map(([k,l])=>`<button data-sh-preset="${k}">${l}</button>`).join('')}</div>
   ${[['abduction','手臂侧抬',0,105],['flexion','手臂前抬',-20,105],['twist','上臂旋转',-35,35],['elbow','肘部弯曲',0,115]].map(([k,l,a,b])=>control(k,l,a,b,this.pose[k],'pose',1)).join('')}
   <button id="sh-play">播放连续活动检查</button><p class="sh-note">活动只移动基底所属骨骼；软层在基底外压缩、拉伸和滑移，腋窝保留过渡区。</p></details>
   <details><summary>结构依据与数据</summary><p class="sh-note">参照 OpenStax 肩带结构、NIH 3D 腋区骨骼模型与 Visible Human 上肢三维重建研究。外部模型只作三维关系与轮廓参考，没有导入任何网格。</p><button id="sh-export">导出肩臂参数 JSON</button><button id="sh-import">导入参数</button><input id="sh-file" type="file" accept=".json,application/json" hidden></details>
  </aside><nav class="sh-tools">${[['front','正面'],['side','侧面'],['back','背面'],['threequarter','斜侧'],['full','全身']].map(([k,l])=>`<button data-sh-view="${k}">${l}</button>`).join('')}<span></span>${[['clay','灰模'],['skin','肤色'],['structure','硬基底'],['support','支撑体'],['bones','骨骼']].map(([k,l])=>`<button data-sh-mode="${k}">${l}</button>`).join('')}</nav>
  <footer class="sh-status"><span id="sh-status">R5：肩线抬高、腋窝与上臂过渡修正，等待你进行活动与视觉复查。</span><span id="sh-stats"></span></footer>`;
  document.body.append(el);this.root=el;
  this.sync=(group,key,v)=>el.querySelectorAll(`[data-sh-${group}="${key}"]`).forEach(i=>i.value=v);
  el.querySelectorAll('[data-sh-shape],[data-sh-pose]').forEach(input=>input.addEventListener('input',()=>{const group=input.dataset.shShape?'shape':'pose',key=input.dataset.shShape||input.dataset.shPose,v=Number(input.value);if(!Number.isFinite(v)||v<Number(input.min)||v>Number(input.max))return;this.sync(group,key,v);if(group==='shape')this.draft[key]=v;else{this.stop();this.pose[key]=v;this.applyPose();}}));
  el.querySelectorAll('[data-sh-preset]').forEach(b=>b.onclick=()=>this.setPreset(b.dataset.shPreset));
  el.querySelectorAll('[data-sh-view]').forEach(b=>b.onclick=()=>this.view(b.dataset.shView));
  el.querySelectorAll('[data-sh-mode]').forEach(b=>b.onclick=()=>{this.mode=b.dataset.shMode;this.render();});
  $('sh-side').onchange=()=>{this.side=$('sh-side').value;this.applyPose();};$('sh-close').onclick=()=>this.leave();
  $('sh-apply').onclick=()=>this.applyShape(this.draft).catch(e=>this.status(e.message,true));
  $('sh-reset').onclick=()=>this.applyShape({...SHOULDER_SHAPE_DEFAULT}).catch(e=>this.status(e.message,true));
  $('sh-play').onclick=()=>{if(this.playing)this.stop();else{this.clock=0;this.playing=true;$('sh-play').textContent='停止活动检查';auto=true;needsRedraw=true;}};
  $('sh-export').onclick=()=>hfDownload('shoulder-shape-v2.json',JSON.stringify(this.exportShape(),null,2),'application/json');
  $('sh-import').onclick=()=>$('sh-file').click();$('sh-file').onchange=async e=>{try{const f=e.target.files[0];if(!f||f.size>65536)throw Error('参数文件过大或为空');const d=JSON.parse(await f.text());if(!['jarvis/shoulder_shape@1','jarvis/shoulder_shape@2'].includes(d.schema))throw Error('不支持此肩臂参数格式');await this.applyShape(d.parameters);}catch(error){this.status(error.message,true)}finally{e.target.value=''}};
  const open=document.createElement('button');open.id='sh-open';open.textContent='肩膀与上臂';open.onclick=()=>this.enter();document.body.append(open);
  $('hf-open').onclick=()=>{if(this.active)this.leave();this.lab.hands.enter();};
 }
 status(text,error=false){$('sh-status').textContent=text;$('sh-status').style.color=error?'#9c372e':'';}
 enter(){
  if(this.active)return this.report();const w=this.lab.hands;if(w.active)w.leave();
  this.savedScope=w.scope;this.savedMode=w.mode;w.enter();w.stop();w.scope='body';w.root.hidden=true;
  this.active=true;this.root.hidden=false;document.body.classList.add('shoulder-studio');
  this.lab.setAuto(false);this.setPreset('rest');this.view('threequarter');this.status('正在检查锁骨、肩峰、三角肌包覆和肩胸接缝。');return this.report();
 }
 leave(){if(!this.active)return;this.stop();this.active=false;this.root.hidden=true;document.body.classList.remove('shoulder-studio');const w=this.lab.hands;w.scope=this.savedScope;w.mode=this.savedMode;w.leave();}
 stop(){this.playing=false;$('sh-play').textContent='播放连续活动检查';}
 setPreset(name){this.stop();const presets={rest:[4,0,0,7],a:[28,0,0,5],side:[80,0,0,7],reach:[8,75,0,15],bend:[12,0,0,100],high:[95,25,12,12]};if(!presets[name])throw Error('未知肩臂姿态');[this.pose.abduction,this.pose.flexion,this.pose.twist,this.pose.elbow]=presets[name];for(const[k,v]of Object.entries(this.pose))this.sync('pose',k,v);this.applyPose();return this.report();}
 applyPose(renderNow=true){
  const h=this.h,p=this.pose;h.pose({position:h.root.p.slice(),time:0});
  for(const side of ['left','right']){
   if(this.side!=='both'&&this.side!==side)continue;
   const a=h.arms[side],s=a.s,sh=h.shoulders[side],target=qm(qz(s*p.abduction*DEG),qm(qx(-p.flexion*DEG),qy(s*p.twist*DEG)));
   const dir=rotate(target,[0,-1,0]),raising=clamp(Math.atan2(Math.hypot(dir[0],dir[2]),-dir[1])/2.3,0,1);
   sh.sc.q=qm(qz(s*raising*.14),qy(-s*raising*.08));sh.ac.q=qm(qz(s*raising*.17),qx(-raising*.06));h.fk();
   a.upper.q=qm(inv(a.upper.parent.world.q),qm(h.root.q,target));a.elbow.q=qx(-p.elbow*DEG);a.radial.q=qy(-s*78*DEG);a.wrist.q=qi();
  }
  h.constraints.enforceAll();h.fk();h.tissue.update(this.clock,0);needsRedraw=true;if(renderNow)this.render();
 }
 tick(dt){if(!this.active||!this.playing||this.busy)return;this.clock+=dt;const t=this.clock*Math.PI/8;this.pose={abduction:4+76*(.5-.5*Math.cos(t)),flexion:32*Math.sin(t)*Math.sin(t),twist:10*Math.sin(t),elbow:7+65*(.5-.5*Math.cos(t*1.5))};this.applyPose(false);}
 view(name){this.lastView=name;const r=this.lab.renderer,h=this.h;r.projection='orthographic';r.target=add(h.root.p,[0,name==='full'?.01:.405,.025]);r.distance=3;r.orthoHeight=name==='full'?1.95:.76;r.yaw=name==='side'?Math.PI/2:name==='back'?Math.PI:name==='threequarter'?.62:0;r.pitch=name==='threequarter'?.045:0;this.render();}
 render(){if(!this.active)return;const t=this.h.tissue,r=this.lab.renderer;r.studioMode=true;r.background=[.79,.82,.83];r.quality='fast';r.overlayLines=false;let items;
  if(this.mode==='bones'){items=this.h.bones;for(const b of items)b.visible=true;}
  else if(this.mode==='structure'||this.mode==='support'){items=this.mode==='structure'?t.structure.parts:t.structure.supports;for(const b of items)b.visible=true;}
  else {items=this.mode==='skin'?[t.skin,...t.details]:[t.clay,...t.clayDetails];for(const b of items)b.visible=true;}
  r.render(items,[]);const b=this.h.tissue.shoulderSurfaceReport;$('sh-stats').textContent=`绑定 rev ${this.h.proportionRevision} · 骨长误差 ${(this.h.diagnostics().maxBoneLengthErrorM*1000).toFixed(4)} mm${b?' · R5 腋窝与颈肩':''}`;
  this.root.querySelectorAll('[data-sh-view]').forEach(x=>x.classList.toggle('is-active',x.dataset.shView===this.lastView));this.root.querySelectorAll('[data-sh-mode]').forEach(x=>x.classList.toggle('is-active',x.dataset.shMode===this.mode));
 }
 async applyShape(input){
  const next=validateShoulderShape(input);if(this.lab.renderer.gl.isContextLost())throw Error('图形上下文已丢失，请重新打开本页后应用参数');if(!this.active)throw Error('请先打开肩臂工作台');if(this.busy)throw Error('请等待上一次形体重建完成');this.stop();this.busy=true;$('sh-apply').disabled=true;this.status('正在从固定绑定基线重新计算肩带曲面。');await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,20)));
  const before={shape:this.h.shoulderShape,tissue:this.h.tissue};const started=performance.now();
  try{this.h.shoulderShape=next;const tissue=new ProceduralTissue(this.h);this.h.tissue=tissue;this.lab.tissue=tissue;renderer.setTissue(tissue);renderer.lastItems=[];this.lab.hands.cache={};this.lab.hands.cachedGeometry=null;this.surfaceRevision++;this.draft={...next};for(const[k,v]of Object.entries(next))this.sync('shape',k,v);this.applyPose();if(renderer.gl.isContextLost())throw Error('形体数据已计算，但图形上下文丢失，请重新打开页面');this.status('肩带曲面已重建，用时 '+((performance.now()-started)/1000).toFixed(1)+' 秒。');return this.report();}
  catch(e){this.h.shoulderShape=before.shape;this.h.tissue=before.tissue;this.lab.tissue=before.tissue;renderer.setTissue(before.tissue);this.applyPose();throw e;}
  finally{this.busy=false;$('sh-apply').disabled=false;}
 }
 exportShape(){return {schema:'jarvis/shoulder_shape@2',surfaceRevision:this.surfaceRevision,proportionRevision:this.h.proportionRevision,parameters:{...(this.h.shoulderShape||SHOULDER_SHAPE_DEFAULT)},frozenHandBaseline:'1.12.1',boneLengthsChanged:false,bindingBaseline:{scOffsetM:[...ADULT_RIG.scOffsetM],clavicleVectorM:[...ADULT_RIG.clavicleVectorM],shoulderOffsetM:[...ADULT_RIG.shoulderOffsetM]}};}
 report(){return {version:'1.16.0',active:this.active,pose:{...this.pose},shape:this.exportShape(),surface:this.h.tissue.shoulderSurfaceReport,layers:{foundation:this.h.tissue.structure.report,soft:this.h.tissue.shoulderLayerReport},handParameters:{...this.h.handShape},constraintAudit:this.h.constraints.audit(),maxBoneLengthErrorM:this.h.diagnostics().maxBoneLengthErrorM};}
}
