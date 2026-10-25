'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),vm=require('vm'),zlib=require('zlib'),H=b=>crypto.createHash('sha256').update(b).digest('hex'),recipe=JSON.parse(fs.readFileSync('data/body-skin-recipe-r24.json'));
const q={startedUTC:new Date().toISOString(),sourceDerived:true,cachedArraysRead:false,headProjectModified:false,fields:[],sourceFidelityAccepted:false};
try{
 for(const e of [recipe.kernel,recipe.contentsKernel])if(H(fs.readFileSync(e.file))!==e.sha256)throw Error('Frozen kernel changed');
 const context={SkinGraphKernel:require(path.resolve(recipe.kernel.file)),AppendageAtlas:require(path.resolve(recipe.contentsKernel.file))};vm.runInNewContext(fs.readFileSync('src/BodySkinRecipeWorkerR24.js','utf8'),context);const start=performance.now(),fields=context.BodySkinRecipeWorkerR24.buildFields(recipe);q.generationMS=performance.now()-start;
 for(const entry of recipe.fields){const raw=Buffer.from(fields[entry.name]);if(raw.length!==entry.rawBytes||H(raw)!==entry.rawSHA256)throw Error('Generated original field mismatch '+entry.name);const n=raw.length/8,lanes=Buffer.alloc(raw.length);for(let c=0;c<4;c++)for(let b=0;b<2;b++)for(let i=0;i<n;i++)lanes[(c*2+b)*n+i]=raw[i*8+c*2+b];const packed=zlib.gzipSync(lanes,{level:6});if(H(packed)!==entry.compressedSHA256)throw Error('Compressed field mismatch '+entry.name);q.fields.push({name:entry.name,rawBytes:raw.length,rawSHA256:H(raw),compressedSHA256:H(packed),exact:true});console.log(entry.name+' RGBA regenerated exactly');}
 q.passed=true;
}catch(error){q.failure=error.stack;q.passed=false;process.exitCode=1;console.error(error);}finally{q.finishedUTC=new Date().toISOString();fs.writeFileSync('qa/fidelity-r24/full-skin-regeneration.json',JSON.stringify(q,null,2)+'\n');}
