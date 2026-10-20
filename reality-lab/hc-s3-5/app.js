(async function(){
'use strict';
const E=MetricContact35,P=RealityProtocol,$=id=>document.getElementById(id),copy=x=>JSON.parse(JSON.stringify(x));let original,data,objects,mode='captured',selected='baseline',step=0;
const node=(tag,t,cls)=>{const n=document.createElement(tag);if(t!==undefined)n.textContent=t;if(cls)n.className=cls;return n;};const fmt=(x,n=4)=>Number.isFinite(x)?x.toFixed(n):'未确认';
function status(t,error=false){$('status').textContent=t;$('status').classList.toggle('error',error);}
function common(){return objects.objects.find(o=>o.objectId==='rf01-s35-'+selected);}
function current(){return data.cases.find(c=>c.case===selected);}
function makeTable(target,rows){target.replaceChildren();const table=document.createElement('table');for(const [k,v]of rows){const tr=document.createElement('tr');tr.append(node('th',k),node('td',v));table.append(tr);}target.append(table);}
function draw(c){
 const p=c.probe,field=$('denominator').value,svg=$('timeline'),NS='http://www.w3.org/2000/svg';svg.replaceChildren();
 const values=data.cases.flatMap(c=>c.probe.gates.map(g=>g.focus[field])),lo=Math.min(.85,...values)-.04,hi=Math.max(1.65,...values)+.06,maxStep=Math.max(...data.cases.map(c=>c.probe.gates.length));
 const X=i=>58+(i/Math.max(1,maxStep-1))*810,Y=v=>265-(v-lo)/(hi-lo)*230;
 const el=(tag,attrs)=>{const n=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,String(v));svg.append(n);return n;};
 for(let i=0;i<=4;i++){const v=lo+(hi-lo)*i/4;el('line',{x1:58,x2:868,y1:Y(v),y2:Y(v),stroke:'#324a54','stroke-width':1});el('text',{x:9,y:Y(v)+4,fill:'#afc1c8','font-size':12}).textContent=v.toFixed(2);}
 el('line',{x1:58,x2:868,y1:Y(1.45),y2:Y(1.45),stroke:'#f3a3a0','stroke-width':1.5,'stroke-dasharray':'6 5'});el('text',{x:795,y:Y(1.45)-6,fill:'#f3a3a0','font-size':12}).textContent='原门 1.45';
 el('polyline',{id:'case-line',points:p.gates.map((g,i)=>X(i)+','+Y(g.focus[field])).join(' '),fill:'none',stroke:'#91dfbd','stroke-width':2.5});
 const g=p.gates[step];el('line',{x1:X(step),x2:X(step),y1:30,y2:270,stroke:'#edc484','stroke-width':1});el('circle',{cx:X(step),cy:Y(g.focus[field]),r:5,fill:'#edc484'});
 el('text',{x:58,y:296,fill:'#afc1c8','font-size':12}).textContent='适配步 1';el('text',{x:790,y:296,fill:'#afc1c8','font-size':12}).textContent='共同轴 '+maxStep;
}
function render(){
 const c=current(),r=E.row(c),p=c.probe;step=Math.min(step,p.gates.length-1);$('mode').textContent=mode==='imported'?'外部文件 · 未重新运行':'冻结原生试验 · 非实时';$('title').textContent=r.name;
 document.querySelectorAll('[data-case]').forEach(b=>b.classList.toggle('active',b.dataset.case===selected));$('comparison').replaceChildren();
 for(const c of data.cases){const r=E.row(c),tr=document.createElement('tr');tr.dataset.result=c.case;tr.append(node('td',r.name),node('td',r.initializationAccepted?'初始化完成；动态未认证':'初始化失败，第'+r.failedStep+'步',r.initializationAccepted?'WARNING':'FAIL'),node('td',r.completedSteps+' / 48'),node('td',fmt(r.lastTopActiveRatio)+' / '+fmt(r.lastTopSourceRatio)),node('td',fmt(r.maxPreviousMismatchMm,3)+' mm'));$('comparison').append(tr);}
 $('kpis').replaceChildren();for(const [v,l]of [[r.completedSteps+'/48','原门已通过适配步'],[fmt(r.focusLengthMm,3)+' mm','末次原3289边长度'],[fmt(r.focusActiveRatio),'末次本条件实际比值'],[fmt(r.maxPreviousMismatchMm,3)+' mm','人体插值起点最大差异']]){const d=node('div',undefined,'kpi');d.append(node('b',v),node('small',l));$('kpis').append(d);}
 $('step-slider').max=p.gates.length;$('step-slider').value=step+1;const g=p.gates[step],body=p.steps[step].body;
 $('step-label').textContent='第 '+(step+1)+' 个适配步 · 原上衣边3289 · 当前参考 '+fmt(g.focus.activeRestM*1000,5)+' mm · 图示比值 '+fmt(g.focus[$('denominator').value],6);
 draw(c);makeTable($('step-facts'),[['当前边长',fmt(g.focus.lengthM*1000,6)+' mm'],['旧模板 / 分级纸样参考',fmt(g.focus.sourceRestM*1000,6)+' / '+fmt(g.focus.targetRestM*1000,6)+' mm'],['原WASM实际采用',fmt(g.focus.packedRestM*1000,6)+' mm'],['本步插值起点与上一完成体型差',fmt(body.maxPreviousMismatchM*1000,6)+' mm'],['第一子步最大人体位移',fmt(body.maxFirstSubstepJumpM*1000,6)+' mm'],['向目标反向移动的顶点数',String(body.reversedVertexCount)],['本步上衣最差边',String(g.scan[0].worstEdge)+'，比值 '+fmt(g.scan[0].maxActiveRatio,6)]]);
 const pred=p.predictions.filter(v=>v.fitStep===step).at(-1);if(pred)makeTable($('prediction'),[['最后子步预测前 / 后边长',fmt(pred.focus.lengthM*1000,6)+' → '+fmt(pred.after.lengthM*1000,6)+' mm'],['预测方程最大残差',pred.maxResidualM.toExponential(3)+' m'],['两个端点本次预测位移',pred.actualDisplacementM.map(a=>a.map(v=>fmt(v*1000,5)).join(', ')).join(' / ')+' mm']]);else $('prediction').textContent='本步没有保存对应预测样本，不能由其他步骤代替。';
 const contacts=p.contacts.filter(v=>v.fitStep===step);$('contacts').replaceChildren();$('contacts').append(node('h3','第11步最后子步 · 原接触修正'));if(contacts.length){const last=contacts.at(-1),changing=[...contacts].reverse().find(v=>Math.abs(v.after.lengthM-v.before.lengthM)>1e-12)||last;makeTable($('contacts'),[['记录调用数',String(contacts.length)],['最后有长度变化的调用前 / 后',fmt(changing.before.lengthM*1000,6)+' → '+fmt(changing.after.lengthM*1000,6)+' mm'],['阶段 / 迭代',changing.phase+' / '+(changing.iteration+1)],['两个端点的实际接触位移',changing.endpointDisplacementM.map(a=>a.map(v=>fmt(v*1000,5)).join(', ')).join(' / ')+' mm']]);}else $('contacts').append(node('p','这里只保存第11步最后子步的详细接触。当前所选步骤没有该记录，不推断内部碰撞原因。','muted'));
 $('checks').replaceChildren();for(const q of common().checks){const div=node('article',undefined,'check '+q.status);div.append(node('code',q.id),node('b',q.status),node('p',q.message));$('checks').append(div);}
 $('details').textContent=JSON.stringify({case:c.case,patches:c.patches,source:c.source,experimentCode:c.code,outcome:c.outcome,focusMetrics:p.metrics[0],settings:p.settings,walkSmoke:c.walkSmoke||null,rollbackExact:c.rollbackExact??null,mode,live:false,productionChanged:false,dynamicFitCertified:false,rootCauseFullyProven:false},null,2);
}
function install(next,nextMode){const b=E.bundle(next,RF35_BUILD.source,{imported:nextMode==='imported'});data=copy(next);objects=b;mode=nextMode;step=0;render();}
function importReview(x){install(x,'imported');status('文件已做结构和数值关系校验，但原生试验没有重跑；不能提升为生产采用或动态认证。');}
function download(name,v){const url=URL.createObjectURL(new Blob([JSON.stringify(v,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function safe(fn){return async()=>{try{return await fn();}catch(e){status(e.message||String(e),true);}};}
try{
 const bytes=Uint8Array.from(atob(RF35_PACKED.data),c=>c.charCodeAt(0));const raw=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
 if(raw.length!==RF35_PACKED.bytes)throw Error('EVIDENCE_SIZE_MISMATCH');const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),v=>v.toString(16).padStart(2,'0')).join('');if(hash!==RF35_PACKED.sha256)throw Error('EVIDENCE_HASH_MISMATCH');
 original=JSON.parse(new TextDecoder().decode(raw));install(original,'captured');
 for(const b of document.querySelectorAll('[data-case]'))b.onclick=()=>{selected=b.dataset.case;step=0;render();};$('denominator').onchange=render;$('step-slider').oninput=()=>{step=Number($('step-slider').value)-1;render();};$('last-step').onclick=()=>{step=current().probe.gates.length-1;render();};
 $('restore').onclick=()=>{install(original,'captured');status('已恢复该固定构建绑定的四条件原生证据。');};$('export-common').onclick=()=>download('RF01-S35-common.json',{...objects,reviewContext:{mode,live:false,productionChanged:false}});$('export-review').onclick=()=>download('RF01-S35-review.json',data);$('export-defects').onclick=()=>download('RF01-S35-defects.json',{...P.defectBundle(objects.objects,data.dictionary),reviewContext:{mode,live:false}});
 $('file').onchange=safe(async()=>{const f=$('file').files[0];if(!f)return;if(f.size>10000000)throw Error('IMPORT_TOO_LARGE');importReview(E.parse(await f.text()));});
 $('bad-source').onclick=()=>{const bad=copy(data);bad.cases[0].source.commit='0'.repeat(40);try{importReview(bad);status('错误来源没有被拦截',true);}catch(e){status('错误来源已原子拒绝，有效报告未改：'+e.message);}};
 $('build').textContent='REALITY-HC-S3.5 · '+RF35_BUILD.sourceCommit.slice(0,12)+' · 原生实验 '+RF35_BUILD.experimentRun;
 status('四条件原生证据已校验。查看失败步数与同一条边的真实长度，不只比较分母改变后的比值。');
 window.__REALITY_S35__=Object.freeze({importReview,restore:()=>install(original,'captured'),report:()=>({sourceCommit:RF35_BUILD.sourceCommit,selected,step,mode,review:copy(data),common:copy(objects),live:false,productionChanged:false}),evidenceHash:hash});
}catch(e){status('证据载入失败，未显示替代数据：'+e.message,true);throw e;}
})();
