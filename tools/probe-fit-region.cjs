'use strict';
// Numerical diagnostic only. Stops before field caching and never renders.
const fs=require('fs'),vm=require('vm'),{performance}=require('perf_hooks');
const build=JSON.parse(fs.readFileSync(process.env.BODY_BUILD_MANIFEST||'BUILD-R12.json'));
const sourceFiles=build.sources.filter(s=>!/BodyRay|BodyImplicitApp/.test(s.file));
let source=sourceFiles.map(s=>fs.readFileSync(s.file,'utf8')).join('\n');
const marker=' const globalFit=fitPointOffsets(false),localFit=fitPointOffsets(true);';
if(!source.includes(marker))throw Error('Fit diagnostic insertion marker absent');
source=source.replace(marker,marker+`
 for(const fit of[globalFit,localFit]){let peak=0;for(let i=1;i<fit.values.length;i++)if(Math.abs(fit.values[i])>Math.abs(fit.values[peak]))peak=i;const w=program.annyWeights,influences=[];for(let k=w.ptr[peak];k<w.ptr[peak+1];k++)influences.push({bone:program.anny.boneLabels[w.joints[k]],weight:w.values[k]});fit.report.peak={sample:peak,positionYUp:point(positions,peak),influences:influences.sort((a,b)=>b.weight-a.weight).slice(0,6)};}
 return{field:new Float32Array(0),normalField:new Float32Array(0),locals:[],samples:new Float32Array(0),normals:new Float32Array(0),diagnostic:{global:globalFit.report,local:localFit.report}};`);
let state;const results=[],context=vm.createContext({performance,console,atob,Blob,Response,DecompressionStream,TextDecoder,structuredClone,self:{postMessage(message){if(message.type==='program')state=message.state;if(message.type==='field')results.push(message.diagnostic);if(message.type==='error')throw Error(message.error);}}});
(async()=>{vm.runInContext(source,context);await context.self.onmessage({data:{type:'init',id:1,data:JSON.parse(fs.readFileSync(build.data.file,'utf8')).gzipBase64}});const baseline=structuredClone(state);state=structuredClone(baseline);state.anny.phenotypes.gender=.85;await context.self.onmessage({data:{type:'state',id:2,state}});const report={checkedUTC:new Date().toISOString(),artifactSHA256:build.sha256,diagnosticOnly:true,doesNotReplaceActualRenderQA:true,cases:[{name:'baseline',...results[0]},{name:'female',...results[1]}]};fs.writeFileSync('qa/fit-region-probe-r12.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));})().catch(e=>{console.error(e);process.exitCode=1});
