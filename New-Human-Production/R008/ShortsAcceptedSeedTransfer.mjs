// Runtime reference directions only. No formed garment coordinates are stored
// here or used as a source rest metric. This is temporary authoring, not physics.
const dot=(a,b)=>a.reduce((s,x,k)=>s+x*b[k],0);
const read=(a,i,n)=>Array.from(a.slice(i*n,i*n+n));
const sub=(a,b)=>a.map((x,k)=>x-b[k]);
const finite=a=>a.every(Number.isFinite);
const sourceIdentity=d=>JSON.stringify({uv:Array.from(d.sourceUV),triangles:Array.from(d.triangles),masses:Array.from(d.masses),seams:d.seams,ranges:d.ranges,elastic:d.elasticEdges});
function sourceFrame(uv,xyz){
 const [a,b,c]=uv,[p,q,r]=xyz,du=sub(b,a),dv=sub(c,a),det=du[0]*dv[1]-dv[0]*du[1];
 if(Math.abs(det)<1e-14)throw Error('Accepted reference source triangle is degenerate');
 const ab=sub(q,p),ac=sub(r,p),u=ab.map((x,k)=>(x*dv[1]-ac[k]*du[1])/det),v=ab.map((x,k)=>(ac[k]*du[0]-x*dv[0])/det),
  A=dot(u,u),B=dot(u,v),D=dot(v,v),root=Math.sqrt(A*D-B*B),den=Math.sqrt(A+D+2*root);
 if(!(root>1e-10&&den>1e-10))throw Error('Accepted live tangent has a collapsed material direction');
 // Principal positive square root: sqrt(C)=(C+sqrt(det(C))I)/sqrt(tr(C)+2sqrt(det(C))).
 // Its inverse removes all old stretch while preserving the old 3D tangent.
 const aa=(A+root)/den,bb=B/den,dd=(D+root)/den,id=aa*dd-bb*bb,
  U=u.map((x,k)=>(dd*x-bb*v[k])/id),V=v.map((x,k)=>(aa*x-bb*u[k])/id),gram=[dot(U,U),dot(U,V),dot(V,V)];
 if(Math.max(Math.abs(gram[0]-1),Math.abs(gram[1]),Math.abs(gram[2]-1))>1e-8)throw Error('Reference polar tangent must be orthonormal');
 return {U,V,gram,oldMetric:[A,B,D]};
}
function quotient(count,seams){
 const parent=Array.from({length:count},(_,i)=>i),find=i=>parent[i]===i?i:(parent[i]=find(parent[i]));
 for(const s of seams)for(const p of s.pairs){if(!Number.isInteger(p.a)||!Number.isInteger(p.b)||p.a<0||p.b<0||p.a>=count||p.b>=count)throw Error('Actual source seam endpoint required');parent[find(p.b)]=find(p.a);}
 const groups=new Map();for(let i=0;i<count;i++){const r=find(i);if(!groups.has(r))groups.set(r,[]);groups.get(r).push(i);}
 const seamGroups=[...groups.values()],quotientMap=new Uint32Array(count);seamGroups.forEach((g,id)=>g.forEach(i=>quotientMap[i]=id));return {seamGroups,quotientMap};
}
export function createShortsAcceptedSeedTransfer(currentDraft,liveReference,options={}){
 const d=currentDraft,r=liveReference,count=d?.sourceUV?.length/2,identity=sourceIdentity(d);
 if(!Number.isInteger(count)||d.positions.length!==count*3||!d.masses.every(x=>Number.isFinite(x)&&x>0)||!finite(Array.from(d.sourceUV)))throw Error('Current independent source paper and positive mass required');
 if(r.coordinateFrame!=='actor-local-metres')throw Error('Live reference must explicitly use actor-local-metres, with subject scale already retained');
 if(!r.positions||!r.sourceUV||!r.ranges||r.positions.length/3!==r.sourceUV.length/2)throw Error('Live formed reference positions/sourceUV/ranges required; no stored fallback');
 const q=quotient(count,d.seams),N=q.seamGroups.length,edges=[],frames=[],qm=q.seamGroups.map(g=>g.reduce((s,i)=>s+d.masses[i],0)),totalMass=qm.reduce((s,x)=>s+x,0),centroidWeights=qm.map(m=>m/totalMass);
 for(const piece of d.pieces){const range=d.ranges.find(x=>x.pieceId===piece.id),old=r.ranges.find(x=>x.pieceId===piece.id);
  if(!range||!old||range.count!==old.count||range.count!==piece.materialCoordinates.length)throw Error('Exact piece-local vertex correspondence required: '+piece.id);
  for(const local of piece.triangles){
   const oldUV=local.map(i=>read(r.sourceUV,old.offset+i,2)),xyz=local.map(i=>read(r.positions,old.offset+i,3));
   if(!xyz.every(finite))throw Error('Finite actual reference coordinates required');
   const frame=sourceFrame(oldUV,xyz),uv=local.map(i=>read(d.sourceUV,range.offset+i,2));
   const area=Math.abs((uv[1][0]-uv[0][0])*(uv[2][1]-uv[0][1])-(uv[1][1]-uv[0][1])*(uv[2][0]-uv[0][0]))/2;
   if(!(area>1e-14))throw Error('Current source2D triangle is degenerate');
   for(const [a,b] of [[0,1],[1,2],[2,0]]){const duv=sub(uv[b],uv[a]),length2=dot(duv,duv),goal=frame.U.map((x,k)=>x*duv[0]+frame.V[k]*duv[1]);edges.push({a:q.quotientMap[range.offset+local[a]],b:q.quotientMap[range.offset+local[b]],weight:area/length2,goal,pieceId:piece.id,local:[local[a],local[b]]});}
   frames.push({pieceId:piece.id,local:local.slice(),polarGram:frame.gram,referenceMetric:frame.oldMetric});
  }
 }
 const degree=new Float64Array(N);for(const e of edges){degree[e.a]+=e.weight;degree[e.b]+=e.weight;}
 const meanDegree=degree.reduce((s,x)=>s+x,0)/N,waistY=options.waistY??d.receipt?.upperY,hemY=options.hemY??d.receipt?.hem?.y,center=d.receipt?.measurements?.waistCenter,
  centroid=options.centroid??[center?.[0],(waistY+hemY)/2,center?.[2]],guides=[];
 if(!Array.isArray(centroid)||centroid.length!==3||!finite(centroid))throw Error('Actual current body-based temporary centroid required');
 if(options.heightGuides!==false){
  if(!Number.isFinite(waistY)||!Number.isFinite(hemY)||!(waistY>hemY))throw Error('Actual current waist/hem heights required');
  const targets=new Map(),add=(id,y,role)=>{const k=q.quotientMap[id];if(targets.has(k)&&Math.abs(targets.get(k).target-y)>1e-10)throw Error('Conflicting source height guides');targets.set(k,{id:k,target:y,role,weight:meanDegree*.05});};
  for(const p of d.pieces){const off=d.ranges.find(x=>x.pieceId===p.id).offset;if(p.kind==='waistband')for(const i of p.boundaries.upper)add(off+i,waistY,'actual waistband upper');if(p.kind==='leg-panel')for(const i of p.boundaries.hem)add(off+i,hemY,'unchanged actual hem');}
  guides.push(...targets.values());
 }
 const gaugeWeight=meanDegree*N,maximumIterations=options.maxCGIterations??2000;
 if(!Number.isInteger(maximumIterations)||maximumIterations<1||maximumIterations>2000)throw Error('Linear authoring solve is bounded to 2000 CG iterations');
 const solution=Array.from({length:N},()=>[0,0,0]),linear=[];
 for(let axis=0;axis<3;axis++){
  const rhs=new Float64Array(N);for(const e of edges){rhs[e.a]-=e.weight*e.goal[axis];rhs[e.b]+=e.weight*e.goal[axis];}
  for(let i=0;i<N;i++)rhs[i]+=gaugeWeight*centroidWeights[i]*centroid[axis];if(axis===1)for(const g of guides)rhs[g.id]+=g.weight*g.target;
  const multiply=x=>{const out=new Float64Array(N);for(const e of edges){const v=e.weight*(x[e.b]-x[e.a]);out[e.a]-=v;out[e.b]+=v;}const c=dot(x,centroidWeights)*gaugeWeight;for(let i=0;i<N;i++)out[i]+=c*centroidWeights[i];if(axis===1)for(const g of guides)out[g.id]+=g.weight*x[g.id];return out;};
  const x=new Float64Array(N),residual=Float64Array.from(rhs),direction=Float64Array.from(rhs),initial=Math.hypot(...rhs);let rr=dot(residual,residual),iteration=0;
  for(;iteration<maximumIterations&&Math.sqrt(rr)>Math.max(1e-13,initial*1e-10);iteration++){
   const Ad=multiply(direction),den=dot(direction,Ad);if(!(den>0))throw Error('Positive connected source Laplacian required');const alpha=rr/den;
   for(let i=0;i<N;i++){x[i]+=alpha*direction[i];residual[i]-=alpha*Ad[i];}const next=dot(residual,residual),beta=next/rr;for(let i=0;i<N;i++)direction[i]=residual[i]+beta*direction[i];rr=next;
  }
  if(!finite(Array.from(x)))throw Error('Nonfinite connected seed');for(let i=0;i<N;i++)solution[i][axis]=x[i];linear.push({axis,iterations:iteration,relativeResidual:Math.sqrt(rr)/Math.max(1e-30,initial),converged:Math.sqrt(rr)<=Math.max(1e-13,initial*1e-10)});
 }
 const positions=new Float64Array(count*3);for(let i=0;i<count;i++)positions.set(solution[q.quotientMap[i]],i*3);
 const edgeResiduals=edges.map(e=>Math.hypot(...sub(sub(solution[e.b],solution[e.a]),e.goal))),heightResiduals=guides.map(g=>({...g,errorM:solution[g.id][1]-g.target}));
 if(sourceIdentity(d)!==identity)throw Error('Accepted direction transfer changed independent source rest/mass');
 const receipt={version:'accepted-live-fold-direction-transfer@1',authority:'runtime original accepted LIVE positions for polar tangent directions only; current independent source2D lengths authoritative',referenceAuthority:r.authority??null,referenceSourceHash:r.sourceHash??null,coordinateFrame:r.coordinateFrame,counts:{particles:count,pieces:d.pieces.length,triangles:frames.length,actualSeams:d.seams.length,actualDofs:N},referenceTrianglesRequired:false,correspondence:'pieceId and original local vertex index; current triangle samples old sourceUV even when old diagonal differs',frames,linear,edgeGoalMaximumResidualM:Math.max(...edgeResiduals),edgeGoalRmsResidualM:Math.hypot(...edgeResiduals)/Math.sqrt(edgeResiduals.length),heightGuides:heightResiduals,centroid,sourceUVRestMassElasticUnchanged:true,allNativeDofsIntendedFree:true,physicalLocksAdded:0,bodyContactEnabled:false,bodyFitValidated:false,selfContactValidated:false,motionValidated:false,productionReady:false,status:'TEMPORARY_CONNECTED_SEED_REQUIRES_INDEPENDENT_WHOLE_METRIC_AND_CONTACT_CHECK'};
 return {...d,positions,seamGroups:q.seamGroups,quotientMap:q.quotientMap,activeSeamIDs:d.seams.map(s=>s.id),acceptedSeedReceipt:receipt,receipt:{...d.receipt,acceptedSeedTransfer:receipt,placement:'temporary connected least-squares source edges from accepted LIVE polar fold directions; not a wearing acceptance'}};
}
