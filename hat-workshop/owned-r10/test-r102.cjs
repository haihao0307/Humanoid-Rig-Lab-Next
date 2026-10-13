const fs=require('fs'),path=require('path');require('./src/catalog.js');require('./src/shape.js');const H=globalThis.HAT10;
const report={version:H.version,scope:'Crease roof samples and implementation invariants; not whole-surface collision clearance.',checks:[],passed:false};
function check(name,ok,detail){report.checks.push({name,passed:!!ok,detail});if(!ok)throw Error(name+': '+JSON.stringify(detail));}
try{
 check('version',H.version==='HAT-R10.2');
 for(const head of H.heads)for(const height of [.75,1,1.25])for(const thickness of [.6,1.6])for(const ease of [1,6]){
  const s={...H.defaults('pinch'),head:head.id,height,thickness,ease},d=H.generate(s),p=d.pieces.find(p=>p.name==='crown'),n=p.position.length/6,top=n+48*113;
  const y=p.position[top*3+1],id=[head.id,height,thickness,ease].join('/');
  check('recess roof clearance '+id,y>=d.head.top+ease/1000+.0019,{innerCenterY:y,headTop:d.head.top,easeMM:ease});
  check('bounded crease '+id,d.stats.crownRecessMetres>=0&&d.stats.crownRecessMetres<=.017);
 }
 const d=H.generate(H.defaults('pinch'));check('default center crease visible depth',d.stats.crownRecessMetres>=.015,d.stats.crownRecessMetres);
 const m=fs.readFileSync(path.join(__dirname,'src/material.js'),'utf8'),v=fs.readFileSync(path.join(__dirname,'src/viewer.js'),'utf8');
 check('integer noise not old sine magic constants',m.includes('uint ownMixWord')&&!m.includes('43758.5453')&&!m.includes('127.1,311.7,74.7'));
 check('bounded normal perturbation',m.includes('.60/max(length(ownSlope)'));
 check('thumbnail display pipeline',v.includes('display-srgb-tone-mapped')&&v.includes('drawImage(renderer.domElement')&&!v.includes('readRenderTargetPixels'));
 check('thumbnail state restored even on error',v.includes('finally{renderer.setSize(size.x,size.y,false);renderer.setRenderTarget(was);draw();}'));
 report.passed=true;
}catch(e){report.failure=String(e.stack);process.exitCode=1;}
fs.mkdirSync(path.join(__dirname,'qa'),{recursive:true});fs.writeFileSync(path.join(__dirname,'qa/r102.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,failure:report.failure}));
