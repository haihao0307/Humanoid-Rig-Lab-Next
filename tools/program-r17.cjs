'use strict';
const fs=require('fs'),zlib=require('zlib');
module.exports=function(){
 const pack=JSON.parse(fs.readFileSync('data/body-function-program-r17.json')),raw=zlib.gunzipSync(Buffer.from(pack.gzipBase64,'base64')),n=raw.readUInt32LE(0),h=JSON.parse(raw.subarray(4,4+n)),start=4+n,cache=new Map();
 const arrays=h.arrays.map(a=>{const key=a.type+':'+a.offset+':'+a.length;if(cache.has(key))return cache.get(key);const T=globalThis[a.type],v=new T(Uint8Array.from(raw.subarray(start+a.offset,start+a.offset+a.length*T.BYTES_PER_ELEMENT)).buffer);cache.set(key,v);return v;});
 function unpack(x){if(x&&x.$array!==undefined)return arrays[x.$array];if(x&&x.$map)return new Map(x.$map.map(([k,v])=>[k,unpack(v)]));if(x&&x.$set)return new Set(x.$set);if(Array.isArray(x))return x.map(unpack);if(x&&typeof x==='object')return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,unpack(v)]));return x;}
 return unpack(h.tree);
};
