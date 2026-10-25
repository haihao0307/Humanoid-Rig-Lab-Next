'use strict';
// Reuse lifecycle assertions, retaining their R25 scope and writing new evidence.
const fs=require('fs'),Module=require('module'),path=require('path');
process.env.BODY_WORKBENCH_QA_BUILD='BUILD-R26.json';process.env.BODY_SOURCE_QA_BUILD='BUILD-SOURCE-R26.json';
let script=fs.readFileSync('tools/qa-workbench-r25.cjs','utf8').replaceAll('qa/fidelity-r25/workbench-browser.json','qa/fidelity-r26/workbench-browser.json');
const old="await p.waitForFunction(()=>bodyImplicitR02.report().renderer.activeSurface==='continuous');await p.evaluate(light=>bodyImplicitR02.renderer.lighting(light),savedLight);";
if(!script.includes(old))throw Error('Original lighting regression section changed');
script=script.replace(old,"check('exposure edit retains original detail',await p.evaluate(()=>bodyImplicitR02.report().renderer.activeSurface==='source'));await p.evaluate(light=>bodyImplicitR02.renderer.lighting(light),savedLight);");
const m=new Module(path.resolve('tools/qa-workbench-r25.cjs'),module);m.filename=path.resolve('tools/qa-workbench-r25.cjs');m.paths=module.paths;m._compile(script,m.filename);
