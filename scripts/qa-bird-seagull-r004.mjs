import http from 'node:http';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const root=process.cwd();
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
  try{
    const raw=decodeURIComponent((req.url||'/').split('?')[0]);
    const safe=normalize(raw==='/'?'/index.html':raw).replace(/^([/\\])+/,'');
    const file=join(root,safe);
    const info=await stat(file);
    if(!info.isFile())throw new Error('not a file');
    const body=await readFile(file);
    res.writeHead(200,{'content-type':mime[extname(file)]||'application/octet-stream','cache-control':'no-store'});
    res.end(body);
  }catch(error){res.writeHead(404,{'content-type':'text/plain; charset=utf-8'});res.end(String(error))}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const {port}=server.address();

const browser=await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const results=[];

async function inspect(label,url,screenshot){
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
  const consoleMessages=[];const pageErrors=[];
  page.on('console',msg=>consoleMessages.push(`${msg.type()}: ${msg.text()}`));
  page.on('pageerror',error=>pageErrors.push(error.stack||error.message));
  let report;
  try{
    await page.goto(url,{waitUntil:'networkidle',timeout:60000});
    await page.waitForFunction(()=>window.__BIRD_QA?.ready===true||window.__BIRD_QA?.ready===false,{timeout:30000});
    await page.waitForTimeout(1200);
    report=await page.evaluate(async()=>{
      const canvas=document.getElementById('c');
      const status=document.getElementById('status');
      const qa=window.__BIRD_QA||null;
      const gl=canvas?.getContext('webgl');
      let changedSamples=-1;
      if(gl&&qa?.ready){
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        const sample=new Uint8Array(4);changedSamples=0;
        for(let yi=1;yi<36;yi++)for(let xi=1;xi<56;xi++){
          const x=Math.min(canvas.width-1,Math.floor((xi/56)*canvas.width));
          const y=Math.min(canvas.height-1,Math.floor((yi/36)*canvas.height));
          gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,sample);
          if(Math.abs(sample[0]-9)+Math.abs(sample[1]-15)+Math.abs(sample[2]-19)>30)changedSamples++;
        }
      }
      return {
        title:document.title,
        statusText:status?.textContent||null,
        statusClass:status?.className||null,
        qa,
        canvasClient:canvas?{width:canvas.clientWidth,height:canvas.clientHeight}:null,
        canvasBuffer:canvas?{width:canvas.width,height:canvas.height}:null,
        hasWebGL:Boolean(gl),
        changedSamples,
      };
    });
    await page.screenshot({path:screenshot,fullPage:true});
  }finally{await page.close()}
  const result={label,url,report,consoleMessages,pageErrors};
  results.push(result);
  if(!report?.qa?.ready)throw new Error(`${label}: runtime not ready: ${JSON.stringify(report)}`);
  if(!report.statusText?.includes('形态载入完成'))throw new Error(`${label}: status failed: ${report.statusText}`);
  if(!report.hasWebGL||report.changedSamples<20)throw new Error(`${label}: canvas blank: ${JSON.stringify(report)}`);
  if(report.canvasBuffer?.width<500||report.canvasBuffer?.height<300)throw new Error(`${label}: canvas buffer not resized: ${JSON.stringify(report.canvasBuffer)}`);
  if(pageErrors.length)throw new Error(`${label}: page errors: ${pageErrors.join('\n')}`);
}

let failure=null;
try{
  const local=`http://127.0.0.1:${port}/BIRD_SEAGULL_A_DIRECT_OPEN_R004/index.html`;
  await inspect('local',local,'bird-seagull-r004-local.png');

  const repo=process.env.GITHUB_REPOSITORY;
  const sha=process.env.GITHUB_SHA;
  if(repo&&sha){
    const hosted=`https://raw.githack.com/${repo}/${sha}/BIRD_SEAGULL_A_DIRECT_OPEN_R004/index.html?qa=${Date.now()}`;
    let hostedError;
    for(let attempt=1;attempt<=6;attempt++){
      try{await inspect(`hosted-attempt-${attempt}`,hosted,'bird-seagull-r004-hosted.png');hostedError=null;break}
      catch(error){hostedError=error;if(attempt<6)await new Promise(resolve=>setTimeout(resolve,10000))}
    }
    if(hostedError)throw hostedError;
  }
}catch(error){failure=error.stack||error.message}
finally{await browser.close();server.close()}

const output={generatedAt:new Date().toISOString(),results,failure};
await writeFile('bird-seagull-r004-browser-qa.json',JSON.stringify(output,null,2)+'\n','utf8');
console.log(JSON.stringify(output,null,2));
if(failure)throw new Error(failure);
