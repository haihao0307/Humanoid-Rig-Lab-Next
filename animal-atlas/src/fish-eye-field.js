import * as T from 'three';
import {installFunctionKernel} from './function-kernel.js';
// Analytic eye field: evaluate the same gaze/pupil expression per vertex on the GPU.
// Only the frame coefficients change. Normals retain the producer's existing convention.
export function fishEyes(root,geometry){
 const g=new T.BufferGeometry(),p=new Float32Array(geometry.positions),colors=new Float32Array(p.length);
 for(let i=0;i<p.length/3;i++){const c=geometry.components[i],color=c===3?[.002,.002,.002]:c===2?[.65,.39,.055]:c===0?[.11,.12,.085]:[.045,.04,.025];colors.set(color,i*3);}
 g.setAttribute('position',new T.BufferAttribute(p,3));g.setAttribute('color',new T.BufferAttribute(colors,3));g.setAttribute('eyePart',new T.BufferAttribute(new Uint8Array(geometry.components),1));
 const visible=Object.values(geometry.ranges).slice(0,4).reduce((n,x)=>n+x.count,0);g.setIndex(new T.BufferAttribute(new Uint32Array(geometry.indices).slice(0,visible),1));g.computeVertexNormals();
 const shader=`attribute float eyePart;uniform vec3 eyeCenter,eyeTangent,eyeUp,eyeOutward,eyeScale,eyeDirection,eyeGX,eyeGY;uniform float eyeRadius,eyePupil;
 vec3 eyePosition(vec3 p){if(eyePart==2.||eyePart==3.){float scale=eyePart==3.?mix(.78,1.34,clamp(eyePupil,0.,1.)):1.;vec2 local=p.xy*scale;float z=sqrt(max(0.,eyeRadius*eyeRadius-dot(local,local)))+(eyePart==3.?.00032:.00022);p=eyeDirection*z+eyeGX*local.x+eyeGY*local.y;}return (eyeCenter+eyeTangent*p.x+eyeUp*p.y+eyeOutward*p.z)*eyeScale;}`;
 return [1,-1].map(side=>{
  const uniforms=Object.fromEntries(['eyeCenter','eyeTangent','eyeUp','eyeOutward','eyeScale','eyeDirection','eyeGX','eyeGY'].map(k=>[k,{value:new T.Vector3()}]));uniforms.eyeRadius={value:0};uniforms.eyePupil={value:0};
  const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.24,side:T.DoubleSide});installFunctionKernel(material,{id:'atlas/fish-eye-field@1',uniforms,normal:false,glsl:shader+'\nvoid animalDeform(vec3 rest,vec3 restNormal,out vec3 p,out vec3 n){p=eyePosition(rest);n=restNormal;}'});
  const mesh=new T.Mesh(g,material);mesh.frustumCulled=false;root.add(mesh);
  return {side,mesh,update(frame,scale){for(const [key,value]of [['eyeCenter',frame.center],['eyeTangent',frame.tangent],['eyeUp',frame.up],['eyeOutward',frame.outward],['eyeScale',scale]])uniforms[key].value.fromArray(value);const cy=Math.cos(frame.gazeYaw),sy=Math.sin(frame.gazeYaw),cp=Math.cos(frame.gazePitch),sp=Math.sin(frame.gazePitch);uniforms.eyeDirection.value.set(sy,sp,cy*cp);uniforms.eyeGX.value.set(cy,0,-sy);uniforms.eyeGY.value.crossVectors(uniforms.eyeDirection.value,uniforms.eyeGX.value).normalize();uniforms.eyeRadius.value=frame.parameters.globeRadiusM;uniforms.eyePupil.value=frame.pupil;}};
 });
}
