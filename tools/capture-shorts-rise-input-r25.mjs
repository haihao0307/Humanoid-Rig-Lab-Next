// Capture the actual accepted R2.4 browser state used as the physical input
// for R2.5. This is diagnostic evidence only; it does not install a gusset.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire('/tmp/shorts-browser/package.json');
const {chromium}=require('playwright');
const output=process.env.SHORTS_R25_INPUT_OUTPUT||'/tmp/shorts-r25-input';
fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1080},deviceScaleFactor:1});
page.setDefaultTimeout(900000);
const errors=[];page.on('pageerror',error=>errors.push(String(error.stack||error)));
try{
 await page.goto('http://127.0.0.1:8793/shorts.html?shorts=1&shortsSteps=0&shortsStage=r2.4-rise',{waitUntil:'domcontentloaded',timeout:900000});
 await page.waitForFunction(()=>window.__startupError||['rise-ready','rise-checkpoint-failed'].includes(window.HumanLab?.compact?.skirt?.assemblyState),null,{timeout:900000});
 const startup=await page.evaluate(()=>({error:window.__startupError||null,status:window.__humanStartup||null}));if(startup.error)throw Error(startup.error);
 const data=await page.evaluate(()=>({report:window.HumanLab.garment.report(),snapshot:window.HumanLab.compact.skirt.simulation.snapshot()}));
 fs.writeFileSync(path.join(output,'rise-report.json'),JSON.stringify(data.report,null,2));
 fs.writeFileSync(path.join(output,'rise-snapshot.json'),JSON.stringify(data.snapshot));
 fs.writeFileSync(path.join(output,'browser-errors.json'),JSON.stringify(errors,null,2));
 const rise=data.report.rise,failureReasons=[];
 if(data.report.assemblyState!=='rise-ready'||rise?.valid!==true)failureReasons.push('R2.4 input is not accepted');
 if(rise?.strictUnexpectedIntersectionFree!==true||rise?.bodyContactValidated!==true||rise?.selfContactValidated!==true)failureReasons.push('R2.4 contact gate');
 if(errors.length)failureReasons.push('browser errors');
 const status={actualBrowser:true,stage:'R2.5 physical input capture',assemblyState:data.report.assemblyState,stepIndex:data.snapshot.stepIndex,
  maximumPrincipalStrain:rise?.materialAtCheckpoint?.maxAbsPrincipalStrain??null,strictUnexpectedIntersectionFree:rise?.strictUnexpectedIntersectionFree===true,
  bodyContactValidated:rise?.bodyContactValidated===true,selfContactValidated:rise?.selfContactValidated===true,failureReasons};
 fs.writeFileSync(path.join(output,'status.json'),JSON.stringify(status,null,2));console.log(JSON.stringify(status));if(failureReasons.length)throw Error(failureReasons.join('; '));
}catch(error){fs.writeFileSync(path.join(output,'failure.txt'),String(error.stack||error));throw error;}finally{await browser.close();}
