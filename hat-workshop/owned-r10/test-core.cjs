const fs=require('fs'),path=require('path'),crypto=require('crypto');
require('./src/catalog.js');require('./src/shape.js');const H=globalThis.HAT10;
const report={version:H.version,checks:[],records:[],passed:false};
function check(name,ok,detail){report.checks.push({name,passed:!!ok,detail});if(!ok)throw Error(name+': '+JSON.stringify(detail));}
function hash(d){const h=crypto.createHash('sha256');for(const p of d.pieces)h.update(new Uint8Array(p.position.buffer));return h.digest('hex');}
function topology(p){
 const keys=new Map(),ids=[];for(let i=0;i<p.position.length;i+=3){const k=[0,1,2].map(j=>Math.round(p.position[i+j]*1e6)).join(',');if(!keys.has(k))keys.set(k,keys.size);ids.push(keys.get(k));}
 const edges=new Map();for(let i=0;i<p.index.length;i+=3){const t=[0,1,2].map(j=>ids[p.index[i+j]]);if(new Set(t).size!==3)continue;for(let j=0;j<3;j++){const a=t[j],b=t[(j+1)%3],k=Math.min(a,b)+':'+Math.max(a,b);edges.set(k,(edges.get(k)||0)+1);}}
 return{boundary:[...edges.values()].filter(x=>x===1).length,nonmanifold:[...edges.values()].filter(x=>x>2).length};
}
try{
 const hashes=new Set();
 for(const head of H.heads)for(const c of H.categories){
  const s={...H.defaults(c.id),head:head.id},d=H.generate(s),h=hash(d);hashes.add(h);
  let topologySummary={boundary:0,nonmanifold:0};
  for(const p of d.pieces){
   check(`${head.id}/${c.id}/${p.name} finite`,[...p.position,...p.normal,...p.uv].every(Number.isFinite));
   check(`${head.id}/${c.id}/${p.name} indices`,p.index.every(i=>i>=0&&i<p.position.length/3));
   check(`${head.id}/${c.id}/${p.name} positive thickness`,p.thickness>0);
   if(head.id==='oval'&&['crown','brim-core','wear-band'].includes(p.name)){
    const t=topology(p);topologySummary.boundary+=t.boundary;topologySummary.nonmanifold+=t.nonmanifold;
    check(`${c.id}/${p.name} closed volume`,t.boundary===0&&t.nonmanifold===0,t);
   }
  }
  check(`${head.id}/${c.id} memory budget`,d.stats.bytes<4*1024*1024,d.stats.bytes);
  check(`${head.id}/${c.id} shape footprint`,d.bounds.max[0]-d.bounds.min[0]>.13&&d.bounds.max[0]-d.bounds.min[0]<.6);
  report.records.push({id:c.id,head:head.id,hash:h,stats:d.stats,topologySummary});
 }
 check('all category/head combinations distinct',hashes.size===33,hashes.size);
 for(const c of H.categories){
  const first=H.generate(H.defaults(c.id));check(c.id+' deterministic',hash(first)===hash(H.generate(H.defaults(c.id))));
  for(const end of [0,1]){const s=H.defaults(c.id);for(const[k,v]of Object.entries(H.parameters))s[k]=v[end];const d=H.generate(s);check(c.id+' extreme '+end+' finite',d.pieces.every(p=>p.position.every(Number.isFinite)));}
 }
 const s=H.defaults();check('reject legacy data',(()=>{try{H.sanitize({schema:'legacy',id:'pinch'});return false;}catch{return true;}})());
 check('reject nonfinite input',(()=>{try{H.sanitize({...s,height:Infinity});return false;}catch{return true;}})());
 check('reject non-color injection',(()=>{try{H.sanitize({...s,color:'url(https://example.com/a)'});return false;}catch{return true;}})());
 const dependencies=[];
 for(const f of ['src/catalog.js','src/shape.js','src/material.js','src/viewer.js']){
  const text=fs.readFileSync(path.join(__dirname,f),'utf8');check(f+' no legacy or external asset access',!/(r0[1-9]\/|makehuman|sourceOBJ|sourceAssetCommit|\.webp|\.obj|\.glb|fetch\(|XMLHttpRequest|importScripts)/i.test(text));dependencies.push({file:f,sha256:crypto.createHash('sha256').update(text).digest('hex')});
 }
 report.sourceAudit={dependencies,domainAssetFiles:0,scope:'static dependency/format audit; not a legal clearance or formal clean-room certification'};
 report.passed=true;
}catch(e){report.failure=String(e.stack||e);process.exitCode=1;}
fs.mkdirSync(path.join(__dirname,'qa'),{recursive:true});fs.writeFileSync(path.join(__dirname,'qa/core.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,failure:report.failure}));
