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
try{
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForSelector('#bodyFrame',{state:'attached',timeout:30000});
 await page.waitForFunction(()=>{
  const w=document.querySelector('#bodyFrame')?.contentWindow;
  return w?.__humanStartup?.status==='ready'||w?.__humanStartup?.status==='failed'||!!w?.__startupError;
 },null,{timeout:240000,polling:250});
 const startup=await page.evaluate(()=>{
  const w=document.querySelector('#bodyFrame').contentWindow;
  return{startup:w.__humanStartup||null,error:w.__startupError||null,hasLab:!!w.HumanLab};
 });
 assert.equal(startup.startup?.status,'ready','body runtime did not reach ready: '+JSON.stringify(startup));
 assert.equal(startup.error,null,'body runtime reported startup error');
 assert.equal(startup.hasLab,true,'HumanLab API is missing');
 await page.waitForSelector('.npc-population',{state:'attached',timeout:30000});
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
  const lab=document.querySelector('#bodyFrame').contentWindow.HumanLab;
  const stopped=lab.population.control('stop','all');
  const rejected=stopped.filter(row=>row.accepted===false);
  if(rejected.length)throw Error('browser setup could not stop all NPC tasks: '+JSON.stringify(rejected));
  const rows=lab.population.list();
  if(rows.length<2)throw Error('browser cast must contain at least two NPCs');
  const chosen=rows[0];lab.population.select([chosen.id]);
  return{chosenId:chosen.id,chosenLabel:chosen.label,rows:rows.map(row=>({id:row.id,completed:lab.population.get(row.id).agent.stats.completed,position:[...lab.population.get(row.id).agent.pos]}))};
 });
 await page.waitForFunction(label=>document.querySelector('[data-el="taskRecipients"]')?.textContent===`任务接收者（1）：${label}`,before.chosenLabel,{timeout:10000});
 const execution=await page.evaluate(()=>{
  const lab=document.querySelector('#bodyFrame').contentWindow.HumanLab;
  const result=lab.population.dispatch('挥手',{targets:'selected',mode:'replace'});
  lab.advance(4.2);
  return{result,rows:lab.population.list().map(row=>({id:row.id,completed:lab.population.get(row.id).agent.stats.completed,error:lab.population.get(row.id).agent.error,position:[...lab.population.get(row.id).agent.pos]})),selected:lab.population.list().filter(row=>row.selected).map(row=>row.id)};
 });
 assert.deepEqual(execution.selected,[before.chosenId]);
 assert.equal(execution.result.length,1);
 assert.equal(execution.result[0].id,before.chosenId);
 assert.equal(execution.result[0].accepted,true,execution.result[0].reason||'selected NPC rejected browser task');
 const beforeById=new Map(before.rows.map(row=>[row.id,row]));
 const chosenAfter=execution.rows.find(row=>row.id===before.chosenId);
 assert(chosenAfter.completed>beforeById.get(before.chosenId).completed,'selected NPC did not complete its wave');
 for(const row of execution.rows)if(row.id!==before.chosenId)assert.equal(row.completed,beforeById.get(row.id).completed,'unselected NPC completed a task unexpectedly: '+row.id);
 assert.equal(chosenAfter.error,null,'selected NPC ended with an error');
 await mkdir('artifacts',{recursive:true});
 await page.screenshot({path:'artifacts/task-runtime-browser.png',fullPage:true});
 console.log(JSON.stringify({passed:true,startup:startup.startup.status,population:execution.rows.length,selected:execution.selected,recipientText:`任务接收者（1）：${before.chosenLabel}`,selectedCompletedDelta:chosenAfter.completed-beforeById.get(before.chosenId).completed,unselectedCompletedDelta:execution.rows.filter(row=>row.id!==before.chosenId).reduce((sum,row)=>sum+row.completed-beforeById.get(row.id).completed,0),pageErrors:pageErrors.length,screenshot:'artifacts/task-runtime-browser.png'}));
}finally{
 await browser.close();
}
