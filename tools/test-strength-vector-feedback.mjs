// Directional load feedback must distinguish lifting, lowering and horizontal
// braking, and it must read the pelvis actually committed to the final pose.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const model=read('body/StrengthModel.js').replace('/*__STRENGTH_CATALOG_JSON__*/',read('body/StrengthProfiles.json'));
const bridge=read('body/StrengthBridge.js');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s),len=a=>Math.hypot(...a),dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0),norm=a=>{const n=len(a);return n?mul(a,1/n):[0,0,0]},horizontal=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
const api=vm.runInNewContext(model+'\n'+bridge+'\n({StrengthModel,makeStrengthProfile,strengthRuntimeAssessment})',{
 structuredClone,clamp,sub,mul,len,dot,norm,horizontal,requireCharacterIdle(){},document:{},window:{},URL:{},Blob:class{},strengthFreeActivity(){return null}
});
const request={type:'carry',massKg:10,durationS:0,reachM:.34,elbowLeverM:.2,crouch:.2,speedMps:0,objectFriction:.4,groundFriction:.65,gravityMps2:9.81,gripFriction:.6,pushHeightM:.55};
const assess=vector=>new api.StrengthModel(api.makeStrengthProfile()).assess({...request,accelerationMps2:Math.hypot(...vector),accelerationVectorMps2:vector});
const still=assess([0,0,0]),up=assess([0,2,0]),down=assess([0,-2,0]),horizontalLoad=assess([2,0,0]);
assert(up.verticalControlN>still.verticalControlN,'upward acceleration must add lifting demand');
assert(still.verticalControlN>down.verticalControlN,'downward acceleration must reduce lifting demand within the model envelope');
assert(Math.abs(horizontalLoad.verticalControlN-still.verticalControlN)<1e-12,'horizontal braking must not be reclassified as vertical load');
assert(Math.abs(horizontalLoad.horizontalForceN-20)<1e-12,'horizontal force must preserve acceleration direction and magnitude');
const pushBase=new api.StrengthModel(api.makeStrengthProfile()).assess({...request,type:'push',accelerationMps2:0,accelerationVectorMps2:[0,0,0]});
const pushVertical=new api.StrengthModel(api.makeStrengthProfile()).assess({...request,type:'push',accelerationMps2:2,accelerationVectorMps2:[0,2,0]});
const pushHorizontal=new api.StrengthModel(api.makeStrengthProfile()).assess({...request,type:'push',accelerationMps2:2,accelerationVectorMps2:[2,0,0]});
const pushLegacyScalar=new api.StrengthModel(api.makeStrengthProfile()).assess({...request,type:'push',accelerationMps2:2});
const carryLegacyScalar=new api.StrengthModel(api.makeStrengthProfile()).assess({...request,accelerationMps2:2});
assert(Math.abs(pushVertical.requiredPushN-pushBase.requiredPushN)<1e-12,'vertical object motion must not become horizontal push force');
assert(pushHorizontal.requiredPushN>pushBase.requiredPushN,'horizontal acceleration must increase push force');
assert(Math.abs(pushLegacyScalar.requiredPushN-pushHorizontal.requiredPushN)<1e-12,'legacy push planning must retain its historical horizontal acceleration axis');
assert(Math.abs(carryLegacyScalar.verticalControlN-up.verticalControlN)<1e-12,'legacy carry planning must retain its conservative upward acceleration axis');
const makeJoint=p=>({world:{p}}),arms={
 left:{upper:makeJoint([-.2,1.2,0]),elbow:makeJoint([-.4,1.0,.05]),wrist:makeJoint([-.5,.9,.1])},
 right:{upper:makeJoint([.2,1.2,0]),elbow:makeJoint([.4,1.0,.05]),wrist:makeJoint([.5,.9,.1])}
};
const object={id:'box',mass:10,h:.5,friction:.4,gripFriction:.6,v:[.2,0,0]};
const agent={held:object,skill:{type:'carry'},phase:'travel',arms,strength:new api.StrengthModel(api.makeStrengthProfile()),strengthLastLengths:null,
 strengthLastObjectVelocity:{id:'box',v:[0,0,0]},pos:[0,1,0],h:{arms,root:{p:[0,.6,0]},bodyMetrics:{restHipHeightM:1,crouchLowHipM:.5},palm:side=>({p:side==='left'?[-.5,.9,.1]:[.5,.9,.1]})},
 w:{physicsSettings:{gravityMps2:9.81,groundFriction:.65}}};
const runtime=api.strengthRuntimeAssessment(agent,null,.1);
assert(Math.abs(runtime.request.accelerationVectorMps2[0]-2)<1e-12&&runtime.request.accelerationVectorMps2[1]===0,'runtime request must keep the solved acceleration direction');
assert(Math.abs(runtime.postureInput.pelvisHeightM-.6)<1e-12,'runtime strength must read the final committed pelvis height');
assert(Math.abs(runtime.postureInput.crouch-.8)<1e-12,'runtime crouch must be derived from the final pelvis, not the navigation root');
assert(Math.abs(runtime.measuredAccelerationMps2-2)<1e-12);
console.log(JSON.stringify({schema:'human/strength_vector_feedback@1',verticalControlN:{down:down.verticalControlN,still:still.verticalControlN,up:up.verticalControlN,horizontal:horizontalLoad.verticalControlN},horizontalForceN:horizontalLoad.horizontalForceN,runtimeVector:runtime.request.accelerationVectorMps2,postureInput:runtime.postureInput,calibrated:false,browserExecuted:false,gpuExecuted:false,visualAcceptance:false}));
