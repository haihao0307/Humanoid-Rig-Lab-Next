(function(){
'use strict';
const B=RealityBridge31,P=RealityProtocol,$=id=>document.getElementById(id),D=B.dictionary(RF31_DICTIONARY,RF31_HISTORY);
const history=RF31_HISTORY.objects.map(o=>B.historyObject(o,D));
let current=history[0],packet=null,lastLive=null,previous=null,frame=null,ready=false,generation=0,selected='denim-live',pending=false;
const events=[];function log(type,detail){events.push({type,detail,at:new Date().toISOString()});if(events.length>40)events.shift();}
const text=(tag,value,cls)=>{const el=document.createElement(tag);if(value!==undefined)el.textContent=value;if(cls)el.className=cls;return el;};
const fmt=m=>m.value==null?'未确认':m.unit==='m'?(m.value*1000).toFixed(5)+' mm':String(m.value)+' '+m.unit;
function status(message,error=false){$('status').textContent=message;$('status').classList.toggle('error',error);}
function render(){
 $('mode').textContent=current.sourceMode==='live_read_only'?'本会话原生实时读取':current.sourceMode==='imported_unverified'?'导入报告 · 未实时复验':'S3 历史快照 · 非实时';
 $('object').textContent=current.name;const counts=$('counts');counts.replaceChildren();for(const s of P.STATUSES){const card=text('div',undefined,'count '+s);card.append(text('b',String(current.counts[s])),text('small',({PASS:'已核对',FAIL:'冲突',WARNING:'风险',UNKNOWN:'未确认',NOT_APPLICABLE:'不适用'})[s]));counts.append(card);}
 const body=$('measurements');body.replaceChildren();for(const m of current.measurements){const tr=document.createElement('tr');tr.append(text('td',m.label),text('td',fmt(m)),text('td',m.status,m.status),text('td',m.method));body.append(tr);}
 const issues=$('issues');issues.replaceChildren();for(const c of current.checks.filter(c=>!$('missing-only').checked||c.status==='UNKNOWN'||c.status==='FAIL'||c.status==='WARNING')){const row=text('article',undefined,'issue '+c.status);row.append(text('code',c.id),text('b',c.status),text('p',c.message));issues.append(row);}
 $('source').textContent=JSON.stringify({schema:current.schema,sourceMode:current.sourceMode,source:current.source,capturedAt:current.extensions.capturedAt||null,unsupported:current.extensions.unsupportedOriginalMeasurements,physicalCertification:false,productionReady:false},null,2);
 $('export-native').disabled=!packet;$('restore-live').disabled=!lastLive;
 $('changes').replaceChildren();if(previous&&packet){const rows=B.diff(previous,packet);for(const r of rows)$('changes').append(text('p',r.id+'：'+String(r.before)+' → '+String(r.after)+' '+r.unit));if(!rows.length)$('changes').append(text('p','相邻两次读取的量纲数值一致。'));}else $('changes').append(text('p','在原版控件中调整织纹或针脚，再读取；这里比较两次实际清单。'));
 if(packet?.preservation&&current.sourceMode==='live_read_only')$('preservation').textContent='读取前后受检状态/几何/着色器一致；本次读取 '+packet.capture.elapsedMs.toFixed(2)+' ms（此设备）';else $('preservation').textContent='历史或导入报告不是本次原台不变性证据。';
 $('caption').textContent=current.sourceMode==='live_read_only'?'画面来自原生 R17.2，规范数据由新只读接口读取。':'下方表格当前不是原台实时读数；原生画面与报告模式分别标明。';
}
function closeNative(){generation++;ready=false;frame?.remove();frame=null;$('host').replaceChildren();$('read').disabled=true;$('close').disabled=true;}
async function loadNative(){
 closeNative();selected='denim-live';const token=generation;status('载入封装的原版 R17.2；不联网下载模型。');frame=document.createElement('iframe');frame.id='native';frame.title='原生牛仔 R17.2 + 只读规范接口';frame.srcdoc=new TextDecoder().decode(Uint8Array.from(atob(RF31_NATIVE_B64),c=>c.charCodeAt(0)));$('host').replaceChildren(frame);$('close').disabled=false;
 const start=performance.now();while(token===generation){if(frame.contentWindow.KAOPU_REALITY&&frame.contentWindow.DENIM_R17?.state.ready)break;if(performance.now()-start>45000)throw Error('原生出画超时；未回退为假对象');await new Promise(r=>setTimeout(r,100));}if(token!==generation)return;
 ready=true;$('read').disabled=false;const doc=frame.contentDocument;
 const schedule=()=>{if(!$('auto').checked||pending)return;pending=true;const g=generation;frame.contentWindow.requestAnimationFrame(()=>frame?.contentWindow.requestAnimationFrame(()=>{pending=false;if(g===generation&&selected==='denim-live')safe(read)();}));};
 doc.addEventListener('input',schedule);doc.addEventListener('change',schedule);
 await new Promise(r=>frame.contentWindow.requestAnimationFrame(()=>frame.contentWindow.requestAnimationFrame(r)));
 read();status('原生已出画；可操作原有织纹/针脚控件，规范清单按实际上传值更新。');log('native-loaded',RF31_BUILD.native.source);
}
function read(){
 if(!ready||!frame)throw Error('原生工作台尚未就绪');
 const next=frame.contentWindow.KAOPU_REALITY.read();
 const candidate=B.live(next,D,RF31_BUILD.native.source,false);
 previous=lastLive;packet=next;lastLive=next;current=candidate;selected='denim-live';render();log('capture',{sequence:next.capture.sequence,shaderInputs:next.shaderInputs});return next;
}
function importPacket(input){
 const x=input?.schema==='kaopu/reality-review-bundle@1'?input.native:input;
 const candidate=B.live(x,D,RF31_BUILD.native.source,true);
 // Commit only after validation, preserving current valid report on any failure.
 previous=null;packet=JSON.parse(JSON.stringify(x));current=candidate;selected='imported';render();status('导入成功，但未重新实测；本地文件不会被标记为当前实时观察。');log('imported',{capturedAt:x.capture.capturedAt});
}
function selectHistory(id){const h=history.find(o=>o.objectId===id);if(!h)throw Error('未登记对象');current=h;packet=null;selected=id;previous=null;render();status('显示S3固定证据。针织/皮革尚未安装本轮实时接口。');}
function safe(fn){return async()=>{try{return await fn();}catch(e){status(e.message||String(e),true);log('handled-error',e.message||String(e));}};}
function download(name,value){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
for(const o of history){const b=text('button',o.name);b.dataset.history=o.objectId;b.onclick=safe(()=>selectHistory(o.objectId));$('history-nav').append(b);}
$('load').onclick=safe(loadNative);$('read').onclick=safe(read);$('close').onclick=()=>{closeNative();pending=false;status('原生副本已关闭；清单是保留的观察结果，不是持续监控。');if(current.sourceMode==='live_read_only'){current=JSON.parse(JSON.stringify(current));current.sourceMode='imported_unverified';current.extensions.viewingNote='native instance closed; retained local observation';render();}};
$('restore-live').onclick=safe(()=>{if(!ready)throw Error('原生副本已关闭；请重新加载后读取');read();});
$('missing-only').onchange=render;
$('export-native').onclick=()=>download('RF01-S3.1-native-export.json',packet);
$('export-common').onclick=()=>download('RF01-S3.1-common-object.json',P.aggregate([current],D));
$('export-review').onclick=()=>download('RF01-S3.1-review.json',{schema:'kaopu/reality-review-bundle@1',native:packet,common:P.aggregate([current],D),build:RF31_BUILD.sourceCommit});
$('export-defects').onclick=()=>download('RF01-S3.1-defects.json',P.defectBundle([current],D));
$('file').onchange=safe(async()=>{const f=$('file').files[0];if(!f)return;if(f.size>B.MAX_BYTES)throw Error('文件超过1 MiB');importPacket(B.parse(await f.text()));});
$('bad-unit').onclick=()=>{if(!lastLive){status('请先读取原生清单',true);return;}const bad=JSON.parse(JSON.stringify(lastLive));bad.measurements[0].unit='tex';try{importPacket(bad);status('错误：反例未被拒绝',true);}catch(e){status('错误单位已原子拒绝；当前有效清单未变：'+e.message);log('negative-unit-rejected',true);}};
$('build').textContent='S3.1-A · '+RF31_BUILD.sourceCommit.slice(0,12)+' · 原S2.1协议 '+P.VERSION;
render();status('规范页面已就绪。只有点击“加载原生牛仔”才启动原三维工作台；核心与该原生副本均自包含。');
window.__REALITY_S31__={version:'REALITY-HC-S3.1-A',loadNative,read,importPacket,selectHistory,report:()=>({sourceCommit:RF31_BUILD.sourceCommit,selected,nativeReady:ready,iframeCount:document.querySelectorAll('#host iframe').length,common:JSON.parse(JSON.stringify(current)),native:packet?JSON.parse(JSON.stringify(packet)):null,historicalCount:history.length,history:JSON.parse(JSON.stringify(history)),events:JSON.parse(JSON.stringify(events)),productionSourceChanged:false,productionExporterInstalled:false,privateKeyIncluded:false,physicalCertification:false})};
})();
