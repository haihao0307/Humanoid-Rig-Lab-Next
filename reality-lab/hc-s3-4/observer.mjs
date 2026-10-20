/* Diagnostic observer only; never changes a particle, rest metric or solver setting.
   Runs in the existing worker. Detailed tracing is not a performance benchmark. */
export function createObserver(world, verbose=false){
 const report={schema:'kaopu/first-fault-trace@1',verbose,limit:1.45,operator:'>',events:[],firstCrossing:null,initial:null,gate:null,errors:[],truncated:false,sequence:0,fitStep:null,stepCalls:0,sourceFitAccepted:false};
 let backend=null,stepEntry=null,previous=null,context={substep:null,iteration:null};
 const copy=x=>JSON.parse(JSON.stringify(x));
 const emit=(key,data)=>self.postMessage({__RF34_DIAG__:{key,data}});
 const safe=fn=>(...args)=>{try{return fn(...args);}catch(e){report.errors.push(String(e.stack||e));}};
 function pack(a){if(!a)return null;const bytes=new Uint8Array(a.buffer,a.byteOffset,a.byteLength);let s='';for(let i=0;i<bytes.length;i+=16384)s+=String.fromCharCode(...bytes.subarray(i,i+16384));return {type:a.constructor.name,length:a.length,bytes:bytes.length,base64:btoa(s)};}
 const lineage=world.solvers.map(s=>{
  const members=Array.from({length:s.count},()=>[]),edges=[];let offset=0;
  for(const p of s.packet.spec.panels){
   for(let i=0;i<p.uvMm.length;i++)members[s.map[offset+i]].push({panelId:p.id,localVertex:i,globalVertex:offset+i,uvMm:Array.from(p.uvMm[i])});
   const seen=new Set();for(const t of p.triangles){const q=t.map(i=>s.map[offset+i]);if(new Set(q).size<3)continue;for(let k=0;k<3;k++){const a=q[k],b=q[(k+1)%3],key=Math.min(a,b)+','+Math.max(a,b);if(seen.has(key))continue;seen.add(key);edges.push({panelId:p.id,localVertices:[t[k],t[(k+1)%3]],globalVertices:[offset+t[k],offset+t[(k+1)%3]],particles:[a,b],uvMm:[Array.from(p.uvMm[t[k]]),Array.from(p.uvMm[t[(k+1)%3]])]});}}offset+=p.uvMm.length;
  }
  if(edges.length!==s.edges.length||edges.some((x,i)=>x.particles[0]!==s.edges[i].a||x.particles[1]!==s.edges[i].b))throw Error('EDGE_LINEAGE_ORDER_MISMATCH:'+s.role);
  return {edges,members};
 });
 function edge(si,ei){const s=world.solvers[si],e=s.edges[ei],a=e.a*3,b=e.b*3,len=Math.hypot(s.p[a]-s.p[b],s.p[a+1]-s.p[b+1],s.p[a+2]-s.p[b+2]);return {solver:si,role:s.role,presetId:s.packet.binding?.presetId||s.originalPacket?.binding?.presetId,edgeIndex:ei,...lineage[si].edges[ei],endpointsM:[Array.from(s.p.subarray(a,a+3)),Array.from(s.p.subarray(b,b+3))],lengthM:len,restM:e.rest,sourceRestM:e.sourceRest??null,targetRestM:e.targetRest??null,packedRestM:backend?.solvers?.[si]?.edges?.view[ei*4+2]??null,ratio:len/e.rest,engineeringStrain:len/e.rest-1,inverseMass:[s.w[e.a],s.w[e.b]],endpointMembers:[lineage[si].members[e.a],lineage[si].members[e.b]]};}
 function scan(){return world.solvers.map((s,si)=>{let max=-Infinity,min=Infinity,index=-1,over=0,invalid=0,firstOver=-1;for(let i=0;i<s.edges.length;i++){const e=s.edges[i],a=e.a*3,b=e.b*3,r=Math.hypot(s.p[a]-s.p[b],s.p[a+1]-s.p[b+1],s.p[a+2]-s.p[b+2])/e.rest;if(!Number.isFinite(r)){invalid++;if(index<0)index=i;}else{min=Math.min(min,r);if(r>max){max=r;index=i;}if(r>1.45){over++;if(firstOver<0)firstOver=i;}}}return {role:s.role,solver:si,edgeCount:s.edges.length,maxRatio:max,minRatio:min,maxEdgeIndex:index,overLimitCount:over,firstOverIndex:firstOver,invalidCount:invalid};});}
 function mark(stage,extra={}){
  Object.assign(context,extra);const states=scan(),event={sequence:++report.sequence,fitStep:report.fitStep,stepCall:report.stepCalls,stage,...context,states};
  if(report.events.length<20000)report.events.push(event);else report.truncated=true;
  if(!report.firstCrossing){const si=states.findIndex(s=>s.overLimitCount||s.invalidCount);if(si>=0)report.firstCrossing={event:copy(event),previous:previous?copy(previous):null,worstEdge:edge(si,states[si].maxEdgeIndex),firstEnumeratedOverLimit:states[si].firstOverIndex>=0?edge(si,states[si].firstOverIndex):null,initialCondition:stage==='coupled-construction'};}
  previous=event;return event;
 }
 function state(){return {solvers:world.solvers.map((s,i)=>({role:s.role,p:pack(s.p),v:pack(s.v),old:pack(s.old),packedEdges:pack(backend?.solvers?.[i]?.edges?.view),packedBends:pack(backend?.solvers?.[i]?.bends?.view),time:s.time,steps:s.steps,contacts:s.contacts})),actor:{positions:pack(world.actor.positions),native:pack(world.actor.native),previous:pack(backend?.actorPrevious),target:pack(backend?.actorTarget),waistPrevious:pack(backend?.waist?.previous),waistTarget:pack(backend?.waist?.target)},world:{elapsed:world.elapsed,motionTime:world.motionTime,bodyRevision:world.bodyRevision,clothRevision:world.clothRevision,pairContacts:world.pairContacts,frameSequence:world.frameSequence}};}
 function topEdges(){return world.solvers.map((s,si)=>{const rows=s.edges.map((_,i)=>edge(si,i));rows.sort((a,b)=>b.ratio-a.ratio);return {role:s.role,top:rows.slice(0,8)};});}
 function gate(b){backend=b;const event=mark('original-safety-gate');report.gate={event,edges:topEdges(),originalPredicate:'!Number.isFinite(r.maxEdgeStretch)||r.maxEdgeStretch>1.45',originalAudits:[]};emit('gateState',state());}
 const api={
  fit:safe((i,total,hasOrigin)=>{report.fitStep=i;report.fitTotal=total;report.hasFittingOrigin=hasOrigin;context={substep:null,iteration:null};}),
  attach:safe(b=>{backend=b;report.backend=world.backend||b?.constructor?.name;report.gpuFallbackReason=world.gpuFallbackReason||null;if(!b?.solvers||!b?.e)throw Error('WASM_BACKEND_REQUIRED_FOR_THIS_DIAGNOSTIC');report.initial={event:mark('wasm-attached'),edges:topEdges()};emit('initialState',state());if(verbose){for(const name of ['project','pair','pairDense']){const original=b[name];b[name]=function(...args){const value=original.apply(this,args);api.mark('after-'+name,{operationSolver:name==='project'?world.solvers.indexOf(args[0].s):null});return value;};}}}),
  stepStart:safe(b=>{backend=b;report.stepCalls++;context={substep:null,iteration:null};mark('step-entry');stepEntry=state();emit('entryState',stepEntry);}),
  mark:safe((name,extra)=>{if(verbose)mark(name,extra);}),
  gate:safe(gate),
  audit:safe((a,r)=>{report.gate.originalAudits.push({role:a.s.role,maxEdgeStretch:r.maxEdgeStretch,minEdgeStretch:r.minEdgeStretch});}),
  failure:safe((b,message)=>{backend=b;report.failure={message,fitStep:report.fitStep,stepCall:report.stepCalls,elapsedAfterRollback:world.elapsed,safetyTrips:world.safetyTrips,rollbackCount:b.metrics.rollbacks};const after=state();report.rollbackExact=JSON.stringify(stepEntry)===JSON.stringify(after);emit('rollbackState',after);emit('trace',report);}),
  finish:safe(()=>emit('trace',report))
 };
 safe(()=>{report.construction={event:mark('coupled-construction'),edges:topEdges()};})();
 return Object.freeze(api);
}
