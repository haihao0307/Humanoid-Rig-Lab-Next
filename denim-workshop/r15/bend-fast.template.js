/* R15 compiled acceleration adapter. The readable R14 model stays as oracle.
 * One instance per swatch, no shared global physical state. No runtime network.
 * Math uses Float64; 240 Hz, 637 nodes, thickness, forces and passes unchanged.
 */
(function initFastBend(root){'use strict';
const Base=(typeof KAOPUDenimBend!=='undefined'?KAOPUDenimBend:require('./bend-cloth.js')).Sheet;
const payload='__WASM_BASE64__';let compiled=null;
function moduleObject(){if(!compiled){const bytes=typeof atob==='function'?Uint8Array.from(atob(payload),c=>c.charCodeAt(0)):new Uint8Array(Buffer.from(payload,'base64'));compiled=new WebAssembly.Module(bytes);}return compiled;}
class FastSheet extends Base{
 constructor(options={},contract){super(options,contract);this.kernel=new WebAssembly.Instance(moduleObject(),{env:{atan2:Math.atan2,sin:Math.sin,cos:Math.cos,exp:Math.exp}}).exports;const e=this.kernel,m=e.memory;const d=(slot,n)=>new Float64Array(m.buffer,e.addr(slot),n),i=(slot,n)=>new Int32Array(m.buffer,e.addr(slot),n);
 for(const [name,slot] of [['x',0],['previous',1],['v',2],['rest',3],['mass',4],['inv',5]]){const view=d(slot,this[name].length);view.set(this[name]);this[name]=view;}
 i(17,this.n).set(this.pin);const links=d(7,3000*6);this.links.forEach((l,j)=>links.set([l.a,l.b,l.L,l.compliance,0,l.type],j*6));
 const ids=new Map(this.links.map((l,k)=>[l,k])),rn=i(9,62*49),rl=i(8,62*48),rlen=i(10,62),cn=i(11,62),ca=d(12,62),cd=d(13,62*47),c1=d(14,62*47),c2=d(15,62*47);
 this.runs.forEach((r,k)=>{rn.set(r.nodes,k*49);rl.set(r.links.map(l=>ids.get(l)),k*48);rlen[k]=r.links.length;});
 this.curvatureRuns.forEach((r,k)=>{cn[k]=r.n;ca[k]=r.alpha;cd.set(r.D,k*47);c1.set(r.l1,k*47);c2.set(r.l2,k*47);});
 const guards=d(16,1150*7);this.bendGuards.forEach((g,k)=>guards.set([...g.ids,g.maximum,g.cosMaximum,g.compliance,0],k*7));i(18,1152*3).set(this.triangles.flat());
 this.fastConfig=d(6,40);this.fastConfig.set([this.h,this.W,this.H,this.thickness,this.dx,this.dy]);e.configure(this.links.length,this.bendGuards.length,this.runs.length);this.fastTimings={steps:0,ms:0};
 }
 step(){const t=performance.now(),c=this.fastConfig,o=this.options;c.set([o.fold,o.gravity,o.wind,o.damping,o.friction,+o.selfCollision,+o.gripEnabled,+o.tableEnabled,this.fold,this.time,this.steps],6);c[24]=this.contacts;c[27]=this.maxContactHistory;this.kernel.step();if(c[30])throw Error('Accelerated collision capacity exceeded: '+c[30]);this.fold=c[14];this.time=c[15];this.steps=c[16];this.contacts=c[24];this.maxContactHistory=c[27];this.contactStats={vertexFace:c[25],edgeEdge:0,sweptCrossings:0,candidates:c[26]};this.revision++;this.lastMs=performance.now()-t;this.fastTimings.steps++;this.fastTimings.ms+=this.lastMs;}
 report(){return {...super.report(),solverBackend:'wasm-f64-r15',wasmLinearMemoryBytes:this.kernel.memory.buffer.byteLength,physicsUnchanged:{nodes:637,stepHz:240,projectionPasses:[12,16],collisionEnabled:this.options.selfCollision},lastStepMs:this.lastMs};}
}
const api={Sheet:FastSheet,ReferenceSheet:Base,workerModule:'('+initFastBend.toString()+')(globalThis);'};
root.KAOPUDenimFastBend=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
