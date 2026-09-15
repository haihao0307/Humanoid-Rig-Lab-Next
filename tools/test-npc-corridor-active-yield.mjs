import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {MotionController} from '../motion/vendor/controller.mjs';
import {rigFromSource} from '../motion/vendor/rig.mjs';
import {FlatWorld} from '../motion/vendor/world.mjs';
import {solveTwoBone} from '../motion/vendor/math.mjs';
import {createCharacterShapeField,CHARACTER_DEFORMATION_RULES} from '../reconstruction/shape-deform.mjs';
import {normalizeCharacterShape,characterShapeParameterKey,SHAPE_SCHEMA,SHAPE_REVISION} from '../reconstruction/shape-contract.mjs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8'),rig=JSON.parse(read('reconstruction/rig-reference.json'));
const gaitSource=read('body/NaturalLocomotion.js');
assert(!gaitSource.includes('waitForTraffic('));
const fullBody=read('motion/vendor/full-body.mjs').replace(/from '(\.\/[^']+)'/g,(_,path)=>'from '+JSON.stringify(new URL('../motion/vendor/'+path,import.meta.url).href));
const {FullBodyMotion,blend,relaxedHandRotation}=await import('data:text/javascript;base64,'+Buffer.from(fullBody+'\nexport {blend,relaxedHandRotation};').toString('base64'));
const math=read('source/runtime.template.js').split('// MODULE math')[1].split('function matrix')[0];
const code=math+'\n'+read('body/ReconstructionRig.js').replace('/*__R2_RIG_JSON__*/',JSON.stringify(rig)).replace('/*__R2_REGIONS_JSON__*/','{}')+'\n'+read('body/CharacterShape.js')+'\n'+read('body/ReferenceMotion.js').replace('/*__R2_MOTION_JSON__*/',read('reconstruction/motion-reference.json'))+'\n'+read('body/ContactHandPose.js')+'\n'+read('body/MotionLabPose.js')+'\n'+gaitSource;
const horizontal=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
const objectYaw=()=>0;
const objectFootprint=o=>o.shape==='box'?[o.w/2,o.d/2]:[o.r,o.r];
const objectRadius=o=>o.shape==='box'?Math.hypot(o.w,o.d)/2:o.r;
const pointToObjectClearance=(p,o)=>{
 const dx=p[0]-o.p[0],dz=p[2]-o.p[2];
 if(o.shape==='box'){const qx=Math.max(Math.abs(dx)-o.w/2,0),qz=Math.max(Math.abs(dz)-o.d/2,0);return Math.hypot(qx,qz);}
 return Math.max(0,Math.hypot(dx,dz)-o.r);
};
const api=vm.runInNewContext(code+'\n({resolveCharacterRig,resolveCharacterMetrics,r2SourceFrames,NaturalLocomotion,motionCircleSweep,dist})',{
 structuredClone,SHAPE_SCHEMA,SHAPE_REVISION,normalizeCharacterShape,characterShapeParameterKey,createCharacterShapeField,CHARACTER_DEFORMATION_RULES,HUMAN_GENERATOR_REVISION:'corridor-active-yield-test',
 degrees:r=>r*180/Math.PI,DOWN:[0,-1,0],horizontal,angleDiff:(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b)),objectTilted:()=>false,objectYaw,objectRadius,objectFootprint,pointToObjectClearance,
 bodyPhysicalProfile:h=>({bodyRadiusM:h.bodyMetrics.bodyRadiusM}),carryRouteRadius:()=>.55,MotionLab:{FullBodyMotion,blend,relaxedHandRotation,solveTwoBone,MotionController,rigFromSource,FlatWorld}});

function makeHuman(){
 const resolvedRig=api.resolveCharacterRig({}),bodyMetrics=api.resolveCharacterMetrics(resolvedRig),sourceBind=api.r2SourceFrames(resolvedRig),h={resolvedRig,bodyMetrics,sourceBind,arms:{}};
 h.joints=[...sourceBind.keys()].map(id=>({id,bindQ:[0,0,0,1]}));h.byId=new Map(h.joints.map(j=>[j.id,j]));
 for(const side of ['left','right'])h.arms[side]={s:side==='left'?-1:1,L1:api.dist(sourceBind.get(side+'_upperArm').p,sourceBind.get(side+'_forearm').p),L2:api.dist(sourceBind.get(side+'_forearm').p,sourceBind.get(side+'_hand').p)};
 return h;
}

