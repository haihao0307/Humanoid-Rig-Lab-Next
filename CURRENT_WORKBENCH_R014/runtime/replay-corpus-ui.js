(()=>{
'use strict';
const CONTRACT=window.__BIRD_R013_CONTRACT,CORPUS=window.__BIRD_R013_CORPUS,R12=window.__BIRD_R012_API,CONSUMER=window.__BIRD_R013_CONSUMER,CLOCK=window.__BIRD_R011_API,EXEC=window.__BIRD_R010_API;
if(!CONTRACT||!CORPUS||!R12||!CONSUMER||!CLOCK||!EXEC)throw new Error('R0.13 合同链不完整');
const $=id=>document.getElementById(id),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const CASES=CORPUS.cases.map(row=>Object.fromEntries(CORPUS.caseSchema.map((name,i)=>[name,row[i]])));
function verifyCase(c){
 const failures=[];let d1=null,d2=null;
 try{d1=R12.decodePacket(c.packetHex)}catch(e){failures.push('R0.12:'+e.message)}
 try{d2=CONSUMER.consume(c.packetHex)}catch(e){failures.push('consumer:'+e.message)}
 if(d1){
  if(R12.reencodeDecoded(d1).hex!==c.packetHex)failures.push('reencode');
  if(d1.clock.phaseTicks!==c.phaseTicks||d1.clock.cycleIndex!==c.cycleIndex||d1.clock.rateHz!==c.rateHz||d1.clock.eventSerial!==c.eventSerial)failures.push('clock');
  if(d1.eventMask!==c.eventBit)failures.push('header');
 }
 if(d2){
  if(d2.hex!==c.packetHex||d2.phaseTicks!==c.phaseTicks||d2.rateHz!==c.rateHz||d2.eventMask!==c.eventBit)failures.push('consumer-meta');
  if(d1&&!same(d1.quantized,{...d2.activeChannelsQ16,...d2.lockedChannelsQ16}))failures.push('consumer-q16');
 }
 let r12Reject=false,consumerReject=false;
 const bad=CONSUMER.fromHex(c.packetHex);bad[40]^=1;
 try{R12.decodePacket(bad)}catch{r12Reject=true}
 try{CONSUMER.consume(bad)}catch{consumerReject=true}
 if(!r12Reject)failures.push('r12-corruption');if(!consumerReject)failures.push('consumer-corruption');
 return{case:c,ok:failures.length===0,failures,r12Reject,consumerReject,decoded:d2};
}
function verifyAll(){
 const results=CASES.map(verifyCase),groups=[];
 for(const eventId of [...new Set(CASES.map(c=>c.eventId))]){
  const g=CASES.filter(c=>c.eventId===eventId),phase=g[0].phaseTicks,bit=g[0].eventBit;
  groups.push({eventId,ok:g.length===5&&new Set(g.map(c=>c.rateHz)).size===5&&g.every(c=>c.phaseTicks===phase&&c.eventBit===bit),caseCount:g.length});
 }
 return{results,groups,passCount:results.filter(x=>x.ok).length,corruptionRejectCount:results.reduce((s,x)=>s+(x.r12Reject?1:0)+(x.consumerReject?1:0),0),groupPassCount:groups.filter(x=>x.ok).length};
}
const audit=verifyAll();
function style(){const s=document.createElement('style');s.textContent=`.r013-card{border:1px solid #28505f;background:#091820;border-radius:10px;padding:10px;margin:8px 0}.r013-summary{display:grid;grid-template-columns:1fr 1fr;gap:6px}.r013-summary>div{border:1px solid #244554;background:#0a1821;border-radius:8px;padding:8px}.r013-summary span{display:block;color:#8199a5;font-size:9px}.r013-summary b{display:block;color:#edf7fa;font-size:14px;margin-top:3px}.r013-filters{display:grid;grid-template-columns:repeat(5,1fr);gap:4px}.r013-filters button{font-size:9px;padding:7px 2px}.r013-list{display:grid;gap:4px;max-height:360px;overflow:auto}.r013-row{display:grid;grid-template-columns:1fr auto;gap:6px;border:1px solid #244554;border-radius:7px;padding:7px;text-align:left;background:#0a1821}.r013-row b{font-size:9px}.r013-row span{font-size:8px;color:#8da6b2}.r013-row.good{border-color:#2b6c58}.r013-row.bad{border-color:#8b3f42}.r013-hex{font:8px ui-monospace,monospace;word-break:break-all;color:#8fdcf0;line-height:1.45}.r013-detail{font:9px ui-monospace,monospace;color:#9cb3be;line-height:1.45;white-space:pre-wrap}.r013-good{color:#75d3aa!important}.r013-bad{color:#ff9b91!important}`;document.head.appendChild(s)}
function inject(){
 document.title='Bird Mother｜Seagull A 冻结重放一致性语料台 R0.13';
 const title=document.querySelector('.title-block b'),sub=document.querySelector('.title-block small'),pill=document.querySelector('header .pill');
 if(title)title.textContent='Bird Mother｜Seagull A 冻结重放一致性语料台 R0.13';if(sub)sub.textContent='40 已知答案包｜8 事件｜5 采样率｜双消费者｜损坏拒绝｜逐字节重放';if(pill)pill.textContent='FROZEN REPLAY CORPUS · 40 CASES';
 const left=$('controls'),right=$('analysis');
 const l=document.createElement('section');l.innerHTML=`<h3>R0.13 语料筛选</h3><div class="r013-card"><div class="r013-filters" id="r013Rates"><button data-rate="all" class="active">全部</button>${CORPUS.dimensions.ratesHz.map(r=>`<button data-rate="${r}">${r} Hz</button>`).join('')}</div></div><div class="r013-list" id="r013List"></div>`;left.prepend(l);
 const r=document.createElement('section');r.innerHTML=`<h3>R0.13 一致性总览</h3><div class="r013-summary"><div><span>通过案例</span><b id="r013Pass">${audit.passCount} / ${CASES.length}</b></div><div><span>损坏拒绝</span><b id="r013Corrupt">${audit.corruptionRejectCount} / ${CASES.length*2}</b></div><div><span>跨采样率事件组</span><b id="r013Groups">${audit.groupPassCount} / ${audit.groups.length}</b></div><div><span>语料 SHA-256</span><b>4a89…0a6a</b></div></div><h3>当前已知答案包</h3><div class="r013-card"><div id="r013CaseTitle"><b>请选择案例</b></div><div id="r013Hex" class="r013-hex">—</div><div id="r013Detail" class="r013-detail">—</div><button id="r013Restore" type="button">恢复到工作台检查</button></div>`;right.prepend(r);
 const foot=document.querySelector('footer');if(foot&&!foot.textContent.includes('replayCorpus=true')){const s=document.createElement('span');s.textContent='replayCorpus=true';foot.appendChild(s)}
}
let filter='all',selected=audit.results[0];
function renderList(){const list=$('r013List');list.innerHTML='';for(const x of audit.results.filter(x=>filter==='all'||String(x.case.rateHz)===filter)){const b=document.createElement('button');b.type='button';b.className='r013-row '+(x.ok?'good':'bad');b.innerHTML=`<b>${x.case.id}</b><span>${x.ok?'PASS':'FAIL '+x.failures.join(',')}</span>`;b.onclick=()=>{selected=x;renderDetail()};list.appendChild(b)}}
function renderDetail(){const c=selected.case,d=selected.decoded;$('r013CaseTitle').innerHTML=`<b>${c.id}</b> · ${c.eventId} · ${c.rateHz} Hz`;$('r013Hex').textContent=c.packetHex;$('r013Detail').textContent=JSON.stringify({phaseTicks:c.phaseTicks,cycleIndex:c.cycleIndex,eventSerial:c.eventSerial,eventMask:c.eventBit,profileId:c.profileId,paused:d?.paused,interpolation:d?.interpolation,controls:d?.controls,checksum:d?'0x'+d.checksum.toString(16).padStart(8,'0'):null,consumer:selected.ok?'PASS':selected.failures},null,2)}
function restore(){const c=selected.case,d=R12.decodePacket(c.packetHex);R12.restoreSnapshot(d);try{window.__BIRD_R007_API?.setFrame(Math.round(c.phaseTicks/360)%50)}catch{}renderDetail()}
style();inject();renderList();renderDetail();
for(const b of document.querySelectorAll('#r013Rates button'))b.onclick=()=>{filter=b.dataset.rate;document.querySelectorAll('#r013Rates button').forEach(x=>x.classList.toggle('active',x===b));renderList()};$('r013Restore').onclick=restore;
const qa={ready:audit.passCount===CASES.length&&audit.corruptionRejectCount===CASES.length*2&&audit.groupPassCount===audit.groups.length,version:'R0.13',caseCount:CASES.length,passCount:audit.passCount,corruptionRejectCount:audit.corruptionRejectCount,crossRateGroupCount:audit.groups.length,crossRateGroupPassCount:audit.groupPassCount,corpusSha256:CONTRACT.corpus.sha256,packetBytes:CORPUS.invariants.packetBytes,externalRuntimeDependencies:0,controllerAffectsSourceMesh:false,results:audit.results.map(x=>({id:x.case.id,ok:x.ok,failures:x.failures})),groups:audit.groups};
window.__BIRD_R013_API={verifyCase,verifyAll,restoreCase:id=>{const x=audit.results.find(x=>x.case.id===id);if(!x)throw new Error('case id');selected=x;restore();return x},corpus:{...CORPUS,cases:CASES},contract:CONTRACT,consumer:CONSUMER};window.__BIRD_R013_QA=qa;Object.assign(window.__BIRD_QA,{replayCorpusReady:qa.ready,replayCorpusVersion:'R0.13'});document.body.dataset.r013Ready=String(qa.ready);const status=$('status');if(status)status.textContent=qa.ready?`R0.13 已验证 ${qa.passCount} 个冻结答案包，双消费者与损坏拒绝全部通过`:`R0.13 验证失败 ${qa.passCount}/${qa.caseCount}`;
})();
