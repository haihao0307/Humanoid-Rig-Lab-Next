/* Shared request construction for planning, live execution and comparison UI.
 * Live posture measurements are read only; this layer never changes IK. */
function strengthGroupLabel(id){
 const side=id.startsWith('left_')?'左':id.startsWith('right_')?'右':'';
 const key=id.replace(/^(left|right|center)_/,'');return side+(STRENGTH_CATALOG.groups.find(g=>g.id===key)?.label||key);
}
function strengthReason(assessment){return assessment.reasons.map(reason=>reason.replace(/(?:left|right|center)_\w+/g,id=>strengthGroupLabel(id))).join('；');}
function strengthTaskRequest(type,object,options={}){
 return {type,massKg:object.mass,durationS:0,reachM:.46,elbowLeverM:.24,crouch:1,
  accelerationMps2:.25,speedMps:type==='push'?.22:.43,
  objectFriction:object.friction??.4,gripFriction:object.gripFriction??.6,
  groundFriction:.65,pushHeightM:Math.min(1.2,Math.max(.15,object.h*.65)),
  ...options};
}
function strengthRuntimeAssessment(agent,candidate,dt){
 const o=agent.held,type=agent.skill.type,lengthRatios={},shorteningRates={};
 let shoulderLever=.05,elbowLever=.02;
 for(const side of ['left','right']){
  const a=agent.h.arms[side],palm=agent.h.palm(side).p;
  shoulderLever=Math.max(shoulderLever,horizontal(palm,a.upper.world.p));
  elbowLever=Math.max(elbowLever,horizontal(palm,a.elbow.world.p));
  const u=norm(sub(a.elbow.world.p,a.upper.world.p)),v=norm(sub(a.wrist.world.p,a.elbow.world.p));
  const flex=Math.acos(clamp(dot(u,v),-1,1)),offset=.18*(Math.PI/2-flex)/(Math.PI/2);
  for(const [group,ratio]of [['elbowFlexors',1+offset],['elbowExtensors',1-offset]]){
   const id=side+'_'+group;lengthRatios[id]=ratio;
   shorteningRates[id]=dt>0&&agent.strengthLastLengths?.[id]!=null?clamp((agent.strengthLastLengths[id]-ratio)/dt,-3,3):0;
  }
 }
 const verticalSpeed=dt>0?(candidate.p[1]-o.p[1])/dt:0;
 const req=strengthTaskRequest(type,o,{reachM:clamp(shoulderLever,.05,1.2),elbowLeverM:clamp(elbowLever,.02,.7),crouch:clamp((REST_HIP_HEIGHT-agent.pos[1])/(REST_HIP_HEIGHT-.325),0,1),speedMps:clamp(agent.walkSpeed||0,0,3),accelerationMps2:agent.phase==='lift'?.25:0,lengthRatios,shorteningRates});
 const assessment=agent.strength.assess(req);
 assessment.phase=agent.phase;assessment.muscleWork=verticalSpeed>.005?'shortening':verticalSpeed<-.005?'lengthening':'holding';
 return assessment;
}
function strengthIdleGuard(lab){
 const a=lab.agent;if(a.held||a.skill||a.plan||a.basic?.busy||['character','torso','headNeck','shoulders','hands'].some(k=>lab[k]?.busy))throw Error('请先完成或停止当前任务，再修改身体力量或状态');
}
function installStrengthAPI(lab){
 const assign=async model=>{
  const current=lab.character.export(),previous=lab.agent.strength;
  const changed=Object.keys(model.profile.groups).some(id=>model.profile.groups[id].volumeCm3!==previous.profile.groups[id].volumeCm3);
  current.strength=model.export();
  if(changed){await lab.character.apply(current);}
  else{lab.agent.strength=model;lab.human.strength=model;lab.human.characterPreset.strength=model.export();}
  lab.human.tissue.ecology?.step(0);lab.agent.strengthLastLengths=null;return lab.agent.strength.report();
 };
 const api={
  presets:()=>Object.entries(STRENGTH_CATALOG.presets).map(([id,p])=>({id,label:p.label})),
  report:()=>lab.agent.strength.report(),export:()=>lab.agent.strength.export(),
  applyPreset(id){strengthIdleGuard(lab);const old=lab.agent.strength,model=new StrengthModel(makeCharacterStrengthProfile(lab.human.bodySex,id),old.state);return assign(model);},
  configure(profile){strengthIdleGuard(lab);return assign(new StrengthModel(profile,lab.agent.strength.state));},
  import(data){strengthIdleGuard(lab);return assign(StrengthModel.fromSnapshot(data));},
  setCondition(id){strengthIdleGuard(lab);const c=STRENGTH_CATALOG.conditions[id];if(!Object.hasOwn(STRENGTH_CATALOG.conditions,id))throw Error('未知状态');const model=lab.agent.strength;model.resetState();model.state.readiness=c.readiness;for(const s of Object.values(model.state.groups))s.fatigue=c.fatigue;lab.human.characterPreset.strength=model.export();return model.report();},
  setReadiness(value){strengthIdleGuard(lab);strengthNumber(value,.2,1,'readiness');lab.agent.strength.state.readiness=value;lab.agent.strength.lastAssessment=null;lab.human.characterPreset.strength=lab.agent.strength.export();return api.report();},
  assess:request=>lab.agent.strength.assess(request),
  compare(request){return api.presets().map(p=>{const model=new StrengthModel(makeCharacterStrengthProfile(lab.human.bodySex,p.id),lab.agent.strength.state);const a=model.assess(request);return {id:p.id,label:p.label,modeledMuscleMassKg:model.modeledMuscleMassKg,feasible:a.feasible,maxUtilization:a.maxUtilization,limitingGroup:a.limitingGroup,reasons:a.reasons};});}
 };
 installStrengthControls(lab,api);return api;
}
function installStrengthControls(lab,api){
 const style=document.createElement('style');style.id='strength-controls-style';
 style.textContent='#strength-open{position:fixed;right:16px;bottom:16px;z-index:72;background:#e5f1eb;color:#204638}#strength-panel{position:fixed;right:16px;bottom:60px;width:min(330px,calc(100vw - 32px));max-height:75vh;overflow:auto;z-index:73;padding:16px;background:#f4f8f5;color:#254239;border:1px solid #a9bfb3;border-radius:10px;box-shadow:0 8px 35px #0003;font:12px/1.6 system-ui}#strength-panel[hidden]{display:none}#strength-panel h2{color:#254239;margin:0;font-size:16px;letter-spacing:0}#strength-panel label{display:block;margin:8px 0}#strength-panel select,#strength-panel input{background:white;color:#254239;max-width:100%;padding:5px}#strength-panel input[type=number]{width:90px}#strength-panel button{background:#dfebe3;color:#254239;margin:4px 4px 4px 0;padding:5px 8px}#strength-panel p{margin:8px 0}#strength-panel table{width:100%;border-collapse:collapse;font-size:11px}#strength-panel td,#strength-panel th{text-align:left;border-bottom:1px solid #d2dfd6;padding:4px}#strength-panel output{display:block;white-space:pre-wrap}#strength-panel .strength-help{color:#60776a;font-size:11px}';
 document.head.append(style);
 const toggle=document.createElement('button');toggle.id='strength-open';toggle.textContent='力量与状态';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','strength-panel');
 const panel=document.createElement('section');panel.id='strength-panel';panel.hidden=true;panel.setAttribute('aria-label','力量与状态');
 panel.innerHTML='<h2>力量与状态</h2><p class="strength-help">肌群参数决定能力，持续用力积累疲劳。这里的数值为模型估算。</p><label>身体配置 <select id="strength-preset"></select></label><button id="strength-apply">应用配置</button><label>状态 <select id="strength-condition"><option value="fresh">充分恢复</option><option value="tired">疲劳状态</option></select></label><button id="strength-condition-apply">应用状态</button><label>当前状态系数 <input id="strength-readiness" type="number" min="0.2" max="1" step="0.05" value="1"></label><button id="strength-readiness-apply">设置状态系数</button><output id="strength-summary"></output><details><summary>调整单侧肌群</summary><label>肌群 <select id="strength-group"></select></label><label>肌肉体积 cm³ <input id="strength-volume" type="number" min="10" max="10000" step="10"></label><button id="strength-volume-apply">应用肌量</button><p class="strength-help">基础体积变化会改变力量和估算体重。应用后同步重建肌肉与皮肤轮廓。疲劳只改变出力和步速，不改变肌量。</p></details><details><summary>任务能力比较</summary><label>动作 <select id="strength-type"><option value="carry">双手搬运</option><option value="push">地面推动</option></select></label><label>重量 kg <input id="strength-mass" type="number" min="0" max="250" value="10" step="1"></label><label>持续时间 秒 <input id="strength-duration" type="number" min="0" max="7200" value="20"></label><label>前伸距离 m <input id="strength-reach" type="number" min="0.05" max="1.2" step="0.05" value="0.34"></label><label>物体滑动摩擦系数 <input id="strength-friction" type="number" min="0" max="2" step="0.05" value="0.4"></label><button id="strength-compare">比较各配置</button><p class="strength-help">比较使用相同的当前疲劳和状态，按持续用力保守估算；不会执行动作。</p><output id="strength-comparison"></output></details><details><summary>各肌群状态</summary><table><thead><tr><th>肌群</th><th>可用力矩</th><th>激活</th><th>疲劳</th></tr></thead><tbody id="strength-groups"></tbody></table></details><button id="strength-export">导出力量存档</button><label>导入力量存档 <input id="strength-import" type="file" accept="application/json,.json"></label><output id="strength-message" role="status"></output>';
 document.body.append(toggle,panel);const el=id=>panel.querySelector('#strength-'+id);
 for(const p of api.presets()){const option=document.createElement('option');option.value=p.id;option.textContent=p.label;el('preset').append(option);}
 for(const id of Object.keys(lab.agent.strength.profile.groups)){const option=document.createElement('option');option.value=id;option.textContent=strengthGroupLabel(id);el('group').append(option);}
 const syncVolume=()=>{el('volume').value=lab.agent.strength.profile.groups[el('group').value].volumeCm3.toFixed(1);};
 const syncPreset=()=>{const id=lab.agent.strength.profile.id;el('preset').value=Object.hasOwn(STRENGTH_CATALOG.presets,id)?id:'custom';};
 const custom=document.createElement('option');custom.value='custom';custom.textContent='自定义肌量';custom.disabled=true;el('preset').append(custom);syncVolume();syncPreset();
 let applying=false;const act=async fn=>{if(applying)return;applying=true;api.refresh();try{el('message').textContent='正在更新身体与能力…';await fn();el('message').textContent='已同步身体与能力';el('comparison').textContent='';el('readiness').value=lab.agent.strength.state.readiness;syncVolume();syncPreset();}catch(e){el('message').textContent=e.message;}finally{applying=false;api.refresh();}};
 toggle.onclick=()=>{panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden){el('readiness').value=lab.agent.strength.state.readiness;syncVolume();syncPreset();api.refresh();}};
 el('apply').onclick=()=>act(()=>api.applyPreset(el('preset').value));el('condition-apply').onclick=()=>act(()=>api.setCondition(el('condition').value));
 el('readiness-apply').onclick=()=>act(()=>api.setReadiness(Number(el('readiness').value)));
 el('group').onchange=syncVolume;el('volume-apply').onclick=()=>act(()=>{const p=api.export().profile;p.groups[el('group').value].volumeCm3=Number(el('volume').value);p.id='custom';p.label='自定义肌量';return api.configure(p);});
 el('compare').onclick=()=>{try{const request={type:el('type').value,massKg:Number(el('mass').value),durationS:Number(el('duration').value),reachM:Number(el('reach').value),objectFriction:Number(el('friction').value)};const current=api.assess(request);const rows=[{label:'当前配置',...current},...api.compare(request)];el('comparison').textContent=rows.map(r=>r.label+'：'+(r.feasible?'可行':'超出能力')+'，需求/余量 '+Math.round(r.maxUtilization*100)+'%'+(r.feasible?'':'；'+strengthReason(r))).join('\n');}catch(e){el('comparison').textContent=e.message;}};
 el('export').onclick=()=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(api.export(),null,2)],{type:'application/json'}));a.href=url;a.download='human-strength.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 el('import').onchange=async event=>{const f=event.target.files[0];if(!f)return;try{if(f.size>65536)throw Error('力量存档不能超过 64 KB');const data=JSON.parse(await f.text());await act(()=>api.import(data));}catch(e){el('message').textContent=e.message;}finally{event.target.value='';}};
 api.refresh=()=>{
  if(panel.hidden)return;const r=api.report(),a=r.lastAssessment,reference=new StrengthModel(lab.agent.strength.profile),current=api.assess({type:'carry',massKg:10,durationS:0,reachM:.34}),fresh=reference.assess({type:'carry',massKg:10,durationS:0,reachM:.34});
  el('summary').textContent=r.label+' · 建模肌群质量 '+r.modeledMuscleMassKg.toFixed(1)+' kg\n估算体重 '+r.bodyMassKg.toFixed(1)+' kg · 状态系数 '+r.readiness.toFixed(2)+'\n步速系数 '+r.movementFactor.toFixed(2)+' · 10 kg 标准负荷利用率 '+Math.round(current.maxUtilization*100)+'%（充分恢复 '+Math.round(fresh.maxUtilization*100)+'%）'+(a?'\n'+(a.feasible?'当前负荷可承受':'当前负荷超限')+' · '+strengthGroupLabel(a.limitingGroup):'');
  el('groups').replaceChildren(...Object.entries(r.groups).map(([id,g])=>{const row=document.createElement('tr');for(const value of [strengthGroupLabel(id),g.availableTorqueNm.toFixed(1)+' Nm',Math.round(g.activation*100)+'%',Math.round(g.fatigue*100)+'%']){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}return row;}));
  const busy=applying||lab.character.busy||!!(lab.agent.held||lab.agent.skill||lab.agent.plan||lab.agent.basic?.busy);
  for(const id of ['apply','condition-apply','readiness-apply','volume-apply','import','preset','condition','readiness','group','volume'])el(id).disabled=busy;
  el('apply').disabled=busy||el('preset').value==='custom';
 };
}

function strengthFreeActivity(agent){
 if(agent.walkSpeed>.025)return agent.strength.activityAssessment('walk',agent.walkSpeed);
 if(agent.basic?.busy)return agent.strength.activityAssessment('basic');
 return null;
}
