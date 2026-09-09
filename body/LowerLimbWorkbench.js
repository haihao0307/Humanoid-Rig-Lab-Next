/* Inspection controls for the existing legs and feet. No second character. */
class LowerLimbWorkbench{
 constructor(lab){this.lab=lab;this.h=lab.human;this.active=false;this.mode='clay';this.lastView='threequarter';this.pose='rest';this.scope='lower';this.sideMeshes=new WeakMap();this.makeUI();}
 makeUI(){
  const shapeLabels={calfVolume:'小腿体积',thighVolume:'大腿体积',gluteVolume:'臀部体积',softness:'软组织厚度'};
  const shapeControls=Object.entries(shapeLabels).map(([key,label])=>{const [min,max]=LOWER_BODY_SHAPE_LIMITS[key],value=this.h.lowerBodyShape[key];return `<label class="ll-control"><span>${label}</span><div><input type="range" data-ll-shape="${key}" min="${min}" max="${max}" step=".01" value="${value}"><input aria-label="${label}" type="number" data-ll-number="${key}" min="${min}" max="${max}" step=".01" value="${value}"></div></label>`;}).join('');
  const el=document.createElement('section');el.id='ll-root';el.hidden=true;
  el.innerHTML=`<header class="ll-top"><div><small>JARVIS / ANATOMY STUDIO</small><strong>臀腿与足部 <em>R9</em></strong></div><button id="ll-close">返回原场景</button></header>
   <div class="ll-heading"><small>BODY PROPORTION / LEGS / FEET</small><h1>比例、臀腿与足部</h1><p>175 cm 基准 · 体型参数与角色预设</p></div>
   <aside class="ll-panel"><div class="ll-lock">当前预设：${BODY_PRESET.label}<b>同身高 1.75 m · 成人示例</b><p>右上角切换预设。当前轮廓属于本角色的设计值。</p></div>
   <details open><summary>查看范围</summary><div class="ll-presets">${[['lower','脚与小腿'],['hips','臀腿'],['full','全身比例']].map(([key,label])=>`<button data-ll-scope="${key}">${label}</button>`).join('')}</div></details>
   <details open><summary>体型参数</summary>${shapeControls}<button id="ll-apply" class="ll-primary">应用体型</button><p class="ll-note">调整同一角色的肌肉体积和覆盖厚度。点击应用后重新生成外形。</p></details>
   <details open><summary>活动检查</summary><div class="ll-presets">${[['rest','自然站立'],['dorsi','踝背屈'],['plantar','踝跖屈'],['knee','屈膝'],['toes','脚趾屈曲']].map(([k,l])=>`<button data-ll-pose="${k}">${l}</button>`).join('')}</div><p class="ll-note">活动预览用于检查关节附近的外形。切换动作后可拖动旋转，再保存当前视图。</p></details>
   <details open><summary>对照要点</summary><p class="ll-note">背面看小腿内外两侧与跟腱的过渡；侧面看脚跟、足弓和前脚掌；俯视皮肤时只显示足部，查看五趾排列、趾根连接与趾甲。</p><p class="ll-note">肌肉图层显示当前范围的肌群；支撑体为构造示意。外形和活动状态仍需检查。</p></details>
   <details><summary>角色预设</summary><label class="ll-control"><span>变化种子</span><input id="ll-seed" type="number" min="0" max="4294967295" step="1" value="1"></label><button id="ll-variant">按种子生成体型</button><p class="ll-note">同一种子与基准得到同一组参数，便于保存和复用。</p><label class="ll-control"><span>预先分配的任务</span><textarea id="ll-task" rows="3" placeholder="例如：挥手，然后坐下"></textarea></label><label class="ll-note"><input id="ll-autostart" type="checkbox">载入场景后自动开始</label><div class="ll-actions"><button id="ll-preset-export">导出角色</button><button id="ll-preset-import">导入角色</button></div><button id="ll-task-start">返回场景并执行任务</button><input id="ll-preset-file" type="file" accept="application/json,.json" hidden></details>
   <details><summary>参考与保存</summary><p class="ll-note">参考 AIST 人体测量数据；Dartmouth 下肢骨骼、臀区、大腿、小腿与足部章节。具体规则见 docs/BODY_PLAN_R9.md。</p><button id="ll-report">导出结构检查报告</button></details></aside>
   <nav class="ll-tools">${[['front','正面'],['side','外侧'],['medial','内侧'],['back','背面'],['top','俯视'],['threequarter','斜侧']].map(([k,l])=>`<button data-ll-view="${k}">${l}</button>`).join('')}<span></span>${[['clay','灰模'],['skin','肤色'],['bones','骨骼'],['structure','硬基底'],['support','支撑体'],['muscle','肌肉示意']].map(([k,l])=>`<button data-ll-mode="${k}">${l}</button>`).join('')}</nav>
   <footer class="ll-status"><span id="ll-status">等待外形检查。</span><button id="ll-screenshot">保存当前视图</button><span id="ll-stats"></span></footer>`;
  document.body.append(el);this.root=el;
  el.querySelectorAll('[data-ll-scope]').forEach(b=>b.onclick=()=>{this.scope=b.dataset.llScope;this.view(this.lastView==='top'?'threequarter':this.lastView)});
  for(const key of Object.keys(LOWER_BODY_SHAPE_DEFAULT)){const range=el.querySelector('[data-ll-shape="'+key+'"]'),number=el.querySelector('[data-ll-number="'+key+'"]');range.oninput=()=>number.value=range.value;number.oninput=()=>range.value=number.value;}
  const syncPreset=()=>{const p=this.lab.character.export();for(const [key,value]of Object.entries(p.appearance.lowerBody)){el.querySelector('[data-ll-shape="'+key+'"]').value=value;el.querySelector('[data-ll-number="'+key+'"]').value=value;}$('ll-seed').value=p.seed;$('ll-task').value=p.task.command;$('ll-autostart').checked=p.task.startOnSpawn;};
  const action=async fn=>{const controls=[...el.querySelectorAll('button,input,textarea')];controls.forEach(b=>b.disabled=true);try{saveTask();this.status('正在生成角色外形…');await fn();syncPreset();this.sideMeshes=new WeakMap();this.setPreset(this.pose);this.status('外形已重新生成，请分层检查。');}catch(e){this.status(e.message,true);}finally{controls.forEach(b=>b.disabled=false);}};
  $('ll-apply').onclick=()=>action(()=>this.lab.character.applyLowerBody(Object.fromEntries(Object.keys(LOWER_BODY_SHAPE_DEFAULT).map(k=>[k,Number(el.querySelector('[data-ll-number="'+k+'"]').value)]))));
  $('ll-variant').onclick=()=>action(()=>this.lab.character.apply(this.lab.character.sample(Number($('ll-seed').value))));
  const saveTask=()=>this.lab.character.setTask($('ll-task').value,$('ll-autostart').checked);
  $('ll-preset-export').onclick=()=>{try{const p=saveTask();hfDownload(p.id+'-r9.json',JSON.stringify(p,null,2),'application/json');this.status('角色外形和任务预设已导出。');}catch(e){this.status(e.message,true)}};
  $('ll-preset-import').onclick=()=>$('ll-preset-file').click();$('ll-preset-file').onchange=e=>action(async()=>{const f=e.target.files[0];try{if(!f||f.size>131072)throw Error('角色文件为空或过大');await this.lab.character.apply(JSON.parse(await f.text()));}finally{e.target.value=''}});
  $('ll-task-start').onclick=()=>{try{saveTask();this.lab.character.startTask();}catch(e){this.status(e.message,true)}};
  this.syncCharacterControls=syncPreset;
  el.querySelectorAll('[data-ll-pose]').forEach(b=>b.onclick=()=>this.setPreset(b.dataset.llPose));
  el.querySelectorAll('[data-ll-view]').forEach(b=>b.onclick=()=>this.view(b.dataset.llView));
  el.querySelectorAll('[data-ll-mode]').forEach(b=>b.onclick=()=>{this.mode=b.dataset.llMode;this.render()});
  $('ll-close').onclick=()=>this.leave();$('ll-report').onclick=()=>hfDownload('lower-leg-foot-'+BODY_SEX+'-r9.json',JSON.stringify(this.report(),null,2),'application/json');
  $('ll-screenshot').onclick=()=>{try{this.render();const a=document.createElement('a');a.download=`lower-leg-foot-${BODY_SEX}-${this.lastView}-${this.mode}-${this.pose}-r9.png`;a.href=this.lab.renderer.canvas.toDataURL('image/png');a.click();this.status('当前模型视图已导出 PNG。');}catch(e){this.status('导出失败：'+e.message,true)}};
  const open=document.createElement('button');open.id='ll-open';open.textContent='臀腿与足部';open.onclick=()=>{try{this.enter()}catch(e){$('ll-status').textContent=e.message;open.title=e.message;}};document.body.append(open);
  for(const id of ['hf-open','sh-open','tr-open','hn-open']){const b=$(id),previous=b.onclick;b.onclick=e=>{if(this.active)this.leave();previous?.call(b,e);};}
 }
 status(text,error=false){$('ll-status').textContent=text;$('ll-status').style.color=error?'#9c372e':'';}
 enter(){
  if(this.active)return this.report();if(this.lab.agent.held||this.lab.agent.skill)throw Error('请先停止当前身体任务，再检查臀腿与足部。');
  for(const key of ['headNeck','torso','shoulders'])if(this.lab[key].active)this.lab[key].leave();
  const w=this.lab.hands;if(w.active)w.leave();this.savedScope=w.scope;this.savedMode=w.mode;w.enter();w.stop();w.scope='body';w.root.hidden=true;
  this.active=true;this.root.hidden=false;document.body.classList.add('lower-limb-studio');this.setPreset('rest');this.view('threequarter');
  this.syncCharacterControls();const warnings=lowerLimbInspectionSummary(this.h.tissue).warnings;this.status(warnings.length?'构建过程有 '+warnings.length+' 项待检查问题，请导出报告。':'先从背面、内外侧和俯视检查臀腿与足部。',warnings.length>0);return this.report();
 }
 leave(){if(!this.active)return;this.active=false;this.root.hidden=true;document.body.classList.remove('lower-limb-studio');const w=this.lab.hands;w.scope=this.savedScope;w.mode=this.savedMode;w.leave();}
 setPreset(name){
  const presets={rest:[0,0,0],dorsi:[0,-15,0],plantar:[0,26,0],knee:[55,0,0],toes:[0,0,22]};if(!presets[name])throw Error('未知小腿姿态');this.pose=name;
  const h=this.h,[knee,ankle,toe]=presets[name];for(const j of h.joints)j.q=[...j.bindQ];h.pose({position:h.root.p.slice(),time:0});
  for(const side of ['left','right']){const leg=h.legs[side];leg.elbow.q=qm(leg.elbow.q,qx(knee*DEG));leg.wrist.q=qm(leg.wrist.q,qx(ankle*DEG));for(const ray of leg.footRays)ray.toes.forEach((j,k)=>j.q=restoreBind(j,qx(toe*DEG*(k===0?1:.45))));}
  h.constraints.enforceAll();h.fk();h.tissue.update(0,0);needsRedraw=true;this.render();return this.report();
 }
 tick(){}
 sideSurface(item,side,feetOnly=false){
  const source=item.g;let cache=this.sideMeshes.get(source);if(!cache){cache={};this.sideMeshes.set(source,cache);}
  const key=(side||'both')+(feetOnly?'_feet':'_leg');
  if(!cache[key]){const own=new Uint8Array(source.p.length/3),indices=[];
   for(let v=0;v<own.length;v++){let slot=0;for(let k=1;k<4;k++)if(source.skinWeights[v*4+k]>source.skinWeights[v*4+slot])slot=k;const id=this.h.joints[source.skinJoints[v*4+slot]].id,owner=id.split('_')[0],part=this.h.tissue.lowerLimb.sides[owner];
    own[v]=part&&(!side||owner===side)&&/_(femur|tibia|foot|metatarsal_|toe_)/.test(id)&&(!feetOnly||source.p[v*3+1]<part.foot.p[1]+.045)?1:0;}
   for(let k=0;k<source.i.length;k+=3){const a=source.i[k],b=source.i[k+1],c=source.i[k+2];if(own[a]&&own[b]&&own[c])indices.push(a,b,c);}
   cache[key]={...item,id:item.id+'_'+key+'_inspection',g:{...source,i:new Uint32Array(indices)}};
  }return cache[key];
 }
 view(name){this.lastView=name;const r=this.lab.renderer,side=name==='medial'?-1:1,foot=this.h.legs[side<0?'left':'right'].wrist.world.p;
  r.projection='orthographic';r.target=this.scope==='full'?add(this.h.root.p,[0,.875-REST_HIP_HEIGHT,0]):this.scope==='hips'?add(this.h.root.p,[0,-.20,.015]):name==='side'||name==='medial'?add(foot,[0,.18,.035]):add(this.h.root.p,[0,-REST_HIP_HEIGHT+.24,.035]);r.distance=2.4;r.orthoHeight=name==='top'?.47:this.scope==='full'?1.96:this.scope==='hips'?.96:.69;
  if(name==='top'){this.scope='lower';r.target=add(this.h.root.p,[0,-REST_HIP_HEIGHT+.10,.04]);}
  r.yaw=name==='side'||name==='medial'?Math.PI/2:name==='back'?Math.PI:name==='threequarter'?.64:0;r.pitch=name==='top'?1.49:name==='threequarter'?.22:0;this.render();
 }
 render(){if(!this.active)return;const t=this.h.tissue,r=this.lab.renderer,onlySide=this.scope==='lower'?(this.lastView==='side'?'right':this.lastView==='medial'?'left':null):null;
  let items=this.mode==='bones'?this.h.bones.filter(b=>/^(left|right)_(tibia|fibula|patella|foot|talus|calcaneus|navicular|cuboid|.*cuneiform|metatarsal_|toe_)/.test(b.id)):this.mode==='structure'?t.lowerLimb.parts:this.mode==='support'?t.lowerLimb.supports:this.mode==='muscle'?t.muscles.filter(m=>m.lowerLimbSheet).map(m=>m.sheet):this.mode==='skin'?[t.skin,...t.details]:[t.clay,...t.clayDetails];
  if(this.scope!=='lower'){
   if(this.mode==='bones')items=this.h.bones;
   else if(this.mode==='structure')items=[...t.structure.parts,...t.lowerLimb.parts];
   else if(this.mode==='support')items=[...t.structure.supports,...t.lowerLimb.supports];
   else if(this.mode==='muscle')items=anatomyMuscleItems(t);
  }else if(this.mode==='muscle')items=t.muscles.filter(m=>m.lowerLimbRegion==='shank').map(m=>m.sheet);
  if(t.wholeBodyReport){
   if(this.mode==='muscle')items=anatomyMuscleItems(t).filter(p=>this.scope!=='lower'||['shank','foot'].includes(p.anatomyRegion));
   if(this.mode==='support')items=t.referenceSupport.filter(p=>this.scope!=='lower'||['shank','foot'].includes(p.anatomyRegion));
   if(this.mode==='structure')items=t.structure.parts.filter(p=>this.scope!=='lower'||/_(tibia|fibula|patella|talus|calcaneus|navicular|cuboid|.*cuneiform|metatarsal_|toe_)/.test(p.id));
  }
  if(onlySide&&['bones','structure','support','muscle'].includes(this.mode))items=items.filter(b=>b.id.includes(onlySide+'_'));
  if((onlySide||this.lastView==='top')&&['skin','clay'].includes(this.mode)){const base=this.mode==='skin'?t.skin:t.clay,details=this.mode==='skin'?t.details:t.clayDetails;items=[this.sideSurface(base,onlySide,this.lastView==='top'),...details.filter(b=>b.id.includes(onlySide?onlySide+'_toenail_':'_toenail_'))];}
  if(this.lastView==='top'&&['bones','structure','support'].includes(this.mode))items=items.filter(b=>!/(femur|tibia|fibula|patella|shank|thigh)/.test(b.id));
  for(const b of items)b.visible=true;r.studioMode=true;r.background=[.79,.82,.83];r.quality='fast';r.overlayLines=false;r.render(items,[]);
  $('ll-stats').textContent=BODY_PRESET.label+' · R9 · '+(this.h.diagnostics().maxBoneLengthErrorM*1000).toFixed(4)+' mm 骨长误差';
  for(const group of ['view','mode','pose','scope'])this.root.querySelectorAll('[data-ll-'+group+']').forEach(b=>b.classList.toggle('is-active',b.dataset['ll'+group[0].toUpperCase()+group.slice(1)]===(group==='view'?this.lastView:this[group])));
 }
 report(){return {version:'1.16.0-body-plan-r9',sex:BODY_SEX,character:this.lab.character.export(),spawnTask:this.h.characterTaskStatus,active:this.active,scope:this.scope,view:this.lastView,mode:this.mode,pose:this.pose,construction:lowerLimbInspectionSummary(this.h.tissue),surface:this.h.tissue.surfaceInfo.topology,constraintAudit:this.h.constraints.audit(),maxBoneLengthErrorM:this.h.diagnostics().maxBoneLengthErrorM};}
}
