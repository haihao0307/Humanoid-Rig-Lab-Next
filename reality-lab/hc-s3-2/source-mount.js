/* Runs in the installed native page, not in the standards platform. No message listener or write command. */
(function(){
'use strict';
const freeze=x=>{if(x&&typeof x==='object'){Object.freeze(x);Object.values(x).forEach(freeze);}return x;};
const copy=x=>JSON.parse(JSON.stringify(x)),core=freeze(copy(RF32_CORE));
if(!window.KAOPU_REALITY||window.KAOPU_REALITY.version!==core.adapterVersion)throw Error('SOURCE_ADAPTER_MISSING');
window.KAOPU_SOURCE_INSTALLATION=Object.freeze({info:()=>freeze(copy(core)),read:()=>window.KAOPU_REALITY.read(),version:'1'});
const details=document.createElement('details');details.id='reality-source-installation';details.style.cssText='margin-top:16px;border-top:1px solid #334252;padding-top:8px';
const summary=document.createElement('summary');summary.textContent='世界规范接口 · 源端试装（未合并）';details.append(summary);
const note=document.createElement('p');note.className='note';note.textContent='这份固定源入口已安装只读接口。原工作分支未被覆盖；无物性认证，无参数写回。';details.append(note);
const button=document.createElement('button');button.id='reality-source-export';button.textContent='导出当前原生规范清单';details.append(button);
const result=document.createElement('p');result.id='reality-source-result';result.className='note';details.append(result);
button.onclick=async()=>{button.disabled=true;try{await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const native=window.KAOPU_REALITY.read();const blob=new Blob([JSON.stringify({schema:'kaopu/reality-source-receipt@1',installation:core,native},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='DENIM-R17-source-reality.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);result.textContent='已读取当前源实例；生产安装状态仍为未合并。';}catch(e){result.textContent='未导出：'+e.message;}finally{button.disabled=false;}};
document.querySelector('aside').append(details);
})();
