(function(root){
'use strict';
const C=RealityConnectionContract,R=RF32_REGISTRY,$=id=>document.getElementById(id);C.validateRegistry(R);
const entry=R.entries.find(x=>x.family==='denim'),install=entry.installation;
let generation=0,abort=null,session={state:'DISCONNECTED',transport:null,observedCore:null,checkedAt:null,error:null},display={mode:null,family:null},sourceCheck={state:'NOT_CHECKED',checkedAt:null};
const copy=C.copy;
function paint(){
 const table=$('rf32-connections');table.replaceChildren();
 for(const e of R.entries){const row=document.createElement('tr');const cells=[({denim:'牛仔 R17.2',knit:'毛衣 P02 C2',leather:'皮革 R17'})[e.family],'已登记','已验证',e.installation?'源端试装已复验':'尚未试装','未安装／未合并'];for(const value of cells){const td=document.createElement('td');td.textContent=value;row.append(td);}table.append(row);}
 const labels={DISCONNECTED:'未连接源端',CHECKING:'正在核对源端字节',BYTES_VERIFIED:'来源摘要一致，等待运行接口',CONNECTED:'本会话来源与接口均已核对',FAILED:'源端连接被拒绝或失败',CLOSED:'源端已断开'};
 $('rf32-session').textContent=(labels[session.state]||session.state)+' · '+(session.transport==='pinned_https'?'从固定公网源入口读取':session.transport==='embedded_installed_bytes'?'离线保存的试装源副本；没有本次联网复核':'未运行')+(session.error?' · '+session.error:'');
 $('rf32-session').classList.toggle('error',session.state==='FAILED');
 $('rf32-report-mode').textContent=display.mode==='live_read_only'&&display.family==='denim'?'当前规范表来自本次已核对的牛仔源实例。':'源端试装记录与当前规范表分别管理；历史、导入或其他材料不会升级牛仔生产状态。';
 $('rf32-source-check').textContent=sourceCheck.state==='MATCH'?'原工作分支入口内容仍与核对基线一致（仅入口字节，不代表全仓库认证）。':sourceCheck.state==='CHANGED'?'原工作分支入口已变化：旧适配证据不能自动覆盖新版本。':sourceCheck.state==='CHECKING'?'正在只读检查原工作分支入口…':sourceCheck.state==='ERROR'?'原分支检查未完成：'+sourceCheck.error:'原分支核对时间：'+R.sourceCheckAt+'。可手动重新检查入口内容。';
}
async function bytesHash(bytes){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');}
async function load(){
 const ticket=++generation;abort?.abort();const controller=new AbortController();abort=controller;const signal=controller.signal,deadline=setTimeout(()=>controller.abort(),20000);
 session={state:'CHECKING',transport:location.protocol==='file:'?'embedded_installed_bytes':'pinned_https',observedCore:null,checkedAt:null,error:null};paint();
 try{
  let b;if(location.protocol==='file:'){
   const raw=Uint8Array.from(atob(RF32_INSTALLED_PACK.data),x=>x.charCodeAt(0));b=new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  }else{
   const response=await fetch(C.rawURL(install),{signal,cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)throw Error('SOURCE_HTTP_'+response.status);
   const chunks=[],reader=response.body.getReader();let size=0;for(;;){const x=await reader.read();if(x.done)break;size+=x.value.length;if(size>install.bytes){await reader.cancel();throw Error('SOURCE_SIZE_MISMATCH');}chunks.push(x.value);}b=new Uint8Array(size);let offset=0;for(const v of chunks){b.set(v,offset);offset+=v.length;}
  }
  if(ticket!==generation)throw Error('SOURCE_CONNECTION_CANCELLED');
  if(b.length!==install.bytes||await bytesHash(b)!==install.htmlSHA256)throw Error('SOURCE_HASH_MISMATCH');
  if(ticket!==generation)throw Error('SOURCE_CONNECTION_CANCELLED');session.state='BYTES_VERIFIED';session.checkedAt=new Date().toISOString();paint();return new TextDecoder('utf-8',{fatal:true}).decode(b);
 }catch(e){if(ticket===generation){session.state='FAILED';session.error=e.name==='AbortError'?'SOURCE_CHECK_TIMEOUT_OR_CANCELLED':e.message;paint();}throw e;}finally{clearTimeout(deadline);}
}
function verify(kind,frame,packet){if(kind!=='denim')return;try{if(!['BYTES_VERIFIED','CONNECTED'].includes(session.state))throw Error('SOURCE_NOT_BYTE_VERIFIED');const provider=frame.contentWindow.KAOPU_SOURCE_INSTALLATION;if(!provider||typeof provider.info!=='function')throw Error('SOURCE_PROVIDER_MISSING');const core=provider.info();C.inspectProvider(core,install.core,packet);session.state='CONNECTED';session.observedCore=copy(core);paint();}catch(e){session.state='FAILED';session.error=e.message;paint();throw e;}}
function close(){generation++;abort?.abort();abort=null;session={...session,state:'CLOSED',observedCore:null,error:null};paint();}
function reportMode(mode,family){display={mode,family};paint();}
async function checkOriginal(){
 if(sourceCheck.state==='CHECKING')return copy(sourceCheck);
 sourceCheck={state:'CHECKING',checkedAt:null};paint();const controller=new AbortController(),deadline=setTimeout(()=>controller.abort(),20000);
 try{const u='https://raw.githubusercontent.com/'+install.core.repository+'/refs/heads/'+install.core.productionBranch+'/'+install.core.entryPath;const r=await fetch(u,{signal:controller.signal,cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});if(!r.ok)throw Error('HTTP_'+r.status);const bytes=new Uint8Array(await r.arrayBuffer());if(bytes.length>1048576)throw Error('SOURCE_TOO_LARGE');const h=await bytesHash(bytes);sourceCheck={state:h===R.originalEntrySHA256?'MATCH':'CHANGED',checkedAt:new Date().toISOString(),sha256:h};}catch(e){sourceCheck={state:'ERROR',checkedAt:new Date().toISOString(),error:e.message};}finally{clearTimeout(deadline);}paint();return copy(sourceCheck);
}
$('rf32-source-link').href=C.publicURL(install);
$('rf32-old-link').href='https://htmlpreview.github.io/?https://raw.githubusercontent.com/'+install.core.repository+'/'+install.core.sourceBaseCommit+'/'+install.core.entryPath;
$('rf32-check-original').onclick=checkOriginal;
$('rf32-negative').onclick=()=>{const bad=copy(install.core);bad.adapterSHA256='0'.repeat(64);try{C.sameCore(bad,install.core);$('rf32-negative-result').textContent='错误：未拒绝';}catch(e){$('rf32-negative-result').textContent='版本反例已拒绝：'+e.message+'。实际连接和数据未改。';}};
$('rf32-export').onclick=()=>{const b=new Blob([JSON.stringify({schema:'kaopu/reality-connection-review@1',registry:R,session,sourceCheck,scope:'documentation of this view; not a signed production attestation'},null,2)],{type:'application/json'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download='RF01-S32-connection-review.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
paint();root.RF32Link=Object.freeze({load,verify,close,reportMode,checkOriginal,report:()=>({registry:copy(R),session:copy(session),sourceCheck:copy(sourceCheck),display:copy(display)})});
})(globalThis);
