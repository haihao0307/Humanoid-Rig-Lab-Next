const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const crypto=require('node:crypto');
const {chromium}=require(process.env.HUMAN_PLAYWRIGHT_MODULE||'playwright');

const root=path.resolve(__dirname,'..');
const out=path.resolve(process.argv[2]||'');
if(!process.argv[2]||out===root||out.startsWith(root+path.sep))throw Error('Choose a QA directory outside the repository');
fs.mkdirSync(out,{recursive:true});
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
const tracked=['index.html','body/EyeAnatomy.js','body/FaceIdentity.js','body/FaceControls.js','body/CompactWorkbench.js'];
const hashes=Object.fromEntries(tracked.map(file=>[file,hash(file)]));
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  fs.readFile(file,(error,bytes)=>{
    if(error){res.writeHead(404);return res.end();}
    res.setHeader('Content-Type',file.endsWith('.html')?'text/html':/\.m?js$/.test(file)?'text/javascript':'application/octet-stream');
    res.end(bytes);
  });
});

(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:1500,height:1080},deviceScaleFactor:1});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/index.html?review=face&qa=1`);
    let frame=null;
    for(let i=0;i<240;i++){
      frame=page.frames().find(candidate=>candidate.name()==='bodyFrame')||null;
      if(frame){
        const startup=await frame.evaluate(()=>window.__humanStartup).catch(()=>null);
        if(startup?.status==='failed')throw Error(startup.error||startup.message||'Human startup failed');
        if(startup?.status==='ready')break;
      }
      await page.waitForTimeout(1000);
    }
    if(!frame||await frame.evaluate(()=>window.__humanStartup?.status)!=='ready')throw Error('Startup not ready');
    console.log('READY');

    await frame.evaluate(()=>{
      const lab=window.HumanLab;
      lab.setAuto(false);
      if(lab.settings?.close)lab.settings.close();
      lab.face.clearExpression();
      lab.face.closeup('front');
      lab.tissue.setView('skin');
      const scale=lab.human.bodyMetrics.statureScale,renderer=lab.renderer;
      renderer.target[1]+=.032*scale;
      renderer.distance=.19*scale;
      renderer.yaw=lab.agent.yaw;
      renderer.pitch=0;
      renderer.projection='perspective';
      renderer.setInspectionLighting({key:[-.65,.65,1],fill:[.8,.1,.6]});
      renderer.setQuality('fast');
      lab.render();
      renderer.gl.flush();
    });
    await page.waitForTimeout(250);

    const box=await page.locator('#bodyFrame').boundingBox();
    if(!box)throw Error('Body frame bounds missing');
    const viewport=page.viewportSize();
    const x=Math.max(0,box.x),y=Math.max(0,box.y);
    const clip={x,y,width:Math.max(1,Math.min(box.width,viewport.width-x)),height:Math.max(1,Math.min(box.height,viewport.height-y)),scale:1};
    const cdp=await page.context().newCDPSession(page);
    const samples=[];
    const digests=[];
    for(const item of [{name:'eyes',blink:0},{name:'eyes-half',blink:.5},{name:'eyes-closed',blink:1}]){
      const state=await frame.evaluate(({blink})=>{
        const lab=window.HumanLab,renderer=lab.renderer,gl=renderer.gl;
        lab.face.clearExpression();
        if(blink){lab.face.setWeight('eyeBlinkLeft',blink);lab.face.setWeight('eyeBlinkRight',blink);}
        lab.render();
        gl.flush();
        return {
          blink,
          camera:{target:[...renderer.target],distance:renderer.distance,yaw:renderer.yaw,pitch:renderer.pitch,projection:renderer.projection},
          triangles:lab.compact.report.triangles,
          eyeAnatomy:lab.compact.report.eyeAnatomy,
          expression:lab.face.expression(),
          contextLost:gl.isContextLost(),
          glError:gl.getError()
        };
      },item);
      await page.waitForTimeout(300);
      const shot=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false,clip});
      if(!shot.data||shot.data.length<4096)throw Error(item.name+' screenshot was empty');
      const bytes=Buffer.from(shot.data,'base64'),file=path.join(out,item.name+'.png'),digest=crypto.createHash('sha256').update(bytes).digest('hex');
      fs.writeFileSync(file,bytes);digests.push(digest);
      samples.push({name:item.name,bytes:bytes.length,sha256:digest,...state});
      console.log(item.name+' '+bytes.length+' '+digest);
    }
    await cdp.detach();
    if(new Set(digests).size<2)throw Error('Eye-state screenshots did not change');

    const currentHashes=Object.fromEntries(tracked.map(file=>[file,hash(file)]));
    if(JSON.stringify(hashes)!==JSON.stringify(currentHashes))throw Error('Source changed during diagnosis');
    const result={time:new Date().toISOString(),hashes,errors,samples,productionModified:false,visualAcceptance:false};
    fs.writeFileSync(path.join(out,'capture.json'),JSON.stringify(result,null,2));
    if(errors.length||samples.some(sample=>sample.glError!==0||sample.contextLost))throw Error('Runtime errors: '+JSON.stringify({errors,samples:samples.filter(sample=>sample.glError||sample.contextLost)}));
    if(samples.some(sample=>sample.eyeAnatomy?.revision!=='r25b-canthus-owned-aperture-family'))throw Error('Wrong eye revision in actual workbench');
    console.log('CAPTURED '+out);
  }finally{
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
