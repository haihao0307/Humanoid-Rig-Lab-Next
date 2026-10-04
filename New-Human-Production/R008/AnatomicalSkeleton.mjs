import * as THREE from 'three';
import {generateAnatomicalBone,selectAnatomicalLOD} from './AnatomicalField.mjs';
import {registerAnatomicalAtlas} from './AnatomicalRegistration.mjs';
let cached;
const nextFrame=()=>new Promise(resolve=>setTimeout(resolve,0));
export function loadAnatomicalAtlas(progress=()=>{}){
 if(cached)return cached;
 cached=(async()=>{
  progress('正在读取真实骨形参数…');
  const metaResponse=await fetch(new URL('./anatomy-data/bone-fields.json',import.meta.url));if(!metaResponse.ok)throw Error('Anatomical metadata unavailable');const metadata=await metaResponse.json();
  if(metadata.schema!=='bp3d-cosine-sdf-r27-1'||metadata.bones.length<190)throw Error('Incomplete licensed anatomical atlas');
  const response=await fetch(new URL('./anatomy-data/bone-fields.i16.gz',import.meta.url));if(!response.ok)throw Error('Anatomical coefficients unavailable');
  const bytes=await new Response(new Blob([await response.arrayBuffer()]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  if(bytes.byteLength!==metadata.coefficientBytes)throw Error('Anatomical coefficient byte count mismatch');
  if(globalThis.crypto?.subtle){const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');if(hash!==metadata.coefficientSha256)throw Error('Anatomical coefficient integrity mismatch');}
  const coefficients=new Int16Array(bytes),geometries=new Map(),fullGeometries=new Map(),levels=new Map(),start=performance.now();let triangles=0;
  function generate(bone,grid){const generated=generateAnatomicalBone(bone,coefficients,grid),geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(generated.positions,3));geometry.setAttribute('normal',new THREE.BufferAttribute(generated.normals,3));geometry.setIndex(new THREE.BufferAttribute(generated.indices,1));geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.userData={anatomicalShared:true,sourceId:bone.id,triangles:generated.triangles,grid};return geometry;}
  for(const [i,bone]of metadata.bones.entries()){
   progress(`生成真实骨形 ${i+1}/${metadata.bones.length} · ${bone.name}`);await nextFrame();
   const level=selectAnatomicalLOD(bone),geometry=generate(bone,level.grid);levels.set(bone.id,level);geometries.set(bone.id,geometry);if(level.full)fullGeometries.set(bone.id,geometry);triangles+=geometry.userData.triangles;
  }
  progress(`已生成 ${metadata.bones.length} 个独立骨面`);
  return {metadata,geometries,levels,triangles,getFullGeometry(id){if(!fullGeometries.has(id)){const bone=metadata.bones.find(b=>b.id===id);if(!bone)throw Error('Unknown bone');fullGeometries.set(id,generate(bone,bone.grid));}return fullGeometries.get(id);},generationMilliseconds:performance.now()-start};
 })().catch(error=>{cached=null;throw error;});return cached;
}
export function createAnatomicalSkeleton(subject,actor,profile,atlas,material,registered=null,kinematics){
 if(!atlas?.metadata||!atlas?.geometries)throw Error('Licensed anatomical bone parameters have not loaded');
 const root=new THREE.Group();root.name='BodyParts3DGeneratedSkeletonR27';
 const registration=registered||registerAnatomicalAtlas(profile,atlas.metadata),inverseActor=new THREE.Matrix4(),rows=[];let selected='all';
 for(const entry of registration.bones){const mesh=new THREE.Mesh(atlas.geometries.get(entry.id),material);mesh.name=entry.name;mesh.userData={anatomicalShared:true,sourceId:entry.id};mesh.matrixAutoUpdate=false;mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);rows.push({mesh,entry,registration:new THREE.Matrix4().fromArray(entry.matrix),bone:subject.skeleton.bones[entry.boneId],inverse:subject.skeleton.boneInverses[entry.boneId]});}
 function update(){actor.updateMatrixWorld(true);inverseActor.copy(actor.matrixWorld).invert();for(const row of rows){row.mesh.matrix.copy(kinematics.matrices[row.entry.boneId]).multiply(row.registration);row.mesh.matrixWorldNeedsUpdate=true;row.mesh.visible=selected==='all'||selected===row.entry.id;}}
 update();
 return {root,registration,update,select(id){if(id!=='all'&&!rows.some(r=>r.entry.id===id))throw Error('Unknown anatomical bone');selected=id;for(const row of rows)row.mesh.geometry=id===row.entry.id?atlas.getFullGeometry(id):atlas.geometries.get(row.entry.id);update();},bounds(id=selected){const box=new THREE.Box3();for(const r of rows)if(id==='all'||r.entry.id===id)box.union(r.mesh.geometry.boundingBox.clone().applyMatrix4(r.mesh.matrix));return box;},report(){return {schema:registration.schema,atlas:atlas.metadata.dataset,license:atlas.metadata.license,licenseUrl:atlas.metadata.licenseUrl,attribution:atlas.metadata.attribution,uniqueBoneSurfaces:rows.length,originalAnimationControls:subject.skeleton.bones.length,triangles:atlas.triangles,coefficientGzipBytes:atlas.metadata.coefficientGzipBytes,generationMilliseconds:atlas.generationMilliseconds,storedSourceVertices:0,registrationEvidence:registration.evidence,missingSourceElements:atlas.metadata.missingSourceElements,limitations:atlas.metadata.limitations,unknown:registration.unknown,selected,bones:rows.map(r=>{const b=atlas.metadata.bones.find(b=>b.id===r.entry.id);return {id:r.entry.id,name:r.entry.name,region:r.entry.region,ownerRole:r.entry.ownerRole,scale:r.entry.scale,resolution:r.mesh.geometry.userData.grid,sourceAreaP95Mm:(selected===r.entry.id?b.metrics:atlas.levels.get(r.entry.id).metrics).sourceAreaToContour.p95,sourceVertexP95Mm:(selected===r.entry.id?b.metrics:atlas.levels.get(r.entry.id).metrics).sourceVerticesToContour.p95,sourceTopology:b.sourceTopology,generatedTopology:selected===r.entry.id?b.contourTopology:atlas.levels.get(r.entry.id).topology,warnings:b.warnings,evidence:r.entry.evidence};})};},dispose(){root.removeFromParent();}};
}
