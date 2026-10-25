import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MotionController as Baseline} from '../../motion/vendor/controller.mjs';
import {MotionController as Smoothed} from './vendor/controller.mjs';
import {rigFromSource} from '../../motion/vendor/rig.mjs';
import {FlatWorld} from '../../motion/vendor/world.mjs';
const doc=JSON.parse(readFileSync(new URL('../../reconstruction/rig-reference.json',import.meta.url),'utf8'));
const base=rigFromSource(doc),scales=[.88,.91,.94,.97,1,1.03,1.06,1.09,1.12,1.15],dts=[1/120,1/90,1/60];
const routes=[[[0,0,0],[.35,0,.7],[.8,0,1.2],[.2,0,1.7],[-.2,0,.8]],[[0,0,0],[-.45,0,.6],[-.9,0,1.2],[-.2,0,1.8],[.3,0,.7]],[[0,0,0],[.6,0,.35],[.9,0,-.2],[-.3,0,-.6],[-.5,0,.5]],[[0,0,0],[-.3,0,1.0],[.4,0,1.4],[.7,0,.6],[0,0,.2]]];
const variants=[['baseline',Baseline],['smoothed',Smoothed]],results=[];
function makeRig(scale,hipWidthScale){const r=structuredClone(base);for(const side of ['left','right']){r.legs[side].upper*=scale;r.legs[side].lower*=scale;}r.hipHalf*=hipWidthScale;r.ankleHeight*=scale;r.hipHeight=Math.min(...Object.values(r.legs).map(x=>x.upper+x.lower))*.94+r.ankleHeight;return r;}
for(const [variant,Controller] of variants)for(let si=0;si<scales.length;si++)for(let di=0;di<dts.length;di++){
 const scale=scales[si],dt=dts[di],hipWidthScale=[.88,.94,1,1.06,1.12][(si+di)%5],rig=makeRig(scale,hipWidthScale),controller=new Controller(rig,new FlatWorld());
 let commands=0,steps=0,faults=0,timeouts=0,blocked=0,maxRootSpeed=0,maxRootAcceleration=0,maxYawSpeed=0,maxYawAcceleration=0;
 let prevRoot=[...controller.state.root],prevVel=[0,0,0],prevYaw=controller.state.yaw,prevYawRate=0;const route=routes[(si+di)%routes.length];
 for(let lap=0;lap<20;lap++)for(let ri=1;ri<route.length;ri++){
  const target=route[ri],cmd=controller.command({type:'walk',target});if(!cmd.accepted){results.push({variant,scale,dt,lap,ri,status:'rejected',reason:cmd.reason});continue;}
  let local=0;while(controller.state.command&&local<6000&&!controller.state.fault&&controller.state.status!=='blocked'){
   controller.update(dt);local++;steps++;const root=controller.state.root,vel=[(root[0]-prevRoot[0])/dt,0,(root[2]-prevRoot[2])/dt],acc=Math.hypot(vel[0]-prevVel[0],vel[2]-prevVel[2])/dt;
   const yawRate=Math.atan2(Math.sin(controller.state.yaw-prevYaw),Math.cos(controller.state.yaw-prevYaw))/dt,yawAcc=Math.abs(yawRate-prevYawRate)/dt;
   maxRootSpeed=Math.max(maxRootSpeed,Math.hypot(vel[0],vel[2]));maxRootAcceleration=Math.max(maxRootAcceleration,acc);maxYawSpeed=Math.max(maxYawSpeed,Math.abs(yawRate));maxYawAcceleration=Math.max(maxYawAcceleration,yawAcc);
   prevRoot=[...root];prevVel=vel;prevYaw=controller.state.yaw;prevYawRate=yawRate;
  }
  if(controller.state.fault){faults++;results.push({variant,scale,dt,lap,ri,status:'fault',reason:controller.state.fault});break;}
  if(controller.state.status==='blocked'){blocked++;results.push({variant,scale,dt,lap,ri,status:'blocked'});break;}
  if(controller.state.command){timeouts++;results.push({variant,scale,dt,lap,ri,status:'timeout'});break;}
  commands++;results.push({variant,scale,dt,lap,ri,status:'completed',steps:local});
 }
 results.push({variant,scale,dt,status:'case-summary',commands,steps,faults,timeouts,blocked,maxRootSpeed,maxRootAcceleration,maxYawSpeed,maxYawAcceleration,finalRoot:[...controller.state.root]});
 assert.equal(faults,0,JSON.stringify({variant,scale,dt,problem:'fault'}));assert.equal(timeouts,0,JSON.stringify({variant,scale,dt,problem:'timeout'}));
}
const summaries=results.filter(x=>x.status==='case-summary'),aggregate=Object.fromEntries(variants.map(([v])=>{const a=summaries.filter(x=>x.variant===v);return[v,{cases:a.length,commands:a.reduce((n,x)=>n+x.commands,0),steps:a.reduce((n,x)=>n+x.steps,0),maxRootSpeed:Math.max(...a.map(x=>x.maxRootSpeed)),maxRootAcceleration:Math.max(...a.map(x=>x.maxRootAcceleration)),maxYawSpeed:Math.max(...a.map(x=>x.maxYawSpeed)),maxYawAcceleration:Math.max(...a.map(x=>x.maxYawAcceleration)),blocked:a.reduce((n,x)=>n+x.blocked,0)}]}));
console.log(JSON.stringify({suite:'controller-proportion-timestep-sweep',caseCount:summaries.length,scaleCount:scales.length,timestepCount:dts.length,routeTemplates:routes.length,passesPerCase:20,aggregate,results,limitations:['Source-level kinematic controller testing, not rendered-skin or full manipulation physics','Anthropometric sweep scales leg proportions and hip width only; it is not a validated full-body morphology model']},null,2));