import {BodySDF} from './material-physics.mjs';
import {CoupledCloth} from './coupled-cloth.mjs';
import {loadClothKernel,accelerateWorld}from './wasm-cloth.mjs';
import {bakeMotion,recipeKey}from './motion-cache.mjs';
let world=null,rows=null,settings=null;
const digest=async b=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(x=>x.toString(16).padStart(2,'0')).join('');
async function checked(url,hash){const r=await fetch(url);if(!r.ok)throw Error('物理数据 HTTP '+r.status);const b=await r.arrayBuffer();if(hash&&await digest(b)!==hash)throw Error('原人物碰撞数据哈希不符');return b;}
function send(id,dense=false){const rows=world.rows(),body=Float32Array.from(world.actor.native),audit=dense?world.audit(true):{motion:world.motion,motionTime:world.motionTime,solverMs:world.simulationMs,bodyFrameMatchesCloth:true,frameSequence:world.frameSequence,pairTargetMM:world.contactGap*1000,pairCorrections:world.pairContacts,nativeRig:world.actor.audit()};self.postMessage({id,rows,body,audit},[body.buffer,...rows.flatMap(r=>[r.positions.buffer,r.normals.buffer])]);}
self.onmessage=async({data:d})=>{try{if(d.command==='init'){
 const meta=JSON.parse(new TextDecoder().decode(await checked(new URL('./assets/body-sdf-grid.json',import.meta.url),d.lock.sdfMetadataSHA256))),compressed=await checked(new URL('./assets/common-body.sdfd.gz',import.meta.url),d.lock.sdfFileSHA256),raw=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer(),sdf=new BodySDF(meta,new Int16Array(raw),d.lock.groundShiftM);
 rows=d.rows;settings=d.settings;world=accelerateWorld(new CoupledCloth(rows,{sdf,actor:d.actor,settings}),await loadClothKernel());for(let i=0;i<8;i++){world.step(1/30,false);self.postMessage({id:d.id,progress:(i+1)/8,phase:'初始化衣物互碰撞'});}world.initial=world.solvers.map(s=>s.p.slice());world.initialTime=world.elapsed;send(d.id,true);
 }else if(!world)throw Error('布料物理未初始化');
 else if(d.command==='step'){world.step(1/60);send(d.id);}
 else if(d.command==='settle'){const n=Math.max(1,Math.min(60,Math.ceil((d.seconds||.5)*30)));for(let i=0;i<n;i++){world.step(1/30);if(i%3===0)self.postMessage({id:d.id,progress:(i+1)/n,phase:'实际重力松弛'});}send(d.id,true);}
 else if(d.command==='tug'){world.tug();world.step(1/60);send(d.id);}
 else if(d.command==='reset'){world.reset();send(d.id,true);}
 else if(d.command==='settings'){settings={...settings,...d.settings};world.set(d.settings);send(d.id);}
 else if(d.command==='audit'){send(d.id,true);}
 else if(d.command==='bake'){const bytes=await bakeMotion(world,d.motion,{recipe:recipeKey(rows,settings),onProgress:p=>self.postMessage({id:d.id,progress:p,phase:'实算人物动作与两件衣物'})});self.postMessage({id:d.id,clip:bytes.buffer},[bytes.buffer]);}
 else throw Error('未知物理命令');
 }catch(e){self.postMessage({id:d.id,error:e.message,stack:e.stack});}};
