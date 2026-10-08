import{LeatherDynamics}from './site/dynamics.mjs';
import{writeFileSync,mkdirSync}from'node:fs';
const key=process.argv[2]||'normal';
const opts=key==='heavy'?{stoneMass:.07,dropHeight:.08}:key==='light'?{stoneMass:.025,dropHeight:.02}:key==='angle90'?{profile:'AL',angle:90}:key==='angle0'?{profile:'AL',angle:0}:{};
let d=new LeatherDynamics(opts),records=[],peakRes=0,maxEnergy=0,minSpeed=1e9;
function sim(t){const n=Math.round(t/d.cfg.dt);for(let i=0;i<n&&!d.failed;i++){d.step();peakRes=Math.max(peakRes,d.lastResidual||0);if(i%6===0){let r=d.report();records.push(r);maxEnergy=Math.max(maxEnergy,r.totalEnergyJ);}}}
console.time(key);sim(.75);const empty=d.report();
d.drop();const budget=d.report().totalEnergyJ;sim(2);const loaded=d.report();d.removeStone();sim(1.25);const recovered=d.report();mkdirSync('qa',{recursive:true});writeFileSync(new URL('./qa/scene-'+key+'.json',import.meta.url),JSON.stringify({key,config:d.cfg,empty,loaded,recovered,peakRes,maxEnergy,budget,records},null,2));console.log({empty:empty.centerSagMM,loaded:loaded.centerSagMM,peak:loaded.peakSagMM,recovered:recovered.centerSagMM,stretch:loaded.peakStretch,peakPen:loaded.peakPenetrationMM,peakRes,maxEnergy,budget,failed:d.failed});
if(d.failed||loaded.maxStretch>1.05||loaded.peakPenetrationMM>.03||loaded.centerSagMM<empty.centerSagMM+.4||Math.abs(recovered.centerSagMM-empty.centerSagMM)>.5||maxEnergy>budget+1e-5||recovered.pinErrorMM>1e-8)throw Error('Full-lifecycle validation failed '+key);
console.timeEnd(key);
