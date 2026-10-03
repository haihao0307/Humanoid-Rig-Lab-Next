import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync,gunzipSync} from 'node:zlib';
import {SHORTS_VERSIONS} from '../ShortsVersions.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),out=resolve(process.argv[2]||resolve(root,'qa/shorts-v9-4-public-light-20261003'));
const candidate=readFileSync(resolve(root,'qa/shorts-standalone-20261002/index.html')),build=JSON.parse(readFileSync(resolve(root,'qa/shorts-standalone-20261002/BUILD.json'))),hash=b=>createHash('sha256').update(b).digest('hex');
if(hash(candidate)!==build.htmlSHA256)throw Error('Candidate changed after its real QA');
if(!process.argv[3])throw Error('Supply the preserved original HTML path as the third argument; original bytes are never regenerated.');
const original=readFileSync(resolve(process.argv[3]));
if(original.length!==23628713||hash(original)!==SHORTS_VERSIONS[0].htmlSHA256)throw Error('Original A identity mismatch');
mkdirSync(out,{recursive:true});
function transport(bytes,name){
 const compressed=gzipSync(bytes,{level:9});
 if(!gunzipSync(compressed).equals(bytes))throw Error('Lossless transport round-trip failed');
 const size=Math.ceil(compressed.length/4),chunks=[];
 for(let i=0;i<4;i++){const chunk=compressed.subarray(i*size,Math.min((i+1)*size,compressed.length)),filename=name+'-'+i+'.bin';writeFileSync(resolve(out,filename),chunk);chunks.push({url:'./'+filename,bytes:chunk.length,sha256:hash(chunk)});}
 return {format:'gzip',bytes:compressed.length,sha256:hash(compressed),chunks};
}
const versions=[{...SHORTS_VERSIONS[0],url:SHORTS_VERSIONS[0].publicURL,bytes:original.length,transport:transport(original,'original')},{...SHORTS_VERSIONS[1],url:'./candidate.html',bytes:candidate.length,htmlSHA256:hash(candidate),transport:transport(candidate,'candidate')}];
// Download only the selected exact checked runtime. Source/physics unchanged.
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>V9.4 短裤 · 原版 / 新版测试</title><link rel="icon" href="data:,"><style>html,body{margin:0;height:100%;background:#132022;color:#e4eee7;font:14px/1.5 system-ui}header{box-sizing:border-box;padding:10px 16px;height:116px;border-bottom:1px solid #516a60}nav{display:flex;gap:8px;margin:5px 0}button{padding:7px 14px;border:1px solid #657d72;border-radius:6px;background:#21372e;color:inherit;cursor:pointer}button[aria-pressed=true]{background:#52735a}#note,#loading{font-size:12px;color:#c6d7ca}#note{color:#f2d28b}iframe{display:block;border:0;width:100%;height:calc(100% - 116px)}@media(max-width:600px){header{height:146px;padding:8px}iframe{height:calc(100% - 146px)}}</style><header><strong>亚麻短裤 · V9.4 对照测试</strong><nav><button data-version="original">原版</button><button data-version="lowrise">新版 · 低腰松紧</button></nav><div id="note">新版仍有穿插与布面拉伸问题，穿着未通过，动作锁定。</div><div id="loading" role="status"></div></header><iframe id="workbench" title="真实短裤三维工作台"></iframe><script>
const versions=${JSON.stringify(versions)},cache=new Map();let generation=0,controller=null,readyTimer=null;
const status=document.getElementById('loading'),frame=document.getElementById('workbench');
async function selectVersion(id){
 const version=versions.find(v=>v.id===id);if(!version)throw Error('Unknown shorts version');
 const token=++generation;controller?.abort();controller=new AbortController();clearInterval(readyTimer);
 for(const b of document.querySelectorAll('[data-version]'))b.setAttribute('aria-pressed',String(b.dataset.version===id));
 window.ShortVersion.current=id;window.ShortVersion.ready=false;window.ShortVersion.failure=null;status.textContent='正在下载'+version.label+'，工作台将自行加载。';
 try{
  let source=cache.get(id);
  if(!source){
   if(!window.DecompressionStream)throw Error('请使用支持压缩流的新版浏览器');
   const digest=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
   const signal=controller.signal;let downloaded=0;
   const parts=await Promise.all(version.transport.chunks.map(async part=>{
    const response=await fetch(part.url,{signal});if(!response.ok)throw Error('下载 HTTP '+response.status);
    const reader=response.body.getReader(),chunks=[];let received=0;
    while(true){const {done,value}=await reader.read();if(done)break;received+=value.length;downloaded+=value.length;if(received>part.bytes)throw Error('传输分块长度不符');chunks.push(value);if(token!==generation)throw new DOMException('Version changed','AbortError');status.textContent='下载'+version.label+' '+Math.floor(downloaded/version.transport.bytes*100)+'% · '+(downloaded/1048576).toFixed(1)+' MB';}
    if(received!==part.bytes)throw Error('传输分块未完整下载');
    const bytes=new Uint8Array(received);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}if(await digest(bytes)!==part.sha256)throw Error('传输分块校验失败');return bytes;
   }));
   const compressed=new Uint8Array(version.transport.bytes);let offset=0;for(const part of parts){compressed.set(part,offset);offset+=part.length;}
   if(offset!==compressed.length||await digest(compressed)!==version.transport.sha256)throw Error('压缩文件校验失败');
   status.textContent='下载完成，正在解压并核验原始版本。';
   const bytes=new Uint8Array(await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
   if(bytes.length!==version.bytes||await digest(bytes)!==version.htmlSHA256)throw Error('版本文件校验失败');
   source=new TextDecoder('utf-8',{fatal:true}).decode(bytes);cache.set(id,source);
  }
  if(token!==generation)return;frame.srcdoc=source;status.textContent='下载完成，正在构造人物与真实布面。';
  readyTimer=setInterval(()=>{if(token!==generation){clearInterval(readyTimer);return;}const w=frame.contentWindow;
   if(w.failure){status.textContent='构造停止：'+w.failure;clearInterval(readyTimer);return;}
   const ready=id==='original'?w.ShortStaticTest?.ready:w.HumanShorts&&w.HumanShorts.fitStatus!=='adjusting';
   if(ready){window.ShortVersion.ready=true;status.textContent=id==='original'?'原版已加载；可切换查看新版。':'新版检查结束：仍未通过穿着验收，可切换视角检查。';clearInterval(readyTimer);}
  },1000);
 }catch(error){if(error.name==='AbortError'||token!==generation)return;controller.abort();status.textContent='加载失败：'+error.message;window.ShortVersion.failure=error.message;}
}
window.ShortVersion={current:null,ready:false,acceptedReference:null,versions,select:selectVersion};for(const button of document.querySelectorAll('[data-version]'))button.onclick=()=>selectVersion(button.dataset.version);selectVersion('original');
</script></html>`;
mkdirSync(out,{recursive:true});writeFileSync(resolve(out,'index.html'),html);writeFileSync(resolve(out,'candidate.html'),candidate);
const receipt={builtAt:new Date().toISOString(),revision:SHORTS_VERSIONS[1].revision,scope:'public loader only; tested garment bytes unchanged',htmlSHA256:hash(html),bytes:Buffer.byteLength(html),candidateSHA256:hash(candidate),candidateBytes:candidate.length,versions,originalSourceURLUnchanged:true,physicalAccepted:false,publicBrowserVerified:false};writeFileSync(resolve(out,'BUILD.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({out,...receipt,versions:undefined}));
