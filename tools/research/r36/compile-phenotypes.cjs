'use strict';
// Offline compilation of additional source-derived affine scalar responses.
// Each record belongs to a retained function domain; no vertex indices or
// face connectivity are emitted into the runtime packet.
const fs=require('fs'),zlib=require('zlib'),crypto=require('crypto'),encode=require('../../body-packet-codec-r27.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),source=require('../../program-r17.cjs')(),a=source.anny;
const manifest=JSON.parse(fs.readFileSync('data/body-torso-continuous-p1.json'));
const packed=fs.readFileSync(manifest.surface.file);if(hash(packed)!==manifest.surface.compressedSHA256)throw Error('Current body function packet changed');
const body=JSON.parse(zlib.gunzipSync(packed)),mapping=JSON.parse(fs.readFileSync('qa/p1-torso/offline/body-expanded-source-map-p1.json'));
if(mapping.length!==body.charts.length)throw Error('Body function-domain map mismatch');
const groups=[];let offset=0;for(const [name,labels] of Object.entries(a.variations)){
 const start=offset;offset+=labels.length;let samples;
 if(name==='race'){const v=labels.map(k=>body.referenceState.anny.phenotypes[k]??.5),sum=v.reduce((s,x)=>s+x,0);samples=[v.map(x=>sum?x/sum:1/v.length)];}
 else{const anchors=a.anchors[name],min=name==='age'?-1/3:0,xs=[min,1,...anchors.filter(x=>x>=min&&x<=1)];for(let i=1;i<anchors.length;i++){const mid=(anchors[i-1]+anchors[i])/2;if(mid>=min&&mid<=1)xs.push(mid);}samples=xs.map(x=>{let hi=1;while(hi<anchors.length-1&&anchors[hi]<x)hi++;const u=(x-anchors[hi-1])/(anchors[hi]-anchors[hi-1]);return labels.map((_,i)=>i===hi?u:i===hi-1?1-u:0);});}
 groups.push({name,start,labels,samples});
}
if(offset!==a.maskWidth)throw Error('Phenotype coefficient mask width mismatch');
const masks=a.arrays.stacked_phenotype_blend_shapes_mask,possible=[];
for(let i=0;i<a.phenotypeShapeCount;i++){
 let valid=true;for(const g of groups){if(!g.samples.some(sample=>sample.every((w,j)=>{const v=masks[i*a.maskWidth+g.start+j];if(v!==0&&v!==1)throw Error('Unsupported phenotype mask');return v===0||w>0;}))){valid=false;break;}}
 if(valid)possible.push(i);
}
const existing=new Set(body.allowedFields),additional=possible.filter(i=>!existing.has(i)),chunks=[];
// Limit each independently compressed packet to well below GitHub's file cap.
for(let begin=0;begin<additional.length;begin+=100){
 const selected=additional.slice(begin,begin+100),rows=new Map(),reverse=new Map();
 for(const field of selected){const original=a.arrays.__rows.get(field),row=new Map();if(original)for(let i=0;i<original.indices.length;i++){const id=original.indices[i];row.set(id,original.values[i]);let list=reverse.get(id);if(!list)reverse.set(id,list=[]);list.push(field);}rows.set(field,row);}
 let capacity=262144,count=0,fields=new Uint16Array(capacity),presence=new Uint16Array(capacity),coefficients=new Float32Array(capacity*9);
 const grow=()=>{capacity=Math.ceil(capacity*1.6);let x=new Uint16Array(capacity);x.set(fields);fields=x;x=new Uint16Array(capacity);x.set(presence);presence=x;const c=new Float32Array(capacity*9);c.set(coefficients);coefficients=c;};
 const offsets=new Uint32Array(mapping.length*2+1);
 for(let f=0;f<mapping.length;f++)for(let branch=0;branch<2;branch++){
  const ids=mapping[f].nativeIndices.map(v=>v[branch]);if(ids.length!==3)throw Error('Function domain inputs mismatch');const used=new Set();
  for(const id of ids)for(let k=0;k<3;k++)for(const field of reverse.get(id*3+k)||[])used.add(field);
  for(const field of [...used].sort((x,y)=>x-y)){
   if(count===capacity)grow();fields[count]=field;const row=rows.get(field);let bits=0;
   for(let k=0;k<3;k++){const values=ids.map((id,c)=>{const key=id*3+k;if(row.has(key))bits|=1<<(k*3+c);return row.get(key)||0;});const q=count*9+k*3;coefficients[q]=values[0];coefficients[q+1]=values[1];coefficients[q+2]=values[2];}
   presence[count]=bits;count++;
  }
  offsets[f*2+branch+1]=count;
 }
 const packet={schema:'body-phenotype-domain-extension-r36/1',sourceDerived:true,sourceBodyProgramSHA256:manifest.surface.compressedSHA256,domainCount:mapping.length,characterVertexArrays:false,characterFaces:false,fieldsIncluded:selected,offsets,fields:fields.slice(0,count),presence:presence.slice(0,count),coefficients:coefficients.slice(0,count*9),basis:'linear Bernstein scalar responses on each retained function domain'};
 const encoded=encode(packet);if(encoded.compressed.length>=90*1024*1024)throw Error('Extension packet exceeds safe repository size; reduce chunk size');
 const file='delivery/assets/body-dynamic-r36/'+encoded.compressedSHA256+'.gz';fs.writeFileSync(file,encoded.compressed);
 chunks.push({file,url:'assets/body-dynamic-r36/'+encoded.compressedSHA256+'.gz',encoding:'gzip-typed-function-packet-r28',compressedBytes:encoded.compressed.length,compressedSHA256:encoded.compressedSHA256,rawBytes:encoded.raw.length,rawSHA256:encoded.rawSHA256,fields:selected,operations:count});
 console.log(JSON.stringify({chunk:chunks.length,fields:selected.length,operations:count,compressedBytes:encoded.compressed.length,sha256:encoded.compressedSHA256}));
}
const result={schema:'body-phenotype-extension-r36/1',sourceDerived:true,baseSurfaceSHA256:manifest.surface.compressedSHA256,domainCount:mapping.length,characterTriangleFaces:0,characterVertexArrays:false,originalConnectivityEmitted:false,allowedPhenotypes:['gender','age','weight','muscle','height','proportions','cupsize','firmness'],ageRange:[-1/3,1],possiblePhenotypeFields:possible,additionalFields:additional,chunks};
fs.writeFileSync('data/body-phenotype-extension-r36.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({completed:true,additionalFields:additional.length,chunks:chunks.length,totalBytes:chunks.reduce((n,c)=>n+c.compressedBytes,0)}));
