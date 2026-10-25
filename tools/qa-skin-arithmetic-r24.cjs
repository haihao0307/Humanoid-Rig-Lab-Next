'use strict';
const fs=require('fs'),path=require('path'),Module=require('module'),variant=process.env.BODY_SKIN_VARIANT||'anchor-varyings';
const install=require('./research/r24/skin-variants.cjs').install;
let script=fs.readFileSync(path.join(__dirname,'qa-active-profiles-pixels-r23.cjs'),'utf8');
script=script.replaceAll('qa/fidelity-r23/active-profiles-pixels-browser.json','qa/fidelity-r24/skin-arithmetic-'+variant+'.json');
script=script.replace('await candidate.goto(',`await candidate.addInitScript(${install.toString()},${JSON.stringify(variant)});await candidate.goto(`);
script=script.replace('newImageFiles:0,cases:',`newImageFiles:0,arithmeticTrial:${JSON.stringify(variant)},productChanged:false,cases:`);
const loaded=new Module(__filename,module);loaded.filename=__filename;loaded.paths=module.paths;loaded._compile(script,__filename);
