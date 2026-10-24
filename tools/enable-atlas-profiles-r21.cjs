'use strict';const fs=require('fs');let s=fs.readFileSync('src/BodyAtlasRayR21.js','utf8');
function replace(a,b){if(!s.includes(a))throw Error('Source state marker missing: '+a.slice(0,90));s=s.replace(a,b);}
replace('function create(canvas,atlas){','function create(canvas,initialAtlas){let atlas=initialAtlas;');
replace("{alpha:false,antialias:false,preserveDrawingBuffer:true}","{alpha:true,premultipliedAlpha:false,antialias:false,preserveDrawingBuffer:true}");
replace('const texture=gl.createTexture();textures.push(texture);','const texture=textures[unit]||gl.createTexture();textures[unit]=texture;');
replace('const gpuBytes=upload(0,atlas.nodes.flat())+upload(1,atlas.functions.flat())+upload(2,atlas.leafFunctions),locations={};',`function uploadAtlas(next){const count=next.nodeLines.length/3,data=new Float32Array(count*8);for(let i=0;i<count;i++){data.set(next.nodeLines.subarray(i*3,i*3+3),i*8);data.set(next.nodeLinks.subarray(i*5,i*5+5),i*8+3);}return upload(0,data)+upload(1,next.functionCoefficients)+upload(2,next.leafFunctionIds);}let gpuBytes=uploadAtlas(atlas);const locations={};`);
replace('return{view,draw,camera:',`return{view,draw,load(next){const previous=atlas;try{const bytes=uploadAtlas(next);if(gl.getError()!==gl.NO_ERROR)throw Error('新状态未能完整载入');atlas=next;gpuBytes=bytes;draw();}catch(error){uploadAtlas(previous);atlas=previous;draw();throw error;}},camera:`);
fs.writeFileSync('src/BodyAtlasRayR21.js',s);
