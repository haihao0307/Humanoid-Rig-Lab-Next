// Scheduler regressions using deterministic fake agents. This exercises task
// sequencing and clocks; it does not substitute for browser/physics validation.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const parse=(text,world,last)=>{if(/^搬运[ABC]$/.test(text))return{steps:[{type:'carry',objectId:text.at(-1),targetId:text.endsWith('C')?'ZB':'ZA'}],lastObject:last};if(!/^(打招呼|挥手|长动作|向前走1米)$/.test(text))throw Error('未知动作');return{steps:[{type:text}],lastObject:last};};
const sandbox={parse,structuredClone,console,npcCopy:v=>structuredClone(v),advanceRoutineEnvironment:()=>{}};vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL('../control/NPCPopulation.js',import.meta.url),'utf8')+'\nglobalThis.exports={NPCPopulation,npcTaskRecipe,npcCompileTask,npcIdleBehavior};',sandbox);
const {NPCPopulation,npcTaskRecipe,npcCompileTask,npcIdleBehavior}=sandbox.exports;
const recipe=command=>({type:'repeat',title:'test',command,intervalS:.5,cycleLimit:2});
function fixture(count=2){
 const p=Object.create(NPCPopulation.prototype);p.lab={world:{revision:0,routineState:{},get:()=>null},setAuto(){}};p.actors=new Map();p.selected=new Set();p.elapsedS=0;p.physicsDeferred=new Set();p.activeId='a';p.isReserved=()=>false;p.changed=()=>{};p.claims=new Map();p.stationClaims=new Map();p.physicsOwner=null;
 for(const id of 'abcdefgh'.slice(0,count)){
  const agent={npcId:id,time:0,pos:[0,0,0],paused:false,error:null,characterEditInProgress:false,remaining:0,calls:[],diversions:0,phase:'idle',activity(){const physicalBusy=this.remaining>0;return{physicalBusy,readyForTask:!physicalBusy&&!this.error,status:this.paused?'paused':physicalBusy?'running':'idle'};},submit(text){if(text.startsWith('搬运')){assert.equal(p.physicsOwner,id);assert.equal(p.claims.get(text.at(-1)),id);}this.calls.push(text);this.remaining=text==='长动作'?3:.2;},submitPlan(){this.diversions++;this.remaining=.2;},tick(dt){if(this.paused)return;this.time+=dt;this.remaining=Math.max(0,this.remaining-dt);if(this.failNext){this.failNext=false;this.error='injected task failure';}},cancel(){p.releaseObjects(this);this.remaining=0;this.error=null;this.paused=false;return{stopped:true};},log(){}};
  p.actors.set(id,{id,label:id,identity:{},agent,queue:[],behavior:npcIdleBehavior(),tissue:{update(){}},disposed:false});p.selected.add(id);
 }
 return p;
}
const advance=(p,seconds)=>{for(let i=0;i<Math.round(seconds/.01);i++)p.tickFixed(.01);};
let checks=0;const check=(fn)=>{fn();checks++;};
check(()=>assert.equal(npcCompileTask('1. 打招呼\n等待 2 分钟\n再挥手',{}).length,3));
check(()=>assert.equal(npcCompileTask('等待 2 分钟',{})[0].seconds,120));
check(()=>assert.throws(()=>npcCompileTask('打招呼\n不存在',{}),/第 2 步/));
check(()=>assert.throws(()=>npcTaskRecipe({...recipe('挥手'),cycleLimit:-1}),/轮数/));
check(()=>assert.throws(()=>npcTaskRecipe({...recipe('挥手'),durationS:Infinity}),/时长/));
check(()=>assert.throws(()=>npcCompileTask(Array(65).fill('挥手').join('\n'),{}),/1–64/));
{
 const p=fixture();p.setBehavior('a',recipe('打招呼\n等待 .2 秒\n挥手'.replace('.2','0.2')));advance(p,3);
 check(()=>assert.deepEqual(p.get('a').agent.calls,['打招呼','挥手','打招呼','挥手']));
 check(()=>assert.equal(p.get('a').behavior.cycles,2));check(()=>assert.equal(p.get('a').behavior.status,'completed'));
 check(()=>assert.equal(p.get('b').agent.calls.length,0));
}
{
 const p=fixture(),r={...recipe('等待 2 秒\n挥手'),cycleLimit:0};p.setBehavior('a',r);p.setBehavior('b',r);advance(p,.5);
 p.control('pause',['a']);const frozen=p.get('a').behavior.elapsedS;advance(p,3);
 check(()=>assert.equal(p.get('a').behavior.elapsedS,frozen));check(()=>assert.equal(p.get('a').agent.calls.length,0));check(()=>assert.equal(p.get('b').behavior.cycles,1));
 p.control('resume',['a']);advance(p,2);check(()=>assert.equal(p.get('a').behavior.cycles,1));
 p.control('stop',['a']);const calls=p.get('a').agent.calls.length;advance(p,4);check(()=>assert.equal(p.get('a').agent.calls.length,calls));check(()=>assert.equal(p.get('a').behavior.status,'stopped'));
}
{
 const p=fixture();p.setBehavior('a',{...recipe('长动作\n挥手'),cycleLimit:0,durationS:1});advance(p,1.2);
 check(()=>assert.equal(p.get('a').behavior.status,'finishing'));advance(p,3);
 check(()=>assert.deepEqual(p.get('a').agent.calls,['长动作']));check(()=>assert.equal(p.get('a').behavior.finishReason,'duration'));
}
{
 const p=fixture();p.setBehavior('a',{...recipe('等待 100 秒'),cycleLimit:0,durationS:1});advance(p,1.1);
 check(()=>assert.equal(p.get('a').behavior.cycles,0));check(()=>assert.equal(p.get('a').behavior.status,'completed'));
}
{
 const p=fixture();p.setBehavior('a',recipe('等待 2 秒'));const before=p.get('a').behavior;
 check(()=>assert.throws(()=>p.setBehavior('a',recipe('飞行')),/第 1 步/));check(()=>assert.equal(p.get('a').behavior,before));
 const exported=npcTaskRecipe(before),imported=npcIdleBehavior(exported,npcCompileTask(exported.command,{}));
 check(()=>assert.equal(imported.enabled,false));check(()=>assert.equal(imported.elapsedS,0));check(()=>assert.equal(imported.cycleLimit,2));
}
{
 const p=fixture();p.physicsOwner='b';p.setBehavior('a',recipe('搬运A'));advance(p,.5);
 check(()=>assert.equal(p.get('a').behavior.status,'resourceCirculation'));check(()=>assert.equal(p.get('a').agent.calls.length,0));check(()=>assert.equal(p.get('a').queue.length,1));check(()=>assert(p.get('a').agent.diversions>0));
 p.physicsOwner=null;advance(p,.3);check(()=>assert.deepEqual(p.get('a').agent.calls,['搬运A']));
 const timed=fixture();timed.physicsOwner='b';timed.setBehavior('a',{...recipe('搬运A'),cycleLimit:0,durationS:.2});advance(timed,.3);timed.physicsOwner=null;advance(timed,1);
 check(()=>assert.equal(timed.get('a').behavior.finishReason,'duration'));check(()=>assert.equal(timed.get('a').agent.calls.length,0));
}
// Replacement must validate first, including held-object protection, even when
// the pending queue is full. An append still observes the 64-entry bound.
{
 const p=fixture(),a=p.get('a');a.agent.remaining=3;a.queue=Array.from({length:64},()=>({text:'打招呼',source:'manual'}));const queued=a.queue;
 check(()=>assert.equal(p.dispatch('挥手',{targets:['a']})[0].accepted,false));
 check(()=>assert.equal(p.dispatch('不存在',{targets:['a'],mode:'replace'})[0].accepted,false));
 check(()=>assert.equal(a.queue,queued));check(()=>assert.equal(a.agent.remaining,3));
 a.agent.held={id:'A'};check(()=>assert.equal(p.dispatch('挥手',{targets:['a'],mode:'replace'})[0].accepted,false));check(()=>assert.equal(a.queue,queued));a.agent.held=null;
 check(()=>assert.equal(p.dispatch('挥手',{targets:['a'],mode:'replace'})[0].accepted,true));advance(p,1);
 check(()=>assert.deepEqual(a.agent.calls,['挥手']));check(()=>assert.equal(a.queue.length,0));
}
// Mixed scheduler scenario: actual NPCPopulation queues/resources, fake task
// execution durations. This deliberately makes no geometry/physics claim.
for(const count of [4,8]){
 const p=fixture(count);
 for(const [id,text]of [['a','搬运A'],['b','搬运B'],['c','搬运C']])check(()=>assert(p.dispatch(text,{targets:[id]})[0].accepted));
 p.setBehavior('d',{...recipe('向前走1米\n等待 0.1 秒\n挥手'),cycleLimit:2});
 p.control('pause',['a']);const frozen=p.get('a').agent.time;advance(p,.4);
 check(()=>assert.equal(p.get('a').agent.time,frozen));check(()=>assert(p.get('b').agent.diversions>0));check(()=>assert(p.get('d').agent.calls.length>0));
 const standbyTime=p.get('d').agent.time;
 if(count===8){
  p.dispatch('长动作',{targets:['e','f','g','h']});p.control('pause',['e']);p.dispatch('挥手',{targets:['f'],mode:'replace'});p.get('g').agent.failNext=true;p.control('stop',['h']);
 }
 p.control('resume',['a']);advance(p,3);
 for(const id of ['a','b','c'])check(()=>assert.equal(p.get(id).agent.calls.length,1));
 check(()=>assert.equal(p.get('d').behavior.status,'completed'));check(()=>assert.equal(p.claims.size,0));check(()=>assert.equal(p.stationClaims.size,0));check(()=>assert.equal(p.physicsOwner,null));
 if(count===8){
  check(()=>assert.equal(p.get('e').agent.time,standbyTime));p.control('resume',['e']);advance(p,4);
  check(()=>assert.deepEqual(p.get('f').agent.calls,['长动作','挥手']));check(()=>assert.equal(p.get('g').behavior.status,'failed'));check(()=>assert.equal(p.get('g').queue.length,0));check(()=>assert.equal(p.get('h').running,null));check(()=>assert.equal(p.get('e').running,null));
 }
}
{
 const p=fixture();p.dispatch('搬运A',{targets:['a']});p.get('a').agent.failNext=true;advance(p,.01);
 check(()=>assert.equal(p.get('a').behavior.status,'failed'));check(()=>assert.equal(p.claims.size,0));check(()=>assert.equal(p.stationClaims.size,0));check(()=>assert.equal(p.physicsOwner,null));
}
console.log(JSON.stringify({checks,schedulerExecuted:true,geometryGenerated:false,physicsExecuted:false}));
