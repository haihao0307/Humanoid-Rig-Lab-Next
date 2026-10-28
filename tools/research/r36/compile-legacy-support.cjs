'use strict';
// Carry the legacy body's per-domain deformation influence functions.
// Source body indices are used only here, never emitted.
const fs=require('fs'),codec=require('../../body-packet-codec-r27.cjs');
const source=require('../../program-r17.cjs')(),mapping=JSON.parse(fs.readFileSync('qa/p1-torso/offline/body-expanded-source-map-p1.json')),base=JSON.parse(fs.readFileSync('data/body-torso-continuous-p1.json')),w=source.annyWeights;
const offsets=[0],joints=[],weights=[];
for(const domain of mapping)for(const body of domain.bodyIndices){for(let k=w.ptr[body];k<w.ptr[body+1];k++){joints.push(w.joints[k]);weights.push(w.values[k]);}offsets.push(joints.length);}
const packet={schema:'body-legacy-domain-influences-r36/1',sourceDerived:true,sourceBodyProgramSHA256:base.surface.compressedSHA256,domainCount:mapping.length,characterVertexArrays:false,characterFaces:false,offsets:Uint32Array.from(offsets),joints:Uint16Array.from(joints),weights:Float64Array.from(weights)};
const encoded=codec(packet),file='delivery/assets/body-dynamic-r36/'+encoded.compressedSHA256+'.gz';fs.writeFileSync(file,encoded.compressed);
const result={schema:'body-legacy-support-manifest-r36/1',sourceDerived:true,baseSurfaceSHA256:base.surface.compressedSHA256,domainCount:mapping.length,characterTriangleFaces:0,file,url:'assets/body-dynamic-r36/'+encoded.compressedSHA256+'.gz',encoding:'gzip-typed-function-packet-r28',compressedBytes:encoded.compressed.length,compressedSHA256:encoded.compressedSHA256,rawBytes:encoded.raw.length,rawSHA256:encoded.rawSHA256};
fs.writeFileSync('data/body-legacy-support-r36.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
