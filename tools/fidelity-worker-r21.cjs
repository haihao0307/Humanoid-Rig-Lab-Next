'use strict';
const fs=require('fs'),vm=require('vm');
module.exports=function(options={}){
 const program=require('./program-r17.cjs')();
 const names=['BodyMathR01','BodyShapeR01','BodyMHRFieldsR01','BodyTargetBindingR01','BodyMHRAdapterR01','BodyDriverR01','BodyFieldIntervalsR21','BodyFieldCacheR21'];
 const context=vm.createContext({performance,console,structuredClone,Blob,Response,ReadableStream,AbortController,CompressionStream,DecompressionStream,TextEncoder,TextDecoder,self:{postMessage(){}},__program:program});
 for(const name of names)vm.runInContext(fs.readFileSync('src/'+name+'.js','utf8'),context,{filename:name});
 vm.runInContext((options.workerSource||fs.readFileSync('src/BodyImplicitWorkerR21.js','utf8'))+`\nprogram=__program;state=structuredClone(program.baselineState);baseline=program.baselineSamples;driver=createBodyDriverR01(program);neighbours=buildNeighbours();normals(driver.evaluate(state));globalThis.__run=(next,quality=1)=>{state=structuredClone(next||program.baselineState);return implicitField(driver.evaluate(state),quality);};globalThis.__driver=driver;`,context);
 return{program,context,driver:context.__driver,build:(state,quality)=>context.__run(state,quality)};
};
