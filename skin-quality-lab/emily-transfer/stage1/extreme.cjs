// User-like steep under-eye regression, on source and immutable public entry.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const commit=process.env.PUBLIC_COMMIT;if(commit&&!/^[0-9a-f]{40}$/.test(commit))throw Error('Invalid immutable public commit');
const url=commit?'https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/'+commit+'/skin-quality-lab/emily-transfer/preview.html':'http://127.0.0.1:8765/skin-quality-lab/emily-transfer/index.html';
const out=path.resolve('qa-et08'),tag=commit?'public-under':'source-under';fs.mkdirSync(out,{recursive:true});const r={version:'ET08-S1.1',url,commit,checks:[],angles:[],transition:[],errors:[],realMobileDeviceTested:false};let b,p;
const check=(name,pass,data)=>{r.checks.push({name,pass:!!pass,data});assert(pass,name+' '+JSON.stringify(data));};
(async()=>{
 b=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});p=await b.newPage({viewport:{width:1440,height:1040},deviceScaleFactor:1});p.on('pageerror',e=>r.errors.push(e.message));
 await p.goto(url,{waitUntil:'domcontentloaded',timeout:120000});await p.waitForFunction(()=>window.__STAGE1__?.version==='ET08-S1.1'&&window.__SKIN_LAB__?.setView,null,{timeout:180000});
 await p.evaluate(()=>{window.__EYE_QA_FREEZE__=true;__STAGE1__.pose(1);__SKIN_LAB__.render();});await p.click('#s1UnderView');
 const angles=[{name:'deep-below',p:[-.004,-.046,.152],t:[-.004,.069,.069]},{name:'deep-below-right',p:[-.072,-.034,.164],t:[-.004,.069,.069]},{name:'deep-below-left',p:[.064,-.034,.164],t:[-.004,.069,.069]}];
 for(const a of angles){
  await p.evaluate(a=>{__SKIN_LAB__.setView(a.p,a.t);__SKIN_LAB__.render();},a);
  const id=await p.evaluate(()=>__STAGE1__.globePixels());r.angles.push({...a,probe:id});check('closed globe actually occluded / '+a.name,id.visibleGlobePixels===0&&!id.eyeObjectsHidden,id);await p.screenshot({path:out+'/'+tag+'-'+a.name+'.png'});
 }
 await p.click('#s1UnderView');
 for(const closure of [0,.25,.5,.75,.9,.98,1]){
  await p.evaluate(v=>{__STAGE1__.pose(v);__SKIN_LAB__.render();},closure);
  const id=await p.evaluate(()=>__STAGE1__.globePixels()),surfaces=await p.evaluate(()=>__STAGE1__.closedSurface());r.transition.push({closure,id,surfaces});
  check('collision-free surface and bounded rim gauge / '+closure,surfaces.eyes.every(e=>e.outerPenetratingVertices===0&&e.maxMarginAxialThicknessMM<=.451),surfaces);
  if(closure===0)check('under-view detector sees open globe',id.visibleGlobePixels>100,id);
  if(closure===1)check('under-view fully closed without hiding eyes',id.visibleGlobePixels===0&&!id.eyeObjectsHidden,id);
  await p.screenshot({path:out+'/'+tag+'-closure-'+closure+'.png'});
 }
 await p.click('#s1Neutral');await p.screenshot({path:out+'/'+tag+'-neutral-after-test.png'});
 check('new close/under controls retained',await p.locator('#s1ClosedCheck').count()===1&&await p.locator('#s1UnderView').count()===1);
 check('no browser errors',r.errors.length===0,r.errors);r.pass=true;
})().catch(e=>{r.pass=false;r.error=e.stack;console.error(e);process.exitCode=1;}).finally(async()=>{if(p&&!r.pass)await p.screenshot({path:out+'/'+tag+'-failure.png'}).catch(()=>{});if(b)await b.close();fs.writeFileSync(out+'/'+tag+'-report.json',JSON.stringify(r,null,2));console.log('ET08_UNDER_QA',JSON.stringify(r));});
