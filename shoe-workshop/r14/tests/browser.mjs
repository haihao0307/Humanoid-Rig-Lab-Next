import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import os from 'node:os';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const online=process.argv.includes('--public'),out=path.join(root,'evidence',online?'public':'browser');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'BUILD_MANIFEST.json'),'utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
const defaults={length:1,width:1,instep:0,thickness:1.35,bend:0};
const baseline={sourceCommit:'8b05ebd8b0755216743792034e3cbb58b8d9ff54',buildSha:'c979ae664e53cdc2f09bd33511be5be61415efce',runtimeSha256:'7db6ec885c0d7d972b2fb0574039448d2115b98c6e8e428f297c7f989410535b',runtimeBytes:13746414};
// This function runs inside either real runtime. Read cameras, clipping planes
// and projected vertices directly; a producer's inspection metadata is not used.
function readScene(apiName){
 const a=window[apiName],c=a.camera,g=a.group(),state=a.state();g.updateMatrixWorld(true);c.updateMatrixWorld(true);
 const stage=document.querySelector('#stage').getBoundingClientRect(),visibleParts=[],planeMap=new Map();
 g.traverse(m=>{if(!m.isMesh)return;if(m.visible)visibleParts.push(m.name);for(const material of(Array.isArray(m.material)?m.material:[m.material]))for(const p of material.clippingPlanes??[]){const data={normal:p.normal.toArray(),constant:p.constant};planeMap.set(JSON.stringify(data),data);}});
 const clippingPlanes=[...planeMap.values()],floor=a.scene.children.find(o=>o.isMesh&&o.geometry.type==='PlaneGeometry');
 const targetMesh=g.children.find(o=>o.userData.style===state.style&&o.scale.x>0)?.children.find(m=>m.name===state.hardwareTarget);let target=null;
 if(targetMesh){
  const positions=targetMesh.geometry.getAttribute('position'),lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity],worldLo=[Infinity,Infinity,Infinity],worldHi=[-Infinity,-Infinity,-Infinity],clipRanges=clippingPlanes.map(()=>({min:Infinity,max:-Infinity}));
  for(let i=0;i<positions.count;i++){
   const v=c.position.clone().fromBufferAttribute(positions,i).applyMatrix4(targetMesh.matrixWorld),world=v.toArray();
   for(let j=0;j<3;j++){worldLo[j]=Math.min(worldLo[j],world[j]);worldHi[j]=Math.max(worldHi[j],world[j]);}
   clippingPlanes.forEach((p,j)=>{const d=p.normal.reduce((sum,n,k)=>sum+n*world[k],p.constant);clipRanges[j].min=Math.min(clipRanges[j].min,d);clipRanges[j].max=Math.max(clipRanges[j].max,d);});
   const ndc=v.project(c).toArray();for(let j=0;j<3;j++){lo[j]=Math.min(lo[j],ndc[j]);hi[j]=Math.max(hi[j],ndc[j]);}
  }
  target={id:targetMesh.name,visible:targetMesh.visible,vertexCount:positions.count,worldBounds:[worldLo,worldHi],ndcBounds:[lo,hi],pixelSpan:[(hi[0]-lo[0])*stage.width/2,(hi[1]-lo[1])*stage.height/2],clipRanges};
 }
 return {source:a.source,state,viewport:[innerWidth,innerHeight],stage:[stage.width,stage.height],visibleParts,isolatedParts:state.part==='all'?[]:[state.part],clippingPlanes,floor:floor?{visible:floor.visible,position:floor.position.toArray()}:null,
  camera:{position:c.position.toArray(),quaternion:c.quaternion.toArray(),up:c.up.toArray(),fov:c.fov,near:c.near,far:c.far,aspect:c.aspect,zoom:c.zoom,filmGauge:c.filmGauge,filmOffset:c.filmOffset,matrixWorld:c.matrixWorld.toArray(),matrixWorldInverse:c.matrixWorldInverse.toArray(),projectionMatrix:c.projectionMatrix.toArray()},
  rendering:{pixelRatio:a.renderer.getPixelRatio(),outputColorSpace:a.renderer.outputColorSpace,toneMapping:a.renderer.toneMapping,toneMappingExposure:a.renderer.toneMappingExposure,localClippingEnabled:a.renderer.localClippingEnabled,shadowMap:{enabled:a.renderer.shadowMap.enabled,type:a.renderer.shadowMap.type},background:a.scene.background.getHexString(),environmentIntensity:a.scene.environmentIntensity,
   lights:a.scene.children.filter(o=>o.isLight).map(l=>({type:l.type,color:l.color.getHexString(),groundColor:l.groundColor?.getHexString()??null,intensity:l.intensity,position:l.position.toArray(),visible:l.visible,castShadow:l.castShadow,shadow:l.castShadow?{mapSize:l.shadow.mapSize.toArray(),bias:l.shadow.bias,normalBias:l.shadow.normalBias,camera:{left:l.shadow.camera.left,right:l.shadow.camera.right,top:l.shadow.camera.top,bottom:l.shadow.camera.bottom,near:l.shadow.camera.near,far:l.shadow.camera.far}}:null}))},target};
}
async function applyBeforeScene(s){
 const a=window.SHOE_R13;
 // R13 has no hardware preset. Set the same model state, then apply the actual
 // R14 camera and plane in world coordinates without fitting the old geometry.
 await a.set({...s.state,view:'hero'});await a.idle();
 const c=a.camera;c.position.fromArray(s.camera.position);c.quaternion.fromArray(s.camera.quaternion);c.up.fromArray(s.camera.up);
 for(const key of['fov','near','far','aspect','zoom','filmGauge','filmOffset'])c[key]=s.camera[key];
 c.updateProjectionMatrix();c.updateMatrixWorld(true);
 a.group().traverse(m=>{if(m.isMesh)for(const material of(Array.isArray(m.material)?m.material:[m.material]))for(const p of material.clippingPlanes??[]){const q=s.clippingPlanes[0];if(!q)throw Error('Unexpected active R13 clipping plane');p.normal.fromArray(q.normal);p.constant=q.constant;}});
 const floor=a.scene.children.find(o=>o.isMesh&&o.geometry.type==='PlaneGeometry');if(floor&&s.floor){floor.visible=s.floor.visible;floor.position.fromArray(s.floor.position);}
 const lights=a.scene.children.filter(o=>o.isLight);s.rendering.lights.forEach((l,i)=>{lights[i].visible=l.visible;});
 a.renderer.render(a.scene,c);a.renderer.getContext().finish();
}
fs.mkdirSync(out,{recursive:true});
const qa={version:'R14.0',sourceCommit:manifest.sourceCommit,buildSha:process.env.PUBLIC_BUILD_SHA||null,runtime:manifest.runtime,completed:false,checks:[],screens:[],targetedViews:[],plannedScreens:{retained:39,targeted:27,candidate:66,before:35},errors:[],consoleErrors:[],requestFailures:[],networkRequests:[],environment:{browser:'Chromium',renderer:'SwiftShader',os:process.env.CI?'Ubuntu CI':os.platform(),desktopViewport:[1512,1100],mobileViewport:[390,844],realMobileDevice:false},visualHumanReview:false,manufacturingValidated:false};
const save=()=>fs.writeFileSync(path.join(out,'QA.json'),JSON.stringify(qa,null,2)+'\n');
const phase=s=>{qa.phase=s;save();console.log('PHASE',s);};
let browser,page;
const hard=setTimeout(()=>{qa.failure='Browser verification exceeded 15 minutes';save();process.exit(1);},900000);hard.unref();

