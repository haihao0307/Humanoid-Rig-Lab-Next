const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{chromium}=require('playwright');
const commit=process.env.PUBLIC_COMMIT,OUT=path.resolve(commit?'qa-et10/public':'qa-et10/source'),root=commit?'https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/'+commit+'/skin-quality-lab/emily-transfer/':null;
const url=commit?'https://htmlpreview.github.io/?'+root+'preview.html':'http://127.0.0.1:8765/skin-quality-lab/emily-transfer/index.html';
const report={version:'ET10-S3',commit:commit||null,url,checks:[],poses:[],errors:[],screenshots:[],realMobileDeviceTested:false,scope:'Sampled browser geometry, static material attribute checks, public identity and pixels; not continuous collision certification or clinical data'};let browser,page;
fs.mkdirSync(OUT,{recursive:true});
function check(name,pass,detail){report.checks.push({name,pass:!!pass,detail});assert(pass,name+' '+JSON.stringify(detail));}
async function capture(name){await page.evaluate(()=>__SKIN_LAB__.render());await page.waitForTimeout(120);await page.screenshot({path:OUT+'/'+name+'.png'});report.screenshots.push(name+'.png');}
async function canvasHash(){return page.evaluate(()=>{const src=document.querySelector('#viewport canvas'),c=document.createElement('canvas');c.width=256;c.height=192;const ctx=c.getContext('2d');ctx.drawImage(src,0,0,256,192);const d=ctx.getImageData(0,0,256,192).data;let h=2166136261,min=255,max=0;for(let i=0;i<d.length;i++){h^=d[i];h=Math.imul(h,16777619);if(i%4!==3){min=Math.min(min,d[i]);max=Math.max(max,d[i]);}}return {hash:(h>>>0).toString(16),range:max-min};});}
(async()=>{
 if(commit){const [hr,mr]=await Promise.all([fetch(root+'preview.html'),fetch(root+'BUILD_MANIFEST.json')]);assert(hr.ok&&mr.ok);const bytes=Buffer.from(await hr.arrayBuffer()),m=await mr.json(),sha=crypto.createHash('sha256').update(bytes).digest('hex');check('actual immutable HTML identity',m.version==='ET10-S3'&&sha===m.previewSHA256&&bytes.length===m.previewBytes,{sha256:sha,bytes:bytes.length,manifest:m});}
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});page=await browser.newPage({viewport:{width:1440,height:1040},deviceScaleFactor:1});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.location().url?.endsWith('/favicon.ico'))report.errors.push(m.text());});
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});await page.waitForFunction(()=>window.__STAGE3__&&window.__SKIN_LAB__?.state.ready,null,{timeout:180000});
 await page.evaluate(()=>{window.__EYE_QA_FREEZE__=true;__STAGE3__.pose(0);__STAGE3__.mode('gray');__SKIN_LAB__.render();});
 report.neutral=await page.evaluate(()=>__STAGE3__.report());const hashNew=await canvasHash();check('actual rendered geometry',hashNew.range>70,hashNew);
 check('brow genuinely changes original surface not separate tube',report.neutral.brow.affectedHeadVertices>100&&report.neutral.brow.maxForwardMM>1&&report.neutral.brow.maxForwardMM<3&&!report.neutral.brow.separateBrowObject,report.neutral.brow);
 await capture('01-gray-brow-medial');
 const centres=report.neutral.eyes.map(e=>e.centreMM),sourceGeometry=await page.evaluate(()=>__EYES__.sourceGeometry());
 await page.evaluate(()=>{__STAGE3__.compare(true);__SKIN_LAB__.render();});const hashOld=await canvasHash();await capture('02-before-same-gray');check('geometric held comparison changes rendered pixels',hashNew.hash!==hashOld.hash,{before:hashOld,after:hashNew});
 await page.evaluate(()=>{__STAGE3__.compare(false);__SKIN_LAB__.render();});check('geometry comparison restores deterministic pixels',(await canvasHash()).hash===hashNew.hash);
 for(const v of ['brow','browSide','medialR','medialL','right','left','under','portrait']){await page.evaluate(v=>{__STAGE3__.view(v);__SKIN_LAB__.render();},v);await capture('03-'+v);}
 await page.evaluate(()=>__STAGE3__.view('front'));
 report.modePixels={};for(const mode of ['gray','grid','material','strain','regions']){await page.evaluate(m=>{__STAGE3__.mode(m);__SKIN_LAB__.render();},mode);report.modePixels[mode]=await canvasHash();await capture('04-'+mode);}
 check('all five modes affect actual canvas',new Set(Object.values(report.modePixels).map(v=>v.hash)).size===5,report.modePixels);
 const poses=[{name:'neutral',b:0,a:{}},{name:'quarter',b:.25,a:{}},{name:'half',b:.5,a:{}},{name:'three-quarter',b:.75,a:{}},{name:'near',b:.95,a:{}},{name:'closed',b:1,a:{}},{name:'up',b:0,a:{pitch:-.18}},{name:'down',b:0,a:{pitch:.18}},{name:'left',b:0,a:{yaw:-.26}},{name:'right',b:0,a:{yaw:.26}}];
 for(const pose of poses){
  const r=await page.evaluate(({b,a})=>{__STAGE3__.pose(b,a);__STAGE3__.mode('grid');__SKIN_LAB__.render();return {r:__STAGE3__.report(),outline:__STAGE1__.report(),audit:__STAGE3__.audit(true),head:__EYES__.sourceGeometry()};},pose);report.poses.push({pose,...r});
  check(pose.name+' same head asset topology and buffer identity',JSON.stringify(r.head)===JSON.stringify(sourceGeometry),r.head);
  // Metres-to-millimetres gives 12.200000000000001 in IEEE754; use 1e-9 mm,
  // not a rounded diagnostic field or any changed geometry acceptance limit.
  check(pose.name+' fixed eyeball radius and all centre coordinates',r.r.eyes.every((e,i)=>Math.abs(e.radiusMM-12.2)<1e-9&&e.centreMM.every((v,j)=>Math.abs(v-centres[i][j])<1e-7)),r.r.eyes.map(e=>({radius:e.radiusMM,centre:e.centreMM})));
  check(pose.name+' immutable finite rest coordinates',r.r.coordinates.entries.every(e=>e.immutableRestAttributes&&e.finiteAttributes),r.r.coordinates.entries);
  check(pose.name+' shared material chart at skin rim mucosa',r.r.coordinates.materialBoundaryMaxError<1e-7,r.r.coordinates.materialBoundaryMaxError);
  for(const e of r.r.eyes){check(pose.name+' '+e.name+' brow stays off closed free edge and lower lid',e.brow.freeMarginCorrectionMM===0&&e.brow.lowerLidCorrectionMM===0,e.brow);check(pose.name+' '+e.name+' brow ring joins head',e.brow.joinedOuterBoundaryErrorMM<.00003,e.brow);check(pose.name+' '+e.name+' inner-canthus attachments and vertices',e.medial.maxAttachmentErrorMM<.00003&&e.medial.nonfiniteVertices===0&&e.medial.penetrations===0,e.medial);}
  for(const e of r.audit.eyes){check(pose.name+' '+e.name+' inherited skin margin contact',e.nonfiniteVertices===0&&e.maxSharedEdgeErrorMM<.00003&&e.posteriorAndMarginPenetrations===0&&e.surfaceTests.trianglePenetrations===0,e.surfaceTests);for(const t of e.stage2SurfaceTests||[])check(pose.name+' '+e.name+' actual '+t.name+' triangle contact',t.penetrations===0,t);}
  if(pose.b===1)check('actual complete closure free-edge gap',r.outline.eyes.every(e=>e.actualClosedMarginGapMM<.00003),r.outline.eyes.map(e=>e.actualClosedMarginGapMM));
  if(['half','closed'].includes(pose.name)){await capture('05-grid-'+pose.name);await page.evaluate(()=>__STAGE3__.mode('gray'));await capture('05-gray-'+pose.name);}
 }
 await page.evaluate(()=>{__STAGE3__.pose(1);__STAGE3__.mode('gray');});
 report.closedViews=[];for(const v of ['front','obliqueR','obliqueL','under']){await page.evaluate(v=>__STAGE3__.view(v),v);const r=await page.evaluate(()=>__STAGE3__.globePixels());report.closedViews.push({view:v,...r});check('closed '+v+' no exposed globe pixels and no hidden eyeball',r.visibleGlobePixels===0&&!r.eyeObjectsHidden,r);await capture('06-closed-'+v);}
 await page.evaluate(()=>{__STAGE3__.pose(0);__STAGE3__.view('front');});const positive=await page.evaluate(()=>__STAGE3__.globePixels());check('globe pixel test positive control',positive.visibleGlobePixels>100,positive);
 const loop=await page.evaluate(()=>{for(let pass=0;pass<2;pass++)for(const b of [0,.25,.5,.75,.9,1,.9,.75,.5,.25,0])__STAGE3__.pose(b);const s=__EYES__.snapshot();__STAGE3__.mode('material');__STAGE3__.compare(true);__EYES__.restore(s);__SKIN_LAB__.render();return {r:__STAGE3__.report(),s:__EYES__.snapshot()};});
 check('coordinate arrays unchanged after repeated closure',loop.r.coordinates.entries.every(e=>e.immutableRestAttributes));check('recipe restores mode and geometry',loop.s.stage3.mode==='gray'&&loop.s.stage3.geometry===true,loop.s.stage3);
 await page.focus('#s3Compare');await page.keyboard.down('Space');check('held compare uses prior geometry',await page.evaluate(()=>!__STAGE3__.report().geometryEnabled));await page.keyboard.up('Space');check('release returns new geometry',await page.evaluate(()=>__STAGE3__.report().geometryEnabled));
 await page.click('[data-s3-mode="grid"]');await page.click('[data-s3-close="1"]');check('chart and closure controls connected',await page.evaluate(()=>__STAGE3__.report().materialMode==='grid'&&__STAGE1__.report().currentClosure===1));await page.click('#s3Neutral');await page.click('[data-s3-mode="gray"]');
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{__STAGE3__.view('front');__SKIN_LAB__.render();});await capture('07-mobile-viewport');await page.click('[data-quick="1"]');check('mobile quick closure works',await page.evaluate(()=>__STAGE1__.report().currentClosure===1));await page.click('[data-quick="0"]');await page.click('#mobileToggle');await capture('08-mobile-panel');check('no horizontal mobile overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 check('no JavaScript or shader errors',report.errors.length===0,report.errors);report.pass=true;
})().catch(e=>{report.pass=false;report.error=e.stack;console.error(e);process.exitCode=1;}).finally(async()=>{
 if(page&&!report.pass)await page.screenshot({path:OUT+'/failure.png'}).catch(()=>{});if(browser)await browser.close();fs.writeFileSync(OUT+'/report.json',JSON.stringify(report,null,2));if(!commit)fs.writeFileSync(__dirname+'/qa-report.json',JSON.stringify(report,null,2));console.log('ET10_VERIFY',JSON.stringify({pass:report.pass,commit,checks:report.checks.length,error:report.error,errors:report.errors}));
});
