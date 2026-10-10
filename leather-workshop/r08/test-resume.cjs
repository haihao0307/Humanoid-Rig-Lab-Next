'use strict';
const fs=require('fs');
const {T,makeProduct,productMaterials,ProductShell,SeamPath}=require('./node-lib.cjs');
const report={checks:[],products:[],scope:'R07.2 deterministic reference-unit regression; these are simulated results, not measurements.'};
function check(name,pass,detail){report.checks.push({name,pass:!!pass,detail});if(!pass)throw Error(name);}
try{
 for(const id of ['wallet','belt','bag','cowboy','pirate','swatch']){
  const root=makeProduct(id,productMaterials(new T.MeshStandardMaterial()),{thumbnail:true}),rig=root.userData.rig,s=new ProductShell(rig.data),q=rig.data.triangles[Math.floor(rig.data.triangles.length*.42)].slice(0,3),p=[0,0,0];
  for(const n of q)for(let j=0;j<3;j++)p[j]+=s.x[n*3+j]*1000/3;
  s.pick(q,[1/3,1/3,1/3],p);let peak=1,seamPeak=0;for(let k=0;k<200;k++){s.move([p[0]+Math.sin(k/30)*45,p[1]+Math.min(180,k),p[2]+Math.sin(k/40)*15]);s.step();const r=s.report();peak=Math.max(peak,r.maxStretch);seamPeak=Math.max(seamPeak,r.maxSeamGapErrorMM);}
  const held=s.report(),before=s.x.slice(),velocity=s.v.slice();s.release();for(let k=0;k<50;k++){s.step();peak=Math.max(peak,s.report().maxStretch);}const released=s.report();
  check(id+' held/released no numerical failure',held.finite&&released.finite&&!released.failed&&peak<1.25,{held,released,peak});
  check(id+' release conserves existing velocity and continues deforming',velocity.some(v=>Math.abs(v)>.001)&&s.x.some((x,i)=>Math.abs(x-before[i])>.0005));
  if(id==='wallet')check('pocket seam stays joined through weighted material coordinates',held.seamConstraintCount>=90&&seamPeak<1,{seamPeak,count:held.seamConstraintCount});
  report.products.push({id,held,released,peak,seamPeak});root.traverse(o=>o.geometry?.dispose());rig.texture.dispose();console.log(id,peak,seamPeak);
 }
 const seam=t=>new SeamPath([[-40,0],[40,0]],(x,z)=>new T.Vector3(x,0,z),{totalThickness:1.4,tension:t});
 const a=seam(0),b=seam(.8),c=seam(1.6);check('local plate response varies with thread loading',a.contact.stats.minDisplacementMM===0&&c.contact.stats.minDisplacementMM<b.contact.stats.minDisplacementMM&&b.contact.stats.minDisplacementMM<0);
 const specimen=t=>({positions:[0,100,0,50,100,0,0,100,50,50,100,50],triangles:[[0,2,1,t,0],[1,2,3,t,0]]});
 const thin=new ProductShell(specimen(.7)),thick=new ProductShell(specimen(1.4));check('thickness affects mass and cubic bending',Math.abs(thick.totalMass/thin.totalMass-2)<1e-10&&Math.abs(thick.bends[0].k/thin.bends[0].k-8)<1e-10);
 report.pass=true;
}catch(e){report.pass=false;report.failure=e.stack;console.error(e.stack);}
fs.writeFileSync(__dirname+'/qa-resume.json',JSON.stringify(report,null,2));process.exitCode=report.pass?0:1;
