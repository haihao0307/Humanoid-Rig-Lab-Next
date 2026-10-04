import * as THREE from 'three';
import {normalizeBody,bodyNormalMatrix,bodyMetrics,bodyAge,bodyYouth} from './BodyParameters.mjs';
import {createTissueFields} from './BodyTissue.mjs';
import {compactAnatomy} from './AnatomyAnalysis.mjs';
import {createAdiposeLayer} from './AdiposeLayer.mjs';
import {solveComposition,compositionPoint,decodeCompositionControl,COMPOSITION_GLSL} from './BodyComposition.mjs';
import {r008CompositionCalibration} from './R008CompositionCalibration.mjs';
import {createHumanBodySystem} from './HumanBodySystem.mjs';
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
export function createBodyBinding({mesh,eyes,surface,calibration:providedCalibration}){
 const p=mesh.geometry.attributes.skinRest.array,count=p.length/3;
 const ids=new Uint16Array(count*8),weights=new Float32Array(count*8),materialIds=new Uint8Array(count),index=mesh.geometry.index.array;
 for(const g of mesh.geometry.groups)for(let i=g.start;i<g.start+g.count;i++)materialIds[index[i]]=g.materialIndex;
 for(let i=0;i<count;i++)for(let j=0;j<8;j++){ids[i*8+j]=mesh.geometry.attributes[j<4?'skinIndex':'skinIndex2'].array[i*4+j%4];weights[i*8+j]=mesh.geometry.attributes[j<4?'skinWeight':'skinWeight2'].array[i*4+j%4];}
 const joints=mesh.skeleton.bones.map((b,i)=>{const e=mesh.skeleton.boneInverses[i].clone().invert().elements;return {name:b.name,parent:b.parent?.isBone?b.parent.name:null,position:[e[12],e[13],e[14]]};});
 const system=createHumanBodySystem({joints,positions:p,skinIndex:ids,skinWeight:weights,sourceId:providedCalibration?.sourceId||'new-human-r008',unit:'metres',seamGroups:surface.seamGroups,materialIds},providedCalibration||(a=>r008CompositionCalibration(a,mesh.material)));
 const {anatomy,profile,fields}=system,calibration=profile.calibration;
 const tissue=createTissueFields({position:p,skinIndex:ids,skinWeight:weights,bones:mesh.skeleton.bones,inverses:mesh.skeleton.boneInverses,analysis:anatomy});
 const adipose=createAdiposeLayer(mesh,tissue,anatomy,surface.seamGroups,calibration);
 mesh.geometry.setAttribute('bodyRegion',new THREE.BufferAttribute(fields.region,4));mesh.geometry.setAttribute('bodyAnchor',new THREE.BufferAttribute(fields.anchor,4));
 const uniforms={bodyCompartments:{value:Array.from({length:32},()=>new THREE.Vector4())},bodyAgeAmount:{value:0},bodyYouthAmount:{value:0},bodySoftening:{value:0}};
 let recipe=normalizeBody(),solution=solveComposition(profile,recipe),reportKey='',metrics=bodyMetrics(recipe),report={cacheBytes:0,minimumJacobian:1,maximumOffsetMetres:0,jacobianSamples:0,geometryEvaluation:'calibrated-muscle-sat-annulus-gpu-uniforms'};
 const excluded=new Set((calibration.appearanceExcludedMaterials||calibration.protectedMaterials).map(i=>mesh.material[i].name));
 function attach(material,geometry=false){const before=material.onBeforeCompile,key=material.customProgramCacheKey();material.onBeforeCompile=shader=>{
  before(shader);Object.assign(shader.uniforms,uniforms);
  if(geometry){
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec4 bodyRegion; attribute vec4 bodyAnchor;\n'+(shader.vertexShader.includes('attribute vec3 skinRest')?'':'attribute vec3 skinRest;\n')+COMPOSITION_GLSL+'\nattribute vec4 adiposeDelta; attribute vec3 adiposeNormal; attribute float adiposeTone; varying float vAdiposeMask; varying float vAdiposeTone; varying float vBodyRelief;');
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    vBodyRelief=compositionControl(bodyAnchor.w).z;vAdiposeMask=adiposeDelta.w;vAdiposeTone=adiposeTone;
    vec3 bodyFatRest=skinRest+adiposeDelta.xyz*adiposeDelta.w*vBodyRelief;
    transformed+=bodyPointGPU(bodyFatRest,bodyRegion,bodyAnchor)-skinRest;`);
   shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
    vec4 bodyControl=compositionControl(bodyAnchor.w);
    objectNormal=normalize(mix(objectNormal,adiposeNormal,bodyControl.z*adiposeDelta.w));
    float bodyH=.00035;
    vec3 bodyX=(bodyPointGPU(skinRest+vec3(bodyH,0,0),bodyRegion,bodyAnchor)-bodyPointGPU(skinRest-vec3(bodyH,0,0),bodyRegion,bodyAnchor))/(2.*bodyH);
    vec3 bodyY=(bodyPointGPU(skinRest+vec3(0,bodyH,0),bodyRegion,bodyAnchor)-bodyPointGPU(skinRest-vec3(0,bodyH,0),bodyRegion,bodyAnchor))/(2.*bodyH);
    vec3 bodyZ=(bodyPointGPU(skinRest+vec3(0,0,bodyH),bodyRegion,bodyAnchor)-bodyPointGPU(skinRest-vec3(0,0,bodyH),bodyRegion,bodyAnchor))/(2.*bodyH);
    objectNormal=normalize(mat3(cross(bodyY,bodyZ),cross(bodyZ,bodyX),cross(bodyX,bodyY))*objectNormal);`);
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vAdiposeMask; varying float vAdiposeTone; varying float vBodyRelief;').replace('#include <color_fragment>',`#include <color_fragment>
    #ifdef USE_MAP
    float fatLum=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));float fatTarget=max(.005,fatLum+vAdiposeTone);
    diffuseColor.rgb*=mix(1.,clamp(fatTarget/max(.005,fatLum),.55,1.8),vBodyRelief*vAdiposeMask);
    #endif`);
  }
  if(!excluded.has(material.name)){
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+AGE_GLSL).replace('normal=skinFineNormal(normal,skinCoverage);','normal=normalize(mix(normal,nonPerturbedNormal,skinCoverage*('+(geometry?'vBodyRelief*vAdiposeMask':'0.')+'+.16*bodyYouthAmount)));\nnormal=ageSurfaceNormal(normal,vSkinRest);\nnormal=skinFineNormal(normal,skinCoverage);');
   const head=material.name==='tripo_part_3'||material.userData.lidSurface;
   if(head)shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat ageMask=skinMask(diffuseColor.rgb);float ageSpot=ageSupport(vSkinRest,vec3(.045,1.636,.10),vec3(.13,.06,.08))*(.5+.5*sin(vSkinRest.x*530.)*sin(vSkinRest.y*690.));diffuseColor.rgb*=1.-bodyAgeAmount*ageMask*ageSpot*.09;float ageHair=(1.-smoothstep(.06,.16,dot(diffuseColor.rgb,vec3(.2126,.7152,.0722))))*smoothstep(1.67,1.708,vSkinRest.y)*skinEnabled;diffuseColor.rgb=mix(diffuseColor.rgb,vec3(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722))*1.6+.015),bodyAgeAmount*.72*ageHair);');
   const hook=material.userData.lidSurface?'// lid surface ready':'#include <roughnessmap_fragment>';shader.fragmentShader=shader.fragmentShader.replace(hook,hook+'\nroughnessFactor=clamp(roughnessFactor+(bodyAgeAmount*.085-bodyYouthAmount*.035)*skinMask(diffuseColor.rgb),0.,1.);');
  }
 };material.customProgramCacheKey=()=>key+'|r008-human-species-composition-v5|'+Number(geometry);material.needsUpdate=true;}
 for(const m of mesh.material)attach(m,true);for(const e of eyes.eyes)for(const {lid}of e.lids)attach(lid.material,false);
 const context=i=>({...fields.context(i),controls:solution.controls});
 function point(i){const c=context(i),blend=decodeCompositionControl(c.anchor[3],solution.controls)[2];return compositionPoint(adipose.point(i,blend),c,solution.controls);}
 const skinTransform=mesh.applyBoneTransform.bind(mesh);mesh.applyBoneTransform=(i,target)=>{const q=point(i);target.x+=q[0]-p[i*3];target.y+=q[1]-p[i*3+1];target.z+=q[2]-p[i*3+2];return skinTransform(i,target);};
 function set(input){const next=normalizeBody(input);system.set(next);solution=system.solution;recipe=next;reportKey='';for(let i=0;i<32;i++)uniforms.bodyCompartments.value[i].fromArray(solution.controls,i*4);uniforms.bodyAgeAmount.value=bodyAge(next);uniforms.bodyYouthAmount.value=bodyYouth(next);
  metrics=bodyMetrics(next);const trunk=solution.areas.filter(a=>/^(thorax|abdomen)$/.test(a.id));metrics.radius=Math.max(.20,Math.min(.46,.25*Math.sqrt(Math.max(...trunk.map(a=>.65+.25*a.muscleRatio+.10*a.fatRatio)))))*metrics.scale;metrics.armClearance=.08*Math.max(0,Math.sqrt(Math.max(...trunk.map(a=>a.fatRatio)))-1);
  Object.assign(report,metrics,{composition:solution,anatomy:compactAnatomy(anatomy),adipose:{...adipose.report,blend:Math.max(...solution.areas.map(a=>a.reliefBlend)),muscleTransmission:Math.min(...solution.areas.map(a=>a.muscleTransmission))},tissueRuntimeBytes:fields.bytes,tissueCoverage:fields.coverage,storedTissueBytes:0});return {...recipe};
 }
 set(recipe);
 return {tissue,anatomy,adipose,composition:{profile,fields,context,point,get solution(){return solution;}},set,export:()=>({...recipe}),dispose:()=>adipose.dispose(),get metrics(){return {...metrics};},get report(){
  const key=JSON.stringify(recipe);if(key!==reportKey){let minimum=1,maximum=0,samples=0;const stride=Math.max(1,Math.floor(count/512));for(let i=0;i<count;i+=stride){const rest=Array.from(p.subarray(i*3,i*3+3)),q=point(i);minimum=Math.min(minimum,bodyNormalMatrix(rest,recipe,anatomy.frame.height*.0002,context(i)).determinant);maximum=Math.max(maximum,Math.hypot(...q.map((v,k)=>v-rest[k])));samples++;}Object.assign(report,{minimumJacobian:minimum,maximumOffsetMetres:maximum,jacobianSamples:samples});reportKey=key;}return {...report};
 }};
}
