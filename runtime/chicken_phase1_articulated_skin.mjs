const EPSILON=1e-8;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const sat=v=>clamp(v,0,1);
const ss=(a,b,v)=>{const t=sat((v-a)/(b-a||1));return t*t*(3-2*t)};

export const CHICKEN_PHASE1_BONE_ORDER=Object.freeze([
 'body_root','pelvis','chest','neck_c0','neck_c1','head','wing_l','wing_r',
 'hip_l','knee_l','ankle_l','toe_l','hip_r','knee_r','ankle_r','toe_r','tail'
]);

export const CHICKEN_PHASE1_BIND_WORLD=Object.freeze({
 body_root:Object.freeze([-.08,.39,.09]),pelvis:Object.freeze([-.08,.39,.09]),chest:Object.freeze([.10,.58,.09]),
 neck_c0:Object.freeze([.22,.72,.09]),neck_c1:Object.freeze([.30,.84,.09]),head:Object.freeze([.39,.93,.09]),
 wing_l:Object.freeze([-.02,.57,.185]),wing_r:Object.freeze([-.02,.57,-.005]),
 hip_l:Object.freeze([-.035,.33,.14]),knee_l:Object.freeze([-.025,.17,.14]),ankle_l:Object.freeze([.00,.050,.14]),toe_l:Object.freeze([.080,.018,.14]),
 hip_r:Object.freeze([-.035,.33,.04]),knee_r:Object.freeze([-.025,.17,.04]),ankle_r:Object.freeze([.00,.050,.04]),toe_r:Object.freeze([.080,.018,.04]),
 tail:Object.freeze([-.31,.53,.09])
});

const PARENT=Object.freeze({body_root:null,pelvis:'body_root',chest:'pelvis',neck_c0:'chest',neck_c1:'neck_c0',head:'neck_c1',wing_l:'chest',wing_r:'chest',hip_l:'pelvis',knee_l:'hip_l',ankle_l:'knee_l',toe_l:'ankle_l',hip_r:'pelvis',knee_r:'hip_r',ankle_r:'knee_r',toe_r:'ankle_r',tail:'pelvis'});

function addWeight(bucket,index,weight){if(weight>EPSILON)bucket.push([index,weight]);}
function packWeights(bucket){bucket.sort((a,b)=>b[1]-a[1]);const selected=bucket.slice(0,4);let total=selected.reduce((s,v)=>s+v[1],0);if(total<EPSILON){selected.length=0;selected.push([0,1]);total=1;}const indices=[0,0,0,0],weights=[0,0,0,0];for(let i=0;i<selected.length;i++){indices[i]=selected[i][0];weights[i]=selected[i][1]/total;}return{indices,weights};}

export function computeChickenPhase1VertexWeights(x,y,z,materialKind='body',options={}){
 const centerZ=options.centerZ??.09,index=options.boneIndex||Object.fromEntries(CHICKEN_PHASE1_BONE_ORDER.map((id,i)=>[id,i])),bucket=[];
 const headAppendage=['comb','iris','nostril','lid'].includes(materialKind)||((materialKind==='parts'||materialKind==='body')&&x>.30&&y>.78);
 if(headAppendage){addWeight(bucket,index.head,1);return packWeights(bucket);}
 if(y<.37&&(materialKind==='parts'||materialKind==='body')){
  const side=z>=centerZ?'l':'r',hip=index[`hip_${side}`],knee=index[`knee_${side}`],ankle=index[`ankle_${side}`],toe=index[`toe_${side}`];
  const hipW=ss(.15,.34,y),toeW=(1-ss(.025,.085,y))*ss(.015,.075,x+.02),ankleW=(1-ss(.10,.20,y))*(1-toeW),kneeW=Math.max(0,1-hipW-ankleW-toeW);
  addWeight(bucket,hip,hipW);addWeight(bucket,knee,kneeW);addWeight(bucket,ankle,ankleW);addWeight(bucket,toe,toeW);return packWeights(bucket);
 }
 if(materialKind==='feather'){
  const tailW=1-ss(-.28,-.10,x);if(tailW>.35){addWeight(bucket,index.tail,.9*tailW);addWeight(bucket,index.pelvis,.1+.1*(1-tailW));return packWeights(bucket);}
  const side=z>=centerZ?'l':'r',wing=index[`wing_${side}`],lateral=ss(.025,.095,Math.abs(z-centerZ)),wingDomain=ss(-.24,-.08,x)*(1-ss(.16,.28,x))*ss(.36,.50,y)*(1-ss(.72,.84,y)),wingW=lateral*wingDomain;
  if(wingW>.12){addWeight(bucket,wing,.82+.16*wingW);addWeight(bucket,index.chest,.18-.10*wingW);return packWeights(bucket);}
 }
 const head=ss(.315,.405,x)*ss(.73,.88,y),neck1=ss(.245,.34,x)*ss(.66,.82,y)*(1-head*.75),neck0=ss(.14,.255,x)*ss(.56,.74,y)*(1-head*.8)*(1-neck1*.45),tail=(1-ss(-.30,-.11,x))*ss(.34,.61,y),chest=ss(-.08,.14,x)*ss(.43,.70,y)*(1-neck0*.50),pelvis=Math.max(.04,1-head-neck1-neck0-tail*.72-chest*.62);
 addWeight(bucket,index.head,head);addWeight(bucket,index.neck_c1,neck1);addWeight(bucket,index.neck_c0,neck0);addWeight(bucket,index.tail,tail*.82);addWeight(bucket,index.chest,chest);addWeight(bucket,index.pelvis,pelvis);return packWeights(bucket);
}

