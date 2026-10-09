const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const publicCommit=process.env.PUBLIC_COMMIT,OUT=path.resolve(publicCommit?'qa-et09/public':'qa-et09'),ROOT=path.resolve(__dirname,'..');fs.mkdirSync(OUT,{recursive:true});
const url=publicCommit?'https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/'+publicCommit+'/skin-quality-lab/emily-transfer/preview.html':'http://127.0.0.1:8765/skin-quality-lab/emily-transfer/index.html';
const report={version:'ET09-S2',url,publicCommit,checks:[],poses:[],screenshots:[],errors:[],realMobileDeviceTested:false};let b,p;
function check(name,pass,detail){report.checks.push({name,pass:!!pass,detail});assert(pass,name+' '+JSON.stringify(detail));}
async function capture(name){await p.evaluate(()=>__SKIN_LAB__.render());await p.screenshot({path:OUT+'/'+name+'.png'});report.screenshots.push(name+'.png');}
(async()=>{
 b=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});p=await b.newPage({viewport:{width:1440,height:1040},deviceScaleFactor:1});
 p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await p.goto(url,{waitUntil:'domcontentloaded',timeout:120000});await p.waitForFunction(()=>window.__STAGE2__&&window.__SKIN_LAB__?.state.ready,null,{timeout:180000});await p.evaluate(()=>{window.__EYE_QA_FREEZE__=true;__STAGE2__.pose(0);__SKIN_LAB__.render();});
 const baseline=await p.evaluate(()=>({outline:__STAGE1__.report(),head:__EYES__.sourceGeometry(),sections:__STAGE2__.sections('right'),diagnostics:__STAGE1__.diagnostics()}));report.initial=baseline;check('correct stage',await p.evaluate(()=>__STAGE2__.version==='ET09-S2'));
 check('true gray material route',baseline.diagnostics.texturedVisibleMaterials===0&&!baseline.diagnostics.wetRimsVisible&&!baseline.diagnostics.eyelashesVisible&&!baseline.diagnostics.fuzzVisible,baseline.diagnostics);
 await capture('01-neutral-stage2');await p.evaluate(()=>__STAGE2__.compare(true));report.stage1Sections=await p.evaluate(()=>__STAGE2__.sections('right'));await capture('02-before-same-gray');await p.evaluate(()=>__STAGE2__.compare(false));
 const difference=Math.max(...baseline.sections.upper.map((v,i)=>Math.abs(v[2]-report.stage1Sections.upper[i][2])));check('real geometry changes, not only relabeling',difference>.0005,{maximumUpperSectionChangeMM:difference*1000});
 for(const pose of [{name:'neutral',b:0,a:{}},{name:'quarter',b:.25,a:{}},{name:'half',b:.5,a:{}},{name:'three-quarter',b:.75,a:{}},{name:'nearly-closed',b:.95,a:{}},{name:'closed',b:1,a:{}},{name:'up',b:0,a:{pitch:-.18}},{name:'down',b:0,a:{pitch:.18}},{name:'left',b:0,a:{yaw:-.26}},{name:'right',b:0,a:{yaw:.26}}]){
  await p.evaluate(q=>__STAGE2__.pose(q.b,q.a),pose);
  const r=await p.evaluate(()=>({section:__STAGE2__.report(),oldAudit:__STAGE2__.audit(true),closed:__STAGE1__.closedSurface(),outline:__STAGE1__.report(),head:__EYES__.sourceGeometry(),sections:[__STAGE2__.sections('right'),__STAGE2__.sections('left')]}));report.poses.push({pose,...r});
  check(pose.name+' same source head',JSON.stringify(r.head)===JSON.stringify(baseline.head));
  for(const e of r.section.eyes){check(pose.name+' '+e.name+' unchanged outline and boundary',e.outlineDeviationMM===0&&e.boundaryDeviationMM===0,e);check(pose.name+' '+e.name+' finite and clear outer surface',e.nonfiniteVertices===0&&e.outerPenetrations===0,e);check(pose.name+' '+e.name+' connected canthal tissue',e.canthus.maxAttachmentErrorMM===0&&e.canthus.penetratingVertices===0&&e.canthus.nonfiniteVertices===0,e.canthus);}
  for(const e of r.oldAudit.eyes)check(pose.name+' '+e.name+' posterior and edge triangle sampling',e.nonfiniteVertices===0&&e.maxSharedEdgeErrorMM<.00002&&e.surfaceTests.trianglePenetrations===0,e.surfaceTests);
  for(let i=0;i<2;i++)check(pose.name+' locked centre and radius '+i,JSON.stringify(r.outline.eyes[i].calibration)===JSON.stringify(baseline.outline.eyes[i].calibration));
  if(pose.b===1){check('whole closed target retained',r.section.eyes.every(e=>e.completeClosedSurfaceDeltaMM===0));check('S1 U-pocket regression',r.closed.eyes.every(e=>e.fullClosureLowerRestErrorMM<.00002&&e.fullClosureUpperRestErrorMM<.00002),r.closed);}
  if(pose.b>0)await capture('03-'+pose.name);
 }
 await p.evaluate(()=>__STAGE2__.pose(0));
 for(const view of ['right','left','medialR','medialL','obliqueR','obliqueL','under','portrait']){await p.evaluate(v=>__STAGE2__.view(v),view);await capture('04-'+view);}
 await p.evaluate(()=>{__STAGE2__.view('right');__STAGE2__.sectionLines(true);});await capture('05-actual-section-lines');await p.evaluate(()=>{__STAGE2__.sectionLines(false);__STAGE2__.view('front');__STAGE1__.iris(false);});await capture('06-pure-gray');
 await p.evaluate(()=>{__STAGE1__.iris(true);__STAGE1__.setLight('right');});await capture('07-opposite-light');
 await p.evaluate(()=>{__STAGE1__.setLight('left');__STAGE2__.pose(1);});report.closurePixels=[];
 for(const view of ['front','obliqueR','obliqueL','under']){await p.evaluate(v=>__STAGE2__.view(v),view);const pixels=await p.evaluate(()=>__STAGE2__.globePixels());report.closurePixels.push({view,...pixels});check('closed visible globe pixels '+view,pixels.visibleGlobePixels===0&&!pixels.eyeObjectsHidden,pixels);await capture('08-closed-'+view);}
 await p.evaluate(()=>__STAGE2__.pose(0));const positive=await p.evaluate(()=>__STAGE2__.globePixels());check('eye visibility detector positive control',positive.visibleGlobePixels>100&&!positive.eyeObjectsHidden,positive);
 await p.click('#s2Neutral');await p.focus('#s2Compare');await p.keyboard.down('Space');check('held stage1 comparison',await p.evaluate(()=>!__STAGE2__.report().enabled));await p.keyboard.up('Space');check('released stage2 restored',await p.evaluate(()=>__STAGE2__.report().enabled));
 await p.click('[data-s2-close="1"]');check('closed button',await p.evaluate(()=>__STAGE1__.report().currentClosure===1));await p.click('#s2Neutral');
 const restored=await p.evaluate(()=>{const s=__EYES__.snapshot();__STAGE2__.compare(true);__EYES__.restore(s);return __STAGE2__.report().enabled;});check('saved recipe restores stage2 state',restored);
 await p.setViewportSize({width:390,height:844});await p.evaluate(()=>__STAGE2__.view('front'));await capture('09-mobile-viewport');await p.click('[data-quick="1"]');check('mobile closed shortcut',await p.evaluate(()=>__STAGE1__.report().currentClosure===1));await p.click('[data-quick="0"]');await p.click('#mobileToggle');await capture('10-mobile-panel');
 check('no mobile horizontal overflow',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));check('no JavaScript or shader errors',report.errors.length===0,report.errors);report.pass=true;
})().catch(e=>{report.pass=false;report.error=e.stack;console.error(e);process.exitCode=1;}).finally(async()=>{if(p&&!report.pass)await p.screenshot({path:OUT+'/failure.png'}).catch(()=>{});if(b)await b.close();fs.writeFileSync(OUT+'/report.json',JSON.stringify(report,null,2));if(!publicCommit)fs.writeFileSync(__dirname+'/qa-report.json',JSON.stringify(report,null,2));console.log('ET09_VERIFY',JSON.stringify({pass:report.pass,checks:report.checks.length,errors:report.errors,error:report.error}));});
