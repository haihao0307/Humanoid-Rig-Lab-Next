import * as THREE from 'three';
// The visual anatomical candidate has shifted joint centres. Reusing original
// skin inverse matrices would separate its bones when those joints rotate.
// Retarget original local pose deltas onto a frozen candidate bind hierarchy, without ever
// writing to the source skeleton, its inverse binds, or the accepted skin.
export function createCandidateKinematics(subject,actor,profile){
 const bones=subject.skeleton.bones,ids=new Map(bones.map((b,i)=>[b,i])),parents=bones.map(b=>ids.has(b.parent)?ids.get(b.parent):-1);
 const bind=subject.skeleton.boneInverses.map(m=>m.clone().invert()),candidateBind=bind.map((m,i)=>m.clone().setPosition(...profile.joints[i].position)),candidateInverse=candidateBind.map(m=>m.clone().invert());
 const originalLocalPositions=bind.map((m,i)=>new THREE.Vector3().setFromMatrixPosition(parents[i]<0?m:bind[parents[i]].clone().invert().multiply(m)));
 const localBind=candidateBind.map((m,i)=>parents[i]<0?m.clone():candidateBind[parents[i]].clone().invert().multiply(m)),localComponents=localBind.map(m=>{const p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();m.decompose(p,q,s);return {p,q,s};});
 const current=bones.map(()=>new THREE.Matrix4()),world=bones.map(()=>new THREE.Matrix4()),matrices=bones.map(()=>new THREE.Matrix4()),inverseActor=new THREE.Matrix4(),local=new THREE.Matrix4(),position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();
 function update(){actor.updateMatrixWorld(true);inverseActor.copy(actor.matrixWorld).invert();for(let i=0;i<bones.length;i++)current[i].copy(inverseActor).multiply(bones[i].matrixWorld);const done=new Set();
  function solve(i){if(done.has(i))return;const parent=parents[i];if(parent<0){world[i].copy(current[i]).multiply(bind[i].clone().invert()).multiply(candidateBind[i]);}else{solve(parent);local.copy(current[parent]).invert().multiply(current[i]);local.decompose(position,rotation,scale);const rest=localComponents[i];position.sub(originalLocalPositions[i]).add(rest.p);local.compose(position,rotation,rest.s);world[i].copy(world[parent]).multiply(local);}matrices[i].copy(world[i]).multiply(candidateInverse[i]);done.add(i);}
  for(let i=0;i<bones.length;i++)solve(i);
 }
 update();return {matrices,world,candidateBind,candidateInverse,parents,update,evidence:'original-pose-deltas-on-frozen-candidate-joints; original-skin-bind-unchanged'};
}
