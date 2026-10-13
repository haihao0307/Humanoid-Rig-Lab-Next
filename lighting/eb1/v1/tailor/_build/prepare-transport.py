from pathlib import Path
import json,hashlib
r=Path(__file__).resolve().parents[1]
p=r/'index.html';s=p.read_text();anchor='<script type="module" src="app.mjs"></script>'
assert s.count(anchor)==1
s=s.replace(anchor,'<script type="module" src="visible-transport.mjs"></script>'+anchor)
s=s.replace('MP04.3 · 原生材料 / 单层体积 / 人物动作','MP04.3 · 原生材料 / 单层体积 / 画内动作播放')
p.write_text(s)
# Keep the exact publicly tested runtime. Only its page and transport extension differ.
(r/'TRANSPORT_SCOPE.json').write_text(json.dumps({'parentRuntimeCommit':'d08f5eef4142aabf523d4cd72176b45d825c0e3c','transportRevision':1,'physicsChanged':False,'materialRenderingChanged':False,'changes':['original motion buttons moved into the visible stage','light and inside-inspection clicks focus the stage','original physics status visible beside the person'],'invariantRuntimeHashes':{n:hashlib.sha256((r/n).read_bytes()).hexdigest() for n in ['app.mjs','solid-textiles.mjs','material-shaders.mjs','cloth-controller.mjs','cloth-worker.mjs','motion-cache.mjs','cloth-kernel.wasm']},'userAccepted':False},ensure_ascii=False,indent=2))
p=r/'qa-release.cjs';s=p.read_text()
old="const shot=async name=>{const clip=await p.locator('#stage').boundingBox();await p.screenshot({path:path.join(out,name+'.png'),clip,timeout:240000});console.log('PUBLIC_PIXELS',family,name);save();};"
new="""const cdp=await p.context().newCDPSession(p);
const shot=async name=>{await p.evaluate(()=>{const e=document.getElementById('stage');window.scrollTo({top:Math.max(0,e.getBoundingClientRect().top+scrollY-8),behavior:'instant'});});const box=await p.locator('#stage').boundingBox();assert(box&&box.y>=-1&&box.y<100,'stage must be in viewport');const image=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(image.data,'base64'));console.log('PUBLIC_PIXELS',family,name);save();};"""
assert s.count(old)==1;s=s.replace(old,new)
s=s.replace('realPublicNetwork:true','realPublicNetwork:true,visibleTransportRequired:true,screenshotMethod:"actual CDP browser surface",preservedFailedCaptureRuns:[38352922606,38354432895]')
s=s.replace('const a=await ready(id);report.rows.push', "const a=await ready(id);assert(await p.evaluate(()=>window.__MP04_TRANSPORT__?.originalButtonsMoved&&[...document.querySelectorAll('[data-motion]')].length===3&&[...document.querySelectorAll('[data-motion]')].every(b=>document.getElementById('stage').contains(b))));report.rows.push")
old="   await p.locator('[data-motion=\"'+motion+'\"]').click();"
new="""   await p.evaluate(()=>{window.__liveFrames=[];window.__observePlayback=true;const d=window.__MP04__.debug(),base=Array.from(d.model.positions);const observe=()=>{if(!window.__observePlayback)return;const f=d.physics.frame?.audit;if(f?.cachedPhysicalReplay&&window.__liveFrames.at(-1)?.frame!==f.frameSequence){let change=0;for(let i=0;i<base.length;i++)change=Math.max(change,Math.abs(d.model.positions[i]-base[i]));window.__liveFrames.push({frame:f.frameSequence,time:f.motionTime,maximumBodyChangeM:change,sameBodyAndClothFrame:f.bodyFrameMatchesCloth});}requestAnimationFrame(observe);};requestAnimationFrame(observe);});
   await p.locator('[data-motion="'+motion+'"]').click();"""
assert s.count(old)==1;s=s.replace(old,new)
old="   await p.locator('#motion-pause').click();await p.evaluate(i=>window.__MP04__.seekMotionFrame(i),frame);"
new="""   await p.waitForFunction(()=>window.__liveFrames.length>=2,{},{timeout:60000});await p.locator('#motion-pause').click();
   const naturalFrames=await p.evaluate(()=>{window.__observePlayback=false;return window.__liveFrames;});assert(naturalFrames.length>=2&&naturalFrames.at(-1).frame>naturalFrames[0].frame);assert(naturalFrames.every(f=>f.sameBodyAndClothFrame));
   const stopped=await p.evaluate(()=>window.__MP04__.debug().physics.frame.audit.frameSequence);await p.waitForTimeout(250);assert.equal(await p.evaluate(()=>window.__MP04__.debug().physics.frame.audit.frameSequence),stopped);
   const controlInView=await p.locator('#motion-pause').boundingBox();assert(controlInView.y>=0&&controlInView.y+controlInView.height<=1000);
   report.rows.push({case:id+'-'+motion+'-natural-playback',naturalFrames,pauseStable:true,controlInView,realDeviceFPSClaimed:false});save();
   await p.evaluate(i=>window.__MP04__.seekMotionFrame(i),frame);"""
assert s.count(old)==1;s=s.replace(old,new)
s=s.replace("await p.screenshot({path:path.join(out,'mobile-viewport.png'),timeout:240000});", "await shot('mobile-viewport');")
s=s.replace("await p.screenshot({path:path.join(out,'failure.png'),timeout:30000}).catch(()=>{});", "await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false}).then(i=>fs.writeFileSync(path.join(out,'failure.png'),Buffer.from(i.data,'base64'))).catch(()=>{});")
p.write_text(s)
p=r/'_build/publish-snapshot.py';s=p.read_text().replace("branch='fix/tailor-mp04-public-finish-20261013'", "branch='fix/tailor-mp04-visible-transport-20261013'");p.write_text(s)
p=r/'README.md';p.write_text(p.read_text()+'\n\n## 画内播放控制修复\n\n原动作按钮及暂停按钮现在位于三维画布内，保留唯一的原按钮和原事件处理。动作状态同步显示在人物旁；灯光特写、衣物内侧与衣摆测试会自动回到画布，避免点击后人物滚出视口。渲染器、原人物、衣物物理及真实动作缓存没有变化。首次两次公开检查的截图裁剪/元素稳定等待失败保留，后续使用原生浏览器画面截图并检查实际自动播放与暂停，不能把此前失败改写成成功。\n')
print('Visible controls activated. Core renderer and physics unchanged; actual public acceptance still required.')
