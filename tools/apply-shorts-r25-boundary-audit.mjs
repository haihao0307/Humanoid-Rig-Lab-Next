// Audit the exact accepted-rise -> installed-gusset stage boundary before
// integrating any new cloth time. If the original paper, actual body and cloth
// contacts already pass there, extra relaxation is not evidence and must not
// be allowed to damage the checkpoint. Idempotent source migration.
import fs from 'node:fs';
const path='clothing/ClothShorts.js';
let source=fs.readFileSync(path,'utf8');
const from="   this.gussetReport=completeShortsGussetR25(this.simulation,this.gussetState,this.gussetRiseReport);this.assemblyState='gusset-relaxing';const gussetStartStep=this.simulation.stepIndex,gussetMinimumSteps=1,gussetMaximumSteps=12;\n   this.gussetProgress={phase:'gusset-relaxation',completedSteps:0,maximumSteps:gussetMaximumSteps,valid:this.gussetReport?.valid===true,budgetExceeded:false};";
const to="   this.gussetReport=completeShortsGussetR25(this.simulation,this.gussetState,this.gussetRiseReport);\n   // A stage transition has zero elapsed time but a new active source piece.\n   // Perform a fresh read-only discrete cloth scan; body reports and the swept\n   // contact report also re-query the current geometry. This is not a cached\n   // R2.4 self-contact result.\n   this.simulation._selfContact(false);\n   this.gussetReport=auditShortsGussetR25(this.simulation,this.gussetState,this.gussetReport,{requireBody:true,requireSelfContact:true,materialLimit:.05});\n   this.assemblyState='gusset-relaxing';const gussetStartStep=this.simulation.stepIndex,gussetMinimumSteps=1,gussetMaximumSteps=this.gussetReport.valid?0:12;\n   this.gussetProgress={phase:this.gussetReport.valid?'gusset-stage-boundary':'gusset-relaxation',completedSteps:0,maximumSteps:gussetMaximumSteps,valid:this.gussetReport.valid===true,budgetExceeded:false};";
if(source.includes(to))console.log('R2.5 exact stage-boundary audit is already canonical.');
else{
 const first=source.indexOf(from),last=source.lastIndexOf(from);
 if(first<0||first!==last)throw Error('Ambiguous R2.5 stage-boundary audit anchor');
 source=source.replace(from,to);fs.writeFileSync(path,source);
 console.log('R2.5 now audits the exact installed-gusset boundary before any new cloth step.');
}
