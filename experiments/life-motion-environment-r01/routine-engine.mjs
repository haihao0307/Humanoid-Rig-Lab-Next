/** Isolated long-horizon routine orchestration. It never writes bones directly; host adapter owns real rig, IK, collision and physics. */
export const REVISION='life-routine-engine@0.1.0';
export const LIMITS=Object.freeze({maxFootSlipM:.012,maxContactErrorM:.025,maxJointLimitViolationDeg:.5,maxPenetrationM:.001,maxPoseDeltaMps:2.5,maxPoseAccelerationMps2:20});
const rows=[
['walk-table','walk-to-region','table-front','standing','at-table','noPenetration jointLimits supportStable'],
['approach-crate','approach-object','crate-01','at-table hands-free','at-crate','noPenetration jointLimits supportStable'],
['reach-crate','reach-two-hand','crate-01.grasp-points','at-crate hands-free','hands-contact-crate','contactStable noPenetration jointLimits'],
['grasp-crate','establish-grasp','crate-01','hands-contact-crate','holding-crate','contactStable gripOwnership noPenetration'],
['lift-crate','lift-with-support-transfer','crate-01','holding-crate','crate-clear-of-table','contactStable supportStable noPenetration jointLimits'],
['carry-crate','carry-to-region','cabinet-front','holding-crate crate-clear-of-table','at-cabinet','contactStable supportStable noPenetration jointLimits'],
['lower-crate','lower-to-support','cabinet-shelf-01','holding-crate at-cabinet','crate-supported','contactStable supportStable noPenetration jointLimits'],
['verify-crate','verify-object-settled','crate-01','crate-supported','crate-settled','objectSupported objectSettled noPenetration'],
['release-crate','release-grasp','crate-01','crate-settled','hands-free','objectSupported objectSettled noPenetration'],
['withdraw-crate','withdraw-hands','crate-01','hands-free crate-settled','clear-of-cabinet','noPenetration jointLimits supportStable'],
['walk-window','walk-to-region','window-front','clear-of-cabinet hands-free','at-window','noPenetration jointLimits supportStable'],
['open-window','operate-window','window-01.open','at-window','window-open','contactStable noPenetration jointLimits'],
['inspect-window','look-and-settle','window-view','window-open','window-inspected','supportStable jointLimits'],
['close-window','operate-window','window-01.closed','window-inspected','window-closed','contactStable noPenetration jointLimits'],
['walk-door','walk-to-region','door-front','window-closed','at-door','noPenetration jointLimits supportStable'],
['open-door','operate-door','door-01.open','at-door hands-free','door-open','contactStable noPenetration jointLimits'],
['pass-door','walk-through-opening','doorway-01.exit','door-open','outside-room','supportStable noPenetration jointLimits'],
['close-door','turn-and-operate-door','door-01.closed','outside-room','door-closed-outside','contactStable supportStable noPenetration jointLimits'],
['approach-stairs','walk-to-region','stairs-bottom','door-closed-outside','at-stairs','noPenetration jointLimits supportStable'],
['climb-stairs','climb-stairs','stairs-top','at-stairs','at-landing','supportStable noPenetration jointLimits footContacts'],
['turn-landing','turn-on-landing','landing-turn-point','at-landing','facing-descent','supportStable noPenetration jointLimits footContacts'],
['descend-stairs','descend-stairs','stairs-bottom','facing-descent','back-at-stairs','supportStable noPenetration jointLimits footContacts'],
['return-table','walk-to-region','table-front','back-at-stairs','at-table-again','noPenetration jointLimits supportStable'],
['approach-book','approach-object','book-01','at-table-again hands-free','at-book','noPenetration jointLimits supportStable'],
['reach-book','reach-one-hand','book-01.grasp-points','at-book','hand-contact-book','contactStable noPenetration jointLimits'],
['grasp-book','establish-grasp','book-01','hand-contact-book','holding-book','contactStable gripOwnership noPenetration'],
['place-book','place-on-support','shelf-02','holding-book','book-supported','contactStable objectSupported noPenetration jointLimits'],
['verify-book','verify-object-settled','book-01','book-supported','book-settled','objectSupported objectSettled noPenetration'],
['release-book','release-grasp','book-01','book-settled','hands-free','objectSupported objectSettled noPenetration'],
['withdraw-book','withdraw-hands','book-01','book-settled hands-free','clear-of-shelf','noPenetration jointLimits supportStable'],
['walk-cabinet-return','walk-to-region','cabinet-front','clear-of-shelf hands-free','at-cabinet-return','supportStable noPenetration jointLimits'],
['approach-stored-crate','approach-object','crate-01','at-cabinet-return hands-free','at-stored-crate','supportStable noPenetration jointLimits'],
['reach-stored-crate','reach-two-hand','crate-01.grasp-points','at-stored-crate hands-free','hands-contact-stored-crate','contactStable noPenetration jointLimits'],
['grasp-stored-crate','establish-grasp','crate-01','hands-contact-stored-crate','holding-crate','contactStable gripOwnership noPenetration'],
['lift-stored-crate','lift-with-support-transfer','crate-01','holding-crate','crate-clear-of-cabinet','contactStable supportStable noPenetration jointLimits'],
['carry-crate-back','carry-to-region','table-front','holding-crate crate-clear-of-cabinet','at-table-for-crate-return','contactStable supportStable noPenetration jointLimits'],
['lower-crate-table','lower-to-support','table-top-return-zone','holding-crate at-table-for-crate-return','crate-on-table','contactStable supportStable noPenetration jointLimits'],
['verify-crate-table','verify-object-settled','crate-01','crate-on-table','crate-settled-on-table','objectSupported objectSettled noPenetration'],
['release-crate-table','release-grasp','crate-01','crate-settled-on-table','hands-free','objectSupported objectSettled noPenetration'],
['withdraw-crate-table','withdraw-hands','crate-01','crate-settled-on-table hands-free','clear-of-table','supportStable noPenetration jointLimits'],
['walk-shelf-return','walk-to-region','shelf-front','clear-of-table hands-free','at-shelf-return','supportStable noPenetration jointLimits'],
['approach-book-shelf','approach-object','book-01','at-shelf-return hands-free','at-book-on-shelf','supportStable noPenetration jointLimits'],
['reach-book-shelf','reach-one-hand','book-01.grasp-points','at-book-on-shelf hands-free','hand-contact-book-on-shelf','contactStable noPenetration jointLimits'],
['grasp-book-shelf','establish-grasp','book-01','hand-contact-book-on-shelf','holding-book','contactStable gripOwnership noPenetration'],
['lift-book-shelf','lift-with-support-transfer','book-01','holding-book','book-clear-of-shelf','contactStable supportStable noPenetration jointLimits'],
['carry-book-table','carry-to-region','table-front','holding-book book-clear-of-shelf','at-table-for-book-return','contactStable supportStable noPenetration jointLimits'],
['lower-book-table','lower-to-support','table-top-return-zone','holding-book at-table-for-book-return','book-on-table','contactStable supportStable noPenetration jointLimits'],
['verify-book-table','verify-object-settled','book-01','book-on-table','book-settled-on-table','objectSupported objectSettled noPenetration'],
['release-book-table','release-grasp','book-01','book-settled-on-table','hands-free','objectSupported objectSettled noPenetration'],
['withdraw-book-table','withdraw-hands','book-01','book-settled-on-table hands-free','clear-of-table','supportStable noPenetration jointLimits'],
['return-idle','walk-to-region','room-idle-mark','clear-of-table','standing routine-cycle-complete','supportStable noPenetration jointLimits'],
];
export const RESIDENT_ROUTINE_R01=Object.freeze(rows.map(([id,skill,target,requires,produces,gates])=>Object.freeze({id,skill,target,requires:requires.split(' '),produces:produces.split(' '),gates:gates.split(' ')})));
const clone=x=>x==null?x:structuredClone(x), nonnegative=x=>Number.isFinite(x)&&x>=0, terminal=new Set(['completed','failed','cancelled']);
export function validateObservation(task,o,limits=LIMITS){
 const failures=[];if(!o||typeof o!=='object')return{ok:false,failures:['missing-observation'],metrics:{}};const m=o.metrics||{};
 for(const g of task.gates||[]){if(g==='footContacts'){if(o.leftFootContact!==true||o.rightFootContact!==true)failures.push('foot-contact-missing');}else if(o[g]!==true)failures.push('gate:'+g);}
 if(!nonnegative(m.footSlipM)||m.footSlipM>limits.maxFootSlipM)failures.push('foot-slip-out-of-range');
 if(!nonnegative(m.contactErrorM)||m.contactErrorM>limits.maxContactErrorM)failures.push('contact-error-out-of-range');
 if(!nonnegative(m.jointLimitViolationDeg)||m.jointLimitViolationDeg>limits.maxJointLimitViolationDeg)failures.push('joint-limit-violation');
 if(!nonnegative(m.maxPenetrationM)||m.maxPenetrationM>limits.maxPenetrationM)failures.push('penetration-out-of-range');
 if(!nonnegative(m.maxPoseDeltaMps)||m.maxPoseDeltaMps>limits.maxPoseDeltaMps)failures.push('pose-velocity-out-of-range');
 if(!nonnegative(m.maxPoseAccelerationMps2)||m.maxPoseAccelerationMps2>limits.maxPoseAccelerationMps2)failures.push('pose-acceleration-out-of-range');
 if(o.selfCollisionFree!==true)failures.push('self-collision-not-cleared');if(o.environmentCollisionFree!==true)failures.push('environment-collision-not-cleared');
 return{ok:failures.length===0,failures,metrics:clone(m)};
}
/** Adapter must implement checkpoint/startTask/stepTask/observe/restore/recover/hasFacts. */
export class LifeRoutineRunner{
 constructor(adapter,{routine=RESIDENT_ROUTINE_R01,limits=LIMITS,maxRetriesPerTask=1}={}){const methods=['checkpoint','startTask','stepTask','observe','restore','recover','hasFacts'];if(!adapter||methods.some(k=>typeof adapter[k]!=='function'))throw new TypeError('adapter does not implement isolated routine contract');if(!Array.isArray(routine)||!routine.length)throw new TypeError('empty routine');this.a=adapter;this.routine=clone(routine);this.limits={...LIMITS,...limits};this.maxRetries=maxRetriesPerTask;this.state='idle';this.cycle=0;this.repeatCount=1;this.index=0;this.current=null;this.saved=null;this.retries=0;this.facts=new Set();this.journal=[];this.progress=0;}
 context(){return{cycle:this.cycle,taskIndex:this.index,facts:[...this.facts],retryCount:this.retries};}
 record(type,detail={}){this.journal.push({seq:this.journal.length+1,cycle:this.cycle,index:this.index,taskId:this.current?.id??null,type,detail:clone(detail)});}
 start({repeatCount=1,initialFacts=['standing','hands-free']}={}){if(!Number.isInteger(repeatCount)||repeatCount<1||repeatCount>100)throw new RangeError('repeatCount must be 1..100');if(!['idle','completed','failed','cancelled'].includes(this.state))throw Error('cannot start from '+this.state);this.state='running';this.cycle=0;this.repeatCount=repeatCount;this.index=0;this.current=null;this.saved=null;this.retries=0;this.facts=new Set(initialFacts);this.journal=[];this.progress=0;this.record('routine-start',{repeatCount,tasksPerCycle:this.routine.length});}
 pause(){if(this.state!=='running')return false;this.state='paused';this.record('paused');return true;} resume(){if(this.state!=='paused')return false;this.state='running';this.record('resumed');return true;}
 cancel(reason='user-cancelled'){if(terminal.has(this.state)||this.state==='idle')return false;const o=this.current?this.a.observe(this.current,this.context()):null;if(o?.holdingObject){this.state='paused';this.record('cancel-deferred-safe-release',{reason,holdingObject:o.holdingObject,requiresSafeRelease:true});return false;}this.state='cancelled';this.record('cancelled',{reason,holdingObject:null,requiresSafeRelease:false});return true;}
 halt(type,detail){this.state='failed';this.record(type,detail);return{state:this.state,taskId:this.current?.id??null,detail};}
 tick(dt){if(this.state!=='running')return{state:this.state,taskId:this.current?.id??null};if(!Number.isFinite(dt)||dt<=0||dt>1/15)throw new RangeError('dt must be in (0, 1/15]');
  if(!this.current){const task=this.routine[this.index],missing=task.requires.filter(f=>!this.facts.has(f)&&!this.a.hasFacts([f],this.context()));if(missing.length)return this.halt('precondition-failed',{missing});this.current=task;this.saved=this.a.checkpoint();this.a.startTask(clone(task),this.context());this.progress=0;this.record('task-start',{skill:task.skill,target:task.target,retryCount:this.retries});}
  let r;try{r=this.a.stepTask(dt,this.context());}catch(e){return this.failCurrent(e?.message||String(e));}if(!r||!['running','succeeded','failed'].includes(r.status))return this.failCurrent('invalid-adapter-status');
  if(Number.isFinite(r.progress)){if(r.progress+1e-8<this.progress)return this.failCurrent('progress-regressed');this.progress=Math.max(this.progress,Math.min(1,r.progress));}if(r.status==='running')return{state:this.state,taskId:this.current.id,progress:this.progress};if(r.status==='failed')return this.failCurrent(r.reason||'skill-failed');
  let o;try{o=this.a.observe(this.current,this.context());}catch(e){return this.failCurrent('observation-error:'+(e?.message||e));}const v=validateObservation(this.current,o,this.limits);if(!v.ok)return this.failCurrent('acceptance-gate-failed',{failures:v.failures,metrics:v.metrics});
  for(const f of this.current.produces)this.facts.add(f);this.record('task-verified',{metrics:v.metrics,produces:[...this.current.produces]});this.current=null;this.saved=null;this.retries=0;this.progress=0;this.index++;
  if(this.index===this.routine.length){this.cycle++;this.record('cycle-complete',{cycle:this.cycle});if(this.cycle===this.repeatCount){this.state='completed';this.record('routine-complete',{cycles:this.cycle,verifiedTasks:this.cycle*this.routine.length});return{state:this.state,cycle:this.cycle};}this.index=0;this.facts=new Set(['standing','hands-free']);}
  return{state:this.state,cycle:this.cycle,nextTaskId:this.routine[this.index]?.id??null};
 }
 failCurrent(reason,detail={}){const task=this.current,saved=this.saved;this.record('task-failed',{reason,...detail,retryCount:this.retries});try{this.a.restore(saved);const o=this.a.observe(task,this.context()),expected=saved?.holdingObject??null;if(!o||((o.holdingObject??null)!==expected))return this.halt('recovery-ownership-mismatch',{reason,expected,actual:o?.holdingObject??null});if(this.a.recover(task,reason,this.context())&&this.retries<this.maxRetries){this.retries++;this.current=null;this.saved=null;this.progress=0;this.record('retry-scheduled',{reason,retryCount:this.retries});return{state:this.state,retryScheduled:true,taskId:task.id};}}catch(e){return this.halt('recovery-failed',{reason,error:e?.message||String(e)});}return this.halt('retry-budget-exhausted',{reason,maxRetriesPerTask:this.maxRetries});}
 snapshot(){return{revision:REVISION,state:this.state,cycle:this.cycle,repeatCount:this.repeatCount,index:this.index,currentTaskId:this.current?.id??null,retries:this.retries,facts:[...this.facts],journal:clone(this.journal)};}
}