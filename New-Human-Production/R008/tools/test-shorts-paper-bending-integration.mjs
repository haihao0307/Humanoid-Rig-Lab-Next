import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compilePaperSurfaceModel} from '../ShortsPaperSurfaceModel.mjs';
import {compilePaperBendingTopology,paperFormingBendingTerms,paperFormingBendingProduct} from '../ShortsPaperBendingTerms.mjs';
import {createShortsPaperForming,formShortsPaperSurface} from '../ShortsPaperForming.mjs';

// Pure source fixtures only. No saved garment coordinates, body, renderer or clock.
const files=['ShortsPaperForming.mjs','ShortsPaperBendingTerms.mjs','ShortsCurvatureModel.mjs','ShortsPaperSurfaceModel.mjs'];
const hash=name=>crypto.createHash('sha256').update(fs.readFileSync(fileURLToPath(new URL('../'+name,import.meta.url)))).digest('hex');
const sourceHashes=Object.fromEntries(files.map(f=>[f,hash(f)]));
const cases=[],evidence={};
const test=(name,fn)=>{try{fn();cases.push({name,passed:true});}catch(e){cases.push({name,passed:false,error:e.stack});}};
const close=(a,b,atol=1e-10,rtol=1e-7)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=atol+rtol*Math.max(Math.abs(a),Math.abs(b)),`${a} != ${b}`);
const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0),sub=(a,b)=>a.map((v,k)=>v-b[k]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const flat=[[0,0,0],[.1,0,0],[0,.08,0],[.1,.08,0]];
const axis=sub(flat[2],flat[1]),unit=axis.map(v=>v/Math.hypot(...axis)),angle=.7,r=sub(flat[3],flat[1]);
const folded=structuredClone(flat);
folded[3]=flat[1].map((v,k)=>v+r[k]*Math.cos(angle)+cross(unit,r)[k]*Math.sin(angle)+unit[k]*dot(unit,r)*(1-Math.cos(angle)));
const draft={sourceUV:[0,0,.1,0,0,.08,.1,.08],triangles:[0,1,2,1,3,2],ranges:[{pieceId:'P',offset:0,count:4}],mass:[.0003,.0006,.0006,.0003],seams:[]};
const bending={stiffnessNm:.0002,membraneScaleNPerM:10,seamLaw:'free-rotation'};
const model=compilePaperSurfaceModel(draft),topology=compilePaperBendingTopology(model,[0,1,2,3],bending);
const terms=p=>paperFormingBendingTerms(p,topology);

test('topology derives its single hinge edge/areas only from immutable source UV',()=>{
 assert.equal(model.status,'SOURCE_METRIC_VALID');assert.equal(topology.length,1);
 assert.equal(topology[0].sourceEdge,'1:2');close(topology[0].reference.restEdgeLengthM,Math.hypot(.1,.08));
 close(topology[0].reference.sourceAreaAM2,.004);close(topology[0].reference.sourceAreaBM2,.004);
 assert.equal(topology[0].normalizationNPerM,10);
});
test('flat paper has zero true bending energy; rigid fold preserves source metric',()=>{
 const c=createShortsPaperForming({draft,positions:folded,bending}).snapshot();
 close(terms(flat).energyM2,0);assert.ok(c.initial.maximumPrincipalStrain<1e-12);
 close(terms(folded).maximumAbsoluteAngleRadians,.7);assert.ok(terms(folded).energyM2>0);
 close(c.initialEnergy.bendingEnergyM2,terms(folded).energyM2);
});
test('normalized true bending energy analytic gradient agrees with central FD on flat and folded states',()=>{
 let maxAbsolute=0,maxRelative=0;
 for(const xyz of [flat,folded]){const t=terms(xyz);assert.equal(t.status,'BENDING_TERMS_VALID');
  for(let i=0;i<4;i++)for(let k=0;k<3;k++){const a=structuredClone(xyz),b=structuredClone(xyz),eps=1e-7;a[i][k]+=eps;b[i][k]-=eps;
   const fd=(terms(a).energyM2-terms(b).energyM2)/(2*eps),g=t.gradients[i][k];
   maxAbsolute=Math.max(maxAbsolute,Math.abs(fd-g));maxRelative=Math.max(maxRelative,Math.abs(fd-g)/Math.max(1e-8,Math.abs(fd),Math.abs(g)));
   close(fd,g,2e-12,2e-6);
  }
 }
 evidence.derivative={maximumAbsoluteError:maxAbsolute,maximumRelativeError:maxRelative,centralDifferenceStepM:1e-7};
});
test('GN diagonal equals every basis-vector public product diagonal',()=>{
 const t=terms(folded);for(let k=0;k<12;k++){const e=new Float64Array(12);e[k]=1;close(paperFormingBendingProduct(t.rows,e)[k],t.diagonalXYZ[k],1e-13);}
 assert.match(t.matrixAuthority,/not exact XYZ Hessian/);
});
test('GN product is symmetric and PSD with genuine off-diagonal coupling',()=>{
 const t=terms(folded),u=Float64Array.from({length:12},(_,i)=>Math.sin(i+1)),v=Float64Array.from({length:12},(_,i)=>Math.cos(2*i+.4));
 const Hu=paperFormingBendingProduct(t.rows,u),Hv=paperFormingBendingProduct(t.rows,v);
 close(dot(u,Hv),dot(v,Hu),1e-12);assert.ok(dot(u,Hu)>=-1e-13);assert.ok(dot(v,Hv)>=-1e-13);
 assert.ok(Hu.some((x,i)=>Math.abs(x-t.diagonalXYZ[i]*u[i])>1e-8));
});
test('at zero angle GN product agrees with FD of the true energy gradient',()=>{
 const t=terms(flat),v=Float64Array.from({length:12},(_,i)=>Math.sin(i*.7+1)*.01),eps=1e-6;
 const plus=flat.map((p,i)=>p.map((x,k)=>x+eps*v[i*3+k])),minus=flat.map((p,i)=>p.map((x,k)=>x-eps*v[i*3+k]));
 const gp=terms(plus).gradients.flat(),gm=terms(minus).gradients.flat(),Hv=paperFormingBendingProduct(t.rows,v);
 for(let k=0;k<12;k++)close((gp[k]-gm[k])/(2*eps),Hv[k],1e-10,1e-6);
});
test('multiple hinges sharing real DOFs accumulate both gradient and Jacobi diagonal',()=>{
 const one=terms(folded),two=paperFormingBendingTerms(folded,[topology[0],structuredClone(topology[0])]);
 close(two.energyM2,2*one.energyM2);for(let i=0;i<4;i++)for(let k=0;k<3;k++)close(two.gradients[i][k],2*one.gradients[i][k]);
 for(let k=0;k<12;k++)close(two.diagonalXYZ[k],2*one.diagonalXYZ[k]);
});
test('translation is a bending null mode and energy/gradient are proper-rotation covariant',()=>{
 const rotate=p=>[p[2],p[0],p[1]],move=p=>rotate(p).map((v,k)=>v+[.3,-.2,.5][k]),a=terms(folded),b=terms(folded.map(move));
 close(a.energyM2,b.energyM2);for(let i=0;i<4;i++)rotate(a.gradients[i]).forEach((v,k)=>close(v,b.gradients[i][k]));
 for(let k=0;k<3;k++){close(a.gradients.reduce((s,g)=>s+g[k],0),0);const v=Float64Array.from({length:12},(_,j)=>j%3===k?1:0);assert.ok(Math.hypot(...paperFormingBendingProduct(a.rows,v))<1e-12);}
});
test('free-rotation source seams are excluded rather than assigned a flat rest',()=>{
 const fake={...model,hinges:[...model.hinges,{kind:'across-piece-seam',seamId:'S',restAngleRadians:null,law:'UNSPECIFIED'}]};
 assert.deepEqual(compilePaperBendingTopology(fake,[0,1,2,3],bending),topology);
});
test('collapsed hinge HOLDs and invalid unit/law specifications reject',()=>{
 assert.equal(terms(Array.from({length:4},()=>[0,0,0])).status,'HOLD');
 for(const b of [{...bending,stiffnessNm:0},{...bending,membraneScaleNPerM:0},{...bending,seamLaw:'flat'},{...bending,stiffnessNm:Infinity}])assert.throws(()=>compilePaperBendingTopology(model,[0,1,2,3],b));
});
test('actual host enabled on a folded two-triangle sheet decreases true bending and total merit',()=>{
 const before=JSON.stringify({draft,folded,bending}),r=formShortsPaperSurface({draft,positions:folded,bending},{maximumIterations:12});
 assert.equal(JSON.stringify({draft,folded,bending}),before);assert.ok(r.iterations>0,'isometric folded paper must not trigger metric-only early stop');
 assert.ok(r.finalEnergy.bendingEnergyM2<r.initialEnergy.bendingEnergyM2*.5);
 assert.ok(r.finalEnergy.totalEnergyM2<r.initialEnergy.totalEnergyM2);assert.ok(r.trace.every(t=>t.finalEnergyM2<t.initialEnergyM2));
 close(r.finalEnergy.bendingEnergyM2,terms(r.positions).energyM2);assert.ok(r.final.maximumPrincipalStrain<=.05);
 assert.equal(r.nativeSteps,0);assert.equal(r.nativeClockAdvanced,false);assert.equal(r.wearingAccepted,false);assert.equal(r.bodyClearanceValidated,false);
 evidence.host={iterations:r.iterations,initialBendingEnergyM2:r.initialEnergy.bendingEnergyM2,finalBendingEnergyM2:r.finalEnergy.bendingEnergyM2,initialTotalEnergyM2:r.initialEnergy.totalEnergyM2,finalTotalEnergyM2:r.finalEnergy.totalEnergyM2,finalPrincipalStrain:r.final.maximumPrincipalStrain,stopReason:r.stopReason};
});
test('disabled/null bending leaves identical source-only host trajectory',()=>{
 const x=flat.map((p,i)=>p.map((v,k)=>v*(k===0?1.13:1)+(i===3&&k===2?.003:0))),a=formShortsPaperSurface({draft,positions:x},{maximumIterations:4}),b=formShortsPaperSurface({draft,positions:x,bending:null},{maximumIterations:4});
 assert.deepEqual(a.positions,b.positions);assert.deepEqual(a.trace,b.trace);assert.equal(a.finalEnergy.bendingEnergyM2,0);
});
test('caller bending mutation is rejected before another host projection',()=>{
 const b={...bending},c=createShortsPaperForming({draft,positions:folded,bending:b});b.stiffnessNm*=2;assert.throws(()=>c.step(),/changed original source/);
});
test('module/host checks preserve all source arrays, input XYZ and source hashes',()=>{
 const before=JSON.stringify({draft,folded,topology});terms(folded);terms(folded);assert.equal(JSON.stringify({draft,folded,topology}),before);
 assert.deepEqual(Object.fromEntries(files.map(f=>[f,hash(f)])),sourceHashes);
});
const failures=cases.filter(c=>!c.passed),report={schema:'shorts-paper-bending-independent-integration@1',createdAt:new Date().toISOString(),scope:'PURE_SOURCE_FIXTURE_ONLY; no actual body/garment/browser/native certificate',sourceHashes,passed:cases.length-failures.length,total:cases.length,cases,evidence,wearingAccepted:false,motionValidated:false};
const arg=process.argv.indexOf('--report');if(arg>=0)fs.writeFileSync(path.resolve(process.argv[arg+1]),JSON.stringify(report,null,2),{encoding:'utf8',flag:'wx'});
console.log(JSON.stringify(report,null,2));if(failures.length)process.exitCode=1;
