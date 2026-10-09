// Tests the real, immutable delivery URL after the branch build is published.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const sha=process.env.PUBLIC_COMMIT;if(!/^[0-9a-f]{40}$/.test(sha||''))throw Error('PUBLIC_COMMIT must be immutable');
const raw='https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/'+sha+'/skin-quality-lab/emily-transfer/preview.html',url='https://htmlpreview.github.io/?'+raw;
const OUT=path.resolve('qa-et08');fs.mkdirSync(OUT,{recursive:true});let b,p;const report={schema:'kaopu/eye-stage1-public@1',version:'ET08-S1',commit:sha,url,checks:[],realMobileDeviceTested:false,errors:[]};
function check(name,pass,detail){report.checks.push({name,pass:!!pass,detail});assert(pass,name+' '+JSON.stringify(detail));}
(async()=>{
 b=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});p=await b.newPage({viewport:{width:1440,height:1040},deviceScaleFactor:1});p.on('pageerror',e=>report.errors.push(e.message));
 // A freshly pushed public raw file can briefly return 404 from one CDN edge.
 let ready=false;for(let attempt=0;attempt<3;attempt++){
  await p.goto(url,{waitUntil:'domcontentloaded',timeout:120000});
  try{await p.waitForFunction(()=>window.__STAGE1__&&window.__SKIN_LAB__?.state.ready,null,{timeout:150000});ready=true;break;}catch(e){report.lastLoadError=e.message;if(attempt===2)throw e;await p.waitForTimeout(4000);}
 }
 check('actual public page loaded',ready);check('expected stage version',await p.evaluate(()=>__STAGE1__.version==='ET08-S1'));
 await p.evaluate(()=>{window.__EYE_QA_FREEZE__=true;__STAGE1__.pose(0);__SKIN_LAB__.render();});
 report.neutral=await p.evaluate(()=>__STAGE1__.report());report.diagnostics=await p.evaluate(()=>__STAGE1__.diagnostics());
 const pixels=await p.evaluate(()=>{const src=document.querySelector('#viewport canvas'),c=document.createElement('canvas');c.width=160;c.height=120;const x=c.getContext('2d');x.drawImage(src,0,0,160,120);const d=x.getImageData(0,0,160,120).data;let min=255,max=0,n=0;for(let i=0;i<d.length;i+=4){const v=(d[i]+d[i+1]+d[i+2])/3;min=Math.min(min,v);max=Math.max(max,v);if(v>70)n++;}return {min,max,brightPixels:n};});
 check('rendered face pixels present',pixels.max-pixels.min>60&&pixels.brightPixels>2000,pixels);await p.screenshot({path:OUT+'/public-desktop.png'});
 await p.click('[data-s1-closure="1"]');await p.evaluate(()=>__SKIN_LAB__.render());report.closure=await p.evaluate(()=>__STAGE1__.report());check('public full-closure control',report.closure.currentClosure===1&&report.closure.eyes.every(e=>e.actualClosedMarginGapMM<.00002),report.closure.eyes.map(e=>e.actualClosedMarginGapMM));await p.screenshot({path:OUT+'/public-closed.png'});
 await p.click('#s1Neutral');await p.focus('#s1Compare');await p.keyboard.down('Space');check('public held original contour',await p.evaluate(()=>__STAGE1__.report().comparison==='ET07.3'));await p.keyboard.up('Space');check('public release restores new contour',await p.evaluate(()=>__STAGE1__.report().comparison==='ET08-S1'));
 await p.setViewportSize({width:390,height:844});await p.evaluate(()=>{__STAGE1__.view('front');__SKIN_LAB__.render();});await p.screenshot({path:OUT+'/public-mobile-viewport.png'});await p.click('[data-quick=".5"]');check('public mobile viewport half-closure',await p.evaluate(()=>__STAGE1__.report().currentClosure===.5));await p.click('[data-quick="0"]');await p.click('#mobileToggle');await p.screenshot({path:OUT+'/public-mobile-panel.png'});
 check('public original link retained',await p.locator('a.s1-original').getAttribute('href')==='https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/5be35195ad40d57507f7ab1785e4eecda6c648de/skin-quality-lab/emily-transfer/preview.html');check('no public runtime errors',report.errors.length===0,report.errors);report.pass=true;
})().catch(e=>{report.pass=false;report.error=e.stack;console.error(e);process.exitCode=1;}).finally(async()=>{if(p&&!report.pass)await p.screenshot({path:OUT+'/public-failure.png'}).catch(()=>{});if(b)await b.close();fs.writeFileSync(OUT+'/public-report.json',JSON.stringify(report,null,2));console.log('ET08_PUBLIC_VERIFY',JSON.stringify(report));});
