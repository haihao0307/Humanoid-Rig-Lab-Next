'use strict';
const fs=require('fs'),zlib=require('zlib'),crypto=require('crypto');
const source=JSON.parse(fs.readFileSync('data/body-function-program.json'));
const raw=zlib.gunzipSync(Buffer.from(source.gzipBase64,'base64')),size=raw.readUInt32LE(0),header=JSON.parse(raw.subarray(4,4+size)),start=4+size;
const typeBytes={Float32Array:4,Float64Array:8,Uint32Array:4,Int32Array:4,Uint16Array:2,Int16Array:2,Uint8Array:1,Int8Array:1,Uint8ClampedArray:1};
const rows=[],groups={},paths=new Map(),keys=new Map();
function walk(v,path='program'){if(!v||typeof v!=='object')return;if(v.$array!==undefined){rows.push({path,id:v.$array,...header.arrays[v.$array]});return;}for(const[k,x]of Object.entries(v))walk(x,path+'.'+k);}
walk(header.tree);
for(const c of header.tree.catalog){groups[c.group]=(groups[c.group]||0)+1;const path=JSON.stringify(c.path);if(!paths.has(path))paths.set(path,[]);paths.get(path).push(c.key);if(!keys.has(c.key))keys.set(c.key,[]);keys.get(c.key).push(path);}
const hashes=new Map();let duplicateBytes=0,zeroBytes=0;
const stats=header.arrays.map((a,id)=>{const bytes=a.length*typeBytes[a.type],b=raw.subarray(start+a.offset,start+a.offset+bytes),hash=crypto.createHash('sha256').update(b).digest('hex'),key=a.type+':'+a.length+':'+hash,duplicateOf=hashes.get(key);if(duplicateOf===undefined)hashes.set(key,id);else duplicateBytes+=bytes;const T=globalThis[a.type],v=new T(b.slice().buffer.slice(b.slice().byteOffset,b.slice().byteOffset+bytes));let zeros=0;for(let i=0;i<v.length;i++)if(v[i]===0)zeros++;zeroBytes+=zeros*typeBytes[a.type];return{id,type:a.type,length:a.length,bytes,zeros,duplicateOf,paths:rows.filter(r=>r.id===id).map(r=>r.path)};});
const report={checkedUTC:new Date().toISOString(),catalogCount:header.tree.catalog.length,groups,duplicatePaths:[...paths].filter(([,v])=>v.length>1),duplicateKeys:[...keys].filter(([,v])=>v.length>1),rawBytes:raw.length,headerBytes:size,arrayCount:stats.length,exactDuplicateBytes:duplicateBytes,zeroValueBytes:zeroBytes,largestArrays:stats.slice().sort((a,b)=>b.bytes-a.bytes).slice(0,30),arrays:stats};
fs.writeFileSync('qa/parameter-data-audit-r17.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,arrays:undefined},null,2));
