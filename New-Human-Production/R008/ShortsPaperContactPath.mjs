// Fixed unsigned-distance1-Lipschitz certificates for individual linear
// barycentric sample paths. Not surface/triangle CCD, solid-union or motion QA.
const MODE='fixed-unsigned-surface-obstacle-with-independent-closed-bare-membership';
export function certifySourceSamplePaths(startPositions,endPositions,samples,{startDistancesM,endDistancesM,query,clearanceM=.004,geometryRevision,bareGeometryRevision,maximumQueries=4096,deadlineMs}={}){
 const started=performance.now(),proofs=[],midpointWitnesses=[];let queries=0,maximumDepthObserved=0;
 const finish=(status,reason=null,witness=null)=>({schema:'shorts-fixed-source-sample-path@1',status,reason,witness,samples:samples?.length??0,certifiedSamples:proofs.length,queries,maximumQueries,maximumDepth:16,maximumDepthObserved,clearanceM,geometryRevision,bareGeometryRevision,proofs,midpointWitnesses,elapsedMs:performance.now()-started,deadlineMs,endpointAuthority:'caller must supply current validated fixed-unsigned surface distances and outside-closed-bare endpoints at these exact positions/revisions; scalar endpoint arrays do not independently encode membership or geometry identity',fixedStaticGeometryAssumed:true,sampledPathsOnly:true,fullTriangleCCDValidated:false,wholeSurfaceContactValidated:false,solidUnionCertified:false,motionValidated:false});
 const hold=(reason,witness)=>finish('HOLD',reason,witness);
 if(clearanceM!==.004)return hold('original4mm clearance is frozen');
 if(!Array.isArray(startPositions)||!Array.isArray(endPositions)||startPositions.length!==endPositions.length||!startPositions.length||!startPositions.every(p=>(Array.isArray(p)||ArrayBuffer.isView(p))&&p.length===3&&Array.from(p).every(Number.isFinite))||!endPositions.every(p=>(Array.isArray(p)||ArrayBuffer.isView(p))&&p.length===3&&Array.from(p).every(Number.isFinite)))return hold('invalid finite nested path positions');
 if(!Array.isArray(samples)||!samples.length||typeof query!=='function'||!Number.isInteger(maximumQueries)||maximumQueries<0||maximumQueries>4096||!Number.isFinite(deadlineMs)||!Number.isInteger(geometryRevision)||geometryRevision<0||!Number.isInteger(bareGeometryRevision)||bareGeometryRevision<0)return hold('invalid bounded static query contract');
 if(!(Array.isArray(startDistancesM)||ArrayBuffer.isView(startDistancesM))||!(Array.isArray(endDistancesM)||ArrayBuffer.isView(endDistancesM))||startDistancesM.length!==samples.length||endDistancesM.length!==samples.length)return hold('endpoint distances must correspond to all actual samples');
 for(let sampleIndex=0;sampleIndex<samples.length;sampleIndex++){
  if(performance.now()>=deadlineMs)return hold('absolute wall budget exhausted; path unresolved, not proved infeasible',{sampleIndex});
  const sample=samples[sampleIndex];if(!sample||!Array.isArray(sample.indices)||!Array.isArray(sample.weights)||!sample.indices.length||sample.indices.length!==sample.weights.length||sample.indices.some(i=>!Number.isInteger(i)||i<0||i>=startPositions.length)||sample.weights.some(w=>!Number.isFinite(w)||w<0)||Math.abs(sample.weights.reduce((s,w)=>s+w,0)-1)>1e-10)return hold('invalid actual barycentric sample',{sampleIndex,sample});
  const point=p=>[0,1,2].map(k=>sample.indices.reduce((sum,id,j)=>sum+sample.weights[j]*p[id][k],0)),start=point(startPositions),end=point(endPositions),L=Math.hypot(...end.map((v,k)=>v-start[k])),d0=startDistancesM[sampleIndex],d1=endDistancesM[sampleIndex];
  if(![L,d0,d1].every(Number.isFinite)||d0<clearanceM||d1<clearanceM)return hold('endpoint clearance unresolved',{sampleIndex,start,end,d0,d1,L});
  if(L===0){proofs.push({sampleIndex,lengthM:0,kind:'zero-length path',minimumProvedClearanceM:Math.min(d0,d1),strictEndpointClearance:d0>clearanceM&&d1>clearanceM,certificates:[]});continue;}
  if(d0<=clearanceM||d1<=clearanceM)return hold('nonzero path requires strictly exterior endpoints',{sampleIndex,d0,d1,L});
  const stack=[{a:0,b:1,da:d0,db:d1,depth:0}],certificates=[];let minimumProvedClearanceM=Infinity;
  while(stack.length){
   if(performance.now()>=deadlineMs)return hold('absolute wall budget exhausted; path unresolved, not proved infeasible',{sampleIndex,remainingIntervals:stack.length});
   const interval=stack.pop(),lengthM=L*(interval.b-interval.a),surplus=(interval.da-clearanceM)+(interval.db-clearanceM)-lengthM;maximumDepthObserved=Math.max(maximumDepthObserved,interval.depth);
   if(surplus>0){const lowerBoundM=Math.min(interval.da,interval.db,(interval.da+interval.db-lengthM)/2);minimumProvedClearanceM=Math.min(minimumProvedClearanceM,lowerBoundM);certificates.push({t0:interval.a,t1:interval.b,d0:interval.da,d1:interval.db,pathLengthM:lengthM,coverageSurplusM:surplus,lowerBoundM});continue;}
   if(interval.depth>=16)return hold('maximum dyadic depth reached; path unresolved, not proved infeasible',{sampleIndex,interval,lengthM});
   if(queries>=maximumQueries)return hold('query budget exhausted; path unresolved, not proved infeasible',{sampleIndex,interval});
   const t=(interval.a+interval.b)/2,mid=start.map((v,k)=>v+t*(end[k]-v));let hit;queries++;
   try{hit=query(mid.slice());}catch(error){return hold('actual midpoint query threw',{sampleIndex,t,point:mid,message:error.message});}
   if(performance.now()>=deadlineMs)return hold('absolute wall budget exhausted after query; path unresolved, not proved infeasible',{sampleIndex,t,point:mid});
   if(!hit||hit.contactMode!==MODE||hit.geometryRevision!==geometryRevision||hit.bareGeometryRevision!==bareGeometryRevision||hit.signAmbiguous!==false||typeof hit.bareClosedInsideObserved!=='boolean'||!Number.isFinite(hit.signedDistanceM))return hold('actual midpoint authority, revision or ambiguity unresolved',{sampleIndex,t,point:mid,hit});
   const witness={sampleIndex,t,point:mid,distanceM:hit.signedDistanceM,geometryRevision:hit.geometryRevision,bareGeometryRevision:hit.bareGeometryRevision,contactMode:hit.contactMode,bareClosedInsideObserved:hit.bareClosedInsideObserved};midpointWitnesses.push(witness);
   if(hit.bareClosedInsideObserved||!(hit.signedDistanceM>clearanceM))return hold('actual midpoint violates strict clearance or lies inside closed bare',{...witness,query:hit});
   stack.push({a:t,b:interval.b,da:hit.signedDistanceM,db:interval.db,depth:interval.depth+1},{a:interval.a,b:t,da:interval.da,db:hit.signedDistanceM,depth:interval.depth+1});
  }
  proofs.push({sampleIndex,indices:sample.indices.slice(),weights:sample.weights.slice(),start,end,lengthM:L,kind:'dyadic endpoint-Lipschitz interval cover',minimumProvedClearanceM,strictEndpointClearance:true,certificates});
 }
 return finish('SAMPLED_PATH_CERTIFIED');
}
