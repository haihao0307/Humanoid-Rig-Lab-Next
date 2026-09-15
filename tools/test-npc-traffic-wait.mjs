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
const api=vm.runInNewContext(code+'\n({resolveCharacterRig,resolveCharacterMetrics,r2SourceFrames,NaturalLocomotion,motionCircleSweep,dist})',{
 structuredClone,SHAPE_SCHEMA,SHAPE_REVISION,normalizeCharacterShape,characterShapeParameterKey,createCharacterShapeField,CHARACTER_DEFORMATION_RULES,HUMAN_GENERATOR_REVISION:'traffic-test',
 degrees:r=>r*180/Math.PI,DOWN:[0,-1,0],horizontal,angleDiff:(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b)),bodyPhysicalProfile:h=>({bodyRadiusM:h.bodyMetrics.bodyRadiusM}),carryRouteRadius:()=>.5483321537,MotionLab:{FullBodyMotion,blend,relaxedHandRotation,solveTwoBone,MotionController,rigFromSource,FlatWorld}});
let cases=0,frames=0,maxFootErrorM=0;const waits=[];
for(const mode of ['standing','moving','timeout','static']){
 const resolvedRig=api.resolveCharacterRig({}),bodyMetrics=api.resolveCharacterMetrics(resolvedRig),sourceBind=api.r2SourceFrames(resolvedRig),h={resolvedRig,bodyMetrics,sourceBind,arms:{}};
 h.joints=[...sourceBind.keys()].map(id=>({id,bindQ:[0,0,0,1]}));h.byId=new Map(h.joints.map(j=>[j.id,j]));
 for(const side of ['left','right'])h.arms[side]={s:side==='left'?-1:1,L1:api.dist(sourceBind.get(side+'_upperArm').p,sourceBind.get(side+'_forearm').p),L2:api.dist(sourceBind.get(side+'_forearm').p,sourceBind.get(side+'_hand').p)};
 const target=[0,0,2],other={id:'npc-blocker',human:h,agent:{pos:[0,0,2.5]}},held={id:'box'},a={npcId:'npc-carrier',h,pos:[0,0,0],yaw:0,time:0,phase:'travel',held,skill:{type:'carry',o:held},route:[target],routeIndex:0,manipulationPace:()=>1,strength:{movementFactor:()=>1},w:{objects:[],bounds:{xMin:-100,xMax:100,zMin:-100,zMax:100},collision:()=>false}};
 let blocked=mode!=='moving',queries=0;
 const pop={values:()=>[other],collisionFor:(agent,p,r)=>{queries++;return blocked&&horizontal(p,other.agent.pos)<r+bodyMetrics.bodyRadiusM+.06;},sweepFor:(agent,start,end,r)=>blocked?api.motionCircleSweep(start,end,other.agent.pos,r+bodyMetrics.bodyRadiusM+.06):1};a.w.population=pop;
 const loc=new api.NaturalLocomotion(a);a.locomotion=loc;
 const step=()=>{const before=structuredClone(loc.engine.state);a.time+=1/120;const moving=loc.move(1/120,.43);loc.update(1/120);const s=loc.engine.state;loc.pose.validate(loc.pose.build());frames++;
  for(const side of ['left','right']){const error=api.dist(s.pose.legs[side].end,s.feet[side].position);maxFootErrorM=Math.max(maxFootErrorM,error);assert(error<1e-7);if(before.feet[side].contact&&s.feet[side].contact)assert(api.dist(before.feet[side].position,s.feet[side].position)<1e-10);}
  return moving;};
 if(mode==='moving'){for(let i=0;i<120;i++)step();assert(loc.engine.state.speed>.2);blocked=true;}
 if(mode==='static'){a.w.collision=()=>true;assert.throws(step,/目标无效或与障碍重叠/);assert.equal(loc.traffic.active,false);cases++;continue;}
 if(mode==='timeout'){let error;for(let i=0;i<3800;i++){try{step();}catch(e){error=e;break;}}assert.match(error?.message||'',/等待其他 NPC 让行超时/);assert.equal(a.routeIndex,0);cases++;continue;}
 const waitRoot=[...a.pos],startQueries=queries;for(let i=0;i<360;i++){assert(step(),'waiting never completes the current route');assert.equal(a.routeIndex,0);}
 assert(loc.isSettled(),'waiting uses ordinary braking and foot settling');assert.equal(a.held,held,'waiting retains the object claim');assert(loc.traffic.active);assert(loc.traffic.blockers.includes('npc-blocker'));assert(loc.traffic.waitS>2.9);assert(queries-startQueries<60,'target checks are throttled while waiting');
 if(mode==='standing')assert(horizontal(a.pos,waitRoot)<1e-10,'standing wait cannot move the root');
 waits.push({mode,waitS:loc.traffic.waitS,rootTravelM:horizontal(a.pos,waitRoot)});blocked=false;let complete=false;for(let i=0;i<2500;i++)if(!step()){complete=true;break;}assert(complete,'the same queued destination resumes after the other NPC leaves');assert.equal(loc.traffic.active,false);assert(horizontal(a.pos,target)<.016);cases++;
}
console.log(JSON.stringify({cases,frames,maxFootErrorM,waits,vendorModified:false}));
