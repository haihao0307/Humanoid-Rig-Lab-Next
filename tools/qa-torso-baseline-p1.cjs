'use strict';
// Run the established isolated native-reference visual comparison for the two
// P1 torso baselines only. Historical reports and product files stay untouched.
const fs=require('fs'),cp=require('child_process');
let source=fs.readFileSync('tools/qa-native-profiles-r24.cjs','utf8');
function replaceOnce(before,after){const n=source.split(before).length-1;if(n!==1)throw Error('Expected one audit anchor, got '+n+': '+before.slice(0,90));source=source.replace(before,()=>after);}
replaceOnce("process.env.BODY_SOURCE_TEST_BUILD||'BUILD-SOURCE-R24.json'","process.env.BODY_SOURCE_TEST_BUILD||'BUILD-SOURCE-R29.json'");
replaceOnce("for(const id of ['baseline','lean','fuller','muscular','female','A-reach','A-joints','B-neutral','B-bend','calibration-soft'])","for(const id of ['baseline','calibration-soft'])");
replaceOnce("for(const view of ['front','side','back'])","for(const view of ['front','side','back','half'])");
replaceOnce("bodySourceAtlasR22.renderer.view(view);bodySourceAtlasR22.renderer.view('full');","bodySourceAtlasR22.renderer.view(view==='half'?'front':view);bodySourceAtlasR22.renderer.view(view==='half'?'half':'full');");
replaceOnce('q.cases.length===30','q.cases.length===8');
replaceOnce('summary={common:0,sourceOnly:0,candidateOnly:0,','summary={coverageSamples:[],common:0,sourceOnly:0,candidateOnly:0,');
replaceOnce('if(c&&!o){summary.candidateOnly++;continue;}if(o&&!c){summary.sourceOnly++;continue;}','if(c&&!o){summary.candidateOnly++;if(summary.coverageSamples.length<40)summary.coverageSamples.push({x,y:f.height-1-y,owner:"candidate"});continue;}if(o&&!c){summary.sourceOnly++;if(summary.coverageSamples.length<40)summary.coverageSamples.push({x,y:f.height-1-y,owner:"original"});continue;}');
replaceOnce('sourceRGB:[...b.subarray(i,i+3)],candidateRGB:[...a.subarray(i,i+3)]});','sourceRGB:[...b.subarray(i,i+3)],candidateRGB:[...a.subarray(i,i+3)],sourceLayers:sl.map(v=>Array.from(v.subarray(i,i+4))),candidateLayers:cl.map(v=>Array.from(v.subarray(i,i+4)))});');
replaceOnce('record.fullFrame=summary;','record.camera=f.camera;record.width=f.width;record.height=f.height;record.fullFrame=summary;');
replaceOnce('q.maximum=Math.max(q.maximum,d);','if(d>q.maximum)q.worst={x,y:f.height-1-y,source:Array.from(sl[layer].subarray(i,i+4)),candidate:Array.from(cl[layer].subarray(i,i+4))};q.maximum=Math.max(q.maximum,d);');
const inputGroup=Number(process.env.BODY_P1_INPUT_PROBE||0);if(inputGroup){if(![1,2].includes(inputGroup))throw Error('Unknown diagnostic group');replaceOnce('await original.goto(pathToFileURL','await original.addInitScript({path:"qa/p1-torso/offline/native-input-hook-'+inputGroup+'.js"});await original.goto(pathToFileURL');replaceOnce("console.log('Actual original body render ready');","q.nativeShaderHooks=await original.evaluate(()=>window.__P1_NATIVE_SHADER_HOOKS__||0);if(!q.nativeShaderHooks)throw Error('Native input diagnostic shader was not installed');console.log('Actual original body render ready; native input diagnostic hooks='+q.nativeShaderHooks);");replaceOnce('(async()=>{try{','q.debugInputGroup='+inputGroup+';(async()=>{try{');}
const output=inputGroup?'qa/p1-torso/shader-input-probe-'+inputGroup+'.json':process.env.BODY_P1_VERTEX_TRIAL==='1'?'qa/p1-torso/vertex-order-trial.json':'qa/p1-torso/matched-native-baselines.json';source=source.replaceAll('qa/fidelity-r24/active-profiles-pixels-browser.json',output);
source=source.replaceAll('641px!important;height:826px','321px!important;height:481px').replaceAll("width===641&&bodySourceAtlasR22.report().precision.ready","width===321&&bodySourceAtlasR22.report().precision.ready");
const result=cp.spawnSync(process.execPath,['-e',source],{stdio:'inherit',windowsHide:true});process.exitCode=result.status??1;
