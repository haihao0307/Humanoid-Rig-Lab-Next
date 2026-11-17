import fs from 'node:fs';import {createRequire} from 'node:module';
const {chromium}=createRequire('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const work='G:/Three.js/Human/Human-Motion-Continuity-R07-20261106/',endpoint=JSON.parse(fs.readFileSync(work+'.runtime/gray-gpu-research-playwright.json')),browser=await chromium.connectOverCDP(endpoint.cdp),context=await browser.newContext({viewport:{width:1280,height:850}}),page=await context.newPage(),errors=[],requests=[];
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{const u=new URL(r.url());if(u.pathname==='/api/atlas-segment')requests.push(u.pathname);});
let out;try{
 await page.route('**/api/research-body-track?*',async route=>{const id=new URL(route.request().url()).searchParams.get('id');if(id==='m2m_walk_female')await new Promise(r=>setTimeout(r,1000));await route.continue();});
 await page.route('**/api/atlas-source-info?*',async route=>{const id=new URL(route.request().url()).searchParams.get('id');if(id==='m2m_open_door')await new Promise(r=>setTimeout(r,2500));await route.continue();});
 await page.goto('http://127.0.0.1:19067/',{waitUntil:'domcontentloaded',timeout:240000});
 await page.waitForFunction(()=>{const r=window.grayResearchPreview?.report();return r?.ready&&r.frame!==null&&!r.busy},null,{timeout:300000});
 await page.evaluate(async()=>{const a=grayResearchPreview.selectAction('m2m_walk_female'),b=grayResearchPreview.selectAction('m2m_run_female'),c=grayResearchPreview.selectAction('m2m_open_door');await Promise.all([a,b,c]);});
 const waiting=await page.evaluate(()=>grayResearchPreview.report());
 await page.waitForFunction(()=>{const r=grayResearchPreview.report();return r.action==='m2m_open_door'&&r.selectedId==='m2m_open_door'&&r.frame===0&&!r.busy&&r.source.id==='m2m_open_door'&&r.source.position===0},null,{timeout:30000});
 const first=await page.evaluate(()=>grayResearchPreview.report());
 await page.evaluate(async()=>{document.querySelector('#play').click();const a=grayResearchPreview.selectAction('ual1_crouch_fwd_loop'),b=grayResearchPreview.selectAction('m2m_run_female');await Promise.all([a,b]);});
 await page.waitForFunction(()=>{const r=grayResearchPreview.report();return r.action==='m2m_run_female'&&r.selectedId==='m2m_run_female'&&r.frame===0&&!r.busy&&r.source.id==='m2m_run_female'&&r.source.position===0},null,{timeout:30000});
 const second=await page.evaluate(()=>grayResearchPreview.report());
 out={schema:'gray-rapid-action-switch/1',waiting,first,second,errors,segmentRequests:requests,releaseReady:false};
}catch(e){out={error:String(e),errors,segmentRequests:requests,releaseReady:false};console.error(e.stack);}finally{fs.writeFileSync(work+'review/gray-rapid-action-switch-20261115.json',JSON.stringify(out,null,2)+'\n');await context.close();await browser.close();}
console.log(JSON.stringify(out));if(out.error||errors.length||requests.length||out.waiting?.action!=='m2m_open_door'||out.waiting?.sourceVisible!==false||!out.first?.sourceVisible||!out.second?.sourceVisible||out.first?.gpuFallback||out.second?.gpuFallback)process.exitCode=2;
