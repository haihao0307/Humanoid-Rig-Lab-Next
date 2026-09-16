/* Small shared recipes. Actions expand on demand; no trajectories or meshes. */
(function(root){
'use strict';
const data={
 schema:'jarvis/npc_routines@1',version:2,
 residents:[
  {id:'camp-linchuan',role:'soldier',name:'林川',title:'士兵',home:'Z2',rest:'Z10',restSeconds:60,responsibilities:['营房器材借还','食堂周转','值勤巡视']},
  {id:'camp-chenyuan',role:'officer',name:'陈远',title:'军官',home:'Z6',rest:'Z10',restSeconds:45,responsibilities:['营区例行检查','文书交接归档']},
  {id:'village-zhouhe',role:'villager',name:'周禾',title:'附近村庄农民',home:'Z16',rest:'Z16',restSeconds:60,responsibilities:['农田浇灌','青菜筐分拣','市集筐具周转']}
 ],
 homes:[
  {object:'SUP_A',zone:'Z19',label:'被装器材归位'},
  {object:'SUP_B',zone:'Z20',label:'日用品箱归位'},
  {object:'EMPTY_A',zone:'Z21',label:'食堂空箱归位'},
  {object:'DOC_A',zone:'Z22',label:'文书包归档'},
  {object:'AGR_A',zone:'Z23',label:'青菜筐归位'},
  {object:'AGR_B',zone:'Z24',label:'根菜筐归位'},
  {object:'WATER_A',zone:'Z25',label:'取水与水壶归位'}
 ],
 routines:[
  {id:'soldier-sentry',role:'soldier',title:'岗哨左右观察与回岗',motionLabRecipe:'sentry',needLabel:'岗哨观察需求',period:360,initialNeed:.55,cooldown:90,tools:[],phases:[
   {title:'到岗与左右观察',actions:[['walk','Z1'],['wait',3],['turn',-45],['wait',3],['turn',90],['wait',3],['turn',-45],['wait',3]]},
   {title:'完成交接',actions:[['greet',3],['walk','Z6'],['wait',6]]}
  ]},
  {id:'soldier-muster',role:'soldier',title:'集合报到与返回',motionLabRecipe:'muster',needLabel:'集合报到需求',period:840,initialNeed:.45,cooldown:150,tools:[],phases:[
   {title:'集合点报到',actions:[['walk','Z2'],['turn',0,'world'],['salute',3],['wait',8]]},
   {title:'返回交接岗位',actions:[['walk','Z1'],['greet',3],['wait',3]]}
  ]},
  {id:'soldier-patrol',role:'soldier',title:'值勤巡视与回岗',needLabel:'值勤巡视频度',period:420,initialNeed:.60,cooldown:90,tools:[],phases:[
   {title:'门岗招呼',actions:[['walk','Z1'],['greet',2],['wait',6]]},
   {title:'营房、仓库和食堂巡视',actions:[['walk','Z5'],['wait',6],['walk','Z3'],['wait',6],['walk','Z8'],['wait',6]]}
  ]},
  {id:'soldier-equipment',role:'soldier',title:'营房器材借用与归还',needLabel:'营房器材检查需求',period:660,initialNeed:.85,cooldown:120,tools:['SUP_A'],phases:[
   {title:'器材送至营房',actions:[['carry','SUP_A','Z5'],['greet',2]]},
   {title:'器材清点',actions:[['wait',16]]}
  ]},
  {id:'soldier-canteen',role:'soldier',title:'食堂配送与空箱回收',needLabel:'食堂周转需求',period:720,initialNeed:.70,cooldown:150,tools:['SUP_B','EMPTY_A'],phases:[
   {title:'日用品箱交接',actions:[['carry','SUP_B','Z8'],['wait',14]]},
   {title:'空箱送交回收点',actions:[['carry','EMPTY_A','Z9'],['wait',14]]}
  ]},
  {id:'officer-inspection',role:'officer',title:'营区检查与回访登记',needLabel:'设施检查需求',period:600,initialNeed:.85,cooldown:120,tools:[],phases:[
   {title:'集合场与营房检查',actions:[['walk','Z2'],['greet',2],['wait',8],['walk','Z5'],['wait',8]]},
   {title:'仓储、食堂与门岗回访',actions:[['walk','Z3'],['wait',8],['walk','Z8'],['wait',8],['walk','Z1'],['greet',2],['wait',8]]}
  ]},
  {id:'officer-records',role:'officer',title:'文书交接与归档',needLabel:'事务交接需求',period:540,initialNeed:.65,cooldown:100,tools:['DOC_A'],phases:[
   {title:'送达事务交接点',actions:[['carry','DOC_A','Z7'],['wait',12]]},
   {title:'门岗核对',actions:[['carry','DOC_A','Z1'],['greet',2],['wait',10]]}
  ]},
  {id:'villager-water',role:'villager',title:'取水、浇灌与归还水壶',needLabel:'农田缺水程度',period:540,initialNeed:.65,cooldown:150,tools:['WATER_A'],phases:[
   {title:'取水准备',actions:[['walk','Z25'],['wait',8]]},
   {title:'水壶送到田间并浇灌',actions:[['carry','WATER_A','Z14'],['wait',24]]}
  ]},
  {id:'villager-sort',role:'villager',title:'青菜筐分拣与交接周转',needLabel:'青菜筐分拣需求',period:660,initialNeed:.85,cooldown:120,tools:['AGR_A'],phases:[
   {title:'运到分拣点',actions:[['carry','AGR_A','Z11'],['wait',18]]},
   {title:'村口交接',actions:[['carry','AGR_A','Z17'],['greet',2],['wait',10]]}
  ]},
  {id:'villager-market',role:'villager',title:'市集筐具整理与归位',needLabel:'市集筐具周转需求',period:720,initialNeed:.55,cooldown:120,tools:['AGR_B'],phases:[
   {title:'市集筐具交接',actions:[['carry','AGR_B','Z18'],['wait',18]]},
   {title:'返回分拣点清点',actions:[['carry','AGR_B','Z11'],['wait',10]]}
  ]}
 ]
};
const copy=v=>JSON.parse(JSON.stringify(v));
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v)}return v};
const resident=role=>data.residents.find(n=>n.role===role);
const recipe=id=>data.routines.find(r=>r.id===id);
const home=id=>data.homes.find(h=>h.object===id);
const motionAvailable=r=>!!r&&r.phases.every(p=>p.actions.every(a=>['walk','turn','carry','wait','greet','salute'].includes(a[0])));
function waits(seconds){const steps=[];for(let left=seconds;left>0;left-=30)steps.push({type:'wait',duration:Math.min(30,left)});return steps}
function action(tuple){const[type,a,b]=tuple;if(type==='carry')return{type,objectId:a,targetId:b,relation:'inside'};if(type==='walk')return{type,targetId:a};if(type==='turn')return b==='world'?{type,headingDeg:a}:{type,angleDeg:a};if(['wait','greet','salute'].includes(type))return{type,duration:a};throw Error('未知日常动作：'+type)}
function build(id,role,kind='cycle'){
 const npc=resident(role),r=recipe(id);if(!npc||(!r&&kind!=='rest')||r&&r.role!==role)throw Error('日常任务与身份不匹配');
 if(kind==='rest')return{title:'原地恢复与等待',phases:[{title:'休息恢复',steps:waits(30)}],steps:waits(30),tools:[],home:null,kind};
 if(!['cycle','recovery'].includes(kind))throw Error('未知日常执行模式');
 const phases=[{title:'起身并准备',steps:[{type:'stand'}]}];
 if(kind==='cycle')for(const p of r.phases)phases.push({title:p.title,steps:p.actions.map(action)});
 if(r.tools.length)phases.push({title:'工具与周转物品归位',steps:r.tools.flatMap(id=>[{type:'carry',objectId:id,targetId:home(id).zone,relation:'inside'},...waits(6)])});
 phases.push({title:'休息恢复',steps:[{type:'walk',targetId:npc.rest},{type:'sit'},...waits(npc.restSeconds),{type:'stand'}]});
 phases.push({title:'回到本职岗位',steps:[{type:'walk',targetId:npc.home},...waits(3)]});
 const steps=phases.flatMap(p=>p.steps);if(steps.length>64)throw Error('日常任务超过单轮步骤上限');
 return{title:kind==='recovery'?'归位恢复 · '+r.title:r.title,phases,steps,tools:[...r.tools],home:npc.home,kind};
}
function required(id,role,kind='cycle'){const r=recipe(id),npc=resident(role);if(!r||!npc||r.role!==role)throw Error('身份没有这项日常');const work=kind==='cycle'?r.phases.flatMap(p=>p.actions.flatMap(t=>t[0]==='walk'?[t[1]]:t[0]==='carry'?[t[1],t[2]]:[])):[];return [...new Set([npc.home,npc.rest,...r.tools,...r.tools.map(id=>home(id).zone),...work,...(kind==='cycle'&&id==='villager-water'?['WATER_PT']:[])])]}
function verify(id,world,actor){
 const r=recipe(id),npc=r&&resident(r.role),reasons=[];if(!r||!npc)return{ok:false,reasons:['日常任务不存在']};
 const get=id=>[...(world.objects||[]),...(world.zones||[])].find(o=>o.id===id);
 for(const id of r.tools){const o=get(id),z=get(home(id).zone),radius=o?.r||0;if(!o||!z||o.held){reasons.push(id+'尚未归位');continue}const dx=Math.abs(o.p[0]-z.p[0]),dz=Math.abs(o.p[2]-z.p[2]);if(z.shape==='square'?dx+radius>z.r||dz+radius>z.r:Math.hypot(dx,dz)+radius>z.r*(z.shape==='hexagon'?Math.cos(Math.PI/6):1))reasons.push(o.name+'没有完整回到归位区');}
 const z=get(npc.home),p=actor.pos||actor.position;
 if(!z||!p||Math.hypot(p[0]-z.p[0],p[2]-z.p[2])>z.r+.5)reasons.push('人物尚未回到本职岗位');
 if(actor.posture!=='standing')reasons.push('人物尚未站立');if(actor.heldObject)reasons.push('人物仍在持物');
 return{ok:!reasons.length,reasons};
}
root.JarvisNPCRoutineCatalog=Object.freeze({data:freeze(data),resident,recipe,home,build,required,verify,copy,motionAvailable});
})(typeof globalThis!=='undefined'?globalThis:this);
