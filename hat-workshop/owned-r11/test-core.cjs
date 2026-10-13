const fs=require('fs'),path=require('path'),crypto=require('crypto');
require('./src/catalog.js');require('./src/shape.js');require('./src/field.js');
const H=globalThis.HAT10,R=__dirname,report={version:H.version,checks:[],records:[],passed:false,scope:'Geometry and sampled rest-shape fit only; does not establish film quality, dynamic physics or whole-surface intersection freedom.'};
function save(){fs.mkdirSync(path.join(R,'qa'),{recursive:true});fs.writeFileSync(path.join(R,'qa/core.json'),JSON.stringify(report,null,2));}
function check(name,ok,detail=null){report.checks.push({name,passed:!!ok,detail});if(!ok)throw Error(name+': '+JSON.stringify(detail));}
function hash(d){const h=crypto.createHash('sha256');for(const p of d.pieces){h.update(new Uint8Array(p.position.buffer));h.update(new Uint8Array(p.index.buffer));}return h.digest('hex');}
function valid(d,label){
 let bytes=0,valid=true,reason='';
 for(const p of d.pieces){
  const n=p.position.length/3;
  for(const name of ['position','normal','uv','index']){bytes+=p[name].byteLength;if(!p[name].every(Number.isFinite)){valid=false;reason=p.name+'/'+name;}}
  if(p.normal.length!==p.position.length||p.uv.length!==n*2||p.index.length%3||!p.index.every(i=>i>=0&&i<n)){valid=false;reason=p.name+'/layout';}
  if(p.groups.reduce((s,g)=>s+g.count,0)!==p.index.length){valid=false;reason=p.name+'/groups';}
 }
 check(label+' finite indexed surfaces',valid,reason);check(label+' measured array bytes',bytes===d.stats.bytes&&bytes<16*1024*1024,bytes);
 check(label+' valid metre bounds',d.bounds.min.every((v,i)=>v<d.bounds.max[i])&&d.bounds.max.every(v=>Math.abs(v)<1));
}
function closed(p){
 const map=new Map(),ids=[];let next=0;for(let i=0;i<p.position.length;i+=3){const k=[0,1,2].map(j=>Math.round(p.position[i+j]*1e6)).join(',');if(!map.has(k))map.set(k,next++);ids.push(map.get(k));}
 const edges=new Map();for(let i=0;i<p.index.length;i+=3){const t=Array.from(p.index.slice(i,i+3),x=>ids[x]);if(new Set(t).size<3)continue;for(let j=0;j<3;j++){const a=t[j],b=t[(j+1)%3],k=a<b?a+','+b:b+','+a;edges.set(k,(edges.get(k)||0)+1);}}
 return {boundary:[...edges.values()].filter(n=>n!==2).length,edges:edges.size};
}
try{
 check('version',H.version==='HAT-R11.0');check('eleven distinct categories',H.categories.length===11&&new Set(H.categories.map(c=>c.id)).size===11);
 for(const c of H.categories)for(const head of H.heads){const s={...H.defaults(c.id),head:head.id},d=H.generate(s);valid(d,c.id+'/'+head.id);report.records.push({id:c.id,head:head.id,hash:hash(d),...d.stats});}
 const s=H.defaults('field'),d=H.generate(s);
 check('new field construction retained',['tailored-crown','crown-top-panel','laminated-curved-peak','lower-felled-band','cotton-sweatband','metric-lockstitches','peak-root-bartacks'].every(name=>d.pieces.some(p=>p.name===name)));
 check('lower independent wear plane and crown',d.stats.wearPlaneMetres===.033&&d.stats.effectiveCrownHeight<.090,d.stats);
 check('actual stitch scale',d.stats.stitchPitchMetres===.003&&d.stats.threadDiameterMetres===.0003);
 check('deterministic field generation',hash(d)===hash(H.generate(s)));
 for(const name of ['tailored-crown','crown-top-panel','lower-felled-band','cotton-sweatband','laminated-curved-peak']){const out=closed(d.pieces.find(p=>p.name===name));check('closed major piece '+name,out.boundary===0,out);}
 const keys=['height','fullness','brim','thickness','circumference','ease'];
 for(const key of keys){const value=H.parameters[key][1],x=H.generate({...s,[key]:value});check('field parameter responds '+key,hash(x)!==hash(d));valid(x,'field/'+key+'-max');}
 for(const head of H.heads)for(const circumference of [52,64])for(const height of [.75,1.25]){
  const spec={...s,head:head.id,circumference,height,thickness:1.6,ease:1},x=H.generate(spec);valid(x,'field-extreme/'+head.id+'/'+circumference+'/'+height);
  let min=1,samples=0;for(const p of x.pieces.filter(p=>/^(tailored-crown|crown-top-panel)$/.test(p.name)))for(let i=p.position.length/2;i<p.position.length;i+=3){const [a,y,b]=p.position.slice(i,i+3);if(y>=.033&&y<.10){min=Math.min(min,(Math.hypot(a/x.head.a,b/x.head.b)-H.headRadius(y))*Math.min(x.head.a,x.head.b));samples++;}}
  check('sampled inner crown head clearance '+head.id+'/'+circumference+'/'+height,min>=-.0001,{minimumMetres:min,samples});
 }
 let error=false;try{H.sanitize({...s,height:Infinity});}catch(e){error=true;}check('reject nonfinite recipe',error);
 const names=['catalog','shape','field','material','studio','viewer'];
 const text=names.map(n=>fs.readFileSync(path.join(R,'src',n+'.js'),'utf8')).join('\n');
 check('no external hat-asset loader in runtime',!/(GLTFLoader|OBJLoader|TextureLoader|https?:\/\/|\.glb\b|\.gltf\b|\.webp\b|data:image\/(jpeg|png);base64)/i.test(text));
 report.passed=true;
}catch(e){report.failure=String(e.stack);process.exitCode=1;}finally{save();console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,failure:report.failure}));}
