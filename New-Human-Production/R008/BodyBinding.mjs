import * as THREE from 'three';
import {normalizeBody,bodyPoint,bodyNormalMatrix,bodyMetrics,bodyAge,bodyYouth,bodyCoefficients,BODY_FIELD_GLSL} from './BodyParameters.mjs';
import {createTissueFields} from './BodyTissue.mjs';
import {analyzeHumanoid,compactAnatomy}from './AnatomyAnalysis.mjs';
import {adiposeControls,enforceAnatomy}from './AnatomyContract.mjs';
import {createAdiposeLayer}from './AdiposeLayer.mjs';
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
export function createBodyBinding({mesh,eyes,surface}){
 const p=mesh.geometry.attributes.skinRest.array,count=p.length/3;
 const ids=new Uint16Array(count*8),weights=new Float32Array(count*8);for(let i=0;i<count;i++)for(let j=0;j<8;j++){ids[i*8+j]=mesh.geometry.attributes[j<4?'skinIndex':'skinIndex2'].array[i*4+j%4];weights[i*8+j]=mesh.geometry.attributes[j<4?'skinWeight':'skinWeight2'].array[i*4+j%4];}
 const joints=mesh.skeleton.bones.map((b,i)=>{const e=mesh.skeleton.boneInverses[i].clone().invert().elements;return {name:b.name,parent:b.parent?.isBone?b.parent.name:null,position:[e[12],e[13],e[14]]};});
 const anatomy=analyzeHumanoid({joints,positions:p,skinIndex:ids,skinWeight:weights,sourceId:'new-human-r008',unit:'metres'});enforceAnatomy(anatomy);
 const tissue=createTissueFields({position:p,skinIndex:ids,skinWeight:weights,bones:mesh.skeleton.bones,inverses:mesh.skeleton.boneInverses,analysis:anatomy}),adipose=createAdiposeLayer(mesh,tissue,anatomy,surface.seamGroups);
 mesh.geometry.setAttribute('bodyRegion',new THREE.BufferAttribute(tissue.region,4));mesh.geometry.setAttribute('bodyAnchor',new THREE.BufferAttribute(tissue.anchor,3));
 const uniforms={bodyFatBlend:{value:0},bodyShapeControls:{value:new THREE.Vector4()},bodyAgeAmount:{value:0},bodyYouthAmount:{value:0},bodySoftening:{value:0}};let recipe=normalizeBody(),reportKey='',report={...bodyMetrics(recipe),cacheBytes:0,minimumJacobian:1,maximumOffsetMetres:0,jacobianSamples:0,geometryEvaluation:'shared-function-gpu-uniforms'};
 const excluded=new Set(['tripo_part_1','tripo_part_2','tripo_part_9']);
 function attach(material,geometry=false){const before=material.onBeforeCompile,key=material.customProgramCacheKey();material.onBeforeCompile=shader=>{before(shader);if(geometry){shader.uniforms.bodyShapeControls=uniforms.bodyShapeControls;shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform vec4 bodyShapeControls;\nattribute vec4 bodyRegion; attribute vec3 bodyAnchor;\n'+(shader.vertexShader.includes('attribute vec3 skinRest')?'':'attribute vec3 skinRest;\n')+BODY_FIELD_GLSL).replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed+=bodyPointGPU(skinRest,bodyShapeControls,bodyRegion,bodyAnchor)-skinRest;').replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
if(dot(bodyShapeControls,bodyShapeControls)>0.){
 float bodyH=.00035;
 vec3 bodyX=(bodyPointGPU(skinRest+vec3(bodyH,0,0),bodyShapeControls,bodyRegion,bodyAnchor)-bodyPointGPU(skinRest-vec3(bodyH,0,0),bodyShapeControls,bodyRegion,bodyAnchor))/(2.*bodyH);
 vec3 bodyY=(bodyPointGPU(skinRest+vec3(0,bodyH,0),bodyShapeControls,bodyRegion,bodyAnchor)-bodyPointGPU(skinRest-vec3(0,bodyH,0),bodyShapeControls,bodyRegion,bodyAnchor))/(2.*bodyH);
 vec3 bodyZ=(bodyPointGPU(skinRest+vec3(0,0,bodyH),bodyShapeControls,bodyRegion,bodyAnchor)-bodyPointGPU(skinRest-vec3(0,0,bodyH),bodyShapeControls,bodyRegion,bodyAnchor))/(2.*bodyH);
 objectNormal=normalize(mat3(cross(bodyY,bodyZ),cross(bodyZ,bodyX),cross(bodyX,bodyY))*objectNormal);
}`);}
  if(!excluded.has(material.name)){Object.assign(shader.uniforms,uniforms);shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+AGE_GLSL).replace('normal=skinFineNormal(normal,skinCoverage);','normal=normalize(mix(normal,nonPerturbedNormal,skinCoverage*(bodySoftening*'+(geometry?'vAdiposeMask':'0.')+'+.16*bodyYouthAmount)));\nnormal=ageSurfaceNormal(normal,vSkinRest);\nnormal=skinFineNormal(normal,skinCoverage);');
   const head=material.name==='tripo_part_3'||material.userData.lidSurface;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+(head?'float ageMask=skinMask(diffuseColor.rgb);float ageSpot=ageSupport(vSkinRest,vec3(.045,1.636,.10),vec3(.13,.06,.08))*(.5+.5*sin(vSkinRest.x*530.)*sin(vSkinRest.y*690.));diffuseColor.rgb*=1.-bodyAgeAmount*ageMask*ageSpot*.09;float ageHair=(1.-smoothstep(.06,.16,dot(diffuseColor.rgb,vec3(.2126,.7152,.0722))))*smoothstep(1.67,1.708,vSkinRest.y)*skinEnabled;diffuseColor.rgb=mix(diffuseColor.rgb,vec3(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722))*1.6+.015),bodyAgeAmount*.72*ageHair);':'') );const hook=material.userData.lidSurface?'// lid surface ready':'#include <roughnessmap_fragment>';shader.fragmentShader=shader.fragmentShader.replace(hook,hook+'\nroughnessFactor=clamp(roughnessFactor+(bodyAgeAmount*.085-bodyYouthAmount*.035)*skinMask(diffuseColor.rgb),0.,1.);');}
  if(geometry){shader.uniforms.bodyFatBlend=uniforms.bodyFatBlend;shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float bodyFatBlend; attribute vec4 adiposeDelta; attribute vec3 adiposeNormal; attribute float adiposeTone; varying float vAdiposeMask; varying float vAdiposeTone;');shader.vertexShader=shader.vertexShader.replace('transformed+=bodyPointGPU(skinRest,bodyShapeControls,bodyRegion,bodyAnchor)-skinRest;','vAdiposeMask=adiposeDelta.w;vAdiposeTone=adiposeTone;\nvec3 fatRest=skinRest+adiposeDelta.xyz*adiposeDelta.w*bodyFatBlend;\ntransformed+=bodyPointGPU(fatRest,bodyShapeControls,bodyRegion,bodyAnchor)-skinRest;');
   shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nobjectNormal=normalize(mix(objectNormal,adiposeNormal,bodyFatBlend*adiposeDelta.w));');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float bodyFatBlend; varying float vAdiposeMask; varying float vAdiposeTone;').replace('#include <color_fragment>',`#include <color_fragment>
 #ifdef USE_MAP
 float fatLum=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
 float fatTarget=max(.005,fatLum+vAdiposeTone);
 diffuseColor.rgb*=mix(1.,clamp(fatTarget/max(.005,fatLum),.55,1.8),bodyFatBlend*vAdiposeMask);
 #endif
 `);
  }
 };material.customProgramCacheKey=()=>key+'|r008-body-v4-anatomy-fat|'+Number(geometry);material.needsUpdate=true;}
 for(const m of mesh.material)attach(m,true);for(const e of eyes.eyes)for(const {lid}of e.lids)attach(lid.material,false);
 const skinTransform=mesh.applyBoneTransform.bind(mesh);mesh.applyBoneTransform=(index,target)=>{const point=[p[index*3],p[index*3+1],p[index*3+2]],q=bodyPoint(adipose.point(index,uniforms.bodyFatBlend.value),recipe,tissue.context(index));target.x+=q[0]-point[0];target.y+=q[1]-point[1];target.z+=q[2]-point[2];return skinTransform(index,target);};
 return {tissue,anatomy,adipose,dispose:()=>adipose.dispose(),set(input){const next=normalizeBody(input);enforceAnatomy(anatomy);const fat=adiposeControls(next.fatness,anatomy.frame.height);uniforms.bodyFatBlend.value=fat.blend;uniforms.bodyShapeControls.value.fromArray(bodyCoefficients(next));uniforms.bodyAgeAmount.value=bodyAge(next);uniforms.bodyYouthAmount.value=bodyYouth(next);uniforms.bodySoftening.value=Math.min(.98,fat.blend*.98+Math.max(0,-bodyCoefficients(next)[1])*.90);recipe=next;Object.assign(report,bodyMetrics(next),{anatomy:compactAnatomy(anatomy),adipose:{...adipose.report,...fat},tissueRuntimeBytes:tissue.bytes,tissueCoverage:tissue.coverage,storedTissueBytes:0});return {...recipe};},export:()=>({...recipe}),get metrics(){return bodyMetrics(recipe);},get report(){
  const key=[recipe.fatness,recipe.muscle,recipe.age].join(':');if(key!==reportKey){let minimum=1,maximum=0,samples=0;const stride=Math.max(1,Math.floor(count/512));for(let i=0;i<count;i+=stride){const point=[p[i*3],p[i*3+1],p[i*3+2]],context=tissue.context(i),q=bodyPoint(point,recipe,context);minimum=Math.min(minimum,bodyNormalMatrix(point,recipe,.00035,context).determinant);maximum=Math.max(maximum,Math.hypot(...q.map((v,k)=>v-point[k])));samples++;}report.minimumJacobian=minimum;report.maximumOffsetMetres=maximum;report.jacobianSamples=samples;reportKey=key;}
  return {...report};}};
}
