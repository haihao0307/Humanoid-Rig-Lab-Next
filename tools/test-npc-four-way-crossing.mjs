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
const fullBody=read('motion/vendor/full-body.mjs').replace(/from '(\.\/[^']+)'/g,(_,path)=>'from '+JSON.stringify(new URL('../motion/vendor/'+path,import.meta.url).href));
const {FullBodyMotion,blend,relaxedHandRotation}=await import('data:text/javascript;base64,'+Buffer.from(fullBody+'\nexport {blend,relaxedHandRotation};').toString('base64'));
const math=read('source/runtime.template.js').split('// MODULE math')[1].split('function matrix')[0];
const code=math+'\n'+read('body/ReconstructionRig.js').replace('/*__R2_RIG_JSON__*/',JSON.stringify(rig)).replace('/*__R2_REGIONS_JSON__*/','{}')+'\n'+read('body/CharacterShape.js')+'\n'+read('body/ReferenceMotion.js').replace('/*__R2_MOTION_JSON__*/',read('reconstruction/motion-reference.json'))+'\n'+read('body/ContactHandPose.js')+'\n'+read('body/MotionLabPose.js')+'\n'+read('body/NaturalLocomotion.js');
const horizontal=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
const objectRadius=o=>o.shape==='box'?Math.hypot(o.w,o.d)/2:o.r;
const objectFootprint=o=>o.shape==='box'?[o.w/2,o.d/2]:[o.r,o.r];
const api=vm.runInNewContext(code+'\n({resolveCharacterRig,resolveCharacterMetrics,r2SourceFrames,NaturalLocomotion,motionCircleSweep,dist})',{
 structuredClone,SHAPE_SCHEMA,SHAPE_REVISION,normalizeCharacterShape,characterShapeParameterKey,createCharacterShapeField,CHARACTER_DEFORMATION_RULES,HUMAN_GENERATOR_REVISION:'four-way-crossing-test',
 degrees:r=>r*180/Math.PI,DOWN:[0,-1,0],horizontal,angleDiff:(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b)),objectTilted:()=>false,objectYaw:()=>0,objectRadius,objectFootprint,
 bodyPhysicalProfile:h=>({bodyRadiusM:h.bodyMetrics.bodyRadiusM}),carryRouteRadius:()=>.55,MotionLab:{FullBodyMotion,blend,relaxedHandRotation,solveTwoBone,MotionController,rigFromSource,FlatWorld}});

function makeHuman(){
 const resolvedRig=api.resolveCharacterRig({}),bodyMetrics=api.resolveCharacterMetrics(resolvedRig),sourceBind=api.r2SourceFrames(resolvedRig),h={resolvedRig,bodyMetrics,sourceBind,arms:{}};
 h.joints=[...sourceBind.keys()].map(id=>({id,bindQ:[0,0,0,1]}));h.byId=new Map(h.joints.map(j=>[j.id,j]));
 for(const side of ['left','right'])h.arms[side]={s:side==='left'?-1:1,L1:api.dist(sourceBind.get(side+'_upperArm').p,sourceBind.get(side+'_forearm').p),L2:api.dist(sourceBind.get(side+'_forearm').p,sourceBind.get(side+'_hand').p)};
 return h;
}

