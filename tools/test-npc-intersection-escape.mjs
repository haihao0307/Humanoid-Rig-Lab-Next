// Reduced geometry from the real workbench failure near the root-vegetable
// crate. The actor has room to move sideways, but the circulation turn points
// into the crate. Exercise multiple owner headings after a lease handover.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {FlatWorld} from '../motion/vendor/world.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8'),runtime=read('source/runtime.template.js');
const code=runtime.split('// MODULE math')[1].split('function matrix')[0]+'\n'+runtime.slice(runtime.indexOf('function objectYaw'),runtime.indexOf('/*__SOURCE:world/PhysicsContract.js__*/'))+'\n'+read('world/PhysicsContract.js')+'\n'+read('body/NaturalLocomotion.js')+'\n'+read('body/CrowdIntersectionCoordinator.js');
const horizontal=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
const api=vm.runInNewContext(code+'\n({trafficIntersectionMobileEscape,motionCircleSweep,trafficSegmentClear,pointToObjectClearance})',{horizontal,bodyPhysicalProfile:h=>({bodyRadiusM:h.radius}),MotionLab:{FlatWorld}});
const world={bounds:{xMin:-13,xMax:13,zMin:-9.4,zMax:9.4},objects:[{id:'AGR_B',shape:'box',p:[11.2,.14,-2.95],w:.4,d:.34,h:.28,collidable:true}]};
const actors=[['npc-1',[12.1,.8874,-1.5],.26],['npc-2',[11.12765766856224,.7882337617881323,-2.40036882182891],.270535163503],['npc-3',[9.4614,.9153,.4401],.2756],['npc-4',[10.5745,.8512,-.5701],.28521800944125475]].map(([id,pos,radius])=>({id,human:{radius},agent:{npcId:id,pos,w:world}}));
world.population={values:()=>actors,sweepFor:(a,s,e,r)=>actors.filter(row=>row.agent!==a).reduce((n,row)=>Math.min(n,api.motionCircleSweep(s,e,row.agent.pos,r+row.human.radius+.06)),1)};
const a=actors[1].agent,context={radius:actors[1].human.radius,ignore:[]},center=[10.398833871890776,0,-1.777942353126262];
const free=p=>p[0]+context.radius<=13&&p[0]-context.radius>=-13&&p[2]+context.radius<=9.4&&p[2]-context.radius>=-9.4&&world.objects.every(o=>api.pointToObjectClearance(p,o)>=context.radius+.06)&&actors.every(o=>o.agent===a||horizontal(p,o.agent.pos)>=context.radius+o.human.radius+.06);
const locomotion={a,engine:{state:{root:a.pos}},traffic:{},world:{free}};
const blocked=[];let checks=0;
for(const yaw of [0,.2,.4,.6,.8,1,1.2,1.4,1.6,1.8,2,2.2,2.4,2.6,2.8,3]){
 const lease={center,ownerId:'npc-4',direction:1,ownerEntry:[Math.sin(yaw),0,Math.cos(yaw)],members:new Map([['npc-2',{}],['npc-4',{}]])};
 const target=api.trafficIntersectionMobileEscape(locomotion,lease,context);
 if(!target){blocked.push(yaw);continue;}
 assert(free(target));assert(api.trafficSegmentClear(a,a.pos,target,context));checks++;
}
assert.deepEqual(blocked,[],'a safe mobile escape must exist for these owner headings');
console.log(JSON.stringify({passed:true,checks,realFailureGeometry:true,physicsExecuted:false}));
