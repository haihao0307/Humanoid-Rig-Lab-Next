(function(){
'use strict';
const C=GarmentRelations33,P=RealityProtocol,D=C.dictionary(RF33_DICTIONARY),$=id=>document.getElementById('rf33-'+id),copy=x=>JSON.parse(JSON.stringify(x));
let observation=copy(RF33_OBSERVATION),bundle=C.inspect(observation,RF33_FACTS,D),role='top',panelId=null,mode='captured',legacyGeneration=0;
const events=[];const log=(type,detail)=>{events.push({type,detail,at:new Date().toISOString()});if(events.length>30)events.shift();};
const node=(tag,t,cls)=>{const n=document.createElement(tag);if(t!==undefined)n.textContent=t;if(cls)n.className=cls;return n;};
const outcomeBox=node('div',undefined,'notice');outcomeBox.id='rf33-outcome';$('captured').after(outcomeBox);
function status(t,error=false){$('status').textContent=t;$('status').classList.toggle('error',error);}
function selected(){return {raw:observation.pieces.find(x=>x.role===role),common:bundle.objects.find(x=>x.objectId==='garment-r10-d03-'+role)};}
function renderOutline(panel){
 const svg=$('outline'),ns='http://www.w3.org/2000/svg';svg.replaceChildren();const points=panel.boundaryMm.flat();if(!points.length)return;
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys),s=Math.min(330/Math.max(1,xmax-xmin),245/Math.max(1,ymax-ymin));
 const at=([x,y])=>[45+(x-xmin)*s,290-(y-ymin)*s];
 const shape=document.createElementNS(ns,'path');shape.setAttribute('class','outline-shape');shape.setAttribute('d',panel.boundaryMm.map(e=>{const a=at(e[0]),b=at(e[1]);return 'M'+a.join(',')+'L'+b.join(',');}).join(' '));svg.append(shape);
 const center=[350,90],[a,b,c,d]=panel.appearanceAxes;
 for(const [name,dx,dy,cls]of [['U',a,b,'axis-u'],['V',c,d,'axis-v']]){const end=[center[0]+dx*50,center[1]-dy*50],line=document.createElementNS(ns,'path');line.setAttribute('class',cls);line.setAttribute('fill','none');line.setAttribute('stroke-width','2');const vx=end[0]-center[0],vy=end[1]-center[1],len=Math.hypot(vx,vy)||1,nx=vx/len,ny=vy/len;line.setAttribute('d','M'+center+'L'+end+' M'+[end[0]-nx*9-ny*4,end[1]-ny*9+nx*4]+'L'+end+'L'+[end[0]-nx*9+ny*4,end[1]-ny*9-nx*4]);svg.append(line);const t=document.createElementNS(ns,'text');t.textContent=name+'+';t.setAttribute('x',end[0]+4);t.setAttribute('y',end[1]-5);t.setAttribute('class',cls);t.setAttribute('font-size','13');svg.append(t);}
 const label=document.createElementNS(ns,'text');label.textContent=panel.id+' · 原裁片坐标 mm';label.setAttribute('x','18');label.setAttribute('y','330');label.setAttribute('fill','#acbec4');label.setAttribute('font-size','12');svg.append(label);
 $('axis-facts').replaceChildren();const table=document.createElement('table');for(const [k,v]of [['纸样坐标','毫米'],['准备网格的显示坐标','米'],['源显示变换',JSON.stringify(panel.appearanceAxes)+' × 0.001'],['全部顶点UV核对最大误差',(panel.maxUVErrorM*1000).toExponential(3)+' mm'],['物理各向异性方向',panel.physicsGrain==null?'未确认':'有原字段，但与显示方向关系未确认'],['制造丝缕证据','未确认']]){const tr=document.createElement('tr');tr.append(node('th',k),node('td',v));table.append(tr);}$('axis-facts').append(table);
}
function render(){
 const {raw,common}=selected();$('title').textContent=common.name+' · '+raw.materialID;
 $('mode').textContent=mode==='captured'?'试穿前冻结捕获 · 非实时':mode==='scenario'?'人工反例 · 不写回':'外部导入 · 未复验';$('scenario-note').hidden=mode!=='scenario';
 $('captured').textContent='捕获时间 '+observation.capture.capturedAt+' ｜ 原请求 '+observation.capture.requestGeneration+' ｜ 源提交 '+observation.source.commit.slice(0,12)+' ｜ 阶段：原生裁片已准备，尚未完成试穿';
 const outcome=observation.sourceOutcome;outcomeBox.textContent=(mode==='imported'?'外部文件声称的原台结果（未复验）：':'本次原台运行结果：')+outcome.statusText+'；已提交成衣数 '+outcome.committedGarmentCount+'。本页不能把试穿前绑定检查通过当作试穿成功。';outcomeBox.classList.toggle('error',outcome.error);
 $('counts').replaceChildren();for(const k of P.STATUSES){const div=node('div',undefined,'count '+k);div.append(node('b',common.counts[k]),node('small',({PASS:'已核对',FAIL:'冲突/失败',WARNING:'风险',UNKNOWN:'未确认',NOT_APPLICABLE:'不适用'})[k]));$('counts').append(div);}
 document.querySelectorAll('[data-role]').forEach(b=>b.classList.toggle('active',b.dataset.role===role));
 $('links').replaceChildren();for(const [title,value,detail]of [
  ['原纸样 → 准备的成衣',raw.presetId,'保留源模板与新人物分级记录；材料网格摘要不是面料外观版本。'],
  ['准备采用的面料供体',raw.material.runtimeDonor||'未确认','这是原台准备的材料来源；独立规范台版本不自动替换它。'],
  ['当前人物源码',observation.person.sourceRevision||'未确认','人物身份摘要逐项核对；明确比例版本：'+(raw.explicitProportionRevision??'未确认')]
 ]){const div=node('article',undefined,'relation');div.append(node('b',title),node('code',value),node('p',detail));$('links').append(div);}
 const select=$('panel');select.replaceChildren();for(const p of raw.panels){const o=node('option',p.id);o.value=p.id;select.append(o);}if(!raw.panels.some(p=>p.id===panelId))panelId=raw.panels[0].id;select.value=panelId;renderOutline(raw.panels.find(p=>p.id===panelId));
 $('checks').replaceChildren();for(const c of common.checks){if($('missing').checked&&!['FAIL','WARNING','UNKNOWN'].includes(c.status))continue;const r=node('article',undefined,'check '+c.status);r.dataset.check=c.id;r.append(node('code',c.id),node('b',c.status),node('p',c.message));if(c.status==='FAIL')r.append(node('small','期望 '+JSON.stringify(c.expected)+'；观察 '+JSON.stringify(c.observed)));$('checks').append(r);}
 $('details').textContent=JSON.stringify({source:observation.source,capture:observation.capture,sourceOutcome:observation.sourceOutcome,sourceTemplateBinding:raw.sourceTemplateBinding,currentBinding:raw.binding,computedMaterialMeshSHA256:raw.computedMaterialMeshSHA256,appearanceMaterial:raw.material,effectiveMaterialSHA256:raw.effectiveMaterialSHA256,person:observation.person,acceptance:raw.acceptance,upstreamFullGarmentAccepted:RF33_FACTS.manifest.fullGarmentAccepted,mode,live:false,productionInstalled:false,fitCertified:false},null,2);
}
function use(next,nextMode){const candidate=C.inspect(next,RF33_FACTS,D,{imported:nextMode==='imported',scenario:nextMode==='scenario'});observation=copy(next);bundle=candidate;mode=nextMode;render();log('report-selected',nextMode);}
function importObservation(input){const x=input?.schema==='kaopu/garment-relations-review@1'?input.observation:input;use(x,'imported');status('导入已重算，仍是外部声明；没有升级为实时证据、成功试穿或生产安装。');}
function scenario(kind){const x=copy(RF33_OBSERVATION),g=x.pieces.find(p=>p.role===role);if(kind==='person')g.binding.person.stateSHA256='0'.repeat(64);else if(kind==='axis')g.panels[0].appearanceAxes=[0,-1,1,0].every((v,i)=>v===g.panels[0].appearanceAxes[i])?[1,0,0,1]:[0,-1,1,0];else throw Error('UNKNOWN_SCENARIO');panelId=g.panels[0].id;use(x,'scenario');status('当前为人工'+(kind==='person'?'人物身份':'显示方向')+'冲突反例；原捕获和原工作台都未修改。');}
function download(name,data){const u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
function safe(fn){return async()=>{try{return await fn();}catch(e){status(e.message||String(e),true);log('handled-error',e.message||String(e));}};}
async function openLegacy(){const ticket=++legacyGeneration;$('legacy-open').disabled=true;status('正在打开已验证的原材料规范入口。');try{
 const packed=RF33_LEGACY,bytes=Uint8Array.from(atob(packed.data),c=>c.charCodeAt(0)),reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader(),parts=[];let length=0;for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>packed.bytes){await reader.cancel();throw Error('LEGACY_SIZE_MISMATCH');}parts.push(value);}if(length!==packed.bytes)throw Error('LEGACY_SIZE_MISMATCH');const raw=new Uint8Array(length);let offset=0;for(const p of parts){raw.set(p,offset);offset+=p.length;}const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),v=>v.toString(16).padStart(2,'0')).join('');if(digest!==packed.sha256)throw Error('LEGACY_HASH_MISMATCH');if(ticket!==legacyGeneration)return;
 const f=document.createElement('iframe');f.id='rf33-legacy-frame';f.title='原S3.2三材料规范入口';f.srcdoc=new TextDecoder().decode(raw);$('legacy-host').replaceChildren(f);$('inspector').hidden=true;$('legacy').hidden=false;$('legacy-close').disabled=false;status('原S3.2已加载；成衣关系仍是试穿前冻结观察。');log('legacy-loaded',digest);
 }finally{if(ticket===legacyGeneration)$('legacy-open').disabled=false;}}
