/* Isolated R10 WASM fitting transaction. Not a collision/solver replacement.
 * Runtime revision is local to this fitting session, NOT proportion_revision.
 * No success is committed until all original steps and guards complete. */
export const VERSION='RF01-fitting-transaction@1';
const owners=new WeakSet();
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const bytes=x=>new Uint8Array(x.buffer,x.byteOffset,x.byteLength);
const equalBytes=(a,b)=>a.byteLength===b.byteLength&&bytes(a).every((v,i)=>v===bytes(b)[i]);
const error=(code,message=code)=>Object.assign(new Error(message),{code});
const json=x=>JSON.stringify(x);

/** Explicit R10 read/write-set. Scratch/diagnostic counters are documented below.
 * Buffers are copied, never transferred; aliases are retained during restore. */
export function snapshotFittingState(w){
 const a=w.acceleration,arrays=[],props=[],seen=new Set();
 const arr=(label,v)=>{if(v==null)return;if(!ArrayBuffer.isView(v)||v instanceof DataView)throw error('INVALID_STATE_ARRAY',label);if(seen.has(v))return;seen.add(v);arrays.push({label,target:v,saved:v.slice()});};
 const prop=(label,o,k)=>{if(!o)return;props.push({label,object:o,key:k,present:own(o,k),value:o[k]});};
 const vectorObject=(label,o)=>{if(!o)return;for(const [k,v] of Object.entries(o))if(ArrayBuffer.isView(v))arr(label+'.'+k,v);};
 for(const k of ['motion','motionTime','elapsed','frameSequence','bodyRevision','clothRevision','materialRevision','pairContacts','simulationMs','bodyActive','__rfFittingRevision'])prop('world.'+k,w,k);
 for(const [i,s]of w.solvers.entries()){
  for(const k of ['p','v','old','w','output','normals','bodyCache','contactSample'])arr('solver'+i+'.'+k,s[k]);
  for(const k of ['time','steps','contacts'])prop('solver'+i+'.'+k,s,k);
  for(const [j,e]of s.edges.entries())prop('solver'+i+'.edge'+j+'.rest',e,'rest');
  const x=a.solvers[i];for(const k of ['edges','bends','cache'])arr('wasm'+i+'.'+k,x[k]?.view);
 }
 for(const k of ['actorPrevious','actorTarget'])arr('backend.'+k,a[k]);
 for(const k of ['pairCache','pairInteriorCache'])arr('backend.'+k,a[k]?.view);
 for(const key of ['body','bottom']){const m=a[key];if(m)for(const k of ['p','normal','nodes'])arr('wasm.'+key+'.'+k,m[k]?.view);}
 for(const key of ['body','bottomSurface']){const m=w[key];if(m){vectorObject('mesh.'+key,m);prop('mesh.'+key+'.p',m,'p');prop('mesh.'+key+'.queries',m,'queries');for(const [i,n]of (m.nodes||[]).entries())arr('mesh.'+key+'.box'+i,n.box);}}
 if(w.actor){for(const k of ['positions','native','anchors'])arr('actor.'+k,w.actor[k]);for(const k of ['skin','world'])for(const [i,v]of (w.actor[k]||[]).entries())arr('actor.'+k+i,v);for(const k of ['pose','currentLocalPose','transitionFrom','motionID'])prop('actor.'+k,w.actor,k);}
 if(a.waist)for(const k of ['previous','target'])arr('waist.'+k,a.waist[k]);
 // Native step rollback buffers are scratch, but are also restored so a retry starts clean.
 for(const [i,r]of (a.rollback||[]).entries()){vectorObject('nativeRollback'+i,r);for(const k of ['time','steps','contacts'])prop('nativeRollback'+i+'.'+k,r,k);}
 if(a.actorRollback){vectorObject('actorRollback',a.actorRollback);prop('actorRollback.pose',a.actorRollback,'pose');}
 prop('metrics.steps',a.metrics,'steps');
 const originalMemory=a.memory?.buffer;
 const differences=()=>{
  const changed=[];if(originalMemory&&a.memory.buffer!==originalMemory)changed.push('WASM_MEMORY_REPLACED');
  for(const r of arrays)if(!equalBytes(r.target,r.saved))changed.push(r.label);
  for(const p of props)if(own(p.object,p.key)!==p.present||p.object[p.key]!==p.value)changed.push(p.label);
  return changed;
 };
 return {
  bytes:arrays.reduce((n,r)=>n+r.saved.byteLength,0),arrayCount:arrays.length,scalarCount:props.length,
  labels:arrays.map(r=>r.label),
  restore(){if(originalMemory&&a.memory.buffer!==originalMemory)throw error('WASM_MEMORY_REPLACED');for(const r of arrays)r.target.set(r.saved);for(const p of props){if(p.present)p.object[p.key]=p.value;else delete p.object[p.key];}},
  differences,
  // Copy-free byte hash is diagnostic only; exact restoration is checked with byte comparison.
  summary(){return {bytes:this.bytes,arrayCount:this.arrayCount,scalarCount:this.scalarCount,excluded:['WASM internal instrumentation counters','safetyTrips and metrics.rollbacks (monotonic failure diagnostics)','GPU state','source binding/recipe structures (never written)']};}
 };
}
function validateWorld(w){
 const a=w?.acceleration;
 if(!a?.solvers||!a.actorPrevious||!a.actorTarget||!a.waist||typeof w.step!=='function'||!w.actor)throw error('NOT_SUPPORTED_WASM_WORLD');
 if(a.solvers.length!==w.solvers.length)throw error('SOLVER_SET_MISMATCH');
 for(let j=0;j<w.solvers.length;j++){const s=w.solvers[j],buf=a.solvers[j].edges?.view;if(!buf||buf.length!==s.edges.length*4)throw error('EDGE_LAYOUT_MISMATCH');for(const e of s.edges){const lo=e.sourceRest??e.rest,hi=e.targetRest??e.rest;if(!finite(lo)||lo<=0||!finite(hi)||hi<=0)throw error('INVALID_REST_METRIC');}}
}
export async function runFittingTransaction(w,options){
 const {identity,readIdentity,origin,finalBody,signal,onStep=()=>{},yieldControl=()=>new Promise(r=>setTimeout(r,0)),expectedRevision=0}=options||{};
 if(!identity||typeof readIdentity!=='function'||!Number.isInteger(identity.generation)||identity.generation<1||!/^[0-9a-f]{40}$/.test(identity.sourceCommit||'')||typeof identity.bindingToken!=='string'||!identity.bindingToken)throw error('IDENTITY_REQUIRED');
 if(!Number.isInteger(expectedRevision)||expectedRevision<0||(w.__rfFittingRevision||0)!==expectedRevision)throw error('STALE_RUNTIME_REVISION');
 if(owners.has(w))throw error('FIT_ALREADY_RUNNING');
 validateWorld(w);
 if(!ArrayBuffer.isView(origin)||!ArrayBuffer.isView(finalBody)||origin.length!==w.actor.positions.length||finalBody.length!==origin.length||![...origin,...finalBody].every(finite))throw error('BODY_TARGET_INVALID');
 if(!equalBytes(origin,w.actor.positions))throw error('ORIGIN_NOT_CURRENT_BODY');
 const fixedIdentity=json(identity),checkIdentity=()=>{if(json(readIdentity())!==fixedIdentity)throw error('STALE_FITTING_IDENTITY');};
 const checkCancel=()=>{if(signal?.aborted)throw error('FITTING_CANCELLED',String(signal.reason?.message||signal.reason||'FITTING_CANCELLED'));};
 checkIdentity();checkCancel();
 const start=performance.now(),a=w.acceleration,from=origin.slice(),to=finalBody.slice(),snapshot=snapshotFittingState(w),report={schema:VERSION,status:'RUNNING',identity:JSON.parse(fixedIdentity),baseRuntimeRevision:expectedRevision,committedRuntimeRevision:expectedRevision,plannedSteps:48,committedSteps:0,steps:[],snapshot:snapshot.summary(),originalGate:1.45,dt:1/60,schedule:'fraction=min(step/32,1); native 48 fitting steps',rollback:null,fitCertified:false,productionInstalled:false};
 owners.add(w);
 try{
  for(let i=0;i<48;i++){
   checkIdentity();checkCancel();
   const f=Math.min(1,(i+1)/32),beforeBody=w.actor.positions.slice();
   a.actorPrevious.set(beforeBody);
   for(let k=0;k<to.length;k++)w.actor.positions[k]=from[k]+(to[k]-from[k])*f;
   a.actorTarget.set(w.actor.positions);a.waist.begin();
   let metricError=0,previousError=0;
   for(let j=0;j<w.solvers.length;j++){const s=w.solvers[j],v=a.solvers[j].edges.view;for(let k=0;k<s.edges.length;k++){const e=s.edges[k],lo=e.sourceRest??e.rest,hi=e.targetRest??e.rest,r=lo+(hi-lo)*f;e.rest=r;v[k*4+2]=r;metricError=Math.max(metricError,Math.abs(e.rest-v[k*4+2]));}}
   for(let k=0;k<beforeBody.length;k++)previousError=Math.max(previousError,Math.abs(a.actorPrevious[k]-beforeBody[k]));
   report.attemptedStep=i+1;
   await w.step(1/60,false); // Original WASM stepping and >1.45 rejection remain intact.
   checkIdentity();checkCancel();
   const ratios=w.solvers.map(s=>{let max=0;for(const e of s.edges){const p=s.p,d=Math.hypot(...[0,1,2].map(k=>p[e.a*3+k]-p[e.b*3+k]));max=Math.max(max,d/e.rest);}return max;});
   report.steps.push({step:i+1,fraction:f,bodyPreviousErrorM:previousError,jsWasmMetricErrorM:metricError,maxActiveRatios:ratios,elapsedSimulation:w.elapsed});
   report.committedSteps=i+1;onStep(report.steps.at(-1));
   // A task yield, not just await Promise.resolve(), allows a real cancel message.
   await yieldControl();checkIdentity();checkCancel();
  }
  w.__rfFittingRevision=expectedRevision+1;w.bodyRevision=(w.bodyRevision||0)+1;
  report.committedRuntimeRevision=w.__rfFittingRevision;report.status='COMMITTED';report.durationMS=performance.now()-start;
  return report;
 }catch(e){
  const original={code:e.code||'NATIVE_STEP_FAILED',message:String(e.message||e),nativeSafetyTrips:w.safetyTrips??null};
  snapshot.restore();const changed=snapshot.differences();
  report.rollback={exact:changed.length===0,changedPaths:changed,restoredTo:'transaction entry, not merely the last successful step',stateRevisionRestored:(w.__rfFittingRevision||0)===expectedRevision};
  report.status=original.code==='FITTING_CANCELLED'?'CANCELLED':original.code==='STALE_FITTING_IDENTITY'?'STALE_ROLLED_BACK':'FAILED_ROLLED_BACK';report.failure=original;report.durationMS=performance.now()-start;report.committedStepsBeforeRollback=report.committedSteps;report.committedSteps=0;
  if(changed.length)throw Object.assign(error('ROLLBACK_INCOMPLETE',changed.join(',')),{fittingReport:report});
  throw Object.assign(error(original.code,original.message),{fittingReport:report});
 }finally{owners.delete(w);}
}
