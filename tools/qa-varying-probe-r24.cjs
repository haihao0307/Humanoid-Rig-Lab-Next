'use strict';
const fs=require('fs'),path=require('path'),Module=require('module'),{install,probe}=require('./research/r24/varying-probe.cjs');
let script=fs.readFileSync(path.join(__dirname,'qa-active-profiles-pixels-r23.cjs'),'utf8');
script=script.replaceAll('qa/fidelity-r23/active-profiles-pixels-browser.json','qa/fidelity-r24/varying-probe.json');
script=script.replace('await original.addInitScript(',`await original.addInitScript(${install.toString()});await candidate.addInitScript(${install.toString()});await original.addInitScript(`);
script=script.replace('q.cases.push(record);',`record.varyingProbe=await (${probe.toString()})(original,candidate,id,view);q.cases.push(record);`);
script=script.replace('newImageFiles:0,cases:',"newImageFiles:0,arithmeticTrial:'encoded original and candidate varying probe',productChanged:false,cases:");
const loaded=new Module(__filename,module);loaded.filename=__filename;loaded.paths=module.paths;loaded._compile(script,__filename);
