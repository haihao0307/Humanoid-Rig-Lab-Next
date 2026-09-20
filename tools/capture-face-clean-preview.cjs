const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const crypto=require('node:crypto');
const {chromium}=require(process.env.HUMAN_PLAYWRIGHT_MODULE||'playwright');

const root=path.resolve(__dirname,'..');
const out=path.resolve(process.argv[2]||'');
if(!process.argv[2]||out===root||out.startsWith(root+path.sep))throw Error('Choose a QA directory outside the repository');
fs.mkdirSync(out,{recursive:true});
const tracked=['index.html','body/FaceAnatomy.js','body/BeardAnatomy.js','body/SkinAppearance.js','body/CharacterPresets.js','body/CompactWorkbench.js'];
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
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
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
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
    const setup=await frame.evaluate(()=>{
      const lab=window.HumanLab,renderer=lab.renderer,scale=lab.human.bodyMetrics.statureScale;
      lab.setAuto(false);if(lab.settings?.close)lab.settings.close();
      lab.face.clearExpression();lab.face.closeup('front');lab.tissue.setView('skin');
      lab.hair.enabled=false;
      renderer.target[1]+=.006*scale;renderer.distance=.28*scale;renderer.pitch=0;renderer.projection='perspective';
      renderer.setInspectionLighting({key:[-.62,.72,1],fill:[.78,.10,.58]});renderer.setQuality('fast');lab.render();
      const skin=lab.skin.export(),face=lab.compact.report.faceAnatomy;
      return {redness:skin.redness,beard:face.beard,groups:lab.compact.report.groups.map(group=>group.name)};
    });
    if(setup.redness!==0)throw Error('Default face redness was not removed: '+setup.redness);
    if(setup.beard?.strands!==0)throw Error('Procedural beard is still present: '+JSON.stringify(setup.beard));
    if(setup.groups.includes('faceBeard'))throw Error('faceBeard draw group is still present');

    const samples=[];
    for(const item of [{name:'clean-front',yaw:0},{name:'clean-angle',yaw:.46},{name:'clean-profile',yaw:1.12}]){
      const state=await frame.evaluate(({yaw})=>{
        const lab=window.HumanLab,renderer=lab.renderer,gl=renderer.gl;
        renderer.yaw=lab.agent.yaw+yaw;lab.render();
        if(gl.isContextLost())throw Error('WebGL context lost');
        const width=gl.drawingBufferWidth,height=gl.drawingBufferHeight,raw=new Uint8Array(width*height*4);
        gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,raw);
        const glError=gl.getError();if(glError!==gl.NO_ERROR)throw Error('WebGL readPixels error '+glError);
        const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
        const context=canvas.getContext('2d',{alpha:true}),image=context.createImageData(width,height),row=width*4;
        for(let y=0;y<height;y++)image.data.set(raw.subarray((height-1-y)*row,(height-y)*row),y*row);
        context.putImageData(image,0,0);
        return {dataURL:canvas.toDataURL('image/png'),canvas:{width,height},camera:{target:[...renderer.target],distance:renderer.distance,yaw:renderer.yaw,pitch:renderer.pitch},skin:lab.skin.export(),beard:lab.compact.report.faceAnatomy.beard,groups:lab.compact.report.groups.map(group=>group.name),glError:0};
      },item);
      const bytes=Buffer.from(state.dataURL.replace(/^data:image\/png;base64,/,''),'base64');delete state.dataURL;
      if(bytes.length<4096)throw Error(item.name+' capture was empty');
      const digest=crypto.createHash('sha256').update(bytes).digest('hex');
      fs.writeFileSync(path.join(out,item.name+'.png'),bytes);
      samples.push({name:item.name,bytes:bytes.length,sha256:digest,...state});
      console.log(item.name+' '+bytes.length+' '+digest);
    }
    if(new Set(samples.map(sample=>sample.sha256)).size!==samples.length)throw Error('Camera views did not change');
    const currentHashes=Object.fromEntries(tracked.map(file=>[file,hash(file)]));
    if(JSON.stringify(hashes)!==JSON.stringify(currentHashes))throw Error('Source changed during capture');
    const result={time:new Date().toISOString(),hashes,errors,setup,samples,productionModified:false,visualAcceptance:false};
    fs.writeFileSync(path.join(out,'capture.json'),JSON.stringify(result,null,2));
    if(errors.length)throw Error('Page errors: '+JSON.stringify(errors));
    console.log('CAPTURED '+out);
  }finally{
    await browser.close();await new Promise(resolve=>server.close(resolve));
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
