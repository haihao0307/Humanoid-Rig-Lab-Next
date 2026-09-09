/* Local inspection of the full character. Eight shape variables, one surface. */
class TorsoWorkbench {
 constructor(lab){
  this.lab=lab;this.h=lab.human;this.active=false;this.busy=false;this.playing=false;this.clock=0;this.mode='clay';this.lastView='threequarter';this.surfaceRevision=1;
  this.draft={...(this.h.torsoShape||TORSO_SHAPE_DEFAULT)};this.pose={bend:0,sideBend:0,twist:0,abduction:4};this.makeUI();
  lab.renderer.canvas.addEventListener('webglcontextlost',()=>{this.stop();this.status('图形上下文丢失，请关闭其他高负载页面后重新打开。参数仍可导出。',true)});
 }
 makeUI(){
  const labels={chestWidth:'胸廓宽度',chestDepth:'胸廓前侧深度',backDepth:'胸背厚度',waistWidth:'腰部宽度',abdominalFullness:'腹壁饱满度',pectoralVolume:'胸肌表面体积',costalDefinition:'肋弓显著度',scapularRelief:'肩胛区域起伏'};
  const control=(key,label,lo,hi,value,group,step)=>`<label class="tr-control"><span>${label}<small>${group==='pose'?'度':'倍率'}</small></span><div><input type="range" data-tr-${group}="${key}" min="${lo}" max="${hi}" step="${step}" value="${value}"><input type="number" aria-label="${label}" data-tr-${group}="${key}" min="${lo}" max="${hi}" step="${step}" value="${value}"></div></label>`;
  const el=document.createElement('section');el.id='tr-root';el.hidden=true;
  el.innerHTML=`<header class="tr-top"><div><small>JARVIS / ANATOMY STUDIO</small><strong>颈背与躯干 <em>R7</em></strong></div><button id="tr-close">返回原场景</button></header>
   <div class="tr-heading"><small>02 / THORAX & ABDOMEN</small><h1>颈背、腰骶与臀部</h1><p>男性 / 女性预设 · 同一视角分层对照</p></div>
   <aside class="tr-panel"><div class="tr-lock">当前预设：${BODY_PRESET.label}<b>同身高 1.75 m · 成人示例</b><p>右上角可切换男女。切换会重新生成身体并重置动作与局部编辑；两套参数不代表所有人的体型。</p></div>
   <details open><summary>躯干形体</summary>${Object.entries(labels).map(([k,l])=>control(k,l,...TORSO_SHAPE_LIMITS[k],this.draft[k],'shape',.01)).join('')}
    <div class="tr-actions"><button id="tr-apply" class="tr-primary">应用躯干参数</button><button id="tr-reset">恢复默认</button></div><p class="tr-note">倍率范围属于本角色的编辑保护，不代表医学正常范围。重建需要等待，姿态与绑定骨长保持独立。</p></details>
   <details><summary>活动检查</summary><div class="tr-presets">${[['rest','自然站立'],['a','A 姿态'],['bend','前屈'],['extend','后伸'],['turn','转体'],['side','侧屈']].map(([k,l])=>`<button data-tr-preset="${k}">${l}</button>`).join('')}</div>
   ${[['bend','躯干前后屈',-12,25],['sideBend','躯干侧屈',-18,18],['twist','躯干旋转',-25,25],['abduction','双臂侧抬',4,70]].map(([k,l,a,b])=>control(k,l,a,b,this.pose[k],'pose',1)).join('')}
   <button id="tr-play">播放连续活动检查</button><p class="tr-note">采用现有脊柱链和双四元数蒙皮。腹部压缩、肩胛滑动与呼吸仍为几何近似。</p></details>
   <details><summary>参考与保存</summary><p class="tr-note">从骨骼和支撑、肌肉示意到表皮，按同一视角检查后颈、肩胛、腰骶与臀部的衔接。结构报告会记录生成过程中的异常，外形仍需结合当前视图判断。</p><p class="tr-note">参考：Dartmouth 第 39 章，OpenStax 11.3、11.5、11.6。解剖关系与角色设计数值见源码包 docs/AXIAL_SYSTEM_R7.md。</p><button id="tr-structure-report">导出结构检查报告</button><button id="tr-export">导出躯干参数 JSON</button><button id="tr-import">导入参数</button><input id="tr-file" type="file" accept=".json,application/json" hidden><button id="tr-rules">导出生成规则 JSON</button></details>
   </aside><nav class="tr-tools">${[['front','正面'],['side','侧面'],['back','背面'],['threequarter','斜侧'],['full','全身']].map(([k,l])=>`<button data-tr-view="${k}">${l}</button>`).join('')}<span></span>${[['clay','灰模'],['skin','肤色'],['bones','骨骼'],['structure','硬基底'],['support','支撑体'],['muscle','肌肉示意']].map(([k,l])=>`<button data-tr-mode="${k}">${l}</button>`).join('')}</nav>
   <footer class="tr-status"><span id="tr-status">躯干修形已载入，等待视觉检查。</span><button id="tr-screenshot">保存当前视图</button><span id="tr-stats"></span></footer>`;
  document.body.append(el);this.root=el;
  $('tr-screenshot').onclick=()=>{try{this.render();const a=document.createElement('a');a.download=`body-${BODY_SEX}-${this.lastView}-${this.mode}-r7.png`;a.href=this.lab.renderer.canvas.toDataURL('image/png');a.click();this.status('当前模型视图已导出 PNG。');}catch(e){this.status('导出失败：'+e.message,true)}};
  this.sync=(group,key,v)=>el.querySelectorAll(`[data-tr-${group}="${key}"]`).forEach(i=>i.value=v);
  el.querySelectorAll('[data-tr-shape],[data-tr-pose]').forEach(input=>input.addEventListener('input',()=>{const group=input.dataset.trShape?'shape':'pose',key=input.dataset.trShape||input.dataset.trPose,v=Number(input.value);if(!Number.isFinite(v)||v<Number(input.min)||v>Number(input.max))return;this.sync(group,key,v);if(group==='shape')this.draft[key]=v;else{this.stop();this.pose[key]=v;this.applyPose();}}));
  el.querySelectorAll('[data-tr-preset]').forEach(b=>b.onclick=()=>this.setPreset(b.dataset.trPreset));
  el.querySelectorAll('[data-tr-view]').forEach(b=>b.onclick=()=>this.view(b.dataset.trView));
  el.querySelectorAll('[data-tr-mode]').forEach(b=>b.onclick=()=>{this.mode=b.dataset.trMode;this.render()});
  $('tr-close').onclick=()=>this.leave();$('tr-apply').onclick=()=>{try{const raw={};for(const i of this.root.querySelectorAll('input[type=number][data-tr-shape]')){if(!i.value.trim())throw Error('请填写完整的躯干参数');raw[i.dataset.trShape]=Number(i.value)}this.applyShape(raw).catch(e=>this.status(e.message,true))}catch(e){this.status(e.message,true)}};$('tr-reset').onclick=()=>this.applyShape({...TORSO_SHAPE_DEFAULT}).catch(e=>this.status(e.message,true));
  $('tr-play').onclick=()=>{if(this.playing)this.stop();else{this.clock=0;this.playing=true;$('tr-play').textContent='停止活动检查';auto=true;needsRedraw=true}};
  $('tr-structure-report').onclick=()=>hfDownload('axial-structure-'+BODY_SEX+'-r7.json',JSON.stringify(this.report(),null,2),'application/json');
  $('tr-export').onclick=()=>hfDownload('torso-shape-v1.json',JSON.stringify(this.exportShape(),null,2),'application/json');
  $('tr-rules').onclick=()=>hfDownload('torso-axial-generation-r7.json',JSON.stringify({anterior:TORSO_KNOWLEDGE_CONTRACT,posterior:AXIAL_KNOWLEDGE_CONTRACT},null,2),'application/json');
  $('tr-import').onclick=()=>$('tr-file').click();$('tr-file').onchange=async e=>{try{const f=e.target.files[0];if(!f||f.size>65536)throw Error('参数文件为空或过大');const d=JSON.parse(await f.text());if(d.schema!=='jarvis/torso_shape@1')throw Error('不支持此躯干参数格式');if(d.sex!==BODY_SEX)throw Error('预设性别不一致，请切换后再导入');if(d.proportionRevision!==this.h.proportionRevision)throw Error('比例版本不一致，需人工核对后重新导出');await this.applyShape(d.parameters);}catch(error){this.status(error.message,true)}finally{e.target.value=''}};
  const open=document.createElement('button');open.id='tr-open';open.textContent='颈背与躯干';open.onclick=()=>this.enter();document.body.append(open);
  $('sh-open').onclick=()=>{if(this.active)this.leave();this.lab.shoulders.enter()};
  $('hf-open').onclick=()=>{if(this.active)this.leave();if(this.lab.shoulders.active)this.lab.shoulders.leave();this.lab.hands.enter()};
 }
 status(text,error=false){$('tr-status').textContent=text;$('tr-status').style.color=error?'#9c372e':''}
 enter(){if(this.active)return this.report();if(this.lab.shoulders.active)this.lab.shoulders.leave();const w=this.lab.hands;if(w.active)w.leave();this.savedScope=w.scope;this.savedMode=w.mode;w.enter();w.stop();w.scope='body';w.root.hidden=true;this.active=true;this.root.hidden=false;document.body.classList.add('torso-studio');this.lab.setAuto(true);this.setPreset('rest');this.view('threequarter');const warnings=axialInspectionSummary(this.h).warnings;this.status(warnings.length?'构建检查发现 '+warnings.length+' 项待检查问题，请导出结构报告。':'按侧面、背面检查颈背至臀部；各层共享当前姿态。',warnings.length>0);return this.report()}
 leave(){if(!this.active)return;this.stop();this.active=false;this.root.hidden=true;document.body.classList.remove('torso-studio');const w=this.lab.hands;w.scope=this.savedScope;w.mode=this.savedMode;w.leave()}
 stop(){this.playing=false;$('tr-play').textContent='播放连续活动检查'}
 setPreset(name){this.stop();const presets={rest:[0,0,0,4],a:[0,0,0,28],bend:[22,0,0,16],extend:[-10,0,0,8],turn:[0,0,22,16],side:[0,16,0,20]};if(!presets[name])throw Error('未知躯干姿态');[this.pose.bend,this.pose.sideBend,this.pose.twist,this.pose.abduction]=presets[name];for(const[k,v]of Object.entries(this.pose))this.sync('pose',k,v);this.applyPose();return this.report()}
 applyPose(renderNow=true){
  const h=this.h,p=this.pose,w=this.lab.shoulders;w.clock=0;w.side='both';w.pose={abduction:p.abduction,flexion:0,twist:0,elbow:7};w.applyPose(false);
  const lumbar=h.spine.filter(j=>j.region==='L'),thoracic=h.spine.filter(j=>j.region==='T');
  for(const j of [...lumbar,...thoracic]){const f=j.region==='L'?.65/lumbar.length:.35/thoracic.length;j.q=qm(j.q,qm(qx(p.bend*DEG*f),qm(qy(p.twist*DEG*f),qz(-p.sideBend*DEG*f))))}
  h.constraints.enforceAll();h.fk();h.tissue.update(0,0);needsRedraw=true;if(renderNow)this.render();
 }
 tick(dt){if(!this.active||!this.playing||this.busy)return;this.clock+=dt;const t=this.clock*.35;this.pose={bend:10*Math.sin(t),sideBend:10*Math.sin(t*.63),twist:16*Math.sin(t*.87),abduction:18};this.applyPose(false)}
 view(name){this.lastView=name;const r=this.lab.renderer;r.projection='orthographic';r.target=add(this.h.root.p,[0,name==='full'?.01:.26,.025]);r.distance=3;r.orthoHeight=name==='full'?1.95:1.16;r.yaw=name==='side'?Math.PI/2:name==='back'?Math.PI:name==='threequarter'?.60:0;r.pitch=name==='threequarter'?.03:0;this.render()}
 render(){if(!this.active)return;const t=this.h.tissue,r=this.lab.renderer;r.studioMode=true;r.background=[.79,.82,.83];r.quality='fast';r.overlayLines=false;const items=this.mode==='bones'?[...this.h.bones,...this.h.cartilage]:this.mode==='structure'?t.structure.parts:this.mode==='support'?t.structure.supports:this.mode==='muscle'?anatomyMuscleItems(t):this.mode==='skin'?[t.skin,...t.details]:[t.clay,...t.clayDetails];for(const b of items)b.visible=true;r.render(items,[]);$('tr-stats').textContent=`${BODY_PRESET.label} · R7 · 骨长误差 ${(this.h.diagnostics().maxBoneLengthErrorM*1000).toFixed(4)} mm`;this.root.querySelectorAll('[data-tr-view]').forEach(b=>b.classList.toggle('is-active',b.dataset.trView===this.lastView));this.root.querySelectorAll('[data-tr-mode]').forEach(b=>b.classList.toggle('is-active',b.dataset.trMode===this.mode))}
 async applyShape(input){
  const next=validateTorsoShape(input);if(this.lab.renderer.gl.isContextLost())throw Error('图形上下文丢失，请重新打开本页');if(!this.active)throw Error('请先打开躯干工作台');if(this.busy)throw Error('请等待上一次重建完成');this.stop();this.busy=true;$('tr-apply').disabled=true;$('tr-reset').disabled=true;this.status('正在重建躯干曲面，请稍等。');await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,20)));
  const old={shape:this.h.torsoShape,tissue:this.h.tissue,geometry:[...this.h.bones,...this.h.cartilage].map(o=>[o,o.g])},started=performance.now();
  try{this.h.torsoShape=next;const t=new ProceduralTissue(this.h);this.h.tissue=t;this.lab.tissue=t;this.lab.renderer.setTissue(t);this.lab.renderer.lastItems=[];this.lab.hands.cache={};this.lab.hands.cachedGeometry=null;this.surfaceRevision++;this.draft={...next};for(const[k,v]of Object.entries(next))this.sync('shape',k,v);this.applyPose();if(this.lab.renderer.gl.isContextLost())throw Error('几何已生成，但图形上下文丢失');this.status('躯干已重建，用时 '+((performance.now()-started)/1000).toFixed(1)+' 秒。绑定骨长与手部尺寸保持不变。');return this.report()}
  catch(e){for(const[o,g]of old.geometry)o.g=g;this.h.torsoShape=old.shape;this.h.tissue=old.tissue;this.lab.tissue=old.tissue;this.lab.renderer.setTissue(old.tissue);this.lab.renderer.lastItems=[];this.applyPose();throw e}
  finally{this.busy=false;$('tr-apply').disabled=false;$('tr-reset').disabled=false}
 }
 exportShape(){return {schema:'jarvis/torso_shape@1',sex:BODY_SEX,surfaceRevision:this.surfaceRevision,proportionRevision:this.h.proportionRevision,parameters:{...(this.h.torsoShape||TORSO_SHAPE_DEFAULT)},acceptedBaselines:{handForearm:'1.12.1',shoulderArm:'1.13.0'},knowledgeContract:'jarvis/torso_generation_contract@1',boneLengthsChanged:false}}
 report(){return {version:'1.16.0-body-plan-r9',sex:BODY_SEX,construction:axialInspectionSummary(this.h),layers:this.h.tissue.structure.report,back:this.h.tissue.backSurfaceReport,skeleton:this.h.axialReport,muscles:this.h.tissue.axialMuscleReport,softBinding:this.h.tissue.shoulderLayerReport,active:this.active,busy:this.busy,pose:{...this.pose},shape:this.exportShape(),surface:this.h.tissue.torsoSurfaceReport,thoracicGeometry:this.h.tissue.thoracicGeometryReport,constraintAudit:this.h.constraints.audit(),maxBoneLengthErrorM:this.h.diagnostics().maxBoneLengthErrorM}}
}
