import {ShoeAssembly as R05,PARTS,defaultState as priorDefault,validate as priorValidate} from '../../r05/src/model.mjs';
import {SurfaceAtlas} from '../../r03b/src/atlas.mjs';
import {ANCHORS} from '../../r03b/src/anchors.mjs';
import {MeshRay} from '../../r03b/src/surface.mjs';
export {PARTS};
export const VERSION='R06.0';
export const defaultState=()=>({...priorDefault(),revisionTag:'R06'});
export const validate=s=>({...priorValidate(s),revisionTag:'R06'});
const world=p=>[p[1]+1402,p[2]+14,p[0]-464],worldN=n=>[n[1],n[2],n[0]];
// Derived registration ONLY. Original author patterns, last and donor are read-only.
// Extend existing vamp/tongue beneath the facing; do not hide holes with a new cover mesh.
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
  this.maps[28]=(x,y)=>{const h=atlas.map(x,y);return{p:world(h.p),n:worldN(h.n),fallback:h.chartFallback};};
  this.maps[27]=this.maps[28];
  this.contactRepair={method:'Existing P28 source boundary re-registered under the quarter and facing; no additional cover mesh',targetRepairs:VAMP_TARGET_REPAIRS,sourcePatternsUnchanged:true,forceSolved:false};
  super.createSeams();
 }
 seatDelta(id,p,n){
  const ray=this.seatRays?.get(id);if(!ray)return 0;
  const h=ray.ray(p.map((v,k)=>v+n[k]*4),n.map(v=>-v));
  if(!h||h.distance>5)return 0;
  return Math.min(.6,Math.max(0,.045-(h.distance-4)));
 }
 build(s){
  this.seatRays=null;const parts=super.build(s);this.seating=[];
  if(s.view==='flat')return parts;
  this.seatRays=new Map();
  for(const [id,parent]of [[24,22],[25,23],[27,28]]){
   const host=parts.find(p=>p.id===parent).geometry,g=parts.find(p=>p.id===id).geometry;
   this.seatRays.set(id,new MeshRay({positions:Array.from(host.attributes.position.array),indices:Array.from(host.index.array).slice(0,host.groups[0].count)}));
   const n=g.userData.vertexPairs,v=g.attributes.position.array,ns=g.userData.normals;let max=0,adjusted=0;
   for(let i=0;i<n;i++){
    const d=this.seatDelta(id,Array.from(v.slice(i*3,i*3+3)),ns[i]);
    if(d>1e-6){adjusted++;max=Math.max(max,d);for(let k=0;k<3;k++){v[i*3+k]+=ns[i][k]*d;v[(n+i)*3+k]+=ns[i][k]*d;}}
   }
   for(let i=n*2;i<g.userData.logicalIndices.length;i++){const j=g.userData.logicalIndices[i];for(let k=0;k<3;k++)v[i*3+k]=v[j*3+k];}
   g.attributes.position.needsUpdate=true;g.computeBoundingBox();g.computeBoundingSphere();
   g.userData.report.triangleSeating={parent,adjusted,maxLiftMm:max,targetClearanceMm:.045,wholeSurfaceCollisionProof:false};
   this.seating.push({id,...g.userData.report.triangleSeating});
  }
  return parts;
 }
 stations(seam,s){
  const st=super.stations(seam,s);if(!this.seatRays?.has(seam.a))return st;
  const off=this.offsets(s.thickness)[seam.a];
  return st.map((h,i)=>{const f=this.maps[seam.a](...seam.pairs[i].a),p=f.p.map((v,k)=>v+f.n[k]*off),d=this.seatDelta(seam.a,p,f.n);return {...h,outer:h.outer.map((v,k)=>v+f.n[k]*d)};});
 }
 report(s,parts){return {...super.report(s,parts),version:VERSION,contactRepair:this.contactRepair,patchSeating:this.seating||[]};}
}
