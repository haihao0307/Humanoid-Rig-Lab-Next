import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {assemble} from './build-pure.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const read=path=>readFileSync(root+path,'utf8');
const template=read('source/index.template.html');
const uploaded=read('index.html');
const marker=/\/\*__(BODY_GZIP|BRAIN_GZIP)__\*\//g;
const names=[],parts=[];let cursor=0,match;
while((match=marker.exec(template))){parts.push(template.slice(cursor,match.index));names.push(match[1]);cursor=marker.lastIndex;}
parts.push(template.slice(cursor));
if(names.length!==2||!names.includes('BODY_GZIP')||!names.includes('BRAIN_GZIP'))throw Error('入口模板压缩占位符不完整');

const payloads={};let at=0;
for(let index=0;index<names.length;index++){
 const before=parts[index],after=parts[index+1];
 if(!uploaded.startsWith(before,at))throw Error('上传入口的静态外壳与模板不一致：'+names[index]);
 at+=before.length;
 const end=uploaded.indexOf(after,at);
 if(end<0)throw Error('上传入口缺少占位符后的静态外壳：'+names[index]);
 payloads[names[index]]=uploaded.slice(at,end);at=end;
}
if(uploaded.slice(at)!==parts.at(-1))throw Error('上传入口尾部与模板不一致');
for(const [name,value]of Object.entries(payloads))if(!/^[A-Za-z0-9+/=]+$/.test(value))throw Error(name+' 不是有效 Base64 载荷');

const unpack=value=>gunzipSync(Buffer.from(value,'base64')).toString();
const uploadedBody=unpack(payloads.BODY_GZIP),uploadedBrain=unpack(payloads.BRAIN_GZIP);
const generated=assemble();
if(uploadedBody!==generated.body)throw Error('上传入口解压后的身体页面与当前源码装配不一致');
if(uploadedBrain!==generated.brain)throw Error('上传入口解压后的认知页面与当前源码装配不一致');

const sha=text=>createHash('sha256').update(text).digest('hex');
const generatedBodyPayload=/^[A-Za-z0-9+/=]+$/.test(payloads.BODY_GZIP)&&sha(payloads.BODY_GZIP);
console.log(JSON.stringify({
 schema:'jarvis/packed_entrypoint_check@1',
 staticShellMatches:true,
 bodyPayloadMatches:true,
 brainPayloadMatches:true,
 uploadedIndexSHA256:sha(uploaded),
 assembledIndexSHA256:sha(generated.index),
 compressedBytesIdentical:uploaded===generated.index,
 uploadedBodyGzipSHA256:generatedBodyPayload,
 uploadedBodyBytes:Buffer.byteLength(uploadedBody),
 uploadedBrainBytes:Buffer.byteLength(uploadedBrain),
 explanation:uploaded===generated.index?'exact packed entrypoint match':'decompressed payload and static shell match; gzip bytes differ across zlib builds',
 applicationExecuted:false
},null,2));
