// Authored cloth-only CCD. Positions and thickness are metres; t is [0, 1].
// Method: four moving points' cubic coplanarity, roots split at derivative
// extrema, then finite primitive distance/domain checks. See Bridson et al.
// (2002), section 6: https://www.uni-weimar.de/~caw/papers/p594-bridson.pdf
// Floating-point cubic CCD is NOT an exact-arithmetic certificate (Brochu et
// al. 2012, https://www.cs.ubc.ca/~rbridson/docs/brochu-siggraph2012-ccd.pdf).
// Near-coplanar motion uses distance/speed conservative advancement instead;
// exhausted/degenerate cases remain uncertain and cannot count as a pass.
const SHORTS_CONTINUOUS_CONTACT_VERSION='cloth-swept-contact-1';
const sccSub=(a,b)=>a.map((v,k)=>v-b[k]);
const sccDot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0);
const sccCross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const sccMix=(a,b,t)=>a.map((v,k)=>v+(b[k]-v)*t);
const sccNorm=a=>Math.hypot(...a);
const sccClamp=x=>Math.max(0,Math.min(1,x));
const sccTriple=(a,b,c)=>sccDot(sccCross(a,b),c);
function sccClosestSegments(a,b,c,d){
 const u=sccSub(b,a),v=sccSub(d,c),w=sccSub(a,c),aa=sccDot(u,u),bb=sccDot(u,v),cc=sccDot(v,v),dd=sccDot(u,w),ee=sccDot(v,w);let s=0,t=0;
 if(aa<=1e-28&&cc<=1e-28){}else if(aa<=1e-28)t=sccClamp(ee/cc);else if(cc<=1e-28)s=sccClamp(-dd/aa);else{const den=aa*cc-bb*bb;s=den>1e-14*aa*cc?sccClamp((bb*ee-cc*dd)/den):0;t=(bb*s+ee)/cc;if(t<0){t=0;s=sccClamp(-dd/aa);}else if(t>1){t=1;s=sccClamp((bb-dd)/aa);}}
 const pa=sccMix(a,b,s),pb=sccMix(c,d,t);return {s,t,a:pa,b:pb,distance:sccNorm(sccSub(pa,pb))};
}
function sccClosestTriangle(p,a,b,c){
 const ab=sccSub(b,a),ac=sccSub(c,a),n=sccCross(ab,ac),nn=sccDot(n,n),den=sccDot(ab,ab)*sccDot(ac,ac);
 if(nn>Math.max(1e-30,den*1e-14)){const ap=sccSub(p,a),d00=sccDot(ab,ab),d01=sccDot(ab,ac),d11=sccDot(ac,ac),d20=sccDot(ap,ab),d21=sccDot(ap,ac),v=(d11*d20-d01*d21)/nn,w=(d00*d21-d01*d20)/nn,u=1-v-w;if(u>=0&&v>=0&&w>=0){const q=a.map((x,k)=>u*x+v*b[k]+w*c[k]);return {point:q,barycentric:[u,v,w],distance:sccNorm(sccSub(p,q)),degenerate:false};}}
 let best=null;const points=[a,b,c];for(let i=0;i<3;i++){const edge=sccClosestSegments(p,p,points[i],points[(i+1)%3]),weights=[0,0,0];weights[i]=1-edge.t;weights[(i+1)%3]=edge.t;if(!best||edge.distance<best.distance)best={point:edge.b,barycentric:weights,distance:edge.distance,degenerate:nn<=Math.max(1e-30,den*1e-14)};}return best;
}
function sccCoplanarity(previous,current){
 const a=sccSub(previous[1],previous[0]),b=sccSub(previous[2],previous[0]),c=sccSub(previous[3],previous[0]),da=sccSub(sccSub(current[1],current[0]),a),db=sccSub(sccSub(current[2],current[0]),b),dc=sccSub(sccSub(current[3],current[0]),c),scale=Math.max(...[a,b,c,da,db,dc].map(sccNorm),1e-15),v=[a,b,c,da,db,dc].map(p=>p.map(x=>x/scale)),[x,y,z,dx,dy,dz]=v;
 return [sccTriple(x,y,z),sccTriple(dx,y,z)+sccTriple(x,dy,z)+sccTriple(x,y,dz),sccTriple(dx,dy,z)+sccTriple(dx,y,dz)+sccTriple(x,dy,dz),sccTriple(dx,dy,dz)];
}
function sccCubicRoots(coefficients){
 // Cubic coefficients use relative positions scaled to unit magnitude. Below
 // 1e-12, cancellation/constant coplanarity uses the conservative fallback.
 // Monotone-interval bisection stops at 1e-12 of the substep, at most 60 cuts.
 const magnitude=Math.max(...coefficients.map(Math.abs));if(magnitude<1e-12)return {coplanar:true,roots:[]};
 const c=coefficients.map(v=>v/magnitude),evaluate=t=>((c[3]*t+c[2])*t+c[1])*t+c[0],cuts=[0,1],A=3*c[3],B=2*c[2],C=c[1];
 if(Math.abs(A)<1e-14){if(Math.abs(B)>1e-14)cuts.push(-C/B);}else{const discriminant=B*B-4*A*C;if(discriminant>=0){const q=-.5*(B+Math.sign(B||1)*Math.sqrt(discriminant));if(q)cuts.push(q/A,C/q);else cuts.push(-B/(2*A));}}
 const sorted=[...new Set(cuts.filter(t=>t>=0&&t<=1))].sort((a,b)=>a-b),roots=[];
 const append=t=>{if(!roots.some(x=>Math.abs(x-t)<1e-9))roots.push(t);};
 for(const t of sorted)if(Math.abs(evaluate(t))<=1e-12)append(t);
 for(let i=0;i<sorted.length-1;i++){let lo=sorted[i],hi=sorted[i+1],fl=evaluate(lo),fh=evaluate(hi);if(fl*fh>=0)continue;for(let j=0;j<60&&hi-lo>1e-12;j++){const mid=(lo+hi)/2,fm=evaluate(mid);if(fl*fm<=0){hi=mid;fh=fm;}else{lo=mid;fl=fm;}}append((lo+hi)/2);}
 return {coplanar:false,roots:roots.sort((a,b)=>a-b)};
}
function sccConservativeTime(query,speed,tolerance){
 // distance is Lipschitz with this endpoint-relative speed bound. Advance at
 // 90% of the distance bound; only 96 iterations are allowed. Approaching to
 // twice the metre tolerance is contact, not an exact geometric certificate.
 let time=0,last=0;for(let i=0;i<96;i++){const hit=query(time);if(hit.distance<=tolerance*2)return {time,hit,previousTime:last};if(speed<=1e-15)return null;const advance=(hit.distance-tolerance)*.9/speed;if(time+advance>1)return null;if(advance<1e-12)return {uncertain:true,reason:'coplanar_advancement_resolution'};last=time;time+=advance;}
 return {uncertain:true,reason:'coplanar_advancement_budget'};
}
function sccEvent(previous,current,kind,tolerance=1e-8){
 if(!Number.isFinite(tolerance)||tolerance<=0)throw Error('CCD distance tolerance must be a positive number of metres');
 if(previous.concat(current).some(p=>p.length!==3||p.some(v=>!Number.isFinite(v))))throw Error('CCD requires finite original endpoint positions');
 const at=t=>previous.map((p,i)=>sccMix(p,current[i],t)),velocity=previous.map((p,i)=>sccSub(current[i],p));
 const query=t=>{const p=at(t);if(kind==='vertex-face'){const hit=sccClosestTriangle(p[0],...p.slice(1));return {...hit,weights:[1,...hit.barycentric.map(x=>-x)]};}const hit=sccClosestSegments(...p);return {...hit,weights:[1-hit.s,hit.s,-(1-hit.t),-hit.t]};};
 const polynomial=sccCubicRoots(sccCoplanarity(previous,current));let roots=polynomial.roots,conservative=null;
 if(polynomial.coplanar){const relative=[];if(kind==='vertex-face'){for(let i=1;i<4;i++)relative.push(sccNorm(sccSub(velocity[0],velocity[i])));}else for(let i=0;i<2;i++)for(let j=2;j<4;j++)relative.push(sccNorm(sccSub(velocity[i],velocity[j])));conservative=sccConservativeTime(query,Math.max(...relative),tolerance);if(!conservative)return null;if(conservative.uncertain)return {...conservative,kind};roots=[conservative.time];}
 for(const toi of roots){const hit=query(toi);if(hit.distance>tolerance*(polynomial.coplanar?2:1))continue;if(toi<=1e-10)return {uncertain:true,reason:'initial_coincident_contact',kind,toi};const points=at(toi);let normal=kind==='vertex-face'?sccCross(sccSub(points[2],points[1]),sccSub(points[3],points[1])):sccCross(sccSub(points[1],points[0]),sccSub(points[3],points[2]));
  if(polynomial.coplanar||sccNorm(normal)<1e-14){const earlier=at(Math.max(0,toi-1e-5));normal=[0,1,2].map(k=>hit.weights.reduce((sum,w,i)=>sum+w*earlier[i][k],0));}
  const length=sccNorm(normal);if(!(length>1e-14)||hit.degenerate)return {uncertain:true,reason:'degenerate_impact_normal',kind,toi};normal=normal.map(v=>v/length);const relativeVelocity=[0,1,2].map(k=>hit.weights.reduce((sum,w,i)=>sum+w*velocity[i][k],0));if(sccDot(relativeVelocity,normal)>0)normal=normal.map(v=>-v);
  return {hit:true,kind,toi,weights:hit.weights,normal,barycentric:hit.barycentric,s:hit.s,t:hit.t,method:polynomial.coplanar?'conservative_coplanar_distance':'cubic_coplanarity'};
 }return null;
}
function shortsSweptVertexFace(previousPoint,currentPoint,previousTriangle,currentTriangle,options={}){return sccEvent([previousPoint,...previousTriangle],[currentPoint,...currentTriangle],'vertex-face',options.tolerance??1e-8);}
function shortsSweptEdgeEdge(previousA,currentA,previousB,currentB,options={}){return sccEvent([...previousA,...previousB],[...currentA,...currentB],'edge-edge',options.tolerance??1e-8);}
function createShortsContinuousContact(particles,triangles,edges,options={}){
 const thickness=options.thickness??.0025,cellSize=options.cellSize??.04,maxCandidates=options.maxCandidates??12000,maxCells=options.maxCellsPerPrimitive??2048;
 if(!Number.isFinite(thickness)||thickness<0||!Number.isFinite(cellSize)||cellSize<=0||!Number.isInteger(maxCandidates)||maxCandidates<1||!Number.isInteger(maxCells)||maxCells<1)throw Error('Invalid cloth CCD options');
 if(options.dofs!=null&&typeof options.dofs.project!=='function')throw Error('Cloth CCD stitch DOFs require a project method');
 const maxPasses=options.maxPasses??8;if(!Number.isInteger(maxPasses)||maxPasses<1||maxPasses>64)throw Error('Invalid cloth CCD pass budget');
 let state,contacts=[],activeSeamMates=new Map(),lastSettings={};const reset=()=>({enabled:true,method:'swept_aabb_cubic_vertex_face_edge_edge',candidateCount:0,vertexFaceCandidateCount:0,edgeEdgeCandidateCount:0,detectedCrossingCount:0,projectedCount:0,uncertainCount:0,uncertaintyReasons:{},unresolvedCount:0,maxPenetrationM:0,budgetExceeded:false,continuousCollisionGuaranteed:false});state=reset();
 const bounds=ids=>({min:[0,1,2].map(k=>Math.min(...ids.flatMap(i=>[particles[i].previous[k],particles[i].pos[k]]))-thickness),max:[0,1,2].map(k=>Math.max(...ids.flatMap(i=>[particles[i].previous[k],particles[i].pos[k]]))+thickness)}),overlap=(a,b)=>a.min.every((v,k)=>v<=b.max[k]&&a.max[k]>=b.min[k]);
 const cells=b=>{const lo=b.min.map(x=>Math.floor(x/cellSize)),hi=b.max.map(x=>Math.floor(x/cellSize));if(hi.reduce((n,v,k)=>n*(v-lo[k]+1),1)>maxCells){state.budgetExceeded=true;return [];}const result=[];for(let x=lo[0];x<=hi[0];x++)for(let y=lo[1];y<=hi[1];y++)for(let z=lo[2];z<=hi[2];z++)result.push(x+','+y+','+z);return result;};
 const record=(ids,event)=>{if(!event)return;if(event.uncertain){state.uncertainCount++;state.uncertaintyReasons[event.reason]=(state.uncertaintyReasons[event.reason]||0)+1;return;}contacts.push({...event,ids,clearance:ids.some((a,i)=>ids.some((b,j)=>i!==j&&activeSeamMates.get(a)?.has(b)&&sccNorm(sccSub(particles[a].pos,particles[b].pos))<=2*thickness))?Math.min(thickness,1e-6):thickness});state.detectedCrossingCount++;};
 const gap=c=>sccDot([0,1,2].map(k=>c.weights.reduce((sum,w,i)=>sum+w*particles[c.ids[i]].pos[k],0)),c.normal);
 const report=()=>{let unresolved=0,maxPenetration=0,remainingCrossingCount=0,remainingUncertainCount=0;for(const c of contacts){const depth=c.clearance-gap(c),event=sccEvent(c.ids.map(i=>particles[i].previous),c.ids.map(i=>particles[i].pos),c.kind);if(event?.hit)remainingCrossingCount++;if(event?.uncertain)remainingUncertainCount++;if(depth>1e-7||event){unresolved++;maxPenetration=Math.max(maxPenetration,depth);}}return {...state,unresolvedCount:unresolved+state.uncertainCount+(state.budgetExceeded?1:0),remainingCrossingCount,remainingUncertainCount,maxPenetrationM:maxPenetration};};
 const pass=({seamMates=new Map(),neighbours=[]}={},project=true)=>{
  // A nearby unfinished thread is not yet a shared cloth vertex. Exempting
  // whole incident edges here allowed them to cross before closure. Only an
  // actual shared positional DOF is topological adjacency. At an unfinished
  // seam only a one-micrometre numerical separation remains; crossings
  // still collide, while a completed needle may close within its tolerance.
  activeSeamMates=seamMates;
  state=reset();contacts=[];const local=(a,b)=>a===b||options.dofs?.same?.(a,b),candidate=kind=>{if(state.candidateCount>=maxCandidates){state.budgetExceeded=true;return false;}state.candidateCount++;state[kind==='vf'?'vertexFaceCandidateCount':'edgeEdgeCandidateCount']++;return true;};
  const tb=triangles.map(t=>bounds(t.indices)),grid=new Map();for(let ti=0;ti<triangles.length;ti++)for(const key of cells(tb[ti])){if(!grid.has(key))grid.set(key,[]);grid.get(key).push(ti);}
  vf:for(let i=0;i<particles.length;i++){const b=bounds([i]),seen=new Set();for(const key of cells(b))for(const ti of grid.get(key)||[]){if(seen.has(ti))continue;seen.add(ti);const ids=triangles[ti].indices;if(ids.some(j=>local(i,j))||!overlap(b,tb[ti]))continue;if(!candidate('vf'))break vf;record([i,...ids],shortsSweptVertexFace(particles[i].previous,particles[i].pos,ids.map(j=>particles[j].previous),ids.map(j=>particles[j].pos)));}}
  const eb=edges.map(e=>bounds([e.a,e.b])),eg=new Map(),seen=new Set();for(let ei=0;ei<edges.length;ei++)for(const key of cells(eb[ei])){if(!eg.has(key))eg.set(key,[]);eg.get(key).push(ei);}
  ee:for(const list of eg.values())for(let a=0;a<list.length;a++)for(let b=a+1;b<list.length;b++){const ia=list[a],ib=list[b],key=ia<ib?ia+':'+ib:ib+':'+ia;if(seen.has(key))continue;seen.add(key);const ea=edges[ia],e=edges[ib],ids=[ea.a,ea.b,e.a,e.b];if(ids.slice(0,2).some(i=>ids.slice(2).some(j=>local(i,j)))||!overlap(eb[ia],eb[ib]))continue;if(!candidate('ee'))break ee;record(ids,shortsSweptEdgeEdge(ids.slice(0,2).map(i=>particles[i].previous),ids.slice(0,2).map(i=>particles[i].pos),ids.slice(2).map(i=>particles[i].previous),ids.slice(2).map(i=>particles[i].pos)));}
  contacts.sort((a,b)=>a.toi-b.toi);if(project)for(let sweep=0;sweep<2;sweep++)for(const c of contacts){
   if(options.dofs){
    const depth=c.clearance-gap(c);if(depth<=1e-7)continue;
    // Detection retains every original index and its own substep trajectory.
    // Only the correction is delegated: aggregate gradients of actually sewn
    // positional DOFs before the common projector uses their total mass.
    const gradients=c.weights.map(weight=>c.normal.map(v=>weight*v));
    const result=options.dofs.project(c.ids,gradients,-depth,{alpha:0,lambda:0,tensionOnly:false});
    if(result.applied)state.projectedCount++;
    continue;
   }
   const depth=c.clearance-gap(c),den=c.ids.reduce((sum,id,i)=>sum+particles[id].invMass*c.weights[i]**2,0);if(depth<=1e-7||den<=0)continue;for(let i=0;i<c.ids.length;i++){const p=particles[c.ids[i]],scale=p.invMass*c.weights[i]*depth/den;for(let k=0;k<3;k++)p.pos[k]+=scale*c.normal[k];}state.projectedCount++;
  }
  state=report();return {...state};
 };
 // A correction can create a new contact outside the previous event list.
 // Rebuild the swept broadphase after each projection pass, including after
 // the final bounded pass. Never equate clearing old witnesses with clearance
 // of the corrected cloth. Previous positions remain the substep start.
 return {solve(settings={}){
  lastSettings=settings;let totalDetected=0,totalProjected=0,passes=0,uncertain=0,budget=false,reasons={},motionLimitPasses=0,motionLimitedFraction=1;
  const accumulate=r=>{totalDetected+=r.detectedCrossingCount;totalProjected+=r.projectedCount;uncertain=Math.max(uncertain,r.uncertainCount);budget||=r.budgetExceeded;for(const [key,n] of Object.entries(r.uncertaintyReasons))reasons[key]=Math.max(reasons[key]||0,n);};
  let r;for(;passes<maxPasses;){r=pass(settings,true);passes++;accumulate(r);if(!r.projectedCount)break;}
  if(r.projectedCount){r=pass(settings,false);accumulate(r);}
  // Coupled contacts need not converge in the projection budget. Do not
  // advance through a known impact and forget it at the next substep. Limit
  // the proposed motion to before its earliest remaining impact, then rebuild
  // all candidates. This conservative fallback changes neither rest data nor
  // previous trajectories, and preserves completed stitch equivalence.
  if(options.motionLimit&&(!options.dofs||typeof options.dofs.limitStep==='function'))while(r.remainingCrossingCount>0&&!r.uncertainCount&&!r.budgetExceeded&&motionLimitPasses<4){
   const fraction=Math.max(0,Math.min(.99,.9*Math.min(...contacts.map(c=>c.toi))));
   if(options.dofs)options.dofs.limitStep(fraction);else for(const p of particles)if(p.invMass)for(let k=0;k<3;k++)p.pos[k]=p.previous[k]+fraction*(p.pos[k]-p.previous[k]);
   motionLimitedFraction*=fraction;motionLimitPasses++;r=pass(settings,false);accumulate(r);
  }
  state={...r,motionLimitPasses,motionLimitedFraction,detectedCrossingCount:totalDetected,projectedCount:totalProjected,projectionPasses:passes,maximumProjectionPasses:maxPasses,remainingCrossingCount:r.remainingCrossingCount,uncertainCount:uncertain,uncertaintyReasons:reasons,budgetExceeded:budget,unresolvedCount:Math.max(r.unresolvedCount,r.remainingCrossingCount+uncertain+(budget?1:0)),postProjectionBroadphaseVerified:true};
  return {...state};
 },report(){
  // A body/material correction may run after solve. Recheck the current
  // candidate set without moving particles or altering the last solve stats.
  const savedState=state,savedContacts=contacts,savedMates=activeSeamMates;
  const fresh=pass(lastSettings,false),staticState=sccCurrentTriangleCrossings(particles,triangles,maxCandidates);
  state=savedState;contacts=savedContacts;activeSeamMates=savedMates;
  const uncertain=Math.max(savedState.uncertainCount,fresh.uncertainCount),budget=savedState.budgetExceeded||fresh.budgetExceeded||staticState.budgetExceeded;
  return {...savedState,remainingCrossingCount:fresh.remainingCrossingCount,remainingUncertainCount:fresh.remainingUncertainCount,currentTriangleCrossingCount:staticState.crossingCount,currentTriangleCandidateCount:staticState.candidateCount,uncertainCount:uncertain,uncertaintyReasons:{...savedState.uncertaintyReasons,...fresh.uncertaintyReasons},budgetExceeded:budget,unresolvedCount:Math.max(fresh.unresolvedCount,fresh.remainingCrossingCount+staticState.crossingCount+uncertain+(budget?1:0)),maxPenetrationM:fresh.maxPenetrationM,currentGeometryRechecked:true};
 }};
}

