/* Muscle-group capacity envelope, not a forward dynamics solver.
 * PCSA = volume / optimal fiber length. Pennation is applied ONCE to tendon
 * force. Moment arms, length/velocity factors and fatigue rates are authored
 * approximations. See docs/STRENGTH_MODEL_V1.md for scope and calibration.
 * No dependencies on DOM, geometry construction or renderer state. */
const STRENGTH_CATALOG=Object.freeze(/*__STRENGTH_CATALOG_JSON__*/);
const strengthCopy=value=>JSON.parse(JSON.stringify(value));
const strengthClamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function strengthNumber(value,min,max,name){
 if(!Number.isFinite(value)||value<min||value>max)throw Error('力量参数无效：'+name);
 return value;
}
function strengthKeys(value,keys,name){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!keys.includes(k)))throw Error('力量数据字段无效：'+name);
}
function makeStrengthProfile(id='balanced'){
 const c=STRENGTH_CATALOG,p=c.presets[id];if(!Object.hasOwn(c.presets,id))throw Error('未知力量配置');
 const groups={};for(const g of c.groups)for(const side of g.bilateral?['left','right']:['center']){
  groups[side+'_'+g.id]={volumeCm3:g.volumeCm3*p.volumeScale,fiberLengthCm:g.fiberLengthCm,pennationDeg:g.pennationDeg,momentArmM:g.momentArmM,specificTensionNPerCm2:c.specificTensionNPerCm2,recruitment:p.recruitment,fatigueRate:p.fatigueRate,recoveryRate:p.recoveryRate};
 }
 return {schema:'jarvis/strength_profile@1',id,label:p.label,nonModeledMassKg:c.nonModeledMassKg,densityKgPerL:c.densityKgPerL,reserve:c.reserve,groups};
}
function validateStrengthProfile(input){
 const keys=['schema','id','label','nonModeledMassKg','densityKgPerL','reserve','groups'];strengthKeys(input,keys,'profile');
 if(input.schema!=='jarvis/strength_profile@1'||typeof input.id!=='string'||!/^[-a-zA-Z0-9_]{1,64}$/.test(input.id)||typeof input.label!=='string'||input.label.length>80)throw Error('力量配置格式无效');
 const expected=Object.keys(makeStrengthProfile().groups);strengthKeys(input.groups,expected,'groups');
 if(Object.keys(input.groups).length!==expected.length)throw Error('力量配置缺少肌群');
 strengthNumber(input.nonModeledMassKg,25,150,'nonModeledMassKg');strengthNumber(input.densityKgPerL,1,1.1,'densityKgPerL');strengthNumber(input.reserve,.5,.95,'reserve');
 const bounds={volumeCm3:[10,10000],fiberLengthCm:[2,40],pennationDeg:[0,45],momentArmM:[.005,.15],specificTensionNPerCm2:[10,60],recruitment:[.2,1],fatigueRate:[.0001,.05],recoveryRate:[.0001,.1]};
 for(const id of expected){strengthKeys(input.groups[id],Object.keys(bounds),id);for(const [key,[lo,hi]]of Object.entries(bounds))strengthNumber(input.groups[id][key],lo,hi,id+'.'+key);}
 return strengthCopy(input);
}
class StrengthModel{
 constructor(profile=makeStrengthProfile(),state=null){this.profile=validateStrengthProfile(profile);this.resetState();if(state)this.setState(state);this.lastAssessment=null;}
 resetState(){this.state={schema:'jarvis/strength_state@1',readiness:1,elapsedS:0,groups:Object.fromEntries(Object.keys(this.profile.groups).map(id=>[id,{fatigue:0,activation:0}]))};this.lastAssessment=null;}
 setState(input){
  strengthKeys(input,['schema','readiness','elapsedS','groups'],'state');if(input.schema!=='jarvis/strength_state@1')throw Error('力量状态版本无效');
  strengthNumber(input.readiness,.2,1,'readiness');strengthNumber(input.elapsedS,0,1e9,'elapsedS');
  const ids=Object.keys(this.profile.groups);strengthKeys(input.groups,ids,'state.groups');if(Object.keys(input.groups).length!==ids.length)throw Error('力量状态缺少肌群');
  for(const id of ids){strengthKeys(input.groups[id],['fatigue','activation'],id);for(const key of ['fatigue','activation'])strengthNumber(input.groups[id][key],0,1,id+'.'+key);}
  this.state=strengthCopy(input);this.lastAssessment=null;
 }
 clone(){const model=new StrengthModel(this.profile,this.state);model.environmentFactor=this.environmentFactor??1;return model;}
 export(){return {schema:'jarvis/strength_snapshot@1',profile:strengthCopy(this.profile),state:strengthCopy(this.state)};}
 static fromSnapshot(data){strengthKeys(data,['schema','profile','state'],'snapshot');if(data.schema!=='jarvis/strength_snapshot@1')throw Error('力量存档版本无效');return new StrengthModel(data.profile,data.state);}
 get modeledMuscleMassKg(){return Object.values(this.profile.groups).reduce((n,g)=>n+g.volumeCm3,0)/1000*this.profile.densityKgPerL;}
 get bodyMassKg(){return this.profile.nonModeledMassKg+this.modeledMuscleMassKg;}
 capacity(id,lengthRatio=1,shorteningPerS=0){
  const g=this.profile.groups[id],s=this.state.groups[id];if(!g)throw Error('未知力量肌群：'+id);
  strengthNumber(lengthRatio,.4,1.8,'lengthRatio');strengthNumber(shorteningPerS,-3,3,'shorteningPerS');
  const pcsaCm2=g.volumeCm3/g.fiberLengthCm,maxTendonForceN=pcsaCm2*g.specificTensionNPerCm2*Math.cos(g.pennationDeg*Math.PI/180);
  const lengthFactor=Math.exp(-(((lengthRatio-1)/.5)**2));
  // Positive velocity means shortening. Eccentric capacity is conservatively
  // capped at isometric here; no extra force is credited for lowering loads.
  const velocityFactor=shorteningPerS>0?1/(1+shorteningPerS):1;
  const availableForceN=maxTendonForceN*g.recruitment*this.state.readiness*(this.environmentFactor??1)*(1-.8*s.fatigue)*lengthFactor*velocityFactor;
  return {pcsaCm2,maxTendonForceN,availableForceN,availableTorqueNm:availableForceN*g.momentArmM,lengthFactor,velocityFactor};
 }
 assess(input){
  strengthKeys(input,['type','massKg','durationS','reachM','elbowLeverM','crouch','speedMps','accelerationMps2','objectFriction','groundFriction','gripFriction','slopeRad','pushHeightM','bodyBackshiftM','supportHalfLengthM','leftShare','lengthRatios','shorteningRates'],'task');
  if(!['carry','push'].includes(input.type))throw Error('力量模型当前支持搬运与推动');
  const value=(key,def,lo,hi)=>strengthNumber(input[key]??def,lo,hi,key);
  const mass=value('massKg',0,0,2000),duration=value('durationS',0,0,7200),reach=value('reachM',.34,.05,1.2),elbow=value('elbowLeverM',.20,.02,.7),crouch=value('crouch',0,0,1),speed=value('speedMps',0,0,3),accel=value('accelerationMps2',0,0,5),slope=value('slopeRad',0,-.35,.35);
  const mu=value('objectFriction',.4,0,2),ground=value('groundFriction',.65,0,2),grip=value('gripFriction',.6,.05,2),height=value('pushHeightM',.55,.05,1.8),back=value('bodyBackshiftM',.04,0,.12),support=value('supportHalfLengthM',.14,.03,.4),leftShare=value('leftShare',.5,0,1);
  for(const key of ['lengthRatios','shorteningRates'])if(input[key]!=null){strengthKeys(input[key],Object.keys(this.profile.groups),key);for(const n of Object.values(input[key]))strengthNumber(n,key==='lengthRatios'?.4:-3,key==='lengthRatios'?1.8:3,key);}
  const body=this.bodyMassKg,g=9.81,push=input.type==='push',weight=mass*g,vertical=weight+mass*accel;
  const pushN=mass*g*(mu*Math.cos(slope)+Math.abs(Math.sin(slope)))+mass*accel;
  const demand={},units={},reserve=this.profile.reserve;
  const add=(id,n,unit='Nm')=>{demand[id]=Math.max(0,n);units[id]=unit;};
  for(const side of ['left','right']){
   const share=side==='left'?leftShare:1-leftShare;
   // Segment self weight is retained even for zero external payload.
   const armWeight=body*.049*g;
   add(side+'_shoulder',(push?pushN*share*.22:vertical*share*reach)+armWeight*.10);
   add(side+'_elbowFlexors',push?armWeight*.035:vertical*share*elbow+armWeight*.035);
   add(side+'_elbowExtensors',push?pushN*share*.12:vertical*share*.025);
   // Finger transmission is an authored leverage factor, not tendon force at
   // the contact. Opposing palms must generate normal force for friction.
   add(side+'_grip',push?pushN*share*.15:vertical*share/grip,'N');
   const supported=(body+(push?0:mass))*g/2;
   add(side+'_hip',supported*(.035+.16*crouch)+(push?pushN*.15:0));
   add(side+'_knee',supported*(.025+.14*crouch));
   add(side+'_ankle',supported*.055+(push?pushN*.055:0)+body*speed*.35);
  }
  add('center_trunk',body*.5*g*(.035+.13*crouch)+(push?pushN*.22:vertical*reach*.65));
  const groups={},reasons=[];
  for(const [id,required]of Object.entries(demand)){
   const group=this.profile.groups[id],state=this.state.groups[id];
   const cap=this.capacity(id,input.lengthRatios?.[id]??1,input.shorteningRates?.[id]??0);
   const available=(units[id]==='N'?cap.availableForceN*.55:cap.availableTorqueNm)*reserve;
   // Conservative horizon: assume full activation and no recovery for active
   // groups over the entire loaded interval. Execution uses actual effort.
   const projectedFatigue=required>0?1-(1-state.fatigue)*Math.exp(-group.fatigueRate*duration):state.fatigue;
   const endAvailable=available*(1-.8*projectedFatigue)/(1-.8*state.fatigue);
   const ratio=required/Math.max(1e-8,available),endRatio=required/Math.max(1e-8,endAvailable);
   groups[id]={required,available,endAvailable,unit:units[id],ratio,endRatio,activation:strengthClamp(ratio*reserve,0,1),projectedFatigue,...cap};
   if(endRatio>1)reasons.push(id+' '+(ratio>1?'当前力量不足':'持续用力余量不足'));
  }
  // Simple sagittal contact envelope; no 3D COM/ZMP or collision solver.
  const tractionRatio=push?pushN/Math.max(1e-8,ground*body*g*Math.cos(slope)):0;
  const balanceRatio=push?pushN*height/Math.max(1e-8,body*g*(support+back)):Math.abs(mass*reach-body*back)/Math.max(1e-8,(body+mass)*support);
  if(tractionRatio>1)reasons.push('脚下摩擦不足');if(balanceRatio>1)reasons.push('前后方向支撑余量不足');
  const limiting=Object.entries(groups).sort((a,b)=>b[1].endRatio-a[1].endRatio)[0];
  return {schema:'jarvis/strength_assessment@1',type:input.type,feasible:reasons.length===0,reasons,groups,limitingGroup:limiting[0],maxUtilization:Math.max(limiting[1].endRatio,tractionRatio,balanceRatio),tractionRatio,balanceRatio,requiredPushN:push?pushN:0,bodyMassKg:body,durationS:duration,request:strengthCopy(input),model:'muscle-group-capacity-envelope',calibrated:false,fullDynamics:false};
 }
 movementFactor(){
  const ids=['left_hip','right_hip','left_knee','right_knee','left_ankle','right_ankle'],base=makeStrengthProfile();
  const condition=Math.min(...ids.map(id=>this.state.readiness*(this.environmentFactor??1)*(1-.8*this.state.groups[id].fatigue)));
  const muscle=ids.reduce((v,id)=>v+this.profile.groups[id].volumeCm3/base.groups[id].volumeCm3,0)/ids.length;
  return strengthClamp(condition*Math.sqrt(muscle),.25,1.05);
 }
 activityAssessment(kind,speedMps=0){
  const groups={};let limitingGroup='center_trunk',maxUtilization=0;
  for(const [id,g]of Object.entries(this.profile.groups)){
   const lower=/_(hip|knee|ankle)$/.test(id),restDemand=kind==='walk'?(lower?.15+.13*strengthClamp(speedMps,0,1.5):.035):lower?.08:.10;
   const state=this.state.groups[id],condition=this.state.readiness*(this.environmentFactor??1)*(1-.8*state.fatigue),ratio=restDemand/Math.max(.05,condition);
   groups[id]={activation:strengthClamp(ratio,0,1),ratio,endRatio:ratio};if(ratio>maxUtilization){maxUtilization=ratio;limitingGroup=id;}
  }
  return {type:kind,feasible:true,groups,limitingGroup,maxUtilization,reasons:[],model:'authored activity effort',calibrated:false};
 }
 advance(dt,assessment=null){
  strengthNumber(dt,0,1,'dt');if(dt===0)return;
  const all=this.state.groups;
  for(const [id,g]of Object.entries(this.profile.groups)){
   const s=all[id],target=assessment?.groups[id]?.activation??0;
   const tau=target>s.activation?.045:.12;s.activation+=(target-s.activation)*(1-Math.exp(-dt/tau));
   const fatigue=g.fatigueRate*s.activation*s.activation,recovery=g.recoveryRate*(1-s.activation)**2,rate=fatigue+recovery;
   const equilibrium=fatigue/rate;s.fatigue=strengthClamp(equilibrium+(s.fatigue-equilibrium)*Math.exp(-rate*dt),0,1);
  }
  this.state.elapsedS+=dt;this.lastAssessment=assessment;
 }
 project(assessment,durationS){
  // Planning works on a private clone and carries conservative fatigue into
  // following steps; it never changes live activation or simulation time.
  for(const [id,row]of Object.entries(assessment.groups)){this.state.groups[id].fatigue=row.projectedFatigue;this.state.groups[id].activation=row.activation;}
  this.state.elapsedS+=durationS;
 }
 recover(seconds){strengthNumber(seconds,0,7200,'seconds');for(const [id,g]of Object.entries(this.profile.groups)){this.state.groups[id].fatigue*=Math.exp(-g.recoveryRate*seconds);this.state.groups[id].activation=0;}this.state.elapsedS+=seconds;}
 activationForMuscle(id){
  const side=/^left_/.test(id)?'left':/^right_/.test(id)?'right':null;
  const name=id.replace(/^(left|right)_/,'');let group;
  if(/biceps_femoris|hamstring|glute|adductor|semimembranosus|semitendinosus/.test(name))group='hip';
  else if(/rectus_femoris|vastus|quad/.test(name))group='knee';
  else if(/calf|gastrocnemius|soleus|tibialis|fibularis/.test(name))group='ankle';
  else if(/biceps|brachialis/.test(name))group='elbowFlexors';
  else if(/triceps/.test(name))group='elbowExtensors';
  else if(/forearm|flexor|extensor/.test(name))group='grip';
  else if(/deltoid|pector|latissimus|trapezius/.test(name))group='shoulder';
  else if(/erector|abdominis|oblique/.test(name))return this.state.groups.center_trunk.activation;
  else return null;
  return side?this.state.groups[side+'_'+group].activation:null;
 }
 report(){return {schema:'jarvis/strength_report@1',profileId:this.profile.id,label:this.profile.label,modeledMuscleMassKg:this.modeledMuscleMassKg,bodyMassKg:this.bodyMassKg,readiness:this.state.readiness,environmentFactor:this.environmentFactor??1,movementFactor:this.movementFactor(),groups:Object.fromEntries(Object.entries(this.profile.groups).map(([id,g])=>[id,{...g,...this.state.groups[id],...this.capacity(id)}])),lastAssessment:this.lastAssessment,calibrated:false,fullDynamics:false,visualAcceptance:false};}
}
