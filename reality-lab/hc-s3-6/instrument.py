from pathlib import Path
import hashlib,json
PIN='c5c0bedbc35f24cbb35426ab9c14b74ca7fc5f49'
DIGESTS={'live-cloth-worker.mjs':'7cd945c060e4206bdef1b2b1eba302d8bd4a0cd9c44d0858b6031db3cf21d3c7','wasm-cloth.mjs':'33df85592209c3ddd60224a75fe3129666028ab185f0da5eb1a9fd9e35b62de5','gpu-cloth.mjs':'ae88c3615826d6f99f32576a84f447f8e5654492be8df7e66dee80b7032a80f4','coupled-cloth.mjs':'1f0e93ba23658fd0b3d16abd27325b4c3d29cba267b94078f05fafc7105cdd68'}
sha=lambda b:hashlib.sha256(b).hexdigest()
DIAGNOSTICS=r'''
let __rfAbort=null,__rfId=null,__rfGeneration=null;
const __rfPost=(kind,data)=>self.postMessage({rf36:true,kind,...data});
async function __rfDigest(w){
 const a=w.acceleration,rows=[];const add=(name,v)=>{if(v&&ArrayBuffer.isView(v))rows.push([name,v]);};
 for(const [i,s]of w.solvers.entries()){for(const k of ['p','v','old','w','output','normals'])add('s'+i+'.'+k,s[k]);add('a'+i+'.edges',a.solvers[i].edges.view);add('a'+i+'.bends',a.solvers[i].bends.view);add('a'+i+'.cache',a.solvers[i].cache.view);}
 for(const k of ['actorPrevious','actorTarget'])add(k,a[k]);for(const k of ['positions','native'])add('body.'+k,w.actor[k]);for(const k of ['previous','target'])add('waist.'+k,a.waist[k]);
 const out={};for(const [name,v]of rows){const raw=new Uint8Array(v.buffer,v.byteOffset,v.byteLength);out[name]={bytes:raw.byteLength,sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),x=>x.toString(16).padStart(2,'0')).join('')};}
 out.metadata={elapsed:w.elapsed,motionTime:w.motionTime,frame:w.frameSequence,bodyRevision:w.bodyRevision,clothRevision:w.clothRevision,localRevision:w.__rfFittingRevision??null,rest:w.solvers.map(s=>s.edges.map(e=>e.rest)),solver:w.solvers.map(s=>({time:s.time,steps:s.steps,contacts:s.contacts}))};
 return out;
}
function __rfRatios(w){return w.solvers.map(s=>{let max=0;for(const e of s.edges)max=Math.max(max,Math.hypot(...[0,1,2].map(k=>s.p[e.a*3+k]-s.p[e.b*3+k]))/e.rest);return max;});}
'''
def assemble(host:Path,mode:str,module:bytes):
    assert mode in ['baseline','progressive','cancel','fault']
    for n,h in DIGESTS.items():assert sha((host/n).read_bytes())==h,('SOURCE_PIN_MISMATCH',n)
    raw=(host/'live-cloth-worker.mjs').read_bytes();text=raw.decode('utf-8')
    begin=text.index('  const fittingSteps=');end=text.index('  world.initial=',begin);original=text[begin:end]
    audit=[]
    if mode=='baseline':
        augmented=original.replace('self.postMessage({id:d.id,progress:',"__baseline.steps.push({step:i+1,maxActiveRatios:__rfRatios(world)});self.postMessage({id:d.id,progress:")
        replacement="const __baseline={status:'RUNNING',plannedSteps:48,steps:[],originalGate:1.45};try{\n"+augmented+"\n__baseline.status='COMMITTED';__rfPost('report',{report:__baseline});}catch(e){__baseline.status='NATIVE_FAILED';__baseline.failure={message:e.message};__baseline.failedStep=__baseline.steps.length+1;__baseline.failedRatiosBeforeRollback=null;__rfPost('report',{report:__baseline});throw e;}\n"
    else:
        replacement=r'''
 if(world.acceleration instanceof GPUCloth)throw Error('RF36_WASM_CASE_REQUIRED');
 __rfAbort=new AbortController();__rfId=d.id;__rfGeneration=generation;
 const __identity={sourceCommit:__RF36_PIN,generation,bindingToken:JSON.stringify({source:d.actor.sourceRevision,targetIdentity:d.actor.targetIdentity||null})};
 const __before=await __rfDigest(world);
 let __receipt=null;
 try{
  __receipt=await runFittingTransaction(world,{identity:__identity,readIdentity:()=>({...__identity,generation}),origin,finalBody,signal:__rfAbort.signal,expectedRevision:0,onStep:s=>{
   __rfPost('step',{step:s,requestId:d.id,generation});
   self.postMessage({id:d.id,progress:s.step/48,phase:'事务化体型适配 · 人体与参考长度共同渐变'});
   if(__RF36_MODE==='fault'&&s.step===3)throw Object.assign(Error('RF36_INJECTED_AFTER_NATIVE_STEP_3'),{code:'INJECTED_TEST_FAILURE'});
  }});
  const metricsExact=world.solvers.every((s,i)=>s.edges.every((e,j)=>e.rest===(e.targetRest??e.rest)&&world.acceleration.solvers[i].edges.view[j*4+2]===e.rest));
  let bodyError=0;for(let k=0;k<finalBody.length;k++)bodyError=Math.max(bodyError,Math.abs(world.actor.positions[k]-finalBody[k]));
  __receipt.independentChecks={finalMetricsMatchTarget:metricsExact,bodyFinalErrorM:bodyError,worldRuntimeRevision:world.__rfFittingRevision};
  __rfPost('report',{report:__receipt});
 }catch(e){
  __receipt=e.fittingReport||{status:'REJECTED',failure:{code:e.code,message:e.message}};
  const __after=await __rfDigest(world);__receipt.independentRollback={equal:JSON.stringify(__before)===JSON.stringify(__after),before:__before,after:__after,scope:'independent SHA256 arrays, edge rest values, frame/time/revisions'};
  __rfPost('report',{report:__receipt});throw e;
 }finally{__rfAbort=null;__rfId=null;__rfGeneration=null;}
'''
    new=text[:begin]+replacement+text[end:]
    old='self.onmessage=({data:d})=>{chain='
    early="self.onmessage=({data:d})=>{if(d.command==='cancel-fit'){const accepted=!!__rfAbort&&d.requestId===__rfId&&d.generation===__rfGeneration;if(accepted)__rfAbort.abort(Error('FITTING_CANCELLED_BY_MESSAGE'));__rfPost('cancel-ack',{accepted,requestId:d.requestId,generation:d.generation});return;}chain="
    assert new.count(old)==1;new=new.replace(old,early)
    # Reverse-check every modification before prefixing imports and diagnostics.
    reverted=new.replace(early,old).replace(replacement,original)
    assert reverted.encode()==raw
    prefix="import {runFittingTransaction} from './rf36-fitting-transaction.mjs';\nconst __RF36_PIN="+json.dumps(PIN)+",__RF36_MODE="+json.dumps(mode)+";\n"+DIAGNOSTICS
    output=(prefix+new).encode()
    return {'live-cloth-worker.mjs':output,'rf36-fitting-transaction.mjs':module},{'mode':mode,'sourcePin':PIN,'sourceFiles':DIGESTS,'workerBeforeSHA256':sha(raw),'workerCandidateSHA256':sha(output),'moduleSHA256':sha(module),'reverseExact':True,'protectedKernelChanged':False,'gpuExecutionTested':False,'productionSourceChanged':False}
