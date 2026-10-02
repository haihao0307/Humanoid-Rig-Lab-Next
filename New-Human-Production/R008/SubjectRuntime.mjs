import * as THREE from 'three';
import {generateSurface} from './surface-generator.mjs';
import {decodeParameters} from './parameter-codec.mjs';
import {materialTextures} from './material-fields.mjs';
import {createFacialBinding} from './FacialBinding.mjs';
import {createProceduralEyes} from './ProceduralEyes.mjs';
import {createSkinMaterialBinding} from './SkinMaterial.mjs';
export async function loadSubjectParameters(url=new URL('./parameters.phf.gz',import.meta.url)){
 const compressed=await (await fetch(url)).arrayBuffer();const bytes=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();const data=decodeParameters(bytes);if(data.schema!=='parametric-human-uv-fields/v2')throw Error('Wrong subject schema');data.packageBytes=compressed.byteLength;return data;
}
export function createSubject(data,options={}){
 const surface=generateSurface(data,options),geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(surface.positions,3));geometry.setAttribute('color',new THREE.BufferAttribute(surface.colors,3));geometry.setAttribute('uv',new THREE.BufferAttribute(surface.parameters,2));const count=surface.positions.length/3;for(let half=0;half<2;half++){const ids=new Uint16Array(count*4),weights=new Float32Array(count*4);for(let i=0;i<count;i++)for(let j=0;j<4;j++){ids[i*4+j]=surface.skinIndex[i*8+half*4+j];weights[i*4+j]=surface.skinWeight[i*8+half*4+j];}geometry.setAttribute(half?'skinIndex2':'skinIndex',new THREE.BufferAttribute(ids,4));geometry.setAttribute(half?'skinWeight2':'skinWeight',new THREE.BufferAttribute(weights,4));}geometry.setAttribute('surfaceMaterial',new THREE.BufferAttribute(surface.material,2));geometry.setIndex(new THREE.BufferAttribute(surface.indices,1));for(const group of surface.groups)geometry.addGroup(group.start,group.count,group.materialIndex);if(surface.normals.length===surface.positions.length)geometry.setAttribute('normal',new THREE.BufferAttribute(surface.normals,3));else geometry.computeVertexNormals();
 // Merge shading normals at regenerated seam positions, without storing a mesh.
 const normals=geometry.attributes.normal.array,map=new Map();for(let i=0;i<surface.positions.length;i+=3){const key=Array.from(surface.positions.subarray(i,i+3),v=>Math.round(v*1e6)).join(',');if(!map.has(key))map.set(key,[]);map.get(key).push(i);}for(const rows of map.values())if(rows.length>1){const v=new THREE.Vector3();for(const i of rows)v.add(new THREE.Vector3(...normals.subarray(i,i+3)));v.normalize();for(const i of rows)v.toArray(normals,i);}
 const face=createFacialBinding(surface,data);geometry.setAttribute('faceInspection',new THREE.BufferAttribute(new Float32Array(count*4),4));
 const root=new THREE.Group();root.name='ProceduralSubject';const canonical=new THREE.Group();canonical.name='CanonicalFrame';canonical.position.fromArray(data.offset);canonical.scale.setScalar(data.scale);root.add(canonical);
 const armature=new THREE.Group();armature.name='Armature';armature.position.fromArray(data.armature.p);armature.quaternion.fromArray(data.armature.q);armature.scale.fromArray(data.armature.s);canonical.add(armature);
 const byName=new Map();for(const def of data.rig){const bone=new THREE.Bone();bone.name=def.name;bone.position.fromArray(def.p);bone.quaternion.fromArray(def.q);bone.scale.fromArray(def.s);byName.set(def.name,bone);}for(const def of data.rig){(byName.get(def.parent)||armature).add(byName.get(def.name));}
 root.updateMatrixWorld(true);
 const C=new THREE.Matrix4().makeScale(data.scale,data.scale,data.scale).setPosition(...data.offset),inverseC=C.clone().invert();const skeleton=new THREE.Skeleton(data.boneOrder.map(n=>byName.get(n)),data.inverses.map(a=>new THREE.Matrix4().fromArray(a).multiply(inverseC)));
 const materials=data.materials.map(m=>{const t=materialTextures(m);return new THREE.MeshStandardMaterial({name:m.name,map:t.basecolor,normalMap:t.normal,roughnessMap:t.roughness,metalnessMap:t.metallic,roughness:1,metalness:1,side:THREE.DoubleSide});});for(const material of materials){material.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec2 surfaceMaterial; varying vec2 vSurfaceMaterial; attribute vec4 skinIndex2; attribute vec4 skinWeight2;').replace('#include <begin_vertex>','#include <begin_vertex>\nvSurfaceMaterial=surfaceMaterial;');const base=THREE.ShaderChunk.skinbase_vertex.replace('#endif','mat4 boneMatX2=getBoneMatrix(skinIndex2.x);mat4 boneMatY2=getBoneMatrix(skinIndex2.y);mat4 boneMatZ2=getBoneMatrix(skinIndex2.z);mat4 boneMatW2=getBoneMatrix(skinIndex2.w);\n#endif');const deform=THREE.ShaderChunk.skinning_vertex.replace(/\btransformed\s*=/,'skinned += boneMatX2*skinVertex*skinWeight2.x + boneMatY2*skinVertex*skinWeight2.y + boneMatZ2*skinVertex*skinWeight2.z + boneMatW2*skinVertex*skinWeight2.w;\ntransformed =');const normal=THREE.ShaderChunk.skinnormal_vertex.replace(/skinMatrix\s*=\s*bindMatrixInverse/,'skinMatrix += skinWeight2.x*boneMatX2+skinWeight2.y*boneMatY2+skinWeight2.z*boneMatZ2+skinWeight2.w*boneMatW2;\nskinMatrix = bindMatrixInverse');shader.vertexShader=shader.vertexShader.replace('#include <skinbase_vertex>',base).replace('#include <skinning_vertex>',deform).replace('#include <skinnormal_vertex>',normal);shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vSurfaceMaterial;').replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor *= vSurfaceMaterial.x;').replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor *= vSurfaceMaterial.y;');};}const mesh=new THREE.SkinnedMesh(geometry,materials);mesh.name='GeneratedSurface';mesh.frustumCulled=false;root.add(mesh);mesh.bind(skeleton,new THREE.Matrix4());mesh.castShadow=true;mesh.receiveShadow=true;
 mesh.applyBoneTransform=function(index,target){const p=target.clone().applyMatrix4(this.bindMatrix),v=new THREE.Vector3(),M=new THREE.Matrix4();target.set(0,0,0);for(let k=0;k<8;k++){const w=surface.skinWeight[index*8+k];if(w){const id=surface.skinIndex[index*8+k];M.multiplyMatrices(skeleton.bones[id].matrixWorld,skeleton.boneInverses[id]);target.addScaledVector(v.copy(p).applyMatrix4(M),w);}}return target.applyMatrix4(this.bindMatrixInverse);};
 const mixer=new THREE.AnimationMixer(root),clips=data.animations.map(c=>new THREE.AnimationClip(c.name,c.duration,c.tracks.map(t=>{const Ctor=t.type==='quaternion'?THREE.QuaternionKeyframeTrack:THREE.VectorKeyframeTrack;return new Ctor(t.name,t.times,t.values,t.interpolation)})));
 const helper=new THREE.SkeletonHelper(canonical);helper.matrixAutoUpdate=true;helper.position.copy(canonical.position);helper.quaternion.copy(canonical.quaternion);helper.scale.copy(canonical.scale);helper.visible=false;helper.material.depthTest=false;helper.material.transparent=true;helper.material.opacity=.75;root.add(helper);
 const rest=[];root.traverse(o=>{if(o.isBone||o===armature)rest.push({o,p:o.position.clone(),q:o.quaternion.clone(),s:o.scale.clone()})});
 const bindWorld=new Map(skeleton.bones.map((bone,i)=>[bone,skeleton.boneInverses[i].clone().invert()]));
 const neutral=skeleton.bones.map(bone=>{const matrix=bindWorld.get(bone).clone(),parent=bindWorld.get(bone.parent)||bone.parent.matrixWorld;matrix.premultiply(parent.clone().invert());const p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();matrix.decompose(p,q,s);return {o:bone,p,q,s};});
 let active='rest',paused=false,inPlace=true;const motionOffset=new THREE.Vector3(),hip=skeleton.bones.find(b=>b.name==='pelvis'),bindHip=new THREE.Vector3().setFromMatrixPosition(bindWorld.get(hip));
 function play(name){root.position.sub(motionOffset);motionOffset.set(0,0,0);mixer.stopAllAction();gaitActions=null;gaitWeights=[1,0,0,0];for(const r of (name==='rest'?neutral:rest)){r.o.position.copy(r.p);r.o.quaternion.copy(r.q);r.o.scale.copy(r.s);}active=name;if(name!=='rest'){const clip=clips.find(c=>c.name===name);if(!clip)throw Error('Unknown clip '+name);mixer.clipAction(clip).reset().setEffectiveWeight(1).setEffectiveTimeScale(1).play();}root.updateMatrixWorld(true);skeleton.update();}
 const idleClip=new THREE.AnimationClip('game_idle',1,[...neutral,rest.find(r=>r.o===armature)].flatMap(r=>[new THREE.VectorKeyframeTrack(r.o.name+'.position',[0,1],[...r.p.toArray(),...r.p.toArray()]),new THREE.QuaternionKeyframeTrack(r.o.name+'.quaternion',[0,1],[...r.q.toArray(),...r.q.toArray()]),new THREE.VectorKeyframeTrack(r.o.name+'.scale',[0,1],[...r.s.toArray(),...r.s.toArray()])]));
 // Rebase the inherited shoulder posture onto the accepted neutral pose.
 // Correct animation keys before mixing, so neutral standing is not corrected
 // twice and animated swing remains intact. Original clips stay available.
 const shoulderNames=new Set(['spine_03','clavicle_l','clavicle_r','upperarm_l','upperarm_r']);
 const shoulderCorrections=new Map(neutral.filter(r=>shoulderNames.has(r.o.name)).map(r=>[r.o.name,r.q.clone().multiply(new THREE.Quaternion().fromArray(data.rig.find(d=>d.name===r.o.name).q).invert())]));
 const gameClips=new Map(clips.filter(c=>['walk','run','look_around'].includes(c.name)).map(c=>{
  const copy=c.clone();copy.name='game_'+c.name;
  if(c.name==='look_around'){
   // The source look-around contains a weight shift and small leg steps.
   // Keep the accepted stance below the waist; only animate the upper body.
   const stance=new Map([...neutral,rest.find(r=>r.o===armature)].map(r=>[r.o.name,r]));
   for(const track of copy.tracks){const split=track.name.lastIndexOf('.'),name=track.name.slice(0,split),property=track.name.slice(split+1),r=stance.get(name);if(!r||/^(spine_|neck_|head$|clavicle_|upperarm_|lowerarm_|hand_|thumb_|index_|middle_|ring_|pinky_)/.test(name))continue;const value=property==='quaternion'?r.q:property==='position'?r.p:r.s;for(let i=0;i<track.values.length;i+=value.toArray().length)value.toArray(track.values,i);}
  }
  for(const track of copy.tracks){
   const name=track.name.replace(/\.quaternion$/,'');if(!track.name.endsWith('.quaternion')||!shoulderCorrections.has(name))continue;
   const q=new THREE.Quaternion(),bone=byName.get(name),reference=neutral.find(r=>r.o===bone),sourceInverse=new THREE.Quaternion().fromArray(data.rig.find(d=>d.name===name).q).invert();
   const parentFrame=bindWorld.get(bone.parent)||bone.parent.matrixWorld,axis=new THREE.Vector3(1,0,0).applyQuaternion(new THREE.Quaternion().setFromRotationMatrix(parentFrame.clone().extractRotation(parentFrame)).invert());
   for(let i=0;i<track.values.length;i+=4){
    q.fromArray(track.values,i);
    if(name.startsWith('upperarm_')&&c.name!=='look_around'){
     // Keep the source's fore/aft arm swing in the accepted shoulder frame.
     // Discard the transverse roll that made the inherited gait flare or cave
     // the arms, without freezing the clavicle or elbow animation.
     q.multiply(sourceInverse);const projected=q.x*axis.x+q.y*axis.y+q.z*axis.z,raw=2*Math.atan2(projected,q.w),angle=Math.atan2(Math.sin(raw),Math.cos(raw));
     const swing=c.name==='walk'?angle*1.3:angle;
     q.setFromAxisAngle(axis,THREE.MathUtils.clamp(swing,c.name==='run'?-.85:-.52,c.name==='run'?.85:.52)).multiply(reference.q);
    }else q.premultiply(shoulderCorrections.get(name));
    q.normalize().toArray(track.values,i);
   }
  }
  return [c.name,copy];
 }));
 let gaitActions=null,gaitWeights=[1,0,0,0],idleWasActive=false;
 function locomotion(speed,dt,idleAmount=0){
  if(!gaitActions){play('rest');gaitActions=[idleClip,gameClips.get('walk'),gameClips.get('run'),gameClips.get('look_around')].map(c=>mixer.clipAction(c).reset().play());idleWasActive=false;}
  if(idleAmount>.01&&!idleWasActive)gaitActions[3].reset().play();idleWasActive=idleAmount>.01;
  const moving=THREE.MathUtils.clamp(speed/.65,0,1),running=THREE.MathUtils.clamp((speed-1.8)/1.8,0,1),idle=THREE.MathUtils.clamp(idleAmount,0,1),target=[(1-moving)*(1-idle),moving*(1-running),moving*running,(1-moving)*idle],a=1-Math.exp(-dt*12);
  // Measured from the original pelvis trajectory: 2.771055 m / 2.333333 s
  // for walking, 5.410191 m / 1.25 s for running. Match gait to world speed.
  gaitActions.forEach((action,i)=>{gaitWeights[i]+=(target[i]-gaitWeights[i])*a;action.setEffectiveWeight(gaitWeights[i]);action.setEffectiveTimeScale(i===0||i===3?1:Math.max(.15,speed/(i===1?1.187595:4.328153)));});active=speed>.12?(running>.5?'run':'walk'):idleAmount>.1?'look_around':'rest';
 }
 function finishPose(){
  root.position.sub(motionOffset);motionOffset.set(0,0,0);root.updateMatrixWorld(true);
  if(inPlace&&(active!=='rest'||gaitActions)){
   const current=hip.getWorldPosition(new THREE.Vector3()),reference=bindHip.clone().applyMatrix4(root.matrixWorld);
   if(root.parent){root.parent.worldToLocal(current);root.parent.worldToLocal(reference);}
   motionOffset.copy(reference).sub(current);motionOffset.y=0;root.position.add(motionOffset);root.updateMatrixWorld(true);
  }
  skeleton.update();
 }
 // Diagnostic colors are applied after lighting. Alpha zero preserves the
 // original skin/hair/eye maps, including when the inspector is closed.
 for(const material of materials){const compile=material.onBeforeCompile;material.onBeforeCompile=shader=>{compile(shader);shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec4 faceInspection; varying vec4 vFaceInspection;').replace('#include <begin_vertex>','#include <begin_vertex>\nvFaceInspection=faceInspection;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec4 vFaceInspection;').replace('#include <opaque_fragment>','outgoingLight=mix(outgoingLight,vFaceInspection.rgb,vFaceInspection.a);\n#include <opaque_fragment>');};}
 face.attach(mesh);play('rest');
 const eyes=createProceduralEyes({surface,mesh,byName,bindWorld,data});
 const skin=createSkinMaterialBinding({mesh,eyes});
 return {root,mesh,skeleton,mixer,clips,helper,surface,data,neutral,bindWorld,byName,face,eyes,skin,play,locomotion,finishPose,
  command(text){const name=/跳/.test(text)?'jump':/跑/.test(text)?'run':/走|步/.test(text)?'walk':/看|环顾/.test(text)?'look_around':'rest';play(name);return {phase:name,authority:'authored-61-bone-curves'}},
  step(dt){
   root.position.sub(motionOffset);motionOffset.set(0,0,0);if(!paused)mixer.update(Math.min(dt,.1));
   finishPose();
  },setInPlace(v){inPlace=v},setPaused(v){paused=v},get runCycle(){return gaitActions?2*gaitActions[2].time/gaitActions[2].getClip().duration:0},get idleClipTime(){return gaitActions?.[3]?.time||0},get gaitWeights(){return [...gaitWeights]},get phase(){return active}};
}
