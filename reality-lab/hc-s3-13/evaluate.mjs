import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {LocalContactSolver as Original,POLICY,edgeIntegrity} from './_runtime/original-solver.mjs';
import {LocalContactSolver as Adaptive} from './_runtime/adaptive-solver.mjs';
import {windingNumber} from './_runtime/rf37-contact-probe.mjs';
const dir=process.argv[2],destination=process.argv[3];
if(!dir||!destination)throw Error('Provide fixture directory and report destination');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const typed=a=>sha(new Uint8Array(a.buffer,a.byteOffset,a.byteLength));
const pin={
 'baseline-step30.json':'bf574d265e7a53b7de69accd5722f35d622b7f6e170f14797f888e451f7b9a7b',
 'guarded-step30.json':'602056e688b040b58d99d103422031bf3bc44907e37e1dbf636e08a3939622a3',
 'guarded-step102.json':'8c5a9a04693d2e864cdd1913bd45bd37bec5d485dc6d9a9bfb7d48a1af24de7f'};
const same=x=>JSON.parse(JSON.stringify(x));
const ordered=['original','adaptive','adaptive','original'];
function state(f,Solver){
 const p=Float64Array.from(f.cloth.positions),faces=Int32Array.from(f.cloth.faces),w=Float64Array.from(f.cloth.weights),
  body=Float64Array.from(f.body.positions),bf=Int32Array.from(f.body.faces);
 const arrays=[p,faces,w,body,bf],hashes=arrays.map(typed);
 const g=new Solver({model:{source:{p,faces,w,count:w.length}},world:{actor:{positions:body},body:{faces:bf}},bodyMotionClock:0},'local');g.begin(f.step);
 return {g,arrays,hashes};
}
function linearAudit(g,nodes,faces,args){
 const n=nodes.length*3,index=new Map(nodes.map((id,i)=>[id,i])),budget=Math.min(POLICY.maxMoveM,Math.max(args.margin,Math.hypot(...args.guide)*args.scale)),box=budget/Math.sqrt(3);
 const rows=g.collect(g.s.p,nodes,faces,null,args.margin).rows,contradictions=[];
 for(const r of rows){
  const a=Array(n).fill(0);
  for(let i=0;i<r.ids.length;i++){const id=index.get(r.ids[i]);if(id!==undefined)for(let k=0;k<3;k++)a[id*3+k]+=r.w[i]*r.normal[k];}
  const b=r.target-r.distanceM,support=a.reduce((s,v)=>s+Math.abs(v)*box,0);
  if(b>support+POLICY.linearToleranceM){
   const movableWeight=r.ids.reduce((s,id,i)=>s+(index.has(id)?r.w[i]:0),0);
   contradictions.push({id:r.id,ids:r.ids,weights:r.w,point:r.position,normal:r.normal,
    fixedIds:r.ids.filter(id=>!index.has(id)),distanceM:r.distanceM,requiredLinearGainM:b,boxSupportM:support,gapM:b-support,
    a,boxM:box,perNodeDisplacementBudgetM:budget,maximumSampleDisplacementM:movableWeight*budget,
    windingSupport:windingNumber(r.position,g.surface.p,g.surface.faces),
    meaning:'This single inequality cannot be satisfied in the ORIGINAL first-step coordinate box. Not a global nonlinear infeasibility proof.'});
  }
 }
 return {stage:'initial-zero-displacement-linearization',rowCount:rows.length,variables:n,scopeNodes:nodes,boxM:box,contradictions,
  allRowsJointFeasibleProved:false,globalNonlinearInfeasibilityProved:false};
}
function diagnostic(g,trial,args){
 const before=g.patch(g.s.p,trial.nodes,trial.faces,true),after=g.patch(trial.positions,trial.nodes,trial.faces,true);
 const pts=[];for(const n of trial.nodes)for(let k=0;k<3;k++)pts.push(trial.positions[n*3+k]);
 const summary=p=>({minimumM:Math.min(...p.samples.map(x=>x.distanceM)),negativeSamples:p.samples.filter(x=>x.distanceM<0).length,
  belowMarginSamples:p.samples.filter(x=>x.distanceM<args.margin-1e-7).length,strictCrossingPairs:p.crossingPairs.length,samples:p.samples});
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const normal=t=>cross(t[1].map((v,k)=>v-t[0][k]),t[2].map((v,k)=>v-t[0][k]));
 const flipped=before.geometry.cloth.reduce((count,t,i)=>{const a=normal(t.triangle),b=normal(after.geometry.cloth[i].triangle);return count+(a.reduce((s,x,k)=>s+x*b[k],0)<=0?1:0);},0);
 const shape=edgeIntegrity(g.s.p,trial.positions,g.s.faces,trial.faces),maxMoveM=Math.max(...trial.nodes.map(id=>Math.hypot(...[0,1,2].map(k=>trial.positions[id*3+k]-g.s.p[id*3+k]))));
 const outside=new Set(trial.nodes);let outsideUnchanged=true;for(let i=0;i<g.s.count;i++)if(!outside.has(i))for(let k=0;k<3;k++)if(!Object.is(g.s.p[i*3+k],trial.positions[i*3+k]))outsideUnchanged=false;
 return {nodes:trial.nodes,faces:trial.faces,seed:trial.seed,before:summary(before),after:summary(after),shape,flipped,maxMoveM,outsideUnchanged,
  geometry:{before:before.geometry,after:after.geometry},terminalPositionsSHA256:sha(JSON.stringify(pts)),sourceWritten:false};
}
const manifest=JSON.parse(fs.readFileSync(dir+'/MANIFEST.json'));assert(manifest.passed&&manifest.copyOnly&&manifest.allTrajectoryChecksPassed);
const output={schema:'kaopu/adaptive-contact-preflight-experiment@1',version:'RF01-S3.13',sourceSolverSHA256:'b9b7873d279eacc631b7c358dad71db312ffa42d4f18c12fc2b26e8ef88d53d2',
 fixtureRun:'39570430770',fixtureCodeCommit:'47b52d22a9204ff3c4bfe015c00e061ace76cfc7',nativeHostCommit:manifest.nativeHostCommit,policy:POLICY,
 testKind:'frozen native endpoint experiment; no new motion sequence',runOrder:ordered,cases:[],productionChanged:false,fullMotionExecuted:false,
 newNativeRuntimeInstalled:false,live:false,physicalCertification:false,continuousCollisionCertified:false,fitCertified:false};
