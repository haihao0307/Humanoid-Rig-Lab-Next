const activeSubject=JSON.parse(require('node:fs').readFileSync(require('node:path').resolve(__dirname,'../../source/assembly.json'),'utf8')).activeSubject;
if(activeSubject==='new-human-r008'){require('../R008/start-preview.cjs');}else{
const {spawn}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path');
const url='http://127.0.0.1:8877/';
async function health(){try{const r=await fetch(url+'health',{signal:AbortSignal.timeout(1500)});return r.ok?await r.json():null;}catch{return null;}}
async function main(){
 const current=await health();
 if(current){if(current.subject!=='new-human-r007'||current.mode!=='preview')throw Error('Port 8877 is occupied by a different service.');console.log(url);return;}
 const qa=path.join(__dirname,'qa');fs.mkdirSync(qa,{recursive:true});
 const out=fs.openSync(path.join(qa,'preview-server.log'),'a'),err=fs.openSync(path.join(qa,'preview-server-error.log'),'a');
 const child=spawn(process.execPath,[path.join(__dirname,'server.cjs')],{cwd:__dirname,detached:true,windowsHide:true,stdio:['ignore',out,err],env:{...process.env,R007_INTAKE:'0',R007_PORT:'8877'}});
 child.on('error',e=>{console.error(e.message);process.exitCode=1;});child.unref();fs.closeSync(out);fs.closeSync(err);
 for(let i=0;i<30;i++){await new Promise(r=>setTimeout(r,200));const ready=await health();if(ready?.subject==='new-human-r007'&&ready.mode==='preview'&&ready.pid===child.pid){console.log(`Preview started in background (pid ${child.pid})\n${url}`);return;}}
 throw Error('Preview did not start. Check qa/preview-server-error.log.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1});

}
