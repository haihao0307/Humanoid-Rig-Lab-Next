import {ShoeAssembly as Base,PARTS,defaultState,validate,VERSION} from './base-model.mjs';
import {captureDefault,restoreDefault,captureDefaultThread} from './finish-cache.mjs';
export {PARTS,defaultState,validate,VERSION};
/** Runtime API wrapper. The audited R07 geometry remains readable in base-model.mjs.
 * Restoring a previously generated default must not synchronously rebuild the whole shoe.
 */
export class ShoeAssembly extends Base{
 build(s){
  if(!this.finishReady)return super.build(s);
  const key=JSON.stringify([s.view==='flat'?'flat':'formed',s.thickness,s.threadDiameter]);
  if(this.geometryKey!==key){const cached=restoreDefault(this,key,s);if(cached)return cached;}
  const parts=super.build(s),d=defaultState();
  captureDefault(this,key,JSON.stringify(['formed',d.thickness,d.threadDiameter]));return parts;
 }
 threadPaths(s){const paths=super.threadPaths(s);if(this.finishReady)captureDefaultThread(this);return paths;}
 report(s,parts){const r=super.report(s,parts);return {...r,finish:{...r.finish,defaultCacheHits:this.defaultCacheHits||0,cacheLimit:2}};}
}