for(const [file,pinned] of Object.entries(pin)){
 const raw=fs.readFileSync(dir+'/'+file);assert.equal(sha(raw),pinned);const f=JSON.parse(raw);assert(f.margin===.001&&f.pass===31);
 const args={faceOffset:f.faceOffset,ids:f.ids,movable:f.movable,scale:f.scale,guide:f.guide,normal:f.normal,margin:f.margin,pass:f.pass};
 const item={fixture:file,fixtureSHA256:pinned,step:f.step,faceOffset:f.faceOffset,marginM:f.margin,bodyTriangles:f.body.faces.length/3,
  runs:[],timing:{meaning:'frozen solver wall time includes first BVH creation; passive observer time recorded separately; NOT production frame time or5-second motion ABBA'}};
 const canonical={};
 for(let ordinal=0;ordinal<ordered.length;ordinal++){
  const mode=ordered[ordinal],{g,arrays,hashes}=state(f,mode==='original'?Original:Adaptive),terminals=[],proposals=[];let observerMS=0;
  g.__trialObserver=x=>{const t=performance.now();terminals.push(x);observerMS+=performance.now()-t;};
  g.__proposalObserver=x=>{const t=performance.now();proposals.push(x);observerMS+=performance.now()-t;};
  const start=performance.now(),value=g.solve(args),wallMS=performance.now()-start;
  assert(arrays.every((a,i)=>typed(a)===hashes[i]),'SOURCE_ARRAY_CHANGED');
  const record=value.record,analysisStart=performance.now();
  const signature={solution:value.solution,scopes:record.scopes.map(s=>({nodes:s.nodes,seed:s.seed,status:s.status,iterations:s.iterations,residualCrossingPairs:s.residualCrossingPairs})),
   proposals,terminalHashes:terminals.map(t=>typed(t.positions))};
  const deterministicSHA256=sha(JSON.stringify(signature));
  if(canonical[mode])assert.equal(deterministicSHA256,canonical[mode].deterministicSHA256,'REPEAT_NONDETERMINISTIC');
  const result={mode,ordinal,wallMS,observerMS,searchReportedMS:record.elapsedMS,deterministicSHA256,
   accepted:record.accepted,proposalReturned:!!value.solution,inputsUnchanged:true,sourceWritten:false,scopeSearches:record.scopes.length,
   nonlinearIterations:record.scopes.reduce((n,s)=>n+s.iterations.length,0),lineSearchTrials:proposals.length,
   preflight:record.preflight||null,budgetM:record.budgetM};
  if(!canonical[mode]){
   result.scopes=record.scopes.map((s,i)=>{
    const d=diagnostic(g,terminals[i],args),search=proposals.filter(t=>t.seed===s.seed&&JSON.stringify(t.nodes)===JSON.stringify(s.nodes));
    return {...d,status:s.status,iterations:s.iterations,proposals:search,recordedDecision:s.decision,
     shapeRejectedTrials:search.filter(t=>!t.edge.passed).length,moveRejectedTrials:search.filter(t=>t.shift>t.budget+1e-7).length};
   });
   result.linearAudits=[];
   for(const s of result.scopes)if(!result.linearAudits.some(a=>JSON.stringify(a.scopeNodes)===JSON.stringify(s.nodes)))
    result.linearAudits.push(linearAudit(g,s.nodes,s.faces,args));
   result.independentCandidateAccepted=!!value.solution&&result.scopes.some(s=>s.after.strictCrossingPairs===0&&s.after.belowMarginSamples===0&&s.shape.passed&&s.flipped===0&&s.maxMoveM<=record.budgetM+1e-7&&s.outsideUnchanged);
   if(value.solution)assert(result.independentCandidateAccepted,'INDEPENDENT_CANDIDATE_REJECTED');
   canonical[mode]=result;
  }else result.sameNumericResultAsFirst=true;
  result.reportExtractionMS=performance.now()-analysisStart;item.runs.push(result);
  console.log(file,ordinal,mode,'accepted',record.accepted,'scopes',record.scopes.map(s=>s.nodes.length),'ms',wallMS.toFixed(1));
 }
 item.variants={original:canonical.original,adaptive:canonical.adaptive};
 item.inputsUnchanged=true;output.cases.push(item);
}
output.anyLocalAcceptance=output.cases.some(c=>c.variants.adaptive.independentCandidateAccepted);
output.motionGate=output.anyLocalAcceptance?'REQUIRES_SEPARATE_MOTION_RUN':'DO_NOT_RUN_NO_LOCAL_CANDIDATE';
output.status=output.anyLocalAcceptance?'LOCAL_ONLY_NOT_MOTION_CERTIFIED':'HOLD_NO_ACCEPTABLE_LOCAL_MOVE';
fs.writeFileSync(destination,JSON.stringify(output,null,2));
console.log('EXPERIMENT_COMPLETE',output.status);
