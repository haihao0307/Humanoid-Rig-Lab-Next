/* Local inspection of the full character. Six shape variables, one surface. */
class HeadNeckWorkbench {
 constructor(lab){
  this.lab=lab;this.h=lab.human;this.active=false;this.busy=false;this.playing=false;this.clock=0;this.mode='skin';this.lastView='threequarter';this.surfaceRevision=1;
  this.draft={...(this.h.headNeckShape||HEAD_NECK_SHAPE_DEFAULT)};this.pose={yaw:0,pitch:0,roll:0};this.makeUI();
  lab.renderer.canvas.addEventListener('webglcontextlost',()=>{this.stop();this.status('图形上下文丢失，请关闭其他高负载页面后重新打开。参数仍可导出。',true)});
 }
 makeUI(){
  const labels={neckWidth:'颈部宽度',frontDepth:'前颈厚度',backDepth:'后颈厚度',scmDefinition:'胸锁乳突肌起伏',submentalFullness:'下颌下软组织',napeFullness:'枕颈过渡体积'};
  const control=(key,label,lo,hi,value,group,step)=>`<label class="hn-control"><span>${label}<small>${group==='pose'?'度':'倍率'}</small></span><div><input type="range" data-hn-${group}="${key}" min="${lo}" max="${hi}" step="${step}" value="${value}"><input type="number" aria-label="${label}" data-hn-${group}="${key}" min="${lo}" max="${hi}" step="${step}" value="${value}"></div></label>`;
  const el=document.createElement('section');el.id='hn-root';el.hidden=true;
  el.innerHTML=`<header class="hn-top"><div><small>JARVIS / ANATOMY STUDIO</small><strong>头部与颈部 <em>V1.15.0</em></strong></div><button id="hn-close">返回原场景</button></header>
   <div class="hn-heading"><small>03 / HEAD & NECK</small><h1>头颈支撑与连接</h1><p>同一份人物表皮 · 旋转观察 · 参数受控</p></div>
   <aside class="hn-panel"><div class="hn-lock">已认可局部继续保留<b>手与前臂 V1.12.1 · 肩臂 V1.13.0</b><p>仅修改头颈与颈根连接区。颈椎绑定已校正为版本 2，姿态操作保持当前骨长。</p></div>
   <details open><summary>头颈形体</summary>${Object.entries(labels).map(([k,l])=>control(k,l,...HEAD_NECK_SHAPE_LIMITS[k],this.draft[k],'shape',.01)).join('')}
    <div class="hn-actions"><button id="hn-apply" class="hn-primary">应用头颈参数</button><button id="hn-reset">恢复默认</button></div><p class="hn-note">倍率范围属于本角色的编辑保护，不代表医学正常范围。重建需要等待，姿态与绑定骨长保持独立。</p></details>
   <details><summary>活动检查</summary><div class="hn-presets">${[['rest','中立'],['left','向左看'],['right','向右看'],['nod','低头'],['up','抬头'],['tilt','侧倾']].map(([k,l])=>`<button data-hn-preset="${k}">${l}</button>`).join('')}</div>
   ${[['yaw','左右转头',-48,48],['pitch','低头与抬头',-26,30],['roll','左右侧倾',-22,22]].map(([k,l,a,b])=>control(k,l,a,b,this.pose[k],'pose',1)).join('')}
   <button id="hn-play">播放连续活动检查</button><p class="hn-note">由现有颈椎链与头部关节分配旋转，采用双四元数蒙皮。大角度皮肤压缩仍为近似。</p></details>
   <details><summary>知识框架与保存</summary><p class="hn-note">分开检查下颌下方、下颌角、乳突和后枕连接。前颈与后颈采用不同截面，避免头部前探和整圈收缩到下巴。面部五官保持原版。</p><p class="hn-note">研究来源：OpenStax 7.2、7.3、9.6、11.3；Dartmouth 第 50 章。来源支持的关系、设计参数与尚未验证项目分别记录在源码包 docs/anatomy/head-neck-r1。</p><button id="hn-export">导出头颈参数 JSON</button><button id="hn-import">导入参数</button><input id="hn-file" type="file" accept=".json,application/json" hidden><button id="hn-rules">导出生成规则 JSON</button></details>
   </aside><nav class="hn-tools">${[['front','正面'],['side','侧面'],['back','背面'],['threequarter','斜侧'],['full','全身']].map(([k,l])=>`<button data-hn-view="${k}">${l}</button>`).join('')}<span></span>${[['clay','灰模'],['skin','肤色'],['bones','骨骼']].map(([k,l])=>`<button data-hn-mode="${k}">${l}</button>`).join('')}</nav>
   <footer class="hn-status"><span id="hn-status">头颈修形已载入，等待视觉检查。</span><span id="hn-stats"></span></footer>`;
  document.body.append(el);this.root=el;
  this.sync=(group,key,v)=>el.querySelectorAll(`[data-hn-${group}="${key}"]`).forEach(i=>i.value=v);
  el.querySelectorAll('[data-hn-shape],[data-hn-pose]').forEach(input=>input.addEventListener('input',()=>{const group=input.dataset.hnShape?'shape':'pose',key=input.dataset.hnShape||input.dataset.hnPose,v=Number(input.value);if(!Number.isFinite(v)||v<Number(input.min)||v>Number(input.max))return;this.sync(group,key,v);if(group==='shape')this.draft[key]=v;else{this.stop();this.pose[key]=v;this.applyPose();}}));
  el.querySelectorAll('[data-hn-preset]').forEach(b=>b.onclick=()=>this.setPreset(b.dataset.hnPreset));
  el.querySelectorAll('[data-hn-view]').forEach(b=>b.onclick=()=>this.view(b.dataset.hnView));
  el.querySelectorAll('[data-hn-mode]').forEach(b=>b.onclick=()=>{this.mode=b.dataset.hnMode;this.render()});
  $('hn-close').onclick=()=>this.leave();$('hn-apply').onclick=()=>{try{const raw={};for(const i of this.root.querySelectorAll('input[type=number][data-hn-shape]')){if(!i.value.trim())throw Error('请填写完整的头颈参数');raw[i.dataset.hnShape]=Number(i.value)}this.applyShape(raw).catch(e=>this.status(e.message,true))}catch(e){this.status(e.message,true)}};$('hn-reset').onclick=()=>this.applyShape({...HEAD_NECK_SHAPE_DEFAULT}).catch(e=>this.status(e.message,true));
  $('hn-play').onclick=()=>{if(this.playing)this.stop();else{this.clock=0;this.playing=true;$('hn-play').textContent='停止活动检查';auto=true;needsRedraw=true}};
  $('hn-export').onclick=()=>hfDownload('head-neck-shape-v1.json',JSON.stringify(this.exportShape(),null,2),'application/json');
  $('hn-rules').onclick=()=>hfDownload('head-neck-generation-contract-v1.json',JSON.stringify(HEAD_NECK_KNOWLEDGE_CONTRACT,null,2),'application/json');
  $('hn-import').onclick=()=>$('hn-file').click();$('hn-file').onchange=async e=>{try{const f=e.target.files[0];if(!f||f.size>65536)throw Error('参数文件为空或过大');const d=JSON.parse(await f.text());if(d.schema!=='jarvis/head_neck_shape@1')throw Error('不支持此头颈参数格式');if(d.proportionRevision!==this.h.proportionRevision)throw Error('比例版本不一致，需人工核对后重新导出');await this.applyShape(d.parameters);}catch(error){this.status(error.message,true)}finally{e.target.value=''}};
  const open=document.createElement('button');open.id='hn-open';open.textContent='头部与颈部';open.onclick=()=>this.enter();document.body.append(open);
  for(const[id,target]of [['sh-open','shoulders'],['hf-open','hands'],['tr-open','torso']])$(id).onclick=()=>{if(this.active)this.leave();if(target==='hands'&&this.lab.torso.active)this.lab.torso.leave();if(target==='shoulders'&&this.lab.torso.active)this.lab.torso.leave();this.lab[target].enter()};

 }
 status(text,error=false){$('hn-status').textContent=text;$('hn-status').style.color=error?'#9c372e':''}
 enter(){if(this.active)return this.report();if(this.lab.torso.active)this.lab.torso.leave();if(this.lab.shoulders.active)this.lab.shoulders.leave();const w=this.lab.hands;if(w.active)w.leave();this.savedScope=w.scope;this.savedMode=w.mode;w.enter();w.stop();w.scope='body';w.root.hidden=true;this.active=true;this.root.hidden=false;document.body.classList.add('head-neck-studio');this.lab.setAuto(true);this.setPreset('rest');this.view('threequarter');this.status('头颈绑定与曲面已校正。请从侧面检查下颌、前颈和枕部连接。');return this.report()}
 leave(){if(!this.active)return;this.stop();this.pose={yaw:0,pitch:0,roll:0};this.applyPose(false);this.active=false;this.root.hidden=true;document.body.classList.remove('head-neck-studio');const w=this.lab.hands;w.scope=this.savedScope;w.mode=this.savedMode;w.leave()}
 stop(){this.playing=false;$('hn-play').textContent='播放连续活动检查'}
 setPreset(name){this.stop();const presets={rest:[0,0,0],left:[-42,0,0],right:[42,0,0],nod:[0,26,0],up:[0,-23,0],tilt:[0,0,18]};if(!presets[name])throw Error('未知头颈姿态');[this.pose.yaw,this.pose.pitch,this.pose.roll]=presets[name];for(const[k,v]of Object.entries(this.pose))this.sync('pose',k,v);this.applyPose();return this.report()}
 applyPose(renderNow=true){
  const h=this.h,p=this.pose;h.byId.get('head').q=qi();h.pose({position:h.root.p.slice(),time:0});
  const c=h.spine.filter(j=>j.region==='C');
  // Deliberately bounded display allocation on the existing cervical controls.
  // This is a pose preview; it is not measured individual segment kinematics.
  for(const j of c){const f=1/8;j.q=qm(qy(p.yaw*DEG*f),qm(qx(p.pitch*DEG*f),qz(-p.roll*DEG*f)));}
  h.byId.get('head').q=qm(qy(p.yaw*DEG/8),qm(qx(p.pitch*DEG/8),qz(-p.roll*DEG/8)));
  h.constraints.enforceAll();h.fk();h.tissue.update(0,0);needsRedraw=true;if(renderNow)this.render();
 }
 tick(dt){if(!this.active||!this.playing||this.busy)return;this.clock+=dt;const t=this.clock*.6;this.pose={yaw:35*Math.sin(t),pitch:18*Math.sin(t*.71),roll:12*Math.sin(t*.53)};this.applyPose(false)}
 view(name){this.lastView=name;const r=this.lab.renderer;r.projection='orthographic';r.target=add(this.h.root.p,[0,name==='full'?.01:1.563-this.h.rootHeight,.018]);r.distance=3;r.orthoHeight=name==='full'?1.95:.52;r.yaw=name==='side'?Math.PI/2:name==='back'?Math.PI:name==='threequarter'?.65:0;r.pitch=0;this.render()}
 render(){if(!this.active)return;const t=this.h.tissue,r=this.lab.renderer;r.studioMode=true;r.background=[.79,.82,.83];r.quality='fast';r.overlayLines=false;const items=this.mode==='bones'?this.h.bones:this.mode==='skin'?[t.skin,...t.details]:[t.clay,...t.clayDetails];for(const b of items)b.visible=true;r.render(items,[]);$('hn-stats').textContent=`骨长误差 ${(this.h.diagnostics().maxBoneLengthErrorM*1000).toFixed(4)} mm`;this.root.querySelectorAll('[data-hn-view]').forEach(b=>b.classList.toggle('is-active',b.dataset.hnView===this.lastView));this.root.querySelectorAll('[data-hn-mode]').forEach(b=>b.classList.toggle('is-active',b.dataset.hnMode===this.mode))}
 async applyShape(input){
  const next=validateHeadNeckShape(input);if(this.lab.renderer.gl.isContextLost())throw Error('图形上下文丢失，请重新打开本页');if(!this.active)throw Error('请先打开头颈工作台');if(this.busy)throw Error('请等待上一次重建完成');this.stop();this.busy=true;$('hn-apply').disabled=true;$('hn-reset').disabled=true;this.status('正在重建头颈曲面，请稍等。');await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,20)));
  const old={shape:this.h.headNeckShape,tissue:this.h.tissue,geometry:[...this.h.bones,...this.h.cartilage].map(o=>[o,o.g])},started=performance.now();
  try{this.h.headNeckShape=next;const t=new ProceduralTissue(this.h);this.h.tissue=t;this.lab.tissue=t;this.lab.renderer.setTissue(t);this.lab.renderer.lastItems=[];this.lab.hands.cache={};this.lab.hands.cachedGeometry=null;this.surfaceRevision++;this.draft={...next};for(const[k,v]of Object.entries(next))this.sync('shape',k,v);this.applyPose();if(this.lab.renderer.gl.isContextLost())throw Error('几何已生成，但图形上下文丢失');this.status('头颈已重建，用时 '+((performance.now()-started)/1000).toFixed(1)+' 秒。绑定骨长与手部尺寸保持不变。');return this.report()}
  catch(e){for(const[o,g]of old.geometry)o.g=g;this.h.headNeckShape=old.shape;this.h.tissue=old.tissue;this.lab.tissue=old.tissue;this.lab.renderer.setTissue(old.tissue);this.lab.renderer.lastItems=[];this.applyPose();throw e}
  finally{this.busy=false;$('hn-apply').disabled=false;$('hn-reset').disabled=false}
 }
 exportShape(){return {schema:'jarvis/head_neck_shape@1',surfaceRevision:this.surfaceRevision,proportionRevision:this.h.proportionRevision,parameters:{...(this.h.headNeckShape||HEAD_NECK_SHAPE_DEFAULT)},acceptedBaselines:{handForearm:'1.12.1',shoulderArm:'1.13.0'},knowledgeContract:'jarvis/head_neck_generation_contract@1',boneLengthsChanged:false}}
 report(){return {version:'1.15.0',active:this.active,busy:this.busy,pose:{...this.pose},shape:this.exportShape(),surface:this.h.tissue.headNeckSurfaceReport,constraintAudit:this.h.constraints.audit(),maxBoneLengthErrorM:this.h.diagnostics().maxBoneLengthErrorM}}
}