async function check(name,fn){phase(name);const data=await fn();qa.checks.push({name,passed:true,data});save();}
try{
 let url=pathToFileURL(path.join(root,'public-lite.html')).href;
 if(online){
  assert.match(qa.buildSha||'',/^[a-f0-9]{40}$/);
  const raw=`https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/${qa.buildSha}/shoe-workshop/r14/public-lite.html`;
  const response=await fetch(raw);assert.ok(response.ok,'immutable raw build is accessible');
  const bytes=Buffer.from(await response.arrayBuffer());assert.equal(hash(bytes),manifest.runtime.sha256);assert.equal(bytes.length,manifest.runtime.bytes);
  qa.publicBytes={raw,bytes:bytes.length,sha256:hash(bytes),matchesBuild:true};url='https://htmlpreview.github.io/?'+raw;
 }
 qa.url=url;save();
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 page=await browser.newPage({viewport:{width:1512,height:1100},deviceScaleFactor:1});page.setDefaultTimeout(90000);
 page.on('pageerror',e=>{qa.errors.push(String(e));console.error('PAGE',String(e));save();});
 page.on('console',m=>{if(m.type()==='error'){qa.consoleErrors.push(m.text());console.error('CONSOLE',m.text().slice(0,400));save();}});
 page.on('request',r=>{if(/^https?:/.test(r.url()))qa.networkRequests.push(r.url());});
 page.on('requestfailed',r=>{qa.requestFailures.push({url:r.url(),error:r.failure()?.errorText});save();});
 const idle=()=>page.evaluate(()=>SHOE_R14.idle()),comparisonRequests=[];
 const shot=async(name,full=false,{comparison=false,targeted=false}={})=>{
  await idle();await page.evaluate(()=>{const a=SHOE_R14;a.renderer.render(a.scene,a.camera);a.renderer.getContext().finish();});
  const scene=await page.evaluate(readScene,'SHOE_R14');
  const b=full?await page.screenshot({fullPage:true}):await page.locator('#stage').screenshot();
  const screen={name,sha256:hash(b),fullPage:full,targeted,scene};
  fs.writeFileSync(path.join(out,name+'.png'),b);qa.screens.push(screen);if(comparison)comparisonRequests.push(screen);save();return screen;
 };
 const select=async id=>{await page.locator(`[data-style="${id}"]`).click();await idle();assert.equal(await page.evaluate(()=>SHOE_R14.state().style),id);};
 const view=async name=>{await page.locator(`[data-view="${name}"]`).click();await idle();};
 const setRange=async(id,value)=>{await page.locator('#'+id).evaluate((el,v)=>{el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},value);await idle();};
 const targetShot=async spec=>{
  const screen=await shot(spec.name,false,{comparison:true,targeted:true}),s=screen.scene;
  assert.equal(s.state.style,spec.style);assert.deepEqual(s.state.params,{...defaults,...spec.params});assert.equal(s.state.clay,!!spec.clay);assert.equal(s.state.section,!!spec.section);assert.deepEqual(s.isolatedParts,spec.part?[spec.part]:[]);
  assert.equal(s.state.view,spec.view);assert.equal(s.state.wire,false);assert.equal(s.state.explode,false);assert.equal(s.state.seams,true);assert.equal(s.state.pair,false);assert.equal(s.state.compare,false);
  if(spec.view==='hardware'){
   assert.equal(s.target?.id,spec.target);assert.equal(s.state.hardwareTarget,spec.target);
   const [lo,hi]=s.target.ndcBounds;
   assert.ok(lo[0]>-.92&&hi[0]<.92&&lo[1]>-.92&&hi[1]<.92,'The real hardware fits inside the inspection image');
   assert.ok(Math.abs((lo[0]+hi[0])/2)<.15&&Math.abs((lo[1]+hi[1])/2)<.15,'The real hardware stays near the image centre');
   assert.ok(s.target.pixelSpan.every(n=>n>60),'The actual hardware occupies enough pixels to inspect');
   assert.ok(lo[2]>-1&&hi[2]<1,'Near/far planes retain the real hardware');
   if(spec.section){assert.equal(s.clippingPlanes.length,1);assert.ok(s.target.clipRanges[0].min<0&&s.target.clipRanges[0].max>0,'The local section crosses the actual metal');}
  }
  if(spec.part)assert.deepEqual(s.visibleParts,[spec.part]);
  qa.targetedViews.push({name:spec.name,purpose:spec.purpose,style:spec.style,params:s.state.params,view:s.state.view,hardwareTarget:spec.target??null,clay:s.state.clay,section:s.state.section,isolatedParts:s.isolatedParts});save();return screen;
 };
 const configureTarget=async spec=>{
  await page.evaluate(async s=>{await SHOE_R14.set(s);await SHOE_R14.idle();},{style:spec.style,params:{...defaults,...spec.params},pair:false,compare:false,explode:false,clay:!!spec.clay,wire:false,section:!!spec.section,seams:true,part:'all',view:'hero',hardwareTarget:spec.target??null});
  if(spec.part){await page.locator('#part-select').selectOption(spec.part);await idle();}
  if(spec.view==='hardware'){assert.ok(await page.locator('#hardware-controls').isVisible());await page.locator('#hardware-target').selectOption(spec.target);}
  await view(spec.view);return targetShot(spec);
 };
 const replayBefore=async()=>{
  const beforeRoot=path.join(root,'evidence','before');fs.mkdirSync(beforeRoot,{recursive:true});
  const oldFile=path.join(root,'../r13/public-lite.html'),oldBytes=fs.readFileSync(oldFile);assert.equal(hash(oldBytes),baseline.runtimeSha256);assert.equal(oldBytes.length,baseline.runtimeBytes);
  const bp=await browser.newPage({viewport:{width:1512,height:1100},deviceScaleFactor:1});bp.setDefaultTimeout(90000);
  const before={version:'R14.0',...baseline,candidateSourceCommit:manifest.sourceCommit,candidateRuntimeSha256:manifest.runtime.sha256,completed:false,sameCameraMatrices:false,sameModelState:false,sameRenderingSettings:false,screens:[],errors:[],consoleErrors:[],requestFailures:[],networkRequests:[]};
  const saveBefore=()=>fs.writeFileSync(path.join(beforeRoot,'QA.json'),JSON.stringify(before,null,2)+'\n');
  bp.on('pageerror',e=>before.errors.push(String(e)));bp.on('console',m=>{if(m.type()==='error')before.consoleErrors.push(m.text());});bp.on('request',r=>{if(/^https?:/.test(r.url()))before.networkRequests.push(r.url());});bp.on('requestfailed',r=>before.requestFailures.push({url:r.url(),error:r.failure()?.errorText}));
  saveBefore();try{
   await bp.goto(pathToFileURL(oldFile).href,{waitUntil:'domcontentloaded',timeout:120000});await bp.waitForFunction(()=>window.SHOE_R13?.ready,null,{timeout:180000});assert.equal(await bp.evaluate(()=>SHOE_R13.source),baseline.sourceCommit);
   for(const candidate of comparisonRequests){
    await bp.evaluate(applyBeforeScene,candidate.scene);const scene=await bp.evaluate(readScene,'SHOE_R13'),requestedScene=candidate.scene;
    const deltas=['matrixWorld','matrixWorldInverse','projectionMatrix'].flatMap(k=>scene.camera[k].map((v,i)=>Math.abs(v-requestedScene.camera[k][i]))),matrixMaxAbsDelta=Math.max(...deltas);assert.equal(matrixMaxAbsDelta,0,'R13 is rendered with the exact candidate camera matrices');
    assert.deepEqual(scene.camera,requestedScene.camera);assert.deepEqual(scene.viewport,requestedScene.viewport);assert.deepEqual(scene.stage,requestedScene.stage);
    for(const key of['style','params','pair','compare','explode','clay','wire','section','seams','part'])assert.deepEqual(scene.state[key],requestedScene.state[key],'Matching before state '+key);
    assert.deepEqual(scene.isolatedParts,requestedScene.isolatedParts);assert.deepEqual(scene.clippingPlanes,requestedScene.clippingPlanes);assert.deepEqual(scene.floor,requestedScene.floor);assert.deepEqual(scene.rendering,requestedScene.rendering);
    const bytes=await bp.locator('#stage').screenshot();fs.writeFileSync(path.join(beforeRoot,candidate.name+'.png'),bytes);
    before.screens.push({name:candidate.name,sha256:hash(bytes),targeted:candidate.targeted,candidateScreenshotSha256:candidate.sha256,requestedScene,scene,matrixMaxAbsDelta,sameCameraMatrices:true,sameModelState:true,sameRenderingSettings:true});saveBefore();
   }
   assert.equal(before.screens.length,35);assert.equal(before.screens.filter(s=>s.targeted).length,27);
   for(const key of['errors','consoleErrors','requestFailures','networkRequests'])assert.equal(before[key].length,0,'R13 before '+key);
   before.completed=true;before.sameCameraMatrices=before.sameModelState=before.sameRenderingSettings=true;
   qa.beforeComparison={path:'evidence/before/QA.json',sourceCommit:before.sourceCommit,buildSha:before.buildSha,runtimeSha256:before.runtimeSha256,candidateSourceCommit:manifest.sourceCommit,candidateRuntimeSha256:manifest.runtime.sha256,screens:before.screens.length,targetedScreens:27,sameCameraMatrices:true,sameModelState:true,sameRenderingSettings:true};save();
  }catch(error){before.failure=String(error.stack||error);throw error;}finally{saveBefore();await bp.close();}
 };
 phase('open standalone');await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});await page.waitForFunction(()=>window.SHOE_R14?.ready,null,{timeout:180000});await idle();
 await check('Actual WebGL first frame and matching source',async()=>{
  const data=await page.evaluate(()=>{const a=SHOE_R14,g=a.renderer.getContext(),ext=g.getExtension('WEBGL_debug_renderer_info');return {report:a.report(),gl:ext?g.getParameter(ext.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER),drawCalls:a.renderer.info.render.calls,triangles:a.renderer.info.render.triangles,canvas:[a.renderer.domElement.width,a.renderer.domElement.height]};});
  assert.equal(data.report.source,manifest.sourceCommit);assert.equal(data.report.version,'R14.0');assert.equal(data.report.current[0].id,'penny');assert.ok(data.drawCalls>10&&data.triangles>10000);assert.equal(data.report.stats.errors.length,0);assert.ok(data.canvas.every(n=>n>200));return data;
 });await shot('desktop-first-frame',true);
 await check('Four distinct constructed styles and open geometry',async()=>{
  const reports=[];
  for(const id of['penny','chelsea','monk','canvas']){
   await select(id);const r=await page.evaluate(()=>SHOE_R14.report());assert.equal(r.current.length,1);assert.equal(r.current[0].id,id);assert.ok(r.current[0].generated&&!r.current[0].externalMeshImport);assert.ok(r.current[0].parts.length>15);reports.push(r.current[0]);
   for(const camera of['hero','side','top','front','back','detail','join']){
    await view(camera);await shot(id+'-'+camera,false,{comparison:['back','join'].includes(camera)});
   }
  }
  assert.ok(reports[1].measuredBoundsMm[1]>reports[0].measuredBoundsMm[1]*1.5);assert.equal(new Set(reports.map(r=>r.triangles)).size,4);
  phase('Targeted construction views and hardware camera follow');
  const front={style:'canvas',view:'hardware',target:'canvas-eyelet-1-4',purpose:'Front eyelet, bore and cloth support under bending'};
  let previous=await configureTarget({...front,name:'canvas-front-eyelet-default-bend00'});
  // Exercise the actual sliders while the camera remains in the hardware view.
  // Re-selecting a camera after each change would conceal a stale-focus bug.
  for(const bend of[15,30]){
   await setRange('bend',bend);const screen=await targetShot({...front,name:'canvas-front-eyelet-default-bend'+bend,params:{bend}});
   assert.notDeepEqual(screen.scene.camera.matrixWorld,previous.scene.camera.matrixWorld,'The hardware camera follows the changed real mesh');previous=screen;
  }
  for(const [label,thickness] of[['thin',.9],['thick',2.1]]){
   await setRange('thickness',thickness);const screen=await targetShot({...front,name:'canvas-front-eyelet-'+label+'-bend30',params:{bend:30,thickness}});
   assert.notDeepEqual(screen.scene.camera.matrixWorld,previous.scene.camera.matrixWorld,'Thickness changes reframe the actual hardware');previous=screen;
  }
  for(const spec of[
   {...front,name:'canvas-front-eyelet-default-bend30-section',params:{bend:30},section:true,purpose:'Local cut through flange, bore, sleeve and supporting cloth'},
   {...front,name:'canvas-front-eyelet-inner-default-bend30',target:'canvas-eyelet--1-4',params:{bend:30},purpose:'Opposite front eyelet under maximum bend'},
   {name:'canvas-row2-quarter-default-static',part:'canvas-quarter-1'},
   {name:'canvas-row2-facing-default-static',part:'canvas-perforated-facing-1'},
   {name:'canvas-row2-quarter-thin-static',part:'canvas-quarter-1',params:{thickness:.9}},
   {name:'canvas-row2-quarter-thick-static',part:'canvas-quarter-1',params:{thickness:2.1}}
  ])await configureTarget({style:'canvas',view:'hardware',target:'canvas-eyelet-1-2',purpose:'Isolated static cloth aperture at row index 2; metal hidden',...spec});
  for(const spec of[
   {name:'canvas-default-bend30-side',view:'side',clay:false},
   {name:'canvas-default-bend30-hero-clay',view:'hero',clay:true}
  ])await configureTarget({style:'canvas',params:{bend:30},purpose:'Whole-shoe front upper and sole continuity across the complete bend region',...spec});
  for(const [label,params] of[
   ['default',{}],['all-low',{length:.9,width:.88,instep:-5,thickness:.9}],['all-high',{length:1.1,width:1.15,instep:8,thickness:2.1}]
  ])for(const clay of[false,true])await configureTarget({name:'chelsea-'+label+'-side-'+(clay?'clay':'leather'),style:'chelsea',params,clay,view:'side',purpose:'Shaft-root curvature and continuous silhouette in side view'});
  for(const clay of[false,true])await configureTarget({name:'chelsea-default-oblique-'+(clay?'clay':'leather'),style:'chelsea',clay,view:'hero',purpose:'Shaft-root surface expression in an oblique view'});
  for(const [label,thickness] of[['default',1.35],['thin',.9],['thick',2.1]])for(const buckle of[0,1])await configureTarget({name:'monk-buckle'+buckle+'-'+label,style:'monk',params:{thickness},view:'hardware',target:'monk-buckle-frame-'+buckle,purpose:'Buckle, prong, adjustment hole and supporting strap at the chosen thickness'});
  assert.equal(qa.targetedViews.length,27);assert.equal(new Set(qa.targetedViews.map(t=>t.name)).size,27);assert.equal(comparisonRequests.length,35);
  if(!online){phase('Frozen R13 before views at the actual candidate matrices');await replayBefore();}
  else qa.beforeComparison={path:'evidence/before/QA.json',...baseline,candidateSourceCommit:manifest.sourceCommit,candidateRuntimeSha256:manifest.runtime.sha256,screens:35,targetedScreens:27,verification:'The publisher compares the actual public target scenes with the frozen file candidate and its R13 re-renders'};
  await page.evaluate(async params=>{await SHOE_R14.set({style:'canvas',params,view:'hero',part:'all',pair:false,compare:false,clay:false,wire:false,section:false,seams:true,explode:false});await SHOE_R14.idle();},defaults);
  return reports;
 });
 await check('Length width instep thickness and bend respond through real controls',async()=>{
  await select('monk');const before=await page.evaluate(()=>SHOE_R14.report().current[0]);
  await setRange('length',1.1);await setRange('width',1.15);await setRange('instep',8);await setRange('thickness',2.1);
  const after=await page.evaluate(()=>SHOE_R14.report().current[0]);assert.ok(after.measuredBoundsMm[2]>before.measuredBoundsMm[2]*1.07);assert.ok(after.measuredBoundsMm[0]>before.measuredBoundsMm[0]*1.07);assert.ok(after.measuredBoundsMm[1]>before.measuredBoundsMm[1]);assert.equal(after.designParameters.thickness,2.1);
  await setRange('bend',25);assert.equal(await page.evaluate(()=>SHOE_R14.state().params.bend),25);await shot('monk-parameter-and-flex');return {before:before.measuredBoundsMm,after:after.measuredBoundsMm,bend25:true,physicalSolver:false};
 });
 await check('Real mirrored pair shares geometry without losing material',async()=>{
  await select('canvas');await page.locator('#pair').click();await idle();
  const data=await page.evaluate(()=>{const a=SHOE_R14;a.group().updateMatrixWorld(true);return a.group().children.map(g=>({det:g.matrixWorld.determinant(),meshes:g.children.length,style:g.userData.style}));});
  assert.equal(data.length,2);assert.ok(data[0].det*data[1].det<0);assert.equal(data[0].meshes,data[1].meshes);await view('hero');await shot('canvas-pair');return data;
 });
 await check('Four style comparison and separate mesh selection',async()=>{
  await page.locator('#compare').click();await idle();assert.equal(await page.evaluate(()=>SHOE_R14.group().children.length),4);await shot('four-style-comparison',true);
  await select('penny');await page.locator('#single').click();await idle();await page.locator('#explode').click();await shot('penny-exploded');
  const id=await page.locator('#part-select option').nth(1).getAttribute('value');await page.locator('#part-select').selectOption(id);
  const visible=await page.evaluate(()=>{const names=[];SHOE_R14.group().traverse(m=>{if(m.isMesh&&m.visible)names.push(m.name);});return names;});assert.deepEqual(visible,[id]);await shot('penny-first-part');
  await page.locator('#part-select').selectOption('all');await page.locator('#explode').click();await page.locator('#section').click();await idle();await shot('penny-section');
  return {comparisonChildren:4,isolatedPart:id};
 });
 await check('Clay wire seam toggles and recipe persistence',async()=>{
  await select('chelsea');await page.locator('#clay').click();await idle();await shot('chelsea-clay');
  await page.locator('#wire').click();await idle();assert.ok(await page.evaluate(()=>{let n=0;SHOE_R14.group().traverse(m=>{if(m.isMesh&&(Array.isArray(m.material)?m.material:[m.material]).every(x=>x.wireframe))n++;});return n>10;}));await page.locator('#wire').click();await idle();
  await page.locator('#seams').click();assert.ok(await page.evaluate(()=>{let good=true;SHOE_R14.group().traverse(m=>{if(m.isMesh&&['seam','thread'].includes(m.userData.kind)&&m.visible)good=false;});return good;}));
  await setRange('width',1.06);await page.locator('#save').click();await select('canvas');await page.locator('#restore').click();await idle();const s=await page.evaluate(()=>SHOE_R14.state());assert.equal(s.style,'chelsea');assert.equal(s.params.width,1.06);assert.equal(s.clay,true);assert.equal(s.seams,false);
  await page.locator('#reset').click();await idle();return {restoredStyle:s.style,width:s.params.width};
 });
 await check('Original R10 shoe payload and material presets remain usable',async()=>{
  await select('original');assert.equal(await page.locator('#legacy-controls').isVisible(),true);
  const first=await page.evaluate(()=>SHOE_R14.report().current[0]);assert.ok(first.parts.length>20);await shot('retained-r10-original');
  assert.equal(await page.locator('#legacy-preset option').count(),12);await page.locator('#legacy-preset').selectOption('P05');await idle();assert.equal(await page.evaluate(()=>SHOE_R14.state().legacyPreset),'P05');await shot('retained-r10-p05');return {source:first.preservedSource,parts:first.parts.length,presets:12};
 });
 await check('Mobile viewport retains live model and touch-sized controls',async()=>{
  await select('canvas');await page.setViewportSize({width:390,height:844});await idle();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.locator('#canvas').scrollIntoViewIfNeeded();await shot('mobile-viewport',true);
  return {viewport:[390,844],realDevice:false,overflow:false};
 });
 qa.final=await page.evaluate(()=>SHOE_R14.report());assert.equal(qa.final.stats.errors.length,0);assert.equal(qa.errors.length,0);assert.equal(qa.consoleErrors.length,0);assert.equal(qa.requestFailures.length,0);
 if(!online)assert.equal(qa.networkRequests.length,0,'Standalone core works without HTTP requests');
 assert.equal(qa.checks.length,8);assert.equal(qa.screens.length,66);assert.equal(new Set(qa.screens.map(s=>s.name)).size,66);assert.equal(qa.screens.filter(s=>s.targeted).length,27);assert.equal(qa.targetedViews.length,27);
 qa.completed=true;phase('complete');
}catch(e){qa.failure=String(e.stack||e);console.error(e);save();if(page){try{await page.screenshot({path:path.join(out,'failure.png'),fullPage:true,timeout:10000});qa.body=(await page.locator('body').innerText({timeout:3000})).slice(0,6000);}catch{}}process.exitCode=1;
}finally{clearTimeout(hard);save();await browser?.close();}
