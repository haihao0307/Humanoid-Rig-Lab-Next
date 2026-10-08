/* Built into an offline Blob Worker. The renderer never computes deformation. */
let sim=null,mode='stone',epoch=0;
function frame(){
 if(mode==='stone'){const r=sim.report();return{mode,epoch,report:r,positions:sim.x.slice(),rest:sim.rest.slice(),triangles:sim.tri.slice(),boundary:sim.boundary,stone:{pos:Array.from(sim.stone.pos),radius:sim.stone.radius,visible:sim.stone.visible},thickness:sim.cfg.thickness,config:sim.cfg};}
 const r=sim.report(),g=sim.geometry(),rest=new Float64Array(g.length);for(let i=0;i<sim.mesh.X.length/2;i++){rest[i*3]=sim.mesh.X[i*2]/1000;rest[i*3+2]=sim.mesh.X[i*2+1]/1000;}
 return{mode,epoch,report:{...r,nominalStrain:sim.strain,clampPullMM:sim.strain*sim.mesh.length,centerSagMM:0},positions:g,rest,triangles:sim.mesh.tri.slice(),boundary:sim.mesh.boundary,stone:null,thickness:sim.thickness/1000,config:{size:sim.mesh.length/1000,width:sim.mesh.width/1000,profile:sim.material.id,angle:sim.material.angle}};
}
self.onmessage=e=>{const m=e.data;const t=performance.now();try{
 if(m.op==='init'){mode=m.mode;epoch=m.epoch;sim=mode==='stone'?new LeatherDynamics(m.options):new ClampedLeather(m.options);}
 else if(!sim)throw Error('Initialize before command');
 else if(m.op==='step'){if(mode==='stone'){for(let i=0;i<(m.count||2);i++)sim.step();}else sim.solve(150);}
 else if(m.op==='drop')sim.drop();
 else if(m.op==='remove')sim.removeStone();
 else if(m.op==='clamp'){sim.command(m.strain);for(let i=0;i<25&&!sim.report().converged&&!sim.blocked;i++)sim.solve(100);}
 else if(m.op==='snapshot'){self.postMessage({id:m.id,epoch,snapshot:sim.snapshot()});return;}
 else throw Error('Unknown command');
 const f=frame();f.computeMS=performance.now()-t;self.postMessage({id:m.id,...f});
 }catch(error){self.postMessage({id:m.id,epoch,error:String(error.stack||error)});}
};
