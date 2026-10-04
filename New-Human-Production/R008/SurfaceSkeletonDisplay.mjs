import * as THREE from 'three';
import {createHumanInverseSystem} from './HumanInverseSystem.mjs';
import {r008InverseCalibration} from './R008InverseCalibration.mjs';

export function createSurfaceSkeletonDisplay(subject,actor){
 const profile=subject.body.anatomy,positions=subject.mesh.geometry.attributes.skinRest.array,N=positions.length/3,materialIds=new Uint8Array(N),index=subject.mesh.geometry.index.array;
 for(const group of subject.mesh.geometry.groups)for(let i=group.start;i<group.start+group.count;i++)materialIds[index[i]]=group.materialIndex;
 const calibration=r008InverseCalibration(profile,subject.mesh.material),start=performance.now(),system=createHumanInverseSystem(profile,{positions,materialIds},calibration),fit=system.fit,elapsed=performance.now()-start;
 const root=new THREE.Group();root.name='SurfaceConstrainedInverseSkeleton';actor.add(root);root.visible=false;
 const gold=new THREE.MeshStandardMaterial({color:0xffc767,roughness:.55,depthTest:false}),cyan=new THREE.LineBasicMaterial({color:0x64bed0,transparent:true,opacity:.55,depthTest:false}),observedMaterial=new THREE.LineBasicMaterial({color:0x72ebc3,transparent:true,opacity:.8,depthTest:false}),uncertain=new THREE.MeshStandardMaterial({color:0xed7773,roughness:.7,depthTest:false});
 const dynamic=[],inverseActor=new THREE.Matrix4(),v=a=>new THREE.Vector3(...a),map=(p,id)=>{const bone=subject.skeleton.bones[id];return v(p).applyMatrix4(subject.skeleton.boneInverses[id]).applyMatrix4(bone.matrixWorld).applyMatrix4(inverseActor);};
 const priorGeom=new THREE.BufferGeometry(),priorEdges=profile.joints.flatMap((j,i)=>{const p=profile.joints.findIndex(p=>p.name===j.parent);return p<0?[]:[{id:i,p:j.position},{id:p,p:profile.joints[p].position}];});priorGeom.setAttribute('position',new THREE.BufferAttribute(new Float32Array(priorEdges.length*3),3));const priorLines=new THREE.LineSegments(priorGeom,cyan);priorLines.renderOrder=50;root.add(priorLines);
 for(const s of fit.segments){const ai=profile.roles[s.startRole],bi=profile.roles[s.endRole]??ai,mesh=new THREE.Mesh(new THREE.CylinderGeometry(.004,.004,1,12),s.status==='surface-fitted'?gold:uncertain);mesh.renderOrder=51;root.add(mesh);dynamic.push({type:'segment',id:s.id,mesh,a:s.start,b:s.end,ai,bi});
  for(const row of s.sections){if(row.status!=='fitted')continue;const points=[],ca=Math.cos(row.angle),sa=Math.sin(row.angle);for(let k=0;k<=32;k++){const angle=k/32*2*Math.PI,u=row.axes[0]*Math.cos(angle)*ca-row.axes[1]*Math.sin(angle)*sa,w=row.axes[0]*Math.cos(angle)*sa+row.axes[1]*Math.sin(angle)*ca;points.push(v(row.centre).addScaledVector(v(s.u),u).addScaledVector(v(s.v),w));}const geometry=new THREE.BufferGeometry().setFromPoints(points),line=new THREE.Line(geometry,observedMaterial);line.renderOrder=49;root.add(line);dynamic.push({type:'section',id:s.id,line,points:points.map(p=>p.toArray()),bone:ai});}
 }
 for(const [i,j]of fit.joints.entries())if(j.status.startsWith('surface-constrained-estimate')){const mesh=new THREE.Mesh(new THREE.SphereGeometry(.006,12,8),j.status.endsWith('needs-review')?uncertain:gold);mesh.renderOrder=52;root.add(mesh);dynamic.push({type:'joint',sources:j.sources,mesh,p:j.position,bone:i});}
 let sectionsVisible=true,priorVisible=true,selection='all';
 function update(){actor.updateMatrixWorld(true);inverseActor.copy(actor.matrixWorld).invert();for(let i=0;i<priorEdges.length;i++){const p=map(priorEdges[i].p,priorEdges[i].id);priorGeom.attributes.position.setXYZ(i,p.x,p.y,p.z);}priorGeom.attributes.position.needsUpdate=true;
  for(const d of dynamic){const selected=selection==='all'||d.id===selection||d.sources?.includes(selection);if(d.mesh)d.mesh.visible=selected;if(d.type==='segment'){const a=map(d.a,d.ai),b=map(d.b,d.bi),axis=b.clone().sub(a);d.mesh.position.copy(a).lerp(b,.5);d.mesh.scale.y=axis.length();d.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),axis.normalize());}else if(d.type==='joint')d.mesh.position.copy(map(d.p,d.bone));else{d.line.visible=sectionsVisible&&selected;for(let i=0;i<d.points.length;i++){const p=map(d.points[i],d.bone);d.line.geometry.attributes.position.setXYZ(i,p.x,p.y,p.z);}d.line.geometry.attributes.position.needsUpdate=true;}}
  priorLines.visible=priorVisible;
 }
 update();
 return {root,fit,system,update,setSections(v){sectionsVisible=v;update();},setPrior(v){priorVisible=v;update();},select(v){selection=v;update();},report(){return {...fit,unified:system.report(),methodPolicy:system.method,generationMilliseconds:elapsed,skinVertexCount:N,materialCalibration:calibration.evidence,selection};},export(){return system.export();},dispose(){root.removeFromParent();root.traverse(o=>{if(o.isMesh||o.isLine)o.geometry.dispose();});for(const m of [gold,cyan,observedMaterial,uncertain])m.dispose();}};
}
