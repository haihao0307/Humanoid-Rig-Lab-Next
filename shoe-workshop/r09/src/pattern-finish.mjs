/** R09 cut revision, not a covering mesh: retain parent atlas and change the
 * derived cap/counter outline in both the flat pattern and formed template. */
import {MeshRay} from '../../r07/src/ray.mjs';
import {inside} from '../../r03b/src/surface.mjs';
import {mix,dist,smooth,resample} from '../../r07/src/geometry.mjs';
const world=p=>[p[1]+1402,p[2]+14,p[0]-464];
const native=p=>[p[2]+464,p[0]-1402,p[1]-14];
const defaults={22:2,23:2,28:2,24:1.2,25:1.2,27:1.2,21:1.2,20:1.2,19:2.5,29:1.2};
export function refineCutBoundaries(m){
 if(m.craftCutReport)return;
 // Memoize repeat analytic samples only, bounded per domain. No new mesh input.
 for(const D of Object.values(m.domains))for(const name of ['at','toRest']){
  const f=D[name],cache=new Map();D[name]=q=>{const key=q.join(',');if(cache.has(key))return cache.get(key);const v=f(q);if(cache.size<45000)cache.set(key,v);return v;};
 }
 const state={thickness:defaults},sole=m.outsoleGeometry(state),ray=new MeshRay({positions:Array.from(sole.attributes.position.array),indices:Array.from(sole.index.array)}),N=160,profiles=[];
 for(let i=0;i<N;i++){
  const angle=i/N*Math.PI*2,x=Math.cos(angle),z=Math.sin(angle);let lo=0,hi=170;
  for(let j=0;j<16;j++){const r=(lo+hi)/2;if(ray.ray([r*x,180,r*z],[0,-1,0]))lo=r;else hi=r;}
  let lip=-Infinity;for(const d of [.15,.5,1,2,3,4]){const h=ray.ray([(lo-d)*x,180,(lo-d)*z],[0,-1,0]);if(h)lip=Math.max(lip,h.p[1]);}
  if(!Number.isFinite(lip))throw Error('Native outsole profile missing');profiles.push({angle,radius:lo,lip});
 }
 sole.dispose();m.craftSoleProfile=profiles;
 m.craftLipAt=p=>{const u=((Math.atan2(p[2],p[0])+2*Math.PI)%(2*Math.PI))/(2*Math.PI)*N,i=Math.floor(u),a=profiles[i],b=profiles[(i+1)%N];return a.lip+(b.lip-a.lip)*(u-i);};
 const report=[];
 for(const [id,parent] of [[27,28],[24,22],[25,23]]){
  const D=m.domains[id],P=m.domains[parent],before=D.loop,offset=m.offsets(defaults)[id],edge=Math.min(defaults[id]*.55,.62),moves=[],clamps=[];
  const revised=before.map((q,index)=>{
   const h=D.at(q),lip=m.craftLipAt(h.p),above=h.p[1]+Math.max(0,h.n[1])*(offset+edge)-lip;
   // A complete low edge enters the existing cup. The 10mm transition preserves
   // the original curved top join, not a rectangular extension or added skirt.
   const weight=1-smooth((above-8)/10);if(weight<1e-6)return q.slice();
   const targetOuter=h.p[1]+(lip-.9-h.p[1])*weight,angle=Math.atan2(h.p[2],h.p[0]);let y=targetOuter-Math.max(0,h.n[1])*(offset+edge),hit=null;
   for(let j=0;j<4;j++){
    const r=m.ray.ray(native([0,y,0]),[Math.sin(angle),Math.cos(angle),0]);if(!r)break;
    hit=r;y=targetOuter-Math.max(0,r.n[2])*(offset+edge);
   }
   if(!hit)return q.slice();let v;
   try{v=D.atlas.project(hit.p).map(v=>v*D.atlas.targetScale);}catch{return q.slice();}
   if(!inside(v,P.loop)){let a=0,b=1;for(let j=0;j<18;j++){const t=(a+b)/2;if(inside(mix(q,v,t),P.loop))a=t;else b=t;}v=mix(q,v,a*.997);clamps.push(index);}
   const movement=dist(D.at(v).p,h.p);if(!Number.isFinite(movement)||movement>22)throw Error('Cut extension exceeds bounded revision');
   moves.push({index,from:q.slice(),to:v.slice(),fromY:h.p[1],toY:D.at(v).p[1],moveMm:movement,weight});return v;
  });
  D.loop=resample(revised,q=>D.at(q).p,.8,true);
  D.fromWorld=p=>{try{const q=D.atlas.project(native(p)).map(v=>v*D.atlas.targetScale);return inside(q,D.loop)?q:null;}catch{return null;}};
  const piece=m.pieces.get(id);m.pieces.set(id,{...piece,derivedCut:true,revisionTag:'R09',footprints:[{...piece.footprints[0],outer:D.loop.map(D.toRest)}]});
  report.push({id,parent,changedBoundaryVertices:moves.filter(v=>v.moveMm>.05).length,maxMoveMm:Math.max(0,...moves.map(v=>v.moveMm)),parentBoundaryClamps:clamps.length,sourceBoundaryCount:before.length,derivedBoundaryCount:D.loop.length,sourceDataUnchanged:true,flatAndFormedShareCut:true,moves});
 }
 m.craftCutReport=report;
}
