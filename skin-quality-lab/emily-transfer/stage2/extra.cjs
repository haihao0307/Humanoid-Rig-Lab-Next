const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const commit=process.env.PUBLIC_COMMIT,OUT=path.resolve(commit?'qa-et09/public':'qa-et09'),url=commit?'https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/'+commit+'/skin-quality-lab/emily-transfer/preview.html':'http://127.0.0.1:8765/skin-quality-lab/emily-transfer/index.html';
const report={version:'ET09-S2',commit,url,checks:[],poses:[],errors:[],scope:'Additional outer, medial and lateral triangle samples; no exhaustive CCD claim'};let b,p;fs.mkdirSync(OUT,{recursive:true});
function check(name,pass,detail){report.checks.push({name,pass:!!pass,detail});assert(pass,name+' '+JSON.stringify(detail));}
(async()=>{
 b=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});p=await b.newPage({viewport:{width:1440,height:1040}});p.on('pageerror',e=>report.errors.push(e.message));await p.goto(url,{waitUntil:'domcontentloaded',timeout:120000});await p.waitForFunction(()=>window.__STAGE2__&&window.__SKIN_LAB__?.state.ready,null,{timeout:180000});await p.evaluate(()=>{window.__EYE_QA_FREEZE__=true;__STAGE2__.pose(0);});
 for(const b of [0,.25,.5,.75,.85,.95,.98,1]){
  const r=await p.evaluate(b=>{__STAGE2__.pose(b);return {surface:__STAGE2__.audit(true),section:__STAGE2__.report(),outline:__STAGE1__.report()};},b);report.poses.push({b,...r});
  for(const e of r.surface.eyes)for(const t of e.stage2SurfaceTests||[])check('closure '+b+' '+e.name+' '+t.name+' triangle surface',t.samples>0&&t.penetrations===0,t);
  check('closure '+b+' fixed XY eye slit',Math.abs(r.outline.eyes[0].widthMM-23.4)<1e-8&&Math.abs(r.outline.eyes[1].widthMM-23)<1e-8);
  if(b===0)for(const e of r.section.eyes){check(e.name+' lake meets numerical contact interface',e.canthus.minimumGlobeGapMM>=.08&&e.canthus.minimumGlobeGapMM<=.09,e.canthus);check(e.name+' limited open canthal depth smoothing',e.maxOpenCanthalDepthCorrectionMM<1.1,e.maxOpenCanthalDepthCorrectionMM);}
  if(b===1)check('full closure no new canthal depth correction',r.section.eyes.every(e=>e.maxOpenCanthalDepthCorrectionMM===0&&e.completeClosedSurfaceDeltaMM===0));
 }
 await p.evaluate(()=>{__STAGE2__.pose(0);__STAGE2__.view('front');});
 for(const name of ['right','left']){
  const s=await p.evaluate(name=>__STAGE2__.sections(name),name),y0=s.upper[0][1],band=s.upper.filter(v=>v[1]-y0>.0018&&v[1]-y0<.0031),groove=s.upper.filter(v=>v[1]-y0>.0031&&v[1]-y0<.0042);
  const relief=(Math.max(...band.map(p=>p[2]))-Math.min(...groove.map(p=>p[2])))*1000;
  check(name+' visible geometric supratarsal groove',relief>.10&&relief<.7,{reliefMM:relief,notTexture:true});
 }
 for(const name of ['medialR','medialL','under']){await p.evaluate(n=>{__STAGE2__.view(n);__SKIN_LAB__.render();},name);await p.screenshot({path:OUT+'/extra-'+name+'.png'});}
 check('no runtime errors',report.errors.length===0,report.errors);report.pass=true;
})().catch(e=>{report.pass=false;report.error=e.stack;console.error(e);process.exitCode=1;}).finally(async()=>{if(p&&!report.pass)await p.screenshot({path:OUT+'/extra-failure.png'}).catch(()=>{});if(b)await b.close();fs.writeFileSync(OUT+'/extra-report.json',JSON.stringify(report,null,2));console.log('ET09_EXTRA',JSON.stringify({pass:report.pass,checks:report.checks.length,error:report.error}));});