function closeLegacy(){legacyGeneration++;$('legacy-host').replaceChildren();$('legacy').hidden=true;$('inspector').hidden=false;$('legacy-open').disabled=false;$('legacy-close').disabled=true;}
for(const b of document.querySelectorAll('[data-role]'))b.onclick=()=>{closeLegacy();role=b.dataset.role;panelId=null;render();};
$('panel').onchange=()=>{panelId=$('panel').value;render();};$('missing').onchange=render;
$('restore').onclick=()=>{use(RF33_OBSERVATION,'captured');status('已恢复真实试穿前捕获与原台运行结果；没有改变原台。');};
$('export').onclick=()=>download('RF01-S33-common.json',{...bundle,reviewContext:{mode,live:false,stage:'prepared_before_physics',capturedAt:observation.capture.capturedAt,scenario:mode==='scenario'}});
$('export-observation').onclick=()=>download('RF01-S33-observation.json',{schema:'kaopu/garment-relations-review@1',observation,reviewContext:{mode,live:false,scenario:mode==='scenario',build:RF33_BUILD.sourceCommit}});
$('export-defects').onclick=()=>download('RF01-S33-defects.json',{...P.defectBundle(bundle.objects,D),reviewContext:{mode,live:false,scenario:mode==='scenario'}});
$('file').onchange=safe(async()=>{const f=$('file').files[0];if(!f)return;if(f.size>2000000)throw Error('IMPORT_TOO_LARGE');importObservation(C.parse(await f.text()));});
$('bad-person').onclick=()=>scenario('person');$('bad-axis').onclick=()=>scenario('axis');$('bad-source').onclick=()=>{const x=copy(observation);x.source.commit='0'.repeat(40);try{importObservation(x);status('错误来源没有被拒绝',true);}catch(e){status('错误来源已原子拒绝，当前有效报告保留：'+e.message);log('negative-source-rejected',true);}};
$('legacy-open').onclick=safe(openLegacy);$('legacy-close').onclick=closeLegacy;$('back').onclick=closeLegacy;$('original').href=RF33_FACTS.originalURL;$('build').textContent='REALITY-HC-S3.3-A · '+RF33_BUILD.sourceCommit.slice(0,12)+' · 共用对象协议 '+P.VERSION;
render();status('D03试穿前绑定已捕获。材料、人物与裁片关系分别检查；原台试穿失败不会被绿色来源检查掩盖。');
window.__REALITY_S33__=Object.freeze({importObservation,scenario,restore:()=>use(RF33_OBSERVATION,'captured'),closeLegacy,openLegacy,report:()=>({sourceCommit:RF33_BUILD.sourceCommit,mode,role,panelId,observation:copy(observation),bundle:copy(bundle),legacyFrames:document.querySelectorAll('#rf33-legacy-frame').length,events:copy(events),live:false,sourceWriteAPI:false,originalProductionSourceModified:false,diagnosticObserverAdded:true,renderingPhysicsCodeChanged:false})});
})();
