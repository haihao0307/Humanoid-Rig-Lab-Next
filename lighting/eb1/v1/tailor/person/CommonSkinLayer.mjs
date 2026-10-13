import * as THREE from 'three';
import {buildSkinRegions} from './SkinRegions.mjs';
/** Basic feature painting and surface material on the current common person.
 * This is a new material-only module, never the old skin-r02 geometry bundle.
 * All detail is original procedural code. No scan/Unity/TEN24 assets. */
export const COMMON_SKIN_VERSION='common-skin-foundation/r1';
export const SKIN_DEFAULTS=Object.freeze({enabled:true,tone:.64,warmth:.5,lipColor:'#985955',lipMix:.60,detail:.72,roughness:.62,oil:.18,variation:.4,redness:.34,layer:'beauty'});
const ranges={tone:[0,1],warmth:[0,1],lipMix:[0,1],detail:[0,1.5],roughness:[.3,.9],oil:[0,1],variation:[0,1],redness:[0,1]};
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const decl=`
uniform vec3 csTone,csLipColor;uniform float csLipMix,csDetail,csRoughness,csOil,csVariation,csRedness,csAge,csLayer,csBand;
varying vec3 vCSRest;varying vec4 vCSRegion,vCSExtra;varying float vCSType;
float csHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float csNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(csHash(i),csHash(i+vec3(1,0,0)),f.x),mix(csHash(i+vec3(0,1,0)),csHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(csHash(i+vec3(0,0,1)),csHash(i+vec3(1,0,1)),f.x),mix(csHash(i+vec3(0,1,1)),csHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
`;
function makeMaterial(U){
 const mat=new THREE.MeshPhysicalMaterial({vertexColors:true,roughness:.62,metalness:0,ior:1.42,specularIntensity:.52,clearcoat:.06,clearcoatRoughness:.4,side:THREE.FrontSide});
 mat.customProgramCacheKey=()=>COMMON_SKIN_VERSION;
 mat.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,U);
  shader.vertexShader='attribute vec3 csRest;attribute vec4 csRegion,csExtra;attribute float csType;varying vec3 vCSRest;varying vec4 vCSRegion,vCSExtra;varying float vCSType;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCSRest=csRest;vCSRegion=csRegion;vCSExtra=csExtra;vCSType=csType;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+decl);
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float csCover=clamp(vCSRegion.x,0.,1.),csLip=clamp(vCSRegion.y,0.,1.),csT=clamp(vCSRegion.z,0.,1.),csCheek=clamp(vCSRegion.w,0.,1.);
   float csThin=clamp(vCSExtra.x,0.,1.),csDry=clamp(vCSExtra.y,0.,1.),csPalm=clamp(vCSExtra.z,0.,1.);
   float csMacro=(csNoise(vCSRest*73.7)-.5)*.6+(csNoise(vCSRest*263.1)-.5)*.4;
   vec3 csBase=csTone*(1.+csMacro*csVariation*.11);
   csBase*=vec3(1.+csCheek*csRedness*.12,1.-csCheek*csRedness*.13,1.-csCheek*csRedness*.09);
   csBase=mix(csBase,csBase*vec3(.94,.92,.95),csThin*.27);
   csBase=mix(csBase,min(csBase*1.17+vec3(.014,.009,.005),vec3(.9)),csPalm*.55);
   csBase=mix(csBase,csLipColor*(1.+csMacro*.06),csLip*csLipMix);
   vec3 csOther=vec3(.33,.12,.105);
   if(vCSType>.5&&vCSType<1.5)csOther=vec3(.74,.69,.58);
   if(vCSType>3.5&&vCSType<4.5)csOther=vec3(.69,.72,.70);
   if(vCSType>4.5&&vCSType<5.5)csOther=vec3(.070,.047,.025);
   if(vCSType>5.5)csOther=vec3(.005,.006,.008);
   vec3 csPaint=mix(csOther,csBase,csCover);
   // Preserve the existing orange neck-band diagnostic without editing colors.
   float csBandVertex=csBand*step(.85,vColor.r)*step(vColor.g,.4);
   diffuseColor.rgb=mix(csPaint,diffuseColor.rgb,csBandVertex);
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   float csSurfaceRough=clamp(csRoughness-csT*.13-csLip*.16+csDry*.09+csPalm*.035+csMacro*.035*csVariation,.27,.9);
   roughnessFactor=mix(vCSType>3.5?.25:.46,csSurfaceRough,csCover);
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   // Smooth rest-space value noise provides a stable sub-mm height field.
   // Lip grooves replace pores locally; eye/teeth coverage is exactly zero.
   float csPores=csNoise(vCSRest*1650.)-.5,csFine=csNoise(vCSRest*4900.+vec3(11.7))-.5;
   float csMeso=csNoise(vCSRest*370.+vec3(4.3))-.5;
   float csGrooves=sin(vCSRest.x*12300.+csNoise(vCSRest*310.)*3.)*.5;
   float csSurface=(csPores*.000015+csFine*.0000025+csMeso*.000020)*(1.+csT*.5+csDry*.45-csThin*.55)*(0.7+csAge*.45);
   csSurface=mix(csSurface,csGrooves*.0000045+csMeso*.000007,csLip);
   float csHeight=csSurface*csDetail*csCover;
   vec3 csDx=dFdx(-vViewPosition),csDy=dFdy(-vViewPosition),csR1=cross(csDy,normal),csR2=cross(normal,csDx);float csDet=dot(csDx,csR1);
   if(abs(csDet)>1e-14)normal=normalize(abs(csDet)*normal-sign(csDet)*(dFdx(csHeight)*csR1+dFdy(csHeight)*csR2));
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <clearcoat_normal_fragment_maps>','#include <clearcoat_normal_fragment_maps>\n#ifdef USE_CLEARCOAT\nclearcoatNormal=normal;\n#endif');
  shader.fragmentShader=shader.fragmentShader.replace('#include <lights_physical_fragment>',`#include <lights_physical_fragment>
   #ifdef USE_CLEARCOAT
   material.clearcoat=csCover*clamp(csOil*(.25+csT*.65)+csLip*.13,0.,.55);material.clearcoatRoughness=.4-csT*.08-csLip*.1;
   #endif
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`#include <opaque_fragment>
   if(csLayer>.5&&csLayer<1.5)gl_FragColor.rgb=csPaint;
   if(csLayer>1.5&&csLayer<2.5)gl_FragColor.rgb=vec3(roughnessFactor);
   if(csLayer>2.5&&csLayer<3.5)gl_FragColor.rgb=vec3(csLip,csT,csCheek)*csCover;
  `);
 };
 return mat;
}
export class CommonSkinLayer{
 constructor(viewer,settings={}){
  if(!viewer?.model||!viewer.geometry||!viewer.mesh)throw Error('共同人物尚未就绪');
  this.viewer=viewer;this.originalMaterial=viewer.material;this.disposed=false;this.settings={...SKIN_DEFAULTS};this.fields=viewer.model.precomputedSkinRegions||buildSkinRegions(viewer.model);this.positionReference=viewer.model.positions;this.indexReference=viewer.model.faces;
  const f=this.fields;for(const[name,array,size]of[['csRest',f.rest,3],['csRegion',f.regions,4],['csExtra',f.extra,4],['csType',f.types,1]])viewer.geometry.setAttribute(name,new THREE.BufferAttribute(array,size));
  this.U={csTone:{value:new THREE.Color()},csLipColor:{value:new THREE.Color()},csLipMix:{value:0},csDetail:{value:0},csRoughness:{value:0},csOil:{value:0},csVariation:{value:0},csRedness:{value:0},csAge:{value:.5},csLayer:{value:0},csBand:{value:0}};
  this.material=makeMaterial(this.U);this.set(settings);
 }
 set(values={}){
  if(this.disposed)return this.settings;
  for(const[k,v]of Object.entries(values)){if(k==='enabled')this.settings.enabled=!!v;else if(k==='lipColor'&&/^#[a-f0-9]{6}$/i.test(v))this.settings.lipColor=v;else if(k==='layer'&&['beauty','color','roughness','regions'].includes(v))this.settings.layer=v;else if(ranges[k]&&Number.isFinite(v))this.settings[k]=clamp(v,...ranges[k]);}
  const s=this.settings,U=this.U;
  // Artistic complexion control, deliberately independent of ancestry/gender.
  const dark=new THREE.Color('#573827'),light=new THREE.Color('#d9b398');U.csTone.value.copy(dark).lerp(light,s.tone);U.csTone.value.r*=1+(s.warmth-.5)*.09;U.csTone.value.b*=1-(s.warmth-.5)*.14;
  U.csLipColor.value.set(s.lipColor);for(const[k,name]of Object.entries({lipMix:'csLipMix',detail:'csDetail',roughness:'csRoughness',oil:'csOil',variation:'csVariation',redness:'csRedness'}))U[name].value=s[k];U.csLayer.value=['beauty','color','roughness','regions'].indexOf(s.layer);
  this.update();this.viewer.render();return {...s};
 }
 update(){if(this.disposed)return;const v=this.viewer;if(v.model.positions!==this.positionReference||v.model.faces!==this.indexReference)throw Error('皮肤字段不允许更换共同拓扑');this.U.csAge.value=clamp((v.model.state?.anny?.phenotypes?.age??2/3)+1/3);this.U.csBand.value=v.band?1:0;this.material.wireframe=!!v.wire;this.originalMaterial.wireframe=!!v.wire;v.material=this.settings.enabled?this.material:this.originalMaterial;v.mesh.material=v.material;}
 report(){return {version:COMMON_SKIN_VERSION,ready:!this.disposed,enabled:this.settings.enabled,settings:{...this.settings},...this.fields.report,geometryUnchanged:this.viewer.model.positions===this.positionReference&&this.viewer.model.faces===this.indexReference,assets:'original procedural color/microheight; existing native semantic data; zero new image assets',scanAssetsLoaded:false,transmissionEnabled:false,sss:'not enabled in this basic foundation',anatomicalWrinkles:'not claimed; age only modulates microtexture strength'};}
 dispose(){if(this.disposed)return;this.disposed=true;const v=this.viewer;v.material=this.originalMaterial;if(v.mesh)v.mesh.material=this.originalMaterial;for(const key of['csRest','csRegion','csExtra','csType'])v.geometry?.deleteAttribute(key);this.material.dispose();}
}
