// Real population policy with synthetic executor progress; no physics or GPU.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const sandbox={console,structuredClone};vm.createContext(sandbox);
vm.runInContext(readFileSync(process.argv[2]||new URL('../control/NPCPopulation.js',import.meta.url),'utf8')+'\nglobalThis.Population=NPCPopulation;',sandbox);
function fixture(){
 const p=Object.create(sandbox.Population.prototype),owner={id:'owner',agent:{time:0,pos:[0,0,0],route:[[100,0,0]],phase:'travel',index:0,skill:{objectId:'A',targetId:'ZA'},stats:{completed:0}}};
 const row={id:'next',queue:[],behavior:{},agent:{npcId:'next',pos:[0,0,0],time:0,submitPlan(){},log(){}}};
 p.actors=new Map([[owner.id,owner],[row.id,row]]);
 const request={text:'carry B',source:'manual'},conflict={id:'shared-physics',ownerId:'owner',kind:'manipulation'};
 const attempt=()=>{row.queue=[];p.startResourceCirculation(row,request,conflict);assert.equal(row.queue.length,1);};
 return{p,owner:owner.agent,row,request,attempt};
}
{
 const {owner,row,attempt}=fixture();attempt();
 for(let i=0;i<40;i++){owner.pos[0]+=.5;row.agent.time+=5;attempt();}
 assert.equal(row.resource.diversions,41);assert.equal(row.resource.attempts,1);assert.equal(row.resource.progressResets,40);
}
{
 const {owner,row,attempt}=fixture();attempt();
 for(let i=0;i<15;i++){owner.pos[0]=i%2?.1:0;attempt();}
 assert.throws(attempt,/16 次机动/);assert.equal(row.queue.length,0);
}
{
 const {owner,row,attempt}=fixture();owner.paused=true;
 for(let i=0;i<16;i++){owner.pos[0]+=1;attempt();}
 assert.throws(attempt,/16 次机动/);assert.equal(row.resource.progressResets,0);
}
{
 const {owner,row,attempt}=fixture();attempt();
 for(let i=0;i<20;i++){owner.preflight={steps:(i+1)*40};row.agent.time+=1;attempt();}
 assert.equal(row.resource.progressResets,20);
 row.agent.time=301;owner.phase='release';assert.throws(attempt,/300 秒/);assert.equal(row.queue.length,0);
}
{
 const {owner,row,attempt}=fixture();attempt();
 for(let i=0;i<20;i++){owner.index++;row.agent.time+=10;attempt();}
 owner.index++;attempt();assert.equal(row.resource.attempts,1);
 row.agent.time=301;assert.throws(attempt,/300 秒/);
}
{
 const {p,owner,row}=fixture();owner.pos=[0,0,.6];owner.skill={type:'carry',o:{p:[0,0,.6]},dest:[0,0,1],transferEnd:[0,0,.5]};
 const before=JSON.stringify(owner),moves=p.resourceManeuvers(row,{ownerId:'owner'},1),first=moves[0];
 assert.equal(first.penalty,0);assert.notEqual(first.direction,'forward');
 assert(moves.find(m=>m.direction==='forward'&&m.distanceM===.65).penalty>0);
 assert.equal(JSON.stringify(owner),before,'ranking must not change executor or object state');
}
{
 const {p,owner,row}=fixture();owner.pos=[.42,0,0];owner.h={bodyMetrics:{bodyRadiusM:.05}};row.agent.h={bodyMetrics:{bodyRadiusM:.05}};owner.skill={type:'carry'};
 const moves=p.resourceManeuvers(row,{ownerId:'owner'},1);
 assert(moves.find(m=>m.direction==='right'&&m.distanceM===1.05).penalty>0,'a clear endpoint cannot justify crossing the work area');
 assert.equal(moves[0].penalty,0);
}
{
 const {p,row}=fixture(),plain=p.resourceManeuvers(row,{ownerId:'absent'},1);assert.equal(plain.length,12);assert(plain.every(m=>m.penalty===0));
}
console.log(JSON.stringify({passed:true,cases:8,noProgressLimit:16,activeContentionLimitS:300,progressExtendsRetries:true,workAreaYield:true,physicsExecuted:false}));
