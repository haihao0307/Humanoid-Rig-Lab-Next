import * as THREE from 'three';
import {resolveSkinChannels} from './SkinAppearance.mjs';
// Functions use this character's rest-space metres. No old R2 landmarks copied.
const FUNCTIONS=`
uniform vec3 skinGain;
uniform vec4 skinPigment;
uniform vec4 skinSurface;
uniform float skinEnabled;
varying vec3 vSkinRest;
float skinRegion(vec3 p,vec3 c,vec3 radii){return 1.-smoothstep(.1,1.,dot((p-c)/radii,(p-c)/radii));}
float skinSun(vec3 p){
 // Shirtless, barefoot survivor: exposed torso/arms/legs share the history.
 // The shorts are excluded by material ownership. Palms/soles change less.
 float palm=(1.-smoothstep(.86,.92,p.y))*smoothstep(.25,.29,abs(p.x))*smoothstep(.0,.05,p.z);
 float sole=1.-smoothstep(.008,.022,p.y);
 float axilla=skinRegion(vec3(abs(p.x),p.y,p.z),vec3(.18,1.32,-.055),vec3(.065,.12,.10));
 return clamp(1.-.60*palm-.72*sole-.22*axilla,.15,1.);
}
float skinMask(vec3 base){
 if(skinEnabled<.5)return 0.;
 if(skinSurface.w<.5)return 1.;
 // Original head map includes hair and eyebrows; never recolour them as skin.
 float pigmentGate=smoothstep(.055,.135,max(base.r,max(base.g,base.b)));
 float scalp=1.-smoothstep(1.711,1.737,vSkinRest.y);
 float lip=skinRegion(vSkinRest,vec3(0.,1.586,.126),vec3(.027,.009,.035));
 return pigmentGate*scalp*(1.-.40*lip);
}
vec3 skinColour(vec3 base,float mask){
 float variation=(sin(vSkinRest.x*21.+vSkinRest.y*13.)*sin(vSkinRest.z*19.-vSkinRest.y*17.))*.5;
 float cheek=skinRegion(vec3(abs(vSkinRest.x),vSkinRest.y,vSkinRest.z),vec3(.045,1.632,.103),vec3(.030,.030,.055));
 vec3 gain=skinGain*(vec3(1.)+skinPigment.x*vec3(.055,.012,-.075));
 gain*=exp(-skinPigment.w*skinSun(vSkinRest)*vec3(.85,1.06,1.25));
 gain*=vec3(1.)+skinPigment.y*(.20+.80*cheek)*vec3(.14,-.07,-.09);
 gain*=1.+skinPigment.z*.10*variation;
 return mix(base,clamp(base*gain,vec3(0.),vec3(1.)),mask);
}`;
export function createSkinMaterialBinding({mesh,eyes}){
 const uniforms={skinGain:{value:new THREE.Vector3(1,1,1)},skinPigment:{value:new THREE.Vector4()},skinEnabled:{value:1}},bound=[];
 mesh.geometry.setAttribute('skinRest',new THREE.BufferAttribute(mesh.geometry.attributes.position.array.slice(),3));
 function attach(material,head=false){
  const previous=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material),surface={value:new THREE.Vector4(0,0,0,head?1:0)};
  material.onBeforeCompile=shader=>{
   previous(shader);Object.assign(shader.uniforms,uniforms,{skinSurface:surface});
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 skinRest; varying vec3 vSkinRest;').replace('#include <begin_vertex>','#include <begin_vertex>\nvSkinRest=skinRest;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+FUNCTIONS).replace('#include <color_fragment>','#include <color_fragment>\nfloat skinCoverage=skinMask(diffuseColor.rgb);\ndiffuseColor.rgb=skinColour(diffuseColor.rgb,skinCoverage);').replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+skinCoverage*(skinSurface.x-.18*skinSurface.y+.11*skinSurface.z*skinSun(vSkinRest)),0.,1.);');
  };
  const previousKey=key();material.customProgramCacheKey=()=>previousKey+'|r008-skin-v1|'+Number(head);material.needsUpdate=true;bound.push({material,surface});
 }
 // Verified by a material-only runtime view: left/right shorts + waistband/cord.
 const excluded=new Set(['tripo_part_1','tripo_part_2','tripo_part_9']);
 for(const material of mesh.material)if(!excluded.has(material.name))attach(material,material.name==='tripo_part_3');
 for(const e of eyes.eyes)for(const {lid} of e.lids){const p=lid.geometry.attributes.position.array.slice();for(let i=0;i<p.length;i+=3){p[i]+=e.cx;p[i+1]+=1.656;p[i+2]+=e.cz;}lid.geometry.setAttribute('skinRest',new THREE.BufferAttribute(p,3));attach(lid.material,true);}
 const api={setInspection(on){uniforms.skinEnabled.value=on?0:1;},set(input){const c=resolveSkinChannels(input);uniforms.skinGain.value.fromArray(c.gain);uniforms.skinPigment.value.set(c.tone,c.redness,c.variation,c.tan);for(const b of bound){b.surface.value.x=c.roughness;b.surface.value.y=c.oil;b.surface.value.z=c.weathering;}return c;},report:{boundMaterials:bound.length,excludedMaterials:[...excluded],persistedFields:0,storedTextures:0,restCacheBytes:mesh.geometry.attributes.skinRest.array.byteLength}};
 api.set({});return api;
}
