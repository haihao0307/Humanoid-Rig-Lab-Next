import {createCandidateKinematics} from './CandidateKinematics.mjs';
import * as THREE from 'three';
import {fitMotorAnatomy,bellyProfile,pathMetrics,muscleKinematics} from './MotorAnatomy.mjs';
import {createAnatomicalSkeleton} from './AnatomicalSkeleton.mjs';

// Geometry is generated in this subject's bind frame. No baked anatomical assets.
export function createAnatomyDisplay(subject,actor,{profile=subject.body.anatomy,model=fitMotorAnatomy(profile),atlas,registration}={}){
 const root=new THREE.Group();root.name='GeneratedMotionAnatomy';
 const moving=[],boneMaterial=new THREE.MeshStandardMaterial({color:0xe0d5b9,roughness:.62});
 const kinematics=createCandidateKinematics(subject,actor,profile);
 const anatomical=createAnatomicalSkeleton(subject,actor,profile,atlas,boneMaterial,registration,kinematics),framework=anatomical.root,muscles=new THREE.Group();root.add(framework,muscles);
 const v=p=>new THREE.Vector3(...p);
 const inverseActor=new THREE.Matrix4();
 const segments=36,sides=12;
 for(const sourceSpec of model.muscles){const spec={...sourceSpec},anchors=spec.attachments.map(a=>({boneId:a.bone,bindPoint:v(a.bindPoint)})),curve=new THREE.CatmullRomCurve3(spec.attachments.map(a=>v(a.bindPoint)),false,'centripetal'),points=curve.getPoints(segments),rest=pathMetrics(points.map(p=>p.toArray())),geometry=new THREE.BufferGeometry(),positions=new Float32Array((segments+1)*(sides+1)*3),normals=new Float32Array(positions.length),colors=new Float32Array(positions.length),indices=[];
  if(spec.baselineVolumeProxy>0)spec.radius=Math.sqrt(spec.baselineVolumeProxy/(Math.PI*rest.weighted));
  for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){const a=i*(sides+1)+j,b=a+sides+1;indices.push(a,b,a+1,b,b+1,a+1);}
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.setIndex(indices);
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.65,metalness:0,side:THREE.DoubleSide}),mesh=new THREE.Mesh(geometry,material);mesh.name=spec.id;mesh.frustumCulled=false;muscles.add(mesh);moving.push({spec,anchors,curve,rest,geometry,mesh,previousLength:rest.length,state:null});
 }
 let selection='all',mode='framework';
 function update(dt=0){actor.updateMatrixWorld(true);inverseActor.copy(actor.matrixWorld).invert();kinematics.update();anatomical.update();
  for(const m of moving){m.curve.points=m.anchors.map(a=>a.bindPoint.clone().applyMatrix4(kinematics.matrices[a.boneId]));const points=m.curve.getPoints(segments),metrics=pathMetrics(points.map(p=>p.toArray())),state=muscleKinematics(m.rest,metrics,m.spec.radius,m.previousLength,dt);m.previousLength=metrics.length;m.state=state;
   const frames=m.curve.computeFrenetFrames(segments,false),p=m.geometry.attributes.position,n=m.geometry.attributes.normal,c=m.geometry.attributes.color,color=new THREE.Color(state.lengthRatio<.98?0xe35732:state.lengthRatio>1.02?0x4985aa:0xa82c36),tendon=new THREE.Color(0xe5d9b5);
   if(selection===m.spec.id)color.set(0xffb73a);
   for(let i=0;i<=segments;i++){const t=i/segments,r=m.spec.radius*state.radialScale*bellyProfile(t),shade=t<.13||t>.87?tendon:color;for(let j=0;j<=sides;j++){const a=j/sides*Math.PI*2,d=frames.normals[i].clone().multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[i],Math.sin(a)),q=points[i].clone().addScaledVector(d,r),k=i*(sides+1)+j;p.setXYZ(k,q.x,q.y,q.z);n.setXYZ(k,d.x,d.y,d.z);c.setXYZ(k,shade.r,shade.g,shade.b);}}
   p.needsUpdate=n.needsUpdate=c.needsUpdate=true;m.mesh.visible=mode==='muscles'&&(selection==='all'||selection===m.spec.id||moving.find(q=>q.spec.id===selection)?.spec.antagonist===m.spec.id);m.mesh.material.opacity=1;
  }
 }
 actor.add(root);update();root.visible=false;
 return {root,model,anatomical,kinematics,update,setMode(v){mode=v;root.visible=true;framework.visible=true;muscles.visible=v==='muscles';update();},select(id){selection=id;update();},get report(){return {schema:model.schema,methodId:model.methodId||null,mode,frameworkParts:anatomical.registration.bones.length,anatomical:anatomical.report(),muscles:moving.map(m=>({id:m.spec.id,label:m.spec.label,action:m.spec.action,antagonist:m.spec.antagonist,radius:m.spec.radius,referenceVolumeProxy:m.spec.baselineVolumeProxy||null,volumeEvidence:m.spec.volumeEvidence||'prior-only',surfaceConstrainedAttachments:m.spec.surfaceConstrainedAttachments||0,...m.state,restLength:m.rest.length,endpoints:m.curve.points.map(p=>p.toArray())})),authority:model.authority,unknown:model.unknown};},dispose(){root.removeFromParent();root.traverse(o=>{if(o.isMesh){if(!o.userData.anatomicalShared)o.geometry.dispose();if(o.material!==boneMaterial)o.material.dispose();}});boneMaterial.dispose();}};
}
