// Real Cannon bodies + the actual Agent feedback method. Artificial planning
// waits must not age resistance/contact counters; genuine stalls still fail.
// This isolates feedback from pose solving, rendering and task timeout policy.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as C from '../world/physics/vendor/cannon-es.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const runtime=read('source/runtime.template.js'),math=runtime.split('// MODULE math')[1].split('function matrix')[0];
const graspResidual=runtime.match(/function graspResidual[^\r\n]+/)[0];
const source=math+'\n'+graspResidual+'\n'+read('world/PhysicsContract.js')+'\n'+read('world/PhysicsWorld.js')+'\n'+read('control/TaskAgent.js');
const api=vm.runInNewContext(source+'\n({PhysicsWorld,Agent,frame,compose})',{WorkbenchPhysicsEngine:C,structuredClone,performance});
const dt=1/120,waitingSteps=420;
function fixture(mode,palmOffsetM=0){
 const object={id:'held',shape:'box',w:.3,h:.4,d:.3,mass:.5,friction:.2,restitution:0,movable:true,collidable:true,p:[0,.2,0],q:[0,0,0,1],v:[0,0,0],angularVelocity:[0,0,0],held:true,heldOwner:'one'};
 const world={objects:[object],bounds:{xMin:-13,xMax:13,zMin:-9,zMax:9},physicsSettings:{gravityMps2:9.81,groundFriction:.65},revision:0};
 world.physics=new api.PhysicsWorld(world);
 const grips={left:api.frame([-.15,.2,0]),right:api.frame([.15,.2,0])};
 const human={byId:new Map(),bodyMetrics:{torsoRadiusM:.15,headRadiusM:.1,armRadiusM:.04,legRadiusM:.07},palm:side=>{
  const result=api.compose(api.frame(object.p,object.q),grips[side]);result.p[0]+=palmOffsetM;return result;
 }};
 const agent=Object.assign(Object.create(api.Agent.prototype),{npcId:'one',h:human,w:world,pos:[0,0,-1],held:object,grips,
  preflightWaiting:mode==='preflight',paused:false,phase:mode==='preflight'?'placeSettle':'release',
  skill:{type:'carry',coupling:{intent:api.frame([0,.26,0]),pace:1,braking:false,blockedS:.125},physicalContactErrorS:.125,...(mode==='releaseVerified'?{releaseVerified:{waitS:0}}:{})},
  stats:{maxPhysicalGripErrorM:0,maxPalmResidualM:0}});
 world.physics.setManipulation(object,api.frame(object.p,object.q),'carry',{ownerId:'one',maxForceN:20,maxHorizontalForceN:20,maxTorqueNm:2});
 return{agent,object,physics:world.physics,step(){world.physics.step(dt,[agent]);agent.assessManipulationFeedback(dt);}};
}
let cases=0,steps=0;const results=[];
for(const mode of ['preflight','releaseVerified']){
 const f=fixture(mode),before=JSON.stringify(f.agent.skill.coupling),contactBefore=f.agent.skill.physicalContactErrorS;
 for(let i=0;i<waitingSteps;i++){f.step();steps++;assert.equal(JSON.stringify(f.agent.skill.coupling),before,'artificial wait cannot alter pace or resistance counters');assert.equal(f.agent.skill.physicalContactErrorS,contactBefore);}
 assert.equal(f.physics.stepCount,waitingSteps,'the shared physics clock continues');
 assert.equal(f.physics.frozen.has(f.object.id),mode==='preflight','release verification must use unfrozen physics');
 if(mode==='preflight')assert.equal(f.physics.objectState(f.object.id).supported,false);
 else assert(f.physics.objectState(f.object.id).supported,'release handshake obtains real ground contact');
 // Remove only the artificial waiting state. The same 60 mm unfulfilled
 // intent must once again accumulate resistance and reach the normal limit.
 f.agent.preflightWaiting=false;delete f.agent.skill.releaseVerified;
 let error=null,resumedSteps=0;
 for(;resumedSteps<480;resumedSteps++){try{f.step();steps++;}catch(e){error=e;steps++;resumedSteps++;break;}}
 assert.match(error?.message||'',/物理抓握受阻或偏转过大/);
 assert(f.agent.skill.coupling.blockedS>2.5&&resumedSteps>240&&resumedSteps<360,'ordinary resistance timeout remains active after waiting');
 assert.equal(f.agent.stats.maxPalmResidualM,0,'this failure is a real unresolved intent, not a lost palm contact');
 results.push({mode,waitingS:waitingSteps*dt,resumedStallS:resumedSteps*dt,blockedS:f.agent.skill.coupling.blockedS});cases++;
}
// Explicitly stress the other timer: a 50 mm palm discrepancy must stay
// paused during artificial waits, then fail once real feedback resumes.
for(const mode of ['preflight','releaseVerified']){
 const f=fixture(mode,.05),before=f.agent.skill.physicalContactErrorS;
 for(let i=0;i<waitingSteps;i++){f.step();steps++;assert.equal(f.agent.skill.physicalContactErrorS,before);assert.equal(f.agent.skill.coupling.blockedS,.125);}
 f.agent.preflightWaiting=false;delete f.agent.skill.releaseVerified;
 let error=null,resumedSteps=0;
 for(;resumedSteps<120;resumedSteps++){try{f.step();steps++;}catch(e){error=e;steps++;resumedSteps++;break;}}
 assert.match(error?.message||'',/双掌已无法跟随物体的实际接触位置/);
 assert(f.agent.skill.physicalContactErrorS>.4&&resumedSteps>24&&resumedSteps<60,'real loss of contact still reaches its original timeout');
 results.push({mode,palmErrorM:.05,waitingS:waitingSteps*dt,resumedContactFailureS:resumedSteps*dt});cases++;
}
console.log(JSON.stringify({cases,steps,engine:'cannon-es',actualAgentFeedback:true,artificialWaitCountersPreserved:true,realResistanceAndContactFailureStillDetected:true,results,poseSolverExecuted:false,browserExecuted:false,vendorModified:false}));
