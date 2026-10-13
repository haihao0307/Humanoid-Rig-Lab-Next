"""One-time R08 runtime migration; R09_APPLIED prevents replay."""
from pathlib import Path
import json,hashlib,shutil
R=Path(__file__).resolve().parent;B=R.parent/'r08'
if (R/'R09_APPLIED.json').exists():raise SystemExit(0)
manifest=json.loads((B/'BUILD_MANIFEST.json').read_text())
for n,h in manifest['sourceFiles'].items():
 assert hashlib.sha256((B/n).read_bytes()).hexdigest()==h,'R08 changed: '+n
 if n!='detail-loader.mjs':
  p=R/n;p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(B/n,p)
for n in ['verify-worker.mjs','qa-browser.py','PRESETS.json','SOURCES.json','THREE_LICENSE.txt','SOURCE_AUTHORITY.json']:shutil.copyfile(B/n,R/n)
def rep(s,a,b):
 assert a in s,'Missing migration anchor: '+a[:90]
 return s.replace(a,b)
p=R/'app.js';s=p.read_text()
s=rep(s,"import {fetchDetail} from './detail-loader.mjs';","import {fetchDetail,detailStats,clearDetailMemory} from './detail-loader.mjs';\nimport {RuntimeGeometryCache} from './runtime-cache.mjs';")
s=rep(s,'const assetCache=new Map();','const derivedCache=new RuntimeGeometryCache();const profileIds=new WeakMap();let profileSerial=0;\nfunction profileIdentity(hp){if(!hp)return 0;if(!profileIds.has(hp))profileIds.set(hp,++profileSerial);return profileIds.get(hp);}\nconst assetCache=new Map();')
s=rep(s,'[s.id,s.head,hp?.ymax,','[D?.sourceHash,s.id,s.head,profileIdentity(hp),hp?.ymax,')
s=rep(s,'return {idleAssets:assetCache.size,','return {geometryCache:derivedCache.report(),detailCache:detailStats(),startup:globalThis.__hatStartupStats||{},idleAssets:assetCache.size,')
s=rep(s,'a.fitResults.set(key,fit);while(a.fitResults.size>4)a.fitResults.delete(a.fitResults.keys().next().value);','a.fitResults.set(key,fit);while(a.fitResults.size>4)a.fitResults.delete(a.fitResults.keys().next().value);derivedCache.set(a.meta.id,{mesh:a.mesh,fitResults:a.fitResults});')
a=""" phase(ctx,'在线程中生成帽型');const start=performance.now();
 const {mesh,fit,workerMS}=await compute('build',{meta:lightMeta(meta),settings,profile:hp},{signal:ctx.signal,onStage:t=>phase(ctx,t)});guard(ctx.signal);"""
b=""" const start=performance.now(),cached=derivedCache.get(meta.id),signature=fitSignature(settings,hp);
 let mesh=cached?.mesh,fitResults=cached?.fitResults||new Map(),fit=fitResults.get(signature),workerMS=0;
 const generationReused=!!mesh,fitReused=!!fit;
 if(!mesh){phase(ctx,'在线程中生成帽型');({mesh,fit,workerMS}=await compute('build',{meta:lightMeta(meta),settings,profile:hp},{signal:ctx.signal,onStage:t=>phase(ctx,t)}));}
 else if(!fit){phase(ctx,'复用原帽型并量配');({fit,workerMS}=await compute('fit',{mesh,meta:lightMeta(meta),settings,profile:hp},{signal:ctx.signal,onStage:t=>phase(ctx,t)}));}
 else phase(ctx,'复用本页已生成帽型与量配结果');
 guard(ctx.signal);fitResults.set(signature,fit);while(fitResults.size>4)fitResults.delete(fitResults.keys().next().value);
 derivedCache.set(meta.id,{mesh,fitResults});"""
s=rep(s,a,b)
s=rep(s,'const uniforms=installSurface(T,material),fitResults=new Map([[fitSignature(settings,hp),fit]]);','const uniforms=installSurface(T,material);')
s=rep(s,'generationMS:performance.now()-start,workerMS,fitSource:null','generationMS:performance.now()-start,workerMS,generationReused,fitReused,fitSource:null')
s=rep(s,'lastSwitch={id,cacheHit:fromCache,','lastSwitch={id,cacheHit:fromCache,generationReused:fromCache||a.generationReused,fitReused:fromCache||a.fitReused,')
s=rep(s,"${fromCache?'缓存复用':'程序生成'}","${fromCache?'渲染缓存':a.fitReused?'生成结果复用':a.generationReused?'原帽型复用':'程序生成'}")
a="async function boot(){const bytes=Uint8Array.from(atob($('payload').textContent.trim()),c=>c.charCodeAt(0));D=JSON.parse(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text());$('payload').remove();"
b="""async function boot(){const started=performance.now(),packed=$('payload').textContent.trim();
 const loaded=await compute('payload',{base64:packed},{onStage:t=>message(t),timeout:25000});D=loaded.payload;
 globalThis.__hatStartupStats??={};globalThis.__hatStartupStats.payloadMS=performance.now()-started;globalThis.__hatStartupStats.payloadWorkerMS=loaded.workerMS;
 $('payload').remove();"""
s=rep(s,a,b)
s=rep(s,"const storage='kaopu.hat-r08.recipe'","const storage='kaopu.hat-r09.recipe'")
s=rep(s,'const saved=localStorage.getItem(storage);',"const saved=localStorage.getItem(storage)||localStorage.getItem('kaopu.hat-r08.recipe');")
s=rep(s,"||(input.version==='HAT-R07.1'","||(input.version==='HAT-R08.0'&&input.sourceCommit==='863236dade1ea5c6bb7d4b65ad759d797034419f')||(input.version==='HAT-R07.1'")
s=rep(s,'window.hatLab={','window.hatLab={clearRuntimeCaches,')
s+="""
function clearRuntimeCaches(){
 cancelSelection();stopDetail();
 for(const a of assetCache.values())if(a!==asset)disposeAsset(a);
 assetCache.clear();derivedCache.clear();clearDetailMemory();
 message('临时缓存已释放；当前帽子和已保存配方保留。再次选帽会重新准备。');
 if(asset)queueDetail(asset);return cacheReport();
}
"""
s=rep(s,"$('retry-detail').onclick","$('clear-cache').onclick=clearRuntimeCaches;$('retry-detail').onclick")
s=rep(s,"document.addEventListener('visibilitychange',()=>{if(!document.hidden)requestRender();});","document.addEventListener('visibilitychange',()=>{if(document.hidden)stopDetail();else{requestRender();if(asset&&!busy)queueDetail(asset);}});")
p.write_text(s)
p=R/'worker.mjs';s=rep(p.read_text(),'self.onmessage=e=>{','self.onmessage=async e=>{')
s=rep(s,"if(kind==='head'){","""if(kind==='payload'){
   self.postMessage({job,stage:'在线程中读取全部帽型与原色'});
   const text=atob(data.base64),bytes=new Uint8Array(text.length);
   for(let i=0;i<text.length;i++)bytes[i]=text.charCodeAt(i);
   const json=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
   result={payload:JSON.parse(json)};
  }else if(kind==='head'){""")
p.write_text(s)
