// Shallow, collision-free waypoints and consecutive walk tasks should preserve
// useful exit velocity. Tight corners retain explicit braking/foot placement.
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
const horizontal=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]),angleDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const api=vm.runInNewContext(code+'\n({resolveCharacterRig,resolveCharacterMetrics,r2SourceFrames,NaturalLocomotion,dist})',{
 structuredClone,SHAPE_SCHEMA,SHAPE_REVISION,normalizeCharacterShape,characterShapeParameterKey,createCharacterShapeField,CHARACTER_DEFORMATION_RULES,HUMAN_GENERATOR_REVISION:'walk-continuity-test',
 degrees:r=>r*180/Math.PI,DOWN:[0,-1,0],horizontal,angleDiff,bodyPhysicalProfile:h=>({bodyRadiusM:h.bodyMetrics.bodyRadiusM}),
 actorForReasoning:agent=>({yaw:agent.yaw,pos:agent.pos}),walkDestination:(world,actor,step)=>step.testEnd,
 MotionLab:{FullBodyMotion,blend,relaxedHandRotation,solveTwoBone,MotionController,rigFromSource,FlatWorld}});
const resolvedRig=api.resolveCharacterRig({}),bodyMetrics=api.resolveCharacterMetrics(resolvedRig),sourceBind=api.r2SourceFrames(resolvedRig),h={resolvedRig,bodyMetrics,sourceBind,arms:{}};
h.joints=[...sourceBind.keys()].map(id=>({id,bindQ:[0,0,0,1]}));h.byId=new Map(h.joints.map(j=>[j.id,j]));
for(const side of ['left','right'])h.arms[side]={s:side==='left'?-1:1,L1:api.dist(sourceBind.get(side+'_upperArm').p,sourceBind.get(side+'_forearm').p),L2:api.dist(sourceBind.get(side+'_forearm').p,sourceBind.get(side+'_hand').p)};
const a={h,pos:[0,0,0],yaw:0,time:0,route:[],routeIndex:0,manipulationPace:()=>1,strength:{movementFactor:()=>1},w:{objects:[],bounds:{xMin:-100,xMax:100,zMin:-100,zMax:100},collision:()=>false}};
const locomotion=new api.NaturalLocomotion(a);a.locomotion=locomotion;
a.route=[[0,0,.35],[0,0,.7],[0,0,1.2]];a.routeIndex=0;
let complete=false,minMiddleSpeed=Infinity,frames=0;
for(let i=0;i<3000;i++){
 const moving=locomotion.move(1/120);locomotion.update(1/120);frames++;
 if(a.pos[2]>.28&&a.pos[2]<.78)minMiddleSpeed=Math.min(minMiddleSpeed,locomotion.speed);
 if(!moving&&locomotion.isSettled()){complete=true;break;}
}
assert(complete,'collinear route must finish');
assert.equal(locomotion.routePassThroughCount,2,'both shallow intermediate waypoints should be passed without terminal settling');
assert(minMiddleSpeed>.08,'intermediate collinear waypoints must retain useful velocity');
a.w.get=()=>null;Object.assign(a,{skill:{type:'walk',startPosition:[0,0,0]},plan:{steps:[{type:'walk'},{type:'walk',testEnd:[0,0,2]}]},index:0,route:[[0,0,1]],walkSpeed:.24,pos:[0,0,.99]});
locomotion.engine.state.root=[0,locomotion.engine.state.root[1],.99];
assert.equal(locomotion.canContinuousTaskHandoff(),true,'collinear semantic walk steps should hand off before a full stop');
assert(a.skill.continuousWalkHandoff.exitSpeedMps>.2);
a.skill={type:'walk',startPosition:[0,0,0]};a.plan.steps[1].testEnd=[1,0,1];
assert.equal(locomotion.canContinuousTaskHandoff(),false,'a 90-degree semantic turn must retain explicit settling/placement');
console.log(JSON.stringify({schema:'human/walk_route_continuity@1',frames,routePassThroughCount:locomotion.routePassThroughCount,minMiddleSpeedMps:minMiddleSpeed,semanticExitSpeedMps:.24,browserExecuted:false,gpuExecuted:false,visualAcceptance:false}));
