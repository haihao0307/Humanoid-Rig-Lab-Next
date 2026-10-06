import * as THREE from 'three';
import {IDENTITY_PARAMETERS,FACE_IDENTITY_GLSL,normalizeIdentity,identityTransform,identityNormal,identityBasis} from './FaceIdentityModel.mjs';
import {bindFaceLandmarks} from './FaceLandmarks.mjs';
import {measurementRows,FACE_COMPARISON_CAMERA} from './FaceMeasurements.mjs';
export function createFaceIdentityBinding({mesh,surface,data,face,eyes}){
 const p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal,source=p.array.slice(),sourceNormals=n.array.slice(),head=[];
 for(let i=0;i<p.count;i++)if(source[i*3+1]>1.485&&Math.abs(source[i*3])<.18)head.push(i);
 const bindings=bindFaceLandmarks(surface,data,eyes),uniform={value:new Float32Array(IDENTITY_PARAMETERS.length)};
 mesh.geometry.setAttribute('faceIdentitySource',new THREE.BufferAttribute(source,3));mesh.userData.faceIdentitySourcePositions=source;
 const faceIds=face.rows.vertices,faceSet=new Set(faceIds),mappedFace=new Float32Array(faceIds.length*3),mappedNormals=new Float32Array(faceIds.length*3);
 let recipe=normalizeIdentity(),effective={},revision=0,dirty=true,outside={minJacobian:1,maxStretch:1,maxDisplacementMM:0},lastReport={safeScale:1,minJacobian:1,maxStretch:1,maxDisplacementMM:0},listeners=new Set();
 // Socket clipping stays in the undeformed construction frame, then the skin
 // and all eye components use exactly the same authored identity map.
 const headMaterial=mesh.material[2],previous=headMaterial.onBeforeCompile,oldKey=headMaterial.customProgramCacheKey();
 headMaterial.onBeforeCompile=shader=>{previous(shader);shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 faceIdentitySource;').replace('socketP=position;','socketP=faceIdentitySource;');};headMaterial.customProgramCacheKey=()=>oldKey+'|face-identity-source@1';headMaterial.needsUpdate=true;
 for(const eye of eyes.eyes)for(const object of [eye.globe,...eye.lids.map(l=>l.lid)]){
  const material=object.material,before=material.onBeforeCompile,key=material.customProgramCacheKey(),rotation={value:new THREE.Matrix3()},origin={value:new THREE.Vector3(eye.cx,1.656,eye.cz)},matrix=new THREE.Matrix4();
  material.onBeforeCompile=shader=>{before(shader);Object.assign(shader.uniforms,{faceIdentityValues:uniform,fiEyeRotation:rotation,fiEyeOrigin:origin});shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\n'+FACE_IDENTITY_GLSL+'\nuniform mat3 fiEyeRotation;uniform vec3 fiEyeOrigin;').replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
   vec3 fiNormalPoint;mat3 fiNormalJ;fiSample(fiEyeOrigin+fiEyeRotation*position,fiNormalPoint,fiNormalJ);objectNormal=transpose(fiEyeRotation)*fiNormal(fiEyeRotation*objectNormal,fiNormalJ);`).replace('#include <begin_vertex>',`#include <begin_vertex>
   vec3 fiMapped;mat3 fiPointJ;fiSample(fiEyeOrigin+fiEyeRotation*transformed,fiMapped,fiPointJ);transformed=transpose(fiEyeRotation)*(fiMapped-fiEyeOrigin);`);};material.customProgramCacheKey=()=>key+'|face-identity-eye@1';material.needsUpdate=true;
  const beforeRender=object.onBeforeRender;object.onBeforeRender=function(...args){rotation.value.setFromMatrix4(matrix.makeRotationFromQuaternion(object.quaternion));beforeRender?.apply(this,args);};
 }
 function cacheFace(){faceIds.forEach((id,k)=>{mappedFace.set(p.array.subarray(id*3,id*3+3),k*3);mappedNormals.set(n.array.subarray(id*3,id*3+3),k*3);});}
 function apply(onlyFace=false){
  if(!Object.keys(recipe.parameters).length){if(dirty)for(const id of head){p.array.set(source.subarray(id*3,id*3+3),id*3);n.array.set(sourceNormals.subarray(id*3,id*3+3),id*3);}effective={};uniform.value.fill(0);lastReport={safeScale:1,minJacobian:1,maxStretch:1,maxDisplacementMM:0};dirty=false;cacheFace();p.needsUpdate=n.needsUpdate=true;mesh.geometry.attributes.faceIdentitySource.needsUpdate=true;revision++;for(const fn of listeners)fn();return lastReport;}
  const active=IDENTITY_PARAMETERS.filter(d=>recipe.parameters[d.id]);
  let scale=onlyFace?lastReport.safeScale:1,report;const samples=onlyFace?faceIds:head;
  do{
   const parameters=Object.fromEntries(Object.entries(recipe.parameters).map(([id,v])=>[id,v*scale]));report={safeScale:scale,minJacobian:onlyFace?outside.minJacobian:1,maxStretch:onlyFace?outside.maxStretch:1,maxDisplacementMM:onlyFace?outside.maxDisplacementMM:0};const nextOutside={minJacobian:1,maxStretch:1,maxDisplacementMM:0};
   for(const id of samples){const base=Array.from(source.subarray(id*3,id*3+3)),result=identityTransform(base,parameters,true,active),normal=identityNormal(Array.from(sourceNormals.subarray(id*3,id*3+3)),result.J),displacement=Math.hypot(...result.point.map((x,k)=>x-base[k]))*1000;p.setXYZ(id,...result.point);n.setXYZ(id,...normal.normal);report.minJacobian=Math.min(report.minJacobian,normal.determinant);report.maxStretch=Math.max(report.maxStretch,normal.stretch);report.maxDisplacementMM=Math.max(report.maxDisplacementMM,displacement);if(!faceSet.has(id)){nextOutside.minJacobian=Math.min(nextOutside.minJacobian,normal.determinant);nextOutside.maxStretch=Math.max(nextOutside.maxStretch,normal.stretch);nextOutside.maxDisplacementMM=Math.max(nextOutside.maxDisplacementMM,displacement);}}
   if(onlyFace&&(report.minJacobian<=.42||report.maxStretch>=1.9))return apply(false);
   if(!onlyFace)outside=nextOutside;
   if(report.minJacobian>.42&&report.maxStretch<1.9){effective=parameters;break;}scale*=.8;
  }while(scale>.04);
  if(scale<=.04)throw Error('面部组合超出安全形变范围，请减少调整');
  lastReport=report;dirty=false;cacheFace();IDENTITY_PARAMETERS.forEach((d,i)=>uniform.value[i]=effective[d.id]||0);p.needsUpdate=n.needsUpdate=true;mesh.geometry.attributes.faceIdentitySource.needsUpdate=true;revision++;for(const fn of listeners)fn();return report;
 }
 face.afterDeform=()=>{let changed=false;for(const id of faceIds){for(let k=0;k<3;k++)if(source[id*3+k]!==p.array[id*3+k]||sourceNormals[id*3+k]!==n.array[id*3+k])changed=true;source.set(p.array.subarray(id*3,id*3+3),id*3);sourceNormals.set(n.array.subarray(id*3,id*3+3),id*3);}if(dirty||changed)apply(!dirty);else{faceIds.forEach((id,k)=>{p.array.set(mappedFace.subarray(k*3,k*3+3),id*3);n.array.set(mappedNormals.subarray(k*3,k*3+3),id*3);});p.needsUpdate=n.needsUpdate=true;}};
 const positionOf=(row,array)=>row.binding?.constructed?[...row.binding.point]:row.binding?.ids?.reduce((sum,id,j)=>sum.map((v,k)=>v+array[id*3+k]*row.binding.weights[j]),[0,0,0]);
 function landmarks(){return bindings.map(row=>({...row,point:row.binding?.constructed?identityTransform(row.binding.point,effective):positionOf(row,p.array),binding:undefined}));}
 // Linear field samples bind to actual source vertices; predictions match the
 // CPU-applied surface interpolation, rather than moving an arbitrary seed.
 function fitEvaluator(){const rows=bindings.map(row=>{const points=row.binding?.constructed?[row.binding.point]:row.binding?.ids?.map(id=>Array.from(source.subarray(id*3,id*3+3))),weights=row.binding?.weights||[1],base=points?.reduce((s,p,i)=>s.map((v,k)=>v+p[k]*weights[i]),[0,0,0]),basis=points?IDENTITY_PARAMETERS.map(d=>points.reduce((s,p,i)=>{const b=identityBasis(p,d);return s.map((v,k)=>v+b.delta[k]*weights[i]);},[0,0,0])):null;return {...row,base,basis};});
  const evaluate=parameters=>rows.map(row=>({...row,point:row.base?row.base.map((x,k)=>x+IDENTITY_PARAMETERS.reduce((s,d,i)=>s+(parameters[d.id]||0)*row.basis[i][k],0)):null,binding:undefined,basis:undefined,base:undefined}));
  // Cache derivatives on representative real head vertices and eye surfaces.
  // Fit candidates must remain inside the same runtime deformation limits;
  // post-fit uniform clamping alone can undo a numerically good fit.
  const stride=Math.max(1,Math.floor(head.length/4500)),sample=head.filter((_,i)=>i%stride===0).map(id=>Array.from(source.subarray(id*3,id*3+3)));
  for(const e of eyes.eyes)for(let latitude=-4;latitude<=4;latitude++)for(let longitude=0;longitude<16;longitude++){const y=latitude/4*.0125,r=Math.sqrt(Math.max(0,.0125**2-y*y)),a=longitude*Math.PI/8;sample.push([e.cx+r*Math.cos(a),1.656+y,e.cz+r*Math.sin(a)]);}
  const jacobians=new Float32Array(sample.length*IDENTITY_PARAMETERS.length*9);
  sample.forEach((point,i)=>IDENTITY_PARAMETERS.forEach((d,j)=>jacobians.set(identityBasis(point,d).jacobian,(i*IDENTITY_PARAMETERS.length+j)*9)));
  const sparse=sample.map((_,i)=>IDENTITY_PARAMETERS.map((d,j)=>({id:d.id,offset:(i*IDENTITY_PARAMETERS.length+j)*9})).filter(({offset})=>jacobians.subarray(offset,offset+9).some(x=>Math.abs(x)>1e-12)));
  const sampleJacobian=(i,parameters)=>{const J=[1,0,0,0,1,0,0,0,1];for(const {id,offset}of sparse[i]){const v=parameters[id]||0;if(v)for(let k=0;k<9;k++)J[k]+=v*jacobians[offset+k];}return J;};
  evaluate.constraintResiduals=parameters=>{const residuals=[];for(let i=0;i<sample.length;i++){const J=sampleJacobian(i,parameters),result=identityNormal([0,0,1],J);residuals.push(.3*Math.max(0,.58-result.determinant));for(let k=0;k<3;k++)residuals.push(.3*Math.max(0,Math.hypot(J[k],J[k+3],J[k+6])-1.75));}return residuals;};
  evaluate.feasible=parameters=>{for(let i=0;i<sample.length;i++){const result=identityNormal([0,0,1],sampleJacobian(i,parameters));if(result.determinant<.48||result.stretch>1.86)return false;}return true;};
  return evaluate;
 }
 const api={parameters:IDENTITY_PARAMETERS,bindings,get revision(){return revision;},set(input){const next=normalizeIdentity(input),old=recipe;recipe=next;dirty=true;try{face.reset();eyes.update(0,{},{});return this.report;}catch(e){recipe=old;dirty=true;face.reset();throw e;}},export:()=>normalizeIdentity(recipe),landmarks,fitEvaluator,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},transform:p=>identityTransform(p,effective),measure:reference=>measurementRows(landmarks(),reference),get report(){return {schema:'human-r008/face-data-report@1',method:'authored-continuous-identity-fields@2',parameterRevision:'identity-fields-r28',parameterDefinitions:IDENTITY_PARAMETERS,source:recipe.source,units:'canonical metres / mm; photo ratios have no absolute scale',camera:FACE_COMPARISON_CAMERA,parameters:normalizeIdentity(recipe),effectiveParameters:{...effective},...lastReport,samples:head.length,landmarks:landmarks(),measurements:measurementRows(landmarks()),coverage:{externalSurface:true,semanticParameters:IDENTITY_PARAMETERS.length,landmarks:bindings.length,landmarksAvailable:bindings.filter(b=>b.binding).length,eyeAssemblyCoupled:true,eyeModel:'bounded coupled surface warp; not anatomical eyeball reconstruction',internalAnatomy:'NotObserved',photoDepth:'NotObserved',arbitraryFaceGuaranteed:false},safety:'sampled Jacobian and stretch; not proof of global no intersections',storedVertexArrays:0};}};
 api.jacobian=p=>identityTransform(p,effective,true).J;apply();eyes.identityMapping=api;return api;
}
