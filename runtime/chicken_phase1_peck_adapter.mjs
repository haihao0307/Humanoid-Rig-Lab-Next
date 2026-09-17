import {
  CHICKEN_PHASE1_BONE_ORDER as BASE_BONE_ORDER,
  computeChickenPhase1VertexWeights as computeBaseWeights,
  detectGeneratedFootMesh,
  summarizeVertexKinds
} from './chicken_phase1_articulated_skin.mjs';

const EPSILON=1e-8;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const sat=v=>clamp(v,0,1);
const ss=(a,b,v)=>{const t=sat((v-a)/(b-a||1));return t*t*(3-2*t);};

export const CHICKEN_PHASE1_VOLUME_NECK_BONE_ORDER=Object.freeze([
 'body_root','pelvis','chest','neck_base','neck_c0','neck_c1','neck_c2','neck_c3','head_base','head',
 'wing_l','wing_r','hip_l','knee_l','ankle_l','toe_l','hip_r','knee_r','ankle_r','toe_r','tail'
]);

const BIND_WORLD=Object.freeze({
 body_root:Object.freeze([-.08,.39,.09]),pelvis:Object.freeze([-.08,.39,.09]),chest:Object.freeze([.10,.58,.09]),
 neck_base:Object.freeze([.10,.58,.09]),neck_c0:Object.freeze([.16,.65,.09]),neck_c1:Object.freeze([.22,.72,.09]),
 neck_c2:Object.freeze([.28,.80,.09]),neck_c3:Object.freeze([.34,.87,.09]),head_base:Object.freeze([.37,.91,.09]),
 head:Object.freeze([.39,.93,.09]),wing_l:Object.freeze([-.02,.57,.185]),wing_r:Object.freeze([-.02,.57,-.005]),
 hip_l:Object.freeze([-.035,.33,.14]),knee_l:Object.freeze([-.025,.17,.14]),ankle_l:Object.freeze([0,.05,.14]),toe_l:Object.freeze([.08,.018,.14]),
 hip_r:Object.freeze([-.035,.33,.04]),knee_r:Object.freeze([-.025,.17,.04]),ankle_r:Object.freeze([0,.05,.04]),toe_r:Object.freeze([.08,.018,.04]),
 tail:Object.freeze([-.31,.53,.09])
});

const PARENT=Object.freeze({
 body_root:null,pelvis:'body_root',chest:'pelvis',neck_base:'chest',neck_c0:'neck_base',neck_c1:'neck_c0',
 neck_c2:'neck_c1',neck_c3:'neck_c2',head_base:'neck_c3',head:'head_base',wing_l:'chest',wing_r:'chest',
 hip_l:'pelvis',knee_l:'hip_l',ankle_l:'knee_l',toe_l:'ankle_l',hip_r:'pelvis',knee_r:'hip_r',
 ankle_r:'knee_r',toe_r:'ankle_r',tail:'pelvis'
});

function neckFloor(x){
 if(x<=.14)return .52;
 if(x<=.24)return .52+(x-.14)*.90;
 if(x<=.33)return .61+(x-.24)*1.22;
 if(x<=.41)return .72+(x-.33)*1.38;
 return .83;
}

function add(bucket,index,weight){if(Number.isInteger(index)&&weight>EPSILON)bucket.push([index,weight]);}
function pack(bucket){
 bucket.sort((a,b)=>b[1]-a[1]);const selected=bucket.slice(0,4);let total=selected.reduce((s,q)=>s+q[1],0);
 if(total<EPSILON){selected.length=0;selected.push([0,1]);total=1;}
 const indices=[0,0,0,0],weights=[0,0,0,0];
 for(let i=0;i<selected.length;i++){indices[i]=selected[i][0];weights[i]=selected[i][1]/total;}
 return{indices,weights};
}

