const fs=require('fs'),path=require('path'),crypto=require('crypto');
require('./src/catalog.js');require('./src/shape.js');const H=globalThis.HAT10;
const report={version:H.version,checks:[],passed:false,scope:'R10.1 parameter response and closed main shells on three analytic heads. Not collision or legal clearance.'};
function check(name,ok,detail){report.checks.push({name,passed:!!ok,detail});if(!ok)throw Error(name);}
function hash(d){const h=crypto.createHash('sha256');for(const p of d.pieces)h.update(new Uint8Array(p.position.buffer));return h.digest('hex');}
function topo(p){const map=new Map(),v=[],e=new Map();for(let i=0;i<p.position.length;i+=3){const k=[0,1,2].map(j=>Math.round(p.position[i+j]*1e6)).join(',');if(!map.has(k))map.set(k,map.size);v.push(map.get(k));}for(let i=0;i<p.index.length;i+=3){const t=[0,1,2].map(k=>v[p.index[i+k]]);if(new Set(t).size!==3)continue;for(let k=0;k<3;k++){const a=t[k],b=t[(k+1)%3],key=Math.min(a,b)+':'+Math.max(a,b);e.set(key,(e.get(key)||0)+1);}}return [...e.values()].filter(n=>n!==2).length;}
try{
 for(const h of H.heads){
  const a={...H.defaults('pleat'),head:h.id,fullness:.9},b={...a,fullness:1.12};
  const da=H.generate(a),db=H.generate(b);
  check(h.id+' chef fullness changes vertices',hash(da)!==hash(db));
  check(h.id+' chef fullness increases width',db.bounds.max[0]-db.bounds.min[0]>da.bounds.max[0]-da.bounds.min[0]);
  for(const c of H.categories){
   const d=H.generate({...H.defaults(c.id),head:h.id});
   for(const p of d.pieces.filter(p=>['crown','brim-core','wear-band'].includes(p.name))){const bad=topo(p);check(h.id+'/'+c.id+'/'+p.name+' closed edge incidence',bad===0,bad);}
   check(h.id+'/'+c.id+' reported height constraint',typeof d.stats.heightFitClamped==='boolean'&&d.stats.effectiveCrownHeight>=d.stats.requestedCrownHeight);
  }
 }
 check('source material uniforms survive compilation',fs.readFileSync(path.join(__dirname,'src/material.js'),'utf8').includes('Object.assign(sh.uniforms,m.userData.uniforms)'));
 report.passed=true;
}catch(e){report.failure=String(e.stack);process.exitCode=1;}
fs.mkdirSync(path.join(__dirname,'qa'),{recursive:true});fs.writeFileSync(path.join(__dirname,'qa/r101.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,failure:report.failure}));
