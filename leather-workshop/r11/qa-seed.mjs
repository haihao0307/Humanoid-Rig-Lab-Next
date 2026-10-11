import assert from 'node:assert/strict';
import {seedSample, seedWord} from './site/seed-field.mjs';
import {writeFileSync, mkdirSync} from 'node:fs';
const values = [], right = [], up = [], alternate = [];
for (let y=-128;y<128;y++) for (let x=-128;x<128;x++) {
  values.push(seedSample(x,y,27)); right.push(seedSample(x+1,y,27));
  up.push(seedSample(x,y+1,27)); alternate.push(seedSample(x,y,28));
}
const mean = a => a.reduce((s,v)=>s+v,0)/a.length;
const average = mean(values), variance = mean(values.map(v=>(v-average)**2));
function correlation(a,b) {
  const A=mean(a),B=mean(b);let numerator=0,aa=0,bb=0;
  for(let i=0;i<a.length;i++){const x=a[i]-A,y=b[i]-B;numerator+=x*y;aa+=x*x;bb+=y*y;}
  return numerator/Math.sqrt(aa*bb);
}
const bins=Array(32).fill(0);values.forEach(v=>bins[Math.floor(v*32)]++);
const tests = {
  range: values.every(v=>v>=0&&v<1),
  balancedMean: Math.abs(average-.5)<.01,
  uniformVariance: Math.abs(variance-1/12)<.004,
  horizontalCorrelation: Math.abs(correlation(values,right))<.02,
  verticalCorrelation: Math.abs(correlation(values,up))<.02,
  seedDecorrelation: Math.abs(correlation(values,alternate))<.02,
  broadHistogram: bins.every(v=>Math.abs(v-values.length/32)/(values.length/32)<.15),
  reproducible: seedWord(19.7,-41.3,27)===seedWord(19.7,-41.3,27),
  negativeZeroCanonical: seedWord(-0,0,27)===seedWord(0,-0,27),
  validation: false
};
let rejected=0;for(const x of[NaN,Infinity,-Infinity,1e300])try{seedWord(x,0,0);}catch{rejected++;}
tests.validation=rejected===4;
const report={purpose:'non-cryptographic graphics distribution sanity, not randomness/security certification',sampleCount:values.length,mean:average,variance,bins,correlations:{right:correlation(values,right),up:correlation(values,up),seed:correlation(values,alternate)},tests,pass:Object.values(tests).every(Boolean)};
mkdirSync(new URL('./qa/',import.meta.url),{recursive:true});
writeFileSync(new URL('./qa/seed.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));assert(report.pass);
