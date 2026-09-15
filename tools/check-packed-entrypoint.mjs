import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {assemble} from './build-pure.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const read=path=>readFileSync(root+path,'utf8');
const sha=text=>createHash('sha256').update(text).digest('hex');
const normalize=text=>text.replace(/\r\n/g,'\n');
const uploaded=read('index.html');
const generated=assemble();

// Embedded pages are quoted Base64 gzip literals. Brain and body have very
// different sizes, and gzip output bytes can vary across zlib builds. Detect
// payloads by successful gzip decoding rather than by a fixed length or by the
// surrounding source formatting.
const longLiteralPattern=/(["'`])([A-Za-z0-9+/=]{1024,})\1/g;
function tryUnpack(value){try{return gunzipSync(Buffer.from(value,'base64')).toString();}catch{return null;}}
function extractPacked(text,label){
 const payloads=[];
 const masked=normalize(text.replace(longLiteralPattern,(full,quote,value)=>{
  const decoded=tryUnpack(value);
  if(decoded===null)return full;
  payloads.push({value,decoded});
  return quote+'__PACKED_PAYLOAD_'+payloads.length+'__'+quote;
 }));
 if(payloads.length!==2)throw Error(label+' 应包含 2 个 gzip 页面载荷，实际 '+payloads.length);
 return {payloads,masked};
}
const expected={body:generated.body,brain:generated.brain};
function classify(payloads,label){
 const found={};
 for(let index=0;index<payloads.length;index++){
  const {value,decoded}=payloads[index];
  const kind=Object.entries(expected).find(([,expectedText])=>decoded===expectedText)?.[0];
  if(!kind)throw Error(label+' 的 gzip 载荷 #'+(index+1)+' 与当前 body/brain 源码均不一致');
  if(found[kind])throw Error(label+' 重复包含 '+kind+' 载荷');
  found[kind]={payload:value,text:decoded,index};
 }
 for(const kind of Object.keys(expected))if(!found[kind])throw Error(label+' 缺少 '+kind+' 载荷');
 return found;
}
function firstDifference(a,b){
 const length=Math.min(a.length,b.length);let index=0;
 while(index<length&&a.charCodeAt(index)===b.charCodeAt(index))index++;
 if(index===length&&a.length===b.length)return null;
 return {index,left:a.slice(Math.max(0,index-80),index+120),right:b.slice(Math.max(0,index-80),index+120),leftLength:a.length,rightLength:b.length};
}

const uploadedPacked=extractPacked(uploaded,'上传入口');
const generatedPacked=extractPacked(generated.index,'当前装配入口');
const uploadedPages=classify(uploadedPacked.payloads,'上传入口');
const generatedPages=classify(generatedPacked.payloads,'当前装配入口');
const shellDifference=firstDifference(uploadedPacked.masked,generatedPacked.masked);
if(shellDifference)throw Error('上传入口的静态外壳与当前模板不一致：'+JSON.stringify(shellDifference));

console.log(JSON.stringify({
 schema:'jarvis/packed_entrypoint_check@1',
 staticShellMatches:true,
 bodyPayloadMatches:true,
 brainPayloadMatches:true,
 uploadedIndexSHA256:sha(uploaded),
 assembledIndexSHA256:sha(generated.index),
 compressedBytesIdentical:uploaded===generated.index,
 uploadedBodyGzipSHA256:sha(uploadedPages.body.payload),
 uploadedBrainGzipSHA256:sha(uploadedPages.brain.payload),
 assembledBodyGzipSHA256:sha(generatedPages.body.payload),
 assembledBrainGzipSHA256:sha(generatedPages.brain.payload),
 uploadedBodyBytes:Buffer.byteLength(uploadedPages.body.text),
 uploadedBrainBytes:Buffer.byteLength(uploadedPages.brain.text),
 explanation:uploaded===generated.index?'exact packed entrypoint match':'decoded body/brain pages and static shell match; gzip bytes differ across zlib builds',
 applicationExecuted:false
},null,2));
