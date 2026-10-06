const fs=require('fs'),path=require('path'),crypto=require('crypto'),{pathToFileURL}=require('url');
const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'qa/shorts-seam-first-trial-20261004');fs.mkdirSync(out,{recursive:true});
const frozen=path.join(root,'qa/shorts-paper-research-20261004/index.html');
let html=fs.readFileSync(frozen,'utf8');const begin=html.indexOf('const sources=')+'const sources='.length,end=html.indexOf(',urls={},building=',begin),modules=JSON.parse(html.slice(begin,end));
const trial=fs.readFileSync(path.join(root,'ShortsSeamFirstTrial.mjs'),'utf8');
modules['ShortsSeamFirstTrial.mjs']={source:trial.replace("import('./ShortsCoverageIntersection.mjs')","import(window.__R008_MODULE_URLS__['ShortsCoverageIntersection.mjs'])"),deps:[{specifier:'./ShortsClothRuntime.mjs',key:'ShortsClothRuntime.mjs'},{specifier:'./ShortsManufacturingDraft.mjs',key:'ShortsManufacturingDraft.mjs'}]};
html=html.slice(0,begin)+JSON.stringify(modules).replaceAll('</script','<\\/script')+html.slice(end);
html=html.replace('<script>window.__R008_PARAMETERS_URL__','<script>window.__SHORTS_PAPER_RESEARCH__=true;window.__SHORTS_PAPER_CONTACT_PROBE_ONLY__=true;window.__R008_PARAMETERS_URL__');
html=html.replace('import(entry).catch(e=>','import(entry).then(async()=>{const m=await import(moduleURL("ShortsSeamFirstTrial.mjs"));await window.HumanShorts.fitPromise;return m.installSeamFirstTrial();}).catch(e=>');
const artifact=path.join(out,'index.html');fs.writeFileSync(artifact,html);
const qa={startedAt:new Date().toISOString(),errors:[],artifactSHA256:crypto.createHash('sha256').update(html).digest('hex'),frozenNativeBuildSHA256:crypto.createHash('sha256').update(fs.readFileSync(frozen)).digest('hex'),trialSourceSHA256:crypto.createHash('sha256').update(trial).digest('hex'),productionReady:false};
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--no-sandbox']});const watchdog=setTimeout(()=>browser.close().catch(()=>{}),300000);let page;
try{const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.setOffline(true);page=await context.newPage();page.on('pageerror',e=>qa.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')qa.errors.push(m.text());});await page.goto(pathToFileURL(artifact).href,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.HumanShorts?.trialReport||window.failure,null,{timeout:250000});qa.result=await page.evaluate(()=>window.HumanShorts?.trialReport??{failure:window.failure,details:window.failureDetails});console.log(JSON.stringify({result:qa.result}));
if(qa.result.failure)throw Error(qa.result.failure);
qa.controls=[];for(const [view,label] of [['front','正面'],['back','背面'],['side','侧面'],['below','裆部']]){await page.getByRole('button',{name:label,exact:true}).click();qa.controls.push({view,actualButtonClicked:true});}
for(const view of ['front','back','side','below']){await page.evaluate(v=>HumanShorts.setView(v),view);await page.screenshot({path:path.join(out,view+'.png')});}
qa.finishedAt=new Date().toISOString();
}catch(e){qa.errors.push(e.stack);if(page)try{await page.screenshot({path:path.join(out,'failure.png')});}catch{}}
finally{clearTimeout(watchdog);await browser.close();fs.writeFileSync(path.join(out,'QA.json'),JSON.stringify(qa,null,2));console.log(JSON.stringify({report:path.join(out,'QA.json'),errors:qa.errors,sewingMetricPassed:qa.result?.sewingMetricPassed,assemblyPassed:qa.result?.assemblyPassed,productionReady:false}));}})().catch(e=>{console.error(e);process.exitCode=1;});
