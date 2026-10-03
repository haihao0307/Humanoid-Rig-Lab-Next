export const LIVE_BAKE_SCHEMA='kaopu/bake@2';
import {parameters,validateSettings,validateGLB,unbase64} from './kaopu.js';
// Bounded, exact-input cache. A matching digest alone never bypasses compressed-data validation.
const cache=globalThis.__ATLAS_MODULE_CACHE__||(globalThis.__ATLAS_MODULE_CACHE__=new Map());
function remember(hash,entry){cache.delete(hash);cache.set(hash,entry);while(cache.size>2)cache.delete(cache.keys().next().value);return entry;}
const safe=v=>JSON.stringify(v).replace(/</g,'\\u003c');
export async function shaText(text){const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)));return Array.from(hash,v=>v.toString(16).padStart(2,'0')).join('');}
function encode(bytes){let text='';for(let i=0;i<bytes.length;i+=32768)text+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(text);}
export async function makeLiveBake(bake,animal,html,payload){
 const module=animal.adapter==='imported'?'imported':animal.asset,support=window.ATLAS_LIVE_SUPPORT,expected=support?.modules[module]?.sha256,cached=cache.get(expected),hash=cached?.html===html?expected:await shaText(html);
 if(support?.modules[module]?.sha256!==hash)throw Error('动物运行器指纹不匹配，未导出活动包');
 let entry=cached?.html===html?cached:null;if(!entry){const bytes=new Uint8Array(await new Response(new Blob([html]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());entry=remember(hash,{html,data:encode(bytes),bytes:new TextEncoder().encode(html).length});}
 const context=Object.fromEntries(['id','name','category','asset','adapter','version','key','life','engine','notation','instrument'].filter(k=>animal[k]!==undefined).map(k=>[k,animal[k]]));
 return{...bake,schema:LIVE_BAKE_SCHEMA,representation:{...bake.representation,kind:'current-form-with-original-life-runtime'},runtime:{schema:'kaopu/live-module@1',module,sha256:hash,encoding:'gzip-base64',bytes:entry.bytes,data:entry.data,context:{...context,basicData:bake.source.basicData,...(animal.adapter==='imported'?{geometryUnits:'source-units'}:{})},parameters:parameters(bake.source.parameters),...(bake.source.instrumentState?{instrumentState:bake.source.instrumentState}:{}),...(payload?{payload}:{})}};
}
export function validateLiveRuntime(runtime){
 if(runtime?.schema!=='kaopu/live-module@1'||runtime.encoding!=='gzip-base64'||typeof runtime.module!=='string'||!/^[-a-z0-9]+$/.test(runtime.module)||! /^[a-f0-9]{64}$/.test(runtime.sha256)||typeof runtime.data!=='string'||runtime.data.length>100*1048576||!Number.isInteger(runtime.bytes)||runtime.bytes<1||runtime.bytes>100*1048576)throw Error('活动运行器声明无效');
 const a=runtime.context;if(!a||!['native','imported','life','palau','fish','cat','eagle','crab','chicken'].includes(a.adapter)||typeof a.id!=='string'||typeof a.name!=='string'||a.name.length>60||(a.notation&&typeof a.notation!=='string')||(a.notation?.length>100000))throw Error('活动对象描述无效');
 if(runtime.parameters)parameters(runtime.parameters);
 if(runtime.payload)validateGLB(unbase64(runtime.payload.glb));
 const p=runtime.presentation;if(p&&(typeof p.scale!=='number'||!Number.isFinite(p.scale)||p.scale<=0||p.scale>100||typeof p.roughness!=='number'||!Number.isFinite(p.roughness)||p.roughness<=0||p.roughness>100||!Array.isArray(p.tint)||p.tint.length!==3||p.tint.some(x=>typeof x!=='number'||!Number.isFinite(x)||x<0||x>1)))throw Error('活动展示修饰参数无效');return runtime;
}
export async function openLiveModule(bake){
 const runtime=validateLiveRuntime(bake.runtime),support=window.ATLAS_LIVE_SUPPORT;
 // Imported files can only execute the exact instrument code pinned by this build.
 if(support?.modules[runtime.module]?.sha256!==runtime.sha256&&!support?.legacyModules?.[runtime.module]?.includes(runtime.sha256))throw Error('此活动包需要匹配版本的动物运行器，当前平台不执行未知代码');
 let html;const cached=cache.get(runtime.sha256);if(cached?.data===runtime.data&&cached.bytes===runtime.bytes)html=cached.html;else{
 let bytes;try{bytes=Uint8Array.from(atob(runtime.data),c=>c.charCodeAt(0));}catch{throw Error('活动运行器压缩数据损坏');}
 const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')),reader=stream.getReader(),parts=[];let size=0;try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>runtime.bytes||size>100*1048576)throw Error('活动运行器解压大小异常');parts.push(value);}}finally{await reader.cancel().catch(()=>{});}
 html=await new Blob(parts).text();if(size!==runtime.bytes||await shaText(html)!==runtime.sha256)throw Error('活动运行器校验失败，文件没有被执行');
remember(runtime.sha256,{html,data:runtime.data,bytes:runtime.bytes});}
 const frame=document.createElement('iframe');frame.className='rehearsal-worker';frame.style.cssText='position:fixed;left:-10000px;top:0;width:320px;height:240px;border:0;pointer-events:none';frame.title='动物原生生命活动运行器';document.body.append(frame);
 const context={...runtime.context,basicData:bake.source?.basicData||runtime.context.basicData,channel:'life-'+crypto.randomUUID(),initial:{displayStage:'turntable',studioRotate:false,playing:false}},boot='<script>window.__ATLAS_CONTEXT='+safe(context)+';<\/script>',data=runtime.payload?'<script type="application/json" id="instrument-data">'+safe(runtime.payload)+'</script>':'';
 let source=html.replace(/<head[^>]*>/i,m=>m+boot).replace(/<\/head>/i,'<style>'+support.style+'</style></head>').replace(/<\/body>/i,()=>data+'<script>'+support.bridge.replaceAll('</script','<\\/script')+'<\/script></body>');
 try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>finish(Error('生命活动运行器载入超时')),120000);function finish(e){clearTimeout(timer);removeEventListener('message',receive);e?reject(e):resolve();}function receive(e){const m=e.data;if(e.source!==frame.contentWindow||m?.protocol!=='animal-atlas/1'||m.channel!==context.channel)return;if(m.type==='ready')finish();else if(m.type==='failure')finish(Error(m.error));}addEventListener('message',receive);frame.srcdoc=source;});const api=frame.contentWindow.AnimalRuntime,description=api.describe(),values=parameters(runtime.parameters||bake.source?.parameters||{});validateSettings(values,description.controls,description.actions);for(const [key,value]of Object.entries(values))api.set(key,value);api.set('displayStage','turntable');api.set('studioRotate',false);api.set('playing',false);return{frame,window:frame.contentWindow,api,dispose(){frame.srcdoc='';frame.remove();}};}catch(e){frame.srcdoc='';frame.remove();throw e;}
}
