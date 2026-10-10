const fs=require('fs');
const{T,makeProduct,productMaterials,productAudit,ProductShell,SeamPath}=require('./node-lib.cjs');
const report={checks:[],products:[],scope:'Deterministic CPU tests. Preview tessellation is used for aperture ray tests; product physics topology is independently generated from the same dimensions. These are not real-material measurements.'};
function check(name,pass,detail){report.checks.push({name,pass:!!pass,detail});fs.writeFileSync(__dirname+'/qa-numerics.json',JSON.stringify(report,null,2));if(!pass)throw Error(name);}
try{
 for(const id of ['wallet','belt','bag','cowboy','pirate','swatch']){
  const root=makeProduct(id,productMaterials(new T.MeshStandardMaterial()),{thumbnail:true}),rig=root.userData.rig;root.updateMatrixWorld(true);
  const audits=productAudit(root);check(id+' contains continuous through-hole yarn rather than detached sticks',audits.finite&&audits.continuousThreadMeshes>0&&audits.detachedSticks===0);
  let tested=0,blocked=[];
  for(const part of rig.parts)for(const path of part.paths)for(let i=3;i<path.holes.length-3;i+=Math.max(1,Math.floor(path.holes.length/7))){
   const h=path.holes[i],f=path.frame(h.s),d=path.field(h.s,0),u=f.uv.x+f.tangent.x*d[0]/f.metric.u-f.tangent.y*d[2]/f.metric.v,v=f.uv.y+f.tangent.y*d[0]/f.metric.u+f.tangent.x*d[2]/f.metric.v,p=part.map(u,v),normal=part.normal(u,v);p.y+=rig.bindingShift;p.addScaledVector(normal,part.t/2+1);
   const hits=new T.Raycaster(p,normal.clone().negate(),.001,part.t+2).intersectObject(part.mesh,false);tested++;if(hits.length)blocked.push({part:part.name,hole:i,distance:hits[0].distance});
  }
  check(id+' sampled needle-hole centres are actually open through the leather mesh',tested>0&&blocked.length===0,{tested,blocked});
  const solver=new ProductShell(rig.data),ids=rig.data.triangles[Math.floor(rig.data.triangles.length*.42)].slice(0,3),p=[0,0,0];for(const i of ids)for(let j=0;j<3;j++)p[j]+=solver.x[3*i+j]*1000/3;
  solver.pick(ids,[1/3,1/3,1/3],p);let peak=1;
  // This is a test input to the grab target, not a deformation prescription.
  for(let k=0;k<200;k++){solver.move([p[0]+Math.sin(k/30)*45,p[1]+Math.min(180,k),p[2]+Math.sin(k/40)*15]);solver.step();peak=Math.max(peak,solver.report().maxStretch);}
  const held=solver.report(),before=solver.x.slice();let energyBefore=0;for(let i=0;i<solver.inv.length;i++)for(let j=0;j<3;j++)energyBefore+=.5*solver.mass[i]*solver.v[3*i+j]**2;
  solver.release();for(let k=0;k<50;k++){solver.step();peak=Math.max(peak,solver.report().maxStretch);}const released=solver.report();
  check(id+' held and released shell stays finite in the test envelope',held.finite&&released.finite&&!released.failed&&peak<1.25,{peak,held,released});
  check(id+' release preserves nonzero velocity and subsequent motion',energyBefore>1e-9&&released.timeS>held.timeS&&!released.held&&solver.x.some((x,i)=>Math.abs(x-before[i])>.0005),{energyBefore});
  check(id+' response is non-rigid rather than whole-object translation',held.maxEdgeChangeMM>.01,{edgeChangeMM:held.maxEdgeChangeMM});
  report.products.push({id,aperturesTested:tested,held,released,peakStretch:peak});
  root.traverse(o=>{o.geometry?.dispose();});rig.texture.dispose();
 }
 const makeSeam=tension=>new SeamPath([[-45,0],[45,0]],(u,v)=>new T.Vector3(u,v,0),{totalThickness:1.4,tension});
 const free=makeSeam(0),normal=makeSeam(.8),tight=makeSeam(1.6);
 const minimum=p=>p.contact.stats.minDisplacementMM;
 check('zero tension removes load-generated surface displacement',Math.abs(minimum(free))<1e-10,free.contact.stats);
 check('greater tension produces a greater inherited R05 local response',minimum(tight)<minimum(normal)&&minimum(normal)<0,{normal:normal.contact.stats,tight:tight.contact.stats});
 const off=new SeamPath([[-45,0],[45,0]],(u,v)=>new T.Vector3(u,v,0),{totalThickness:1.4,tension:.8,response:false});
 check('response comparison really disables the local field',Math.abs(minimum(off))<1e-10);
 const specimen=t=>({positions:[0,100,0,50,100,0,0,100,50,50,100,50],triangles:[[0,2,1,t,0],[1,2,3,t,0]]});
 const a=new ProductShell(specimen(.7)),b=new ProductShell(specimen(1.4)),c=new ProductShell(specimen(2.8));
 check('same surface area mass follows thickness',Math.abs(b.totalMass/a.totalMass-2)<1e-10&&Math.abs(c.totalMass/b.totalMass-2)<1e-10);
 check('same shell hinge bending stiffness follows thickness cubed',Math.abs(b.bends[0].k/a.bends[0].k-8)<1e-10&&Math.abs(c.bends[0].k/b.bends[0].k-8)<1e-10,{stiffness:[a.bends[0].k,b.bends[0].k,c.bends[0].k]});
 report.pass=true;
}catch(e){report.pass=false;report.failure=e.message;console.error(e.message);}
fs.writeFileSync(__dirname+'/qa-numerics.json',JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,checks:report.checks.length,failure:report.failure}));process.exitCode=report.pass?0:1;
