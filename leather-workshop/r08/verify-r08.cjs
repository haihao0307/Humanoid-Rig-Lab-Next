const fs=require('fs'),{T,makeProduct,productMaterials,ProductShell,updateSkin}=require('./node-lib.cjs');
const report={checks:[],objects:[],scope:'Generated high-resolution geometry; welded incidence at 0.00001 mm; CPU evaluation of the same physics-node frames used by the vertex shader. Not real-leather calibration.'};
function check(name,pass,detail){report.checks.push({name,pass:!!pass,detail});fs.writeFileSync(__dirname+'/qa-closure.json',JSON.stringify(report,null,2));if(!pass)throw Error(name);}
function topology(g){const p=g.attributes.position,ix=g.index,edges=new Map(),ids=[],weld=new Map();let degenerate=0;
 for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e5)).join(',');if(!weld.has(key))weld.set(key,weld.size);ids.push(weld.get(key));}
 for(let i=0;i<ix.count;i+=3){const t=[ids[ix.getX(i)],ids[ix.getX(i+1)],ids[ix.getX(i+2)]];if(new Set(t).size<3){degenerate++;continue;}for(let j=0;j<3;j++){const a=t[j],b=t[(j+1)%3],k=Math.min(a,b)+':'+Math.max(a,b),e=edges.get(k)||{n:0,s:0};e.n++;e.s+=a<b?1:-1;edges.set(k,e);}}
 return{boundary:[...edges.values()].filter(e=>e.n===1).length,nonmanifold:[...edges.values()].filter(e=>e.n>2).length,opposedWindingErrors:[...edges.values()].filter(e=>e.n===2&&e.s!==0).length,degenerate};
}
function thickness(g){const p=g.attributes.position,n=g.userData.paperVertices,a=[];for(let i=0;i<n;i+=Math.max(1,Math.floor(n/80)))a.push(new T.Vector3().fromBufferAttribute(p,i).distanceTo(new T.Vector3().fromBufferAttribute(p,i+n)));return{min:Math.min(...a),max:Math.max(...a),count:a.length};}
try{
 for(const id of ['wallet','belt','bag','cowboy','pirate','jacket','swatch']){
  const start=Date.now(),root=makeProduct(id,productMaterials(new T.MeshStandardMaterial()),{}),rig=root.userData.rig,parts=rig.parts.map(p=>({name:p.name,topology:topology(p.mesh.geometry),thickness:thickness(p.mesh.geometry),geometry:p.mesh.geometry.userData}));
  for(const p of parts){check(id+'/'+p.name+' closed front-back-edge shell',p.topology.boundary===0&&p.topology.nonmanifold===0&&p.topology.opposedWindingErrors===0,p.topology);check(id+'/'+p.name+' generated thickness is positive',p.thickness.min>.15,p.thickness);}
  const solver=new ProductShell(rig.data),before=rig.pixels.slice();updateSkin(root,solver);let error=0;for(let i=0;i<before.length;i++)error=Math.max(error,Math.abs(before[i]-rig.pixels[i]));check(id+' rest-to-shader frame is identity',error<.0001,{maximumError:error});
  const ids=rig.data.triangles[Math.floor(rig.data.triangles.length*.42)].slice(0,3),p=[0,0,0];for(const i of ids)for(let j=0;j<3;j++)p[j]+=solver.x[i*3+j]*1000/3;solver.pick(ids,[1/3,1/3,1/3],p);
  for(let k=0;k<80;k++){solver.move([p[0]+Math.sin(k/25)*25,p[1]+Math.min(120,k*1.6),p[2]+Math.sin(k/35)*10]);solver.step();}const held=solver.report();solver.release();for(let k=0;k<40;k++)solver.step();const dropped=solver.report();check(id+' held and released simulation is finite',held.finite&&dropped.finite&&!dropped.failed&&dropped.peakStretch<1.18,{held,dropped});
  report.objects.push({id,parts,ms:Date.now()-start,nodes:rig.nodeCount,held,dropped});
 }
 for(const config of [{stitchStyle:'running'},{stitchStyle:'double'},{stitchStyle:'zigzag'},{stitchStyle:'cross'},{edgeFinish:'bound'},{craft:'diamond',loft:5},{craft:'grid'},{craft:'channels'},{craft:'perforated',holeShape:'slot'},{craft:'perforated',holeShape:'zone'},{craft:'woven'}]){
  const root=makeProduct('swatch',productMaterials(new T.MeshStandardMaterial()),{...config,thumbnail:true});let errors=[];for(const mesh of root.userData.rig.meshes)if(mesh.userData.leather){const t=topology(mesh.geometry);if(t.boundary||t.nonmanifold||t.opposedWindingErrors)errors.push({name:mesh.name,...t});}check(JSON.stringify(config)+' keeps actual shell closure',!errors.length,errors);
 }
 report.pass=true;
}catch(e){report.pass=false;report.failure=e.message;report.stack=e.stack;console.error(e.stack);}
fs.writeFileSync(__dirname+'/qa-closure.json',JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,checks:report.checks.length,failure:report.failure}));process.exitCode=report.pass?0:1;
