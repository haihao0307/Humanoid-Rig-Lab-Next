// Wire the source-owned R2.4 centre-rise checkpoint without changing the
// original paper, body generation, Human rig, UVs, topology or material mass.
// Idempotent so the browser workflow can retain canonical sources after review.
import fs from 'node:fs';

const replaceOnce=(text,from,to,label)=>{
  const first=text.indexOf(from),last=text.lastIndexOf(from);
  if(first<0||first!==last)throw Error('Ambiguous R2.4 rise patch anchor: '+label);
  return text.replace(from,to);
};
const module='clothing/ShortsRiseAssemblyR2.js';
if(!fs.existsSync(module))throw Error('R2.4 centre-rise source module is missing');

const manifestPath='source/assembly.json';
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
if(!manifest.modules.includes(module)){
  const anchor='clothing/ShortsDualTubeR2.js',index=manifest.modules.indexOf(anchor);
  if(index<0)throw Error('R2.3b dual-tube source is missing from assembly manifest');
  manifest.modules.splice(index+1,0,module);fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
  console.log('Inserted R2.4 centre-rise module into source/assembly.json.');
}else console.log('R2.4 centre-rise assembly module is already canonical.');

const runtimePath='source/runtime.template.js';
let runtime=fs.readFileSync(runtimePath,'utf8');
const marker='/*__SOURCE:'+module+'__*/',anchor='/*__SOURCE:clothing/ShortsDualTubeR2.js__*/';
if(!runtime.includes(marker)){runtime=replaceOnce(runtime,anchor,anchor+'\n'+marker,'runtime source marker');fs.writeFileSync(runtimePath,runtime);console.log('Inserted canonical R2.4 runtime source marker.');}
else console.log('R2.4 runtime source marker is already canonical.');

const rendererPath='clothing/ClothShorts.js';
let renderer=fs.readFileSync(rendererPath,'utf8');
if(!renderer.includes('this.riseReview=')){
  const dualFlag="this.dualTubeReview=/(?:[?&])shortsStage=r2(?:\\.|%2E)3-dual(?:&|$)/i.test(search);";
  renderer=replaceOnce(renderer,dualFlag,dualFlag+"this.riseReview=/(?:[?&])shortsStage=r2(?:\\.|%2E)4-rise(?:&|$)/i.test(search);",'R2.4 query mode');
  renderer=replaceOnce(renderer,'this.stagedReview=this.placementReview||this.leftTubeReview||this.dualTubeReview;','this.stagedReview=this.placementReview||this.leftTubeReview||this.dualTubeReview||this.riseReview;','staged review mode');
  renderer=replaceOnce(renderer,'this.dualTubeState=null;this.dualTubeReport=null;','this.dualTubeState=null;this.dualTubeReport=null;this.riseState=null;this.riseReport=null;','R2.4 state slots');
  renderer=replaceOnce(renderer,'dualTubeReview:this.dualTubeReview};','dualTubeReview:this.dualTubeReview,riseReview:this.riseReview};','R2.4 diagnostic mode flag');
  const placementAnchor="    this.simulation=new ShortsCloth(this.pattern,this.body,stagedOptions);this.dualTubeReport=completeShortsDualTubeR23(this.simulation,this.dualTubeState);\n   }else{const source=h.sourceBind.get('hips'),current=h.byId.get('hips').world,q=qnorm(qm(current.q,inv(source.q)));";
  const placementReplacement="    this.simulation=new ShortsCloth(this.pattern,this.body,stagedOptions);this.dualTubeReport=completeShortsDualTubeR23(this.simulation,this.dualTubeState);\n   }else if(this.riseReview){\n    this.riseState=createShortsRiseStateR24(this.pattern,this.body,h);\n    const stagedOptions={...SHORTS_WEARING_OPTIONS,gravity:0,groundY:null,selfContact:true,selfContactSweeps:3,maxSelfCandidates:40000,triangleBodyContact:true,iterations:12,maxMaterialIterations:32,sewingSeconds:1000,handlingDamping:8};\n    this.simulation=new ShortsCloth(this.pattern,this.body,stagedOptions);this.riseReport=completeShortsRiseR24(this.simulation,this.riseState);\n   }else{const source=h.sourceBind.get('hips'),current=h.byId.get('hips').world,q=qnorm(qm(current.q,inv(source.q)));";
  renderer=replaceOnce(renderer,placementAnchor,placementReplacement,'R2.4 staged placement');
  const sewingAnchor="  this.assemblyState='sewing';const remaining=maxSteps;";
  const riseRelax="  if(this.riseReview){\n   this.assemblyState='rise-relaxing';const minimumSteps=4,maximumSteps=36;\n   for(let step=0;step<maximumSteps;step++){\n    if(this.disposed)throw Error('R2.4 centre-rise review was disposed');\n    this.body.update();this.simulation.step(1);this.dirty=true;\n    this.riseReport=auditShortsRiseR24(this.simulation,this.riseState,this.riseReport,{requireBody:true,requireSelfContact:true});\n    if(step+1>=minimumSteps&&this.riseReport.valid)break;\n    await new Promise(resolve=>setTimeout(resolve,0));\n   }\n   this.assemblyWallTimeMs+=performance.now()-begin;this.displayReady=true;this.assemblyReady=false;\n   this.assemblyState=this.riseReport?.valid?'rise-ready':'rise-checkpoint-failed';\n   const staged=this.simulation.report();this.assemblyReport={...staged,rise:this.riseReport,assemblyState:this.assemblyState,assemblySteps:this.simulation.stepIndex,wallTimeMs:this.assemblyWallTimeMs,visualAcceptance:false};return this.assemblyReport;\n  }\n"+sewingAnchor;
  renderer=replaceOnce(renderer,sewingAnchor,riseRelax,'R2.4 relaxation stage');
  renderer=replaceOnce(renderer,'diagnostics(){return {...this.report,placement:this.placementReport,leftTube:this.leftTubeReport,dualTube:this.dualTubeReport,pattern:','diagnostics(){return {...this.report,placement:this.placementReport,leftTube:this.leftTubeReport,dualTube:this.dualTubeReport,rise:this.riseReport,pattern:','R2.4 diagnostic report');
  fs.writeFileSync(rendererPath,renderer);console.log('Patched ClothShorts with canonical R2.4 review route.');
}else console.log('ClothShorts R2.4 review route is already canonical.');
