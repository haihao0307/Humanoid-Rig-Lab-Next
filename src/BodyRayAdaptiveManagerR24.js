/* One renderer/context at a time. Precision 2 retains the original dense GLSL
 * path; standard observation uses verified lossless GPU address maps. */
(()=>{'use strict';
function create(canvas,options={}){let kind=options.quality===2?'dense':'pages',renderer=(kind==='dense'?createBodyDenseR24:createBodyPagedR24)(canvas),last=null,switches=0;
 const copyState=()=>({camera:renderer.camera(),appearance:renderer.report().appearance,lighting:renderer.report().lighting}),restore=(r,s)=>{r.setCamera(s.camera);r.appearance(s.appearance);r.lighting(s.lighting);},factory=k=>(k==='dense'?createBodyDenseR24:createBodyPagedR24)(canvas);
 function field(value){const next=value.stats?.quality===2?'dense':'pages';if(next===kind){const result=renderer.field(value);last=value;return result;}const oldKind=kind,previous=last,saved=copyState();renderer.close();renderer=null;try{renderer=factory(next);restore(renderer,saved);const result=renderer.field(value);kind=next;last=value;switches++;return result;}catch(error){renderer?.close();renderer=factory(oldKind);restore(renderer,saved);if(previous)renderer.field(previous);kind=oldKind;last=previous;throw error;}}
 const api={field,report:()=>({...renderer.report(),adaptiveFieldStorage:true,gpuFieldWordsUnchanged:true,denseGPUExpansion:kind==='dense',activeStorage:kind==='dense'?'original dense Float32 precision path':'lossless Float32 GPU address maps',densePrecisionFallback:kind==='dense',storageSwitches:switches}),close:()=>renderer.close()};for(const name of ['draw','view','probeFrame','scalarFieldAt','fieldValuesAt','surfaceDetailAtRest','camera','setCamera','appearance','lighting'])api[name]=(...args)=>renderer[name](...args);return api;
}
globalThis.createBodyRayR02=create;
})();
