const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const crypto=require('node:crypto');
const {chromium}=require(process.env.HUMAN_PLAYWRIGHT_MODULE||'playwright');

const root=path.resolve(__dirname,'..');
const out=path.resolve(process.argv[2]||'');
if(!process.argv[2]||out===root||out.startsWith(root+path.sep))throw Error('Choose a QA directory outside the repository');
fs.mkdirSync(out,{recursive:true});
const tracked=['index.html','body/FaceAnatomy.js','body/SkinAppearance.js','body/CharacterPresets.js','body/CompactWorkbench.js'];
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
    const page=await browser.newPage({viewport:{width:640,height:640},deviceScaleFactor:1});
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
      lab.face.clearExpression();lab.face.closeup('front');lab.tissue.setView('skin');lab.hair.enabled=false;
      renderer.target[1]+=.004*scale;renderer.distance=.31*scale;renderer.pitch=0;renderer.projection='perspective';
      renderer.setInspectionLighting({key:[-.62,.72,1],fill:[.78,.10,.58]});renderer.setQuality('fast');lab.render();
      return {redness:lab.skin.export().redness,beard:lab.compact.report.faceAnatomy.beard,groups:lab.compact.report.groups.map(group=>group.name),eyeRevision:lab.compact.report.eyeAnatomy.revision};
    });
    if(setup.redness!==0)throw Error('Default redness is '+setup.redness);
    if(setup.beard?.strands!==0||setup.groups.includes('faceBeard'))throw Error('Beard remains '+JSON.stringify(setup));
    const capture=async(name,yaw)=>{
      const state=await frame.evaluate(({yaw})=>{
        const lab=window.HumanLab,renderer=lab.renderer,gl=renderer.gl;
        renderer.yaw=lab.agent.yaw+yaw;lab.render();
        if(gl.isContextLost())throw Error('WebGL context lost');
        const width=gl.drawingBufferWidth,height=gl.drawingBufferHeight,raw=new Uint8Array(width*height*4);
        gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,raw);
        const glError=gl.getError();if(glError!==gl.NO_ERROR)throw Error('WebGL error '+glError);
        const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
        const ctx=canvas.getContext('2d',{alpha:true}),image=ctx.createImageData(width,height),row=width*4;
        for(let y=0;y<height;y++)image.data.set(raw.subarray((height-1-y)*row,(height-y)*row),y*row);
        ctx.putImageData(image,0,0);
        return {dataURL:canvas.toDataURL('image/png'),canvas:{width,height},camera:{target:[...renderer.target],distance:renderer.distance,yaw:renderer.yaw,pitch:renderer.pitch},redness:lab.skin.export().redness,beard:lab.compact.report.faceAnatomy.beard,groups:lab.compact.report.groups.map(group=>group.name),glError:0};
      },{yaw});
      const bytes=Buffer.from(state.dataURL.replace(/^data:image\/png;base64,/,''),'base64');delete state.dataURL;
      if(bytes.length<4096)throw Error(name+' capture empty');
      const sha256=crypto.createHash('sha256').update(bytes).digest('hex');fs.writeFileSync(path.join(out,name+'.png'),bytes);
      return {name,bytes:bytes.length,sha256,...state};
    };
    const samples=[await capture('clean-front',0),await capture('clean-angle',.46)];
    if(samples[0].sha256===samples[1].sha256)throw Error('Camera views did not change');
    const currentHashes=Object.fromEntries(tracked.map(file=>[file,hash(file)]));
    if(JSON.stringify(hashes)!==JSON.stringify(currentHashes))throw Error('Source changed during capture');
    const result={time:new Date().toISOString(),hashes,errors,setup,samples,productionModified:false,visualAcceptance:false};
    fs.writeFileSync(path.join(out,'capture.json'),JSON.stringify(result,null,2));
    if(errors.length)throw Error('Page errors: '+JSON.stringify(errors));
    console.log(JSON.stringify({setup,samples:samples.map(s=>({name:s.name,bytes:s.bytes,sha256:s.sha256,canvas:s.canvas}))}));
  }finally{
    await browser.close();await new Promise(resolve=>server.close(resolve));
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
