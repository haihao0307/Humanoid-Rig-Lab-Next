(function(){
'use strict';const $=id=>document.getElementById(id),R=FittingReview36,P=RealityProtocol,clone=x=>JSON.parse(JSON.stringify(x));
let record=RF36_DATA.records.find(r=>r.case==='progressive'),imported=false,index=0;
const element=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const message=(s,bad=false)=>{$('status').textContent=s;$('status').classList.toggle('error',bad);};
const object=()=>R.object(record,RF36_DATA.facts,RF36_DICTIONARY,imported);
const labels={COMMITTED:'完整提交',CANCELLED:'取消并恢复',FAILED_ROLLED_BACK:'失败并恢复',NATIVE_FAILED:'原门拒绝'};
function timeline(){const ns='http://www.w3.org/2000/svg',svg=$('timeline');svg.replaceChildren();const steps=record.result.steps,at=(s,v)=>[45+(s-1)/47*810,225-v/1.65*180];const p=(tag,attrs,text)=>{const n=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text)n.textContent=text;svg.append(n);return n;};
 const y=at(1,1.45)[1];p('path',{d:`M45,${y}H855`,stroke:'#e2b979','stroke-dasharray':'7 5',fill:'none'});p('text',{x:50,y:y-8,fill:'#e2b979','font-size':12},'原保护门 1.45');
 for(let k=0;k<2;k++){const color=k?'#aac8ed':'#9ce3c9',d=steps.map((s,i)=>(i?'L':'M')+at(s.step,s.maxActiveRatios[k]).join(',')).join(' ');p('path',{d,stroke:color,'stroke-width':2,fill:'none'});p('text',{x:700,y:245-k*18,fill:color,'font-size':12},k?'下装最大比':'上衣最大比');}
 if(steps[index]){const s=steps[index],x=at(s.step,0)[0];p('path',{d:`M${x},25V228`,stroke:'#e8f1ee',fill:'none'});for(let k=0;k<2;k++){const a=at(s.step,s.maxActiveRatios[k]);p('circle',{cx:a[0],cy:a[1],r:4,fill:k?'#aac8ed':'#9ce3c9'});}}
 p('text',{x:45,y:245,fill:'#a4bbc2','font-size':12},'1');p('text',{x:836,y:245,fill:'#a4bbc2','font-size':12},'48');
}
function render(){const r=record.result,o=object();$('mode').textContent=imported?'导入记录 · 未复验':'固定原生证据 · 非实时';$('case-title').textContent=R.NAMES[record.case];$('conclusion').textContent=(labels[r.status]||r.status)+'。'+(r.failure?.message||'所有适配步骤完成；动态接触仍须独立处理。');
 $('metrics').replaceChildren();for(const [v,t]of [[r.steps.length+'/48','实际通过原门的试算步骤'],[record.case==='baseline'?'—':String(r.committedRuntimeRevision),'提交后的本地revision'],[r.rollback?(r.independentRollback?.equal?'逐字节一致':'不一致'):'未发生','事务入口恢复'],['未认证','完整动态穿着']]){const e=element('div',undefined,'metric');e.append(element('strong',v),element('small',t));$('metrics').append(e);}
 $('cases').replaceChildren();for(const q of RF36_DATA.records){const t=document.createElement('tr');t.append(element('td',R.NAMES[q.case]),element('td',labels[q.result.status]),element('td',String(q.result.steps.length)+' / 48'),element('td',q.result.rollback?(q.result.independentRollback?.equal?'已核对一致':'未确认'):'不适用'));$('cases').append(t);}
 document.querySelectorAll('[data-case]').forEach(b=>b.classList.toggle('active',b.dataset.case===record.case));index=Math.min(index,Math.max(0,r.steps.length-1));$('step').max=Math.max(1,r.steps.length);$('step').value=index+1;
 const s=r.steps[index];$('step-info').textContent=s?'第 '+s.step+' 步；渐变比例 '+(s.fraction==null?'原版无统一渐变':(s.fraction*100).toFixed(3)+'%')+'；上衣 '+s.maxActiveRatios[0].toFixed(6)+'；下装 '+s.maxActiveRatios[1].toFixed(6):'没有成功通过原门的步骤。';timeline();
 $('checks').replaceChildren();for(const c of o.checks){const x=element('article',undefined,'check '+c.status);x.dataset.check=c.id;x.append(element('b',c.status),element('p',c.message));$('checks').append(x);}
 $('rollback').replaceChildren();if(r.snapshot){for(const [k,v]of [['快照容量',(r.snapshot.bytes/1048576).toFixed(2)+' MiB'],['数组组数',r.snapshot.arrayCount],['标量／引用项',r.snapshot.scalarCount],['被恢复范围','服装位置、速度、参考长度、人体起终点、腰部锚点、接触缓存、时钟与版本'],['恢复位置','整次适配开始前，而不只是最后一个成功步'],['本次原生耗时',(record.elapsedSeconds).toFixed(2)+' 秒（含准备，不是帧率）']])$('rollback').append(element('p',k+'：'+v));if(r.rollback)$('rollback').append(element('p','不同步路径：'+JSON.stringify(r.rollback.changedPaths)));}else $('rollback').append(element('p','原版对照不使用新事务，只保留原求解器自己的单步回滚。'));
 $('detail').textContent=JSON.stringify({source:record.source,moduleSHA256:record.moduleSHA256,nativeRun:record.nativeRun,nativeCodeCommit:record.codeCommit,rawReportSHA256:record.rawReportSHA256,result:r,sourceStatus:record.sourceStatus,previousDynamicContact:RF36_DATA.facts.previousContact,imported,fitCertified:false,productionInstalled:false},null,2);
}
function select(id){const x=RF36_DATA.records.find(x=>x.case===id);if(!x)throw Error('UNKNOWN_CASE');record=x;imported=false;index=0;render();message('查看 '+R.NAMES[id]+' 的真实冻结结果。');}
function importRecord(x){const r=x?.schema==='kaopu/fitting-review-export@1'?x.record:x;R.validate(r,RF36_DATA.facts);record=clone(r);imported=true;index=0;render();message('导入已检查格式与关系，但没有重新运行原台；来源保持未复验。');}
function download(name,value){const u=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
for(const b of document.querySelectorAll('[data-case]'))b.onclick=()=>select(b.dataset.case);
$('step').oninput=()=>{index=Number($('step').value)-1;render();};$('restore').onclick=()=>select(record.case);
$('export-case').onclick=()=>download('RF01-S36-case.json',{schema:'kaopu/fitting-review-export@1',record,imported,live:false});
$('export-common').onclick=()=>download('RF01-S36-common.json',P.aggregate([object()],RF36_DICTIONARY));$('export-defects').onclick=()=>download('RF01-S36-defects.json',P.defectBundle([object()],RF36_DICTIONARY));
$('import').onchange=async()=>{try{const f=$('import').files[0];if(!f)return;if(f.size>2000000)throw Error('IMPORT_TOO_LARGE');importRecord(JSON.parse(await f.text()));}catch(e){message(e.message,true);}};
$('previous').href=RF36_DATA.facts.previousURL;$('source-pr').href='https://github.com/haihao0307/guilin-dem-pipeline/pull/283';$('build').textContent='REALITY-HC-S3.6 · '+RF36_BUILD.sourceCommit+' · 同一协议 '+P.VERSION+' · 原生软件Chromium验证，非实体设备认证';
render();message('新事务代码与原生四条件已经分别核验。此页查看记录，不暗中启动原人物物理。');
window.__REALITY_S36__=Object.freeze({select,importRecord,report:()=>({sourceCommit:RF36_BUILD.sourceCommit,selected:record.case,imported,index,record:clone(record),common:object(),live:false,fitCertified:false,productionInstalled:false})});
})();
