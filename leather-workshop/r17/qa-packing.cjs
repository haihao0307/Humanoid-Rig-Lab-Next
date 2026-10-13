/** Exact hot-bridge serialization test, invoking actual production clip methods. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const A=require(path.resolve(process.env.BASE_LIB)),B=require('./node-lib.cjs');
const input={positions:[0,100,0,50,100,0,0,140,0],triangles:[[0,1,2,1.4,1]],nodeParts:[0,0,0],partNames:['test']};
const ref=new A.ImplicitLeatherShell(input,{contact:false}),cand=new B.ImplicitLeatherShell(input,{contact:false});
const normals=[null,undefined,[0,0,0],[0,0,1],[2,1,-3],[-0,-1,0]],rows=[];
function fake(){const sections=Array.from({length:17},()=>new Float64Array(72)),captured=[],state={sections,capacity:3,shell:{contact:{stats:{ccdEvents:0,ptEvents:0,eeEvents:0}}},native:{clip_many(n){captured.push(Buffer.from(sections[16].buffer,0,n*9*8).toString('hex'));sections[15][8]=n;sections[15][9]=n/2;sections[15][10]=n/2;return .625;}},captured};return state;}
const from=Float64Array.of(0,-0,2),to=Float64Array.of(1,2,3);
for(let j=0;j<normals.length;j++)for(const size of [0,1,3,8]){
 const pairs=Array.from({length:size},(_,i)=>({ids:[i,i+1,i+2,i+3],gap:i%2?-.0:.0014,pt:i%2===0,...(j===0?{}:{previous:{n:normals[j]}})}));const a=fake(),b=fake();
 const ra=ref.energyNative.clip.call(a,from,to,pairs),rb=cand.energyNative.clip.call(b,from,to,pairs);
 assert.equal(ra,rb);assert.deepEqual(a.captured,b.captured);assert.deepEqual(a.shell.contact.stats,b.shell.contact.stats);
 assert.equal(ref.energyNative.clip.call(a,from,to,pairs),cand.energyNative.clip.call(b,from,to,pairs));assert.deepEqual(a.captured,b.captured);assert.deepEqual(a.shell.contact.stats,b.shell.contact.stats);
 assert.equal(a.lastClipRef===pairs,b.lastClipRef===pairs);
 if(normals[j])assert(Object.is(Math.hypot(...normals[j]),Math.hypot(normals[j][0],normals[j][1],normals[j][2])));
 rows.push({normalCase:j,pairCount:size,pass:true,batches:b.captured.length,exactFloat64Bytes:true});
}
const report={pass:true,cases:rows.length,rows,scope:'Actual canonical NativeEnergy.clip versus frozen R13; exact pair order, Float64 bytes, fractions, CCD counters, missing/zero/non-unit/signed-zero normals, repeated same-reference cache and capacity rollover. No timing assertion in this unit test.'};
fs.mkdirSync(path.join(__dirname,'qa/s2'),{recursive:true});fs.writeFileSync(path.join(__dirname,'qa/s2/packing.json'),JSON.stringify(report,null,2)+'\n');console.log('Contact packing: '+rows.length+' exact byte cases passed');
