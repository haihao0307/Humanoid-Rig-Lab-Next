'use strict';
// Reuse the existing detailed browser assertions against the new artifacts.
// Old reports and old source files are never overwritten by these runs.
const fs=require('fs'),Module=require('module'),path=require('path'),name=process.argv[2];
const scripts={source:'qa-source-r25-browser.cjs',workbench:'qa-workbench-r25.cjs',head:'qa-head-archive-r26.cjs',roundtrip:'qa-page-roundtrip-r26.cjs',inspection:'qa-inspection-cache-r26.cjs',history:'qa-field-history-r26.cjs'};
if(!scripts[name])throw Error('Choose source/workbench/head/roundtrip/inspection');
process.env.BODY_WORKBENCH_QA_BUILD='BUILD-R27.json';process.env.BODY_SOURCE_QA_BUILD='BUILD-SOURCE-R27.json';
let script=fs.readFileSync('tools/'+scripts[name],'utf8').replaceAll('BUILD-SOURCE-R26.json','BUILD-SOURCE-R27.json').replaceAll('BUILD-R26.json','BUILD-R27.json').replaceAll('qa/fidelity-r26/','qa/fidelity-r27/');
if(name==='source')script=script.replaceAll('BUILD-SOURCE-R25.json','BUILD-SOURCE-R27.json').replaceAll('qa/fidelity-r25/source-browser.json','qa/fidelity-r27/source-browser.json');
if(name==='workbench'){
 script=script.replaceAll('qa/fidelity-r25/workbench-browser.json','qa/fidelity-r27/workbench-browser.json');
 const old="await p.waitForFunction(()=>bodyImplicitR02.report().renderer.activeSurface==='continuous');await p.evaluate(light=>bodyImplicitR02.renderer.lighting(light),savedLight);";
 if(!script.includes(old))throw Error('Lighting assertion source changed');
 script=script.replace(old,"check('exposure edit retains original detail',await p.evaluate(()=>bodyImplicitR02.report().renderer.activeSurface==='source'));await p.evaluate(light=>bodyImplicitR02.renderer.lighting(light),savedLight);");
}
const file=path.resolve('tools/'+scripts[name]),m=new Module(file,module);m.filename=file;m.paths=module.paths;m._compile(script,file);
