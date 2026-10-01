// Optional real-browser QA. Set PLAYWRIGHT_MODULE / CHROME_PATH if necessary.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../qa/head-r11');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto((process.env.HUMAN_PREVIEW_URL||'http://127.0.0.1:8877/')+'?version=R008-head-11&view=face');
  await page.waitForFunction(()=>window.HumanGame||window.failure,null,{timeout:120000});
  await page.evaluate(async()=>{
   if(window.failure)throw Error(window.failure);
   const T=await import('three'),h=HumanGame;HumanR008.renderer.setAnimationLoop(null);
   h.setPaused(true);h.reset();h.faceExpression.demo=false;h.controller.yaw=0;h.actor.rotation.y=0;h.actor.updateMatrixWorld(true);h.subject.play('rest');h.subject.eyes.setMode('centre');
   window.review={neutral:new Float32Array(h.subject.mesh.geometry.attributes.position.array),neutralNormals:new Float32Array(h.subject.mesh.geometry.attributes.normal.array),T};
   review.camera=(yaw=0,pitch=0)=>{const target=h.subject.byName.get('head').getWorldPosition(new T.Vector3()).add(new T.Vector3(0,.045,.012));h.camera.position.copy(target).add(new T.Vector3(Math.sin(yaw)*Math.cos(pitch)*.58,Math.sin(pitch)*.58,Math.cos(yaw)*Math.cos(pitch)*.58));h.camera.lookAt(target);HumanR008.renderer.render(h.scene,h.camera);};
   review.pose=(mode,strength=1)=>{h.faceExpression.setMode(mode);h.faceExpression.intensity=strength;for(let i=0;i<100;i++)h.faceExpression.update(h.controller,1/60);};
  });
  const report={date:new Date().toISOString(),errors,presets:{},views:[],eyes:{}};
  const modes=await page.locator('#expression option').evaluateAll(a=>a.map(o=>o.value).filter(v=>v!=='auto'));
  for(const mode of modes){report.presets[mode]=[];for(const strength of [0,.5,1]) {
   const result=await page.evaluate(({mode,strength})=>{
    const h=HumanGame;review.pose(mode,strength);review.camera();
    const g=h.subject.mesh.geometry,a=g.attributes.position.array,n=g.attributes.normal.array;
    let minNormal=Infinity,maxNormal=0,maxChange=0,bodyChange=0;
    for(let i=0;i<n.length;i+=3){const len=Math.hypot(n[i],n[i+1],n[i+2]);minNormal=Math.min(minNormal,len);maxNormal=Math.max(maxNormal,len);const change=Math.hypot(a[i]-review.neutral[i],a[i+1]-review.neutral[i+1],a[i+2]-review.neutral[i+2]);maxChange=Math.max(maxChange,change);if(review.neutral[i+1]<1.53)bodyChange=Math.max(bodyChange,change);}
    return {strength,...h.faceExpression.report,finite:a.every(Number.isFinite)&&n.every(Number.isFinite),minNormal,maxNormal,maxChange,bodyChange,eyes:h.subject.eyes.report};
   },{mode,strength});
   assert(result.finite&&result.bodyChange===0&&result.minNormal>.99&&result.maxNormal<1.01);
   assert(result.minJacobian>.4);assert((result.maxCoordinateStretch||1)<1.751);if(!strength)assert(result.maxChange===0);
   report.presets[mode].push(result);
   if(strength===1)await page.screenshot({path:path.join(out,mode+'.png')});
  }}
  await page.evaluate(()=>review.pose('neutral'));
  for(const [name,yaw,pitch] of [['front',0,0],['left-quarter',.65,0],['right-quarter',-.65,0],['left-profile',1.57,0],['right-profile',-1.57,0],['rear',Math.PI,0],['top',0,.65],['underside',0,-.40]]){
   await page.evaluate(({yaw,pitch})=>review.camera(yaw,pitch),{yaw,pitch});await page.screenshot({path:path.join(out,name+'.png')});report.views.push(name);
  }
  for(const mode of ['centre','left','right','up','down','closed','leftClosed','rightClosed']) {
   report.eyes[mode]=await page.evaluate(mode=>{const h=HumanGame;h.subject.eyes.setMode(mode);for(let i=0;i<90;i++)h.faceExpression.update(h.controller,1/60);review.camera(.50);let finite=true,minNormal=Infinity,attachment=0;
    for(const e of h.subject.eyes.eyes)for(const {lid,rimRows} of e.lids){const g=lid.geometry,p=g.attributes.position,n=g.attributes.normal;finite&&=p.array.every(Number.isFinite)&&n.array.every(Number.isFinite);for(let i=0;i<n.count;i++)minNormal=Math.min(minNormal,Math.hypot(n.getX(i),n.getY(i),n.getZ(i)));for(let i=0;i<rimRows.length;i++){const r=rimRows[i];let expected=0;for(const {id,w} of r.samples)expected+=h.subject.mesh.geometry.attributes.position.getZ(id)*w;attachment=Math.max(attachment,Math.abs(p.getZ(i*9)+e.cz-expected));}}
    return {...h.subject.eyes.report,finite,minNormal,attachment};},mode);
   assert(report.eyes[mode].finite&&report.eyes[mode].minNormal>.99&&report.eyes[mode].attachment<1e-7);
   await page.screenshot({path:path.join(out,'eyes-'+mode+'.png')});
  }
  report.combinations=await page.evaluate(()=>{
   const s=HumanGame.subject,cases=[{mouthSmile:1,mouthPucker:1,cheekSquint:1},{browInnerUp:1,browDown:1,noseSneer:1,mouthUpperUp:1},{mouthFrown:1,chinRaise:1,mouthPress:1}];
   return cases.map(actions=>{const r=s.face.deformActions(actions),finite=s.mesh.geometry.attributes.position.array.every(Number.isFinite);s.face.reset();return {...r,finite};});
  });
  for(const r of report.combinations)assert(r.finite&&r.minJacobian>.4&&r.maxCoordinateStretch<1.751);
  assert(report.eyes.up.lidFollow[0]>.002&&report.eyes.down.lidFollow[0]<-.001);
  assert(report.eyes.leftClosed.closures[0]===1&&report.eyes.leftClosed.closures[1]<.001);
  assert(report.eyes.rightClosed.closures[1]===1&&report.eyes.rightClosed.closures[0]<.001);
  report.transitions=await page.evaluate(()=>{
   const h=HumanGame;h.subject.eyes.setMode('centre');review.pose('neutral');h.faceExpression.setMode('smile');let previous=new Float32Array(h.subject.mesh.geometry.attributes.position.array),maxStep=0;
   for(let frame=0;frame<300;frame++){if(frame===100)h.faceExpression.setMode('frown');if(frame===200)h.faceExpression.setMode('leftWink');h.faceExpression.update(h.controller,1/120);const a=h.subject.mesh.geometry.attributes.position.array;for(let i=0;i<a.length;i+=3)maxStep=Math.max(maxStep,Math.hypot(a[i]-previous[i],a[i+1]-previous[i+1],a[i+2]-previous[i+2]));previous.set(a);}
   review.pose('neutral');h.subject.eyes.blink();const blink=[];for(let i=0;i<40;i++){h.faceExpression.update(h.controller,1/120);blink.push(h.subject.eyes.report.closure);}
   review.pose('smile');document.getElementById('faceEnter').click();document.getElementById('faceEnter').click();for(let i=0;i<100;i++)h.faceExpression.update(h.controller,1/60);
   let restored=0;const a=h.subject.mesh.geometry.attributes.position.array;for(let i=0;i<a.length;i++)restored=Math.max(restored,Math.abs(a[i]-review.neutral[i]));
   review.pose('neutral');return {maxStep,blinkPeak:Math.max(...blink),blinkEnd:blink.at(-1),restoredExpression:restored,resetExact:a.every((v,i)=>v===review.neutral[i]),resetNormalsExact:h.subject.mesh.geometry.attributes.normal.array.every((v,i)=>v===review.neutralNormals[i])};
  });
  assert(report.transitions.maxStep<.002&&report.transitions.blinkPeak>.99&&report.transitions.blinkEnd<.01&&report.transitions.restoredExpression>.002&&report.transitions.resetExact&&report.transitions.resetNormalsExact);
  report.surface=await page.evaluate(()=>{const h=HumanGame,s=h.subject,parts=new Map(s.data.charts.map(c=>[c.id,c.part]));let headVertices=0,headTriangles=0,degenerate=0,badWeights=0;const p=s.surface.positions,index=s.surface.indices;
   for(let i=0;i<s.surface.chartIds.length;i++)if(parts.get(s.surface.chartIds[i])===2&&p[i*3+1]>1.53){headVertices++;let sum=0;for(let j=0;j<8;j++)sum+=s.surface.skinWeight[i*8+j];if(Math.abs(sum-1)>.0001)badWeights++;}
   for(let i=0;i<index.length;i+=3){const a=index[i]*3,b=index[i+1]*3,c=index[i+2]*3;if(p[a+1]<1.53||parts.get(s.surface.chartIds[index[i]])!==2)continue;headTriangles++;const u=[p[b]-p[a],p[b+1]-p[a+1],p[b+2]-p[a+2]],v=[p[c]-p[a],p[c+1]-p[a+1],p[c+2]-p[a+2]];if(Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])<1e-12)degenerate++;}
   return {headVertices,headTriangles,degenerate,badWeights,parameterBytes:h.subject.data.packageBytes};
  });
  assert(report.surface.headVertices>1000&&report.surface.badWeights===0);
  // Hardware rendering and the animation controller remain active in this QA.
  report.performance=await page.evaluate(async()=>{const h=HumanGame;review.pose('auto');h.controller.press('KeyW');h.controller.press('ShiftLeft');const times=[];let last=performance.now();for(let i=0;i<120;i++)await new Promise(resolve=>requestAnimationFrame(()=>{const now=performance.now();times.push(now-last);last=now;h.step(1/60);resolve();}));h.controller.clearInput();const gl=HumanR008.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');times.sort((a,b)=>a-b);return {median:times[60],p95:times[114],max:times.at(-1),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};});
  assert(!errors.length,errors.join('\n'));
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({presets:modes.length,views:report.views.length,transitions:report.transitions,surface:report.surface,performance:report.performance,errors}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
