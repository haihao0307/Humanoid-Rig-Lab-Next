'use strict';
// Preserve the exact existing compressed coefficient packet, without base64 in
// the page or a duplicate string in the worker's initialization message.
const fs=require('fs'),zlib=require('zlib'),crypto=require('crypto'),H=b=>crypto.createHash('sha256').update(b).digest('hex'),input='data/body-function-program-r17.json',p=JSON.parse(fs.readFileSync(input)),bytes=Buffer.from(p.gzipBase64,'base64'),raw=zlib.gunzipSync(bytes),sha=H(bytes),dir='delivery/assets/body-program-r23',file=dir+'/'+sha+'.gz';
if(bytes.length!==p.compressedBytes||raw.length!==p.rawBytes)throw Error('Original body packet size changed');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(file,bytes);
const metadata={schema:'body-program-byte-packet/1',file,url:'./assets/body-program-r23/'+sha+'.gz',compressedBytes:bytes.length,compressedSHA256:sha,rawBytes:raw.length,rawSHA256:H(raw),sourcePackage:{file:input,sha256:H(fs.readFileSync(input)),repackOnly:true},sourceDerived:true,characterFaces:0,characterIndices:0,bitExact:true};fs.writeFileSync('data/body-program-packet-r23.json',JSON.stringify(metadata,null,2));console.log(JSON.stringify(metadata));
