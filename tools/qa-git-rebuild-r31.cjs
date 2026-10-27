'use strict';
// Rebuild from committed files without the isolated original model.
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const run=(program,args,cwd=root)=>cp.execFileSync(program,args,{cwd,encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024});
const sha=run('git',['rev-parse','HEAD']).trim(),base=path.resolve(root,'qa/p1-torso/offline');
let dest=path.join(base,'git-rebuild-r31-'+sha.slice(0,12));if(fs.existsSync(dest))dest+='-'+Date.now();if(!dest.startsWith(base+path.sep))throw Error('Build destination escaped workspace');
const archive=dest+'.zip',report={startedUTC:new Date().toISOString(),verifiedCodeCommit:sha,scope:'Committed files only; build integrity, not visual or source acceptance',offlineOriginalInputsRead:false,externalDownloads:false,sourceFidelityAccepted:false,visualAccepted:false,checks:[]};
function check(name,value){report.checks.push({name,passed:!!value});if(!value)throw Error(name);}
try{
 run('git',['archive','--format=zip',sha,'-o',archive]);fs.mkdirSync(dest);
 run('python',['-c','import sys,zipfile,pathlib\np=pathlib.Path(sys.argv[2]).resolve()\nwith zipfile.ZipFile(sys.argv[1]) as z:\n for info in z.infolist():\n  q=(p/info.filename).resolve()\n  if q!=p and p not in q.parents: raise RuntimeError("Archive path escaped isolated build")\n z.extractall(p)',archive,dest]);
 check('isolated original model absent',!fs.existsSync(path.join(dest,'qa/fidelity-r21/offline/original.json'))&&!fs.existsSync(path.join(dest,'qa/legacy-comparison/人物身体_R01_参数保留与函数重构.html')));
 fs.writeFileSync(path.join(dest,'build.log'),run(process.execPath,['tools/build.cjs'],dest));
 for(const file of ['BUILD-SOURCE-R30.json','BUILD-R30.json','BUILD-SUPPORT-P1.json','BUILD-TORSO-P1.json','BUILD-SOURCE-R31.json','BUILD-R31.json']){const old=JSON.parse(fs.readFileSync(path.join(root,file))),built=JSON.parse(fs.readFileSync(path.join(dest,file))),artifact=fs.readFileSync(path.join(dest,built.file));check(file+' artifact identity',built.sha256===old.sha256&&hash(artifact)===old.sha256&&artifact.length===old.bytes);}
 fs.writeFileSync(path.join(dest,'integrity.log'),run(process.execPath,['tools/check-release-r31.cjs'],dest));const q=JSON.parse(fs.readFileSync(path.join(dest,'qa/p1-torso/release-integrity-r31.json')));check('all committed runtime assets and sampled reports pass',q.passed&&q.torsoAssets===6);report.torsoAssets=q.torsoAssets;report.integrityChecks=q.checks.length;report.passed=true;
}catch(e){report.failure=e.stack;report.passed=false;process.exitCode=1;console.error(e.message);}finally{report.finishedUTC=new Date().toISOString();fs.writeFileSync(path.join(root,'qa/p1-torso/git-tree-rebuild-r31.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,commit:sha,checks:report.checks.length,failure:report.failure}));}