export function computeChickenPhase1SkinAttributes(positionArray,materialKind='body',options={}){
 if(!positionArray||positionArray.length%3!==0)throw new Error('positionArray must contain xyz triples');const count=positionArray.length/3,indices=new Uint16Array(count*4),weights=new Float32Array(count*4);
 for(let i=0;i<count;i++){const q=i*3,out=i*4,packed=computeChickenPhase1VertexWeights(positionArray[q],positionArray[q+1],positionArray[q+2],materialKind,options);for(let k=0;k<4;k++){indices[out+k]=packed.indices[k];weights[out+k]=packed.weights[k];}}
 return{indices,weights,count};
}

function requireThree(THREE){for(const name of['Bone','Skeleton','SkinnedMesh','Uint16BufferAttribute','Float32BufferAttribute','Quaternion','Vector3'])if(!THREE?.[name])throw new Error(`THREE.${name} is required`);}
function clone3(value){return[value[0],value[1],value[2]];}
function setAxisAngle(THREE,axis,angle){return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...axis),angle);}

export function createChickenPhase1ArticulatedSkin(THREE,group,meshes,options={}){
 requireThree(THREE);if(!group||!Array.isArray(meshes))throw new Error('group and meshes are required');
 const bindWorld=options.bindWorld||CHICKEN_PHASE1_BIND_WORLD,boneIndex=Object.fromEntries(CHICKEN_PHASE1_BONE_ORDER.map((id,i)=>[id,i])),bones={},bindLocal={},bindQuaternion={},bindScale={};
 for(const id of CHICKEN_PHASE1_BONE_ORDER){const bone=new THREE.Bone();bone.name=id;bones[id]=bone;}
 for(const id of CHICKEN_PHASE1_BONE_ORDER){const parentId=PARENT[id],world=bindWorld[id],parentWorld=parentId?bindWorld[parentId]:[0,0,0];bones[id].position.set(world[0]-parentWorld[0],world[1]-parentWorld[1],world[2]-parentWorld[2]);if(parentId)bones[parentId].add(bones[id]);}
 group.add(bones.body_root);group.updateMatrixWorld(true);const skeleton=new THREE.Skeleton(CHICKEN_PHASE1_BONE_ORDER.map(id=>bones[id]));skeleton.calculateInverses();
 for(const id of CHICKEN_PHASE1_BONE_ORDER){bindLocal[id]=bones[id].position.clone();bindQuaternion[id]=bones[id].quaternion.clone();bindScale[id]=bones[id].scale.clone();}
 const converted=[];
 for(let i=0;i<meshes.length;i++){
  const original=meshes[i];if(!original?.geometry?.attributes?.position||original.isSkinnedMesh){converted.push(original);continue;}
  const kind=original.userData?.materialKind||'body',positions=original.geometry.attributes.position.array,attrs=computeChickenPhase1SkinAttributes(positions,kind,{centerZ:options.centerZ??.09,boneIndex});
  original.geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(attrs.indices,4));original.geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(attrs.weights,4));
  const skinned=new THREE.SkinnedMesh(original.geometry,original.material);skinned.name=original.name||`chicken_${kind}_${i}`;skinned.position.copy(original.position);skinned.quaternion.copy(original.quaternion);skinned.scale.copy(original.scale);skinned.visible=original.visible;skinned.renderOrder=original.renderOrder;skinned.frustumCulled=original.frustumCulled;skinned.userData={...original.userData,phase1Skinned:true};
  group.remove(original);group.add(skinned);skinned.bind(skeleton);meshes[i]=skinned;converted.push(skinned);
 }
 const rootOrigin=clone3(options.rootOrigin||[0,0,0]),rootScale=options.rootMotionScale??.42;let applyCount=0,lastPose=null,lastReport=null;
 function resetRotations(){for(const id of CHICKEN_PHASE1_BONE_ORDER){bones[id].quaternion.copy(bindQuaternion[id]);bones[id].scale.copy(bindScale[id]);if(id!=='body_root')bones[id].position.copy(bindLocal[id]);}}
 function rotate(id,pitch=0,yaw=0,roll=0){const b=bones[id];b.quaternion.copy(bindQuaternion[id]);const qYaw=setAxisAngle(THREE,[0,1,0],yaw),qPitch=setAxisAngle(THREE,[0,0,1],pitch),qRoll=setAxisAngle(THREE,[1,0,0],roll);b.quaternion.multiply(qYaw).multiply(qPitch).multiply(qRoll);}
 function applyPose(pose){
  if(!pose?.root||!pose?.body||!pose?.neck||!pose?.head||!pose?.legs||!pose?.wings)throw new Error('invalid chicken pose');resetRotations();const root=bones.body_root,base=bindLocal.body_root;
  root.position.set(base.x+(pose.root.position[0]-rootOrigin[0])*rootScale,base.y+(pose.root.position[1]-rootOrigin[1]),base.z+(pose.root.position[2]-rootOrigin[2])*rootScale);rotate('body_root',0,pose.root.yaw,0);
  rotate('pelvis',pose.body.pitch*.45,0,pose.body.roll*.42);rotate('chest',pose.body.pitch*.55,0,pose.body.roll*.58);rotate('neck_c0',pose.neck.pitch*.55,pose.neck.yaw*.46,0);rotate('neck_c1',pose.neck.pitch*.45,pose.neck.yaw*.54,0);rotate('head',pose.head.pitch,pose.head.yaw,0);
  rotate('hip_l',pose.legs.left.hipPitch,0,0);rotate('knee_l',pose.legs.left.kneePitch,0,0);rotate('ankle_l',pose.legs.left.footPitch,0,0);rotate('hip_r',pose.legs.right.hipPitch,0,0);rotate('knee_r',pose.legs.right.kneePitch,0,0);rotate('ankle_r',pose.legs.right.footPitch,0,0);
  rotate('wing_l',0,0,-pose.wings.leftOpen*.82);rotate('wing_r',0,0,pose.wings.rightOpen*.82);rotate('tail',0,0,clamp(-pose.body.roll*.35,-.08,.08));group.updateMatrixWorld(true);skeleton.update();applyCount++;lastPose=pose;lastReport=verifyInvariants();return{applied:true,applyCount,state:pose.state,contacts:{...pose.contacts},invariantReport:lastReport};
 }
 function verifyInvariants(){const violations=[];for(const id of CHICKEN_PHASE1_BONE_ORDER){const b=bones[id],bp=bindLocal[id],bs=bindScale[id];if(id!=='body_root'&&b.position.distanceTo(bp)>1e-7)violations.push({type:'bone_length_or_local_position_changed',joint:id});if(b.scale.distanceTo(bs)>1e-7)violations.push({type:'bone_scale_changed',joint:id});const ql=Math.hypot(b.quaternion.x,b.quaternion.y,b.quaternion.z,b.quaternion.w);if(!Number.isFinite(ql)||Math.abs(ql-1)>1e-6)violations.push({type:'invalid_quaternion',joint:id,length:ql});}return{passed:violations.length===0,violations};}
 function detach(){if(bones.body_root.parent)bones.body_root.parent.remove(bones.body_root);}
 function diagnostics(){return{schema:'life_ecosystem/chicken_phase1_articulated_skin_diagnostics@1.0',boneCount:CHICKEN_PHASE1_BONE_ORDER.length,skinnedMeshCount:converted.filter(value=>value?.isSkinnedMesh).length,applyCount,lastState:lastPose?.state??null,lastContacts:lastPose?.contacts?{...lastPose.contacts}:null,lastInvariantReport:lastReport,rootMotionScale:rootScale};}
 return Object.freeze({bones,skeleton,meshes:converted,applyPose,verifyInvariants,detach,diagnostics,rootOrigin:Object.freeze([...rootOrigin])});
}
