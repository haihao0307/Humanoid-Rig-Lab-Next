'use strict';
const fs=require('fs'),Module=require('module'),path=require('path');
const script=fs.readFileSync('tools/qa-source-r25-browser.cjs','utf8').replaceAll('BUILD-SOURCE-R25.json','BUILD-SOURCE-R26.json').replaceAll('qa/fidelity-r25/source-browser.json','qa/fidelity-r26/source-browser.json');
const m=new Module(path.resolve('tools/qa-source-r25-browser.cjs'),module);m.filename=path.resolve('tools/qa-source-r25-browser.cjs');m.paths=module.paths;m._compile(script,m.filename);
