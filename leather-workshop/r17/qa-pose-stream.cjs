/** Real numerical worker replay under a deterministic stalled-consumer loop. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const R=__dirname,lib=require('./node-lib.cjs'),refCode=fs.readFileSync(path.join(R,'out/reference-worker.js'),'utf8'),newCode=fs.readFileSync(path.join(R,'out/candidate-worker.js'),'utf8');
const checks=[];function ok(name,b,data){checks.push({name,pass:!!b,data});assert(b,name);}
function worker(code){let now=0,id=0;const pending=new Map(),output=[];const self={postMessage:m=>output.push(structuredClone(m))};const ctx=vm.createContext({self,console,performance:{now:()=>now},setTimeout:f=>{pending.set(++id,f);return id;},clearTimeout:i=>pending.delete(i),atob,WebAssembly,Float64Array,Float32Array,Uint8Array,Int32Array,Map,Set,Math});const i=code.lastIndexOf('})();');assert(i>=0);code=code.slice(0,i)+';self.inspect=()=>({x:Array.from(shell.x),steps:shell.steps,time:shell.time,active:shell.active,held:!!shell.grab,failed:shell.failed,report:shell.report(),audit:()=>shell.contact.audit(shell.x)});'+code.slice(i);vm.runInContext(code,ctx);return {output,pending,self,send:m=>self.onmessage({data:structuredClone(m)}),tick:()=>{assert(pending.size>0);const [id,f]=pending.entries().next().value;pending.delete(id);now+=1000/120;f();},state:()=>self.inspect()};}
for(const product of ['wallet','belt','bag','cowboy','pirate','swatch']){
 const root=lib.makeProduct(product,lib.productMaterials(new lib.T.MeshStandardMaterial()),{craft:product==='swatch'?'diamond':'plain'}),data=root.userData.rig.data;
 const a=worker(refCode),b=worker(newCode);a.send({id:1,op:'init',data,options:{}});b.send({id:1,op:'init',data,options:{}});
 const ids=data.triangles[Math.floor(data.triangles.length*.42)].slice(0,3),point=[0,0,0];for(const id of ids)for(let k=0;k<3;k++)point[k]+=data.positions[3*id+k]/3;
 const pick={id:2,op:'pick',ids,weights:[1/3,1/3,1/3],point,epoch:1,inputSequence:1};a.send(pick);b.send(pick);a.output.length=b.output.length=0;let maxDiff=0;
 for(let j=0;j<52;j++){
  if(j<36){const p=[point[0]+Math.sin(j/10)*8,point[1]+Math.min(35,j*1.2),point[2]+Math.sin(j/13)*4];const m={op:'move',point:p,epoch:1,inputSequence:j+2};a.send(m);b.send(m);}
  if(j===36){a.send({id:3,op:'release',epoch:2});b.send({id:3,op:'release',epoch:2});}
  a.tick();b.tick();const x=a.state(),y=b.state();for(let i=0;i<x.x.length;i++)maxDiff=Math.max(maxDiff,Math.abs(x.x[i]-y.x[i]));assert.equal(x.steps,y.steps);assert.equal(x.time,y.time);assert.equal(y.failed,null);
 }
 const auto=b.output.filter(m=>m.poseSerial),refPoses=a.output.filter(m=>m.positions);
 ok(product+' one autonomous payload while main handler is stalled',auto.length===1,{referencePoses:refPoses.length,candidatePoses:auto.length});
 ok(product+' all52 steps exact without acknowledgements',maxDiff===0&&b.state().steps===52,{maxPositionDifferenceMM:maxDiff*1000,steps:b.state().steps,time:b.state().time});
 const token=auto[0].poseSerial;b.send({op:'poseAck',serial:token});const latest=b.output.at(-1);ok(product+' renewed credit publishes latest real state',latest.report.steps===52&&latest.positions.every((x,i)=>x===b.state().x[i]));
 const count=b.output.length;b.send({op:'poseAck',serial:token});ok(product+' duplicate acknowledgement ignored',b.output.length===count);
 const old=latest.poseSerial;b.send({id:4,op:'reset',epoch:3});const afterReset=b.output.length;b.send({op:'poseAck',serial:old});ok(product+' stale credit cannot resurrect pre-reset pose',b.output.length===afterReset&&b.state().steps===0);
 b.send({id:5,op:'manualStep',count:3});ok(product+' explicit step bypasses credit and stays exact',b.state().steps===3&&b.output.at(-1).id===5&&!!b.output.at(-1).positions);
 const contact=b.state().audit();ok(product+' controlled manual state finite without penetration',!b.state().failed&&contact.penetrating===0);console.log(product,'52-step transport differential passed');
}
let made;class StubWorker{constructor(){made=this;this.sent=[];}postMessage(m){this.sent.push(m);}terminate(){this.dead=true;}}
class Base{constructor(){this.x=new Float64Array([0,0,0]);this.rest=this.x.slice();this.inv=new Float64Array([1]);this.cfg={};}report(){return {failed:null};}}
const ctx=vm.createContext({ProductShell:Base,PRODUCT_WORKER_CODE:'',Worker:StubWorker,URL:{createObjectURL:()=>'',revokeObjectURL:()=>{}},Blob:class{},performance:{now:()=>1},queueMicrotask:f=>f(),console});
vm.runInContext(fs.readFileSync(path.join(R,'src/workers/client.js'),'utf8')+';globalThis.make=()=>new ProductWorkerShell({});',ctx);const c=ctx.make();
made.onmessage({data:{id:1,positions:new Float64Array([0,0,0]),report:{failed:null}}});const n=made.sent.length;made.onmessage({data:{positions:new Float64Array([1,2,3]),poseSerial:7,report:{failed:null}}});ok('client acknowledges after accepting transferred pose',made.sent.length===n+1&&made.sent.at(-1).op==='poseAck'&&made.sent.at(-1).serial===7&&c.x[2]===3);
c.flushPose();ok('flush sends no duplicate acknowledgement',made.sent.length===n+1);const queued=made.onmessage;c.dispose();queued({data:{positions:new Float64Array([9,9,9]),poseSerial:8}});ok('disposed client cannot acknowledge or apply stale product',made.sent.length===n+1&&c.x[2]===3);
const out=path.join(R,'qa/s2b/pose-stream.json');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify({pass:true,checks,scope:'Real numerical worker in deterministic timer VM plus client wiring; not a browser performance claim'},null,2));console.log(JSON.stringify({pass:true,checks:checks.length}));
