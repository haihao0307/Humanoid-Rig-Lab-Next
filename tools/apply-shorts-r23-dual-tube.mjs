// Wire the source-owned R2.3b dual-tube checkpoint without changing paper,
// body generation, rig data, UVs, topology or material mass. Idempotent so
// the review workflow can retain the canonical sources after validation.
import fs from 'node:fs';

const replaceOnce=(text,from,to,label)=>{
  const first=text.indexOf(from),last=text.lastIndexOf(from);
  if(first<0||first!==last)throw Error('Ambiguous dual-tube patch anchor: '+label);
  return text.replace(from,to);
};

const module='clothing/ShortsDualTubeR2.js';
if(!fs.existsSync(module))throw Error('R2.3b dual-tube source module is missing');

const manifestPath='source/assembly.json';
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
if(!manifest.modules.includes(module)){
  const anchor='clothing/ShortsTubeFormationR2.js',index=manifest.modules.indexOf(anchor);
  if(index<0)throw Error('R2.3 left-tube source is missing from assembly manifest');
  manifest.modules.splice(index+1,0,module);
  fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
  console.log('Inserted R2.3b module into source/assembly.json.');
}else console.log('R2.3b assembly module is already canonical.');

const runtimePath='source/runtime.template.js';
let runtime=fs.readFileSync(runtimePath,'utf8');
const marker='/*__SOURCE:'+module+'__*/',anchor='/*__SOURCE:clothing/ShortsTubeFormationR2.js__*/';
if(!runtime.includes(marker)){
  runtime=replaceOnce(runtime,anchor,anchor+'\n'+marker,'runtime source marker');
  fs.writeFileSync(runtimePath,runtime);
  console.log('Inserted canonical R2.3b runtime source marker.');
}else console.log('R2.3b runtime source marker is already canonical.');

const rendererPath='clothing/ClothShorts.js';
let renderer=fs.readFileSync(rendererPath,'utf8');
if(!renderer.includes('this.dualTubeReview=')){
  const leftReview="this.leftTubeReview=/(?:[?&])shortsStage=r2(?:\\.|%2E)3-left(?:&|$)/i.test(search);";
  renderer=replaceOnce(renderer,leftReview,leftReview+"this.dualTubeReview=/(?:[?&])shortsStage=r2(?:\\.|%2E)3-dual(?:&|$)/i.test(search);",'dual query mode');
  renderer=replaceOnce(renderer,'this.stagedReview=this.placementReview||this.leftTubeReview;','this.stagedReview=this.placementReview||this.leftTubeReview||this.dualTubeReview;','staged review mode');
  renderer=replaceOnce(renderer,'this.placementReport=null;this.leftTubeState=null;this.leftTubeReport=null;','this.placementReport=null;this.leftTubeState=null;this.leftTubeReport=null;this.dualTubeState=null;this.dualTubeReport=null;','dual state slots');
  renderer=replaceOnce(renderer,'placementReview:this.placementReview,leftTubeReview:this.leftTubeReview','placementReview:this.placementReview,leftTubeReview:this.leftTubeReview,dualTubeReview:this.dualTubeReview','diagnostic mode flag');
  const leftCompletion="this.simulation=new ShortsCloth(this.pattern,this.body,stagedOptions);this.leftTubeReport=completeShortsLeftTubeR23(this.simulation,this.leftTubeState);\n   }else{";
  const dualPlacement="this.simulation=new ShortsCloth(this.pattern,this.body,stagedOptions);this.leftTubeReport=completeShortsLeftTubeR23(this.simulation,this.leftTubeState);\n   }else if(this.dualTubeReview){\n    this.dualTubeState=createShortsDualTubeStateR23(this.pattern,this.body,h);\n    const stagedOptions={...SHORTS_WEARING_OPTIONS,gravity:0,groundY:null,selfContact:false,triangleBodyContact:true,iterations:10,maxMaterialIterations:20,sewingSeconds:1000,handlingDamping:5};\n    this.simulation=new ShortsCloth(this.pattern,this.body,stagedOptions);this.dualTubeReport=completeShortsDualTubeR23(this.simulation,this.dualTubeState);\n   }else{";
  renderer=replaceOnce(renderer,leftCompletion,dualPlacement,'dual staged placement');
  const sewingAnchor="  this.assemblyState='sewing';const remaining=maxSteps;";
  const dualRelax="  if(this.dualTubeReview){\n   this.assemblyState='dual-tube-relaxing';const minimumSteps=3,maximumSteps=24;\n   for(let step=0;step<maximumSteps;step++){\n    if(this.disposed)throw Error('R2.3b dual-tube review was disposed');\n    this.body.update();this.simulation.step(1);this.dirty=true;\n    this.dualTubeReport=auditShortsDualTubeR23(this.simulation,this.dualTubeState,this.dualTubeReport,{requireBody:true});\n    if(step+1>=minimumSteps&&this.dualTubeReport.valid)break;\n    await new Promise(resolve=>setTimeout(resolve,0));\n   }\n   this.assemblyWallTimeMs+=performance.now()-begin;this.displayReady=true;this.assemblyReady=false;\n   this.assemblyState=this.dualTubeReport?.valid?'dual-tube-ready':'dual-tube-checkpoint-failed';\n   const staged=this.simulation.report();this.assemblyReport={...staged,dualTube:this.dualTubeReport,assemblyState:this.assemblyState,assemblySteps:this.simulation.stepIndex,wallTimeMs:this.assemblyWallTimeMs,visualAcceptance:false};return this.assemblyReport;\n  }\n"+sewingAnchor;
  renderer=replaceOnce(renderer,sewingAnchor,dualRelax,'dual relaxation stage');
  renderer=replaceOnce(renderer,'diagnostics(){return {...this.report,placement:this.placementReport,leftTube:this.leftTubeReport,pattern:','diagnostics(){return {...this.report,placement:this.placementReport,leftTube:this.leftTubeReport,dualTube:this.dualTubeReport,pattern:','dual diagnostic report');
  fs.writeFileSync(rendererPath,renderer);
  console.log('Patched ClothShorts with canonical R2.3b review route.');
}else console.log('ClothShorts R2.3b review route is already canonical.');
