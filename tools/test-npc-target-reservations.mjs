import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../body/NaturalLocomotion.js',import.meta.url),'utf8');
const horizontal=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
const api=vm.runInNewContext(source+'\n({trafficReserveTargetSlot,trafficReleaseTargetSlot,trafficPruneSlotClaims,trafficRuntime})',{
 console,Math,Map,Set,WeakMap,JSON,Error,Number,String,Object,Array,structuredClone,
 horizontal,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),mix:(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t),
 add:(a,b)=>a.map((v,i)=>v+b[i]),sub:(a,b)=>a.map((v,i)=>v-b[i]),mul:(a,s)=>a.map(v=>v*s),
 dot:(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0),len:a=>Math.hypot(...a),norm:a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l);},
 qy:()=>[0,0,0,1],rotate:(q,v)=>v,objectYaw:()=>0,objectRadius:o=>o.r||.2,objectFootprint:o=>[o.r||.2,o.r||.2],objectTilted:()=>false,
 bodyPhysicalProfile:()=>({bodyRadiusM:.3}),carryRouteRadius:()=>.5,MotionLab:{FlatWorld:class{constructor(){} sweep(){return{fraction:1};}}}
});

const zone={id:'Z1',p:[0,0,0],r:2.6};
const actors=[];
const population={
 values:()=>actors,
 collisionFor:(agent,p,r)=>actors.some(actor=>actor.agent!==agent&&!actor.disposed&&horizontal(p,actor.agent.pos)<r+.3+.06)
};
const world={population,get:id=>id==='Z1'?zone:null,path:(start,end)=>[[...end]],objects:[],bounds:{xMin:-20,xMax:20,zMin:-20,zMax:20}};
const context={radius:.3,ignore:[]},locomotions=[];
for(let i=0;i<8;i++){
 const id='npc-'+String(i+1).padStart(2,'0'),agent={npcId:id,index:0,phase:'walk',skill:{type:'walk',targetId:'Z1'},route:[[0,0,0]],routeIndex:0,pos:[8+i,0,8],w:world,logs:[],log(message){this.logs.push(message);}};
 const actor={id,label:id,human:{bodyMetrics:{bodyRadiusM:.3}},agent,disposed:false};actors.push(actor);
 const locomotion={a:agent,engine:{state:{root:[...agent.pos]}},traffic:{slotKey:null,slotTaskKey:null,slotPoint:null,slotIndex:null,slotReservations:0},requestKey:null};agent.locomotion=locomotion;locomotions.push(locomotion);
 const point=api.trafficReserveTargetSlot(locomotion,context);assert(point);assert.equal(agent.route.length,1);assert.deepEqual(agent.route[0],point);
}
const points=locomotions.map(l=>l.traffic.slotPoint),unique=new Set(points.map(p=>p.map(v=>v.toFixed(5)).join(',')));
assert.equal(unique.size,8,'eight recipients must receive eight distinct terminal slots');
assert(points.some(p=>horizontal(p,zone.p)<1e-9),'first recipient keeps the canonical target when it is free');
for(const point of points)assert(horizontal(point,zone.p)<=zone.r-context.radius-.08+1e-9,'reserved point must stay inside the target zone clearance');
for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)assert(horizontal(points[i],points[j])>=.58-1e-9,'terminal slots must retain body clearance');
assert(locomotions.slice(1).some(l=>l.a.logs.some(message=>message.includes('独立接近站位'))));

const released=locomotions[0];api.trafficReleaseTargetSlot(released);assert.equal(released.traffic.slotKey,null);
released.a.skill=null;api.trafficPruneSlotClaims(population,api.trafficRuntime(population));
const replacementAgent={npcId:'npc-09',index:0,phase:'walk',skill:{type:'walk',targetId:'Z1'},route:[[0,0,0]],routeIndex:0,pos:[18,0,18],w:world,log(){}};
const replacementActor={id:'npc-09',label:'npc-09',human:{bodyMetrics:{bodyRadiusM:.3}},agent:replacementAgent,disposed:false};actors.push(replacementActor);
const replacement={a:replacementAgent,engine:{state:{root:[...replacementAgent.pos]}},traffic:{slotKey:null,slotTaskKey:null,slotPoint:null,slotIndex:null,slotReservations:0},requestKey:null};replacementAgent.locomotion=replacement;
api.trafficReserveTargetSlot(replacement,context);assert(horizontal(replacement.traffic.slotPoint,zone.p)<1e-9,'released canonical slot must be reusable');
console.log(JSON.stringify({passed:true,recipients:8,uniqueSlots:unique.size,reusedCanonicalSlot:true,parkingWait:false}));
