const fs=require('fs'),path=require('path');
const file=path.join(__dirname,'quick.cjs');let source=fs.readFileSync(file,'utf8');
const anchor="await page.click('#reset');";
if(!source.includes(anchor))throw Error('Eye regression integration anchor absent');
source=source.replace(anchor,`
 async function pixels(){await page.evaluate(()=>__SKIN_LAB__.render());const b=await page.evaluate(()=>document.querySelector('#viewport canvas').toDataURL('image/png'));return require('pngjs').PNG.sync.read(Buffer.from(b.split(',')[1],'base64'));}
 function difference(a,b){assert.equal(a.width,b.width);let n=0;for(let i=0;i<a.data.length;i+=4)n+=Math.abs(a.data[i]-b.data[i])+Math.abs(a.data[i+1]-b.data[i+1])+Math.abs(a.data[i+2]-b.data[i+2]);return n/(a.width*a.height*3);}
 await page.click('[data-camera="eyes"]');await page.selectOption('#eyeMode','camera');
 await page.evaluate(()=>{__EYES__.set({autoBlink:false,autoPupil:false,pupilMM:2,manualBlink:-1,squint:0});__EYES__.step(0,true)});let a=await pixels();
 await page.evaluate(()=>{__EYES__.set({pupilMM:6});__EYES__.step(0,true)});let b=await pixels();report.checks.pupilPixelDifference=difference(a,b);assert(report.checks.pupilPixelDifference>.005);
 await page.evaluate(()=>{__EYES__.set({pupilMM:3.4,squint:0});__EYES__.step(0,true)});a=await pixels();
 await page.locator('#researchSquint').evaluate(e=>{e.value='.65';e.dispatchEvent(new Event('input',{bubbles:true}))});b=await pixels();report.checks.squintPixelDifference=difference(a,b);assert(report.checks.squintPixelDifference>.005);await shot('08-squint');
 await page.click('#researchRelease');await page.evaluate(()=>__EYES__.step(0,true));
 await page.selectOption('#eyeIris','green');await page.click('#save');await page.selectOption('#eyeIris','brown');await page.click('#restore');assert.equal(await page.locator('#eyeIris').inputValue(),'green');report.checks.recipeRestore=true;await page.selectOption('#eyeIris','blue');
 await page.click('[data-camera="portrait"]');await page.evaluate(()=>__EYES__.step(0,true));await page.selectOption('#transferMode','split');await page.click('[data-method="enhanced"]');await shot('09-skin-comparison');report.checks.skinComparisonRetained=true;
 await page.selectOption('#transferMode','full');await page.click('[data-method="emily"]');
 `+anchor);
source=source.replace("const report={version:'ET03',","const report={version:'ET03',networkInterception:false,physicalMobileDevice:false,validatedAt:new Date().toISOString(),");
const generated=path.join(__dirname,'.accept-run.cjs');fs.writeFileSync(generated,source);
require(generated);
