// Runs inside the inherited app scope. No separate event or animation loop.
function updateBehaviorUI(){
 if(!eyesRig?.behavior)return;const s=eyesRig.behavior.settings,d=eyesRig.diagnostics();
 $('thEnabled').checked=s.enabled;$('thHead').checked=s.headMotion;$('thPause').checked=s.paused;$('thMood').value=s.mood;
 for(const [id,key,factor] of [['thAmount','headAmount',1],['thContact','eyeContact',1],['thYaw','manualYaw',180/Math.PI],['thPitch','manualPitch',180/Math.PI]]){
  if(document.activeElement!==$(id))$(id).value=s[key]*factor;
  $(id+'Out').textContent=factor===1?Math.round(s[key]*100)+'%':(s[key]*factor).toFixed(1)+'°';
 }
 $('thDiagnostics').textContent=`行为：${s.enabled?'TalkingHead 1.7.0':'ET03'}；原库已采样 ${d.upstreamSteps} 次。控制器：${d.finalWriter}。眨眼控制：${d.controls.blinkOwner==='manual'?'手动':'原库'}；注视控制：${d.controls.gazeOwner}。共享 Three.js r${THREE.REVISION}；无第二渲染器／无语音请求。`;
 $('thFocus').classList.toggle('active',eyesRig.config.mode==='camera');$('thSocial').classList.toggle('active',eyesRig.config.mode==='relaxed');
}
function installBehaviorBindings(){
 const set=value=>{if(!eyesRig?.behavior)return;eyesRig.setBehavior(value);updateBehaviorUI();syncEyeUI();dirty=true;};
 for(const [id,key] of [['thEnabled','enabled'],['thHead','headMotion'],['thPause','paused']])$(id).onchange=()=>set({[key]:$(id).checked});
 $('thMood').onchange=()=>{if(eyesRig)eyesRig.config.manualBlink=-1;set({mood:$('thMood').value,enabled:true});};
 for(const [id,key,factor] of [['thAmount','headAmount',1],['thContact','eyeContact',1],['thYaw','manualYaw',Math.PI/180],['thPitch','manualPitch',Math.PI/180]])$(id).oninput=()=>set({[key]:Number($(id).value)*factor});
 $('thCenter').onclick=()=>set({manualYaw:0,manualPitch:0});
 $('thFocus').onclick=()=>{if(!eyesRig)return;eyesRig.setMode('camera');eyesRig.config.manualBlink=-1;set({enabled:true,mood:'neutral',paused:false});};
 $('thSocial').onclick=()=>{if(!eyesRig)return;eyesRig.setMode('relaxed');eyesRig.config.manualBlink=-1;set({enabled:true,mood:'neutral',paused:false});};
 for(const [id,kind] of [['thDouble','double'],['thWinkL','left'],['thWinkR','right']])$(id).onclick=()=>{if(!eyesRig)return;set({enabled:true,paused:false});eyesRig.blink(kind);$('researchClosure').value=0;updateBehaviorUI();};
 for(const [id,kind] of [['thYes','yes'],['thNo','no']])$(id).onclick=()=>{if(!eyesRig)return;set({enabled:true,headMotion:true,paused:false});eyesRig.gesture(kind);};
 $('reset').addEventListener('click',()=>{eyesRig?.resetBehavior();updateBehaviorUI();});
 window.__TALKINGHEAD__={version:'ET04',info:()=>eyesRig?.diagnostics(),set:value=>set(value),blink:kind=>eyesRig?.blink(kind),gesture:kind=>eyesRig?.gesture(kind),reset:()=>eyesRig?.resetBehavior()};
}
installBehaviorBindings();
