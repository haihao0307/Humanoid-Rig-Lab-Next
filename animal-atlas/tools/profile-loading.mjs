import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {playwright} from './dependencies.mjs';
const label=process.argv[2]||'before',file=process.argv[3]||'打开动物集成工作台.html';
const browser=await playwright().chromium.launch({headless:true,args:['--enable-webgl','--use-angle=d3d11']});
const page=await browser.newPage({viewport:{width:1680,height:1000}}),errors=[],network=[];
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
const report={label,startedAt:new Date().toISOString(),htmlSha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),bytes:fs.statSync(file).size,cases:[]};
await page.addInitScript(()=>{globalThis.__LOAD_LONG_TASKS__=[];try{new PerformanceObserver(list=>{for(const e of list.getEntries())__LOAD_LONG_TASKS__.push({start:e.startTime,duration:e.duration});}).observe({type:'longtask',buffered:true});}catch{}});
try{
 let start=Date.now();await page.goto(pathToFileURL(path.resolve(file)).href,{waitUntil:'domcontentloaded',timeout:180000});report.domMs=Date.now()-start;await page.waitForFunction(()=>window.__ATLAS__?.ready,null,{timeout:180000});report.bootMs=Date.now()-start;
 const ids=process.env.ATLAS_LOADING_IDS?.split(',')||['pig','starling','eagle','bear','dog','crab','chicken','fish','pig','starling','eagle','fish'];
 for(const id of ids){start=Date.now();await page.evaluate(id=>__ATLAS_BOOT__.select(id),id);await page.waitForFunction(id=>window.__ATLAS__?.ready&&__ATLAS__.current===id,id,{timeout:180000});
  const metrics=await page.evaluate(()=>{const w=document.getElementById('animal-frame').contentWindow;return {frameMs:w.performance.now(),longTasks:w.__LOAD_LONG_TASKS__||[],loading:window.__ATLAS_LOADING__?.last,cache:window.__ATLAS_LOADING__?.stats?.()};});
  const row={id,readyMs:Date.now()-start,...metrics};report.cases.push(row);console.log(JSON.stringify(row));await page.waitForTimeout(150);
 }
 report.passed=errors.length===0&&network.length===0;
}catch(e){report.passed=false;report.failure=e.stack;console.error(e);}finally{report.errors=errors;report.network=network;report.completedAt=new Date().toISOString();fs.writeFileSync(`qa/LOADING_${label.toUpperCase()}.json`,JSON.stringify(report,null,2));await browser.close();}
if(!report.passed)process.exitCode=1;
