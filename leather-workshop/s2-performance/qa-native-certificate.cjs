/** Adversarial potential differential including friction outside the barrier. */
'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const A=require(path.resolve(process.env.BASE_LIB)),B=require('./node-lib.cjs');
const d={positions:[-20,100,0,20,100,0,0,140,0,-15,103,3,25,103,3,5,143,3],triangles:[[0,1,2,1.4,1],[3,4,5,1.4,1]],nodeParts:[0,0,0,1,1,1],partNames:['a','b']};
const a=new A.ImplicitLeatherShell(d,{gravity:0}),b=new B.ImplicitLeatherShell(d,{gravity:0});let seed=771337,cases=0,pruned=0;
function rnd(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
function same(x,y,name){assert.equal(x.length,y.length,name+' length');for(let i=0;i<x.length;i++)assert.equal(x[i],y[i],name+' '+i);}
for(let k=0;k<480;k++){
 for(const s of[a,b]){s.prev.set(s.rest);s.setPairs(s.prev,s.prev);}
 const x=a.rest.slice();for(let i=0;i<x.length;i++)x[i]+=(rnd()-.5)*(k%3===0?.012:.00004);if(k%5===0)for(let i=0;i<x.length;i+=3){x[i]+=.4;x[i+1]+=.3;}
 for(const s of[a,b]){for(const p of s.contactSet){p.frictionForce=k%2?2:0;const n=k%7===0?[0,0,0]:k%7===1?[2,1,-3]:p.previous.n;p.previous.n=n;}s.energyNative.begin(s.prev,s.cfg.dt,s.contactSet);}
 const qa=a.energyNative.evaluate(x,k%2===0),qb=b.energyNative.evaluate(x,k%2===0);assert.equal(qa.energy,qb.energy,'energy '+k);pruned+=b.energyNative.native.potential_pruned();
 if(Number.isFinite(qa.energy)){for(const key of['residual','elasticEnergy','contactEnergy','active','normalForce','frictionPairs','minimumClearanceMM'])assert.equal(qa[key],qb[key],key+' '+k);same(qa.grad,qb.grad,'gradient');if(qa.diag)same(qa.diag,qb.diag,'diagonal');}
 cases++;
}
assert(pruned>0,'The certificate must actually be exercised');
const report={pass:true,cases,certifiedZeroEvaluations:pruned,scope:'480 deterministic varied potential evaluations: finite/infinite energies, gradient, diagonal, exact minimum, friction on/off, translated/deformed triangles, zero and non-unit directions. Existing full CCD tests are unchanged.'};
fs.mkdirSync(path.join(__dirname,'qa/s2'),{recursive:true});fs.writeFileSync(path.join(__dirname,'qa/s2/native-certificate.json'),JSON.stringify(report,null,2)+'\n');console.log(report);
