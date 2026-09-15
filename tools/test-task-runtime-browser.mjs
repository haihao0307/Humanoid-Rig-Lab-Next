import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright-core';

const url=process.env.HUMANLAB_URL||'http://127.0.0.1:4173/index.html';
const launchOptions={
 headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--ignore-gpu-blocklist']
};
if(process.env.CHROME_BIN)launchOptions.executablePath=process.env.CHROME_BIN;
const browser=await chromium.launch(launchOptions);
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
const pageErrors=[];
page.on('pageerror',error=>pageErrors.push(String(error?.stack||error)));
await mkdir('artifacts',{recursive:true});
async function diagnostics(){
 return page.evaluate(()=>{
  const frame=document.querySelector('#bodyFrame'),w=frame?.contentWindow,panel=document.querySelector('.npc-population');
  let populationCount=null,populationError=null;
  try{populationCount=w?.HumanLab?.population?.list?.().length??null;}catch(error){populationError=String(error?.message||error);}
  return{
   outerReadyState:document.readyState,
   loadingTitle:document.querySelector('#loadingTitle')?.textContent||null,
   loadingText:document.querySelector('#loadingText')?.textContent||null,
   frameAttached:!!frame,
   frameDocumentReadyState:frame?.contentDocument?.readyState||null,
   startup:w?.__humanStartup||null,
   startupError:w?.__startupError||null,
   hasLab:!!w?.HumanLab,
   populationCount,
   populationError,
   panelPresent:!!panel,
   bridgeInstalled:panel?.dataset?.taskSelectionBridge||null,
   recipientText:panel?.querySelector?.('[data-el="taskRecipients"]')?.textContent||null
  };
 });
}
try{
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForSelector('#bodyFrame',{state:'attached',timeout:30000});
 // The full page continues generating the four-person review cast after the
 // population API and mother pair are usable. This smoke targets the first
 // real integration milestone instead of waiting for all authoring extras.
 await page.waitForFunction(()=>{
  const frame=document.querySelector('#bodyFrame'),w=frame?.contentWindow,panel=document.querySelector('.npc-population');
  if(w?.__startupError||w?.__humanStartup?.status==='failed')return true;
  let count=0;try{count=w?.HumanLab?.population?.list?.().length||0;}catch{}
  return !!w?.HumanLab?.population&&count>=2&&panel?.dataset?.taskSelectionBridge==='1';
 },null,{timeout:180000,polling:250});
 const milestone=await diagnostics();
 assert.equal(milestone.startupError,null,'body runtime reported startup error: '+JSON.stringify(milestone));
 assert.notEqual(milestone.startup?.status,'failed','body runtime failed: '+JSON.stringify(milestone));
 assert.equal(milestone.hasLab,true,'HumanLab API is missing');
 assert(milestone.populationCount>=2,'mother-pair population was not available');
 assert.equal(milestone.panelPresent,true,'NPC population panel is missing');
 assert.equal(milestone.bridgeInstalled,'1','task selection bridge is not assembled');
 await page.evaluate(()=>{document.querySelector('.npc-population').open=true;});
 const bridge=await page.evaluate(()=>{
  const panel=document.querySelector('.npc-population'),target=panel.querySelector('[data-el="target"]'),recipients=panel.querySelector('[data-el="taskRecipients"]');
  return{installed:panel.dataset.taskSelectionBridge,targetHidden:target.hidden,targetValue:target.value,recipients:recipients?.textContent||'',hasCurrent:!!panel.querySelector('[data-el="selectCurrent"]'),hasInvert:!!panel.querySelector('[data-el="invertSelection"]')};
 });
 assert.equal(bridge.installed,'1');
 assert.equal(bridge.targetHidden,true);
 assert.equal(bridge.targetValue,'selected');
 assert.equal(bridge.hasCurrent,true);
 assert.equal(bridge.hasInvert,true);
 assert.match(bridge.recipients,/任务接收者/);
 const before=await page.evaluate(()=>{
  const lab=document.querySelector('#bodyFrame').contentWindow.HumanLab,rows=lab.population.list();
  if(rows.length<2)throw Error('browser cast must contain at least two NPCs');
  const chosen=rows[0];lab.population.select([chosen.id]);
  return{chosenId:chosen.id,chosenLabel:chosen.label,rows:rows.map(row=>({id:row.id,queued:row.queued,running:!!lab.population.get(row.id).running,completed:lab.population.get(row.id).agent.stats.completed}))};
 });
 await page.waitForFunction(label=>document.querySelector('[data-el="taskRecipients"]')?.textContent===`任务接收者（1）：${label}`,before.chosenLabel,{timeout:10000});
 const execution=await page.evaluate(()=>{
  const lab=document.querySelector('#bodyFrame').contentWindow.HumanLab;
  const result=lab.population.dispatch('挥手',{targets:'selected',mode:'replace'});
  const rows=lab.population.list().map(row=>({id:row.id,queued:row.queued,running:!!lab.population.get(row.id).running,error:lab.population.get(row.id).agent.error,paused:lab.population.get(row.id).agent.paused}));
  return{result,rows,selected:lab.population.list().filter(row=>row.selected).map(row=>row.id)};
 });
 assert.deepEqual(execution.selected,[before.chosenId]);
 assert.equal(execution.result.length,1);
 assert.equal(execution.result[0].id,before.chosenId);
 assert.equal(execution.result[0].accepted,true,execution.result[0].reason||'selected NPC rejected browser task');
 const beforeById=new Map(before.rows.map(row=>[row.id,row]));
 const chosenAfter=execution.rows.find(row=>row.id===before.chosenId);
 assert(chosenAfter.running||chosenAfter.queued>beforeById.get(before.chosenId).queued,'selected NPC did not receive a live or queued task');
 for(const row of execution.rows)if(row.id!==before.chosenId){
  const prior=beforeById.get(row.id);
  assert.equal(row.queued,prior.queued,'unselected NPC queue changed unexpectedly: '+row.id);
  assert.equal(row.running,prior.running,'unselected NPC running state changed unexpectedly: '+row.id);
 }
 assert.equal(chosenAfter.error,null,'selected NPC ended with an immediate error');
 await page.screenshot({path:'artifacts/task-runtime-browser.png',fullPage:true});
 page.evaluate(()=>{
  const lab=document.querySelector('#bodyFrame').contentWindow.HumanLab;
  try{lab.population.control('stop','all');}catch{}
 }).catch(()=>{});
 console.log(JSON.stringify({passed:true,startupMilestone:milestone.startup?.stage||'population-ready',population:execution.rows.length,selected:execution.selected,recipientText:`任务接收者（1）：${before.chosenLabel}`,selectedTaskAccepted:true,unselectedQueueChanges:0,pageErrors:pageErrors.length,screenshot:'artifacts/task-runtime-browser.png'}));
}catch(error){
 let state=null;try{state=await diagnostics();}catch(diagnosticError){state={diagnosticError:String(diagnosticError?.stack||diagnosticError)};}
 try{await page.screenshot({path:'artifacts/task-runtime-browser-failure.png',fullPage:true});}catch{}
 console.error('TASK_BROWSER_DIAGNOSTICS '+JSON.stringify({state,pageErrors}));
 throw error;
}finally{
 await browser.close();
}
