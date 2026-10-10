const fs=require('fs'),{chromium}=require('playwright'),assert=require('assert/strict');
const sha=process.env.PUBLIC_COMMIT,out=sha?'qa-et11/public':'qa-et11/source';fs.mkdirSync(out,{recursive:true});
const url=sha?'https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/'+sha+'/skin-quality-lab/emily-transfer/preview.html':'http://127.0.0.1:8765/skin-quality-lab/emily-transfer/index.html';
const report={version:'ET11-M1',sha,url,checks:[],poses:[],errors:[],realMobileDeviceTested:false};let b,p;
function check(name,v,detail){report.checks.push({name,pass:!!v,detail});assert(v,name);}
(async()=>{
 b=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});p=await b.newPage({viewport:{width:1440,height:1040},deviceScaleFactor:1});p.on('pageerror',e=>report.errors.push(e.message));
 await p.goto(url,{waitUntil:'domcontentloaded',timeout:120000});await p.waitForFunction(()=>window.__MEDIAL_TRANSFER__&&__SKIN_LAB__.state.ready,null,{timeout:180000});
 await p.evaluate(()=>{window.__EYE_QA_FREEZE__=true;__MEDIAL_TRANSFER__.pose(0);__SKIN_LAB__.render();});report.neutral=await p.evaluate(()=>__MEDIAL_TRANSFER__.report());
 for(const e of report.neutral.eyes)check(e.name+' measurable medial recess, no globe scale',Math.max(...e.points.map(q=>q.recessMM))>.30&&Math.abs(e.radiusMM-12.2)<1e-7,e);
 for(const [view,name]of[['front','01-front'],['medialR','02-medialR'],['medialL','03-medialL'],['under','04-under'],['right','05-right']]){await p.evaluate(v=>{__STAGE3__.view(v);__SKIN_LAB__.render();},view);await p.screenshot({path:out+'/'+name+'.png'});}
 await p.evaluate(()=>{__STAGE3__.view('medialR');__MEDIAL_TRANSFER__.before(true);__SKIN_LAB__.render();});await p.screenshot({path:out+'/06-before.png'});await p.evaluate(()=>__MEDIAL_TRANSFER__.before(false));
 for(const closure of[0,.25,.5,.75,.9,.98,1]){
  const q=await p.evaluate(v=>{__MEDIAL_TRANSFER__.pose(v);__SKIN_LAB__.render();return {report:__MEDIAL_TRANSFER__.report(),audit:__MEDIAL_TRANSFER__.audit(true),closure:__STAGE1__.closedSurface(),coordinates:__STAGE3__.report().coordinates};},closure);report.poses.push(q);
  for(const e of q.audit.eyes){check(closure+' '+e.name+' finite joined surface',e.nonfiniteVertices===0&&e.maxSharedEdgeErrorMM<.00003&&e.outerBoundaryDeviationMM<.00004,e);check(closure+' '+e.name+' no sampled inward penetration',e.posteriorAndMarginPenetrations===0&&e.surfaceTests.trianglePenetrations===0&&e.stage2SurfaceTests.every(t=>t.penetrations===0),e.stage2SurfaceTests);}
  if(closure===1){for(const e of q.report.eyes)check('closed nasal endpoint preserved '+e.name,e.points.every(q=>Math.abs(q.recessMM)<1e-7));for(const view of['front','under','obliqueR','obliqueL']){await p.evaluate(v=>{__STAGE3__.view(v);__SKIN_LAB__.render();},view);const pixels=await p.evaluate(()=>__STAGE3__.globePixels());check('closed globe covered '+view,pixels.visibleGlobePixels===0&&!pixels.eyeObjectsHidden,pixels);await p.screenshot({path:out+'/closed-'+view+'.png'});}}
 }
 await p.click('#et11Open');await p.focus('#et11Before');await p.keyboard.down('Space');check('held prior state',await p.evaluate(()=>!__MEDIAL_TRANSFER__.report().enabled));await p.keyboard.up('Space');check('released repaired state',await p.evaluate(()=>__MEDIAL_TRANSFER__.report().enabled));
 await p.setViewportSize({width:390,height:844});await p.evaluate(()=>{__STAGE3__.view('front');__SKIN_LAB__.render();});await p.screenshot({path:out+'/mobile.png'});check('no runtime errors',!report.errors.length,report.errors);report.pass=true;
})().catch(e=>{report.pass=false;report.error=e.stack;process.exitCode=1;console.error(e);}).finally(async()=>{if(p&&!report.pass)await p.screenshot({path:out+'/failure.png'}).catch(()=>{});if(b)await b.close();fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));console.log('ET11',report.pass,report.error||'',report.checks.length);});