function distributedCarrierWeights(x,y,index){
 const floor=neckFloor(x),upper=ss(floor,floor+.075,y);
 const headGate=ss(Math.max(.79,floor+.015),Math.max(.87,floor+.095),y);
 const pulse=(lo,center,hi)=>ss(lo,center,x)*(1-ss(center,hi,x));
 const head=ss(.345,.392,x)*headGate;
 const headBase=pulse(.325,.370,.418)*upper*(1-head*.84);
 const neck3=pulse(.285,.335,.390)*upper*(1-head*.92)*(1-headBase*.42);
 const neck2=pulse(.240,.285,.350)*upper*(1-head*.96)*(1-headBase*.24)*(1-neck3*.36);
 const neck1=pulse(.195,.235,.305)*upper*(1-head*.98)*(1-neck2*.40)*(1-neck3*.16);
 const neck0=pulse(.145,.185,.260)*ss(floor-.025,floor+.060,y)*(1-head*.99)*(1-neck1*.42)*(1-neck2*.16);
 const neckBase=pulse(.075,.125,.210)*ss(floor-.040,floor+.055,y)*(1-neck0*.44)*(1-neck1*.18);
 const tail=(1-ss(-.30,-.11,x))*ss(.34,.61,y);
 const chest=ss(-.10,.16,x)*ss(.41,.69,y)*(1-neckBase*.72)*(1-neck0*.46)*(1-upper);
 const residual=Math.max(0,1-head-headBase-neck3-neck2-neck1-neck0-neckBase-tail*.72-chest*.62);
 const pelvis=residual*(1-upper);
 const bucket=[];
 add(bucket,index.head,head);add(bucket,index.head_base,headBase);add(bucket,index.neck_c3,neck3);
 add(bucket,index.neck_c2,neck2);add(bucket,index.neck_c1,neck1);add(bucket,index.neck_c0,neck0);
 add(bucket,index.neck_base,neckBase);add(bucket,index.tail,tail*.82);add(bucket,index.chest,chest);add(bucket,index.pelvis,pelvis);
 return pack(bucket);
}

function remapBaseWeights(result,index){
 const bucket=[];
 for(let i=0;i<4;i++){
  const id=BASE_BONE_ORDER[result.indices[i]];
  add(bucket,index[id],result.weights[i]);
 }
 return pack(bucket);
}

function computeWeights(x,y,z,kind,options,index){
 if(kind==='body'||kind==='coat')return distributedCarrierWeights(x,y,index);
 return remapBaseWeights(computeBaseWeights(x,y,z,kind,options),index);
}

function classifyPrimaryCounts(counts){
 const out={};for(let i=0;i<counts.length;i++)if(counts[i])out[CHICKEN_PHASE1_VOLUME_NECK_BONE_ORDER[i]]=counts[i];
 return out;
}

function requireThree(THREE){
 for(const name of['Bone','Skeleton','Uint16BufferAttribute','Float32BufferAttribute','Quaternion','Vector3']){
  if(!THREE?.[name])throw new Error(`THREE.${name} is required`);
 }
}

function axisAngle(THREE,axis,angle){return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...axis),angle);}

