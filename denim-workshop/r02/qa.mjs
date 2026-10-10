// Keep the full source/interaction suite and strengthen the mobile first-look gate.
import './qa-base.mjs';
import {chromium} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const out=process.env.QA_DIR||'denim-r02-evidence';
const browser=await chromium.launch({headless:false,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
try {
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const page=await context.newPage();const errors=[];
 page.on('pageerror', e=>errors.push(String(e)));
 await page.goto(process.env.PUBLIC_URL,{waitUntil:'domcontentloaded',timeout:90000});
 await page.waitForFunction(()=>window.__DENIM_WORKBENCH__?.ready===true,null,{timeout:120000});
 await page.waitForTimeout(500);
 const first=await page.locator('#view').boundingBox();
 assert.ok(first.y>=0 && first.y+first.height<=844, 'Cloth must be visible in the initial viewport, not above the scroll origin');
 assert.ok(first.width>=380 && first.height>=440);
 await page.screenshot({path:`${out}/mobile-first-look.png`});
 const initial=await page.evaluate(()=>({frame:__DENIM_WORKBENCH__.lastFrame,glError:__DENIM_WORKBENCH__.getGLError()}));
 assert.equal(initial.glError,0);assert.ok(initial.frame.frame>0);
 await page.locator('[data-preset="vintage"]').click();
 assert.equal(await page.evaluate(()=>__DENIM_WORKBENCH__.profile().finish.recipe),'vintage');
 await page.locator('#stage').scrollIntoViewIfNeeded();await page.waitForTimeout(300);
 const after=await page.locator('#view').boundingBox();
 assert.ok(after.y>=0 && after.y+after.height<=844);
 await page.screenshot({path:`${out}/mobile-return-to-cloth.png`});
 assert.deepEqual(errors,[]);
 fs.writeFileSync(`${out}/mobile-first-look.json`,JSON.stringify({passed:true,url:process.env.PUBLIC_URL,viewport:[390,844],actualPhone:false,first,after,initial,errors},null,2));
 console.log('MOBILE_FIRST_LOOK_PASSED',JSON.stringify(first));
 await context.close();
} finally {await browser.close();}