const walls=[
 {id:'corridor-left',shape:'box',p:[-.72,0,0],w:.18,d:2.8,held:false,collidable:true},
 {id:'corridor-right',shape:'box',p:[.72,0,0],w:.18,d:2.8,held:false,collidable:true}
];
const world={objects:walls,bounds:{xMin:-6,xMax:6,zMin:-6,zMax:6},get:()=>null,population:null};
world.collision=(p,r,ignore=[])=>walls.some(o=>!ignore.includes(o.id)&&pointToObjectClearance(p,o)<r+.06);
world.path=(start,end,r=.3,ignore=[])=>{
 const steps=Math.max(1,Math.ceil(horizontal(start,end)/.05));
 for(let i=1;i<=steps;i++){const t=i/steps,p=[start[0]+(end[0]-start[0])*t,0,start[2]+(end[2]-start[2])*t];if(world.collision(p,r,ignore))throw Error('static route blocked');}
 return[[...end]];
};
const specs=[['npc-a',[0,0,-2.5],[0,0,2.5],0],['npc-b',[0,0,2.5],[0,0,-2.5],Math.PI]];
const actors=specs.map(([id,start,goal,yaw])=>{
 const human=makeHuman(),agent={npcId:id,h:human,pos:[start[0],0,start[2]],yaw,time:0,index:0,phase:'walk',held:null,skill:{type:'walk'},route:[[...goal]],routeIndex:0,manipulationPace:()=>1,strength:{movementFactor:()=>1},walkSpeed:0,w:world,logs:[],log(message){this.logs.push(message);}};
 const actor={id,label:id,human,agent,goal,disposed:false,done:false};actor.locomotion=new api.NaturalLocomotion(agent);agent.locomotion=actor.locomotion;return actor;
});
world.population={
 values:()=>actors,
 collisionFor:(agent,p,r)=>actors.some(other=>other.agent!==agent&&!other.disposed&&horizontal(p,other.agent.pos)<r+other.human.bodyMetrics.bodyRadiusM+.06),
 sweepFor:(agent,start,end,r)=>actors.filter(other=>other.agent!==agent&&!other.disposed).reduce((fraction,other)=>Math.min(fraction,api.motionCircleSweep(start,end,other.agent.pos,r+other.human.bodyMetrics.bodyRadiusM+.06)),1)
};
let minSeparation=Infinity,frames=0;
for(;frames<10000&&!actors.every(actor=>actor.done);frames++){
 const order=frames%2?actors:[...actors].reverse();
 for(const actor of order){
  if(actor.done)continue;const a=actor.agent,l=actor.locomotion;a.time+=1/120;
  const moving=l.move(1/120,.48);l.update(1/120);l.pose.validate(l.pose.build());if(!moving)actor.done=true;
 }
 minSeparation=Math.min(minSeparation,horizontal(actors[0].agent.pos,actors[1].agent.pos));
}
assert(actors.every(actor=>actor.done),'both corridor users must complete their original routes');
for(const actor of actors){assert(horizontal(actor.agent.pos,actor.goal)<.025);assert(!Object.hasOwn(actor.locomotion.traffic,'waitS'));}
assert(minSeparation>.50,'continuous sweep must retain body clearance');
const claims=actors.reduce((n,a)=>n+a.locomotion.traffic.corridorClaims,0),yields=actors.reduce((n,a)=>n+a.locomotion.traffic.corridorYields,0);
assert(claims>=1,'one direction must obtain corridor ownership');
assert(yields>=1,'the opposite direction must actively retreat or side-step');
assert(actors.some(actor=>actor.agent.logs.some(message=>message.includes('主动撤到通道外'))));
console.log(JSON.stringify({passed:true,agents:2,frames,minSeparationM:minSeparation,corridorClaims:claims,corridorYields:yields,parkingWait:false}));
