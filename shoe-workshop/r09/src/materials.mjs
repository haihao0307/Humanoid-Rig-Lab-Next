import * as T from 'three';
import {ShoeMaterials as R07,CATALOGUE} from '../../r07/src/materials.mjs';
export {CATALOGUE};
export const MATERIAL_SETS={
 chestnut:{name:'栗棕 · 蜡封切边／古铜鞋眼／成形针脚',parts:{27:['heritage','#684332',.24],28:['heritage','#714c35',.25],22:['wax','#745039',.38],23:['wax','#745039',.38],24:['nubuck','#584633',.38],25:['nubuck','#584633',.38],21:['heritage','#553927',.3],20:['heritage','#553927',.3]}},
 espresso:{name:'深咖 · 哑光牛巴／细粒拼接',parts:{27:['heritage','#342b27',.3],28:['nubuck','#544438',.45],22:['heritage','#483a31',.35],23:['heritage','#483a31',.35],24:['wax','#302a25',.3],25:['wax','#302a25',.3],21:['heritage','#302824',.25],20:['heritage','#302824',.25]}},
 uniform:{name:'统一皮料对照',parts:{}}
};
export function recipeFor(part,state){const spec=MATERIAL_SETS[state.materialSet||'chestnut'].parts[part.id],id=state.partLeather?.[part.id]||(state.materialSet==='uniform'||!spec?state.leatherId:spec[0]);return{id,color:state.partLeather?.[part.id]?null:spec?.[1],normalStrength:spec?.[2]??.45};}
/** Original R10 kernels and scans selected per material region, not independently
 * measured leather mechanical properties. Inactive material sets are disposed. */
export class ShoeMaterials extends R07{
 select(id){if(!this.cache.has(id)){const c=CATALOGUE.find(c=>c.id===id);if(!c)throw Error('Unknown inherited leather');this.cache.set(id,this.library.create(c,innerWidth<761?1024:2048));}this.current=this.cache.get(id);this.id=id;return this.current;}
 prepare(state){this.panelReport={};const required=new Set([state.leatherId]);for(const id of [22,23,28,24,25,27,21,20,19,29])required.add(recipeFor({id},state).id);for(const [id,mat]of this.cache)if(!required.has(id)){mat.dispose();this.cache.delete(id);}this.set=state.materialSet;}
 shell(p,s,plane){const recipe=recipeFor(p,s);this.select(recipe.id);const ms=super.shell(p,s,plane);
  if(s.material!=='clay'){
   const outer=ms[0],sourceColour=new T.Color(this.current.params.color),target=recipe.color?new T.Color(recipe.color):null;
   if(target&&![19,29].includes(p.id)){outer.color.r*=target.r/Math.max(1e-5,sourceColour.r);outer.color.g*=target.g/Math.max(1e-5,sourceColour.g);outer.color.b*=target.b/Math.max(1e-5,sourceColour.b);}
   outer.normalScale.multiplyScalar(recipe.normalStrength);outer.clearcoatNormalScale?.multiplyScalar(.35);outer.clearcoat=Math.min(outer.clearcoat??0,.16);
   for(const m of ms){m.depthWrite=true;m.depthTest=true;m.polygonOffset=false;}
   ms[2].color.set(recipe.color||'#543c2a').multiplyScalar(.66);ms[2].roughness=.48;finishCut(ms[2]);finishGrainEdge(outer);outer.userData={...outer.userData,partId:p.id,cowhideRecipe:recipe.id,materialSet:s.materialSet,appearanceOnly:true};
  }
  this.panelReport??={};this.panelReport[p.id]={part:p.id,...recipe,channels:['map','normalMap','roughnessMap'].filter(k=>!!ms[0][k]),source:'Pinned R10 original kernel / scan, not independent measured hide'};return ms;
 }
 sole(s,plane){const m=new T.MeshPhysicalMaterial({color:s.material==='clay'?'#625c53':'#292420',roughness:.80,clearcoat:0,metalness:0,side:T.DoubleSide,clippingPlanes:s.cutaway?[plane]:[],wireframe:s.wire});m.clipShadows=true;if(s.material!=='clay')finishRubber(m);return m;}
 hardware(s,plane){return new T.MeshPhysicalMaterial({color:s.material==='clay'?'#99958c':'#a18656',metalness:s.material==='clay'?0:.86,roughness:.34,clearcoat:.08,side:T.DoubleSide,clippingPlanes:s.cutaway?[plane]:[],wireframe:s.wire,clipShadows:true});}
 yarn(s,plane,lace=false){const m=super.yarn(s,plane,lace);if(!lace){m.color.set('#c3aa80');m.roughness=.70;m.sheen=.30;m.sheenColor.set('#cfbc95');m.userData={flattenedSpunThread:true,nominalWidthMm:s.threadDiameter,strengthTested:false};}return m;}
 report(){return{...super.report(),materialSet:this.set,perPanel:this.panelReport||{},appearanceOnly:true};}
}
/** A narrow waxed rim on the existing grain, preserving the donor shader. */
function finishGrainEdge(m){
 const original=m.onBeforeCompile,cache=m.customProgramCacheKey.bind(m),key=cache();
 m.onBeforeCompile=s=>{original(s);
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute float craftEdge; varying float vCraftEdge;').replace('#include <begin_vertex>','#include <begin_vertex>\nvCraftEdge=craftEdge;');
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying float vCraftEdge;').replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb*=1.-.23*smoothstep(.08,.95,vCraftEdge);').replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,max(.28,roughnessFactor*.82),vCraftEdge);');
 };m.customProgramCacheKey=()=>key+'-r09-bound-cut-wax';
}
/** Actual cut walls use a waxed finish, not a floating cover. */
function finishCut(m){
 m.onBeforeCompile=s=>{
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vCutPosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nvCutPosition=position;');
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vCutPosition;').replace('#include <color_fragment>',`#include <color_fragment>
  float f=(vCutPosition.x*.47+vCutPosition.z*.59+vCutPosition.y*1.8)*6.2831853;
  float attenuation=1.-smoothstep(.7,3.0,fwidth(f));
  diffuseColor.rgb*=.98+.025*sin(f)*attenuation;`);
 };m.customProgramCacheKey=()=> 'r09-burnished-real-cut-wall';m.userData={...m.userData,surfaceRole:'wax-sealed-cut-wall',factoryProcessTested:false};
}
function finishRubber(m){
 m.onBeforeCompile=s=>{
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vRubberP; varying vec3 vRubberN;').replace('#include <begin_vertex>','#include <begin_vertex>\nvRubberP=position;vRubberN=normal;');
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vRubberP; varying vec3 vRubberN;').replace('#include <color_fragment>',`#include <color_fragment>
  float phase=6.2831853*vRubberP.y/.72;
  float fade=1.-smoothstep(.65,3.2,fwidth(phase));
  float side=1.-smoothstep(.25,.75,abs(normalize(vRubberN).y));
  float mould=sin(phase)*fade*side;
  float grain=sin(dot(vRubberP,vec3(8.3,12.1,10.9)))*sin(dot(vRubberP,vec3(-5.3,8.4,7.5)));
  float grainFade=1.-smoothstep(.3,1.7,length(fwidth(vRubberP))*10.);
  diffuseColor.rgb*=1.+.027*mould+.022*grain*grainFade;`);
 };m.customProgramCacheKey=()=> 'r09-matte-moulded-rubber';m.userData={surfaceRole:'matte-rubber',treadSeparateGeometry:true,tractionTested:false};
}
