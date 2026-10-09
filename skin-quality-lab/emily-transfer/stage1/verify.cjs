const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const OUT=path.resolve('qa-et08'),ROOT=path.resolve(__dirname,'..'),BASEURL=process.env.TEST_BASE||'http://127.0.0.1:8765/skin-quality-lab/emily-transfer/';
fs.mkdirSync(OUT,{recursive:true});const results={schema:'kaopu/eye-stage1-verification@1',version:'ET08-S1',checks:[],poses:[],screenshots:[],realMobileDeviceTested:false,scope:'Chromium software WebGL; finite sampled poses, not exhaustive CCD or clinical reconstruction'};
const check=(name,v,detail)=>{results.checks.push({name,pass:!!v,detail});if(!v)throw Error(name+': '+JSON.stringify(detail));};
let browser,page;const errors=[];
const capture=async name=>{await page.screenshot({path:path.join(OUT,name+'.png')});results.screenshots.push(name+'.png');};
const settle=async()=>{await page.evaluate(()=>{window.__EYE_QA_FREEZE__=true;__SKIN_LAB__.render();});await page.waitForTimeout(80);};
(async()=>{
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 page=await browser.newPage({viewport:{width:1440,height:1040},deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(BASEURL+'index.html',{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>window.__STAGE1__&&window.__SKIN_LAB__?.state.ready,null,{timeout:180000});
 await settle();
 const baselineGeometry=await page.evaluate(()=>__EYES__.sourceGeometry());
 results.neutral=await page.evaluate(()=>__STAGE1__.report());results.initialDiagnostics=await page.evaluate(()=>__STAGE1__.diagnostics());
 check('correct stage',await page.evaluate(()=>__STAGE1__.version==='ET08-S1'));
 check('no maps, wetness, lashes or fuzz in visible gray review',results.initialDiagnostics.texturedVisibleMaterials===0&&results.initialDiagnostics.clearcoatMax===0&&!results.initialDiagnostics.wetRimsVisible&&!results.initialDiagnostics.eyelashesVisible&&!results.initialDiagnostics.fuzzVisible,results.initialDiagnostics);
 for(const e of results.neutral.eyes){check(e.name+' globe/iris sizes preserved',Math.abs(e.calibration.radiusMM-12.2)<1e-8&&Math.abs(e.calibration.irisRadiusMM-5.307)<1e-8,e.calibration);check(e.name+' neutral iris reference upper/lower overlap',e.upperIrisCoverProjectedMM>0&&e.upperIrisCoverProjectedMM<3&&e.lowerIrisCoverProjectedMM>=0&&e.lowerIrisCoverProjectedMM<1.8,e);}
 await capture('01-neutral-gray');
 await page.evaluate(()=>{__STAGE1__.compare(true);__SKIN_LAB__.render();});results.originalContour=await page.evaluate(()=>__STAGE1__.report());await capture('02-original-contour-same-gray');
 await page.evaluate(()=>{__STAGE1__.compare(false);__SKIN_LAB__.render();});
 for(let i=0;i<2;i++)check('increased aperture without globe scaling '+i,results.neutral.eyes[i].heightAtAxisMM>results.originalContour.eyes[i].heightAtAxisMM+.7,{old:results.originalContour.eyes[i],new:results.neutral.eyes[i]});
 const poses=[{name:'neutral',closure:0,angles:{}},{name:'quarter',closure:.25,angles:{}},{name:'half',closure:.5,angles:{}},{name:'three-quarter',closure:.75,angles:{}},{name:'closed',closure:1,angles:{}},{name:'up',closure:0,angles:{pitch:-.18}},{name:'down',closure:0,angles:{pitch:.18}},{name:'left',closure:0,angles:{yaw:-.26}},{name:'right',closure:0,angles:{yaw:.26}},{name:'squint',closure:0,angles:{squint:.55}}];
 for(const p of poses){
  await page.evaluate(p=>{__STAGE1__.pose(p.closure,p.angles);__SKIN_LAB__.render();},p);
  const a=await page.evaluate(()=>({geometry:__STAGE1__.audit(true),contour:__STAGE1__.report(),head:__EYES__.sourceGeometry(),info:__EYES__.info()}));results.poses.push({pose:p,...a});
  check(p.name+' original head retained',JSON.stringify(a.head)===JSON.stringify(baselineGeometry),a.head);
  for(const e of a.geometry.eyes){check(p.name+' '+e.name+' finite vertices and shared margins',e.nonfiniteVertices===0&&e.maxSharedEdgeErrorMM<.00002&&e.outerBoundaryDeviationMM<.00002,e);check(p.name+' '+e.name+' sampled posterior surfaces clear globe',e.posteriorAndMarginPenetrations===0&&e.surfaceTests.trianglePenetrations===0,e.surfaceTests);check(p.name+' '+e.name+' eye not hidden to fake closure',!e.eyeHidden,e);}
  for(const e of a.contour.eyes){const n=results.neutral.eyes.find(v=>v.name===e.name);check(p.name+' '+e.name+' canthi fixed in 3D',['nasal','temporal'].every(k=>Math.hypot(...e.currentCanthiMM[k].map((v,i)=>v-n.currentCanthiMM[k][i]))<1e-7),e);if(p.closure===1)check('full closure '+e.name,e.closureCurveGapMM<1e-7&&e.actualClosedMarginGapMM<.00002,e);}
  if(['quarter','half','three-quarter','closed'].includes(p.name))await capture('03-'+p.name);
 }
 await page.evaluate(()=>{__STAGE1__.pose(0);__SKIN_LAB__.render();});
 for(const view of ['right','left','obliqueR','obliqueL','below','portrait']){await page.evaluate(v=>{__STAGE1__.view(v);__SKIN_LAB__.render();},view);await capture('04-'+view);}
 await page.evaluate(()=>{__STAGE1__.view('front');__STAGE1__.iris(false);__SKIN_LAB__.render();});await capture('05-pure-gray-no-iris');
 await page.evaluate(()=>{__STAGE1__.iris(true);__STAGE1__.anchors(true);__SKIN_LAB__.render();});await capture('06-independent-controls');
 await page.evaluate(()=>{__STAGE1__.anchors(false);__STAGE1__.setLight('right');__SKIN_LAB__.render();});await capture('07-opposite-light');
 await page.evaluate(()=>{__STAGE1__.setLight('left');__STAGE1__.pose(.5);});
 await page.click('#s1Neutral');await settle();check('neutral button returns closure zero',await page.evaluate(()=>__STAGE1__.report().currentClosure===0));
 await page.click('[data-s1-closure="1"]');await settle();check('UI full closure',await page.evaluate(()=>__STAGE1__.report().eyes.every(e=>e.actualClosedMarginGapMM<.00002)));
 await page.click('#s1Neutral');await page.focus('#s1Compare');await page.keyboard.down('Space');await settle();check('held baseline compare',await page.evaluate(()=>__STAGE1__.report().comparison==='ET07.3'));await page.keyboard.up('Space');await settle();check('compare release restores stage1',await page.evaluate(()=>__STAGE1__.report().comparison==='ET08-S1'));
 const recipeOK=await page.evaluate(()=>{const s=__EYES__.snapshot();__STAGE1__.compare(true);__EYES__.restore(s);__SKIN_LAB__.render();return !__EYES__.snapshot().stage1.compareOriginal;});check('saved stage1 recipe restores new contour',recipeOK);
 await page.goto(BASEURL+'preview.html',{waitUntil:'domcontentloaded',timeout:120000});await page.waitForFunction(()=>window.__STAGE1__&&window.__SKIN_LAB__?.state.ready,null,{timeout:180000});await settle();
 results.bundledReport=await page.evaluate(()=>__STAGE1__.report());check('standalone bundle matches source contour',results.bundledReport.eyes.every((e,i)=>Math.abs(e.widthMM-results.neutral.eyes[i].widthMM)<1e-8&&Math.abs(e.heightAtAxisMM-results.neutral.eyes[i].heightAtAxisMM)<1e-8));await capture('08-bundled-preview');
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>__STAGE1__.view('front'));await settle();await capture('09-mobile-viewport');
 await page.click('[data-quick="1"]');await settle();check('mobile viewport closure control',await page.evaluate(()=>__STAGE1__.report().currentClosure===1));
 await page.click('[data-quick="0"]');await page.click('#mobileToggle');await settle();await capture('10-mobile-panel');
 check('no horizontal mobile overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 check('no runtime or shader errors',errors.length===0,errors);
 results.pass=true;
})().catch(e=>{results.pass=false;results.error=e.stack;console.error(e);process.exitCode=1;}).finally(async()=>{
 results.errors=errors;if(page&&!results.pass)await page.screenshot({path:OUT+'/failure.png'}).catch(()=>{});if(browser)await browser.close();
 fs.writeFileSync(OUT+'/report.json',JSON.stringify(results,null,2));fs.writeFileSync(__dirname+'/qa-report.json',JSON.stringify(results,null,2));
 const evidence=__dirname+'/evidence';fs.mkdirSync(evidence,{recursive:true});for(const n of ['01-neutral-gray.png','02-original-contour-same-gray.png','03-closed.png','04-right.png','04-obliqueR.png','05-pure-gray-no-iris.png','09-mobile-viewport.png'])if(fs.existsSync(OUT+'/'+n))fs.copyFileSync(OUT+'/'+n,evidence+'/'+n);
 console.log('ET08_STAGE1_VERIFY',JSON.stringify({pass:results.pass,checks:results.checks.length,poses:results.poses.length,error:results.error,errors}));
});
