// Authored actuator combinations. They evaluate the existing continuous fields;
// no stored expression meshes, source images, or persistent vertex deltas.
export const EXPRESSIONS={
 neutral:{label:'中性',actions:{}},
 relaxed:{label:'放松',actions:{browInnerUp:.35,browOuterUp:.30,mouthSmile:.14}},
 smile:{label:'明显微笑 · 提颊和扬起嘴角',actions:{mouthSmile:1,cheekSquint:.65,mouthDimple:.30,browInnerUp:.20,browOuterUp:.25}},
 focused:{label:'专注',actions:{browDown:.42,cheekSquint:.18,mouthPress:.24}},
 effort:{label:'用力',actions:{browDown:.62,cheekSquint:.36,noseSneer:.12,mouthPress:.38,chinRaise:.16}},
 browRaise:{label:'抬眉 · 额头',actions:{browInnerUp:1,browOuterUp:.85,eyeWide:.55}},
 skeptical:{label:'疑惑 · 左右眉不同步',actions:{browOuterUp:[1,.12],browInnerUp:[.35,0],browDown:[0,.60],mouthPress:.25}},
 frown:{label:'皱眉 · 眉间收紧',actions:{browDown:.95,mouthPress:.18}},
 sad:{label:'低落 · 眉头和口角',actions:{browInnerUp:.75,mouthFrown:.8,chinRaise:.35}},
 sneer:{label:'嫌弃 · 鼻翼和上唇',actions:{noseSneer:.85,mouthUpperUp:.60,browDown:.25}},
 pucker:{label:'撇嘴 · 唇部收拢',actions:{mouthPucker:1,chinRaise:.25}},
 leftSmile:{label:'左侧微笑 · 单侧测试',actions:{mouthSmile:[1,0],cheekSquint:[.25,0]}},
 leftWink:{label:'左眼眨眼 · 眼睑独立测试',actions:{eyeBlink:[1,0],cheekSquint:[.18,0],mouthSmile:[.22,0]}},
 rightWink:{label:'右眼眨眼 · 眼睑独立测试',actions:{eyeBlink:[0,1],cheekSquint:[0,.18],mouthSmile:[0,.22]}},
 rightSmile:{label:'右侧微笑 · 单侧测试',actions:{mouthSmile:[0,1],cheekSquint:[0,.25]}}
};
export class FacialExpression{
 constructor(binding,eyes){this.binding=binding;this.eyes=eyes;this.mode='auto';this.intensity=1;this.weights={};this.time=0;this.lastApplied={};this.report={};this.demo=false;this.demoIndex=0;this.demoTime=0;this.demoModes=Object.keys(EXPRESSIONS);}
 setMode(mode){if(mode!=='auto'&&!EXPRESSIONS[mode])throw Error('Unknown expression');this.demo=false;this.mode=mode;}
 startDemo(){this.demo=true;this.demoIndex=0;this.demoTime=0;this.mode=this.demoModes[0];}
 nextDemo(delta=1){this.demoIndex=(this.demoModes.indexOf(this.mode)+delta+this.demoModes.length)%this.demoModes.length;this.demoTime=0;this.mode=this.demoModes[this.demoIndex];}
 update(c,dt){
  this.time+=dt;if(this.demo){this.demoTime+=dt;if(this.demoTime>=2.6)this.nextDemo();}let target={};
  if(this.mode==='auto'){
   const run=Math.max(0,Math.min(1,(c.speed-1.8)/2.4)),jump=['anticipation','takeoff','flight','fall','landing'].includes(c.phase)?1:0;
   for(const [key,value]of Object.entries(EXPRESSIONS.relaxed.actions))target[key]=value*(1-run)*(1-jump)*.55;
   for(const [key,value]of Object.entries(EXPRESSIONS.focused.actions))target[key]=(target[key]||0)+value*run*.7;
   for(const [key,value]of Object.entries(EXPRESSIONS.effort.actions))target[key]=Math.max(target[key]||0,value*jump*.75);
  }else target=EXPRESSIONS[this.mode].actions;
  const blend=1-Math.exp(-dt*9);let changed=false;
  for(const key of new Set([...Object.keys(this.weights),...Object.keys(target)])){const value=target[key]||0,to=Array.isArray(value)?value:[value,value],from=this.weights[key]||[0,0];this.weights[key]=from.map((v,i)=>v+(to[i]*this.intensity-v)*blend);if(this.weights[key].some((v,i)=>Math.abs(v-(this.lastApplied[key]?.[i]||0))>.0008))changed=true;}
  if((!Object.keys(target).length||this.intensity===0)&&Object.values(this.weights).flat().every(v=>v<.0004)){this.weights={};this.lastApplied={};this.report=this.binding.reset();this.eyes?.update(dt,c,this.weights);return;}
  if(changed){this.report=this.binding.deformActions(this.weights);this.lastApplied={...this.weights};}
  this.eyes?.update(dt,c,this.weights);
 }
 reset(){this.weights={};this.lastApplied={};this.binding.reset();}
}
