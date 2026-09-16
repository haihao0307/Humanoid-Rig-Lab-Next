const fs=require('fs');
const {chromium}=require('playwright');

(async()=>{
  fs.mkdirSync('visual-review-r10',{recursive:true});
  const browser=await chromium.launch({
    headless:true,
    args:['--use-angle=swiftshader','--use-gl=angle','--enable-webgl','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-dev-shm-usage']
  });
  const context=await browser.newContext({viewport:{width:1600,height:1200},deviceScaleFactor:1});
  const page=await context.newPage(),consoleMessages=[],pageErrors=[];
  page.on('console',message=>consoleMessages.push({type:message.type(),text:message.text()}));
  page.on('pageerror',error=>pageErrors.push(String(error?.stack||error)));
  await page.goto('http://127.0.0.1:4173/index.html?review=face',{waitUntil:'domcontentloaded',timeout:120000});
  let frame=null;const deadline=Date.now()+420000;
  while(!frame&&Date.now()<deadline){
    for(const candidate of page.frames()){
      if(await candidate.evaluate(()=>Boolean(window.HumanLab?.face?.closeup)).catch(()=>false)){frame=candidate;break;}
    }
    if(!frame)await page.waitForTimeout(1000);
  }
  if(!frame)throw Error('Face review frame unavailable');
  await frame.waitForFunction(()=>window.__compactLoading?.state==='ready'&&window.__humanStartup?.status==='ready',null,{timeout:420000});
  await frame.waitForTimeout(5000);
  await frame.waitForFunction(()=>{const canvas=document.querySelector('canvas');return Boolean(canvas&&canvas.width>0&&canvas.height>0);},null,{timeout:30000});
  const capture=async path=>{
    const dataUrl=await frame.evaluate(()=>{
      const canvas=document.querySelector('canvas');
      if(!canvas)throw Error('Canvas unavailable');
      window.HumanLab?.render?.();
      return canvas.toDataURL('image/png');
    });
    const marker='base64,';
    const offset=dataUrl.indexOf(marker);
    if(offset<0)throw Error('Canvas PNG encoding unavailable');
    const bytes=Buffer.from(dataUrl.slice(offset+marker.length),'base64');
    if(bytes.length<10000)throw Error(`Canvas PNG unexpectedly small: ${bytes.length}`);
    fs.writeFileSync(path,bytes);
  };
  const neutral=async view=>{
    await frame.evaluate(v=>{window.HumanLab.face.clearExpression();window.HumanLab.face.closeup(v);window.HumanLab.render();},view);
    await frame.waitForTimeout(1500);
    await capture(`visual-review-r10/face-r10-neutral-${view}.png`);
  };
  for(const view of ['front','side','lips'])await neutral(view);

  for(const view of ['front','side','lips']){
    await frame.evaluate(v=>{window.HumanLab.face.clearExpression();window.HumanLab.face.setWeight('jawOpen',.72);window.HumanLab.face.setWeight('lipPart',.22);window.HumanLab.face.closeup(v);window.HumanLab.render();},view);
    await frame.waitForTimeout(1500);
    await capture(`visual-review-r10/face-r10-jaw72-${view}.png`);
  }
  await frame.evaluate(()=>{window.HumanLab.face.clearExpression();window.HumanLab.face.setWeight('jawOpen',1);window.HumanLab.face.setWeight('lipPart',.28);window.HumanLab.face.closeup('lips');window.HumanLab.render();});
  await frame.waitForTimeout(1500);
  await capture('visual-review-r10/face-r10-jaw100-lips.png');

  await frame.evaluate(()=>{window.HumanLab.face.clearExpression();window.HumanLab.face.setWeight('lipPart',.65);window.HumanLab.face.closeup('lips');window.HumanLab.render();});
  await frame.waitForTimeout(1500);
  await capture('visual-review-r10/face-r10-lip-part65.png');

  await frame.evaluate(()=>{window.HumanLab.face.clearExpression();window.HumanLab.face.closeup('front');window.HumanLab.render();});
  const runtime=await frame.evaluate(()=>{
    const face=window.HumanLab.face.report(),compact=window.HumanLab.compact?.report,gl=document.querySelector('canvas')?.getContext('webgl2');
    return {
      review:window.HumanLab.review,
      startup:window.__humanStartup,
      compactLoading:window.__compactLoading,
      eyeAnatomy:compact?.eyeAnatomy,
      faceAnatomy:compact?.faceAnatomy,
      recipeRevision:face.recipe?.revision,
      channels:face.recipe?.channels?.map(channel=>channel.id),
      separation:face.separation,
      limitedNodes:face.limitedNodes,
      renderer:{frames:window.HumanLab.renderer?.frames,drawCalls:window.HumanLab.renderer?.drawCalls,webglError:gl?gl.getError():null,contextLost:gl?gl.isContextLost():null}
    };
  });
  if(runtime.faceAnatomy?.revision!=='r14-jaw-oral-cavity')throw Error('Unexpected R10 face revision');
  if(runtime.recipeRevision!=='r5-jaw-oral-cavity'||!runtime.channels?.includes('jawOpen'))throw Error('Jaw expression contract missing');
  if(runtime.faceAnatomy?.jawPerformanceApproximation!==true||runtime.faceAnatomy?.oralStructures?.tongue!==true)throw Error('Layered oral anatomy report missing');
  if(runtime.eyeAnatomy?.revision!=='r14-procedural-iris-lid-integration')throw Error('Eye production revision regressed');
  if(runtime.startup?.status!=='ready'||runtime.review?.singleActor!==true)throw Error('Review entry did not become naturally ready');
  if(runtime.renderer.webglError!==0||runtime.renderer.contextLost||pageErrors.length)throw Error('Browser or WebGL error detected');
  fs.writeFileSync('visual-review-r10/face-r10-diagnostics.json',JSON.stringify({
    runtime,
    consoleMessages,
    pageErrors,
    browserExecuted:true,
    visualAcceptance:false,
    productionReady:false,
    userVisualAcceptance:'pending'
  },null,2)+'\n');
  await browser.close();
})().catch(error=>{console.error(error);process.exit(1);});
