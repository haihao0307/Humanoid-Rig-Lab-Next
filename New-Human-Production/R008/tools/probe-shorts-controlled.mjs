import {registerHooks} from 'node:module';
import {writeFileSync,mkdirSync} from 'node:fs';
const base=new URL('../',import.meta.url);registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('vendor/three.module.js',base).href,shortCircuit:true}:next(s,c);}});
const THREE=await import('three'),{runDevelopedShorts}=await import('../ShortsControlledTrial.mjs'),scene=new THREE.Scene(),actor=new THREE.Group();scene.add(actor);actor.updateMatrixWorld(true);
const r=await runDevelopedShorts(scene,actor,{onProgress:p=>console.log(JSON.stringify(p.round===undefined?p:{name:p.name,round:p.round,strain:p.strain}))});
const out=new URL('qa/shorts-controlled-20261004/',base);mkdirSync(out,{recursive:true});writeFileSync(new URL('CPU.json',out),JSON.stringify({results:r.results,anyPassed:r.anyPassed,elapsedMs:r.elapsedMs},null,2));
console.log(JSON.stringify({anyPassed:r.anyPassed,elapsedMs:r.elapsedMs}));for(const c of r.cloths)c.dispose();
