import * as T from 'three';
import {ShoeAssembly as R06,PARTS,defaultState as priorDefault,validate as priorValidate} from '../../r06/src/model.mjs';
import {inside,clean,boundaryDistance,MeshRay} from '../../r03b/src/surface.mjs';
import {makeTemplate} from './mesh.mjs';
import {MeshRay as DenseRay} from './ray.mjs';
import {add,sub,mul,mix,dot,length,dist,unit,cross,clamp,smooth,stats,resample,cardinal,roundedBoundary,differential,inward,SeamField} from './geometry.mjs';
import {seatedSaddle} from './sewing.mjs';
import {fitSoleRim} from './sole.mjs';
export {PARTS};
export const VERSION='R07.0';
export const defaultState=()=>({...priorDefault(),revisionTag:'R07'});
export const validate=s=>({...priorValidate(s),revisionTag:'R07'});
const world=p=>[p[1]+1402,p[2]+14,p[0]-464],worldN=n=>[n[1],n[2],n[0]],unworld=p=>[p[2]+464,p[0]-1402,p[1]-14];
export class ShoeAssembly extends R06{
 constructor(data,outsole){
  super(data,outsole);this.sourcePieces=new Map(this.pieces);this.domains={};this.cutReview=[];this.needleSpecs={};this.fields={};this.edgeFields={};this.finishReady=false;this.frameCache=new Map();
  for(const part of PARTS.filter(p=>p.id!==29)){
   const id=part.id,piece=this.pieces.get(id),atlas=this.atlases[part.parent],at=atlas?(q=>{const h=atlas.rayPoint(q);if(!h)throw Error('R07 finishing ray missed P'+id);return{p:world(h.p),n:worldN(h.n)};}):(q=>this.maps[id](...q));
   let loop=atlas?atlas.mappedLoop(piece.footprints[0].outer):clean(piece.footprints[0].outer),sourceLoop=loop;
   if([22,23,24,25,27,28].includes(id)){const rounded=roundedBoundary(loop,q=>at(q).p,id===27?2.1:([24,25].includes(id)?1.7:[22,23].includes(id)?1.1:.55));loop=rounded.loop;this.cutReview.push({id,...rounded.report});}
   const toRest=q=>atlas?atlas.unchart(q):q.slice(),fromRest=q=>atlas?atlas.chart(q):q.slice(),fromWorld=p=>{if(!atlas)return null;try{const v=atlas.project(unworld(p)).map(v=>v*atlas.targetScale);return inside(v,loop)?v:null;}catch{return null;}};
   const sourceHoles=piece.footprints[0].holes.map(h=>atlas?atlas.mappedLoop(h):clean(h));this.domains[id]={id,atlas,loop,sourceLoop,sourceHoles,at,toRest,fromRest,fromWorld};
   this.needleSpecs[id]=[];this.fields[id]=new SeamField();
   if(atlas)this.pieces.set(id,{...piece,derivedCut:true,footprints:[{outer:loop.map(toRest),holes:piece.footprints[0].holes}]});
  }
  this.rebuildSeams();this.rebuildTemplates();this.finishReady=true;this.soleFitCache=null;this.threadCache=null;
 }
 legalNeedle(id,q){const d=this.domains[id];if(!inside(q,d.loop)||d.sourceHoles.some(h=>inside(q,h)))return false;return true;}
 cutThickness(id,p,t){const distance=this.edgeFields[id]?.sample(p).distance??Infinity,width=[22,23].includes(id)?2.4:1.8,floor=Math.min(t*.35,[22,23].includes(id)?.45:.30);return floor+(t-floor)*smooth(distance/width);}
 prepareHole(id,q,tangent){
  const d=this.domains[id],h=d.at(q),state=defaultState(),o=this.offsets(state.thickness)[id],outer=v=>{const f=d.at(v);return add(f.p,mul(f.n,o+this.cutThickness(id,f.p,state.thickness[id])));},origin=outer(q),side=unit(cross(h.n,tangent)),axis=add(mul(unit(tangent),Math.cos(48*Math.PI/180)),mul(side,Math.sin(48*Math.PI/180))),axisB=unit(cross(h.n,axis)),a=differential(q,outer,mul(axis,.36)),b=differential(q,outer,mul(axisB,.22));
  const loop=Array.from({length:16},(_,i)=>{const co=Math.cos(i*Math.PI/8),si=Math.sin(i*Math.PI/8),target=Math.hypot(.36*co,.22*si);let v=add(q,add(mul(a,co),mul(b,si)));for(let k=0;k<4;k++){const actual=dist(outer(v),origin);if(actual<1e-7)break;v=add(q,mul(sub(v,q),target/actual));}return v;});
  if(!loop.every(v=>this.legalNeedle(id,v)))return null;return{q:q.slice(),rest:d.toRest(q),loop,p:h.p,n:h.n,axis,axisB,majorMm:.72,minorMm:.44};
 }
 buildEdgeFields(){
  this.edgeSegments={};for(const id of [22,23,24,25,27,21,20]){const d=this.domains[id];this.edgeSegments[id]=d.loop.map((q,i)=>[d.at(q).p,d.at(d.loop[(i+1)%d.loop.length]).p]);this.edgeFields[id]=new SeamField();const edge=resample(d.loop,q=>d.at(q).p,.8,true);for(let i=0;i<edge.length;i++){const a=d.at(edge[i]).p,b=d.at(edge[(i+1)%edge.length]).p;if([22,23].includes(id)&&!this.domains[28].fromWorld(mix(a,b,.5)))continue;this.edgeFields[id].put(a,b);}}
 }
 rebuildSeams(){
  this.buildEdgeFields();
  const old=this.seams.map(s=>({...s,pairs:s.pairs.map(p=>({a:p.a.slice(),b:p.b.slice()}))}));this.seams=[];this.holes=Object.fromEntries(PARTS.map(p=>[p.id,[]]));this.stitchReview={method:'Inset from finished boundary in formed millimetres, common two-layer needle frame, 0.72 x 0.44 mm slit target',omittedUnsupported:0,sourceSideCounts:old.filter(s=>s.id.startsWith('quarter-vamp')).map(s=>({id:s.id,count:s.pairs.length}))};
  const commitLine=(id,a,b,qa,qb,description)=>{
   if(qa.length<3)return;let rows=[];for(let i=0;i<qa.length;i++){
    const tangent=unit(sub(this.domains[a].at(qa[Math.min(i+1,qa.length-1)]).p,this.domains[a].at(qa[Math.max(0,i-1)]).p)),ha=this.prepareHole(a,qa[i],tangent),hb=this.prepareHole(b,qb[i],tangent);
    if(!ha||!hb){this.stitchReview.omittedUnsupported++;continue;}const existingA=this.needleSpecs[a].find(h=>dist(h.p,ha.p)<.30),existingB=this.needleSpecs[b].find(h=>dist(h.p,hb.p)<.30);
    if(!existingA){this.needleSpecs[a].push(ha);this.holes[a].push(ha.rest);}if(!existingB){this.needleSpecs[b].push(hb);this.holes[b].push(hb.rest);}const A=existingA||ha,B=existingB||hb;rows.push({qa:A.q,qb:B.q,a:A.rest,b:B.rest});
   }
   if(rows.length<3)return;const chunks=[[]];for(const row of rows){const last=chunks.at(-1).at(-1);if(last&&dist(this.domains[a].at(row.qa).p,this.domains[a].at(last.qa).p)>4.6||last&&(()=>{const D=this.domains[a],u=D.at(row.qa),v=D.at(last.qa),state=defaultState(),offset=this.offsets(state.thickness)[a]+state.thickness[a];return dist(add(u.p,mul(u.n,offset)),add(v.p,mul(v.n,offset)))>4.6;})())chunks.push([]);chunks.at(-1).push(row);}let chunkId=0;for(const chunk of chunks){if(chunk.length<3)continue;this.seams.push({id:id+(chunkId++?'-segment-'+chunkId:''),a,b,qa:chunk.map(r=>r.qa),qb:chunk.map(r=>r.qb),pairs:chunk.map(r=>({a:r.a,b:r.b})),description,status:'STATIC_SEATED_SADDLE_NOT_FORCE_SOLVED',geometricOnly:true});}
  };
  const trace=(id,a,b,curve,closed=false,filter=()=>true)=>{
   const A=this.domains[a],B=this.domains[b],dense=resample(curve,q=>A.at(q).p,.65,closed),runs=[[]];let allValid=true;
   for(const q of dense){const p=A.at(q).p,v=A.atlas===B.atlas?q.slice():B.fromWorld(p);if(!v||!filter(q,p)||!this.legalNeedle(a,q)||!this.legalNeedle(b,v)||dist(B.at(v).p,p)>.25){allValid=false;if(runs.at(-1).length)runs.push([]);continue;}runs.at(-1).push(q);}
   if(closed&&runs.length>1&&runs[0].length&&runs.at(-1).length){runs[0]=[...runs.at(-1),...runs[0]];runs.pop();}
   let k=0;for(const run of runs){if(run.length<4)continue;const complete=closed&&allValid&&runs.length===1,p=resample(run,q=>A.at(q).p,3.05,complete);if(complete)p.push(p[0]);const v=p.map(q=>A.atlas===B.atlas?q.slice():B.fromWorld(A.at(q).p));if(v.some(v=>!v))continue;commitLine(id+(k++?'-run-'+k:''),a,b,p,v,'Finished edge-derived paired stitch; formed-space pitch and real pierced layers');}
  };
  for(const [a,b]of [[24,22],[25,23],[27,28]]){const d=this.domains[a],path=inward(d.loop,q=>d.at(q).p,1.65);trace('patch-'+a,a,b,path,true);}
  for(const id of [22,23]){const d=this.domains[id],path=inward(d.loop,q=>d.at(q).p,1.75);trace('quarter-vamp-'+id,id,28,path,true,(q,p)=>p[2]>-43&&p[2]<45&&p[1]<76&&p[1]>35);}
  // Keep original supported heel/binding routes. Do not guess a new heel construction.
  for(const s of old.filter(s=>s.id.startsWith('back-binding')||s.id==='binding-turn')){const A=this.domains[s.a],B=this.domains[s.b],qa=resample(s.pairs.map(p=>A.fromRest(p.a)),q=>A.at(q).p,3.1,false),qb=[];let valid=true;for(const q of qa){let b;if(s.id==='binding-turn')b=[q[0]-4.7,q[1]];else b=B.fromWorld(A.at(q).p);if(!b){valid=false;break;}qb.push(b);}if(valid)commitLine(s.id,s.a,s.b,qa,qb,s.description);}
  if(!this.seams.some(s=>s.id==='binding-turn')){const s=old.find(s=>s.id==='binding-turn');commitLine(s.id,s.a,s.b,s.pairs.map(p=>p.a),s.pairs.map(p=>p.b),s.description);}
  // A rejected short row must not leave orphan needle holes. Shared holes use the exact registered centre.
  for(const id of Object.keys(this.needleSpecs)){const used=new Set(this.seams.flatMap(s=>[...(s.a===+id?s.qa:[]),...(s.b===+id?s.qb:[])]).map(q=>q.join(',')));this.needleSpecs[id]=this.needleSpecs[id].filter(h=>used.has(h.q.join(',')));this.holes[id]=this.needleSpecs[id].map(h=>h.rest);}
  for(const s of this.seams){for(const [id,path]of [[s.a,s.qa],[s.b,s.qb]]){const d=this.domains[id],dense=resample(path,q=>d.at(q).p,.55,false);for(let i=1;i<dense.length;i++)this.fields[id].put(d.at(dense[i-1]).p,d.at(dense[i]).p);}}
  for(const [id,specs]of Object.entries(this.needleSpecs))for(const h of specs)this.fields[id].put(h.p,h.p,true);

 }
 rebuildTemplates(){
  this.templateReview=[];
  for(const part of PARTS.filter(p=>p.id!==29)){
   const id=part.id,d=this.domains[id],footprints=[{outer:d.loop,holes:[...d.sourceHoles,...this.needleSpecs[id].map(h=>h.loop)]}],at=q=>d.at(q).p,cache=new Map(),cached=q=>{const k=q.join(',');if(!cache.has(k))cache.set(k,at(q));return cache.get(k);};
   const field=this.fields[id],refine=(a,b)=>{const p=cached(a),q=cached(b),l=dist(p,q);if(l>5.5)return true;if(l<.60)return false;const near=field.sample(mix(p,q,.5)).distance;return l>(near<1.0?.95:5.5);};
   const t=makeTemplate(footprints,[],refine);t.restUV=t.vertices.map(d.toRest);t.punchCount=this.needleSpecs[id].length;t.sourceHoleCount=d.sourceHoles.length;this.templates[id]=t;this.renderMaps[id]=(x,y)=>d.at([x,y]);
   const flat=makeTemplate([{outer:d.loop.map(d.toRest),holes:[...this.pieces.get(id).footprints[0].holes,...this.needleSpecs[id].map(h=>h.loop.map(d.toRest))]}],[],6);flat.punchCount=t.punchCount;flat.sourceHoleCount=d.sourceHoles.length;this.flatTemplates[id]=flat;
   this.templateReview.push({id,vertices:t.vertices.length,triangles:t.triangles.length,holes:t.punchCount});
  }
 }
 thicknessAt(id,p,t){if(!this.finishReady)return super.thicknessAt(id,p,t);const base=this.cutThickness(id,p,t),depth=this.fields[id]?.sample(p).depth||0;return Math.max(.18,base-depth);}
 seatDelta(id,p,n){if(![22,23].includes(id))return super.seatDelta(id,p,n);const ray=this.seatRays?.get(id);if(!ray)return 0;const h=ray.ray(add(p,mul(n,4)),mul(n,-1));return h&&h.distance<5?Math.min(.025,Math.max(0,.012-(h.distance-4))):0;}
 build(s){const key=JSON.stringify([s.view==='flat'?'flat':'formed',s.thickness,s.threadDiameter]);if(this.finishReady&&this.geometryKey===key&&this.cachedParts){this.cacheHits=(this.cacheHits||0)+1;this.state=s;this.currentParts=this.cachedParts;return this.cachedParts;}this.threadCache=null;this.frameCache=new Map();const parts=super.build(s);if(this.finishReady){this.quarterSeating=[];if(s.view!=='flat'){const host=parts.find(p=>p.id===28).geometry,ray=new DenseRay({positions:Array.from(host.attributes.position.array),indices:Array.from(host.index.array).slice(0,host.groups[0].count)});for(const id of [22,23]){this.seatRays.set(id,ray);const g=parts.find(p=>p.id===id).geometry,n=g.userData.vertexPairs,v=g.attributes.position.array,ns=g.userData.normals;let count=0,max=0;for(let i=0;i<n;i++){const d=this.seatDelta(id,Array.from(v.slice(i*3,i*3+3)),ns[i]);if(d>1e-6){count++;max=Math.max(max,d);for(let k=0;k<3;k++){v[i*3+k]+=ns[i][k]*d;v[(i+n)*3+k]+=ns[i][k]*d;}}}for(let i=n*2;i<g.userData.logicalIndices.length;i++){const j=g.userData.logicalIndices[i];for(let k=0;k<3;k++)v[i*3+k]=v[j*3+k];}g.attributes.position.needsUpdate=true;g.computeBoundingBox();g.computeBoundingSphere();this.quarterSeating.push({id,adjusted:count,maxLiftMm:max,boundMm:.025,forceSolved:false});}}for(const p of parts){const g=p.geometry,n=g.userData.vertexPairs,pos=g.attributes.position.array,normal=g.attributes.normal.array,c=g.attributes.compression?.array;let affected=0,maxDepth=0;for(let i=0;i<n;i++){const pt=g.userData.points[i],f=s.view==='flat'?null:this.fields[p.id]?.sample(pt);if(!f||f.depth<1e-5)continue;affected++;maxDepth=Math.max(maxDepth,f.depth);if(c)c[n+i]=f.depth/.056;const base=g.userData.normals[i],gradient=sub(f.gradient,mul(base,dot(base,f.gradient))),nn=unit(add(base,gradient));for(let k=0;k<3;k++)normal[(n+i)*3+k]=nn[k];}g.attributes.normal.needsUpdate=true;if(c)g.attributes.compression.needsUpdate=true;g.userData.report.stitchSeat={affectedVertices:affected,maxDepthMm:maxDepth,prescribedStatic:true,forceSolved:false};}
   this.currentParts=parts;if(s.view!=='flat'){const old=super.outsoleGeometry(s);this.fittedSole?.dispose();this.fittedSole=fitSoleRim(old,parts,s);old.dispose();this.soleFinishReport=this.fittedSole.userData.seating;}
  }if(this.finishReady){this.geometryKey=key;this.cachedParts=parts;}return parts;}
 surface(id,q,s){const d=this.domains[id],f=d.at(q),o=this.offsets(s.thickness)[id],t=this.thicknessAt(id,f.p,s.thickness[id]),shift=this.seatRays?.has(id)?this.seatDelta(id,add(f.p,mul(f.n,o)),f.n):0;return {...f,outer:add(f.p,mul(f.n,o+t+shift)),inner:add(f.p,mul(f.n,o+shift))};}
 frame(seam,u,s){const q=cardinal(seam.qa,u),r=cardinal(seam.qb,u),a=this.surface(seam.a,q,s),b=this.surface(seam.b,r,s),lo=clamp(u-.015,0,seam.qa.length-1),hi=clamp(u+.015,0,seam.qa.length-1),tangent=unit(sub(this.domains[seam.a].at(cardinal(seam.qa,hi)).p,this.domains[seam.a].at(cardinal(seam.qa,lo)).p));return {outer:a.outer,inner:b.inner,n:a.n,tangent,gap:dist(a.p,b.p)};}
 stations(seam,s){if(!this.finishReady||!seam.qa)return super.stations(seam,s);return seam.qa.map((_,i)=>this.frame(seam,i,s));}
 threadPaths(s){if(!this.finishReady)return super.threadPaths(s);if(this.threadCache)return this.threadCache;const out=[];for(const seam of this.seams){const stations=this.stations(seam,s),cache=new Map(),frame=u=>{const key=Math.round(u*100000);if(!cache.has(key))cache.set(key,this.frame(seam,u,s));return cache.get(key);};for(const p of seatedSaddle(stations,frame,s.threadDiameter))out.push({...p,id:seam.id,a:seam.a,b:seam.b,stations,count:stations.length,maxBaseResidualMm:Math.max(...stations.map(h=>h.gap))});}return this.threadCache=out;}
 outsoleGeometry(s=this.state||defaultState()){return this.finishReady&&this.fittedSole?this.fittedSole.clone():super.outsoleGeometry(s);}
 report(s,parts){const r=super.report(s,parts);return {...r,version:VERSION,finish:{roundedCuts:this.cutReview,stitches:this.stitchReview,templates:this.templateReview,holeTargetMm:[.72,.44],holeCalibration:'Actual outer-offset surface at default thickness; nondefault thickness is not an aperture certification',quarterSeating:this.quarterSeating,sole:this.soleFinishReport,stitchPhysics:false,laceCodeUnchanged:true,geometryCacheHits:this.cacheHits||0},referenceMethod:r.referenceMethod+'; R07 derived rounded cuts, metric needle slits, skin-seated static saddle routes and native cup-rim seating.'};}
}
