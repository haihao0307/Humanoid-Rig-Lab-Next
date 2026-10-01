import {spawn,spawnSync} from 'node:child_process';import {mkdirSync,existsSync,rmSync} from 'node:fs';import {fileURLToPath} from 'node:url';import {join,resolve,sep} from 'node:path';
const subject=fileURLToPath(new URL('../',import.meta.url)),project=resolve(subject,'../..'),qa=join(subject,'qa'),zip=process.argv[2]||'C:/Users/Administrator/Downloads/human+figure+3d+model (1).zip',python=join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
if(!existsSync(zip)||!existsSync(python))throw Error('Input ZIP or Python unavailable');mkdirSync(qa,{recursive:true});
function run(cmd,args){const r=spawnSync(cmd,args,{cwd:project,stdio:'inherit',windowsHide:true});if(r.status!==0)throw Error('Compiler step failed: '+args[0]);}
run(python,['-X','utf8','-c',`import zipfile,pathlib,sys
target=pathlib.Path(sys.argv[2]).resolve();target.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(sys.argv[1]) as z:
 for e in z.infolist():
  if not (target/e.filename).resolve().is_relative_to(target):raise ValueError('Unsafe archive path')
 z.extractall(target)
`,zip,join(qa,'source-intake')]);
if(!existsSync(join(qa,'python-deps','scipy')))run(python,['-m','pip','install','--disable-pip-version-check','--target',join(qa,'python-deps'),'scipy']);
const server=spawn(process.execPath,[join(subject,'server.cjs')],{env:{...process.env,R008_INTAKE:'1',R008_PORT:'8878'},stdio:['ignore','pipe','inherit'],windowsHide:true});
try{
 await new Promise((ok,no)=>{server.stdout.once('data',ok);server.once('error',no);server.once('exit',c=>no(Error('Intake exited '+c)));});
 run(process.execPath,[join(subject,'tools/intake.cjs')]);run(process.execPath,[join(subject,'tools/rig-samples.mjs')]);run(python,['-X','utf8',join(subject,'tools/compile.py')]);run(python,['-X','utf8',join(subject,'tools/pack-fields.py')]);run(python,['-X','utf8',join(subject,'tools/material-proof.py')]);run(process.execPath,[join(subject,'tools/material-proof.cjs')]);run(process.execPath,['tools/build-pure.mjs']);run(process.execPath,['tools/check-pure.mjs']);
}finally{
 server.kill();for(const name of ['source-intake','capture.json','rig-samples.json','rig-source.json','coefficients.json.gz']){const p=resolve(qa,name);if(!p.startsWith(resolve(qa)+sep))throw Error('Unsafe intake cleanup');rmSync(p,{recursive:true,force:true});}
}
