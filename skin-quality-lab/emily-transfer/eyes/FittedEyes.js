import * as THREE from 'three';
import {EyeSystem} from './EyeSystem.js';
const clamp=THREE.MathUtils.clamp,smooth=t=>t*t*(3-2*t);

// Solve the front surface of the same corneal-cap equation used by ocularGeometry.
// A simple sphere is insufficient: its eyelids would intersect the raised cornea
// when blinking or looking sideways. This fit layer does not alter the head mesh.
export class FittedEyes extends EyeSystem {
 eyeFront(c,x,y){
  const e=this._fittingEye,inv=e?e.surfaceInverse:null,r=c.radius,dx=x-c.x,dy=y-c.y,disc=r*r-dx*dx-dy*dy;
  if(disc<=0)return null;
  let z=Math.sqrt(disc),m=inv?.elements;
  for(let i=0;i<5;i++){
   const lx=m?m[0]*dx+m[4]*dy+m[8]*z:dx,ly=m?m[1]*dx+m[5]*dy+m[9]*z:dy,lz=m?m[2]*dx+m[6]*dy+m[10]*z:z;
   const rsq=r*r-lx*lx-ly*ly;if(rsq<=1e-10)break;
   const s=Math.sqrt(rsq),a=clamp((s/r-.75)/.25,0,1),t=smooth(a),height=s+r*.13*t*t;
   const slope=1+6.24*t*a*(1-a),derivative=m?m[10]+slope*(lx*m[8]+ly*m[9])/s:1;
   if(Math.abs(derivative)<.1)break;
   const delta=clamp((lz-height)/derivative,-.003,.003);z-=delta;if(Math.abs(delta)<1e-7)break;
  }
  return c.z+z;
 }
 rimPoint(c,a,blink){const p=super.rimPoint(c,a,blink),z=this.eyeFront(c,p.x,p.y);if(z!==null)p.z=Math.max(p.z,z+.00024);return p;}
 updateLid(e,blink){
  this._fittingEye=e;e.surfaceInverse=e.surfaceInverse||new THREE.Matrix4();e.surfaceInverse.makeRotationFromQuaternion(e.pivot.quaternion).invert();
  super.updateLid(e,blink);
  const g=e.lid.mesh.geometry,P=g.attributes.position;
  for(let i=0;i<P.count;i++){const q=e.lid.entries[i];if(q.t>.87)continue;const z=this.eyeFront(e.c,P.getX(i),P.getY(i));if(z!==null&&z+.00015>P.getZ(i)){const weight=1-smooth(clamp((q.t-.69)/.18,0,1));P.setZ(i,THREE.MathUtils.lerp(P.getZ(i),z+.00015,weight));}}
  P.needsUpdate=true;g.computeVertexNormals();const N=g.attributes.normal;
  for(let i=0;i<P.count;i++){const q=e.lid.entries[i],t=smooth(clamp((q.t-.76)/.24,0,1));if(t){const n=new THREE.Vector3(N.getX(i),N.getY(i),N.getZ(i)).lerp(q.src.n,t).normalize();N.setXYZ(i,n.x,n.y,n.z);}}N.needsUpdate=true;
  this._fittingEye=null;
 }
}
