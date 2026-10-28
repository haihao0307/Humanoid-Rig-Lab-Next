'use strict';
const {chromium}=require(process.env.BODY_PLAYWRIGHT_PATH||'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base=process.env.BODY_R35_BASE||'http://127.0.0.1:8915';
const ready=p=>p.waitForFunction(()=>window.bodyImplicitR02?.report().ready&&!bodyImplicitR02.report().busy,null,{timeout:240000});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.BODY_CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-gpu','--enable-unsafe-swiftshader']}),checks=[],errors=[];
 try{
  const page=await browser.newPage({viewport:{width:1200,height:800}});page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/workbench',{waitUntil:'domcontentloaded'});await ready(page);
  for(const phase of ['fixed A','fixed B','dynamic A']){
   if(phase==='fixed B'){await page.evaluate(()=>bodyImplicitR02.setOwner('mhr'));await ready(page);}
   if(phase==='dynamic A'){await page.evaluate(()=>bodyImplicitR02.setOwner('anny'));await ready(page);await page.evaluate(()=>bodyControlR17.apply({set:{'shape.weight':.43,'shape.muscle':.69,'pose.A.lowerarm01.L.0':30},label:'灯光检查'}));await ready(page);}
   for(const preset of ['studio','side','back','original']){
    await page.locator('#inspection-light').selectOption(preset);await ready(page);
    const value=await page.evaluate(()=>{const r=bodyImplicitR02.report().renderer,s=r.dynamicShadowR35||r.dynamicShadow;return{surface:r.activeSurface,material:r.sourceMaterialMode,skin:r.originalActiveSkin?.sourceActiveBodyMaterial,shadow:r.originalActiveSkin?.sourceShadows,unchanged:r.originalActiveSkin?.shadowDirectionsUnchanged,updates:s?.updates||0,unknown:s?.unknownPixels??0,error:r.dynamicShadowErrorR35||r.webglError||null};});
    const expected=phase==='dynamic A'?'dynamic-body-p1':'source';
    const passed=value.surface===expected&&value.skin&&value.shadow&&value.unknown===0&&!value.error&&(preset==='original'||value.updates>0);
    checks.push({phase,preset,passed:!!passed,...value});if(!passed)throw Error(phase+' / '+preset+' lighting failed');
   }
  }
 }catch(e){errors.push(e.stack);}finally{await browser.close();const passed=!errors.length&&checks.length===12&&checks.every(x=>x.passed);console.log(JSON.stringify({passed,checks,errors}));if(!passed)process.exitCode=1;}
})();
