// File assembly only. Never imports the application or creates a browser/GPU.
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {gzipSync,gunzipSync} from 'node:zlib';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>readFileSync(root+p,'utf8');
const manifest=JSON.parse(read('source/assembly.json'));
export function assemble(){
 const seen=new Set();
 let runtime=read('source/runtime.template.js').replace(/\/\*__SOURCE:([^*]+)__\*\//g,(_,path)=>{
  if(!manifest.modules.includes(path)||seen.has(path))throw Error('Unexpected or duplicated source '+path);seen.add(path);
  let text=read(path);
  for(const [token,data]of Object.entries(manifest.jsonTokens))text=text.replace('/*__'+token+'_JSON__*/',JSON.stringify(JSON.parse(read('body/'+data+'.json'))));
  return text;
 });
 if(seen.size!==manifest.modules.length)throw Error('Assembly manifest has unused modules');
 const revision=createHash('sha256').update(runtime).digest('hex');
 runtime=runtime.replace('/*__GENERATOR_HASH__*/',revision);
 if(/\/\*__(?:SOURCE:|[A-Z_]+_JSON)/.test(runtime))throw Error('Unresolved runtime placeholder');
 const check=spawnSync(process.execPath,['--check','--input-type=module'],{input:runtime,encoding:'utf8'});
 if(check.status!==0)throw Error(check.stderr||'Runtime syntax check failed');
 const html=name=>{
  const used=new Set(),allowed=manifest.htmlModules?.[name]||[];
  const result=read('source/'+name+'.template.html').replace(/\/\*__SOURCE:([^*]+)__\*\//g,(_,path)=>{if(!allowed.includes(path)||used.has(path))throw Error('Unexpected HTML source '+path);used.add(path);return read(path).trimEnd();});
  if(used.size!==allowed.length)throw Error('HTML manifest has unused sources');return result;
 };
 const body=html('body').replace('/*__BODY_RUNTIME__*/',()=>runtime),brain=html('brain');
 const pack=text=>{const buffer=gzipSync(Buffer.from(text),{level:9,mtime:0});if(gunzipSync(buffer).toString()!==text)throw Error('Compression round trip failed');return buffer.toString('base64');};
 const index=html('index').replace('/*__BODY_GZIP__*/',()=>pack(body)).replace('/*__BRAIN_GZIP__*/',()=>pack(brain));
 return {runtime,body,brain,index};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {runtime,index}=assemble();
 if(process.argv.includes('--check')){if(read('index.html')!==index)throw Error('index.html differs from assembled sources');}
 else writeFileSync(root+'index.html',index);
 console.log(JSON.stringify({mode:process.argv.includes('--check')?'file-check':'file-build',runtimeBytes:Buffer.byteLength(runtime),entrypointBytes:Buffer.byteLength(index),sha256:createHash('sha256').update(index).digest('hex'),applicationExecuted:false}));
}