export function createChickenPhase1PeckAdapter(THREE,baseSkin,options={}){
 requireThree(THREE);
 if(!baseSkin?.bones?.body_root||!baseSkin?.skeleton||!Array.isArray(baseSkin.meshes))throw new Error('an articulated base skin is required');
 if(baseSkin.diagnostics?.().peckKinematicsRevision==='six-link-volume-preserving-s-curve-v2')return baseSkin;
 const group=baseSkin.bones.body_root.parent;
 if(!group)throw new Error('base articulated skin must still be attached to its carrier group');
 const baseDiagnostics=baseSkin.diagnostics?.()||{};
 const rootOrigin=[...(baseSkin.rootOrigin||[0,0,0])];
 const rootScale=baseDiagnostics.rootMotionScale??.42;
 const index=Object.fromEntries(CHICKEN_PHASE1_VOLUME_NECK_BONE_ORDER.map((id,i)=>[id,i]));
 const bones={},bindLocal={},bindQuaternion={},bindScale={};
 for(const id of CHICKEN_PHASE1_VOLUME_NECK_BONE_ORDER){const bone=new THREE.Bone();bone.name=id;bones[id]=bone;}
 for(const id of CHICKEN_PHASE1_VOLUME_NECK_BONE_ORDER){
  const parent=PARENT[id],world=BIND_WORLD[id],parentWorld=parent?BIND_WORLD[parent]:[0,0,0];
  bones[id].position.set(world[0]-parentWorld[0],world[1]-parentWorld[1],world[2]-parentWorld[2]);
  if(parent)bones[parent].add(bones[id]);
 }
 baseSkin.detach();
 group.add(bones.body_root);group.updateMatrixWorld(true);
 const skeleton=new THREE.Skeleton(CHICKEN_PHASE1_VOLUME_NECK_BONE_ORDER.map(id=>bones[id]));
 skeleton.calculateInverses();
 for(const id of CHICKEN_PHASE1_VOLUME_NECK_BONE_ORDER){
  bindLocal[id]=bones[id].position.clone();bindQuaternion[id]=bones[id].quaternion.clone();bindScale[id]=bones[id].scale.clone();
 }

 const meshAudits=[];
 for(let meshIndex=0;meshIndex<baseSkin.meshes.length;meshIndex++){
  const mesh=baseSkin.meshes[meshIndex];
  if(!mesh?.isSkinnedMesh||!mesh.geometry?.attributes?.position)continue;
  const geometry=mesh.geometry,positions=geometry.attributes.position.array,kind=mesh.userData?.materialKind||'body';
  const vertexKinds=geometry.attributes.kind?.array||null,localCoords=geometry.attributes.localCoord?.array||null;
  const generatedFootMesh=detectGeneratedFootMesh(kind,vertexKinds,localCoords);
  const count=positions.length/3,indices=new Uint16Array(count*4),weights=new Float32Array(count*4);
  const primaryCounts=new Uint32Array(CHICKEN_PHASE1_VOLUME_NECK_BONE_ORDER.length),local=[0,0,0];
  for(let i=0;i<count;i++){
   const q=i*3,o=i*4;
   if(localCoords){local[0]=localCoords[q];local[1]=localCoords[q+1];local[2]=localCoords[q+2];}
   const packed=computeWeights(positions[q],positions[q+1],positions[q+2],kind,{
    centerZ:options.centerZ??.09,generatedFootMesh,vertexKind:vertexKinds?vertexKinds[i]:null,localCoord:localCoords?local:null
   },index);
   for(let k=0;k<4;k++){indices[o+k]=packed.indices[k];weights[o+k]=packed.weights[k];}
   primaryCounts[packed.indices[0]]++;
  }
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));
  geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  mesh.bind(skeleton);mesh.normalizeSkinWeights();
  meshAudits.push(Object.freeze({
   meshIndex,materialKind:kind,vertexCount:count,hasVertexKind:Boolean(vertexKinds),hasLocalCoord:Boolean(localCoords),
   generatedFootMesh,vertexKindHistogram:summarizeVertexKinds(vertexKinds),primaryBoneCounts:Object.freeze(classifyPrimaryCounts(primaryCounts))
  }));
 }

 let applyCount=0,lastPose=null,lastReport=null,lastAppliedAngles=null,lastContactPoints=null;
 const beakTipLocal=new THREE.Vector3(...(options.beakTipLocal||[.096,-.011,0]));
 const leftToeTipLocal=new THREE.Vector3(...(options.toeTipLocal||[.070,-.018,0]));
 const rightToeTipLocal=new THREE.Vector3(...(options.toeTipLocal||[.070,-.018,0]));

 function reset(){
  for(const id of CHICKEN_PHASE1_VOLUME_NECK_BONE_ORDER){
   bones[id].quaternion.copy(bindQuaternion[id]);bones[id].scale.copy(bindScale[id]);
   if(id!=='body_root')bones[id].position.copy(bindLocal[id]);
  }
 }
 function rotate(id,pitch=0,yaw=0,roll=0){
  const bone=bones[id];bone.quaternion.copy(bindQuaternion[id]);
  bone.quaternion.multiply(axisAngle(THREE,[0,1,0],yaw)).multiply(axisAngle(THREE,[0,0,1],pitch)).multiply(axisAngle(THREE,[1,0,0],roll));
 }
 function mapPose(pose){
  const peckDepth=pose.state==='peck'?sat((-pose.neck.pitch-.12)/.93):0;
  const neckPitch=clamp(pose.neck.pitch,-.58,.52),headPitch=clamp(pose.head.pitch,-.28,.36);
  const legGain=pose.state==='short_run'?{hip:.48,knee:.30,ankle:.26}:{hip:.54,knee:.34,ankle:.28};
  const peck={pelvis:-.202,chest:-.356,neckBase:-.908,neck0:-.569,neck1:-.359,neck2:-.007,neck3:.323,headBase:.756,head:1.110,hip:.561,knee:-.849,ankle:1.070,toe:.359};
  const mix=(normal,target)=>normal*(1-peckDepth)+target*peckDepth;
  return{
   peckDepth,rootCrouch:-.104*peckDepth,pelvisPitch:pose.body.pitch*.42+peck.pelvis*peckDepth,chestPitch:pose.body.pitch*.52+peck.chest*peckDepth,bodyRoll:clamp(pose.body.roll,-.22,.22),
   neckBasePitch:mix(neckPitch*.10,peck.neckBase),neck0Pitch:mix(neckPitch*.18,peck.neck0),neck1Pitch:mix(neckPitch*.22,peck.neck1),
   neck2Pitch:mix(neckPitch*.20,peck.neck2),neck3Pitch:mix(neckPitch*.16,peck.neck3),headBasePitch:mix(neckPitch*.14,peck.headBase),
   neckBaseYaw:pose.neck.yaw*.12,neck0Yaw:pose.neck.yaw*.16,neck1Yaw:pose.neck.yaw*.18,neck2Yaw:pose.neck.yaw*.18,
   neck3Yaw:pose.neck.yaw*.16,headBaseYaw:pose.neck.yaw*.12,headPitch:mix(headPitch*.68,peck.head),headYaw:pose.head.yaw*.72,
   hipLeft:mix(clamp(pose.legs.left.hipPitch*legGain.hip,-.38,.38),peck.hip),
   kneeLeft:mix(clamp(pose.legs.left.kneePitch*legGain.knee,-.10,.34),peck.knee),
   ankleLeft:mix(clamp(pose.legs.left.footPitch*legGain.ankle,-.24,.24),peck.ankle),
   toeLeft:mix(-clamp(pose.legs.left.footPitch*legGain.ankle,-.24,.24)*.34,peck.toe),
   hipRight:mix(clamp(pose.legs.right.hipPitch*legGain.hip,-.38,.38),peck.hip),
   kneeRight:mix(clamp(pose.legs.right.kneePitch*legGain.knee,-.10,.34),peck.knee),
   ankleRight:mix(clamp(pose.legs.right.footPitch*legGain.ankle,-.24,.24),peck.ankle),
   toeRight:mix(-clamp(pose.legs.right.footPitch*legGain.ankle,-.24,.24)*.34,peck.toe),
   wingLeft:clamp(pose.wings.leftOpen,0,1)*-.62,wingRight:clamp(pose.wings.rightOpen,0,1)*.62
  };
 }
 function verifyInvariants(){
  const violations=[];
  for(const id of CHICKEN_PHASE1_VOLUME_NECK_BONE_ORDER){
   const bone=bones[id];
   if(id!=='body_root'&&bone.position.distanceTo(bindLocal[id])>1e-7)violations.push({type:'bone_length_or_local_position_changed',joint:id});
   if(bone.scale.distanceTo(bindScale[id])>1e-7)violations.push({type:'bone_scale_changed',joint:id});
   const q=Math.hypot(bone.quaternion.x,bone.quaternion.y,bone.quaternion.z,bone.quaternion.w);
   if(!Number.isFinite(q)||Math.abs(q-1)>1e-6)violations.push({type:'invalid_quaternion',joint:id,length:q});
  }
  return{passed:violations.length===0,violations};
 }
 function applyPose(pose){
  if(!pose?.root||!pose?.body||!pose?.neck||!pose?.head||!pose?.legs||!pose?.wings)throw new Error('invalid chicken pose');
  reset();const a=mapPose(pose),root=bones.body_root,base=bindLocal.body_root;
  root.position.set(base.x+(pose.root.position[0]-rootOrigin[0])*rootScale,
   base.y+(pose.root.position[1]-rootOrigin[1])+clamp(pose.body.yOffset,-.025,.025)+a.rootCrouch,
   base.z+(pose.root.position[2]-rootOrigin[2])*rootScale);
  rotate('body_root',0,pose.root.yaw,0);rotate('pelvis',a.pelvisPitch,0,a.bodyRoll*.38);rotate('chest',a.chestPitch,0,a.bodyRoll*.54);
  rotate('neck_base',a.neckBasePitch,a.neckBaseYaw,0);rotate('neck_c0',a.neck0Pitch,a.neck0Yaw,0);rotate('neck_c1',a.neck1Pitch,a.neck1Yaw,0);
  rotate('neck_c2',a.neck2Pitch,a.neck2Yaw,0);rotate('neck_c3',a.neck3Pitch,a.neck3Yaw,0);rotate('head_base',a.headBasePitch,a.headBaseYaw,0);
  rotate('head',a.headPitch,a.headYaw,0);rotate('hip_l',a.hipLeft,0,0);rotate('knee_l',a.kneeLeft,0,0);rotate('ankle_l',a.ankleLeft,0,0);rotate('toe_l',a.toeLeft,0,0);
  rotate('hip_r',a.hipRight,0,0);rotate('knee_r',a.kneeRight,0,0);rotate('ankle_r',a.ankleRight,0,0);rotate('toe_r',a.toeRight,0,0);
  rotate('wing_l',0,0,a.wingLeft);rotate('wing_r',0,0,a.wingRight);rotate('tail',0,0,clamp(-pose.body.roll*.28,-.06,.06));
  group.updateMatrixWorld(true);skeleton.update();
  const beak=beakTipLocal.clone().applyMatrix4(bones.head.matrixWorld),leftToe=leftToeTipLocal.clone().applyMatrix4(bones.toe_l.matrixWorld),rightToe=rightToeTipLocal.clone().applyMatrix4(bones.toe_r.matrixWorld);
  lastContactPoints=Object.freeze({beak:Object.freeze(beak.toArray()),leftToe:Object.freeze(leftToe.toArray()),rightToe:Object.freeze(rightToe.toArray()),billGroundError:beak.y,leftFootGroundError:leftToe.y,rightFootGroundError:rightToe.y});
  applyCount++;lastPose=pose;lastAppliedAngles=a;lastReport=verifyInvariants();
  return{applied:true,applyCount,state:pose.state,contacts:{...pose.contacts},appliedAngles:{...a},contactPoints:lastContactPoints,invariantReport:lastReport,peckAdapterApplied:pose.state==='peck'};
 }
 function diagnostics(){
  return{
   schema:'life_ecosystem/chicken_phase1_articulated_skin_diagnostics@2.0',boneCount:CHICKEN_PHASE1_VOLUME_NECK_BONE_ORDER.length,
   skinnedMeshCount:baseSkin.meshes.filter(m=>m?.isSkinnedMesh).length,applyCount,lastState:lastPose?.state??null,
   lastContacts:lastPose?.contacts?{...lastPose.contacts}:null,lastAppliedAngles:lastAppliedAngles?{...lastAppliedAngles}:null,lastContactPoints,
   lastInvariantReport:lastReport,rootMotionScale:rootScale,weightingRevision:'six-link-neck-volume-distribution-v4',
   peckKinematicsRevision:'six-link-volume-preserving-s-curve-v2',baseSkinRevision:baseDiagnostics.weightingRevision||null,meshAudits
  };
 }
 function detach(){if(bones.body_root.parent)bones.body_root.parent.remove(bones.body_root);}
 return Object.freeze({bones,skeleton,meshes:baseSkin.meshes,applyPose,verifyInvariants,detach,diagnostics,rootOrigin:Object.freeze([...rootOrigin])});
}
