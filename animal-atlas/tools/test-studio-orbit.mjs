import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {playwright} from './dependencies.mjs';

const report={startedAt:new Date().toISOString(),htmlSha256:crypto.createHash('sha256').update(fs.readFileSync('打开动物集成工作台.html')).digest('hex'),animals:[],checks:[],errors:[],network:[]};
const browser=await playwright().chromium.launch({headless:true,args:['--enable-webgl','--use-angle=d3d11']});
try{
 const page=await browser.newPage({viewport:{width:1680,height:1640}});
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('request',r=>{if(/^https?:/.test(r.url()))report.network.push(r.url());});
 await page.goto(pathToFileURL(process.cwd()+'/打开动物集成工作台.html').href,{timeout:120000});
 await page.waitForFunction(()=>window.__ATLAS__?.ready);
 const catalog=await page.evaluate(()=>__ATLAS__.catalog);
 for(const animal of catalog){
  await page.evaluate(id=>__ATLAS_BOOT__.select(id,{reset:true,initial:{playing:false,studioRotate:false}}),animal.id);
  await page.waitForFunction(id=>__ATLAS__?.ready&&__ATLAS__.current===id&&document.querySelector('#loading').hidden,animal.id,{timeout:120000});
  const frame=page.frames().find(f=>f.url()==='about:srcdoc');
  const before=await page.evaluate(async()=>(await __ATLAS__.request('capture')).image);
  const canvas=frame.locator('canvas').filter({visible:true}).first(),box=await canvas.boundingBox();
  assert.ok(box?.width>0&&box.height>0);
  const start={x:box.x+box.width*.55,y:box.y+box.height*.5};
  await page.mouse.move(start.x,start.y);await page.mouse.down();
  for(let i=1;i<=12;i++)await page.mouse.move(start.x-i*10,start.y+i*2);
  await page.mouse.up();
  const after=await page.evaluate(async()=>(await __ATLAS__.request('capture')).image);
  assert.notEqual(before,after,animal.id+' actual orbit pixels');
  const input=await frame.evaluate(()=>__ATLAS_STUDIO_INPUT.snapshot());
  assert.ok(input.moves>=12&&!input.dragging,animal.id+' primary drag reaches source orbit');
  const info=await frame.evaluate(()=>AtlasTurntable.info());
  for(const scene of info.scenes)assert.deepEqual(scene.visibleScenery,[]);
  // Direct re-renders must never move a camera or compound portrait fitting.
  const stability=await frame.evaluate(()=>{
   const n=window.__CRAB_QA__,life=window.__LIFE_VISUAL,src=window.__ATLAS_NATIVE||window.__ATLAS_IMPORTED||window.__ATLAS_CHICKEN_STAGE||life;
   const pair=n?{renderer:n.renderer,scene:n.scenes[n.state.mode==='ordinary'?0:1],camera:n.cameras[n.state.mode==='ordinary'?0:1]}:src;
   if(!pair?.camera||!pair.scene)return null;
   pair.renderer.render(pair.scene,pair.camera);
   const snapshot=()=>({position:pair.camera.position.toArray(),rotation:pair.camera.quaternion.toArray(),near:pair.camera.near,projection:pair.camera.projectionMatrix.toArray()});
   const first=snapshot();for(let i=0;i<20;i++)pair.renderer.render(pair.scene,pair.camera);
   const last=snapshot();
   const group=pair.scene.children.find(x=>x.name==='atlas-rotating-display');
   return {first,last,groundPlanes:group?.children[0].children.filter(x=>x.geometry?.type==='PlaneGeometry').length};
  });
  if(stability){assert.deepEqual(stability.first,stability.last,animal.id+' camera stable across 20 redraws');assert.equal(stability.groundPlanes,0);}
  report.animals.push({id:animal.id,dragMoves:input.moves,actualPixelsChanged:true,cameraStable:!!stability});
  console.log('STUDIO ORBIT OK',animal.id);
 }
 // Recorded repro: coconut crab, portrait viewport, source loop and direct draws.
 await page.evaluate(()=>__ATLAS_BOOT__.select('coconut',{reset:true,initial:{playing:false,studioRotate:false}}));
 await page.waitForFunction(()=>__ATLAS__.ready&&__ATLAS__.current==='coconut'&&document.querySelector('#loading').hidden);
 const frame=page.frames().find(f=>f.url()==='about:srcdoc');
 const views=[];
 for(const pitch of [.02,.18,.48,1.2,-.45]){
  await frame.evaluate(async pitch=>{const n=__CRAB_QA__;n.state.pitch=pitch;n.state.yaw=.9;await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);},pitch);
  const background=await page.evaluate(async()=>{
   const image=new Image();image.src=(await __ATLAS__.request('capture')).image;await image.decode();
   const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
   return [[6,6],[6,image.height-7],[image.width-7,6],[image.width-7,image.height-7]].map(([x,y])=>[...ctx.getImageData(x,y,1,1).data].slice(0,3));
  });
  for(const pixel of background)for(let c=0;c<3;c++)assert.ok(Math.abs(pixel[c]-background[0][c])<=2,'backdrop must not turn into lit ground');
  const view=await frame.evaluate(()=>{
   const n=__CRAB_QA__,g=n.scenes[1].children.find(x=>x.name==='atlas-rotating-display'),m=g.children[0].children[0],T=AtlasTurntable.T,c=n.cameras[1],eye=g.worldToLocal(c.getWorldPosition(new T.Vector3()));
   return {visible:m.visible,opacity:m.material.opacity,eyeHeight:eye.y-g.children[0].position.y,info:AtlasTurntable.info().scenes[1]};
  });
  if(pitch>=.02)assert.equal(view.opacity,1,'above-plinth view must not lose the platform');
  else assert.equal(view.opacity,0,'underside observation must not be blocked by black plinth');
  assert.equal(view.info.sourceFitsPortrait,true);
  views.push({pitch,background,...view});
  await page.screenshot({path:'qa/STUDIO_ORBIT_'+(pitch<0?'UNDERSIDE':String(pitch).replace('.','_'))+'.png'});
 }
 report.checks.push({name:'coconut portrait grazing, overhead and underside views',views});
 await frame.evaluate(async()=>{__CRAB_QA__.state.pitch=.48;__CRAB_QA__.state.yaw=.9;await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);});
 await page.evaluate(async()=>{await __ATLAS__.set('studioRotate',true);await __ATLAS__.set('playing',true);});
 const automatic=[];
 for(let i=0;i<16;i++){
  await page.waitForTimeout(200);
  automatic.push(await frame.evaluate(()=>{const n=__CRAB_QA__,c=n.cameras[1];return {yaw:n.state.yaw,time:n.state.time,radius:Math.hypot(c.position.x,c.position.z),platform:AtlasTurntable.info().scenes[1].platformOpacity};}));
 }
 assert.ok(automatic.at(-1).yaw>automatic[0].yaw,'automatic orbit advances');
 assert.ok(automatic.at(-1).time>automatic[0].time,'life activity continues during orbit');
 for(const sample of automatic){assert.ok(Math.abs(sample.radius-automatic[0].radius)<1e-8,'auto orbit must not compound camera radius');assert.equal(sample.platform,1);}
 report.checks.push({name:'living coconut crab during automatic portrait orbit',samples:automatic});
 await page.evaluate(async()=>{await __ATLAS__.set('studioRotate',false);await __ATLAS__.set('playing',false);});
 await page.locator('#studio-panel-tab').click();
 await page.evaluate(()=>__ATLAS__.request('capture'));
 await page.screenshot({path:'qa/STUDIO_ORBIT_FINAL.png'});
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.network,[]);report.passed=true;
}finally{report.completedAt=new Date().toISOString();fs.writeFileSync('qa/STUDIO_ORBIT_REPORT.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
