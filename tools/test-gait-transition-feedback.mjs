// Start preparation, early first release, terminal step shortening and turn
// foot preference must execute in production code without moving foot anchors.
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
const code=math+'\n'+read('body/ReconstructionRig.js').replace('/*__R2_RIG_JSON__*/',JSON.stringify(rig)).replace('/*__R2_REGIONS_JSON__*/','{}')+'\n'+read('body/CharacterShape.js')+'\n'+read('body/ReferenceMotion.js').replace('/*__R2_MOTION_JSON__*/',read('reconstruction/motion-reference.json'))+'\n'+read('body/ContactHandPose.js')+'\n'+read('body/MotionLabPose.js')+'\n'+read('body/NaturalLocomotion.js')+'\n'+read('body/GaitTransitionFeedback.js');
const horizontal=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]),angleDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const api=vm.runInNewContext(code+'\n({resolveCharacterRig,resolveCharacterMetrics,r2SourceFrames,NaturalLocomotion,dist,GAIT_TRANSITION_FEEDBACK})',{
 structuredClone,SHAPE_SCHEMA,SHAPE_REVISION,normalizeCharacterShape,characterShapeParameterKey,createCharacterShapeField,CHARACTER_DEFORMATION_RULES,HUMAN_GENERATOR_REVISION:'gait-transition-test',
 degrees:r=>r*180/Math.PI,DOWN:[0,-1,0],horizontal,angleDiff,bodyPhysicalProfile:h=>({bodyRadiusM:h.bodyMetrics.bodyRadiusM}),MotionLab:{FullBodyMotion,blend,relaxedHandRotation,solveTwoBone,MotionController,rigFromSource,FlatWorld}});
function create(){
 const resolvedRig=api.resolveCharacterRig({}),bodyMetrics=api.resolveCharacterMetrics(resolvedRig),sourceBind=api.r2SourceFrames(resolvedRig),h={resolvedRig,bodyMetrics,sourceBind,arms:{}};
 h.joints=[...sourceBind.keys()].map(id=>({id,bindQ:[0,0,0,1]}));h.byId=new Map(h.joints.map(j=>[j.id,j]));
 for(const side of ['left','right'])h.arms[side]={s:side==='left'?-1:1,L1:api.dist(sourceBind.get(side+'_upperArm').p,sourceBind.get(side+'_forearm').p),L2:api.dist(sourceBind.get(side+'_forearm').p,sourceBind.get(side+'_hand').p)};
 const a={h,pos:[0,0,0],yaw:0,time:0,route:[],routeIndex:0,held:null,manipulationPace:()=>1,strength:{movementFactor:()=>1},w:{objects:[],bounds:{xMin:-100,xMax:100,zMin:-100,zMax:100},collision:()=>false,get:()=>null}};
 const locomotion=new api.NaturalLocomotion(a);a.locomotion=locomotion;return{a,locomotion};
}
const {a,locomotion}=create(),dt=1/120,initialFeet=structuredClone(locomotion.engine.state.feet);a.route=[[0,0,1.2]];a.routeIndex=0;
let preparationFrames=0,firstSwing=null,minimumTerminalScale=1,settled=false,maxPoseShift=0;
for(let i=0;i<5000;i++){
 const before=structuredClone(locomotion.engine.state),moving=locomotion.move(dt,.48);locomotion.update(dt);a.time+=dt;
 const s=locomotion.engine.state,g=locomotion.report().gaitTransition,candidate=locomotion.pose.build();locomotion.pose.validate(candidate);
 maxPoseShift=Math.max(maxPoseShift,Math.abs(g.poseOffsetXM));
 if(g.phase==='preparing'){
  preparationFrames++;assert(horizontal(s.root,[0,s.root[1],0])<1e-12,'navigation root must wait during start preparation');
  for(const side of ['left','right'])assert(api.dist(s.feet[side].position,initialFeet[side].position)<1e-12,'double-support preparation cannot slide a foot');
 }
 if(!firstSwing&&s.swing){firstSwing={side:s.swing.side,rootTravelM:horizontal([0,0,0],s.root),support:g.supportSide};}
 if(s.swing&&Number.isFinite(s.swing.terminalScale))minimumTerminalScale=Math.min(minimumTerminalScale,s.swing.terminalScale);
 for(const side of ['left','right'])if(before.feet[side].contact&&s.feet[side].contact)assert(api.dist(before.feet[side].position,s.feet[side].position)<1e-9,'planted foot drifted');
 if(!moving&&locomotion.isSettled()){settled=true;break;}
}
assert(preparationFrames>=8,'walk must include a visible double-support preparation');
assert(maxPoseShift>.006&&maxPoseShift<=api.GAIT_TRANSITION_FEEDBACK.maximumPelvisShiftM+1e-9,'preparation shift must be bounded and visible');
assert(firstSwing,'walk must release a first foot');
assert.equal(firstSwing.side,'left');assert.equal(firstSwing.support,'right');
assert(firstSwing.rootTravelM<.065,'first foot must release before the old 75 mm pelvis glide');
assert(minimumTerminalScale<.8&&minimumTerminalScale>=api.GAIT_TRANSITION_FEEDBACK.minimumTerminalScale-1e-9,'terminal placements must shorten without collapsing');
assert(settled,'walk must finish and gather both feet');assert(horizontal(a.pos,[0,0,1.2])<=.016,'walk target must remain exact');
const report=locomotion.report().gaitTransition;assert(report.firstSwingRootTravelM<.065);assert(report.minimumObservedTerminalScale<.8);

// The transition state is part of deterministic action rollback.
a.pos=[0,0,0];a.yaw=0;locomotion.resetFromPose();a.route=[[0,0,1]];a.routeIndex=0;locomotion.move(dt,.48);locomotion.update(dt);
const saved=locomotion.snapshotExecution(),savedReport=locomotion.report().gaitTransition;locomotion.gaitTransition.elapsedS=99;locomotion.restoreExecution(saved);
assert.deepEqual(locomotion.report().gaitTransition,savedReport,'gait transition rollback must be exact');

// A positive yaw is a right turn, so the left/outside foot receives the first
// placement preference; the mirrored turn chooses the right foot.
for(const [target,outside] of [[Math.PI/2,'left'],[-Math.PI/2,'right']]){
 const sample=create();sample.locomotion.turnInPlace(target,dt);assert.equal(sample.locomotion.engine.state.nextFoot,outside);assert.equal(sample.locomotion.report().gaitTransition.turnOutsideFoot,outside);
}
console.log(JSON.stringify({schema:'human/gait_transition_feedback@1',preparationFrames,maxPoseShiftM:maxPoseShift,firstSwing,minimumTerminalScale,settled,rollbackVerified:true,turnOutsideFootVerified:true,browserExecuted:false,gpuExecuted:false,visualAcceptance:false}));
