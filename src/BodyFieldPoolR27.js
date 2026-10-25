/* Bounded per-build workers evaluate disjoint field slabs. No surface fitting,
 * precision change, shared mutable coefficients or character geometry here. */
(()=>{'use strict';
function create({workerCode,maximumWorkers=3,onProgress=()=>{}}){
 const workerLimit=Math.max(1,Math.min(3,Math.floor(maximumWorkers)||1));
 async function regions(input,specs){
  const started=performance.now(),outputs=specs.map(s=>{const dimensions=s.bounds.map(b=>b[1]-b[0]).map(x=>Math.min(s.maximum,Math.max(12,Math.ceil(x/s.spacing)))),length=dimensions.reduce((a,b)=>a*b,1)*4;return{bounds:s.bounds,dimensions,field:new Float32Array(length),normalField:s.local?null:new Float32Array(length),tested:0};});
  const jobs=[];for(let i=0;i<specs.length;i++){const d=outputs[i].dimensions,stride=d[0]*d[1]*4,bytesPerLayer=stride*4*(specs[i].local?1:2),layers=Math.max(1,Math.min(16,Math.floor(8*1024*1024/bytesPerLayer)));for(let first=0;first<d[2];first+=layers)jobs.push({id:jobs.length,region:i,first,last:Math.min(d[2],first+layers),...specs[i]});}
  let done=0,peakInFlightBytes=0,inFlightBytes=0;const record={version:'BODY-FIELD-POOL-R27',workers:workerLimit,slabs:jobs.length,completed:0,fallback:false,sourceSurfaceAccepted:false,fieldArithmeticChanged:false,precision:'Float64 arithmetic; original Float32 writes',inputCloneBytes:0};
  const unique=new Set;function bytes(x){if(ArrayBuffer.isView(x)){if(unique.has(x.buffer))return 0;unique.add(x.buffer);return x.byteLength;}if(Array.isArray(x))return x.reduce((n,v)=>n+bytes(v),0);if(x&&typeof x==='object')return Object.values(x).reduce((n,v)=>n+bytes(v),0);return 0;}
  // Matrices are ordinary arrays; include their Number payload explicitly.
  record.inputCloneBytes=bytes(input)+input.inverseSkins.reduce((n,m)=>n+m.length*8,0)+input.support.length*8;
  function accept(job,part){const out=outputs[job.region],stride=out.dimensions[0]*out.dimensions[1]*4,expected=(job.last-job.first)*stride;if(part.first!==job.first||part.last!==job.last||part.field.length!==expected||!!part.normalField!==!!out.normalField||JSON.stringify(part.dimensions)!==JSON.stringify(out.dimensions))throw Error('Parallel field slab mismatch');out.field.set(part.field,job.first*stride);if(out.normalField)out.normalField.set(part.normalField,job.first*stride);out.tested+=part.tested;record.completed=++done;onProgress({completed:done,total:jobs.length,region:job.region});}
  const workers=[],cleanups=[];let url=null,inputPosts=0,initializedWorkers=0;
  try{
   if(workerLimit===1){const sampler=BodyFieldSamplerR27.create(input);for(const job of jobs)accept(job,sampler.region(job.bounds,job.spacing,job.maximum,job.local,job.first,job.last));}
   else{
    url=URL.createObjectURL(new Blob([workerCode],{type:'application/javascript'}));let next=0;
    await Promise.all(Array.from({length:workerLimit},()=>new Promise((resolve,reject)=>{
     const worker=new Worker(url);workers.push(worker);let assigned=null,settled=false;
     const timeout=setTimeout(()=>fail(Error('Field worker did not respond')),120000);
     cleanups.push(()=>{clearTimeout(timeout);worker.onmessage=null;worker.onerror=null;});
     function fail(error){if(settled)return;settled=true;clearTimeout(timeout);reject(error);}
     function dispatch(){if(next>=jobs.length){settled=true;clearTimeout(timeout);resolve();return;}assigned=jobs[next++];const out=outputs[assigned.region];inFlightBytes+=(assigned.last-assigned.first)*out.dimensions[0]*out.dimensions[1]*16*(assigned.local?1:2);peakInFlightBytes=Math.max(peakInFlightBytes,inFlightBytes);worker.postMessage({type:'slab',job:assigned});}
     worker.onerror=e=>fail(Error(e.message||'Field worker unavailable'));
     worker.onmessage=e=>{if(settled)return;try{const m=e.data;if(m.type==='ready'){if(assigned)throw Error('Duplicate field worker ready');initializedWorkers++;dispatch();}else if(m.type==='error')fail(Error(m.error));else if(m.type==='slab'){if(!assigned||m.id!==assigned.id)throw Error('Unexpected field slab');inFlightBytes-=m.result.field.byteLength+(m.result.normalField?.byteLength||0);accept(assigned,m.result);dispatch();}else throw Error('Unknown field worker reply');}catch(error){fail(error);}};
     worker.postMessage({type:'init',input});inputPosts++;
    })));
   }
  }catch(error){
   // Discard every partial result; preserve the original arithmetic and retry
   // locally if nested workers are unavailable or one slab failed.
   for(const cleanup of cleanups)cleanup();for(const worker of workers)worker.terminate();record.fallback=true;record.fallbackReason=error.message;record.completed=done=0;for(const out of outputs)out.tested=0;
   const sampler=BodyFieldSamplerR27.create(input);for(const job of jobs)accept(job,sampler.region(job.bounds,job.spacing,job.maximum,job.local,job.first,job.last));
  }finally{for(const cleanup of cleanups)cleanup();for(const worker of workers)worker.terminate();if(url)URL.revokeObjectURL(url);}
  record.peakInFlightResultBytes=peakInFlightBytes;record.totalMS=performance.now()-started;record.workersCreated=workers.length;record.initializedWorkers=initializedWorkers;record.workersTerminated=true;record.additionalWorkerInputBytes=inputPosts*record.inputCloneBytes;record.workerMemoryBytesArePayloadEstimates=true;return{regions:outputs,report:record};
 }
 return{regions};
}
globalThis.BodyFieldPoolR27={create};
})();
