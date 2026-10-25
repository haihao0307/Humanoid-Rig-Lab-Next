import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MotionController as Baseline} from '../../motion/vendor/controller.mjs';
import {MotionController as Smoothed} from './vendor/controller.mjs';
import {rigFromSource} from '../../motion/vendor/rig.mjs';
import {FlatWorld} from '../../motion/vendor/world.mjs';
const doc=JSON.parse(readFileSync(new URL('../../reconstruction/rig-reference.json',import.meta.url),'utf8')),rig=rigFromSource(doc);
const dts=[1/120,1/90,1/60],targets=[Math.PI/6,Math.PI/3,Math.PI/2,Math.PI*.75,Math.PI,-Math.PI*.75,-Math.PI/2,-Math.PI/3,-Math.PI/6,0,Math.PI*.9,-Math.PI*.9];
const variants=[['baseline',Baseline],['smoothed',Smoothed]],results=[];
for(const [variant,Controller] of variants)for(const dt of dts)for(let offset=0;offset<targets.length;offset++){
 const c=new Controller(rig,new FlatWorld());let steps=0,faults=0,timeouts=0,maxYawRate=0,maxYawAcceleration=0,prevYaw=c.state.yaw,prevRate=0;
 const sequence=[...targets.slice(offset),...targets.slice(0,offset)];
 for(const yaw of sequence){
  const cmd=c.command({type:'turn',yaw});if(!cmd.accepted){results.push({variant,dt,offset,yaw,status:'rejected',reason:cmd.reason});continue;}
  let n=0;while(c.state.command&&n<6000&&!c.state.fault&&c.state.status!=='blocked'){
   c.update(dt);n++;steps++;
   const rate=Math.atan2(Math.sin(c.state.yaw-prevYaw),Math.cos(c.state.yaw-prevYaw))/dt,acc=Math.abs(rate-prevRate)/dt;
   maxYawRate=Math.max(maxYawRate,Math.abs(rate));maxYawAcceleration=Math.max(maxYawAcceleration,acc);prevYaw=c.state.yaw;prevRate=rate;
  }
  if(c.state.fault){faults++;break;}if(c.state.command){timeouts++;break;}
 }
 results.push({variant,dt,offset,status:faults?'fault':timeouts?'timeout':'completed',steps,faults,timeouts,maxYawRate,maxYawAcceleration,finalYaw:c.state.yaw});
 assert.equal(faults,0,JSON.stringify({variant,dt,offset,issue:'fault'}));assert.equal(timeouts,0,JSON.stringify({variant,dt,offset,issue:'timeout'}));
}
const summaries=results.filter(x=>x.status==='completed'),aggregate=Object.fromEntries(variants.map(([v])=>{const a=summaries.filter(x=>x.variant===v);return[v,{cases:a.length,steps:a.reduce((n,x)=>n+x.steps,0),maxYawRate:Math.max(...a.map(x=>x.maxYawRate)),maxYawAcceleration:Math.max(...a.map(x=>x.maxYawAcceleration))}]}));
console.log(JSON.stringify({suite:'controller-turn-sequence-sweep',cases:summaries.length,anglesPerSequence:targets.length,timestepCount:dts.length,aggregate,results,limitations:['Kinematic yaw/foot-lock test only; no rendered full-body naturalness evidence']},null,2));