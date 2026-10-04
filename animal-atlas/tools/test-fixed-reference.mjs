import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {playwright} from './dependencies.mjs';

const report={startedAt:new Date().toISOString(),htmlSha256:crypto.createHash('sha256').update(fs.readFileSync('打开动物集成工作台.html')).digest('hex'),animals:[],checks:[],errors:[],network:[]};
const browser=await playwright().chromium.launch({headless:true,args:['--enable-webgl','--use-angle=d3d11']});
try{
 const page=await browser.newPage({viewport:{width:1680,height:1000}});
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('request',r=>{if(/^https?:/.test(r.url()))report.network.push(r.url());});
 await page.goto(pathToFileURL(process.cwd()+'/打开动物集成工作台.html').href,{timeout:120000});
 await page.waitForFunction(()=>window.__ATLAS__?.ready);
 const ready=id=>page.waitForFunction(id=>__ATLAS__.ready&&__ATLAS__.current===id&&document.querySelector('#loading').hidden,id,{timeout:120000});
 const capture=()=>page.evaluate(async()=>(await __ATLAS__.request('capture')).image);
 const reference=frame=>frame.evaluate(()=>{
  const info=AtlasTurntable.info();
  return {scenes:info.scenes.map(s=>({radius:s.radius,floorY:s.floorY,position:s.platformPosition,scale:s.platformScale})),raw:info.rawReferences};
 });
 const screenReference=frame=>frame.evaluate(()=>{
  const T=AtlasTurntable.T,kind=__ATLAS_CONTEXT.adapter;
  let n;
  if(kind==='native')n=__ATLAS_NATIVE;else if(kind==='imported')n=__ATLAS_IMPORTED;
  else if(kind==='chicken')n=__ATLAS_CHICKEN_STAGE;
  else if(kind==='crab'){const q=__CRAB_QA__,i=__ATLAS_CONTEXT.key==='coconut'?1:0;n={scene:q.scenes[i],camera:q.cameras[i]};}
  else if(kind==='life')n=__LIFE_VISUAL;
  else if(kind==='palau')n=birdWorkbench.getStages().find(s=>s.id===__ATLAS_CONTEXT.key);
  if(!n?.scene||!n.camera)return null;
  const group=n.scene.children.find(g=>g.name==='atlas-rotating-display'),platform=group.children[0];
  return {camera:n.camera.position.toArray(),points:[[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]].map(p=>new T.Vector3(...p).applyMatrix4(platform.matrixWorld).project(n.camera).toArray())};
 });
 for(const animal of await page.evaluate(()=>__ATLAS__.catalog)){
  await page.evaluate(id=>__ATLAS_BOOT__.select(id,{reset:true,initial:{playing:false,studioRotate:false}}),animal.id);await ready(animal.id);
  const frame=page.frames().find(f=>f.url()==='about:srcdoc');
  if(animal.adapter==='life')await page.waitForTimeout(1200);
  await capture();const base=await reference(frame),controls=await page.evaluate(()=>__ATLAS__.controls),settings=await page.evaluate(()=>__ATLAS__.settings());
  const maturity=settings.demoMaturity;
  const changes=[{demoAge:maturity*.15,demoSize:.7,demoCondition:15},{demoAge:maturity*1.2,demoSize:1.6,demoCondition:85}];
  const images=[];let firstScreen;
  for(let i=0;i<changes.length;i++){
   await page.evaluate(async values=>{for(const [key,value]of Object.entries(values))await __ATLAS__.set(key,value);},changes[i]);
   images.push(await capture());assert.deepEqual(await reference(frame),base,animal.id+' reference after growth/size/body condition');
   const screen=await screenReference(frame);
   if(i===0)firstScreen=screen;
   else if(screen&&animal.adapter!=='life'){
    assert.equal(screen.points.length,firstScreen.points.length);
    screen.points.forEach((p,j)=>p.forEach((v,k)=>assert.ok(Math.abs(v-firstScreen.points[j][k])<1e-7,animal.id+' projected plinth must stay fixed')));
   }
   if(['coconut','neutral-dog','fish'].includes(animal.id))await page.screenshot({path:'qa/REFERENCE_'+animal.id+'_'+(i?'LARGE':'SMALL')+'.png'});
  }
  assert.notEqual(images[0],images[1],animal.id+' animal actually changes while reference stays fixed');
  const specialized=[];
  for(const key of ['scale','bulk','color','roughness','bodyScale','chicken:body_width']){
   const d=controls.find(d=>d.key===key);if(!d)continue;
   await page.evaluate(async({key,value})=>__ATLAS__.set(key,value),{key,value:d.type==='color'?'#a88462':d.max});
   await capture();assert.deepEqual(await reference(frame),base,animal.id+' reference after '+key);
   const screen=await screenReference(frame);
   if(screen&&animal.adapter!=='life')screen.points.forEach((p,j)=>p.forEach((v,k)=>assert.ok(Math.abs(v-firstScreen.points[j][k])<1e-7,animal.id+' specialty edit must preserve lens')));
   specialized.push(key);
  }
  if(animal.id==='fish'){
   const lens=await frame.evaluate(()=>{const c=__KAOPU_R13__.renderer.camera;return {target:c.target,yaw:c.yaw,pitch:c.pitch,distance:c.distance,halfWidth:c.halfWidth,zoom:c.zoom};});
   await page.evaluate(()=>__ATLAS__.set('group',true));await capture();assert.deepEqual(await reference(frame),base);
   assert.deepEqual(await frame.evaluate(()=>{const c=__KAOPU_R13__.renderer.camera;return {target:c.target,yaw:c.yaw,pitch:c.pitch,distance:c.distance,halfWidth:c.halfWidth,zoom:c.zoom};}),lens);
   await page.evaluate(()=>__ATLAS__.set('group',false));await capture();assert.deepEqual(await reference(frame),base);
   specialized.push('group');
  }
  report.animals.push({id:animal.id,reference:base,specialized,actualPixelsChanged:true,projectedReferenceChecked:!!firstScreen&&animal.adapter!=='life'});
  console.log('FIXED REFERENCE OK',animal.id);
 }
 // Saved shape restoration must not establish a different measuring reference.
 for(const id of ['neutral-dog','coconut','fish']){
  const base=report.animals.find(a=>a.id===id).reference;
  await page.evaluate(id=>__ATLAS_BOOT__.select(id,{reset:true,initial:{playing:false,studioRotate:false,demoSize:1.6,demoCondition:85,...(id==='neutral-dog'?{bulk:1.08,scale:1.25}: {})}}),id);await ready(id);await capture();
  assert.deepEqual(await reference(page.frames().find(f=>f.url()==='about:srcdoc')),base,id+' restoring altered shape keeps original reference');
 }
 report.checks.push('19 animals retain original plinth transform during growth, size and body-condition edits; actual animal pixels change', 'native mesh rebuild and specialty parameters do not reframe plinth', 'fish school switches retain reference and user lens', 'saved shape restoration keeps original reference');
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.network,[]);report.passed=true;
}finally{report.completedAt=new Date().toISOString();fs.writeFileSync('qa/FIXED_REFERENCE_REPORT.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
