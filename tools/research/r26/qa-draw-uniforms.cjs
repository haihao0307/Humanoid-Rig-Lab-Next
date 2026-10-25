'use strict';
const fs=require('fs'),Module=require('module'),path=require('path');
let script=fs.readFileSync('tools/qa-material-repeat-r25.cjs','utf8');
script=script.replace("await p.addInitScript({path:'tools/research/r25/material-state-hook.js'});","await p.addInitScript({path:'tools/research/r25/material-state-hook.js'});await p.addInitScript({path:'tools/research/r26/draw-uniform-hook.js'});");
script=script.replace('inputUploads:__BODY_MATERIAL_QA_UPLOADS__()','inputUploads:__BODY_MATERIAL_QA_UPLOADS__(),drawUniforms:__BODY_DRAW_UNIFORMS_R26__.slice(-12)');
script=script.replace('inputUploads:value.inputUploads','inputUploads:value.inputUploads,drawUniforms:value.drawUniforms');
const m=new Module(path.resolve('tools/qa-material-repeat-r25.cjs'),module);m.filename=path.resolve('tools/qa-material-repeat-r25.cjs');m.paths=module.paths;m._compile(script,m.filename);
