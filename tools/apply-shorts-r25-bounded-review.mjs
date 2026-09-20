// Replace the rejected R2.5 browser budget with the already accepted R2.4
// solver budget plus a bounded post-gusset relaxation. This changes neither
// source paper nor any physical/visual acceptance threshold. Idempotent.
import fs from 'node:fs';

const path='clothing/ClothShorts.js';
let source=fs.readFileSync(path,'utf8');
const replace=(from,to,label)=>{
  if(source.includes(to))return;
  const first=source.indexOf(from),last=source.lastIndexOf(from);
  if(first<0||first!==last)throw Error('Ambiguous R2.5 bounded-review anchor: '+label);
  source=source.replace(from,to);
};

replace(
  "const stagedOptions={...SHORTS_WEARING_OPTIONS,gravity:0,groundY:null,selfContact:true,selfContactSweeps:4,maxSelfCandidates:50000,triangleBodyContact:true,iterations:16,maxMaterialIterations:64,materialConvergenceStrain:.015,sewingSeconds:1000,handlingDamping:10};",
  "const stagedOptions={...SHORTS_WEARING_OPTIONS,gravity:0,groundY:null,selfContact:true,selfContactSweeps:3,maxSelfCandidates:40000,triangleBodyContact:true,iterations:12,maxMaterialIterations:32,materialConvergenceStrain:.02,sewingSeconds:1000,handlingDamping:8};",
  'accepted R2.4 solver budget'
);
replace(
  'this.gussetState=null;this.gussetRiseReport=null;this.gussetReport=null;',
  'this.gussetState=null;this.gussetRiseReport=null;this.gussetReport=null;this.gussetProgress=null;',
  'progress state slot'
);
replace(
  "  if(this.gussetReview){\n   this.assemblyState='gusset-input-relaxing';const riseMinimumSteps=4,riseMaximumSteps=48;",
  "  if(this.gussetReview){\n   // Reproduce the accepted R2.4 state with its exact solver budget. A larger\n   // iteration count is not extra physical or visual evidence.\n   const reviewDeadline=begin+720000,riseMinimumSteps=4,riseMaximumSteps=36;\n   this.assemblyState='gusset-input-relaxing';this.gussetProgress={phase:'rise-input',completedSteps:0,maximumSteps:riseMaximumSteps,valid:false,budgetExceeded:false};",
  'bounded rise input'
);
replace(
  "    this.gussetRiseReport=auditShortsRiseR24(this.simulation,this.gussetState.riseState,this.gussetRiseReport,{requireBody:true,requireSelfContact:true});\n    if(step+1>=riseMinimumSteps&&this.gussetRiseReport.valid)break;",
  "    const completed=step+1,shouldAudit=completed>=riseMinimumSteps&&(completed%4===0||completed>=30||completed===riseMaximumSteps);\n    if(shouldAudit)this.gussetRiseReport=auditShortsRiseR24(this.simulation,this.gussetState.riseState,this.gussetRiseReport,{requireBody:true,requireSelfContact:true});\n    this.gussetProgress={phase:'rise-input',completedSteps:completed,maximumSteps:riseMaximumSteps,valid:this.gussetRiseReport?.valid===true,budgetExceeded:performance.now()>reviewDeadline};\n    if(this.gussetRiseReport?.valid||this.gussetProgress.budgetExceeded)break;",
  'sparse truthful rise audits'
);
replace(
  'const staged=this.simulation.report();this.assemblyReport={...staged,gussetRise:this.gussetRiseReport,gusset:null',
  'const staged=this.simulation.report();this.assemblyReport={...staged,gussetProgress:this.gussetProgress,gussetRise:this.gussetRiseReport,gusset:null',
  'rise failure progress'
);
replace(
  "this.assemblyState='gusset-relaxing';const gussetStartStep=this.simulation.stepIndex,gussetMinimumSteps=4,gussetMaximumSteps=64;",
  "this.assemblyState='gusset-relaxing';const gussetStartStep=this.simulation.stepIndex,gussetMinimumSteps=1,gussetMaximumSteps=12;\n   this.gussetProgress={phase:'gusset-relaxation',completedSteps:0,maximumSteps:gussetMaximumSteps,valid:this.gussetReport?.valid===true,budgetExceeded:false};",
  'bounded gusset relaxation'
);
replace(
  "    this.gussetReport=auditShortsGussetR25(this.simulation,this.gussetState,this.gussetReport,{requireBody:true,requireSelfContact:true,materialLimit:.05});\n    if(step+1>=gussetMinimumSteps&&this.gussetReport.valid)break;",
  "    this.gussetReport=auditShortsGussetR25(this.simulation,this.gussetState,this.gussetReport,{requireBody:true,requireSelfContact:true,materialLimit:.05});\n    const completed=step+1;this.gussetProgress={phase:'gusset-relaxation',completedSteps:completed,maximumSteps:gussetMaximumSteps,valid:this.gussetReport.valid===true,budgetExceeded:performance.now()>reviewDeadline};\n    if((completed>=gussetMinimumSteps&&this.gussetReport.valid)||this.gussetProgress.budgetExceeded)break;",
  'gusset progress and wall gate'
);
replace(
  'this.gussetReport={...this.gussetReport,gussetRelaxationSteps:this.simulation.stepIndex-gussetStartStep,totalStageSteps:this.simulation.stepIndex};',
  'this.gussetReport={...this.gussetReport,gussetRelaxationSteps:this.simulation.stepIndex-gussetStartStep,totalStageSteps:this.simulation.stepIndex,reviewBudgetExceeded:this.gussetProgress.budgetExceeded};',
  'budget report'
);
replace(
  'this.assemblyReport={...staged,gussetRise:this.gussetRiseReport,gusset:this.gussetReport',
  'this.assemblyReport={...staged,gussetProgress:this.gussetProgress,gussetRise:this.gussetRiseReport,gusset:this.gussetReport',
  'final progress report'
);
replace(
  'gussetRise:this.gussetRiseReport,gusset:this.gussetReport,pattern:',
  'gussetRise:this.gussetRiseReport,gusset:this.gussetReport,gussetProgress:this.gussetProgress,pattern:',
  'diagnostic progress'
);

fs.writeFileSync(path,source);
console.log('Bounded R2.5 review: 36 accepted-rise steps, 12 post-gusset steps, unchanged gates.');
