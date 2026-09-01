import * as THREE from 'three';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),M=THREE.MathUtils;
export const MOTION_LIMITS=Object.freeze({minSpeed:.42,maxSpeed:3.4,acceleration:.65,maxYawRate:.82,maxPitch:.48,solverStep:1/120,calibration:'illustrative_not_species_calibrated'});
const NUM={'零':0,'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10};
function numeral(s){if(s.length===1)return NUM[s]??Number(s);if(s.includes('十')){const a=s.split('十');return(a[0]?NUM[a[0]]:1)*10+(NUM[a[1]]||0);}return Number(s);}
function norm(s){return s.trim().replace(/[零一二两三四五六七八九十]+/g,n=>String(numeral(n))).replace(/公尺/g,'米').replace(/公秒/g,'秒');}
function val(s,re,fallback){const m=s.match(re);return m?Number(m[1]):fallback;}
export function parseInstruction(text,context={}){
 const n=norm(text);if(!n)return{ok:false,error:'请写下你希望鲨鱼完成的目标。'};
 const clauses=n.split(/然后|接着|最后|再(?=捕|吃|游|绕|潜|上|下|跟|回|去|停)|[，,；;。\n]/).map(s=>s.replace(/^先/,'').trim()).filter(Boolean);
 let tasks=[],warnings=[],noHunt=false;
 for(let s of clauses){let raw=s;
 if(/不要|不许|禁止|别/.test(s)){
 if(/吃|捕|咬|追/.test(s)){noHunt=true;s=s.replace(/(?:不要|不许|禁止|别)(?:再)?(?:捕食|吃掉|吃|咬|追逐|追)(?:小鱼|鱼群|鱼)?/g,'').replace(/^[、和且并 ]+/,'').trim();if(!s){tasks.push({type:'stop',label:'取消捕食，维持低速通气'});continue;}}
 else return{ok:false,error:'这条否定约束尚未可靠理解，已撤销旧任务。请把允许执行的目标写清楚。'};
 }
 const id=s.match(/\bF\s*(\d{1,2})\b/i),color=/金|黄/.test(s)?'gold':/蓝/.test(s)?'blue':/银|白/.test(s)?'silver':null;
 const selector=id?{id:'F'+id[1].padStart(2,'0')}:/(它|选中|这条|那条)/.test(s)?{selected:true}:color?{color}:{nearest:true};
 const speed=/慢|缓缓|轻轻/.test(s)?.55:/快|加速|冲/.test(s)?2.2:1.05;
 const seconds=val(s,/(\d+(?:\.\d+)?)\s*秒/,null);
 if(/^(停止|停下|停|取消|取消任务|别动|停止捕食|停止追逐)$/.test(s)){tasks.push({type:'stop',label:'撤销任务，低速通气'});continue;}
 if(/暂停(?:模拟|时间|整个场景)?$/.test(s)){tasks.push({type:'pause',paused:true,label:'暂停模拟'});continue;}
 if(/恢复(?:模拟|时间|播放)?$/.test(s)||s==='继续模拟'){tasks.push({type:'pause',paused:false,label:'恢复模拟'});continue;}
 if(/补充|添加|增加/.test(s)&&/鱼/.test(s)){tasks.push({type:'spawn',count:M.clamp(val(s,/(\d+)\s*(?:条|只)/,12),1,40),label:'补充鱼群'});continue;}
 if(/张嘴|张开.*嘴|合嘴|闭嘴|闭合.*嘴/.test(s)){tasks.push({type:'jaw',open:/张/.test(s),duration:seconds??2,label:/张/.test(s)?'张开上下颌':'闭合上下颌'});continue;}
 if(/捕食|吃掉|吞掉|捕捉|咬住|猎食|抓住|吃/.test(s)){
 if(noHunt)return{ok:false,error:'同一句同时要求禁止捕食和捕食，已停止旧任务。'};
 if(/饼|苹果|石|人|垃圾/.test(s))return{ok:false,error:'当前食物能力只支持场景中的小鱼，其他目标未接入。'};
 tasks.push({type:'hunt',selector,count:M.clamp(val(s,/(\d+)\s*(?:条|只)/,1),1,40),speed:3.0,label:'寻找目标并捕食'});continue;}
 if(/绕|转.*圈|盘旋|环游/.test(s)){tasks.push({type:'orbit',selector:/鱼/.test(s)?{school:true}:/(它|选中)/.test(s)?selector:{point:true},laps:M.clamp(val(s,/(\d+(?:\.\d+)?)\s*圈/,1),.1,20),radius:M.clamp(val(s,/半径\s*(\d+(?:\.\d+)?)/,4),2.5,15),direction:/逆时针|向左/.test(s)?1:-1,speed,label:'动态环绕目标'});continue;}
 if(/跟着|跟随|追踪|尾随|追逐|追赶/.test(s)){tasks.push({type:'follow',selector,duration:seconds??20,speed:1.7,label:'跟随小鱼，不捕食'});continue;}
 if(/潜|水下|深度|水面|上浮|下沉|海底|上游|下游/.test(s)){
 let depth=/水面|上浮/.test(s)?1.4:/海底/.test(s)?7.7:val(s,/(\d+(?:\.\d+)?)\s*米/,5);
 if(depth<1.2||depth>8){warnings.push('当前活动深度限制在水下 1.2 至 8 米。');depth=M.clamp(depth,1.2,8);}
 tasks.push({type:'depth',depth,speed,label:'调整到水下 '+depth+' 米'});continue;}
 if(/靠近|游到|去|到.*(?:旁|附近)|过来|回来|远离/.test(s)){
 let target=/我|过来/.test(s)?'observer':/起点|回来|原来/.test(s)?'home':/鱼群/.test(s)?'school':/鱼|它|选中/.test(s)?'fish':/那里|这里|标记/.test(s)?'point':null;
 if(!target)return{ok:false,error:'没有确定目的地。可以点选小鱼或水中位置，再说“游到那里”。'};
 tasks.push({type:'move',target,selector,speed,away:/远离/.test(s),label:/远离/.test(s)?'保持距离':'接近指定目标'});continue;}
 if(/游|巡游|巡逻|前进|向左|向右|转身|掉头/.test(s)){
 if(/转身|掉头/.test(s)){tasks.push({type:'turn',angle:Math.PI,speed,label:'自然转身'});continue;}
 const direction=/向左|左边/.test(s)?'left':/向右|右边/.test(s)?'right':'forward';const distance=val(s,/(\d+(?:\.\d+)?)\s*米/,null);
 tasks.push({type:distance?'travel':'cruise',distance,direction,duration:seconds??(distance?null:20),speed,label:distance?'前进 '+distance+' 米':'按要求巡游'});continue;}
 if(/快一点|慢一点|加速|减速|速度/.test(s)){tasks.push({type:'cruise',duration:seconds??15,speed:/慢|减/.test(s)?.55:2.2,label:'改变游动速度'});continue;}
 if(/等|等待/.test(s)){tasks.push({type:'cruise',duration:seconds??5,speed:.45,label:'低速等待'});continue;}
 return{ok:false,error:'尚未可靠理解“'+raw+'”。旧任务已撤销。当前可组合移动、深度、环绕、跟随、捕食、等待与嘴部控制。'};
 }
 return{ok:true,plan:{schema:'shark/behavior_plan@1',tasks},warnings};
}
const ALLOWED=new Set(['hunt','move','depth','orbit','follow','cruise','travel','turn','jaw','stop','pause','spawn']);
export function validatePlan(plan){if(!plan||plan.schema!=='shark/behavior_plan@1'||!Array.isArray(plan.tasks)||plan.tasks.length>12||!plan.tasks.length)throw Error('无效 BehaviorPlan');
 for(const t of plan.tasks){if(!ALLOWED.has(t.type))throw Error('不支持的动作能力');for(const k of['speed','duration','depth','radius','laps','count','distance','angle'])if(t[k]!==undefined&&t[k]!==null&&(!Number.isFinite(t[k])||t[k]<0))throw Error('计划参数无效');if(t.depth!==undefined&&(t.depth<1.2||t.depth>8))throw Error('深度越界');if(t.speed!==undefined&&t.speed>3.4)throw Error('速度越界');if(t.duration>300||t.count>40||t.radius>15||t.radius<2.5||t.laps>20||t.distance>60)throw Error('参数超出当前场域');if(t.selector?.id&&!/^F\d{2,3}$/.test(t.selector.id))throw Error('未知目标格式');}return structuredClone(plan);}
export function createBehavior({shark,ocean,fish,camera,getSelected,getPoint,spawn,onEvent}){
 const state={position:shark.root.position,velocity:V(),yaw:0,pitch:0,bank:0,speed:.5,time:0,epoch:0,queue:[],active:null,paused:false,caught:0,status:'等待指令，保持低速通气',events:[],jaw:0,home:V(0,-4.0,0),permission:false};state.position.copy(state.home);
 let previousMouth=V(),mouthNow=V();shark.root.updateMatrixWorld(true);shark.mouth.getWorldPosition(previousMouth);
 function event(type,data={}){const e={time:state.time,epoch:state.epoch,type,...data};state.events.push(e);if(state.events.length>400)state.events.shift();onEvent?.(e);}
 function cancel(reason='new_instruction'){state.epoch++;state.queue=[];state.active=null;state.permission=false;state.jaw=0;state.status='旧任务已撤销';for(const f of fish)if(f.state==='gripped'){f.state='alive';f.velocity.copy(state.velocity);f.grip=null;event('prey_released',{id:f.id,reason});}event('plan_cancelled',{reason});return state.epoch;}
 function install(plan,epoch=state.epoch){if(epoch!==state.epoch)return false;const p=validatePlan(plan);state.queue=p.tasks;state.status='计划已接收';event('plan_accepted',{tasks:p.tasks});return true;}
 function submit(text){const epoch=cancel();const r=parseInstruction(text);event('instruction',{text});if(!r.ok){state.status=r.error;return r;}install(r.plan,epoch);return r;}
 function choose(selector={nearest:true}){let a=fish.filter(f=>f.state==='alive');if(selector.id)a=a.filter(f=>f.id===selector.id);if(selector.selected){let sel=getSelected();a=a.filter(f=>f.id===sel);}if(selector.color)a=a.filter(f=>f.color===selector.color);a.sort((a,b)=>a.position.distanceToSquared(state.position)-b.position.distanceToSquared(state.position));return a[0]||null;}
 function center(){let p=V(),n=0;for(const f of fish)if(f.state==='alive'){p.add(f.position);n++;}return n?p.multiplyScalar(1/n):state.home.clone();}
 function finish(reason='目标完成'){if(state.active)event('goal_finished',{type:state.active.type,reason});state.active=null;state.permission=false;state.jaw=0;state.status=reason;}
 function fail(reason){event('goal_failed',{reason});state.active=null;state.queue=[];state.permission=false;state.jaw=0;state.status=reason;}
 function begin(){if(state.active||!state.queue.length)return;let t=state.queue.shift();t={...t,started:state.time,epoch:state.epoch,done:0,progress:0,start:state.position.clone()};state.active=t;state.status=t.label||t.type;event('goal_started',{type:t.type});
 if(t.type==='stop'){finish('任务已取消；维持低速通气');return;}
 if(t.type==='pause'){state.paused=t.paused;finish(t.paused?'模拟已暂停':'模拟继续');return;}
 if(t.type==='spawn'){spawn(t.count);finish('已补充 '+t.count+' 条小鱼');return;}
 if(t.type==='hunt'||t.type==='follow'||t.target==='fish'){t.fish=choose(t.selector);if(!t.fish){fail('未找到符合条件的活鱼，任务未执行。');return;}}
 if(t.type==='hunt')state.permission=true;
 if(t.type==='move'){t.destination=t.target==='home'?state.home.clone():t.target==='observer'?camera.position.clone():t.target==='point'?getPoint()?.clone():null;if((t.target==='point')&&!t.destination){fail('请先在海里点选一个目的地。');return;}if(t.destination)t.destination.y=M.clamp(t.destination.y,-8,-1.4);}
 if(t.type==='travel'){let a=state.yaw+(t.direction==='left'?Math.PI/2:t.direction==='right'?-Math.PI/2:0);t.destination=state.position.clone().add(V(Math.cos(a),0,-Math.sin(a)).multiplyScalar(t.distance));}
 if(t.type==='turn')t.destinationYaw=state.yaw+(t.angle??Math.PI);
 if(t.type==='orbit'){t.center=t.selector?.school?center():t.selector?.selected?choose(t.selector)?.position.clone():getPoint()?.clone()||state.home.clone();if(!t.center){fail('没有可环绕的目标。');return;}t.lastAngle=Math.atan2(state.position.z-t.center.z,state.position.x-t.center.x);}
 }
 const fwd=()=>V(Math.cos(state.yaw)*Math.cos(state.pitch),Math.sin(state.pitch),-Math.sin(state.yaw)*Math.cos(state.pitch));
 function idleDirection(){let d=fwd(),p=state.position.clone().sub(state.home),r=Math.hypot(p.x,p.z);if(r>5)d.addScaledVector(V(-p.x,0,-p.z).normalize(),Math.min(3,(r-5)*.4));d.y=(state.home.y-state.position.y)*.17;return d.normalize();}
 function step(dt){begin();if(state.paused)return;state.time+=dt;let targetDir=idleDirection(),targetSpeed=.48,t=state.active;state.jaw=0;
 if(t){let elapsed=state.time-t.started;if(elapsed>160){fail('当前路径未能完成，已取消任务。');t=null;}}
 if(t){state.status=t.label||t.type;targetSpeed=t.speed??1.05;
 if(t.type==='jaw'){targetSpeed=.48;state.jaw=t.open?.58:0;if(state.time-t.started>t.duration)finish('嘴部控制完成');}
 if(t.type==='cruise'){if(t.direction==='left')targetDir=fwd().applyAxisAngle(V(0,1,0),.2);if(t.direction==='right')targetDir=fwd().applyAxisAngle(V(0,1,0),-.2);if(state.time-t.started>(t.duration??20))finish();}
 if(t.type==='depth'){targetDir=fwd();targetDir.y=M.clamp((-t.depth-state.position.y)*.5,-.65,.65);if(Math.abs(state.position.y+t.depth)<.18){state.home.y=-t.depth;finish('已到达水下 '+t.depth+' 米');}}
 if(t.type==='turn'){let err=Math.atan2(Math.sin(t.destinationYaw-state.yaw),Math.cos(t.destinationYaw-state.yaw));targetDir=V(Math.cos(t.destinationYaw),0,-Math.sin(t.destinationYaw));if(Math.abs(err)<.08)finish();}
 if(t.type==='move'||t.type==='travel'){let p=t.target==='school'?center():t.target==='fish'?t.fish.position:t.destination;if(t.fish&&t.fish.state!=='alive'){fail('目标已不在场景中');}else if(p){let d=p.clone().sub(state.position);if(t.away){if(d.length()>6)finish();else targetDir=d.negate().normalize();}else{let tolerance=t.target==='fish'?1.8:t.target==='school'?2.8:1.0;if(d.length()<tolerance){state.home.copy(state.position);finish();}else targetDir=d.normalize();}}}
 if(t.type==='orbit'){if(t.selector?.school)t.center.lerp(center(),1-Math.exp(-dt*1.5));let off=state.position.clone().sub(t.center),angle=Math.atan2(off.z,off.x),da=Math.atan2(Math.sin(angle-t.lastAngle),Math.cos(angle-t.lastAngle));t.lastAngle=angle;if(Math.abs(off.length()-t.radius)<2)t.progress+=da*t.direction;let radial=V(off.x,0,off.z).normalize(),tangent=V(-radial.z,0,radial.x).multiplyScalar(t.direction);targetDir=tangent.addScaledVector(radial,(t.radius-Math.hypot(off.x,off.z))*.45);targetDir.y=(t.center.y-state.position.y)*.5;if(t.progress>=t.laps*Math.PI*2)finish('已环游 '+t.laps+' 圈');}
 if(t.type==='follow'||t.type==='hunt'){
 if(t.fish.state==='consumed'){if(t.type==='hunt'&&t.done<t.count){t.fish=choose(t.selector);if(!t.fish)fail('已无符合条件的活鱼，停止捕食');}else finish();}
 if(state.active&&t.fish?.state==='alive'){let f=t.fish,dist=state.position.distanceTo(f.position),lead=Math.min(.65,dist/(Math.max(state.speed,.5)+1));let intercept=f.position.clone().addScaledVector(f.velocity,lead);let d=intercept.sub(state.position);targetDir=d.normalize();if(t.type==='follow'){targetSpeed=dist<2?.48:Math.min(2.0,dist*.4);if(state.time-t.started>t.duration)finish('跟随完成');}else{let alignment=fwd().dot(targetDir);targetSpeed=dist<2.8&&alignment>.83?2.8:alignment<.5?1.0:2.5;state.jaw=dist<3.1?.66:.04;state.status='追踪 '+f.id+'，已捕食 '+t.done+'/'+t.count;}}
 if(t.fish?.state==='gripped'){targetSpeed=.62;state.jaw=.20;state.status='口部接触已建立，吞食中';}
 }
 }
 const floor=ocean.floorAt(state.position.x,state.position.z),ceiling=ocean.surfaceAt(state.position.x,state.position.z,state.time)-1.05;
 if(state.position.y<floor+1.15)targetDir.y=Math.max(targetDir.y,(floor+1.35-state.position.y)*2);
 if(state.position.y>ceiling-.1)targetDir.y=Math.min(targetDir.y,(ceiling-.3-state.position.y)*2);
 const radius=Math.hypot(state.position.x,state.position.z);if(radius>31)targetDir.addScaledVector(V(-state.position.x,0,-state.position.z).normalize(),(radius-31)*.6);
 for(const rock of ocean.rocks){let off=state.position.clone().sub(rock.position),d=off.length(),r=rock.radius+1.4;if(d<r)targetDir.addScaledVector(off.normalize(),(r-d)*2.5);}
 targetDir.normalize();const desiredYaw=Math.atan2(-targetDir.z,targetDir.x),error=Math.atan2(Math.sin(desiredYaw-state.yaw),Math.cos(desiredYaw-state.yaw));let rate=M.clamp(error*1.8,-.82,.82);state.yaw+=rate*dt;
 const desiredPitch=M.clamp(Math.atan2(targetDir.y,Math.hypot(targetDir.x,targetDir.z)),-.48,.48);state.pitch=M.damp(state.pitch,desiredPitch,2.2,dt);state.bank=M.damp(state.bank,-rate*state.speed*.13,3,dt);
 state.speed+=M.clamp(targetSpeed-state.speed,-.65*dt,.65*dt);state.speed=M.clamp(state.speed,.42,3.4);
 state.velocity.copy(fwd()).multiplyScalar(state.speed).add(ocean.flowAt(state.position,state.time));state.position.addScaledVector(state.velocity,dt);
 shark.root.quaternion.setFromEuler(new THREE.Euler(state.bank,state.yaw,state.pitch,'YZX'));shark.update(dt,state.speed,rate,state.pitch,state.jaw);
 shark.mouth.getWorldPosition(mouthNow);
 t=state.active;if(t?.type==='hunt'&&t.epoch===state.epoch&&state.permission&&t.fish){let f=t.fish;
 if(f.state==='alive'&&shark.getJaw()>.34){let line=new THREE.Line3(previousMouth,mouthNow),closest=line.closestPointToPoint(f.position,true,V()),near=f.position.distanceTo(closest),rel=f.position.clone().sub(state.position),alignment=fwd().dot(rel.normalize());if(near<.205&&alignment>.91){f.state='gripped';f.grip={epoch:state.epoch,at:state.time,local:shark.root.worldToLocal(f.position.clone())};event('mouth_contact',{id:f.id,distance:near,jaw:shark.getJaw(),position:f.position.toArray()});}}
 if(f.state==='gripped'&&f.grip.epoch===state.epoch){const u=M.clamp((state.time-f.grip.at)/.8,0,1),local=f.grip.local.clone().lerp(V(.85,-.145,0),u);f.position.copy(shark.root.localToWorld(local));f.mesh.quaternion.copy(shark.root.quaternion);if(u>=1){f.state='consumed';f.mesh.visible=false;state.caught++;t.done++;event('prey_consumed',{id:f.id,contactDuration:state.time-f.grip.at});if(t.done>=t.count){finish('已完成捕食 '+t.count+' 条小鱼');}else{t.fish=choose(t.selector);if(!t.fish)fail('没有剩余匹配目标');}}}
 }
 previousMouth.copy(mouthNow);
 }
 return{state,submit,cancel,install,step,center,choose,begin,event};
}
