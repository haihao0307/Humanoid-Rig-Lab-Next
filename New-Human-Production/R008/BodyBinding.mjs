import * as THREE from 'three';
import {BODY_DEFAULT,normalizeBody,bodyPoint,bodyNormalMatrix,bodyMetrics,bodyAge,bodyYouth} from './BodyParameters.mjs';
const AGE_GLSL=`
uniform float bodyAgeAmount;uniform float bodyYouthAmount;uniform float bodySoftening;
float ageSupport(vec3 p,vec3 c,vec3 r){float q=dot((p-c)/r,(p-c)/r);return q<1.?pow(1.-q,3.):0.;}
float ageWrinkleHeight(vec3 p){
 float front=smoothstep(.06,.10,p.z),forehead=ageSupport(p,vec3(0,1.691,.105),vec3(.075,.024,.058));
 float lines=pow(.5+.5*cos((p.y-1.689)*740.),10.);
 vec3 q=vec3(abs(p.x),p.y,p.z);float orbital=ageSupport(q,vec3(.060,1.651,.095),vec3(.024,.016,.045));
 float crow=pow(.5+.5*cos((q.y-1.652+(q.x-.058)*.30)*1300.),12.);
 return -bodyAgeAmount*front*(.00010*forehead*lines+.000065*orbital*crow);
}
vec3 ageSurfaceNormal(vec3 n,vec3 rest){if(bodyAgeAmount<=0.)return n;float h=ageWrinkleHeight(rest),pixel=length(fwidth(rest));h*=1.-smoothstep(.0003,.0012,pixel);vec3 x=dFdx(-vViewPosition),y=dFdy(-vViewPosition),r1=cross(y,n),r2=cross(n,x);float d=dot(x,r1);return abs(d)<1e-12?n:normalize(abs(d)*n-sign(d)*(dFdx(h)*r1+dFdy(h)*r2));}
`;
export function createBodyBinding({mesh,eyes}){
 const p=mesh.geometry.attributes.skinRest.array,n=mesh.geometry.attributes.normal.array,count=p.length/3,offset=new Float32Array(p.length),matrices=Array.from({length:3},()=>new Float32Array(p.length));
 for(let i=0;i<count;i++)for(let k=0;k<3;k++)matrices[k][i*3+k]=1;
 mesh.geometry.setAttribute('bodyOffset',new THREE.BufferAttribute(offset,3));for(let k=0;k<3;k++)mesh.geometry.setAttribute('bodyN'+k,new THREE.BufferAttribute(matrices[k],3));
 const uniforms={bodyAgeAmount:{value:0},bodyYouthAmount:{value:0},bodySoftening:{value:0}};let recipe=normalizeBody(),lastKey='',report={...bodyMetrics(recipe),cacheBytes:offset.byteLength+matrices.reduce((s,a)=>s+a.byteLength,0),minimumJacobian:1,maximumOffsetMetres:0};
 const excluded=new Set(['tripo_part_1','tripo_part_2','tripo_part_9']);
 function attach(material,geometry=false){const before=material.onBeforeCompile,key=material.customProgramCacheKey();material.onBeforeCompile=shader=>{before(shader);if(geometry){shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 bodyOffset;attribute vec3 bodyN0;attribute vec3 bodyN1;attribute vec3 bodyN2;').replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed+=bodyOffset;').replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nobjectNormal=normalize(mat3(bodyN0,bodyN1,bodyN2)*objectNormal);');}
  if(!excluded.has(material.name)){Object.assign(shader.uniforms,uniforms);shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+AGE_GLSL).replace('#include <lights_physical_fragment>','normal=normalize(mix(normal,nonPerturbedNormal,skinCoverage*(bodySoftening*(1.-smoothstep(1.48,1.57,vSkinRest.y))+.16*bodyYouthAmount)));\nnormal=ageSurfaceNormal(normal,vSkinRest);\n#include <lights_physical_fragment>');
   const head=material.name==='tripo_part_3'||material.userData.lidSurface;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+(head?'float ageMask=skinMask(diffuseColor.rgb);float ageSpot=ageSupport(vSkinRest,vec3(.045,1.636,.10),vec3(.13,.06,.08))*(.5+.5*sin(vSkinRest.x*530.)*sin(vSkinRest.y*690.));diffuseColor.rgb*=1.-bodyAgeAmount*ageMask*ageSpot*.09;float ageHair=(1.-smoothstep(.06,.16,dot(diffuseColor.rgb,vec3(.2126,.7152,.0722))))*smoothstep(1.67,1.708,vSkinRest.y)*skinEnabled;diffuseColor.rgb=mix(diffuseColor.rgb,vec3(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722))*1.6+.015),bodyAgeAmount*.72*ageHair);':'') );const hook=material.userData.lidSurface?'// lid surface ready':'#include <roughnessmap_fragment>';shader.fragmentShader=shader.fragmentShader.replace(hook,hook+'\nroughnessFactor=clamp(roughnessFactor+(bodyAgeAmount*.085-bodyYouthAmount*.035)*skinMask(diffuseColor.rgb),0.,1.);');}
 };material.customProgramCacheKey=()=>key+'|r008-body-v1|'+Number(geometry);material.needsUpdate=true;}
 for(const m of mesh.material)attach(m,true);for(const e of eyes.eyes)for(const {lid}of e.lids)attach(lid.material,false);
 const skinTransform=mesh.applyBoneTransform.bind(mesh);mesh.applyBoneTransform=(index,target)=>skinTransform(index,target.add(new THREE.Vector3().fromArray(offset,index*3)));
 return {set(input){const next=normalizeBody(input),key=[next.fatness,next.muscle,next.age].join(':');if(key!==lastKey){const identity=next.fatness===0&&next.muscle===0&&next.age===32;let minimum=1,maximum=0;for(let i=0;i<count;i++){const point=[p[i*3],p[i*3+1],p[i*3+2]],q=identity?point:bodyPoint(point,next);for(let k=0;k<3;k++)offset[i*3+k]=q[k]-point[k];maximum=Math.max(maximum,Math.hypot(offset[i*3],offset[i*3+1],offset[i*3+2]));const {cofactor:C,determinant:d}=identity?{cofactor:[1,0,0,0,1,0,0,0,1],determinant:1}:bodyNormalMatrix(point,next);minimum=Math.min(minimum,d);for(let k=0;k<3;k++)for(let j=0;j<3;j++)matrices[k][i*3+j]=C[j*3+k];}if(minimum<.35)throw Error('体型局部形变超出安全范围');for(const name of ['bodyOffset','bodyN0','bodyN1','bodyN2'])mesh.geometry.attributes[name].needsUpdate=true;lastKey=key;report.minimumJacobian=minimum;report.maximumOffsetMetres=maximum;}
  uniforms.bodyAgeAmount.value=bodyAge(next);uniforms.bodyYouthAmount.value=bodyYouth(next);uniforms.bodySoftening.value=Math.max(0,next.fatness)*.30+Math.max(0,-next.muscle)*.25;recipe=next;Object.assign(report,bodyMetrics(next));return {...recipe};},export:()=>({...recipe}),get report(){return {...report};}};
}
