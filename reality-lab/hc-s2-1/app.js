(function(){
'use strict';
const P=RealityProtocol,A=RealityCommonAdapters,D=REALITY_DICTIONARY,$=id=>document.getElementById(id),dictionaryIndex=P.validateDictionary(D);
const SOURCE={
 s1:{raw:'https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/4b9d26b4edc6f197823d8bcebd9fd242ce99d1ff/reality-lab/hc-s1/preview.html',fixed:'https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/4b9d26b4edc6f197823d8bcebd9fd242ce99d1ff/reality-lab/hc-s1/preview.html',sha256:'94939009131344eb539a6e60414d001b1619e0d33944aef84517a81354f5f836',bytes:55257},
 s2:{raw:'https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/8890bda261784ba14a79ea277bbb14bd547376ad/reality-lab/hc-s2/releases/s2-893fe414335d/preview.html',fixed:'https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/8890bda261784ba14a79ea277bbb14bd547376ad/reality-lab/hc-s2/releases/s2-893fe414335d/preview.html',sha256:'888479a0fc1070a00e161c9af937fc43bc1db871a88e8c37d87d0326e0b3fcce',bytes:66052}
};
const configs=[
 {id:'human-r07',label:'人物 · R07',domain:'human',group:'s1',stage:'S1 LIVE READ',description:'读取固定 R07 原生人物的当前数字几何、相机与声明，再映射到共同语义；包围范围不冒充人体身高。'},
 {id:'shoe-r12',label:'鞋履 · R12',domain:'footwear',group:'s1',stage:'S1 LIVE READ',description:'读取固定 R12 鞋台的当前数字几何与毫米→米关系；外形范围不冒充脚长、鞋楦或鞋码。'},
 {id:'pattern-shorts-s2',label:'裁片 · S2',domain:'pattern',group:'s2',stage:'S2 VERIFIED SNAPSHOT',description:'读取固定短裤九片纸样，统一净样、材料、裁切线、配缝和人物绑定缺口；不自动修缝份。'},
 {id:'fabric-s3',label:'布料 / 皮革 · S3',domain:'fabric',registeredOnly:true,stage:'REGISTERED ONLY',description:'下一阶段：材料坐标、厚度、纱线间距和参数量纲。当前不读取或修改现有着色器与物理。'},
 {id:'garment-s5',label:'成衣宿主 · 待接入',domain:'garment',registeredOnly:true,stage:'REGISTERED ONLY',description:'在布料接口稳定后接入真实成衣和人物版本、试穿、碰撞与动作状态。当前不冒充已接入。'}
];
const adapters={
 'human-r07':A.createS1Adapter('human-r07',D),
 'shoe-r12':A.createS1Adapter('shoe-r12',D),
 'pattern-shorts-s2':A.createS2Adapter(D)
};
for(const adapter of Object.values(adapters))P.verifyAdapter(adapter);
let selected='human-r07',frame=null,frameGroup=null,loading=false,privateKey=new URLSearchParams(location.hash.slice(1)).get('key')||'',activeTab='measurements';
const results=new Map(),events=[];
function record(type,detail){events.push({type,detail,at:new Date().toISOString()});if(events.length>60)events.shift();}
function config(){return configs.find(x=>x.id===selected);}
function status(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);record(error?'error':'status',text);}
function el(tag,text,cls){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;}
function addFact(target,label,value){target.append(el('div',label,'label'),el('div',String(value),'value'));}
function valueText(m){
 if(m.value===null)return '未确认';
 const def=dictionaryIndex.byId[m.definitionId];
 if(def.quantity==='count')return String(m.value);
 if(def.quantity==='length'&&m.unit==='m')return Math.abs(m.value)<1?m.value.toFixed(6)+' m / '+(m.value*1000).toFixed(3)+' mm':m.value.toFixed(6)+' m';
 return Number.isInteger(m.value)?String(m.value):Number(m.value).toPrecision(8)+' '+m.unit;
}
function clearNode(id){$(id).replaceChildren();}
function renderCounts(object){for(const key of P.STATUSES)$('count-'+({PASS:'pass',FAIL:'fail',WARNING:'warning',UNKNOWN:'unknown',NOT_APPLICABLE:'na'})[key]).textContent=object?.counts?.[key]??0;}
function renderFacts(object){clearNode('facts');clearNode('preservation');
 if(!object){addFact($('facts'),'对象','尚未读取');addFact($('facts'),'当前范围',config().domain);$('verdict').textContent=config().registeredOnly?'已登记下一阶段；本轮不伪造接入结果。':'点击“读取并统一核验”后显示共同协议结果。';return;}
 addFact($('facts'),'对象ID',object.objectId);addFact($('facts'),'领域',object.domain);addFact($('facts'),'来源模式',object.sourceMode);addFact($('facts'),'共同状态',object.status);addFact($('facts'),'源仓库',object.source.repository);addFact($('facts'),'源提交',object.source.commit);addFact($('facts'),'源路径',object.source.path);addFact($('facts'),'已加载对象',results.size);
 $('verdict').textContent=object.status==='REJECTED'?'存在冲突，不能提升为有效世界声明。':object.status==='PARTIAL'?'结构和来源可解释，但仍有明确警告或缺证据项。':'当前声明在本协议范围内有效；仍不授予物性、审美或制造认证。';
 const p=object.preservation||{};const entries=Object.entries(p);if(entries.length)for(const [key,value]of entries)addFact($('preservation'),key,value===true?'保持不变':value===false?'发生变化':JSON.stringify(value));else addFact($('preservation'),'保护证据','未提供');
}
function renderMeasurements(object){clearNode('measurement-rows');if(!object)return;
 const rows=[...object.measurements].sort((a,b)=>P.STATUSES.indexOf(a.status)-P.STATUSES.indexOf(b.status)||a.id.localeCompare(b.id));
 for(const m of rows){const tr=document.createElement('tr');const id=document.createElement('td');id.append(el('code',m.id),document.createElement('br'),el('span',m.definitionId,'mini muted'));const name=el('td',m.label);const value=document.createElement('td');value.append(el('span',m.status,'pill '+m.status),document.createElement('br'),el('span',valueText(m)));const basis=el('td',m.basis);const method=el('td',m.method||'未提供');if(m.notEquivalentTo?.length)method.append(document.createElement('br'),el('span','不等同于：'+m.notEquivalentTo.join('、'),'mini muted'));tr.append(id,name,value,basis,method);$('measurement-rows').append(tr);}
}
function renderChecks(object){clearNode('check-rows');if(!object)return;for(const c of object.checks){const tr=document.createElement('tr'),s=document.createElement('td');s.append(el('span',c.status,'pill '+c.status));tr.append(s,el('td',c.id),el('td',c.message),el('td',c.owner||'未分配'));$('check-rows').append(tr);}}
function renderDefects(object){clearNode('defect-list');if(!object)return;if(!object.defects.length){$('defect-list').append(el('p','当前对象没有由 FAIL / WARNING / UNKNOWN 形成的开放派单。','muted'));return;}for(const d of object.defects){const box=el('article',undefined,'defect '+d.severity),head=el('div',undefined,'defect-head');head.append(el('code',d.code),el('span',d.severity+' / '+d.owner));box.append(head,el('p',d.message),el('div','repairAuthorized=false · verificationRequired=true','mini muted'));$('defect-list').append(box);}}
function renderDictionary(){clearNode('dictionary-rows');const domain=config().domain;for(const d of D.measurements.filter(x=>x.domain===domain||x.domain==='fabric'&&domain==='fabric')){const tr=document.createElement('tr');tr.append(el('td',d.id),el('td',d.label),el('td',d.unit),el('td',d.definition),el('td',[...(d.notEquivalentTo||[]),...(d.requiredEvidence||[])].join('、')||'—'));$('dictionary-rows').append(tr);}}
function render(object=results.get(selected)||null){renderCounts(object);renderFacts(object);renderMeasurements(object);renderChecks(object);renderDefects(object);renderDictionary();$('export-report').disabled=results.size===0;$('export-defects').disabled=results.size===0;}
function select(id){const next=configs.find(x=>x.id===id);if(!next)throw Error('对象不在允许范围');selected=id;document.querySelectorAll('[data-object]').forEach(b=>b.classList.toggle('active',b.dataset.object===id));$('title').textContent=next.label;$('description').textContent=next.description;$('stage').textContent=next.stage;$('mode').textContent=next.registeredOnly?'登记中 / 无实时适配器':next.group==='s1'?'原生实时只读':'固定源快照只读';$('load').disabled=loading||next.registeredOnly;$('key-row').hidden=next.group!=='s2';$('open-fixed').hidden=next.registeredOnly;
 if(!next.registeredOnly){const src=SOURCE[next.group];$('open-fixed').href=src.fixed+(next.group==='s2'&&(privateKey||$('access-key').value.trim())?'#key='+encodeURIComponent(privateKey||$('access-key').value.trim()):'');}
 render();status(next.registeredOnly?'此对象只登记在共同目录中；当前没有适配器，不会显示假数据。':'已选择 '+next.label+'；尚未执行新的只读观察。');
}
async function digestHex(buffer){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',buffer))].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function fetchExact(group){const src=SOURCE[group],response=await fetch(src.raw,{credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)throw Error('固定原版读取失败：HTTP '+response.status);const bytes=await response.arrayBuffer();if(bytes.byteLength!==src.bytes)throw Error('固定原版字节数变化，拒绝执行');const hash=await digestHex(bytes);if(hash!==src.sha256)throw Error('固定原版摘要不符，拒绝回退到其他版本');record('source-verified',{group,bytes:bytes.byteLength,sha256:hash});return new TextDecoder().decode(bytes);}
async function ensureFrame(group){if(frame&&frameGroup===group)return frame;if(frame)unload();const html=await fetchExact(group);const iframe=document.createElement('iframe');iframe.title=group==='s1'?'S1 人物与鞋履固定原版':'S2 裁片固定观察页';iframe.referrerPolicy='no-referrer';frame=iframe;frameGroup=group;$('native-wrap').replaceChildren(iframe);$('native-caption').textContent='固定文件摘要已核对，正在初始化';await new Promise((resolve,reject)=>{iframe.onload=resolve;iframe.onerror=()=>reject(Error('固定原版 iframe 初始化失败'));iframe.srcdoc=html;});record('frame-created',group);return iframe;}
async function loadSelected(){
 if(loading)return;const c=config();if(c.registeredOnly)throw Error('此对象尚未接入适配器');loading=true;$('load').disabled=true;status('正在核对固定来源并读取 '+c.label+'；统一层不写回原台。');
 try{const iframe=await ensureFrame(c.group),key=(privateKey||$('access-key').value.trim());if(c.group==='s2'&&!/^[A-Za-z0-9_-]{43}$/.test(key))throw Error('S2 裁片需要完整私人链接或有效访问参数');const object=await adapters[c.id].read(iframe.contentWindow,{key});results.set(c.id,object);$('access-key').value='';$('native-caption').textContent=c.label+' · 已形成共同协议结果';render(object);status('完成 '+c.label+'：'+object.counts.PASS+' PASS / '+object.counts.FAIL+' FAIL / '+object.counts.WARNING+' WARNING / '+object.counts.UNKNOWN+' UNKNOWN。没有自动修源数据。');record('object-normalized',{objectId:c.id,status:object.status,counts:object.counts});}
 finally{loading=false;$('load').disabled=config().registeredOnly;}
}
function unload(){if(frame){try{frame.contentWindow.__REALITY_LAB__?.unload?.();}catch{}frame.remove();}frame=null;frameGroup=null;$('native-wrap').replaceChildren(el('div','原生页面已关闭；已经形成的共同报告仍保留在本页内存中。','empty'));$('native-caption').textContent='已释放原台';$('unload').disabled=true;record('frame-unloaded',selected);}
function download(name,value){const text=JSON.stringify(value,null,2),url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function bundle(){if(!results.size)throw Error('尚无共同协议结果');return P.aggregate([...results.values()],D);}
function defectBundle(){if(!results.size)throw Error('尚无缺陷记录');return P.defectBundle([...results.values()],D);}
for(const c of configs){const b=el('button');b.dataset.object=c.id;b.append(el('b',c.label),el('small',c.registeredOnly?'来源登记 / 尚未接入':c.group==='s1'?'原生按需读取':'受保护固定快照'));b.onclick=()=>select(c.id);$('objects').append(b);}
for(const b of document.querySelectorAll('[data-tab]'))b.onclick=()=>{activeTab=b.dataset.tab;document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.panel').forEach(x=>x.hidden=x.id!=='panel-'+activeTab);};
$('load').onclick=()=>loadSelected().catch(e=>{status(String(e.message||e),true);record('handled-error',String(e.message||e));});$('unload').onclick=unload;$('export-report').onclick=()=>download('KAOPU-Reality-Foundation-S2.1-report.json',{...bundle(),build:REALITY_BUILD,generatedAt:new Date().toISOString()});$('export-defects').onclick=()=>download('KAOPU-Reality-Foundation-S2.1-defects.json',{...defectBundle(),generatedAt:new Date().toISOString()});$('access-key').oninput=()=>{if(config().group==='s2')$('open-fixed').href=SOURCE.s2.fixed+($('access-key').value.trim()?'#key='+encodeURIComponent($('access-key').value.trim()):'');};
select(selected);$('unload').disabled=false;status('共同协议、测量字典和适配器已就绪。请选择对象读取；布料与成衣保持登记状态。');
window.__REALITY_FOUNDATION__=Object.freeze({version:'REALITY-HC-S2.1',sourceCommit:REALITY_BUILD.sourceCommit,select,loadSelected,unload,report:()=>({version:'REALITY-HC-S2.1',sourceCommit:REALITY_BUILD.sourceCommit,selected,loading,frameGroup,iframeCount:document.querySelectorAll('#native-wrap iframe').length,keyPresent:!!privateKey||!!$('access-key').value.trim(),results:Object.fromEntries([...results.entries()].map(([id,v])=>[id,P.clone(v)])),aggregate:results.size?bundle():null,events:P.clone(events),sourceWriteAPI:false,automaticRepair:false}),dictionary:()=>P.clone(D)});
})();
