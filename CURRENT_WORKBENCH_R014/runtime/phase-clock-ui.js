(()=>{
'use strict';
const P=window.__BIRD_R011_CLOCK,A=window.__BIRD_R010_API;
if(!P||!A)throw new Error('R0.11 缺少 R0.10 执行器或相位合同');
const $=id=>document.getElementById(id);
const D=P.clock.phaseTicksPerCycle;
const supported=P.clock.supportedSampleRatesHz;
const eventDefs=P.events;
const eventById=Object.fromEntries(eventDefs.map(e=>[e.id,e]));
const gcd=(a,b)=>{a=Math.abs(a);b=Math.abs(b);while(b){const t=a%b;a=b;b=t}return a};
const normalizeRate=(rate,last=60)=>supported.includes(Number(rate))?Number(rate):(supported.includes(Number(last))?Number(last):60);
const copyClock=c=>({rateHz:c.rateHz,phaseTicks:c.phaseTicks,cycleIndex:c.cycleIndex,eventSerial:c.eventSerial,lastEvent:c.lastEvent,paused:!!c.paused,lastEvents:[...(c.lastEvents||[])]});
function createClock(input={}){
 const rateHz=normalizeRate(input.rateHz,60);
 let phaseTicks=Number(input.phaseTicks);
 if(!Number.isInteger(phaseTicks)){
  const phase=Number(input.phase01);
  phaseTicks=Number.isFinite(phase)?Math.round((((phase%1)+1)%1)*D):0;
 }
 phaseTicks=((phaseTicks%D)+D)%D;
 const cycleIndex=Math.max(0,Math.floor(Number(input.cycleIndex)||0));
 const eventSerial=Math.max(0,Math.floor(Number(input.eventSerial)||0));
 return{rateHz,phaseTicks,cycleIndex,eventSerial,lastEvent:typeof input.lastEvent==='string'?input.lastEvent:null,paused:!!input.paused,lastEvents:[]};
}
function pushEvent(clock,events,id){
 const def=eventById[id];
 const e={id,frameHuman:def?.frameHuman??null,phaseTicks:def?.phaseTicks??clock.phaseTicks,cycleIndex:clock.cycleIndex,serial:++clock.eventSerial};
 events.push(e);clock.lastEvent=id;
}
function emitRange(clock,events,before,after){
 for(const e of eventDefs){
  if(e.id==='CYCLE_ENTRY'||e.id==='F50_TO_F01')continue;
  if(e.phaseTicks>before&&e.phaseTicks<=after)pushEvent(clock,events,e.id);
 }
}
function stepClock(clock,steps=1){
 if(!clock||typeof clock!=='object')throw new Error('clock missing');
 const count=Number(steps);
 if(!Number.isFinite(count)||count<0||!Number.isInteger(count))throw new Error('steps must be a non-negative integer');
 clock.rateHz=normalizeRate(clock.rateHz,60);
 const step=P.clock.stepTicksByRateHz[String(clock.rateHz)];
 const events=[];
 for(let n=0;n<count;n++){
  const before=clock.phaseTicks;
  const total=before+step;
  if(total>=D){
   emitRange(clock,events,before,D);
   pushEvent(clock,events,'F50_TO_F01');
   clock.cycleIndex++;
   clock.phaseTicks=total-D;
   pushEvent(clock,events,'CYCLE_ENTRY');
   emitRange(clock,events,0,clock.phaseTicks);
  }else{
   clock.phaseTicks=total;
   emitRange(clock,events,before,clock.phaseTicks);
  }
 }
 clock.lastEvents=events.slice(-16);
 return{clock,events,phase01:clock.phaseTicks/D,packet:A.evaluateAtPhase(clock.phaseTicks/D,A.getState().controls)};
}
function setRate(clock,rateHz){clock.rateHz=normalizeRate(rateHz,clock.rateHz);return clock}
function serializeClock(clock){
 const c=copyClock(clock);
 return JSON.stringify({version:'R0.11',rateHz:c.rateHz,phaseTicks:c.phaseTicks,cycleIndex:c.cycleIndex,eventSerial:c.eventSerial,lastEvent:c.lastEvent,paused:c.paused});
}
function restoreClock(value){
 let x;
 try{x=typeof value==='string'?JSON.parse(value):value}catch{throw new Error('serialized state JSON')}
 if(!x||x.version!=='R0.11')throw new Error('serialized state version');
 if(!supported.includes(Number(x.rateHz)))throw new Error('serialized state rate');
 if(!Number.isInteger(x.phaseTicks)||x.phaseTicks<0||x.phaseTicks>=D)throw new Error('serialized state phaseTicks');
 if(!Number.isInteger(x.cycleIndex)||x.cycleIndex<0)throw new Error('serialized state cycleIndex');
 if(!Number.isInteger(x.eventSerial)||x.eventSerial<0)throw new Error('serialized state eventSerial');
 return createClock(x);
}
function auditRate(rateHz,cycles=10000){
 rateHz=normalizeRate(rateHz,60);
 cycles=Math.max(0,Math.floor(Number(cycles)||0));
 const exactSamplesPerCycle=rateHz*49/24;
 const naiveRoundedSamplesPerCycle=Math.round(exactSamplesPerCycle);
 const naiveDriftSourceFrames=(naiveRoundedSamplesPerCycle*24/rateHz-49)*cycles;
 const numer=rateHz*49,denom=24,g=gcd(numer,denom),gridCycles=denom/g;
 return{rateHz,cycles,exactSamplesPerCycle,integerSamplesPerCycle:Number.isInteger(exactSamplesPerCycle),naiveRoundedSamplesPerCycle,naiveDriftSourceFrames,canonicalDriftSourceFrames:0,masterStepTicks:P.clock.stepTicksByRateHz[String(rateHz)],gridCycles,samplesForGridCycles:numer/g};
}
function auditAll(cycles=10000){return supported.map(rate=>auditRate(rate,cycles))}
function runGridCycles(rateHz){
 const a=auditRate(rateHz,1),clock=createClock({rateHz});
 const r=stepClock(clock,a.samplesForGridCycles);
 return{audit:a,clock:r.clock,events:r.events,boundaryCount:r.events.filter(e=>e.id==='F50_TO_F01').length,entryCount:r.events.filter(e=>e.id==='CYCLE_ENTRY').length};
}
function style(){
 const s=document.createElement('style');
 s.textContent=`.r011-card{border:1px solid #28505f;background:#091820;border-radius:10px;padding:10px;margin:8px 0}.r011-rates{display:grid;grid-template-columns:repeat(5,1fr);gap:5px}.r011-rates button{padding:7px 2px;font-size:10px}.r011-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:7px}.r011-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}.r011-grid>div{border:1px solid #244554;background:#0a1821;border-radius:8px;padding:8px}.r011-grid span{display:block;color:#819aa6;font-size:9px}.r011-grid b{display:block;color:#edf7fa;font-size:12px;margin-top:3px}.r011-table{display:grid;gap:5px}.r011-row{display:grid;grid-template-columns:45px 1fr 1fr;gap:6px;padding:7px;border:1px solid #244554;border-radius:8px;font-size:9px}.r011-row b{color:#79d6ec}.r011-row span{color:#a9bec7}.r011-row i{font-style:normal;text-align:right}.r011-events{display:grid;grid-template-columns:1fr 1fr;gap:5px}.r011-events div{border:1px solid #294957;border-radius:7px;padding:7px;color:#95acb7;font-size:9px}.r011-events b{display:block;color:#e8f3f7}.r011-good{color:#75d3aa!important}.r011-warn{color:#e8b964!important}.r011-clockbar{height:10px;border:1px solid #31505d;border-radius:99px;overflow:hidden;background:#07131a;margin:8px 0}.r011-clockbar i{display:block;height:100%;background:#56cbe8;width:0}.r011-state{font:9px ui-monospace,monospace;color:#8ed8ea;word-break:break-all;line-height:1.45}`;
 document.head.appendChild(s);
}
function inject(){
 document.title='Bird Mother｜Seagull A 相位时钟与长周期稳定台 R0.11';
 const title=document.querySelector('.title-block b'),sub=document.querySelector('.title-block small'),pill=document.querySelector('header .pill');
 if(title)title.textContent='Bird Mother｜Seagull A 相位时钟与长周期稳定台 R0.11';
 if(sub)sub.textContent='公共整数相位｜24/30/60/90/120 Hz｜暂停恢复｜边界事件｜10,000 周期漂移';
 if(pill)pill.textContent='CANONICAL PHASE CLOCK · ZERO REDEFINITION';
 const left=$('controls'),right=$('analysis');
 const l=document.createElement('section');
 l.innerHTML=`<h3>R0.11 采样时钟</h3><div class="r011-card"><div class="r011-rates" id="r011Rates">${supported.map(r=>`<button type="button" data-rate="${r}" class="${r===60?'active':''}">${r} Hz</button>`).join('')}</div><div class="r011-actions"><button id="r011Play" class="primary">运行</button><button id="r011Step">单步</button><button id="r011Cycle">到下一周期</button><button id="r011PauseSave">暂停并保存</button><button id="r011Restore">恢复</button><button id="r011Reset">重置</button></div><div class="r011-clockbar"><i id="r011ClockFill"></i></div><div class="r011-grid"><div><span>phase01</span><b id="r011Phase">0.000000</b></div><div><span>周期</span><b id="r011CycleIndex">0</b></div><div><span>相位刻度</span><b id="r011Ticks">0 / ${D}</b></div><div><span>最近事件</span><b id="r011LastEvent">CYCLE_ENTRY</b></div></div><div class="r011-state" id="r011Serialized">尚未保存</div></div><h3>漂移审计周期</h3><div class="r011-rates" id="r011Cycles">${P.driftAudit.cycleCounts.map(c=>`<button type="button" data-cycles="${c}" class="${c===10000?'active':''}">${c.toLocaleString()}</button>`).join('')}</div>`;
 left.prepend(l);
 const r=document.createElement('section');
 r.innerHTML=`<h3>R0.11 时钟合同</h3><div class="r011-grid"><div><span>来源周期</span><b>49 / 24 s</b></div><div><span>公共主时基</span><b>360 Hz</b></div><div><span>每周期刻度</span><b>${D.toLocaleString()}</b></div><div><span>外部依赖</span><b>0</b></div></div><h3>采样率与漂移</h3><div class="r011-table" id="r011Audit"></div><h3>来源事件</h3><div class="r011-events" id="r011Events"></div>`;
 right.prepend(r);
 for(const e of eventDefs){const d=document.createElement('div');d.innerHTML=`<b>${e.id}</b>F${String(e.frameHuman).padStart(2,'0')} · tick ${e.phaseTicks.toLocaleString()}`;$('r011Events').appendChild(d)}
 const footer=document.querySelector('footer');if(footer&&!footer.textContent.includes('canonicalPhaseClock=true')){const s=document.createElement('span');s.textContent='canonicalPhaseClock=true';footer.appendChild(s)}
}
style();inject();
let clock=createClock({rateHz:60}),running=false,lastNow=performance.now(),sampleAccumulator=0,auditCycles=10000,saved=null;
function updateAudit(){
 $('r011Audit').innerHTML=auditAll(auditCycles).map(a=>`<div class="r011-row"><b>${a.rateHz} Hz</b><span>${a.exactSamplesPerCycle.toFixed(6)} 样本/周期<br>${a.integerSamplesPerCycle?'整数网格':'分数网格 · '+a.gridCycles+' 周期回到样本网格'}</span><i class="${Math.abs(a.naiveDriftSourceFrames)<1e-12?'r011-good':'r011-warn'}">朴素漂移 ${a.naiveDriftSourceFrames.toFixed(3)} 帧<br>公共时钟 0 帧</i></div>`).join('');
}
function syncViewer(){const frame=Math.round(clock.phaseTicks/P.clock.phaseTicksPerSourceFrame)%50;try{window.__BIRD_R007_API?.setFrame(frame)}catch{}return frame}
function render(){
 const phase=clock.phaseTicks/D,frame=syncViewer();
 $('r011Phase').textContent=phase.toFixed(6);$('r011CycleIndex').textContent=String(clock.cycleIndex);$('r011Ticks').textContent=`${clock.phaseTicks.toLocaleString()} / ${D.toLocaleString()}`;$('r011LastEvent').textContent=clock.lastEvent||'CYCLE_ENTRY';$('r011ClockFill').style.width=(phase*100).toFixed(3)+'%';
 window.__BIRD_R011_QA={ready:true,version:'R0.11',supportedRates:[...supported],phaseTicksPerCycle:D,phaseTicks:clock.phaseTicks,phase01:phase,cycleIndex:clock.cycleIndex,rateHz:clock.rateHz,lastEvent:clock.lastEvent,eventSerial:clock.eventSerial,frame,externalRuntimeDependencies:0,controllerAffectsSourceMesh:false,audits:auditAll(10000)};
 document.body.dataset.r011Ready='true';
}
for(const b of document.querySelectorAll('#r011Rates button'))b.addEventListener('click',()=>{setRate(clock,Number(b.dataset.rate));document.querySelectorAll('#r011Rates button').forEach(x=>x.classList.toggle('active',x===b));render()});
for(const b of document.querySelectorAll('#r011Cycles button'))b.addEventListener('click',()=>{auditCycles=Number(b.dataset.cycles);document.querySelectorAll('#r011Cycles button').forEach(x=>x.classList.toggle('active',x===b));updateAudit()});
$('r011Play').addEventListener('click',()=>{running=!running;$('r011Play').textContent=running?'暂停':'运行';$('r011Play').classList.toggle('primary',running);lastNow=performance.now()});
$('r011Step').addEventListener('click',()=>{stepClock(clock,1);render()});
$('r011Cycle').addEventListener('click',()=>{const target=clock.cycleIndex+1;let guard=0;while(clock.cycleIndex<target&&guard++<1000)stepClock(clock,1);render()});
$('r011PauseSave').addEventListener('click',()=>{running=false;clock.paused=true;saved=serializeClock(clock);$('r011Serialized').textContent=saved;$('r011Play').textContent='运行';render()});
$('r011Restore').addEventListener('click',()=>{if(saved){clock=restoreClock(saved);clock.paused=false;render()}});
$('r011Reset').addEventListener('click',()=>{running=false;clock=createClock({rateHz:clock.rateHz});sampleAccumulator=0;$('r011Play').textContent='运行';render()});
function loop(now){if(running){const dt=Math.min(.25,Math.max(0,(now-lastNow)/1000));sampleAccumulator+=dt*clock.rateHz;const steps=Math.floor(sampleAccumulator);if(steps>0){sampleAccumulator-=steps;stepClock(clock,steps)}}lastNow=now;render();requestAnimationFrame(loop)}
updateAudit();
window.__BIRD_R011_API={createClock,stepClock,setRate,serializeClock,restoreClock,auditRate,auditAll,runGridCycles,getClock:()=>copyClock(clock),setClock:x=>{clock=createClock(x);render();return copyClock(clock)},contract:P};
Object.assign(window.__BIRD_QA,{phaseClockReady:true,phaseClockVersion:'R0.11'});
requestAnimationFrame(loop);
})();
