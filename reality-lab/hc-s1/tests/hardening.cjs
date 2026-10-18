const C=require('../core.js'),I=require('../isolation.js'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const checks=[];function test(name,fn){fn();checks.push({name,passed:true});console.log('PASS',name);}
test('orthogonal but incorrectly labelled up axis is rejected',()=>assert.equal(C.basisMapsAxes({handedness:'right',up:'+Z',forward:'-Y',toCanonicalBasis:[1,0,0,0,1,0,0,0,1]}),false));
test('explicit Z-up forward-negative-Y transform is consistent',()=>assert.equal(C.basisMapsAxes({handedness:'right',up:'+Z',forward:'-Y',toCanonicalBasis:[1,0,0,0,0,-1,0,1,0]}),true));
test('unknown handedness is not silently right-handed',()=>assert.equal(C.checkBasis([1,0,0,0,1,0,0,0,1],'unknown'),false));
const original='<!doctype html><html><head><title>native</title></head><body>unchanged native body</body></html>',wrapped=I.wrap(original);
test('storage prelude removable to byte-exact native HTML',()=>assert.equal(wrapped.replace(/<!--REALITY_VOLATILE_STORAGE_V1-->[\s\S]*?<!--\/REALITY_VOLATILE_STORAGE_V1-->/,''),original));
test('double isolation rejected',()=>assert.throws(()=>I.wrap(wrapped)));
test('missing insertion boundary rejected',()=>assert.throws(()=>I.wrap('<body>no head</body>')));
test('native Web Storage writes never touch original backing object',()=>{const originalStore={sentinel:'keep'},window={localStorage:originalStore,sessionStorage:originalStore};const code=wrapped.match(/<script>([\s\S]*?)<\/script>/)[1];vm.runInNewContext(code,{window});window.localStorage.setItem('sentinel','temporary');assert.equal(originalStore.sentinel,'keep');assert.equal(window.localStorage.getItem('sentinel'),'temporary');assert.equal(window.sessionStorage.getItem('sentinel'),null);window.localStorage.clear();assert.equal(originalStore.sentinel,'keep');});
const out=process.env.REALITY_QA||path.resolve(__dirname,'../qa/local');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'HARDENING_REPORT.json'),JSON.stringify({passed:true,count:checks.length,checks},null,2));