// Independent discrete witnesses catch intersections already present at the
// substep start. Swept event absence alone cannot certify a current surface.
// Strict interiors only: coplanar overlap and boundary-only contact remain
// outside this audit and must never be described as a full certificate.
function sccCurrentTriangleCrossings(particles,triangles,maxCandidates){
 const faces=triangles.map(t=>{const ps=t.indices.map(i=>particles[i].pos);return {ids:t.indices,ps,min:[0,1,2].map(k=>Math.min(...ps.map(p=>p[k]))),max:[0,1,2].map(k=>Math.max(...ps.map(p=>p[k])))};});
 const segment=(a,b,ps)=>{const e1=sccSub(ps[1],ps[0]),e2=sccSub(ps[2],ps[0]),d=sccSub(b,a),p=sccCross(d,e2),det=sccDot(e1,p);if(Math.abs(det)<1e-14)return false;const q0=sccSub(a,ps[0]),u=sccDot(q0,p)/det,q=sccCross(q0,e1),v=sccDot(d,q)/det,t=sccDot(e2,q)/det,eps=1e-8;return t>eps&&t<1-eps&&u>eps&&v>eps&&u+v<1-eps;};
 let candidateCount=0,crossingCount=0;
 for(let i=0;i<faces.length;i++)for(let j=i+1;j<faces.length;j++){const a=faces[i],b=faces[j];if(a.ids.some(k=>b.ids.includes(k))||a.min.some((v,k)=>v>b.max[k]+1e-10||a.max[k]<b.min[k]-1e-10))continue;if(++candidateCount>maxCandidates)return {candidateCount,crossingCount,budgetExceeded:true};if(a.ps.some((p,k)=>segment(p,a.ps[(k+1)%3],b.ps))||b.ps.some((p,k)=>segment(p,b.ps[(k+1)%3],a.ps)))crossingCount++;}
 return {candidateCount,crossingCount,budgetExceeded:false};
}
