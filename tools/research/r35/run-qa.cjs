'use strict';
// Actual workbench checks use a headless browser and do not create image files.
const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
const directory='qa/skin-r35';fs.mkdirSync(directory,{recursive:true});
const build=JSON.parse(fs.readFileSync('BUILD-R35.json','utf8'));
const checks=[['workbench','qa-workbench-candidate.cjs'],['micro-details','qa-micro-controls.cjs'],['handoff','qa-source-handoff.cjs'],['drag','qa-drag-candidate.cjs'],['lifecycle','qa-lifecycle.cjs'],['light-presets','qa-light-presets.cjs'],['drag-highdpi','qa-drag-candidate.cjs',{BODY_R35_DPR:'2'}]];
const requested=process.argv.slice(2),selected=requested.length?checks.filter(([name])=>requested.includes(name)):checks;
if(requested.length!==selected.length&&requested.length)throw Error('Unknown QA check');
let summary=[],equivalence=null;
if(requested.length){const prior=JSON.parse(fs.readFileSync(path.join(directory,'summary.json'),'utf8'));if(!prior.passed||prior.workbenchSHA256!==build.sha256)throw Error('A passing summary for this workbench is required');summary=prior.checks.filter(c=>!requested.includes(c.name));equivalence=prior.equivalence||null;}
for(const [name,script,extraEnv]of selected){
  const result=spawnSync(process.execPath,[path.join('tools/research/r35',script)],{encoding:'utf8',maxBuffer:8*1024*1024,env:{...process.env,BODY_R35_BASE:process.env.BODY_R35_BASE||'http://127.0.0.1:8914',...extraEnv}});
  let data;try{data=JSON.parse((result.stdout||'').trim());}catch(e){data={passed:false,output:result.stdout,error:result.stderr||String(result.error||e)};}
  data.passed=data.passed===true&&result.status===0;
  const record={testedUTC:new Date().toISOString(),workbenchSHA256:build.sha256,baseURL:process.env.BODY_R35_BASE||'http://127.0.0.1:8914',...data};
  fs.writeFileSync(path.join(directory,name+'.json'),JSON.stringify(record,null,2)+'\n');
  summary.push({name,passed:record.passed,testedWorkbenchSHA256:build.sha256});console.log(JSON.stringify(summary[summary.length-1]));
  if(!record.passed){process.exitCode=1;break;}
}
fs.writeFileSync(path.join(directory,'summary.json'),JSON.stringify({testedUTC:new Date().toISOString(),workbenchSHA256:build.sha256,checks:summary,passed:summary.length===checks.length&&summary.every(x=>x.passed),...(equivalence?{equivalence}:{})},null,2)+'\n');
