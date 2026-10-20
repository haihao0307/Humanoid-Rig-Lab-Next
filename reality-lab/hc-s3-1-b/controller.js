(function(){
'use strict';
const K=RealityKnitBridge,P=RealityProtocol,$=id=>document.getElementById(id),D=K.dictionary(RF31_DICTIONARY,RF31_HISTORY);
const histories=RF31_HISTORY.objects.map(o=>K.historyObject(o,D));
const names={knit:'毛衣 P02 C2',denim:'牛仔 R17.2'},events=[],last={};
let current=null,packet=null,previous=null,frame=null,family=null,generation=0,ready=false,following=false,timer=null,busy=false;
const copy=x=>JSON.parse(JSON.stringify(x));
const node=(tag,value,cls)=>{const n=document.createElement(tag);if(value!==undefined)n.textContent=value;if(cls)n.className=cls;return n;};
function log(type,detail){events.push({type,detail,at:new Date().toISOString()});if(events.length>40)events.shift();}
function message(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}
function fmt(m){return m.value==null?'未确认':m.unit==='m'?(m.value*1000).toFixed(5)+' mm':String(m.value)+(m.unit==='1'?'':' '+m.unit);}
function render(){
 const mode=current?.sourceMode,label=mode==='live_read_only'?'本次原生读取':mode==='imported_unverified'?'外部导入 · 未实时复验':current?.extensions.retainedCapture?'本地保留读数 · 非持续实时':current?'S3 历史 · 非实时':'请选择原生工作台';
 $('mode').textContent=label;$('object').textContent=current?.name||'毛衣与牛仔 · 共用规范检查';
 $('counts').replaceChildren();for(const s of P.STATUSES){const n=node('div',undefined,'count '+s);n.append(node('b',current?String(current.counts[s]):'—'),node('small',({PASS:'已核对',FAIL:'冲突',WARNING:'风险',UNKNOWN:'未确认',NOT_APPLICABLE:'不适用'})[s]));$('counts').append(n);}
 $('measurements').replaceChildren();for(const m of current?.measurements||[]){const tr=document.createElement('tr');tr.append(node('td',m.label),node('td',fmt(m)),node('td',m.status,m.status),node('td',m.method));$('measurements').append(tr);}
 $('issues').replaceChildren();for(const c of current?.checks||[]){if($('missing-only').checked&&!['WARNING','UNKNOWN','FAIL'].includes(c.status))continue;const r=node('article',undefined,'issue '+c.status);r.append(node('code',c.id),node('b',c.status),node('p',c.message));$('issues').append(r);}
 $('source').textContent=current?JSON.stringify({schema:current.schema,sourceMode:mode,source:current.source,capturedAt:current.extensions.capturedAt||null,retainedCapture:!!current.extensions.retainedCapture,unsupported:current.extensions.unsupportedOriginalMeasurements,physicalCertification:false,productionReady:false},null,2):'尚未读取；不会从旧R15猜测P02当前数值。';
 for(const id of ['export-native','export-review'])$(id).disabled=!packet;for(const id of ['export-common','export-defects'])$(id).disabled=!current;
 $('read').disabled=!ready;$('read-deep').disabled=!ready||family!=='knit';$('restore-live').disabled=!ready;$('close').disabled=!frame;
 $('caption').textContent=frame?'当前画面：'+names[family]+'保留的原生程序。表格是否跟随，以模式标签和捕获时间为准。':'没有活动三维引擎；选择一个原生工作台才启动。';
 $('preservation').textContent=packet?.preservation&&mode==='live_read_only'?'本次读取 '+packet.capture.elapsedMs.toFixed(2)+' ms；保护范围：'+(packet.capture.integrityMode||'原牛仔完整诊断')+'。不等同实物认证。':'历史或导入资料不是本次原生运行的保护证明。';
 $('changes').replaceChildren();if(previous&&packet&&previous.objectId===packet.objectId){const ds=K.diff(previous,packet);for(const r of ds)$('changes').append(node('p',r.id+'：'+r.before+' → '+r.after+' '+r.unit));const a=previous.requested||previous.nativeControls,b=packet.requested||packet.nativeControls;for(const k of Object.keys(b||{}))if(a?.[k]!==b[k])$('changes').append(node('p','原生控制 '+k+'：'+a?.[k]+' → '+b[k]));if(!$('changes').children.length)$('changes').append(node('p','当前观测量与上次一致。'));}else $('changes').append(node('p','操作原生控制后，可比较同一对象的两次实际读数。不同对象不会混算差异。'));
}
function retain(){if(current?.sourceMode==='live_read_only'){current=copy(current);current.sourceMode='fixed_snapshot';current.extensions.retainedCapture=true;current.extensions.viewingNote='native instance is no longer followed';}}
function stop(){generation++;clearTimeout(timer);timer=null;ready=false;following=false;busy=false;frame?.remove();frame=null;family=null;retain();$('host').replaceChildren();render();}
async function capture(full=false){
 if(!ready||!frame)throw Error('NATIVE_NOT_READY');const f=frame,g=generation,kind=family;
 for(let i=0;i<100;i++){
  if(g!==generation||f!==frame)return null;
  try{const result=kind==='knit'?f.contentWindow.KAOPU_REALITY.read({fullIntegrity:full}):f.contentWindow.KAOPU_REALITY.read();const candidate=K.normalize(result,D,RF31B_BUILD.sources,false);previous=last[kind]||null;last[kind]=result;packet=result;current=candidate;following=true;render();log('capture',{family:kind,sequence:result.capture.sequence,elapsedMs:result.capture.elapsedMs});return result;}
  catch(e){if(!['NATIVE_FRAME_PENDING','NATIVE_NOT_READY','NATIVE_PROGRAM_NOT_READY'].some(t=>String(e.message).includes(t)))throw e;await new Promise(r=>setTimeout(r,40));}
 }
 throw Error('NATIVE_SETTLE_TIMEOUT');
}
function handle(fn){return async()=>{try{return await fn();}catch(e){message(e.message||String(e),true);log('handled-error',String(e.message||e));}};}
async function loadNative(kind){
 if(!['knit','denim'].includes(kind))throw Error('UNSUPPORTED_NATIVE');stop();family=kind;const g=generation;
 const f=document.createElement('iframe');frame=f;f.id='native';f.title=names[kind]+'原生只读规范副本';f.srcdoc=new TextDecoder().decode(Uint8Array.from(atob(RF31B_NATIVES[kind]),c=>c.charCodeAt(0)));$('host').replaceChildren(f);render();message('正在启动'+names[kind]+'原生副本；不重新生成替身。');
 for(let i=0;i<1200;i++){if(g!==generation||frame!==f)return;if(f.contentWindow.KAOPU_REALITY){ready=true;break;}await new Promise(r=>setTimeout(r,50));}
 if(!ready)throw Error('NATIVE_LOAD_TIMEOUT');
 const schedule=()=>{if(!$('auto').checked||!following||g!==generation)return;clearTimeout(timer);timer=setTimeout(()=>{if(g!==generation||busy)return;busy=true;handle(()=>capture(false))().finally(()=>{if(g===generation)busy=false;});},100);};
 for(const type of ['input','change','click','pointerup','wheel'])f.contentDocument.addEventListener(type,schedule,{passive:true});
 await capture(false);if(g===generation){message(names[kind]+'已读取。原生控件、按钮和拖动结束后可自动更新；深度校验另行手动触发。');log('native-loaded',kind);}
}
function importPacket(value){const x=value?.schema==='kaopu/reality-review-bundle@1'?value.native:value;const candidate=K.normalize(x,D,RF31B_BUILD.sources,true);clearTimeout(timer);following=false;previous=null;packet=copy(x);current=candidate;render();message('导入成功，仅为未复验文件；不会写回源工作台或自动成为实时证据。');log('imported',{family:x.family,capturedAt:x.capture.capturedAt});}
function selectHistory(id){const o=histories.find(x=>x.objectId===id);if(!o)throw Error('HISTORY_NOT_FOUND');stop();current=o;packet=null;previous=null;render();message('历史对象，不是P02当前读数。已关闭原生引擎，避免后台重复计算。');}
function download(name,data){const u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
for(const o of histories){const b=node('button',o.name+(o.objectId.includes('knit')?'（独立旧源）':''));b.dataset.history=o.objectId;b.onclick=handle(()=>selectHistory(o.objectId));$('history-nav').append(b);}
$('load').onclick=handle(()=>loadNative('denim'));$('load-knit').onclick=handle(()=>loadNative('knit'));$('read').onclick=handle(()=>capture(false));$('read-deep').onclick=handle(()=>capture(true));$('restore-live').onclick=handle(()=>capture(false));$('close').onclick=()=>{stop();message('原生副本已关闭；已有读数降为保留历史，不再标为实时。');};$('missing-only').onchange=render;
$('export-native').onclick=()=>download('RF01-S31B-'+packet.family+'-native.json',packet);$('export-common').onclick=()=>download('RF01-S31B-common.json',P.aggregate([current],D));$('export-review').onclick=()=>download('RF01-S31B-review.json',{schema:'kaopu/reality-review-bundle@1',native:packet,common:P.aggregate([current],D),build:RF31B_BUILD.sourceCommit});$('export-defects').onclick=()=>download('RF01-S31B-defects.json',P.defectBundle([current],D));
$('file').onchange=handle(async()=>{const f=$('file').files[0];if(!f)return;if(f.size>K.MAX_BYTES)throw Error('INPUT_TOO_LARGE');importPacket(K.parse(await f.text()));});
$('bad-unit').onclick=()=>{if(!packet){message('请先读取原生清单',true);return;}const bad=copy(packet),m=bad.measurements.find(m=>m.unit==='m');m.unit='tex';try{importPacket(bad);message('反例没有被拦截',true);}catch(e){message('错误单位已拒绝，当前有效报告不变：'+e.message);log('negative-unit-rejected',true);}};
$('build').textContent='S3.1-B · '+RF31B_BUILD.sourceCommit.slice(0,12)+' · 共用协议 '+P.VERSION;
render();message('保留版毛衣P02 C2与牛仔可在同一入口按需读取；R15、皮革等旧证据仍单列。');
window.__REALITY_S31B__=Object.freeze({version:'REALITY-HC-S3.1-B',loadNative,capture,importPacket,selectHistory,close:stop,report:()=>({sourceCommit:RF31B_BUILD.sourceCommit,nativeReady:ready,family,following,iframeCount:document.querySelectorAll('#host iframe').length,common:current?copy(current):null,native:packet?copy(packet):null,history:copy(histories),events:copy(events),productionSourceChanged:false,productionExporterInstalled:false,knitBaseline:'P02-C2',clothPhysicsAdded:false})});
})();
