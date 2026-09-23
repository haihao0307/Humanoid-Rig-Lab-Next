import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const repo=process.env.GITHUB_REPOSITORY;
const sha=process.env.GITHUB_SHA;
if(!repo||!sha)throw new Error('GITHUB_REPOSITORY/GITHUB_SHA missing');
const url=`https://rawcdn.githack.com/${repo}/${sha}/BIRD_SEAGULL_A_DIRECT_OPEN_R004/index.html`;
const browser=await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
const pageErrors=[];const failedRequests=[];const consoleMessages=[];
page.on('pageerror',error=>pageErrors.push(error.stack||error.message));
page.on('requestfailed',request=>failedRequests.push({url:request.url(),error:request.failure()?.errorText||null}));
page.on('console',msg=>consoleMessages.push(`${msg.type()}: ${msg.text()}`));
let result;
try{
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.__BIRD_QA?.ready===true||window.__BIRD_QA?.ready===false,{timeout:30000});
  await page.waitForTimeout(1500);
  result=await page.evaluate(async()=>{
    const canvas=document.getElementById('c');
    const status=document.getElementById('status');
    const gl=canvas?.getContext('webgl');
    let changedSamples=-1;
    if(gl&&window.__BIRD_QA?.ready){
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const sample=new Uint8Array(4);changedSamples=0;
      for(let yi=1;yi<36;yi++)for(let xi=1;xi<56;xi++){
        const x=Math.min(canvas.width-1,Math.floor((xi/56)*canvas.width));
        const y=Math.min(canvas.height-1,Math.floor((yi/36)*canvas.height));
        gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,sample);
        if(Math.abs(sample[0]-9)+Math.abs(sample[1]-15)+Math.abs(sample[2]-19)>30)changedSamples++;
      }
    }
    return {title:document.title,statusText:status?.textContent||null,qa:window.__BIRD_QA||null,hasWebGL:Boolean(gl),changedSamples,canvas:canvas?{clientWidth:canvas.clientWidth,clientHeight:canvas.clientHeight,width:canvas.width,height:canvas.height}:null};
  });
  await page.screenshot({path:'bird-seagull-r004-rawcdn.png',fullPage:true});
  const report={url,httpStatus:response?.status()||null,result,pageErrors,failedRequests,consoleMessages};
  await writeFile('bird-seagull-r004-rawcdn.json',JSON.stringify(report,null,2)+'\n','utf8');
  console.log(JSON.stringify(report,null,2));
  if(response?.status()!==200)throw new Error(`HTTP ${response?.status()}`);
  if(!result?.qa?.ready)throw new Error(`runtime not ready: ${JSON.stringify(result)}`);
  if(!result.statusText?.includes('形态载入完成'))throw new Error(`bad status: ${result.statusText}`);
  if(!result.hasWebGL||result.changedSamples<20)throw new Error(`blank canvas: ${JSON.stringify(result)}`);
  if(pageErrors.length)throw new Error(`page errors: ${pageErrors.join('\n')}`);
}finally{await browser.close()}
