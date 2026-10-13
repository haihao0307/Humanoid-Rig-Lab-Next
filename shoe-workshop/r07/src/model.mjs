import {ShoeAssembly as Base,PARTS,defaultState,validate} from './base-model.mjs';
export {PARTS,defaultState,validate};
export const VERSION='R07.1';
// Default + two most recent geometry states. Appearance is not a geometry key.
const LIMIT=3;
const fields=['cachedParts','currentParts','seatRays','seating','quarterSeating','fittedSole','soleFinishReport','threadCache'];
const keyOf=s=>JSON.stringify([s.view==='flat'?'flat':'formed',s.thickness,s.threadDiameter]);
const geometries=s=>[...(s?.cachedParts||[]).map(p=>p.geometry),s?.fittedSole].filter(Boolean);
export class ShoeAssembly extends Base{
 remember(){
  if(!this.finishReady||!this.cachedParts||!this.geometryKey)return;
  this.snapshots??=new Map();
  this.snapshots.delete(this.geometryKey);
  this.snapshots.set(this.geometryKey,Object.fromEntries(fields.map(k=>[k,this[k]])));
  const pinned=keyOf(defaultState());
  while(this.snapshots.size>LIMIT){
   const key=[...this.snapshots.keys()].find(k=>k!==pinned&&k!==this.geometryKey);
   const old=this.snapshots.get(key);this.snapshots.delete(key);
   const retained=new Set([...this.snapshots.values()].flatMap(geometries));
   for(const geometry of new Set(geometries(old)))if(!retained.has(geometry))geometry.dispose();
  }
 }
 build(s){
  if(!this.finishReady)return super.build(s);
  const key=keyOf(s);
  if(this.geometryKey===key&&this.cachedParts)return super.build(s);
  this.remember();
  const saved=this.snapshots?.get(key);
  if(saved){
   Object.assign(this,saved);this.geometryKey=key;this.state=s;this.frameCache=new Map();
   this.cacheHits=(this.cacheHits||0)+1;this.geometryRestores=(this.geometryRestores||0)+1;
   if(key===keyOf(defaultState()))this.defaultCacheHits=(this.defaultCacheHits||0)+1;
   this.remember();return this.cachedParts;
  }
  const result=super.build(s);this.geometryBuilds=(this.geometryBuilds||0)+1;
  this.remember();return result;
 }
 threadPaths(s){const result=super.threadPaths(s);this.remember();return result;}
 report(s,parts){
  const r=super.report(s,parts);
  return {...r,version:VERSION,finish:{...r.finish,defaultCacheHits:this.defaultCacheHits||0,
   cacheLimit:LIMIT,cacheEntries:this.snapshots?.size||0,geometryBuilds:this.geometryBuilds||0,
   geometryRestores:this.geometryRestores||0}};
 }
}
