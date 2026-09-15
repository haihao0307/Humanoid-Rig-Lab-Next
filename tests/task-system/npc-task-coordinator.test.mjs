import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../../control/NPCTaskCoordinator.js',import.meta.url),'utf8');
const context=vm.createContext({console,Date,JSON,Map,Set,Object,String,Number,Math,Error,Boolean,Array,RegExp,globalThis:null});
context.globalThis=context;
vm.runInContext(source,context,{filename:'NPCTaskCoordinator.js'});
const Coordinator=context.NPCTaskCoordinator;
let now=1000;
const coordinator=new Coordinator({clock:()=>++now,maxQueuePerNpc:8});
coordinator.register({id:'npc-01',label:'机械师一号',role:'mechanic'});
coordinator.register({id:'npc-02',label:'机械师二号',role:'mechanic'});
coordinator.register({id:'npc-03',label:'警卫一号',role:'guard'});

coordinator.setSelected('npc-01',true);
let assigned=coordinator.assign({command:'把红色训练箱搬到一区'});
assert.equal(assigned.length,1);
assert.equal(assigned[0].targetNpcId,'npc-01');
assert.equal(coordinator.get('npc-02').taskQueue.length,0);

coordinator.clearSelection();
coordinator.setSelected('npc-02',true);
coordinator.setSelected('npc-03',true);
assigned=coordinator.assign({command:'前往二区等待',dispatchMode:'append'});
assert.equal(assigned.length,2);
assert.notEqual(assigned[0].taskId,assigned[1].taskId);
assert.equal(assigned[0].groupId,assigned[1].groupId);

coordinator.startNext('npc-02');
const blocked=coordinator.block('npc-02',{reason:'通道暂时被占用',blockedBy:['npc-03']});
assert.equal(blocked.status,'blocked');
assert.equal(coordinator.get('npc-02').taskHistory.length,0,'临时阻塞不能终止任务');
assert.equal(coordinator.get('npc-02').activeTask.taskId,blocked.taskId);
coordinator.resume('npc-02');
assert.equal(coordinator.get('npc-02').activeTask.status,'running');
coordinator.complete('npc-02',{arrived:true});
assert.equal(coordinator.get('npc-02').taskHistory.at(-1).status,'completed');

coordinator.selectRole('mechanic');
assert.equal(JSON.stringify(coordinator.selectedIds()),JSON.stringify(['npc-01','npc-02']));
assigned=coordinator.assign({command:'回到各自工作位',dispatchMode:'replace'});
assert.equal(assigned.length,2);
assert.equal(coordinator.get('npc-01').taskQueue.length,1);
assert.equal(coordinator.get('npc-02').taskQueue.length,1);
assert.equal(coordinator.get('npc-03').taskQueue.length,1,'未选中的既有队列不得被改写');

coordinator.setNavigation('npc-01',{goal:{type:'zone',id:'Z1'},route:[[0,0,0],[1,0,1]],status:'moving',replanned:true});
const nav=coordinator.get('npc-01').navigation;
assert.equal(nav.routeRevision,1);
assert.equal(nav.replanCount,1);
assert.equal(nav.status,'moving');

console.log(JSON.stringify({passed:true,npcs:coordinator.list().length,revision:coordinator.revision,selected:coordinator.selectedIds()}));
