import fs from 'node:fs';import zlib from 'node:zlib';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
const R=fileURLToPath(new URL('.',import.meta.url));
const full=JSON.parse(fs.readFileSync(R+'qa/payload-fixture.json'));
const reference=JSON.parse(fs.readFileSync(R+'../r07/qa/numeric/report.json'));
const sha=v=>crypto.createHash('sha256').update(Buffer.from(v.buffer,v.byteOffset,v.byteLength)).digest('hex');
const dec=(s,C)=>{const b=zlib.gunzipSync(Buffer.from(s,'base64'));return new C(b.buffer,b.byteOffset,b.byteLength/C.BYTES_PER_ELEMENT);};
const {subtypeDefaults}=await import('./core.mjs');
let reply;globalThis.self={postMessage:x=>{if(x.result||x.error)reply=x;}};await import('./worker.mjs');
function call(kind,data){reply=null;self.onmessage({data:{job:1,kind,data}});if(reply.error)throw Error(reply.error.message);return reply.result;}
const records=[];
for(const [headIndex,h]of full.native.heads.entries()){
 const p=dec(h.p,Float32Array),ix=dec(h.i,Uint32Array),before=sha(p),{profile}=call('head',{position:p,index:ix});
 for(const meta of full.hats){
  const s={...subtypeDefaults(meta.id),id:meta.id,head:headIndex,view:'wear',width:1,depth:1,height:1,lift:0,tilt:0};
  const {mesh,fit}=call('build',{meta,settings:s,profile});
  const old=reference.records.find(r=>r.fixture==='original'&&r.head===h.id&&r.hat===meta.id);
  const record={hat:meta.id,head:h.id,headUnchanged:sha(p)===before,positionHash:sha(fit.position),expectedPositionHash:old.outputHash,bandHash:fit.sweatband?sha(fit.sweatband.position):null,expectedBandHash:old.bandHash};
  record.passed=record.headUnchanged&&record.positionHash===record.expectedPositionHash&&record.bandHash===record.expectedBandHash;
  records.push(record);console.log(meta.id,h.id,record.passed);
 }
}
const report={method:'Actual Worker entry invoked with original recipes, never fitted geometry input; exact comparison with R07.1 hashes for all 33 original pairs.',records,passed:records.every(x=>x.passed)};
fs.writeFileSync(R+'qa/worker-equivalence.json',JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
