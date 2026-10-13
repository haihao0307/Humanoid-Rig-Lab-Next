'use strict';
// Mock delivery for queue invariants; unchanged real Cloth for trajectory parity.
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const parent=path.resolve(__dirname,'../r12'),D=require('./dynamics.js'),Old=require(path.join(parent,'dynamics.js'));
const instances=[];
global.Worker=class {constructor(){this.sent=[];instances.push(this);}postMessage(m){this.sent.push(m);}emit(m){this.onmessage({data:m});}};
const gl=new Proxy({getExtension:()=>false,createTexture:()=>({})},{get:(o,k)=>k in o?o[k]:(typeof k==='string'&&k===k.toUpperCase()?0:()=>{})});
const contract={widthMm:100,heightMm:72,released:[]};
const report={passed:false,checks:[],limitations:['Controlled mock delivery for transport invariants','Real unchanged solver parity is not physical calibration','Browser and public access require separate QA']};
function create(mod=D){const c=mod.create(gl,()=>{}),w=instances.at(-1);c.configure(contract);return {c,w};}
function last(w){return w.sent.filter(m=>m.type==='sample').at(-1);}
function reply(c,w,m,steps=0,generation=c.generation){w.emit({type:'sample',generation,requestId:m.requestId,commandEpoch:m.commandEpoch,grid:new Float32Array(475*4),curves:new Float32Array(9*4),report:{steps}});}
function check(name,fn){fn();report.checks.push(name);console.log('PASS',name);}
try {
 check('Parent reproduces lost post-reset sampling',()=>{const {c,w}=create(Old),s=last(w);c.reset();reply(c,w,s,24);A.equal(w.sent.filter(m=>m.type==='sample').length,1);A.equal(c.report.steps,24);report.originalRace={sampleRequests:1,acceptedPreResetSteps:24};});
 check('Reset during pending sample delivers fresh zero-step state',()=>{const {c,w}=create(),s=last(w);c.reset();reply(c,w,s,24);A.equal(c.report,null);A.equal(w.sent.filter(m=>m.type==='sample').length,2);reply(c,w,last(w),0);A.equal(c.report.steps,0);A.equal(c.pending,false);});
 check('Twenty requests coalesce into only one follow-up',()=>{const {c,w}=create(),s=last(w);for(let i=0;i<20;i++)c.sample();A.equal(w.sent.filter(m=>m.type==='sample').length,1);reply(c,w,s,24);A.equal(w.sent.filter(m=>m.type==='sample').length,2);reply(c,w,last(w),25);A.equal(c.pending,false);A.equal(c.report.steps,25);A.equal(w.sent.filter(m=>m.type==='sample').length,2);});
 check('Duplicate old reply cannot clear or replace current request',()=>{const {c,w}=create(),s=last(w);c.sample();reply(c,w,s,24);const latest=last(w);reply(c,w,s,999);A.equal(c.pending,true);A.equal(c.report.steps,24);reply(c,w,latest,25);A.equal(c.report.steps,25);});
 check('Previous topology generation cannot overwrite rebuilt cloth',()=>{const {c,w}=create(),s=last(w),g=c.generation;c.configure(contract);const latest=last(w);reply(c,w,s,999,g);A.equal(c.report,null);A.equal(c.pending,true);reply(c,w,latest,0);A.equal(c.report.steps,0);});
 check('Reset, kick, step and anchors are never coalesced',()=>{const {c,w}=create(),s=last(w);for(const t of ['reset','reset','kick','step','anchors'])c.send(t,{seconds:.1});c.sample();for(const t of ['reset','kick','step','anchors'])A.equal(w.sent.filter(m=>m.type===t).length,t==='reset'?2:1);reply(c,w,s,24);A.equal(c.report,null);reply(c,w,last(w),48);A.equal(c.report.steps,48);});
 check('Latest controls invalidate older sample without stopping simulation',()=>{const {c,w}=create(),s=last(w);for(let i=0;i<12;i++)c.send('controls',{options:{wind:i/10}});reply(c,w,s,24);A.equal(c.report,null);A.equal(w.sent.filter(m=>m.type==='controls').length,12);reply(c,w,last(w),30);A.equal(c.report.steps,30);});
 check('Accepted ordinary sample does not create an endless request loop',()=>{const {c,w}=create();reply(c,w,last(w),12);A.equal(c.report.steps,12);A.equal(c.pending,false);A.equal(w.sent.filter(m=>m.type==='sample').length,1);});
 check('Unknown request cannot clear pending sample',()=>{const {c,w}=create(),s=last(w);reply(c,w,{...s,requestId:s.requestId+100},999);A.equal(c.report,null);A.equal(c.pending,true);reply(c,w,s,1);A.equal(c.report.steps,1);});
 check('Worker protocol echoes command epoch and request',()=>{const src=fs.readFileSync(path.join(__dirname,'dynamics.js'),'utf8');A.ok(src.includes('requestId:m.requestId,commandEpoch:m.commandEpoch'));});
 check('Cloth solver and physical shader are byte-for-byte unchanged',()=>{A.equal(D.Cloth.toString(),Old.Cloth.toString());A.equal(D.glsl,Old.glsl);A.equal(D.shader(true),Old.shader(true));A.equal(D.shader(false),Old.shader(false));});
 check('Intact and damaged real solver trajectories remain identical',()=>{const C=require('./core.js'),N=require('./natural-yarn.js'),T=require('./cloth-topology.js');for(const damage of [0,4]){const state={shape:1,structure:.7,damage,thickness:.7,slub:.25,cotton:.78,gsm:450,autoMass:true,warpStiffness:1,weftStiffness:1,bendStiffness:1},g=C.compile(state),n=N.generate(C,g,damage,1,{micro:false}),cfg=T.input(N,g,n,state),a=new D.Cloth({wind:1.1,drive:true},cfg),b=new Old.Cloth({wind:1.1,drive:true},cfg);for(let i=0;i<120;i++){a.step();b.step();}A.deepEqual(a.x,b.x);A.deepEqual(a.v,b.v);A.deepEqual(a.report(),b.report());}});
 report.passed=true;
} finally {fs.writeFileSync(path.join(__dirname,'client-qa.json'),JSON.stringify(report,null,2));}