const world={objects:[],bounds:{xMin:-8,xMax:8,zMin:-8,zMax:8},get:()=>null,collision:()=>false,path:(start,end)=>[[...end]],population:null};
const specs=[
 ['npc-a',[0,0,-3.2],[0,0,3.2],0],
 ['npc-b',[0,0,3.2],[0,0,-3.2],Math.PI],
 ['npc-c',[-3.2,0,0],[3.2,0,0],Math.PI/2],
 ['npc-d',[3.2,0,0],[-3.2,0,0],-Math.PI/2]
];
const actors=specs.map(([id,start,goal,yaw])=>{
 const human=makeHuman(),agent={npcId:id,h:human,pos:[start[0],0,start[2]],yaw,time:0,index:0,phase:'walk',held:null,skill:{type:'walk'},route:[[...goal]],routeIndex:0,manipulationPace:()=>1,strength:{movementFactor:()=>1},walkSpeed:0,w:world,logs:[],log(message){this.logs.push(message);}};
 const actor={id,label:id,human,agent,goal,disposed:false,done:false};actor.locomotion=new api.NaturalLocomotion(agent);agent.locomotion=actor.locomotion;return actor;
});
world.population={
 values:()=>actors,
 collisionFor:(agent,p,r)=>actors.some(other=>other.agent!==agent&&!other.disposed&&horizontal(p,other.agent.pos)<r+other.human.bodyMetrics.bodyRadiusM+.06),
 sweepFor:(agent,start,end,r)=>actors.filter(other=>other.agent!==agent&&!other.disposed).reduce((fraction,other)=>Math.min(fraction,api.motionCircleSweep(start,end,other.agent.pos,r+other.human.bodyMetrics.bodyRadiusM+.06)),1)
};
const debugState=(failed,error)=>({
 frame:frames,failed,error:error.message,
 actors:actors.map(actor=>({id:actor.id,done:actor.done,position:actor.agent.pos,yaw:actor.agent.yaw,goal:actor.goal,routeIndex:actor.agent.routeIndex,route:actor.agent.route,command:actor.locomotion.engine.state.command,status:actor.locomotion.engine.state.status,fault:actor.locomotion.engine.state.fault,traffic:actor.locomotion.traffic,logs:actor.agent.logs.slice(-8)})),
 separations:actors.flatMap((a,i)=>actors.slice(i+1).map(b=>({pair:[a.id,b.id],distance:horizontal(a.agent.pos,b.agent.pos)})))
});
let minSeparation=Infinity,frames=0;
for(;frames<12000&&!actors.every(actor=>actor.done);frames++){
 const order=frames%2?actors:[...actors].reverse();
 for(const actor of order){
  if(actor.done)continue;const a=actor.agent,l=actor.locomotion;a.time+=1/120;
  try{const moving=l.move(1/120,.48);l.update(1/120);l.pose.validate(l.pose.build());if(!moving)actor.done=true;}catch(error){console.error('FOUR_WAY_DEBUG '+JSON.stringify(debugState(actor.id,error)));throw Error(actor.id+': '+error.message);}
 }
 for(let i=0;i<actors.length;i++)for(let j=i+1;j<actors.length;j++)minSeparation=Math.min(minSeparation,horizontal(actors[i].agent.pos,actors[j].agent.pos));
}
const finalRows=actors.map(actor=>({id:actor.id,done:actor.done,position:actor.agent.pos,goal:actor.goal,targetErrorM:horizontal(actor.agent.pos,actor.goal),routeIndex:actor.agent.routeIndex,route:actor.agent.route,traffic:actor.locomotion.traffic,logs:actor.agent.logs.slice(-8)}));
if(!actors.every(actor=>actor.done)||finalRows.some(row=>row.targetErrorM>=.025))console.error('FOUR_WAY_FINAL '+JSON.stringify({frames,minSeparation,actors:finalRows}));
assert(actors.every(actor=>actor.done),'all four agents must complete their original routes');
for(const actor of actors){assert(horizontal(actor.agent.pos,actor.goal)<.025,actor.id+' must reach its original target');assert(!Object.hasOwn(actor.locomotion.traffic,'waitS'));}
assert(minSeparation>.50,'continuous sweep must prevent body overlap');
const trafficActions=actors.reduce((sum,actor)=>sum+actor.locomotion.traffic.detours+actor.locomotion.traffic.retreats+actor.locomotion.traffic.recoveries+(actor.locomotion.traffic.escapes||0),0);
assert(trafficActions>0,'the crossing must exercise predictive traffic handling');
console.log(JSON.stringify({passed:true,agents:4,frames,minSeparationM:minSeparation,trafficActions,parkingWait:false}));
