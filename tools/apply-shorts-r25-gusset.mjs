// Wire the source-owned R2.5 independent-gusset checkpoint without changing
// original paper, body generation, Human rig, UVs, topology or material mass.
// Idempotent so the real-browser workflow can retain canonical sources.
import fs from 'node:fs';

const replaceOnce=(text,from,to,label)=>{
  const first=text.indexOf(from),last=text.lastIndexOf(from);
  if(first<0||first!==last)throw Error('Ambiguous R2.5 gusset patch anchor: '+label);
  return text.replace(from,to);
};
const module='clothing/ShortsGussetAssemblyR2.js';
if(!fs.existsSync(module))throw Error('R2.5 gusset source module is missing');

const manifestPath='source/assembly.json';
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
if(!manifest.modules.includes(module)){
  const anchor='clothing/ShortsRiseAssemblyR2.js',index=manifest.modules.indexOf(anchor);
  if(index<0)throw Error('R2.4 centre-rise source is missing from assembly manifest');
  manifest.modules.splice(index+1,0,module);fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
  console.log('Inserted R2.5 gusset module into source/assembly.json.');
}else console.log('R2.5 gusset module is already canonical.');

const runtimePath='source/runtime.template.js';
let runtime=fs.readFileSync(runtimePath,'utf8');
const marker='/*__SOURCE:'+module+'__*/',anchor='/*__SOURCE:clothing/ShortsRiseAssemblyR2.js__*/';
if(!runtime.includes(marker)){runtime=replaceOnce(runtime,anchor,anchor+'\n'+marker,'runtime source marker');fs.writeFileSync(runtimePath,runtime);console.log('Inserted canonical R2.5 runtime source marker.');}
else console.log('R2.5 runtime source marker is already canonical.');

const rendererPath='clothing/ClothShorts.js';
let renderer=fs.readFileSync(rendererPath,'utf8');
if(!renderer.includes('this.gussetReview=')){
  const riseFlag="this.riseReview=/(?:[?&])shortsStage=r2(?:\\.|%2E)4-rise(?:&|$)/i.test(search);";
  renderer=replaceOnce(renderer,riseFlag,riseFlag+"this.gussetReview=/(?:[?&])shortsStage=r2(?:\\.|%2E)5-gusset(?:&|$)/i.test(search);",'R2.5 query mode');
  renderer=replaceOnce(renderer,'this.stagedReview=this.placementReview||this.leftTubeReview||this.dualTubeReview||this.riseReview;','this.stagedReview=this.placementReview||this.leftTubeReview||this.dualTubeReview||this.riseReview||this.gussetReview;','staged review mode');
  renderer=replaceOnce(renderer,'this.riseState=null;this.riseReport=null;','this.riseState=null;this.riseReport=null;this.gussetState=null;this.gussetReport=null;','R2.5 state slots');
  renderer=replaceOnce(renderer,'riseReview:this.riseReview};','riseReview:this.riseReview,gussetReview:this.gussetReview};','R2.5 diagnostic mode flag');
  const placementAnchor="    this.simulation=new ShortsCloth(this.pattern,this.body,stagedOptions);this.riseReport=completeShortsRiseR24(this.simulation,this.riseState);\n   }else{const source=h.sourceBind.get('hips'),current=h.byId.get('hips').world,q=qnorm(qm(current.q,inv(source.q)));";
  const placementReplacement="    this.simulation=new ShortsCloth(this.pattern,this.body,stagedOptions);this.riseReport=completeShortsRiseR24(this.simulation,this.riseState);\n   }else if(this.gussetReview){\n    this.gussetState=createShortsGussetStateR25(this.pattern,this.body,h);\n    const stagedOptions={...SHORTS_WEARING_OPTIONS,gravity:0,groundY:null,selfContact:true,selfContactSweeps:4,maxSelfCandidates:50000,triangleBodyContact:true,iterations:16,maxMaterialIterations:64,materialConvergenceStrain:.015,sewingSeconds:1000,handlingDamping:10};\n    this.simulation=new ShortsCloth(this.pattern,this.body,stagedOptions);this.gussetReport=completeShortsGussetR25(this.simulation,this.gussetState);\n   }else{const source=h.sourceBind.get('hips'),current=h.byId.get('hips').world,q=qnorm(qm(current.q,inv(source.q)));";
  renderer=replaceOnce(renderer,placementAnchor,placementReplacement,'R2.5 staged placement');
  const sewingAnchor="  this.assemblyState='sewing';const remaining=maxSteps;";
  const gussetRelax="  if(this.gussetReview){\n   this.assemblyState='gusset-relaxing';const minimumSteps=4,maximumSteps=48;\n   for(let step=0;step<maximumSteps;step++){\n    if(this.disposed)throw Error('R2.5 gusset review was disposed');\n    this.body.update();this.simulation.step(1);this.dirty=true;\n    this.gussetReport=auditShortsGussetR25(this.simulation,this.gussetState,this.gussetReport,{requireBody:true,requireSelfContact:true,materialLimit:.05});\n    if(step+1>=minimumSteps&&this.gussetReport.valid)break;\n    await new Promise(resolve=>setTimeout(resolve,0));\n   }\n   this.assemblyWallTimeMs+=performance.now()-begin;this.displayReady=true;this.assemblyReady=false;\n   this.assemblyState=this.gussetReport?.valid?'gusset-ready':'gusset-checkpoint-failed';\n   const staged=this.simulation.report();this.assemblyReport={...staged,gusset:this.gussetReport,assemblyState:this.assemblyState,assemblySteps:this.simulation.stepIndex,wallTimeMs:this.assemblyWallTimeMs,visualAcceptance:false};return this.assemblyReport;\n  }\n"+sewingAnchor;
  renderer=replaceOnce(renderer,sewingAnchor,gussetRelax,'R2.5 relaxation stage');
  renderer=replaceOnce(renderer,'diagnostics(){return {...this.report,placement:this.placementReport,leftTube:this.leftTubeReport,dualTube:this.dualTubeReport,rise:this.riseReport,pattern:','diagnostics(){return {...this.report,placement:this.placementReport,leftTube:this.leftTubeReport,dualTube:this.dualTubeReport,rise:this.riseReport,gusset:this.gussetReport,pattern:','R2.5 diagnostic report');
  fs.writeFileSync(rendererPath,renderer);console.log('Patched ClothShorts with canonical R2.5 review route.');
}else console.log('ClothShorts R2.5 review route is already canonical.');
