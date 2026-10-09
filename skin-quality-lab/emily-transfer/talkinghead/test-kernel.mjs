import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BehaviorController} from './BehaviorController.js';
const result={upstreamVersion:'1.7.0',checks:[]};
function test(name,fn){fn();result.checks.push(name);}
test('Upstream queue actually evaluated',()=>{const c=new BehaviorController();for(let i=0;i<600;i++)c.advance(1/60);assert.equal(c.kernel.steps,600);assert(c.kernel.animClock>9900);assert(c.kernel.animQueue.length<=6);});
for(const kind of ['single','double','left','right'])test('Native template: '+kind,()=>{
 const c=new BehaviorController();c.kernel.animQueue=[];c.blink(kind);let hits=[0,0],was=[false,false],max=[0,0];
 for(let i=0;i<400;i++){const f=c.advance(.01,false);for(let e=0;e<2;e++){const high=f.blink[e]>.95;max[e]=Math.max(max[e],f.blink[e]);if(high&&!was[e])hits[e]++;was[e]=high;}}
 const expected=kind==='double'?[2,2]:kind==='left'?[0,1]:kind==='right'?[1,0]:[1,1];assert.deepEqual(hits,expected);assert.deepEqual(c.readFrame(false).blink,[0,0]);
});
test('Manual fixed channels win over animation',()=>{const c=new BehaviorController();c.kernel.setFixedValue('eyeBlinkLeft',.37);for(let i=0;i<120;i++)c.advance(1/60);c.blink('double');for(let i=0;i<120;i++){c.advance(1/60);assert.equal(c.kernel.mtAvatar.eyeBlinkLeft.value,.37);} });
test('Pause does not advance native clock',()=>{const c=new BehaviorController();c.advance(.03);c.configure({paused:true});const clock=c.kernel.animClock;for(let i=0;i<100;i++)c.advance(.05);assert.equal(c.kernel.animClock,clock);});
test('Nod/shake use native yes/no tracks',()=>{for(const kind of ['yes','no']){const c=new BehaviorController();c.kernel.animQueue=[];c.gesture(kind);let peak=0;for(let i=0;i<300;i++){const f=c.advance(.01);peak=Math.max(peak,Math.abs(f.head[kind==='yes'?0:1]));}assert(peak>.035);}});
test('Invalid config rejected without settings mutation',()=>{const c=new BehaviorController();const before=JSON.stringify(c.settings);assert.throws(()=>c.configure({manualYaw:NaN}));assert.equal(JSON.stringify(c.settings),before);assert.throws(()=>c.configure({mood:'missing'}));});
test('Repeated state changes keep queues bounded',()=>{const c=new BehaviorController();for(let i=0;i<100;i++){c.configure({mood:['neutral','happy','sad','sleep'][i%4]});c.blink('double');c.gesture('yes');c.advance(.02);assert(c.kernel.animQueue.length<=6);}});
console.log(JSON.stringify({...result,passed:true},null,2));fs.writeFileSync(new URL('./qa-kernel.json',import.meta.url),JSON.stringify({...result,passed:true},null,2));
