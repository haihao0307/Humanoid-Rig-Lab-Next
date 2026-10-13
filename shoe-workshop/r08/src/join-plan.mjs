/** R08 seam ownership is a construction property, never a render-order trick.
 * Distances are research settings in formed mm, not a factory specification.
 */
import {inside} from '../../r03b/src/surface.mjs';
import {add,sub,mul,mix,dist,unit,cross,clamp,resample,inward,SeamField,nearestOnSegment,stats} from '../../r07/src/geometry.mjs';
export const JOIN_RULES=Object.freeze({pitchMm:2.8,edgeInsetMm:2.0,skiveWidthMm:4.5,skiveEdgeMm:.32,clearanceMm:.045,needleMm:[.72,.44],threadDiameterMm:.26,stitchType:'301-style continuous needle/bobbin lockstitch geometry',underlayReferenceMm:8,underlayReferenceIsUniversal:false,physics:false});
export const LAYER_ORDER=[28,22,23,27,24,25,21,20];
const defaultThickness={22:2,23:2,28:2,24:1.2,25:1.2,27:1.2,21:1.2,20:1.2,19:2.5,29:1.2};
const outerAt=(m,id,q)=>{const f=m.domains[id].at(q);return add(f.p,mul(f.n,m.offsets(defaultThickness)[id]+m.cutThickness(id,f.p,defaultThickness[id])));};
const allowed=(d,q)=>q&&inside(q,d.loop)&&!d.sourceHoles.some(h=>inside(q,h));
function lowerPoint(m,a,b,q){const A=m.domains[a],B=m.domains[b];if(A.atlas&&A.atlas===B.atlas)return q.slice();return B.fromWorld?.(A.at(q).p)||null;}
function covered(m,a,q){
 const children={22:[24,21],23:[25,21],28:[27,22,23],24:[21],25:[21],21:[20]};const A=m.domains[a],p=A.at(q).p;
 for(const id of children[a]||[]){const D=m.domains[id];let v;if(D.atlas&&D.atlas===A.atlas)v=q;else if(D.atlas)v=D.fromWorld(p);else{try{v=m.inverse(id,p);if(v)v=D.fromRest(v);}catch{v=null;}}if(allowed(D,v)&&dist(D.at(v).p,p)<.45)return id;}return null;
}
function split(points,valid,closed){const runs=[[]];let rejected=0;for(const q of points){if(valid(q))runs.at(-1).push(q);else{rejected++;if(runs.at(-1).length)runs.push([]);}}if(closed&&runs.length>1&&runs[0].length&&runs.at(-1).length){runs[0]=[...runs.at(-1),...runs[0]];runs.pop();}return{runs:runs.filter(r=>r.length>2),rejected,closed:closed&&!rejected};}
export function compileJoins(m,old){
 m.buildEdgeFields();for(const [id,oldField]of Object.entries(m.edgeFields)){const field=new SeamField();field.cell=5;for(const e of oldField.segments)field.put(e.a,e.b);m.edgeFields[id]=field;}m.seams=[];m.holes=Object.fromEntries(Object.keys(m.holes).map(k=>[k,[]]));
 for(const id of Object.keys(m.domains)){m.needleSpecs[id]=[];m.fields[id]=new SeamField();}
 const report={rules:JOIN_RULES,rows:[],rejectedCovered:0,rejectedUnsupported:0,excludedNonJoinBoundary:0};
 const addRow=(id,a,b,raw,closed,filter=()=>true)=>{
  const A=m.domains[a],B=m.domains[b],dense=resample(raw,q=>outerAt(m,a,q),.35,closed);
  const valid=q=>{const p=A.at(q).p,v=lowerPoint(m,a,b,q);if(!filter(q,p)){report.excludedNonJoinBoundary++;return false;}if(covered(m,a,q)){report.rejectedCovered++;return false;}if(!allowed(A,q)||!allowed(B,v)||dist(A.at(q).p,B.at(v).p)>.35){report.rejectedUnsupported++;return false;}return true;};
  const chunks=split(dense,valid,closed);let runNumber=0;
  for(let run of chunks.runs){
   if(!chunks.closed&&run.length>6)run=run.slice(2,-2);let qs=resample(run,q=>outerAt(m,a,q),JOIN_RULES.pitchMm,chunks.closed);if(qs.length<3)continue;const rows=[];
   for(let i=0;i<qs.length;i++){
    const q=qs[i],v=lowerPoint(m,a,b,q);if(!valid(q)||!v)continue;
    const tangent=unit(sub(A.at(qs[Math.min(qs.length-1,i+1)]).p,A.at(qs[Math.max(0,i-1)]).p));
    const h=m.prepareHole(a,q,tangent),h2=m.prepareHole(b,v,tangent);if(!h||!h2)continue;
    if(rows.length&&dist(outerAt(m,a,q),outerAt(m,a,rows.at(-1).q))<2.05)continue;
    if(rows.some(r=>dist(r.h.p,h.p)<1.1))continue;
    if(m.needleSpecs[a].some(e=>dist(e.p,h.p)<1.0)||m.needleSpecs[b].some(e=>dist(e.p,h2.p)<1.0))continue;
    const transit=[];let bad=false;
    for(const id of a===21?[24,25]:[]){const D=m.domains[id],w=D.fromWorld(A.at(q).p);if(!allowed(D,w)||dist(D.at(w).p,A.at(q).p)>.4)continue;const hole=m.prepareHole(id,w,tangent);if(!hole||m.needleSpecs[id].some(e=>dist(e.p,hole.p)<1.0)){bad=true;break;}transit.push({id,q:w,hole});}
    if(bad)continue;rows.push({q,v,h,h2,transit});
   }
   let row=[];const flush=()=>{
    if(row.length>=3){const name=id+(runNumber++?'-run-'+runNumber:'');
     m.seams.push({id:name,a,b,qa:row.map(r=>r.q),qb:row.map(r=>r.v),pairs:row.map(r=>({a:r.h.rest,b:r.h2.rest})),description:'Single owned lapped joint, one needle row, 301-style needle/bobbin route',status:'STATIC_LOCKSTITCH_NOT_TENSION_SOLVED',geometricOnly:true,closed:false,transit:row.map(r=>r.transit)});
     for(const r of row){m.needleSpecs[a].push(r.h);m.holes[a].push(r.h.rest);m.needleSpecs[b].push(r.h2);m.holes[b].push(r.h2.rest);for(const e of r.transit){m.needleSpecs[e.id].push(e.hole);m.holes[e.id].push(e.hole.rest);}}
     const lengths=row.slice(1).map((r,i)=>dist(r.h.p,row[i].h.p));report.rows.push({id:name,top:a,underlay:b,rows:1,holes:row.length,pitchMm:stats(lengths),edgeInsetMm:JOIN_RULES.edgeInsetMm,transitPunctures:row.reduce((n,r)=>n+r.transit.length,0),construction:'lapped/skived; lower face remains a separate positive-thickness shell'});
    }row=[];
   };for(const r of rows){if(row.length&&dist(row.at(-1).h.p,r.h.p)>JOIN_RULES.pitchMm*1.55)flush();row.push(r);}flush();
  }
 };
 for(const [a,b]of [[24,22],[25,23],[27,28]]){const D=m.domains[a],curve=inward(D.loop,q=>D.at(q).p,JOIN_RULES.edgeInsetMm);addRow('patch-'+a,a,b,curve,true,(_,p)=>a===27?p[1]>40:p[1]<91);}
 for(const a of [22,23]){const D=m.domains[a];addRow('quarter-vamp-'+a,a,28,inward(D.loop,q=>D.at(q).p,JOIN_RULES.edgeInsetMm),true,(_,p)=>p[2]>-43&&p[2]<45&&p[1]<76&&p[1]>35);}
 for(const s of old.filter(s=>s.id.startsWith('back-binding')||s.id==='binding-turn')){
  const A=m.domains[s.a],B=m.domains[s.b];if(s.id==='binding-turn'){
   const rows=s.pairs.filter(p=>allowed(A,A.fromRest(p.a))&&allowed(B,B.fromRest(p.b)));
   if(rows.length>=3){const qa=rows.map(p=>A.fromRest(p.a)),qb=rows.map(p=>B.fromRest(p.b)),out=[];for(let i=0;i<qa.length;i++){const t=unit(sub(A.at(qa[Math.min(i+1,qa.length-1)]).p,A.at(qa[Math.max(0,i-1)]).p)),h=m.prepareHole(s.a,qa[i],t),h2=m.prepareHole(s.b,qb[i],t);if(h&&h2)out.push({q:qa[i],v:qb[i],h,h2});}if(out.length>=3){m.seams.push({...s,qa:out.map(r=>r.q),qb:out.map(r=>r.v),pairs:out.map(r=>({a:r.h.rest,b:r.h2.rest})),buried:true});for(const r of out){m.needleSpecs[s.a].push(r.h);m.holes[s.a].push(r.h.rest);m.needleSpecs[s.b].push(r.h2);m.holes[s.b].push(r.h2.rest);}}}
  }else addRow(s.id,s.a,s.b,s.pairs.map(p=>A.fromRest(p.a)),false,(_,p)=>p[1]>38);
 }
 for(const s of m.seams)for(const [id,qs]of [[s.a,s.qa],[s.b,s.qb]]){const D=m.domains[id],dense=resample(qs,q=>D.at(q).p,.5,false);for(let i=1;i<dense.length;i++)m.fields[id].put(D.at(dense[i-1]).p,D.at(dense[i]).p);}
 for(const [id,hs]of Object.entries(m.needleSpecs))for(const h of hs)m.fields[id].put(h.p,h.p,true);
 m.stitchReview={method:'R08 explicit lapped-joint ownership and one 301-style row; pre-punch coverage partition',...report};m.joinPlan=report;
}
