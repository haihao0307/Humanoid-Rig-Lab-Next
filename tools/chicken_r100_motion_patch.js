// CHICKEN_R100_SINGLE_AGENT_MOTION_PATCH
window.__CHICKEN_R100_PATCH__=Object.freeze({
 version:'V4.6_R10.0_SINGLE_AGENT_BEHAVIOR_FOUNDATION',
 morphologySource:'V4.6_R9.9.1_CONTINUOUS_RING_REFIT_CANDIDATE',
 behaviorScope:['idle_stand','look','peck','walk','stop','turn','short_run','wing_balance'],
 groupTestAuthorized:false,manualVisualAcceptance:false,productionReady:false
});

const __phase1BaseBuild=build;
let __phase1Runtime=null;
build=function(){
 if(__phase1Runtime?.skin){__phase1Runtime.skin.detach();__phase1Runtime.skin=null;}
 __phase1BaseBuild();
 if(__phase1Runtime?.modules)__phase1Runtime.installSkin();
};

const __phase1SkinnedSurfaceVertex=`
#include <common>
#include <skinning_pars_vertex>
varying vec3 vRest,vWorld,vNormal,vLocal,vRestNormal;
varying vec2 vUv;
varying float vSeed,vZone,vKind;
attribute float seed,zone,kind;attribute vec3 localCoord;
void main(){
 vRest=position;vRestNormal=normal;vLocal=localCoord;vSeed=seed;vZone=zone;vKind=kind;vUv=uv;
 #include <beginnormal_vertex>
 #include <skinbase_vertex>
 #include <skinnormal_vertex>
 #include <begin_vertex>
 #include <skinning_vertex>
 vNormal=normalize(mat3(modelMatrix)*objectNormal);
 vec4 w=modelMatrix*vec4(transformed,1.0);vWorld=w.xyz;
 gl_Position=projectionMatrix*viewMatrix*w;
}`;

function __phase1EnableShaderSkinning(){
 for(const material of Object.values(r3materials)){
  material.vertexShader=__phase1SkinnedSurfaceVertex;
  material.defines={...(material.defines||{}),USE_SKINNING:''};
  material.needsUpdate=true;
 }
}

function __phase1Panel(){
 if(document.querySelector('#phase1-motion-panel'))return;
 const panel=document.createElement('section');panel.id='phase1-motion-panel';panel.innerHTML=`<style>
 #phase1-motion-panel{position:fixed;left:18px;bottom:18px;z-index:50;width:min(430px,calc(100vw - 36px));padding:12px;border:1px solid #4f626a;border-radius:10px;background:rgba(15,23,28,.94);box-shadow:0 12px 36px #0008;color:#e6efee;font:12px/1.4 system-ui,-apple-system,Segoe UI,Microsoft Yahei,sans-serif}
 #phase1-motion-panel .row{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}#phase1-motion-panel button{border:1px solid #51656c;border-radius:6px;background:#27363b;color:#edf3f2;padding:6px 9px;cursor:pointer}#phase1-motion-panel button.active{background:#8a6732;border-color:#d0a75d}#phase1-motion-status{margin-top:8px;color:#9fd5c8;white-space:pre-wrap}#phase1-motion-panel b{font-size:13px}
 </style><b>Phase 1 · 单只鸡基础动作</b><div>先验证形态、骨链、脚底接触和基础行为；群体测试保持关闭。</div><div class="row"><button data-p1-action="idle">站立</button><button data-p1-action="look">观察</button><button data-p1-action="peck">啄地</button><button data-p1-action="walk">行走</button><button data-p1-action="turn">步进转向</button><button data-p1-action="run">短跑</button><button data-p1-action="wing">翼平衡</button><button data-p1-action="stop">停止</button><button data-p1-auto="1">自动演示</button></div><div id="phase1-motion-status">正在建立骨链……</div>`;
 document.body.appendChild(panel);
 for(const button of panel.querySelectorAll('[data-p1-action]'))button.onclick=()=>window.__CHICKEN_PHASE1_MOTION__?.setAction(button.dataset.p1Action);
 panel.querySelector('[data-p1-auto]').onclick=()=>window.__CHICKEN_PHASE1_MOTION__?.toggleAuto();
}

