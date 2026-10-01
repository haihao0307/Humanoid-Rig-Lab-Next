/** Explicit, offline reference compiler. Original assets exist only temporarily. */
import {spawn,spawnSync} from 'node:child_process';import {mkdirSync,existsSync,rmSync} from 'node:fs';import {fileURLToPath} from 'node:url';import {join,resolve,sep} from 'node:path';
const subject=fileURLToPath(new URL('../',import.meta.url)),project=resolve(subject,'../..'),qa=join(subject,'qa');
const zip=process.argv[2]||'C:/Users/Administrator/Downloads/shirtless+male+model+3d (1).zip';
const python=join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');if(!existsSync(zip)||!existsSync(python))throw Error('Reference ZIP or bundled Python unavailable');mkdirSync(qa,{recursive:true});
function run(cmd,args,env={}){const r=spawnSync(cmd,args,{cwd:project,stdio:'inherit',windowsHide:true,env:{...process.env,...env}});if(r.status!==0)throw Error('Reference compiler step failed: '+args[0]);}
run(python,['-c',`import zipfile,pathlib,sys
target=pathlib.Path(sys.argv[2]).resolve();target.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(sys.argv[1]) as z:
 for entry in z.infolist():
  if not (target/entry.filename).resolve().is_relative_to(target):raise ValueError('Unsafe archive path')
 z.extractall(target)
`,zip,join(qa,'source-intake')]);
const env={R007_INTAKE:'1',R007_PORT:'8878',R007_QA_URL:'http://127.0.0.1:8878'};const server=spawn(process.execPath,[join(subject,'server.cjs')],{env:{...process.env,...env},stdio:['ignore','pipe','inherit'],windowsHide:true});
try{
 await new Promise((ok,no)=>{server.stdout.once('data',ok);server.once('error',no);server.once('exit',c=>no(Error('Intake server exited '+c)));});
 run(process.execPath,[join(subject,'tools/intake.cjs')],env);run(python,[join(subject,'chart-intake.py')]);run(python,[join(subject,'fit-fields.py')]);run(python,[join(subject,'pack-fields.py')]);run(process.execPath,['tools/build-pure.mjs']);run(process.execPath,['tools/check-pure.mjs']);
}finally{
 server.kill();for(const name of ['source-intake','capture.json','projection-charts.json','charts.json','coefficients.json.gz']){const p=resolve(qa,name);if(!p.startsWith(resolve(qa)+sep))throw Error('Unsafe cleanup path');rmSync(p,{recursive:true,force:true});}
}
