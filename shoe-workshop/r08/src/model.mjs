import {ShoeAssembly as R07Base,PARTS,defaultState as oldDefault,validate as oldValidate} from '../../r07/src/base-model.mjs';
import {compileJoins,JOIN_RULES} from './join-plan.mjs';
import {sourceRearRails} from './rear-rails.mjs';
import {registerLayers,ShellSampler} from './contact.mjs';
import {seatSoleWall} from './sole-contact.mjs';
import {lockstitch301} from './sewing.mjs';
import {add,sub,mul,unit,mix,dist,smooth,stats,nearestOnSegment} from '../../r07/src/geometry.mjs';
export {PARTS};
export const VERSION='R08.0';
export const defaultState=()=>({...oldDefault(),revisionTag:'R08',laces:false,threadDiameter:JOIN_RULES.threadDiameterMm,materialSet:'chestnut',partLeather:{}});
export function validate(s){const p=oldValidate({...s,laces:false});if(s.materialSet!==undefined&&!['chestnut','espresso','uniform'].includes(s.materialSet))throw Error('未知牛皮组合');const overrides=s.partLeather||{};for(const [id,v]of Object.entries(overrides))if(!PARTS.some(p=>String(p.id)===id)||!['heritage','wax','tan','nubuck','black','suede'].includes(v))throw Error('未知裁片皮料');return {...p,revisionTag:'R08',laces:false,materialSet:s.materialSet||'chestnut',partLeather:{...overrides}};}
const keyOf=s=>JSON.stringify([s.view==='flat'?'flat':'formed',s.thickness,s.threadDiameter]);
const savedFields=['cachedParts','currentParts','seatRays','seating','quarterSeating','fittedSole','soleFinishReport','threadCache','samplers','contactReport'];
export class ShoeAssembly extends R07Base{
 rebuildSeams(){const old=this.seams.map(s=>({...s,pairs:s.pairs.map(p=>({a:p.a.slice(),b:p.b.slice()}))}));compileJoins(this,sourceRearRails(old));}
 cutThickness(id,p,t){const d=this.edgeFields[id]?.sample(p).distance??Infinity;const floor=Math.min(t*.42,JOIN_RULES.skiveEdgeMm);return floor+(t-floor)*smooth(d/JOIN_RULES.skiveWidthMm);}
 remember(){this.states??=new Map();if(!this.cachedParts)return;this.states.delete(this.geometryKey);this.states.set(this.geometryKey,Object.fromEntries(savedFields.map(k=>[k,this[k]])));const pinned=keyOf(defaultState());while(this.states.size>3){const k=[...this.states.keys()].find(k=>k!==pinned&&k!==this.geometryKey);const old=this.states.get(k);this.states.delete(k);const live=new Set([...this.states.values()].flatMap(s=>[...(s.cachedParts||[]).map(p=>p.geometry),s.fittedSole]));for(const g of [...old.cachedParts.map(p=>p.geometry),old.fittedSole])if(g&&!live.has(g))g.dispose();}}
 build(s){
  s=validate(s);const k=keyOf(s);
  if(this.r08Built&&this.geometryKey===k){this.state=s;return this.cachedParts;}
  const cached=this.states?.get(k);if(cached){Object.assign(this,cached);this.geometryKey=k;this.state=s;this.r08Built=true;this.restores=(this.restores||0)+1;this.remember();return this.cachedParts;}
  this.geometryKey=null;const parts=super.build(s);
  this.contactReport=s.view==='flat'?[]:registerLayers(parts);
  if(s.view!=='flat'){const prior=this.fittedSole;this.fittedSole=seatSoleWall(prior,parts);this.soleFinishReport=this.fittedSole.userData.seating;prior.dispose();}
  this.samplers=new Map(parts.filter(p=>p.id!==29).map(p=>[p.id,new ShellSampler(p.geometry,(this.needleSpecs[p.id]||[]).map(h=>s.view==='flat'?{q:this.domains[p.id].toRest(h.q),loop:h.loop.map(q=>this.domains[p.id].toRest(q))}:h))]));this.threadCache=null;this.cachedParts=parts;this.currentParts=parts;this.state=s;this.geometryKey=k;this.r08Built=true;this.buildCount=(this.buildCount||0)+1;this.remember();return parts;
 }
 sample(id,q,s){const Q=s.view==='flat'?this.domains[id].toRest(q):q;return this.samplers.get(id).at(Q);}
 frame(seam,u,s){
  const i=Math.min(seam.qa.length-2,Math.max(0,Math.floor(u))),t=Math.max(0,Math.min(1,u-i));
  const qa=mix(seam.qa[i],seam.qa[i+1],t),qb=mix(seam.qb[i],seam.qb[i+1],t);
  if(!this.samplers)return super.frame(seam,u,s);
  const a=this.sample(seam.a,qa,s),b=this.sample(seam.b,qb,s),A=this.sample(seam.a,seam.qa[i],s),B=this.sample(seam.a,seam.qa[i+1],s);
  return {outer:a.outer,inner:b.inner,n:a.n,tangent:unit(sub(B.outer,A.outer)),gap:dist(this.domains[seam.a].at(qa).p,this.domains[seam.b].at(qb).p),actualTriangleFrames:true};
 }
 threadPaths(s){if(!this.samplers)return super.threadPaths(s);if(this.threadCache)return this.threadCache;const out=[];
  for(const seam of this.seams){const stations=this.stations(seam,s),frames=new Map(),frame=u=>{const k=Math.round(u*1e6);if(!frames.has(k))frames.set(k,this.frame(seam,u,s));return frames.get(k);};for(const p of lockstitch301(stations,frame,s.threadDiameter))out.push({...p,id:seam.id,threadId:seam.id+'-'+p.kind,a:seam.a,b:seam.b,stations,count:stations.length,maxBaseResidualMm:Math.max(...stations.map(h=>h.gap))});}
  this.threadCache=out;this.remember();return out;
 }
 report(s,parts){const r=super.report(s,parts);return {...r,version:VERSION,joinPlan:this.joinPlan,layerContacts:this.contactReport||[],stitchTopology:{type:301,rowsPerJoin:1,twoThreads:true,locks:'inside material stack',physicalTension:false},cache:{limit:3,entries:this.states?.size||0,builds:this.buildCount||0,restores:this.restores||0},lacesDeferred:true,manufacturingApproved:false};}
}
