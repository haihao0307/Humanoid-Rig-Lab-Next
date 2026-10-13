import * as T from 'three';
import {ShoeMaterials as R07,CATALOGUE} from '../../r07/src/materials.mjs';
export {CATALOGUE};
export const MATERIAL_SETS={
 chestnut:{name:'栗棕 · 细粒鞋头／油蜡鞋帮／牛巴后片',parts:{27:['heritage','#70452e',.27],28:['heritage','#8a593a',.38],22:['wax','#745039',.38],23:['wax','#745039',.38],24:['nubuck','#574333',.48],25:['nubuck','#574333',.48],21:['heritage','#553927',.3],20:['heritage','#553927',.3]}},
 espresso:{name:'深咖 · 哑光牛巴／细粒拼接',parts:{27:['heritage','#342b27',.3],28:['nubuck','#544438',.45],22:['heritage','#483a31',.35],23:['heritage','#483a31',.35],24:['wax','#302a25',.3],25:['wax','#302a25',.3],21:['heritage','#302824',.25],20:['heritage','#302824',.25]}},
 uniform:{name:'统一皮料对照',parts:{}}
};
export function recipeFor(part,state){const spec=MATERIAL_SETS[state.materialSet||'chestnut'].parts[part.id],id=state.partLeather?.[part.id]||(state.materialSet==='uniform'||!spec?state.leatherId:spec[0]);return{id,color:state.partLeather?.[part.id]?null:spec?.[1],normalStrength:spec?.[2]??.45};}
/** Original R10 kernels and scans selected per material region, not independently
 * measured leather mechanical properties. Inactive material sets are disposed.
 */
export class ShoeMaterials extends R07{
 select(id){if(!this.cache.has(id)){const c=CATALOGUE.find(c=>c.id===id);if(!c)throw Error('Unknown inherited leather');this.cache.set(id,this.library.create(c,innerWidth<761?1024:2048));}this.current=this.cache.get(id);this.id=id;return this.current;}
 prepare(state){this.panelReport={};const required=new Set([state.leatherId]);for(const id of [22,23,28,24,25,27,21,20,19,29])required.add(recipeFor({id},state).id);for(const [id,mat]of this.cache)if(!required.has(id)){mat.dispose();this.cache.delete(id);}this.set=state.materialSet;}
 shell(p,s,plane){const recipe=recipeFor(p,s);this.select(recipe.id);const ms=super.shell(p,s,plane);
  if(s.material!=='clay'){
   const outer=ms[0],sourceColour=new T.Color(this.current.params.color),target=recipe.color?new T.Color(recipe.color):null;
   if(target&&![19,29].includes(p.id)){outer.color.r*=target.r/Math.max(1e-5,sourceColour.r);outer.color.g*=target.g/Math.max(1e-5,sourceColour.g);outer.color.b*=target.b/Math.max(1e-5,sourceColour.b);}
   outer.normalScale.multiplyScalar(recipe.normalStrength);outer.clearcoatNormalScale?.multiplyScalar(.35);outer.clearcoat=Math.min(outer.clearcoat??0,.16);
   for(const m of ms){m.depthWrite=true;m.depthTest=true;m.polygonOffset=false;}
   ms[2].color.set(recipe.color||'#543c2a');ms[2].roughness=.83;outer.userData={...outer.userData,partId:p.id,cowhideRecipe:recipe.id,materialSet:s.materialSet,appearanceOnly:true};
  }
  this.panelReport??={};this.panelReport[p.id]={part:p.id,...recipe,channels:['map','normalMap','roughnessMap'].filter(k=>!!ms[0][k]),source:'Pinned R10 original kernel / scan, not independent measured hide'};return ms;
 }
 report(){return{...super.report(),materialSet:this.set,perPanel:this.panelReport||{},appearanceOnly:true};}
}