__phase1Panel();

Promise.all([
 import('./runtime/chicken_phase1_npc_controller.mjs'),
 import('./runtime/chicken_phase1_articulated_skin.mjs')
]).then(([controllerModule,skinModule])=>{
 const variant=controllerModule.createChickenVariant(460100);
 const controller=new controllerModule.ChickenNpcController({id:1,variant,position:[0,variant.collision.hipHeight,0],yaw:0});
 const runtime={modules:{controllerModule,skinModule},controller,variant,skin:null,ready:false,auto:true,action:'idle',observedStates:new Set(),lastPose:null,lastApply:null,lastTime:performance.now(),demoIndex:0,demoElapsed:0,demoAction:'idle',manualWingUntil:0,errors:[]};
 runtime.installSkin=()=>{
  try{
   __phase1EnableShaderSkinning();
   runtime.skin=skinModule.createChickenPhase1ArticulatedSkin(T,candidateGroup,candidateMeshes,{rootOrigin:[0,variant.collision.hipHeight,0],rootMotionScale:.42});
   runtime.ready=true;
  }catch(error){runtime.errors.push(String(error?.stack||error));runtime.ready=false;console.error(error);}
 };
 runtime.installSkin();
 __phase1Runtime=runtime;

 const setAction=(name)=>{
  runtime.auto=false;runtime.action=name;runtime.demoElapsed=0;
  const p=controller.position,y=controller.yaw,fx=Math.cos(y),fz=Math.sin(y);
  if(name==='idle'||name==='stop')controller.setIntent({type:'idle'});
  else if(name==='look')controller.setIntent({type:'lookAt',x:p[0]+fx*.28-fz*.20,z:p[2]+fz*.28+fx*.20,duration:1.4});
  else if(name==='peck')controller.setIntent({type:'peckAt',x:p[0]+fx*.25,z:p[2]+fz*.25,duration:1.15});
  else if(name==='walk')controller.setIntent({type:'moveTo',x:p[0]+fx*.62,z:p[2]+fz*.62,radius:.05,urgency:.18});
  else if(name==='turn')controller.setIntent({type:'moveTo',x:p[0]-fz*.42,z:p[2]+fx*.42,radius:.05,urgency:.12});
  else if(name==='run')controller.setIntent({type:'moveTo',x:p[0]+fx*.95,z:p[2]+fz*.95,radius:.06,urgency:.92});
  else if(name==='wing'){controller.setIntent({type:'moveTo',x:p[0]-fz*.72,z:p[2]+fx*.72,radius:.06,urgency:.88});runtime.manualWingUntil=performance.now()+1000;}
  for(const b of document.querySelectorAll('[data-p1-action]'))b.classList.toggle('active',b.dataset.p1Action===name);
 };
 const demo=[['idle',1.25],['look',1.35],['peck',1.25],['walk',1.9],['turn',1.35],['run',1.45],['wing',1.25],['stop',.9]];
 const applyDemoAction=name=>{const p=controller.position,y=controller.yaw,fx=Math.cos(y),fz=Math.sin(y);runtime.demoAction=name;
  if(name==='idle'||name==='stop')controller.setIntent({type:'idle'});
  else if(name==='look')controller.setIntent({type:'lookAt',x:p[0]+fx*.28-fz*.20,z:p[2]+fz*.28+fx*.20,duration:1.1});
  else if(name==='peck')controller.setIntent({type:'peckAt',x:p[0]+fx*.24,z:p[2]+fz*.24,duration:1.05});
  else if(name==='walk')controller.setIntent({type:'moveTo',x:p[0]+fx*.52,z:p[2]+fz*.52,radius:.05,urgency:.18});
  else if(name==='turn')controller.setIntent({type:'moveTo',x:p[0]-fz*.38,z:p[2]+fx*.38,radius:.05,urgency:.12});
  else if(name==='run')controller.setIntent({type:'moveTo',x:p[0]+fx*.76,z:p[2]+fz*.76,radius:.05,urgency:.9});
  else if(name==='wing'){controller.setIntent({type:'moveTo',x:p[0]+fz*.62,z:p[2]-fx*.62,radius:.05,urgency:.88});runtime.manualWingUntil=performance.now()+900;}
 };
 applyDemoAction(demo[0][0]);
 function updatePanel(){const status=document.querySelector('#phase1-motion-status');if(!status)return;const d=runtime.skin?.diagnostics();status.textContent=`状态：${runtime.lastPose?.state||'等待'} · 骨链：${d?.boneCount||0} · 蒙皮网格：${d?.skinnedMeshCount||0}\n脚底：L ${runtime.lastPose?.contacts?.leftFoot?'接触':'离地'} / R ${runtime.lastPose?.contacts?.rightFoot?'接触':'离地'} · 固定骨长：${d?.lastInvariantReport?.passed===false?'失败':'通过'} · 群体：关闭`;}
 function tick(now){
  const dt=Math.min(1/15,Math.max(1/240,(now-runtime.lastTime)/1000||1/60));runtime.lastTime=now;
  if(runtime.auto){runtime.demoElapsed+=dt;const current=demo[runtime.demoIndex];if(runtime.demoElapsed>=current[1]){runtime.demoElapsed=0;runtime.demoIndex=(runtime.demoIndex+1)%demo.length;applyDemoAction(demo[runtime.demoIndex][0]);}}
  if(runtime.ready&&runtime.skin){
   try{const pose=controller.update(dt,{groundHeight:0,obstacles:[]});if(now<runtime.manualWingUntil){const pulse=Math.sin(Math.min(1,(runtime.manualWingUntil-now)/900)*Math.PI);pose.wings.leftOpen=Math.max(pose.wings.leftOpen,pulse*.82);pose.wings.rightOpen=Math.max(pose.wings.rightOpen,pulse*.82);}runtime.lastPose=pose;runtime.observedStates.add(pose.state);runtime.lastApply=runtime.skin.applyPose(pose);requestRender();}catch(error){runtime.errors.push(String(error?.stack||error));console.error(error);runtime.ready=false;}
  }
  if((runtime.frame=(runtime.frame||0)+1)%10===0)updatePanel();requestAnimationFrame(tick);
 }
 requestAnimationFrame(tick);
 window.__CHICKEN_PHASE1_MOTION__=Object.freeze({
  get ready(){return runtime.ready},
  setAction,
  toggleAuto(){runtime.auto=!runtime.auto;if(runtime.auto){runtime.demoIndex=0;runtime.demoElapsed=0;applyDemoAction(demo[0][0]);}return runtime.auto;},
  setAuto(value){runtime.auto=!!value;if(runtime.auto){runtime.demoIndex=0;runtime.demoElapsed=0;applyDemoAction(demo[0][0]);}return runtime.auto;},
  diagnostics(){return{schema:'life_ecosystem/chicken_phase1_motion_demo_diagnostics@1.0',ready:runtime.ready,auto:runtime.auto,action:runtime.action,demoAction:runtime.demoAction,controllerState:runtime.lastPose?.state||null,observedStates:[...runtime.observedStates],pose:runtime.lastPose,skin:runtime.skin?.diagnostics()||null,lastApply:runtime.lastApply,errors:[...runtime.errors],groupTestAuthorized:false};}
 });
 updatePanel();
}).catch(error=>{console.error(error);const status=document.querySelector('#phase1-motion-status');if(status)status.textContent=`骨链初始化失败：${error.message}`;});
