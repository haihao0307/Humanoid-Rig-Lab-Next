'use strict';const fs=require('fs'),g=require('./fidelity-geometry-r21.cjs'),run=require('./fidelity-worker-r21.cjs')(),field=run.build(),f=require('./fidelity-field-r21.cjs')(field);
const q={method:'Dense line samples followed by sign-bracket bisection; independent diagnostic, not a global first-hit proof',cases:[],sourceFidelityAccepted:false};
for(const name of['front','side','left-hand','left-foot']){
 const a=JSON.parse(fs.readFileSync('qa/fidelity-r21/offline/rays-initial-'+name+'.json')),b=JSON.parse(fs.readFileSync('qa/fidelity-r21/offline/rays-intervals-v2-'+name+'.json'));
 const chosen=b.rows.filter(r=>r.gpuT!==null&&r.originalT!==null).sort((x,y)=>Math.abs(y.depthErrorMM)-Math.abs(x.depthErrorMM)).slice(0,4);
 for(const ray of chosen){let lo=0,hi=6;for(let k=0;k<3;k++){if(Math.abs(ray.rd[k])<1e-14)continue;let l=(field.bounds[k][0]-a.eye[k])/ray.rd[k],h=(field.bounds[k][1]-a.eye[k])/ray.rd[k];if(l>h)[l,h]=[h,l];lo=Math.max(lo,l);hi=Math.min(hi,h);}
 const at=t=>a.eye.map((v,k)=>v+ray.rd[k]*t),roots=[];let prev=lo,pd=f.value(at(lo)),minimum=Infinity;
 for(let t=lo+.0001;t<=hi;t+=.0001){const d=f.value(at(t));minimum=Math.min(minimum,d);if(d*pd<0){let l=prev,h=t,fl=pd;for(let k=0;k<24;k++){const m=(l+h)/2,fm=f.value(at(m));if((fm>0)===(fl>0)){l=m;fl=fm;}else h=m;}const root=(l+h)/2,p=at(root),c=p.map((v,k)=>Math.max(0,Math.min(field.intervalCache.dimensions[k]-1,Math.floor((v-field.bounds[k][0])/(field.bounds[k][1]-field.bounds[k][0])*field.intervalCache.dimensions[k]))));roots.push({t:root,active:field.intervalCache.active[c[0]+field.intervalCache.dimensions[0]*(c[1]+field.intervalCache.dimensions[1]*c[2])]});}prev=t;pd=d;}
 const old=a.rows.find(r=>r.x===ray.x&&r.y===ray.y),row={name,x:ray.x,y:ray.y,oldGPU:old.gpuT,newGPU:ray.gpuT,source:ray.originalT,roots,scalarAtOldMM:old.gpuT===null?null:f.value(at(old.gpuT))*1000,scalarAtNewMM:f.value(at(ray.gpuT))*1000,oldNeighbourhoodMM:old.gpuT===null?null:[-.001,-.0002,0,.0002,.001].map(dt=>({delta:dt,value:f.value(at(old.gpuT+dt))*1000}))};q.cases.push(row);console.log(JSON.stringify(row));
 }
}
fs.writeFileSync('qa/fidelity-r21/first-hit-diagnosis.json',JSON.stringify(q,null,2));
