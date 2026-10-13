import assert from 'node:assert/strict';import fs from 'node:fs';
import {RuntimeGeometryCache,bufferBytes} from './runtime-cache.mjs';
import {fetchDetail,detailStats,clearDetailMemory} from './detail-loader.mjs';
const checks=[];function check(name,fn){fn();checks.push({name,passed:true});}
const shared=new Float32Array(8),other=new Float32Array(12);
check('shared buffers counted once',()=>assert.equal(bufferBytes([{a:shared,b:shared.subarray(2)},new Map([['x',shared]])]),32));
const c=new RuntimeGeometryCache({maxEntries:2,maxBytes:80});c.set('a',{x:shared});c.set('b',{x:other});c.get('a');c.set('c',{x:new Float32Array(8)});
check('LRU evicts older entry',()=>{assert.equal(c.get('b'),null);assert(c.get('a'));assert(c.get('c'));});
c.set('large',{x:new Float32Array(24)});check('oversized entry excluded',()=>assert.equal(c.get('large'),null));
check('budget and count bounded',()=>{assert(c.report().retainedArrayBytes<=80);assert(c.report().entries<=2);});
c.clear();check('clear releases references',()=>assert.equal(c.report().retainedArrayBytes,0));
const bytes=new Uint8Array([1,2,3,4,5,6]),hash=Buffer.from(await crypto.subtle.digest('SHA-256',bytes)).toString('hex');
const info={sha256:hash,bytes:bytes.length,urls:['https://first.example/texture','https://backup.example/texture']};
globalThis.location={origin:'https://local.example'};
const entries=new Map();globalThis.caches={open:async()=>({match:async k=>entries.get(typeof k==='string'?k:k.url)?.clone(),put:async(k,r)=>entries.set(k,r.clone()),delete:async k=>entries.delete(typeof k==='string'?k:k.url),keys:async()=>[...entries.keys()].map(k=>new Request(k))})};
let requests=0;globalThis.fetch=async()=>{requests++;return new Response(bytes);};
assert.deepEqual(new Uint8Array(await fetchDetail(info)),bytes);await new Promise(r=>setTimeout(r,20));
const n=requests;await fetchDetail({...info,urls:['https://other-build.example/texture']});
check('content identity independent of build URL',()=>assert.equal(requests,n));
clearDetailMemory();await fetchDetail({...info,urls:['https://new-build.example/texture']});
check('persistent content-addressed hit',()=>{assert.equal(requests,n);assert(detailStats().diskHits>0);});
clearDetailMemory();for(const k of entries.keys())entries.set(k,new Response('corrupt'));
await fetchDetail(info);check('corrupt cache is replaced',()=>assert.equal(requests,n+1));
clearDetailMemory();globalThis.caches={open:()=>new Promise(()=>{})};const start=performance.now();await fetchDetail(info);
check('hung disk API cannot block network',()=>{assert(performance.now()-start<1500);assert(detailStats().cacheTimeouts>0);});
clearDetailMemory();delete globalThis.caches;let attempt=0;globalThis.fetch=async()=>{if(++attempt===1)return new Response('error',{status:503});return new Response(bytes);};
await fetchDetail(info);check('failed primary falls back',()=>assert.equal(attempt,2));
clearDetailMemory();globalThis.fetch=async()=>new Response(new Uint8Array(6));let failed=false;try{await fetchDetail(info);}catch{failed=true;}
check('hash mismatch rejected',()=>assert(failed));
clearDetailMemory();globalThis.fetch=async()=>new Response(bytes.subarray(1));failed=false;try{await fetchDetail(info);}catch{failed=true;}
check('truncated body rejected',()=>assert(failed));
const controller=new AbortController();controller.abort();failed=false;try{await fetchDetail(info,{signal:controller.signal});}catch(e){failed=e.name==='AbortError';}
check('cancelled request rejected',()=>assert(failed));
fs.mkdirSync(new URL('./qa/',import.meta.url),{recursive:true});fs.writeFileSync(new URL('./qa/cache-unit.json',import.meta.url),JSON.stringify({checks,stats:detailStats(),passed:true},null,2));console.log(JSON.stringify({checks:checks.length,passed:true}));
