'use strict';
// Independent headless test runner. Does not edit production or move the desktop mouse.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const DEFAULT_PLAYWRIGHT='C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
async function main(){
 const url=process.argv[2]||'http://127.0.0.1:8877/?version=shorts-independent-motion';
 const out=path.resolve(process.argv[3]||path.join(ROOT,'qa','shorts-motion-'+new Date().toISOString().replace(/[:.]/g,'-')));
 fs.mkdirSync(out,{recursive:true});
 const files=[...fs.readdirSync(ROOT).filter(f=>/^Shorts.*\.mjs$/.test(f)),'shorts-app.mjs','shorts.html','SubjectRuntime.mjs','GameAnimator.mjs','CharacterController.mjs'];
 const sourceHashes=Object.fromEntries(files.filter(f=>fs.existsSync(path.join(ROOT,f))).map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,f))).digest('hex')]));
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE||DEFAULT_PLAYWRIGHT);
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const receipt={createdAt:new Date().toISOString(),url,sourceHashes,scope:'actual R008 runtime action test; no final/public acceptance',runs:[],errors:[],failedRequests:[],valid:false};
 if(url.startsWith('file:')){const file=require('node:url').fileURLToPath(url);receipt.loadedArtifact={path:file,bytes:fs.statSync(file).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};const manifest=path.join(path.dirname(file),'BUILD.json');if(fs.existsSync(manifest)){receipt.loadedArtifact.build=JSON.parse(fs.readFileSync(manifest));receipt.loadedArtifact.matchesBuildHash=receipt.loadedArtifact.sha256===receipt.loadedArtifact.build.htmlSHA256;}}
 receipt.httpRequests=[];
 try{
  for(const fps of [60,30,120]){
   const page=await browser.newPage({viewport:{width:1440,height:1000}});
   page.on('pageerror',e=>receipt.errors.push({fps,message:e.message}));
   page.on('console',m=>{if(m.type()==='error')receipt.errors.push({fps,type:'console',message:m.text(),location:m.location()});});
   page.on('requestfailed',r=>receipt.failedRequests.push({fps,url:r.url(),error:r.failure()?.errorText}));
   page.on('response',r=>{if(r.status()>=400)receipt.failedRequests.push({fps,url:r.url(),status:r.status()});});
   page.on('request',r=>{if(/^https?:/.test(r.url()))receipt.httpRequests.push({fps,url:r.url(),method:r.method(),resourceType:r.resourceType()});});
   try{
    const loadingStart=performance.now();await page.goto(url,{waitUntil:'domcontentloaded'});const domMs=performance.now()-loadingStart;
    await page.waitForFunction(()=>window.HumanShorts?.cloth&&window.HumanGame||window.failure,null,{timeout:120000});
    const runtimeReadyMs=performance.now()-loadingStart;
    await page.screenshot({path:path.join(out,'actual-initial-'+fps+'hz.png')});
    const run=await page.evaluate(async ({fps,firstStepOnly,initialOnly})=>{
     if(window.failure)throw Error(String(window.failure));
     const T=await import('three'),h=window.HumanGame,c=window.HumanShorts.cloth;
     h.setPaused(true);h.controller.clearInput();
     const coldStart=performance.now(),initial=c.snapshot(),coldSnapshotMs=performance.now()-coldStart,warmStart=performance.now(),warmAudit=c.audit(true),warmAuditMs=performance.now()-warmStart;
     const result={fps,initial,queryTiming:{coldSnapshotMs,warmAuditMs,scope:'same loaded collider first QA snapshot and immediate repeated audit, not cold/warm application load'},warmAudit,phases:[],frames:[],stepAudits:[],firstFailure:null,missingCertificates:[],simulationComplete:false};
     result.renderedCloth={isMesh:c.mesh.isMesh,name:c.mesh.name,vertices:c.mesh.geometry.attributes.position.count,triangles:c.mesh.geometry.index.count/3,sceneContains:h.scene.children.includes(c.mesh),material:c.mesh.material.name,standaloneModuleCount:window.__R008_MODULE_URLS__?Object.keys(window.__R008_MODULE_URLS__).length:null};
     const finite=x=>typeof x==='number'&&Number.isFinite(x),dist=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]));
     const identity=()=>JSON.stringify({uv:Array.from(c.draft.uvs||c.draft.sourceUV),triangles:Array.from(c.draft.triangles),mass:Array.from(c.mass),invMass:Array.from(c.invMass),edges:c.edges.map(e=>e.rest),elastic:c.elastic.map(e=>({a:e.a,b:e.b,rest:e.rest,compliance:e.compliance})),seams:c.draft.seams});
     const originalIdentity=identity(),originalStep=c.fixedStep;
     function independentPaperMetric(){const uv=c.draft.uvs||c.draft.sourceUV,indices=c.draft.triangles;let maximum=0,worst=null,areaM2=0;
      for(let k=0;k<indices.length;k+=3){const ids=Array.from(indices.slice(k,k+3)),p=ids.map(i=>c.positions[c.quotient[i]]),u=ids.map(i=>[uv[2*i],uv[2*i+1]]),du=u[1][0]-u[0][0],dv=u[1][1]-u[0][1],eu=u[2][0]-u[0][0],ev=u[2][1]-u[0][1],det=du*ev-dv*eu;areaM2+=Math.abs(det)/2;
       const A=p[1].map((v,j)=>(ev*(v-p[0][j])-dv*(p[2][j]-p[0][j]))/det),B=p[1].map((v,j)=>(du*(p[2][j]-p[0][j])-eu*(v-p[0][j]))/det),aa=A.reduce((s,v)=>s+v*v,0),bb=B.reduce((s,v)=>s+v*v,0),ab=A.reduce((s,v,j)=>s+v*B[j],0),hi=(aa+bb+Math.hypot(aa-bb,2*ab))/2,lo=hi>0?Math.max(0,aa*bb-ab*ab)/hi:0,strain=Math.max(Math.abs(Math.sqrt(hi)-1),Math.abs(Math.sqrt(lo)-1));
       if(!Number.isFinite(strain))return {valid:false,reason:'nonfinite-source-metric',triangle:k/3};if(strain>maximum){maximum=strain;worst={triangle:k/3,sourceIndices:ids};}}
      const actualMass=c.mass.reduce((s,v)=>s+v,0),expectedMass=areaM2*c.options.densityKgM2;return {maxMainStrain:maximum,worst,areaM2,actualMassKg:actualMass,expectedMassKg:expectedMass,massDifferenceKg:Math.abs(actualMass-expectedMass),valid:maximum<=.05&&Math.abs(actualMass-expectedMass)<=1e-10};
     }
     function check(a){const failures=[];
      if(a.finite!==true)failures.push('nonfinite');
      if(!finite(a.mainStrain)||a.mainStrain>.05)failures.push('ordinary-paper-strain');
      if(!finite(a.elasticStrain)||!finite(a.physics?.elasticStrainLimit)||a.elasticStrain>a.physics.elasticStrainLimit)failures.push('elastic-extension');
      if(!finite(a.bodyPenetrationM)||a.bodyPenetrationM>.001)failures.push('body-penetration');
      if(a.seams!==19||!finite(a.seamGapM)||a.seamGapM>.0001)failures.push('source-seams');
      if(identity()!==originalIdentity)failures.push('source-rest-mass-mutated');
      if(c.invMass.some(w=>!finite(w)||w<=0))failures.push('fixed-or-invalid-cloth');
      for(const s of c.draft.seams)for(const q of s.pairs){const a=c.quotient[q.a??q[0]],b=c.quotient[q.b??q[1]];if(a!==b||dist(c.positions[a],c.positions[b])>.0001)failures.push('actual-source-pair-open');}
      return [...new Set(failures)];
     }
     // Observe every actual solver substep, not just the last visual frame.
     // Audit overhead is recorded separately and excluded from cloth CPU measurements.
     let observerMs=0;
     c.fixedStep=function(dt){originalStep.call(this,dt);const start=performance.now(),a=this.audit(true),failures=check(a);result.stepAudits.push({step:this.steps,time:this.time,mainStrain:a.mainStrain,elasticStrain:a.elasticStrain,bodyPenetrationM:a.bodyPenetrationM,failures});if(failures.length&&!result.firstFailure)result.firstFailure={step:this.steps,time:this.time,failures,audit:a};observerMs+=performance.now()-start;if(result.firstFailure)throw Error('INDEPENDENT_QA_FIRST_NUMERIC_FAILURE');};
     const initialFailures=check(result.initial.audit);
     result.initialIndependentMetric=independentPaperMetric();if(!result.initialIndependentMetric.valid)initialFailures.push('independent-source-paper-metric-or-mass');
     if(initialFailures.length)result.firstFailure={phase:'initial',failures:initialFailures,audit:result.initial.audit};
     // Explicit lack of certification cannot turn audit.valid into whole-motion approval.
     const cert=result.initial.audit.certificates||{};
     for(const key of ['fullBodyFeatures','bodyCCD','selfCCD','strictIntersections'])if(cert[key]!==true)result.missingCertificates.push(key);
     const dt=1/fps,frameCpu=[];
     function relativePositions(){const inverse=h.actor.matrixWorld.clone().invert();return c.positions.map(p=>new T.Vector3(...p).applyMatrix4(inverse).toArray());}
     function phase(name,seconds,keys=[],jump=false){
      h.controller.clearInput();for(const key of keys)h.controller.press(key);
      if(jump){h.controller.press('Space');h.controller.release('Space');}
      const begin=h.controller.snapshot(),startStep=c.steps,startTime=c.time;let peakSpeed=0,airborne=0,distanceM=0,last=[begin.x,begin.y,begin.z];
      for(let i=0;i<Math.round(seconds*fps);i++){
       const beforeObserver=observerMs,t=performance.now();try{h.step(dt,false);}catch(error){if(!result.firstFailure)throw error;}const duration=performance.now()-t-(observerMs-beforeObserver);frameCpu.push(duration);
       const state=h.controller.snapshot();peakSpeed=Math.max(peakSpeed,state.speed);airborne+=Number(!state.grounded)*dt;distanceM+=dist(last,[state.x,state.y,state.z]);last=[state.x,state.y,state.z];
       const a=c.audit(true);result.frames.push({phase:name,frame:i,time:c.time,step:c.steps,controller:state,mainStrain:a.mainStrain,elasticStrain:a.elasticStrain,bodyPenetrationM:a.bodyPenetrationM,waist:a.waist,frameCpuMs:duration,clothCpuMs:c.cpu.at(-1)-(observerMs-beforeObserver)});
       if(Math.abs((c.time-startTime)-(i+1)*dt)>c.options.fixedDt+1e-8&&!result.firstFailure)result.firstFailure={phase:name,frame:i,failures:['simulation-clock-divergence']};
       if(result.firstFailure)break;
      }
      result.phases.push({name,requestedSeconds:seconds,startStep,endStep:c.steps,startTime,endTime:c.time,begin,end:h.controller.snapshot(),peakSpeed,airborneSeconds:airborne,distanceM});
     }
     try{
      if(initialOnly){result.phases.push({name:'initial-only-no-physics',endStep:c.steps,endTime:c.time});}
      else if(!result.firstFailure&&firstStepOnly){try{h.step(c.options.fixedDt,false);}catch(error){if(!result.firstFailure)throw error;}result.phases.push({name:'single-real-substep',endStep:c.steps,endTime:c.time});}
      else if(!result.firstFailure){
       phase('stand',2);if(!result.firstFailure)phase('walk',4,['KeyD']);
       if(!result.firstFailure)phase('run',4,['KeyA','ShiftLeft']);
       for(let i=0;i<3&&!result.firstFailure;i++)phase('jump-'+(i+1),2,[],true);
       if(!result.firstFailure)phase('stop-settle',3);
       result.simulationComplete=!result.firstFailure;
      }
     }finally{c.fixedStep=originalStep;h.controller.clearInput();}
     result.final=c.snapshot();result.finalActorRelativePositions=relativePositions();result.observerMs=observerMs;
     result.finalIndependentMetric=independentPaperMetric();if(!result.finalIndependentMetric.valid&&!result.firstFailure)result.firstFailure={phase:'independent-final-metric',failures:['independent-source-paper-metric-or-mass'],metric:result.finalIndependentMetric};
     const quantile=(a,q)=>{const b=[...a].sort((x,y)=>x-y);return b[Math.floor((b.length-1)*q)]??null;};
     result.cpu={frameP50Ms:quantile(frameCpu,.5),frameP95Ms:quantile(frameCpu,.95),frameMaxMs:frameCpu.length?Math.max(...frameCpu):null,clothP95Ms:quantile(result.frames.map(f=>f.clothCpuMs),.95),observerExcluded:true};
     result.actionFailures=[];
     if(result.simulationComplete){
      const walk=result.phases.find(p=>p.name==='walk'),run=result.phases.find(p=>p.name==='run'),jumps=result.phases.filter(p=>p.name.startsWith('jump-'));
      if(!(walk.peakSpeed>1&&walk.distanceM>4))result.actionFailures.push('walk-not-performed');
      if(!(run.peakSpeed>3&&run.distanceM>10))result.actionFailures.push('run-not-performed');
      if(!jumps.every(p=>p.end.jumpCount>p.begin.jumpCount&&p.airborneSeconds>.3&&p.end.grounded))result.actionFailures.push('jump-not-performed');
      if(!(result.cpu.frameP95Ms<=16.7&&result.cpu.clothP95Ms<=8))result.actionFailures.push('cpu-target');
     }
     result.valid=result.simulationComplete&&!result.firstFailure&&!result.actionFailures.length&&!result.missingCertificates.length;
     // Render the actual final retained state for internal visual inspection.
     window.HumanR008.renderer.render(h.scene,h.camera);return result;
    },{fps,firstStepOnly:process.env.SHORTS_FIRST_STEP_ONLY==='1',initialOnly:process.env.SHORTS_INITIAL_ONLY==='1'});
    run.loadTiming={domMs,runtimeReadyMs,scope:'cold page application load; no physics step'};
    receipt.runs.push(run);
    await page.screenshot({path:path.join(out,'actual-final-'+fps+'hz.png')});
    if(run.firstFailure||process.env.SHORTS_FIRST_STEP_ONLY==='1'||process.env.SHORTS_INITIAL_ONLY==='1')break; // Preserve one real failure; do not keep running unstable cloth.
   }catch(error){await page.screenshot({path:path.join(out,'actual-startup-or-run-failure-'+fps+'hz.png')}).catch(()=>{});throw error;}finally{await page.close();}
  }
  const completed=receipt.runs.filter(r=>r.simulationComplete);receipt.frameCadenceComparison=[];
  if(completed.length===3){const base=completed[0];for(const r of completed.slice(1)){const errors=r.finalActorRelativePositions.map((p,i)=>Math.hypot(...p.map((v,k)=>v-base.finalActorRelativePositions[i][k]))).sort((a,b)=>a-b),p95=errors[Math.floor((errors.length-1)*.95)],waistDifferenceM=Math.abs(r.final.audit.waist.currentLengthM-base.final.audit.waist.currentLengthM);receipt.frameCadenceComparison.push({fps:r.fps,clothActorRelativeP95M:p95,waistDifferenceM,valid:p95<=.005&&waistDifferenceM<=.001});}}
  receipt.valid=receipt.runs.length===3&&receipt.runs.every(r=>r.valid)&&receipt.frameCadenceComparison.every(r=>r.valid)&&!receipt.errors.length&&!receipt.failedRequests.length;
 }catch(error){receipt.runnerError=String(error.stack||error);}finally{await browser.close();fs.writeFileSync(path.join(out,'QA.json'),JSON.stringify(receipt,null,2));}
 console.log(JSON.stringify({out,valid:receipt.valid,runs:receipt.runs.map(r=>({fps:r.fps,firstFailure:r.firstFailure,missingCertificates:r.missingCertificates,simulationComplete:r.simulationComplete,cpu:r.cpu})),errors:receipt.errors,failedRequests:receipt.failedRequests,runnerError:receipt.runnerError}));
 if(!receipt.valid)process.exitCode=1;
}
if(process.argv.includes('--help'))console.log('node tools/qa-shorts-motion.cjs [URL] [OUTPUT_DIRECTORY]\nActual headless motion QA; exits nonzero on failure or missing whole-contact certificates.');
else main().catch(e=>{console.error(e);process.exitCode=1;});
