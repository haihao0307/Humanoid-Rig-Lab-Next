'use strict';const fs=require('fs');let s=fs.readFileSync('src/BodyAtlasRayR21.js','utf8');
function replace(a,b){if(!s.includes(a))throw Error('Precision marker missing: '+a.slice(0,90));s=s.replace(a,b);}
replace('function create(canvas,initialAtlas){let atlas=initialAtlas;','function create(canvas,initialAtlas){let atlas=initialAtlas,cpu=null,probing=false;');
replace('lastMS=performance.now()-started;}','lastMS=performance.now()-started;if(cpu&&!probing)cpu.render(camera,diagnostic,canvas.width,canvas.height);}');
replace("resize();view('full');","resize();view('full');if(!window.__BODY_ATLAS_CPU_DISABLE__){cpu=BodyAtlasCpuR21.create(canvas,atlas);cpu.render(camera,diagnostic,canvas.width,canvas.height);}");
replace('atlas=next;gpuBytes=bytes;draw();','atlas=next;gpuBytes=bytes;if(cpu)cpu.program(next);draw();');
replace('atlas=previous;draw();throw error;','atlas=previous;if(cpu)cpu.program(previous);draw();throw error;');
replace('return{view,draw,load(next)',"return{view,draw,precision(value){if(cpu){cpu.setEnabled(value);if(value)cpu.render(camera,diagnostic,canvas.width,canvas.height);}},precisionFrame:()=>cpu?.frame(),load(next)");
replace('probeFrame(mode,channel=0){const previous=','probeFrame(mode,channel=0){probing=true;const previous=');
replace('gl.enable(gl.DITHER);draw();return{pixels,','gl.enable(gl.DITHER);draw();probing=false;return{pixels,');
replace("schema:'body-source-atlas-ray/1',characterVertexBuffers", "schema:'body-source-atlas-ray/1',precision:cpu?.report()||{enabled:false,ready:false},characterVertexBuffers");
fs.writeFileSync('src/BodyAtlasRayR21.js',s);
