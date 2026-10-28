'use strict';
const {chromium}=require(process.env.BODY_PLAYWRIGHT_PATH||'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base=process.env.BODY_R35_BASE||'http://127.0.0.1:8915';
const ready=page=>page.waitForFunction(()=>{const r=window.bodyImplicitR02?.report();return r?.ready&&!r.busy;},null,{timeout:240000});
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.BODY_CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-gpu','--enable-unsafe-swiftshader']});
  const checks=[],errors=[];
  const check=(name,passed,detail)=>{checks.push({name,passed:!!passed,detail});if(!passed)throw Error(name);};
  try{
    const page=await browser.newPage({viewport:{width:1440,height:900}});
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/workbench',{waitUntil:'domcontentloaded'});
    await ready(page);
    await page.evaluate(()=>bodyControlR17.apply({set:{'shape.weight':.43,'pose.A.lowerarm01.L.0':30},label:'皮肤生命周期检查'}));
    await ready(page);
    await page.waitForFunction(()=>document.querySelector('#body-dynamic-embedded-p1')?.contentWindow?.torsoStudyP1?.renderer.precisionReport().ready,null,{timeout:240000});
    const summary=page.locator('summary').filter({hasText:'表面质感与细节'});
    await summary.click();
    check('surface-detail controls can be opened and used',await page.locator('[data-appearance="originalWrinkles"]').isVisible()&&await page.locator('[data-appearance="originalWrinkles"]').isEnabled());
    await page.locator('summary').filter({hasText:'散射与细绒毛'}).click();
    check('scattering controls can be opened and used',await page.locator('[data-appearance="originalDiffusion"]').isVisible()&&await page.locator('[data-appearance="originalDiffusion"]').isEnabled());
    const optimization=await page.evaluate(()=>{
      const f=document.querySelector('#body-dynamic-embedded-p1').contentWindow,r=f.torsoStudyP1.renderer,c=f.document.querySelector('#body-view'),gl=c.getContext('webgl2');
      gl.finish();const a=new Uint8Array(c.width*c.height*4);gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,a);
      const before=r.report(),input=document.querySelector('[data-appearance="originalTone"]');input.value='.25';input.dispatchEvent(new Event('input',{bubbles:true}));
      gl.finish();const b=new Uint8Array(a.length);gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,b);let changed=0;for(let i=0;i<a.length;i+=4)if(Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]))>1)changed++;
      const after=r.report();return{changed,geometryBefore:before.draws,geometryAfter:after.draws,skinBefore:before.originalActiveSkin.draws,skinAfter:after.originalActiveSkin.draws,shadowsBefore:before.dynamicShadow.updates,shadowsAfter:after.dynamicShadow.updates,error:gl.getError()};
    });
    check('skin adjustment reuses the current surface and shadows',optimization.changed>0&&optimization.geometryAfter===optimization.geometryBefore&&optimization.shadowsAfter===optimization.shadowsBefore&&optimization.skinAfter>optimization.skinBefore&&optimization.error===0,optimization);
    const canRestore=await page.evaluate(()=>{const f=document.querySelector('#body-dynamic-embedded-p1').contentWindow,c=f.document.querySelector('#body-view'),ext=c.getContext('webgl2').getExtension('WEBGL_lose_context');if(!ext)return false;ext.loseContext();setTimeout(()=>ext.restoreContext(),300);return true;});
    if(canRestore){
      await page.waitForFunction(()=>{const r=document.querySelector('#body-dynamic-embedded-p1')?.contentWindow?.torsoStudyP1?.renderer?.report();return r?.ready&&r.contextRecoveries>0;},null,{timeout:120000});
      const recovered=await page.evaluate(()=>{const f=document.querySelector('#body-dynamic-embedded-p1').contentWindow,r=f.torsoStudyP1.renderer.report();return{ready:r.ready,recoveries:r.contextRecoveries,tone:r.originalActiveSkin?.bodySurfaceControls?.psTone,skin:r.dynamicOriginalSkin,shadows:r.dynamicOriginalShadows,unknown:r.dynamicShadow?.unknownPixels,error:r.webglError};});
      check('graphics context restores the adjusted skin and dynamic shadows',recovered.ready&&recovered.recoveries>0&&recovered.tone===.25&&recovered.skin&&recovered.shadows&&recovered.unknown===0&&recovered.error===0,recovered);
    }else checks.push({name:'graphics context recovery',passed:true,detail:'Browser did not expose WEBGL_lose_context; not exercised.'});
    check('no browser exceptions',errors.length===0,errors);
  }catch(e){errors.push(e.stack);}finally{
    await browser.close();const passed=errors.length===0&&checks.every(x=>x.passed);console.log(JSON.stringify({passed,checks,errors}));if(!passed)process.exitCode=1;
  }
})();
