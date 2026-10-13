import * as T from 'three';
/** Evaluate exactly the live shader embedding, then the mesh world transform. */
export function evaluateBoundVertex(mesh,rig,id){
 const a=mesh.geometry.attributes;
 function carrier(suffix){const ids=a['simIDs'+suffix],weights=a['simWeights'+suffix],delta=a['simDelta'+suffix],p=new T.Vector3(),x=new T.Vector3(),n=new T.Vector3();
  for(let k=0;k<4;k++){const i=Math.round(ids.array[id*4+k])*12,w=weights.array[id*4+k];p.addScaledVector(new T.Vector3().fromArray(rig.pixels,i),w);x.addScaledVector(new T.Vector3().fromArray(rig.pixels,i+4),w);n.addScaledVector(new T.Vector3().fromArray(rig.pixels,i+8),w);}
  n.y+=1e-15;n.normalize();x.addScaledVector(n,-x.dot(n));x.x+=1e-15;x.normalize();const y=new T.Vector3().crossVectors(n,x);return p.addScaledVector(x,delta.getX(id)).addScaledVector(y,delta.getY(id)).addScaledVector(n,delta.getZ(id));
 }
 let p;if(!a.simIDs)p=new T.Vector3().fromBufferAttribute(a.position,id);else{p=carrier('');const blend=a.simBlend?.getX(id)||0;if(blend)p.lerp(carrier('B'),blend);}return p.applyMatrix4(mesh.matrixWorld);
}
export function worldShellMeasurements(root){root.updateMatrixWorld(true);const rig=root.userData.rig;return rig.parts.map(p=>{const g=p.mesh.geometry,n=g.userData.paperVertices,values=[];for(let i=0;i<n;i+=Math.max(1,Math.floor(n/80)))values.push(evaluateBoundVertex(p.mesh,rig,i).distanceTo(evaluateBoundVertex(p.mesh,rig,i+n)));return{part:p.name,minMM:Math.min(...values),maxMM:Math.max(...values),targetMM:p.t,sampleCount:values.length,wallEdges:g.userData.closedWallEdges,boundaryEdges:g.userData.boundaryEdges,periodic:g.userData.periodicOrCollapsedEdges,chordErrorMM:g.userData.maxBoundaryChordErrorMM,measurement:'live shader-equivalent world-space inner/outer pairs; includes seam compression'};});}
