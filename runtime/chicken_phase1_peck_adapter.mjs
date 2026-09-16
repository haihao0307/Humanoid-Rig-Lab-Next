const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const sat=v=>clamp(v,0,1);

function axisAngle(THREE,axis,angle){
 return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...axis),angle);
}

function compose(THREE,pitch=0,yaw=0,roll=0){
 return new THREE.Quaternion()
  .multiply(axisAngle(THREE,[0,1,0],yaw))
  .multiply(axisAngle(THREE,[0,0,1],pitch))
  .multiply(axisAngle(THREE,[1,0,0],roll));
}

export function createChickenPhase1PeckAdapter(THREE,baseSkin,options={}){
 if(!THREE||!baseSkin?.bones||!baseSkin?.skeleton)throw new Error('THREE and an articulated skin are required');
 const bones=baseSkin.bones;
 const bindQuaternion={};
 for(const[id,bone]of Object.entries(bones))bindQuaternion[id]=bone.quaternion.clone();
 const beakTipLocal=new THREE.Vector3(...(options.beakTipLocal||[.096,-.011,0]));
 const toeTipLocal=new THREE.Vector3(...(options.toeTipLocal||[.070,-.018,0]));
 let lastContactPoints=null,lastAppliedAngles=null,lastPose=null,applyCount=0;

 function blendBone(id,targetPitch,targetYaw,targetRoll,weight){
  const bone=bones[id];if(!bone)return;
  const target=bindQuaternion[id].clone().multiply(compose(THREE,targetPitch,targetYaw,targetRoll));
  bone.quaternion.slerp(target,sat(weight));
 }

 function contactPoints(){
  const beak=beakTipLocal.clone().applyMatrix4(bones.head.matrixWorld);
  const leftToe=toeTipLocal.clone().applyMatrix4(bones.toe_l.matrixWorld);
  const rightToe=toeTipLocal.clone().applyMatrix4(bones.toe_r.matrixWorld);
  return Object.freeze({
   beak:Object.freeze(beak.toArray()),leftToe:Object.freeze(leftToe.toArray()),rightToe:Object.freeze(rightToe.toArray()),
   billGroundError:beak.y,leftFootGroundError:leftToe.y,rightFootGroundError:rightToe.y
  });
 }

 function applyPose(pose){
  const baseResult=baseSkin.applyPose(pose);applyCount++;lastPose=pose;
  if(pose.state!=='peck'){
   lastContactPoints=baseResult.contactPoints||baseSkin.diagnostics().lastContactPoints||contactPoints();
   lastAppliedAngles=baseResult.appliedAngles||null;
   return{...baseResult,peckAdapterApplied:false,contactPoints:lastContactPoints};
  }
  const depth=sat((-pose.neck.pitch-.12)/.93);
  const root=bones.body_root;
  // Base skin already contributes 0.006 m of crouch. Add the remaining 0.094 m
  // so the body lowers while both feet are refolded to their ground anchors.
  root.position.y-=.094*depth;

  // Local rotations were solved from the fixed-length bind chain for a beak
  // target about 0.18 m forward and 0.46 m below the cervical root.  Unlike the
  // rejected straight-down pose, this produces a forward/down S-curve and a
  // near-horizontal bill at contact.
  const target={
   neckBase:-1.95822533,neck0:-.64144489,neck1:.31751989,head:2.12774082,
   hip:.344,knee:-.781,ankle:.839,toe:.337
  };
  blendBone('pelvis',0,0,pose.body.roll*.08,depth);
  blendBone('chest',0,0,pose.body.roll*.10,depth);
  blendBone('neck_base',target.neckBase,pose.neck.yaw*.24,0,depth);
  blendBone('neck_c0',target.neck0,pose.neck.yaw*.30,0,depth);
  blendBone('neck_c1',target.neck1,pose.neck.yaw*.34,0,depth);
  blendBone('head',target.head,pose.head.yaw*.56,0,depth);
  for(const side of['l','r']){
   blendBone(`hip_${side}`,target.hip,0,0,depth);
   blendBone(`knee_${side}`,target.knee,0,0,depth);
   blendBone(`ankle_${side}`,target.ankle,0,0,depth);
   blendBone(`toe_${side}`,target.toe,0,0,depth);
  }
  bones.body_root.updateMatrixWorld(true);baseSkin.skeleton.update();
  lastContactPoints=contactPoints();
  lastAppliedAngles=Object.freeze({depth,...target,rootCrouchTotal:-.100*depth});
  const invariantReport=baseSkin.verifyInvariants();
  return{
   ...baseResult,peckAdapterApplied:true,appliedAngles:lastAppliedAngles,
   contactPoints:lastContactPoints,invariantReport
  };
 }

 function diagnostics(){
  const base=baseSkin.diagnostics();
  return{
   ...base,
   schema:'life_ecosystem/chicken_phase1_articulated_skin_diagnostics@1.2',
   applyCount:Math.max(base.applyCount||0,applyCount),
   lastState:lastPose?.state??base.lastState,
   lastAppliedAngles:lastAppliedAngles||base.lastAppliedAngles,
   lastContactPoints:lastContactPoints||base.lastContactPoints,
   peckKinematicsRevision:'fixed-length-forward-down-s-curve-v1',
   weightingRevision:base.weightingRevision
  };
 }

 return Object.freeze({
  bones:baseSkin.bones,skeleton:baseSkin.skeleton,meshes:baseSkin.meshes,
  applyPose,verifyInvariants:baseSkin.verifyInvariants,detach:baseSkin.detach,
  diagnostics,rootOrigin:baseSkin.rootOrigin
 });
}
