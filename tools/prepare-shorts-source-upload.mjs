import {readFileSync,readdirSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const base='New-Human-Production/R008',sha=s=>createHash('sha256').update(s).digest('hex');
const files=[
 ...readdirSync(base).filter(n=>/^Shorts.*\.mjs$/.test(n)).map(n=>base+'/'+n),
 ...['package.json','shorts-app.mjs','shorts-index.html','vendor/THREE-LICENSE.txt'].map(n=>base+'/'+n),
 ...['build-shorts-entry.mjs','build-shorts-standalone.mjs','build-shorts-comparison.mjs','install-shorts-runtime.mjs','shorts-preview-server.cjs','probe-shorts-draft.mjs','probe-shorts-manufacturing.mjs','probe-shorts-sewing-coupled.mjs','probe-shorts-exterior.mjs','qa-shorts-motion.cjs','qa-shorts-source-sewn-two-versions.cjs','qa-shorts-manufacturing-exact-paper.cjs','SHORTS_MOTION_QA.md','SHORTS_RUNTIME_REVIEW.md','source-shorts/ShortsPattern.js','source-shorts/full-shorts-contract.cjs'].map(n=>base+'/tools/'+n),
 ...['probe-shorts-body.cjs','audit-shorts-source-loops.cjs','probe-shorts-boundary-targets.cjs','prepare-shorts-source-upload.mjs'].map(n=>'tools/'+n),
 ...['SHORTS_LOW_RISE_TASK_20261002.json','SHORTS_LOW_RISE_REVIEW_20261002.json','SHORTS_VERSIONS_20261002.md'].map(n=>'docs/'+n)
].sort();
if(new Set(files).size!==files.length)throw Error('Duplicate upload path');
const records=files.map(path=>{if(!existsSync(path))throw Error('Upload file missing: '+path);const content=readFileSync(path,'utf8');return{path,mode:'100644',type:'blob',content,sha256:sha(content),bytes:Buffer.byteLength(content)};});
const parent=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const manifest={createdAt:new Date().toISOString(),parent,status:'SOURCE_DEVELOPMENT_CHECKPOINT_NOT_COMPLETE_GARMENT',productionReady:false,motionValidated:false,originalRetained:true,files:records.map(({content,...r})=>r)};
mkdirSync(base+'/qa',{recursive:true});writeFileSync(base+'/qa/shorts-source-upload-manifest.json',JSON.stringify(manifest,null,2)+'\n');
if(process.argv.includes('--chunk')){const i=Number(process.argv[process.argv.indexOf('--chunk')+1]);if(!Number.isInteger(i)||i<0)throw Error('Invalid source chunk');console.log(JSON.stringify(records.slice(i*5,(i+1)*5)));}
else console.log(JSON.stringify({parent,files:records.length,chunks:Math.ceil(records.length/5),bytes:records.reduce((s,r)=>s+r.bytes,0),sourceOnly:true,productionReady:false}));
