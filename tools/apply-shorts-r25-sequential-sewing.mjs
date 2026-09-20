// Wire the source-owned sequential R2.5 sewing stage. Idempotent.
import fs from 'node:fs';
const module='clothing/ShortsGussetSewingR2.js';if(!fs.existsSync(module))throw Error('Sequential R2.5 module is missing');
const manifestPath='source/assembly.json',manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
if(!manifest.modules.includes(module)){const anchor='clothing/ShortsGussetAssemblyR2.js',index=manifest.modules.indexOf(anchor);if(index<0)throw Error('R2.5 gusset base module is missing');manifest.modules.splice(index+1,0,module);fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');}
const runtimePath='source/runtime.template.js';let runtime=fs.readFileSync(runtimePath,'utf8'),marker='/*__SOURCE:'+module+'__*/',anchor='/*__SOURCE:clothing/ShortsGussetAssemblyR2.js__*/';if(!runtime.includes(marker)){if(!runtime.includes(anchor))throw Error('R2.5 runtime anchor missing');runtime=runtime.replace(anchor,anchor+'\n'+marker);fs.writeFileSync(runtimePath,runtime);}
const rendererPath='clothing/ClothShorts.js';let renderer=fs.readFileSync(rendererPath,'utf8');
renderer=renderer.replace('this.gussetState=createShortsGussetStateR25(this.pattern,this.body,h);','this.gussetState=createShortsGussetSewingStateR25(this.pattern,this.body,h);');
if(!renderer.includes("beginShortsGussetSewingR25(this.simulation")){
 const searchFrom=renderer.indexOf("  if(this.riseReview){");const start=renderer.indexOf("  if(this.gussetReview){\n",searchFrom),end=renderer.indexOf("  this.assemblyState='sewing';const remaining=maxSteps;",start);if(start<0||end<0)throw Error('R2.5 renderer block not found');
 const block=`  if(this.gussetReview){
   // Reproduce the accepted R2.4 body/contact state. G then remains its
   // unchanged flat source piece and is sewn edge by edge; the open garment is
   // not required to have a pre-welded gusset shape.
   const reviewDeadline=begin+3000000,riseMinimumSteps=4,riseMaximumSteps=36;
   this.assemblyState='gusset-input-relaxing';this.gussetProgress={phase:'rise-input',completedSteps:0,maximumSteps:riseMaximumSteps,valid:false,budgetExceeded:false};
   for(let step=0;step<riseMaximumSteps;step++){
    if(this.disposed)throw Error('R2.5 gusset input review was disposed');
    this.body.update();this.simulation.step(1);this.dirty=true;
    const completed=step+1,shouldAudit=completed>=riseMinimumSteps&&(completed%4===0||completed>=30||completed===riseMaximumSteps);
    if(shouldAudit)this.gussetRiseReport=auditShortsRiseR24(this.simulation,this.gussetState.riseState,this.gussetRiseReport,{requireBody:true,requireSelfContact:true});
    this.gussetProgress={phase:'rise-input',completedSteps:completed,maximumSteps:riseMaximumSteps,valid:this.gussetRiseReport?.valid===true,budgetExceeded:performance.now()>reviewDeadline};
    if(this.gussetRiseReport?.valid||this.gussetProgress.budgetExceeded)break;
    await new Promise(resolve=>setTimeout(resolve,0));
   }
   if(!this.gussetRiseReport?.valid){
    this.assemblyWallTimeMs+=performance.now()-begin;this.displayReady=true;this.assemblyReady=false;this.assemblyState='gusset-input-failed';
    const staged=this.simulation.report();this.assemblyReport={...staged,gussetProgress:this.gussetProgress,gussetRise:this.gussetRiseReport,gusset:null,assemblyState:this.assemblyState,assemblySteps:this.simulation.stepIndex,wallTimeMs:this.assemblyWallTimeMs,visualAcceptance:false};return this.assemblyReport;
   }
   this.gussetReport=beginShortsGussetSewingR25(this.simulation,this.gussetState,this.gussetRiseReport,{edgeSewingSeconds:.30,maximumStepsPerEdge:78,materialLimit:.05});
   this.assemblyState='gusset-sewing';const gussetStartStep=this.simulation.stepIndex,gussetMaximumSteps=328;
   this.gussetProgress={phase:'gusset-sewing',completedSteps:0,maximumSteps:gussetMaximumSteps,valid:false,budgetExceeded:false,sewing:this.gussetReport.sewingProgress};
   for(let step=0;step<gussetMaximumSteps;step++){
    if(this.disposed)throw Error('R2.5 gusset sewing review was disposed');
    this.body.update();this.simulation.step(1);this.dirty=true;
    this.gussetReport=advanceShortsGussetSewingR25(this.simulation,this.gussetState,this.gussetReport);
    const sewing=this.gussetState.sewing,completed=step+1,shouldAudit=completed%8===0||sewing?.complete||sewing?.failed||completed===gussetMaximumSteps;
    if(shouldAudit)this.gussetReport=auditShortsGussetSewingR25(this.simulation,this.gussetState,this.gussetReport,{requireBody:true,requireSelfContact:true,materialLimit:.05});
    this.gussetProgress={phase:sewing?.complete?'gusset-final-relaxation':'gusset-sewing',completedSteps:completed,maximumSteps:gussetMaximumSteps,valid:this.gussetReport?.valid===true,budgetExceeded:performance.now()>reviewDeadline,sewing:this.gussetReport?.sewingProgress??null};
    if(this.gussetReport?.valid||sewing?.failed||this.gussetProgress.budgetExceeded)break;
    await new Promise(resolve=>setTimeout(resolve,0));
   }
   this.gussetReport=auditShortsGussetSewingR25(this.simulation,this.gussetState,this.gussetReport,{requireBody:true,requireSelfContact:true,materialLimit:.05});
   this.gussetReport={...this.gussetReport,gussetRelaxationSteps:this.simulation.stepIndex-gussetStartStep,totalStageSteps:this.simulation.stepIndex,reviewBudgetExceeded:this.gussetProgress.budgetExceeded};
   this.assemblyWallTimeMs+=performance.now()-begin;this.displayReady=true;this.assemblyReady=false;this.assemblyState=this.gussetReport?.valid?'gusset-ready':this.gussetState.sewing?.failed?'gusset-sewing-failed':'gusset-checkpoint-failed';
   const staged=this.simulation.report();this.assemblyReport={...staged,gussetProgress:this.gussetProgress,gussetRise:this.gussetRiseReport,gusset:this.gussetReport,assemblyState:this.assemblyState,assemblySteps:this.simulation.stepIndex,wallTimeMs:this.assemblyWallTimeMs,visualAcceptance:false};return this.assemblyReport;
  }
`;
 renderer=renderer.slice(0,start)+block+renderer.slice(end);fs.writeFileSync(rendererPath,renderer);
}
const reviewPath='tools/review-shorts-gusset-r25.mjs';let review=fs.readFileSync(reviewPath,'utf8');review=review.replaceAll('900000','3300000');fs.writeFileSync(reviewPath,review);
console.log('Sequential R2.5 physical source sewing is wired.');
