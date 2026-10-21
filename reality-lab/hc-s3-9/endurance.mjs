import {ContactProbe,stateDigest,triangleCrossing} from './rf37-contact-probe.mjs';
const copy=x=>JSON.parse(JSON.stringify(x));
const point=(a,i)=>Array.from(a.subarray(i*3,i*3+3));
const distance=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
function exact(a,b){if(a.length!==b.length)return false;for(let i=0;i<a.length;i++)if(a[i]!==b[i])return false;return true;}
function instrumentFine(w){
 const c=w.acceleration.lowerBodyContact,m=c.model,s=m.source,fn=c.projectFine;
 const before=new Float64Array(s.p.length),delta=new Float64Array(m.delta.length),velocity=new Float64Array(m.velocity.length);
 const state={calls:[],previousAfter:null};
 c.projectFine=function(...args){
  const prep=performance.now();before.set(s.p);delta.set(m.delta);velocity.set(m.velocity);const targetBefore=point(before,191),previous=state.previousAfter;
  const started=performance.now();let failure=null;
  try{return fn.apply(this,args);}catch(e){failure=String(e.message||e);throw e;}finally{
   const stopped=performance.now();let changed=0,sum=0,max=0,maxNode=null;for(let i=0;i<s.count;i++){const k=i*3,d=Math.hypot(s.p[k]-before[k],s.p[k+1]-before[k+1],s.p[k+2]-before[k+2]);sum+=d*d;if(d>0)changed++;if(d>max){max=d;maxNode=i;}}
   const targetAfter=point(s.p,191),coarseUnchanged=exact(delta,m.delta)&&exact(velocity,m.velocity);
   state.calls.push({nativeFineWallMS:stopped-started,observerMS:(started-prep)+(performance.now()-stopped),changedNodes:changed,rmsCorrectionM:Math.sqrt(sum/s.count),maxCorrectionM:max,maxNode,targetBefore,targetAfter,targetCorrectionM:distance(targetBefore,targetAfter),nextReconstructionFromPreviousM:previous?distance(targetBefore,previous):null,coarseStateUnchanged:coarseUnchanged,failure});
   state.previousAfter=targetAfter;
  }
 };
 return {begin(){state.calls=[];},finish(){return copy(state.calls);},restore(){c.projectFine=fn;}};
}
function neighbourhood(w,probe){
 const s=w.solvers[1],node=191,top=probe.topologies[1],t=probe.body,q=new Float64Array(4),p=point(s.p,node),near=t.nearest(...p,Infinity);t.evaluate(near,...p,q);
 const target=[0,1,2].map(k=>point(t.p,t.faces[near+k]));
 const faces=top.incident[node].map(offset=>{const tri=[0,1,2].map(k=>point(s.p,s.faces[offset+k]));return {offset,label:top.faceLabels[offset/3],triangle:tri,crossing:triangleCrossing(tri,target)};});
 return {node,sites:top.labels[node],point:p,orientedDistanceM:q[0],targetTriangle:target,targetTriangleId:near/3,faces,strictLocalCrossingCount:faces.filter(f=>f.crossing).length,scope:'six incident cloth faces versus closest body face to node191; not an all-pairs crossing test'};
}
export async function runEndurance(w,createRegional,config){
 const clip=w.actor.clips?.walk,duration=clip?.duration;if(!Number.isFinite(duration)||duration<=0||clip.continuous!==true)throw Error('WALK_DURATION_UNKNOWN');
 const dt=1/60,steps=Math.ceil((.65+2*duration)/dt);if(steps<120||steps>600)throw Error('HORIZON_OUT_OF_BOUNDS:'+steps);
 const result={schema:'kaopu/contact-endurance@1',version:'RF01-S3.9',variant:config.variant,motion:config.motion,dtSeconds:dt,plannedSteps:steps,plannedSeconds:steps*dt,walkingClip:{durationSeconds:duration,frames:clip.frames.length,continuous:clip.continuous,transitionSeconds:.65,targetCyclesAfterTransition:2},checkpoints:[],frames:[],failure:null,completedSteps:0,productionChanged:false,fitCertified:false,continuousCollisionCertified:false,performanceScope:'instrumented worker CPU wall times on one sequential CI runner; software Chromium; not total GPU frame time'};
 const probe=new ContactProbe(w);
 result.checkpoints.push(await probe.capture('fit-committed',0));
 createRegional();result.checkpoints.push(await probe.capture('regional-created',0));
 w.setMotion(config.motion==='static'?'idle':'walk');result.checkpoints.push(await probe.capture('motion-selected',0));
 const observer=instrumentFine(w);
 try{
  for(let i=1;i<=steps;i++){
   observer.begin();const started=performance.now();let error=null;
   try{await w.step(dt);}catch(e){error=String(e.message||e);}
   const stepWallMS=performance.now()-started,calls=observer.finish(),observationMS=calls.reduce((n,c)=>n+c.observerMS,0),metrics=copy(w.acceleration.metrics),lower=copy(w.acceleration.lowerBodyContact.metrics);
   if(calls.some(c=>!c.coarseStateUnchanged))throw Error('FINE_PASS_UNEXPECTEDLY_MUTATED_COARSE_STATE');
   const row={step:i,accepted:!error,simulationSeconds:w.elapsed,motionTime:w.motionTime,frame:w.frameSequence,stepWallMS,observerMS:observationMS,adjustedStepMS:Math.max(0,stepWallMS-observationMS),poseMS:metrics.poseMS??null,referenceMS:metrics.referenceMS??null,dynamicsMS:metrics.dynamicsMS??null,contactMS:metrics.contactMS??null,reconstructionMS:metrics.reconstructionMS??null,lower:{refitMS:lower.refitMS,coarseMS:lower.coarseMS,fineMS:lower.fineMS,queries:lower.queries,safelySkippedQueries:lower.safelySkippedQueries,passes:lower.passes,contacts:lower.contacts,guidedCrotchContacts:lower.guidedCrotchContacts||0,maxFineOffsetMM:lower.maxFineOffsetMM,maxCorrectionMM:lower.maxCorrectionMM},fineCalls:calls};
   result.frames.push(row);
   if(!error)result.completedSteps=i;
   if(error||i<=12||i%6===0||i===steps){
    const sample=await probe.capture(error?'native-failure-after-rollback':'fixed-step',i);const localBefore=await stateDigest(w);sample.neighbourhood=neighbourhood(w,probe);const localAfter=await stateDigest(w);if(localBefore.sha256!==localAfter.sha256)throw Error('NEIGHBOUR_PROBE_CHANGED_STATE');result.checkpoints.push(sample);
   }
   if(error){result.failure={attemptedStep:i,message:error,completedSteps:result.completedSteps,stopped:true,rollbackScope:'native original rollback was invoked; this study does not add a new rollback certification'};break;}
   if(i%12===0)self.postMessage({rf39:true,kind:'progress',step:i,plannedSteps:steps,variant:config.variant,motion:config.motion});
  }
 }finally{observer.restore();}
 result.actualSeconds=result.completedSteps*dt;result.automaticAppFramesBeforeMeasurement=0;result.originalFitGate=1.45;
 result.finalState=await stateDigest(w);return result;
}
