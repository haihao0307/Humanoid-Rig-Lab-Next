import {ShoeAssembly as R05,PARTS,defaultState as priorDefault,validate as priorValidate} from '../../r05/src/model.mjs';
import {SurfaceAtlas} from '../../r03b/src/atlas.mjs';
import {ANCHORS} from '../../r03b/src/anchors.mjs';
export {PARTS};
export const VERSION='R06.0';
export const defaultState=()=>({...priorDefault(),revisionTag:'R06'});
export const validate=s=>({...priorValidate(s),revisionTag:'R06'});
const world=p=>[p[1]+1402,p[2]+14,p[0]-464],worldN=n=>[n[1],n[2],n[0]];
// Derived registration only. Original author patterns, last and donor are read-only.
// Extend the EXISTING vamp/tongue beneath the facing, never a hidden cover mesh.
export const VAMP_TARGET_REPAIRS={
 6:[433,-1374,25],7:[449,-1369,44],8:[480,-1377,53],
 9:[497,-1374,57],10:[477,-1378,78],11:[466,-1379,83],
 12:[466,-1422,83],13:[498,-1422,57],14:[479,-1425,53],
 15:[447,-1433,44],16:[429,-1429,25],17:[421,-1416,7]
};
export class ShoeAssembly extends R05{
 createSeams(){
  const anchors=structuredClone(ANCHORS[28]).slice(0,-2);
  for(const [i,target] of Object.entries(VAMP_TARGET_REPAIRS))anchors[+i].splice(2,3,...target);
  const atlas=new SurfaceAtlas(this.pieces.get(28).footprints[0].outer,anchors,[400,-1402,30],1,this.ray);
  this.atlases[28]=atlas;
  this.maps[28]=(x,y)=>{const h=atlas.map(x,y);return {p:world(h.p),n:worldN(h.n),fallback:h.chartFallback};};
  this.maps[27]=this.maps[28];
  this.contactRepair={method:'Existing P28 source boundary re-registered under the quarter and facing; no additional cover mesh',targetRepairs:VAMP_TARGET_REPAIRS,sourcePatternsUnchanged:true,forceSolved:false};
  super.createSeams();
 }
 report(s,parts){return {...super.report(s,parts),version:VERSION,contactRepair:this.contactRepair};}
}
