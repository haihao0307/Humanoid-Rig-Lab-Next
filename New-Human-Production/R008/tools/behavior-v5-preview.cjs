const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const qa=path.resolve(__dirname,'../qa'),errors=[],report={createdAt:new Date().toISOString(),styles:[]};
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('http://127.0.0.1:8877/?version=R008-motion-5',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.HumanGame||window.failure,null,{timeout:120000});
  await page.evaluate(()=>{if(window.failure)throw Error(window.failure);HumanGame.setPaused(true);HumanGame.reset();window.advanceGame=n=>{for(let i=0;i<n;i++)HumanGame.step(1/120,false);};window.poseProbe=()=>{const h=HumanGame,s=h.subject,point=name=>s.byName.get(name).getWorldPosition(s.root.position.clone()).toArray(),l=point('upperarm_l'),r=point('upperarm_r');return {state:h.controller.snapshot(),phase:s.phase,idleTime:h.animator.idleTime,idleBlend:h.animator.idleBlend,weights:s.gaitWeights,shoulderSpan:Math.hypot(...l.map((v,i)=>v-r[i])),feet:[point('foot_l'),point('foot_r')],arms:['upperarm_l','upperarm_r'].map(n=>s.byName.get(n).quaternion.toArray()),activeStyle:h.animator.activeJumpStyle,finite:s.skeleton.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite))};};});
  report.standing=await page.evaluate(()=>poseProbe());
  report.walk=await page.evaluate(()=>{const h=HumanGame;h.controller.yaw=0;h.actor.rotation.y=0;h.actor.updateMatrixWorld(true);h.controller.speed=1.65;h.controller.phase='walk';let frames=[];for(let k=0;k<6;k++){for(let i=0;i<30;i++)h.animator.update(h.controller,1/120);frames.push(poseProbe());}h.camera.position.set(0,1.35,h.controller.z+4.4);h.camera.lookAt(0,1.05,h.controller.z);h.step(0);return frames;});
  assert(report.walk.every(p=>p.shoulderSpan>report.standing.shoulderSpan*.96&&p.finite));
  await page.screenshot({path:path.join(qa,'behavior-walk.png')});
  report.walkStrength=await page.evaluate(()=>{const h=HumanGame,s=h.subject,rows=[];for(let k=0;k<24;k++){for(let i=0;i<15;i++)h.animator.update(h.controller,1/120);rows.push({...poseProbe(),wrists:['l','r'].map(side=>{const bone=s.byName.get('hand_'+side),neutral=s.neutral.find(r=>r.o===bone);return bone.quaternion.angleTo(neutral.q);}),hands:['l','r'].map(side=>h.actor.worldToLocal(s.byName.get('hand_'+side).getWorldPosition(s.root.position.clone())).toArray())});}h.step(0);h.camera.position.set(3.8,1.55,h.controller.z+2.5);h.camera.lookAt(0,1.02,h.controller.z);HumanR008.renderer.render(h.scene,h.camera);return rows;});
  assert(report.walkStrength.every(p=>p.finite&&p.shoulderSpan>report.standing.shoulderSpan*.96&&p.wrists.every(a=>a<.22)));
  const handRange=side=>{const values=report.walkStrength.map(p=>p.hands[side][2]);return Math.max(...values)-Math.min(...values);};assert(handRange(0)>.12&&handRange(1)>.12);report.walkHandTravel=[handRange(0),handRange(1)];
  await page.screenshot({path:path.join(qa,'behavior-walk-side.png')});
  report.idleBefore=await page.evaluate(()=>{HumanGame.reset();advanceGame(306);HumanGame.step(0);return poseProbe();});assert(report.idleBefore.idleBlend===0);
  report.idlePlaying=await page.evaluate(()=>{advanceGame(110);HumanGame.step(0);return poseProbe();});assert(report.idlePlaying.phase==='look_around'&&report.idlePlaying.weights[3]>.7);await page.screenshot({path:path.join(qa,'behavior-v5-idle.png')});
  report.idleInterrupted=await page.evaluate(()=>{HumanGame.controller.press('KeyW');advanceGame(60);HumanGame.step(0);return poseProbe();});assert(report.idleInterrupted.idleBlend<.001&&report.idleInterrupted.weights[3]<.05);
  report.idleReplay=await page.evaluate(()=>{HumanGame.controller.clearInput();advanceGame(438);HumanGame.step(0);return {...poseProbe(),clipTime:HumanGame.subject.idleClipTime};});assert(report.idleReplay.weights[3]>.8&&report.idleReplay.clipTime<1.2);
  await page.selectOption('#jumpStyle','cmu-athletic');await page.evaluate(()=>{HumanGame.setPaused(true);HumanGame.reset();HumanGame.step(0);});await page.screenshot({path:path.join(qa,'behavior-v5-current.png')});
  report.errors=errors;report.parameterBytes=await page.evaluate(()=>HumanR008.data.packageBytes);assert.equal(errors.length,0);fs.writeFileSync(path.join(qa,'behavior-v5-browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({standingSpan:report.standing.shoulderSpan,walkSpan:report.walk.map(p=>p.shoulderSpan),idleWeight:report.idlePlaying.weights[3],idleExit:report.idleInterrupted.weights[3],errors},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
