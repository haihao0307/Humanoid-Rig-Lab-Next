import {LeatherDynamics} from './site/dynamics.mjs';
import {writeFileSync} from 'node:fs';
const d=new LeatherDynamics({stoneMass:.07,dropHeight:.08});
d.drop();let samples=[];
for(let i=0;i<360&&!d.failed;i++){d.step();if(i%60===59){const r=d.report();samples.push(r);console.log('direct',r.timeS,r.centerSagMM,r.contactCount);}}
const r=d.report();const pass=!d.failed&&r.contactCount>0&&r.maxStretch<1.05&&r.peakPenetrationMM<.03&&r.centerSagMM<20;
writeFileSync('qa/direct-drop.json',JSON.stringify({pass,mode:'immediate max-settings drop from reset, 1.5 simulated seconds',config:d.cfg,samples,report:r,experimentalCalibration:false},null,2));
if(!pass)throw Error('Immediate drop test failed');
console.log('PASS',JSON.stringify(r));
