import {readFileSync,readdirSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const base='New-Human-Production/R008',sha=s=>createHash('sha256').update(s).digest('hex');
const frozenPath=base+'/qa/shorts-source-upload-frozen.json';
if(process.argv.includes('--frozen')){
 const i=Number(process.argv[process.argv.indexOf('--chunk')+1]);
 if(!process.argv.includes('--chunk')||!Number.isInteger(i)||i<0)throw Error('Frozen upload requires an explicit valid chunk');
 const frozen=JSON.parse(readFileSync(frozenPath,'utf8'));
 console.log(JSON.stringify(frozen.slice(i*5,(i+1)*5)));process.exit(0);
}
const files=[
 'New-Human-Production/R008/tools/build-shorts-public-comparison.mjs',
 'New-Human-Production/R008/docs/SHORTS_V9_FABRIC_REVIEW_20261003.md',
 'New-Human-Production/R008/docs/SHORTS_V9_REVIEW_20261003.md',
 ...['probe-shorts-body-tape.mjs','probe-shorts-body-tape-domain.mjs','test-shorts-body-tape-guide.mjs','probe-shorts-rise-budget-v9.mjs','test-shorts-surface-transport-v9.mjs','test-shorts-static-feasible-direction.mjs','probe-shorts-initial-mapping-review.mjs','probe-shorts-v9-3-offline-diagnosis.mjs','probe-shorts-v9.mjs','probe-shorts-intrinsic-v9.mjs','probe-shorts-v9-target-witness.mjs','qa-shorts-v9.cjs'].map(n=>base+'/tools/'+n),
 'New-Human-Production/R008/docs/SHORTS_PAPER_SURFACE_MATH_20261003.md',
 'New-Human-Production/R008/docs/SHORTS_PAPER_SURFACE_IMPLEMENTATION_20261003.md',
 'New-Human-Production/R008/tools/probe-shorts-paper-surface-model.mjs',
 'New-Human-Production/R008/tools/probe-shorts-paper-runtime.mjs',
 'New-Human-Production/R008/tools/qa-shorts-paper-pipeline.cjs',
 ...readdirSync(base).filter(n=>/^Shorts.*\.mjs$/.test(n)).map(n=>base+'/'+n),
 // Entry HTML/app are rebuilt from the chosen native source. Do not freeze a
 // concurrent anatomy working-tree snapshot into this clothing source commit.
 ...['package.json','vendor/THREE-LICENSE.txt'].map(n=>base+'/'+n),
 ...['build-shorts-entry.mjs','build-shorts-standalone.mjs','build-shorts-comparison.mjs','install-shorts-runtime.mjs','shorts-preview-server.cjs','probe-shorts-draft.mjs','probe-shorts-waist-fit.mjs','probe-shorts-render-normals.mjs','probe-shorts-manufacturing-gram.mjs','probe-shorts-lowwaist-wear.mjs','probe-shorts-wearing-metric.mjs','probe-shorts-accepted-seed-transfer.mjs','probe-shorts-accepted-wearing.mjs','probe-shorts-bare-pelvis.mjs','probe-shorts-combined-skin-nearest.mjs','probe-shorts-contact-derivative.mjs','probe-shorts-visible-skin-contact.mjs','qa-shorts-covering.cjs','qa-shorts-surface.cjs','probe-shorts-surface-refinement.mjs','audit-shorts-covering-placement.mjs','qa-accepted-a-live-seed.cjs','probe-shorts-manufacturing.mjs','probe-shorts-sewing-coupled.mjs','probe-shorts-exterior.mjs','probe-shorts-feature-contact.mjs','probe-shorts-wearing-hinges.mjs','shorts-paper-audit.cjs','qa-shorts-motion.cjs','qa-shorts-source-sewn-two-versions.cjs','qa-shorts-manufacturing-exact-paper.cjs','SHORTS_MOTION_QA.md','SHORTS_RUNTIME_REVIEW.md','source-shorts/ShortsPattern.js','source-shorts/full-shorts-contract.cjs'].map(n=>base+'/tools/'+n),
 ...['probe-shorts-body.cjs','audit-shorts-source-loops.cjs','probe-shorts-boundary-targets.cjs','prepare-shorts-source-upload.mjs','commit-shorts-source-checkpoint.mjs'].map(n=>'tools/'+n),
 ...['SHORTS_LOW_RISE_TASK_20261002.json','SHORTS_LOW_RISE_REVIEW_20261002.json','SHORTS_VERSIONS_20261002.md','SHORTS_BARE_SKIN_20261002.md','SHORTS_SURFACE_FIT_20261003.md'].map(n=>'docs/'+n)
].sort();
if(new Set(files).size!==files.length)throw Error('Duplicate upload path');
const records=files.map(path=>{if(!existsSync(path))throw Error('Upload file missing: '+path);const content=readFileSync(path,'utf8'),bytes=Buffer.byteLength(content),gitBlobSHA1=createHash('sha1').update(Buffer.from('blob '+bytes+'\0')).update(content).digest('hex');return{path,mode:'100644',type:'blob',content,sha256:sha(content),gitBlobSHA1,bytes};});
const parent=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const manifest={createdAt:new Date().toISOString(),parent,status:'SOURCE_DEVELOPMENT_CHECKPOINT_NOT_COMPLETE_GARMENT',productionReady:false,motionValidated:false,originalRetained:true,files:records.map(({content,...r})=>r)};
mkdirSync(base+'/qa',{recursive:true});writeFileSync(base+'/qa/shorts-source-upload-manifest.json',JSON.stringify(manifest,null,2)+'\n');
if(process.argv.includes('--freeze'))writeFileSync(frozenPath,JSON.stringify(records));
if(process.argv.includes('--chunk')){const i=Number(process.argv[process.argv.indexOf('--chunk')+1]);if(!Number.isInteger(i)||i<0)throw Error('Invalid source chunk');console.log(JSON.stringify(records.slice(i*5,(i+1)*5)));}
else console.log(JSON.stringify({parent,files:records.length,chunks:Math.ceil(records.length/5),bytes:records.reduce((s,r)=>s+r.bytes,0),sourceOnly:true,productionReady:false}));
