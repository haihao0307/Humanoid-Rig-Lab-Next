'use strict';
const fs=require('fs'),d=JSON.parse(fs.readFileSync('data/body-core-functions-r29.json')),n=JSON.parse(fs.readFileSync('data/body-display-normals-r29.json')),h=JSON.parse(fs.readFileSync('data/body-head-boundary-r29.json'));
d.schema='body-pose-functions-candidate-r29/1';for(const p of d.profiles){p.displayNormals=n.profiles.find(e=>e.id===p.id);p.headBoundaryFunctions=h.profiles.find(e=>e.id===p.id)||null;if(!p.displayNormals)throw Error('Original display-normal program missing');}fs.writeFileSync('data/body-pose-functions-r29.json',JSON.stringify(d,null,2)+'\n');
