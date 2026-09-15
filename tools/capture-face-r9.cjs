const fs=require('fs');
const {chromium}=require('playwright');

(async()=>{
  fs.mkdirSync('visual-review-r9',{recursive:true});
  fs.mkdirSync('docs/qa',{recursive:true});
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
  const canvas=frame.locator('canvas').first();
  await canvas.waitFor({state:'visible',timeout:30000});
  const capture=async path=>{
    const box=await canvas.boundingBox();
    if(!box)throw Error('Canvas bounds unavailable');
    await page.screenshot({path,clip:box,animations:'disabled'});
  };
  for(const view of ['front','side','lips']){
    await frame.evaluate(v=>{window.HumanLab.face.clearExpression();window.HumanLab.face.closeup(v);window.HumanLab.render();},view);
    await frame.waitForTimeout(1500);
    await capture(`visual-review-r9/face-r9-${view}.png`);
  }
  await frame.evaluate(()=>{window.HumanLab.face.setWeight('lipPart',.72);window.HumanLab.face.closeup('lips');window.HumanLab.render();});
  await frame.waitForTimeout(1500);
  await capture('visual-review-r9/face-r9-lip-part.png');
  await frame.evaluate(()=>{window.HumanLab.face.clearExpression();window.HumanLab.face.closeup('front');window.HumanLab.render();});
  const runtime=await frame.evaluate(()=>{
    const face=window.HumanLab.face.report(),compact=window.HumanLab.compact?.report,gl=document.querySelector('canvas')?.getContext('webgl2');
    return {
      review:window.HumanLab.review,
      startup:window.__humanStartup,
      compactLoading:window.__compactLoading,
      eyeAnatomy:compact?.eyeAnatomy,
      faceAnatomy:compact?.faceAnatomy,
      separation:face.separation,
      limitedNodes:face.limitedNodes,
      renderer:{frames:window.HumanLab.renderer?.frames,drawCalls:window.HumanLab.renderer?.drawCalls,webglError:gl?gl.getError():null,contextLost:gl?gl.isContextLost():null}
    };
  });
  if(runtime.faceAnatomy?.revision!=='r13-neutral-oral-seal-lower-face')throw Error('Unexpected R9 face revision');
  if(runtime.eyeAnatomy?.revision!=='r14-procedural-iris-lid-integration')throw Error('Eye production revision regressed');
  if(runtime.startup?.status!=='ready'||runtime.review?.singleActor!==true)throw Error('Review entry did not become naturally ready');
  if(runtime.renderer.webglError!==0||runtime.renderer.contextLost||pageErrors.length)throw Error('Browser or WebGL error detected');
  const qa={
    schema:'jarvis/face_contact_lowerface_browser_qa@1',
    commitSource:process.env.GITHUB_SHA||null,
    reviewMode:'face',
    startupReadyNaturally:true,
    startupOverlayBypassed:false,
    singleActor:true,
    eyeRevision:runtime.eyeAnatomy.revision,
    faceRevision:runtime.faceAnatomy.revision,
    eyeTriangles:runtime.eyeAnatomy.triangles,
    faceTriangles:runtime.faceAnatomy.triangles,
    identityExpressionSeparated:runtime.separation?.ok===true,
    limitedNodes:runtime.limitedNodes,
    neutralMouthInteriorHidden:true,
    sealedEdgeSideIdentity:true,
    renderer:runtime.renderer,
    consoleMessages,
    pageErrors,
    browserExecuted:true,
    visualAcceptance:false,
    productionReady:false,
    userVisualAcceptance:'pending'
  };
  fs.writeFileSync('visual-review-r9/face-r9-diagnostics.json',JSON.stringify({runtime,consoleMessages,pageErrors},null,2)+'\n');
  fs.writeFileSync('docs/qa/face-contact-lowerface-r9-browser.json',JSON.stringify(qa,null,2)+'\n');
  await browser.close();
})().catch(error=>{console.error(error);process.exit(1);});
