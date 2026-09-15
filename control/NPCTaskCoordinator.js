/* Independent NPC selection, task queues and recoverable task state.
 * This module does not move bodies. It supplies the task ownership contract
 * that the crowd-navigation and locomotion layers consume. */
const NPC_TASK_ASSIGNMENT_SCHEMA='jarvis/npc_task_assignment@1';
const NPC_TASK_DISPATCH_MODES=new Set(['append','replace']);
const NPC_TASK_COORDINATION_MODES=new Set(['independent','cooperative']);
const NPC_TASK_TERMINAL_STATES=new Set(['completed','failed','cancelled']);
const npcTaskClone=value=>value==null?value:JSON.parse(JSON.stringify(value));
const npcTaskId=value=>{
 const id=String(value??'').trim();
 if(!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,95}$/.test(id))throw Error('NPC ID 格式无效');
 return id;
};
const npcTaskText=(value,label,max)=>{
 const text=String(value??'').trim();
 if(!text||text.length>max)throw Error(`${label}为空或超过 ${max} 字符`);
 return text;
};

class NPCTaskCoordinator{
 constructor({clock=()=>Date.now(),maxQueuePerNpc=64}={}){
  if(typeof clock!=='function')throw Error('clock 必须是函数');
  if(!Number.isInteger(maxQueuePerNpc)||maxQueuePerNpc<1||maxQueuePerNpc>512)throw Error('任务队列上限无效');
  this.clock=clock;this.maxQueuePerNpc=maxQueuePerNpc;this.records=new Map();this.listeners=new Set();this.serial=0;this.revision=0;
 }
 nextId(prefix){this.serial++;return `${prefix}-${this.clock().toString(36)}-${this.serial.toString(36)}`;}
 emit(type,payload={}){this.revision++;const event={schema:'jarvis/npc_task_event@1',type,revision:this.revision,atMs:this.clock(),...npcTaskClone(payload)};for(const listener of this.listeners)listener(event);return event;}
 subscribe(listener){if(typeof listener!=='function')throw Error('监听器必须是函数');this.listeners.add(listener);return()=>this.listeners.delete(listener);}
 register(input={}){
  const id=npcTaskId(input.id);if(this.records.has(id))throw Error(`NPC 已存在：${id}`);
  const now=this.clock(),record={id,label:npcTaskText(input.label??id,'NPC 名称',80),role:String(input.role??'unassigned').trim().slice(0,64)||'unassigned',enabled:input.enabled!==false,selected:Boolean(input.selected),taskQueue:[],activeTask:null,taskHistory:[],navigation:{goal:null,route:[],routeRevision:0,status:'idle',blockedBy:[],reservationIds:[],progressTimestamp:now,lastReplanTimestamp:null,replanCount:0},revision:0};
  this.records.set(id,record);this.emit('npc.registered',{npcId:id});return this.get(id);
 }
 unregister(id,{force=false}={}){const record=this.require(id);if(!force&&(record.activeTask||record.taskQueue.length))throw Error('NPC 仍有任务，不能移除');this.records.delete(record.id);this.emit('npc.unregistered',{npcId:record.id});return true;}
 require(id){id=npcTaskId(id);const record=this.records.get(id);if(!record)throw Error(`NPC 不存在：${id}`);return record;}
 get(id){return npcTaskClone(this.require(id));}
 list(){return [...this.records.values()].map(record=>npcTaskClone(record));}
 selectedIds(){return [...this.records.values()].filter(record=>record.selected&&record.enabled).map(record=>record.id);}
 setSelected(id,selected=true){const record=this.require(id);record.selected=Boolean(selected)&&record.enabled;record.revision++;this.emit('selection.changed',{npcIds:this.selectedIds()});return record.selected;}
 toggleSelected(id){const record=this.require(id);return this.setSelected(record.id,!record.selected);}
 clearSelection(){let changed=false;for(const record of this.records.values())if(record.selected){record.selected=false;record.revision++;changed=true;}if(changed)this.emit('selection.changed',{npcIds:[]});return[];}
 selectAll(predicate=null){for(const record of this.records.values()){const eligible=record.enabled&&(!predicate||predicate(npcTaskClone(record)));if(record.selected!==eligible){record.selected=eligible;record.revision++;}}this.emit('selection.changed',{npcIds:this.selectedIds()});return this.selectedIds();}
 invertSelection(predicate=null){for(const record of this.records.values())if(record.enabled&&(!predicate||predicate(npcTaskClone(record)))){record.selected=!record.selected;record.revision++;}this.emit('selection.changed',{npcIds:this.selectedIds()});return this.selectedIds();}
 selectRole(role){role=String(role??'').trim();if(!role)throw Error('职业筛选不能为空');return this.selectAll(record=>record.role===role);}
 normalizeTargets(ids){const list=ids==null?this.selectedIds():ids;if(!Array.isArray(list))throw Error('targetNpcIds 必须是数组');const unique=[...new Set(list.map(npcTaskId))];if(!unique.length)throw Error('没有选中可接收任务的人物');for(const id of unique){const record=this.require(id);if(!record.enabled)throw Error(`NPC 已禁用：${id}`);}return unique;}
 normalizeFailurePolicy(policy={}){return{maxReplans:Number.isInteger(policy.maxReplans)?Math.max(0,Math.min(32,policy.maxReplans)):8,blockedWaitMs:Number.isFinite(policy.blockedWaitMs)?Math.max(1000,Math.min(120000,policy.blockedWaitMs)):12000,keepTaskOnTemporaryBlock:policy.keepTaskOnTemporaryBlock!==false};}
 assign(input={}){
  const command=npcTaskText(input.command,'任务指令',16000),targets=this.normalizeTargets(input.targetNpcIds),dispatchMode=input.dispatchMode??'append',coordination=input.coordination??'independent';
  if(!NPC_TASK_DISPATCH_MODES.has(dispatchMode))throw Error('dispatchMode 仅支持 append 或 replace');
  if(!NPC_TASK_COORDINATION_MODES.has(coordination))throw Error('coordination 无效');
  const priority=Number.isFinite(input.priority)?Math.max(0,Math.min(100,Math.round(input.priority))):50,createdAtMs=this.clock(),groupId=input.groupId?npcTaskId(input.groupId):this.nextId('task-group'),failurePolicy=this.normalizeFailurePolicy(input.failurePolicy),assignments=[];
  for(const npcId of targets){const record=this.require(npcId);if(dispatchMode==='replace')this.replacePending(record,'replaced-by-new-assignment');if(record.taskQueue.length>=this.maxQueuePerNpc)throw Error(`${npcId} 的任务队列已满`);const task={schema:NPC_TASK_ASSIGNMENT_SCHEMA,taskId:this.nextId('task'),groupId,targetNpcId:npcId,dispatchMode,coordination,priority,command,createdAtMs,status:'queued',startedAtMs:null,finishedAtMs:null,blockedAtMs:null,blockedReason:null,blockedBy:[],failurePolicy,attempt:0,result:null,error:null};record.taskQueue.push(task);record.revision++;assignments.push(npcTaskClone(task));}
  this.emit('task.assigned',{groupId,npcIds:targets,dispatchMode,coordination,count:assignments.length});return assignments;
 }
 replacePending(record,reason){for(const queued of record.taskQueue){queued.status='cancelled';queued.finishedAtMs=this.clock();queued.error=reason;record.taskHistory.push(queued);}record.taskQueue=[];if(record.activeTask){const active=record.activeTask;active.status='cancelled';active.finishedAtMs=this.clock();active.error=reason;record.taskHistory.push(active);record.activeTask=null;}record.navigation.status='idle';record.navigation.blockedBy=[];record.navigation.reservationIds=[];}
 startNext(id){const record=this.require(id);if(record.activeTask)return npcTaskClone(record.activeTask);const task=record.taskQueue.shift();if(!task)return null;task.status='running';task.startedAtMs=this.clock();task.attempt++;record.activeTask=task;record.navigation.status='planning';record.navigation.progressTimestamp=this.clock();record.revision++;this.emit('task.started',{npcId:record.id,taskId:task.taskId});return npcTaskClone(task);}
 setNavigation(id,patch={}){const record=this.require(id),nav=record.navigation;if(patch.goal!==undefined)nav.goal=npcTaskClone(patch.goal);if(patch.route!==undefined){if(!Array.isArray(patch.route))throw Error('route 必须是数组');nav.route=npcTaskClone(patch.route);nav.routeRevision++;}if(patch.status!==undefined){const status=String(patch.status);if(!['idle','planning','moving','yielding','blocked','replanning','waiting_for_slot','arrived'].includes(status))throw Error('导航状态无效');nav.status=status;}if(patch.blockedBy!==undefined)nav.blockedBy=[...new Set((patch.blockedBy||[]).map(String))];if(patch.reservationIds!==undefined)nav.reservationIds=[...new Set((patch.reservationIds||[]).map(String))];if(patch.progressTimestamp!==undefined)nav.progressTimestamp=Number(patch.progressTimestamp)||this.clock();if(patch.replanned){nav.replanCount++;nav.lastReplanTimestamp=this.clock();}record.revision++;this.emit('navigation.changed',{npcId:record.id,status:nav.status,routeRevision:nav.routeRevision});return npcTaskClone(nav);}
 block(id,{reason='temporary-obstacle',blockedBy=[]}={}){const record=this.require(id),task=record.activeTask;if(!task)throw Error('NPC 没有正在执行的任务');if(NPC_TASK_TERMINAL_STATES.has(task.status))throw Error('任务已经结束');task.status='blocked';task.blockedAtMs=this.clock();task.blockedReason=npcTaskText(reason,'阻塞原因',240);task.blockedBy=[...new Set(blockedBy.map(String))];record.navigation.status='blocked';record.navigation.blockedBy=[...task.blockedBy];record.revision++;this.emit('task.blocked',{npcId:record.id,taskId:task.taskId,reason:task.blockedReason,blockedBy:task.blockedBy});return npcTaskClone(task);}
 resume(id){const record=this.require(id),task=record.activeTask;if(!task)throw Error('NPC 没有正在执行的任务');if(task.status!=='blocked')return npcTaskClone(task);task.status='running';task.blockedAtMs=null;task.blockedReason=null;task.blockedBy=[];record.navigation.status='replanning';record.navigation.blockedBy=[];record.navigation.progressTimestamp=this.clock();record.revision++;this.emit('task.resumed',{npcId:record.id,taskId:task.taskId});return npcTaskClone(task);}
 finishActive(id,status,{result=null,error=null}={}){if(!NPC_TASK_TERMINAL_STATES.has(status))throw Error('终止状态无效');const record=this.require(id),task=record.activeTask;if(!task)throw Error('NPC 没有正在执行的任务');task.status=status;task.finishedAtMs=this.clock();task.result=npcTaskClone(result);task.error=error==null?null:String(error);record.taskHistory.push(task);record.activeTask=null;record.navigation={...record.navigation,goal:null,route:[],status:'idle',blockedBy:[],reservationIds:[],progressTimestamp:this.clock()};record.revision++;this.emit(`task.${status}`,{npcId:record.id,taskId:task.taskId});return npcTaskClone(task);}
 complete(id,result=null){return this.finishActive(id,'completed',{result});}
 fail(id,error){return this.finishActive(id,'failed',{error:npcTaskText(error,'失败原因',500)});}
 cancel(id,reason='cancelled-by-user'){return this.finishActive(id,'cancelled',{error:reason});}
 snapshot(){return{schema:'jarvis/npc_task_coordinator@1',revision:this.revision,selectedNpcIds:this.selectedIds(),npcs:this.list()};}
}

if(typeof globalThis!=='undefined')Object.defineProperty(globalThis,'NPCTaskCoordinator',{value:NPCTaskCoordinator,configurable:true,writable:false});
