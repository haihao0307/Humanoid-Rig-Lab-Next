const fs=require('node:fs'),path=require('node:path'),http=require('node:http');const{chromium}=require('playwright');
const root=path.resolve(__dirname,'../../..'),out=process.env.EVIDENCE_DIR||'/tmp/et07/visual';fs.mkdirSync(out,{recursive:true});
let browser,server,page;const report={errors:[],version:'ET07.3',realMobileDevice:false};
(async()=>{
 server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!f.startsWith(root+'/'))return res.writeHead(403).end();res.setHeader('Content-Type',({'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'})[path.extname(f)]||'application/octet-stream');const s=fs.createReadStream(f);s.on('error',()=>res.writeHead(404).end());s.pipe(res);});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=await chromium.launch({args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});page=await browser.newPage({viewport:{width:1280,height:960},deviceScaleFactor:1});page.setDefaultTimeout(90000);
 page.on('pageerror',e=>{report.errors.push(e.message);console.error('PAGE_ERROR',e.message);});page.on('console',m=>{if(m.type()==='error'){report.errors.push(m.text());console.error('BROWSER_ERROR',m.text());}});await page.addInitScript(()=>window.__EYE_QA_FREEZE__=true);
 await page.goto('http://127.0.0.1:'+server.address().port+'/skin-quality-lab/emily-transfer/index.html');await page.waitForFunction(()=>window.__SKIN_LAB__?.state.ready&&window.__EYES__?.audit,{},{timeout:160000});
 await page.evaluate(()=>{__TALKINGHEAD__.set({headMotion:false,paused:true,manualYaw:0,manualPitch:0});__EYES__.set({autoBlink:false,autoPupil:false,manualBlink:0,squint:0,opening:.88});__EYES__.setTarget([-.004,.069,.8]);__EYES__.step(0,true);});
 async function shot(n){await page.evaluate(()=>__SKIN_LAB__.render());const b=await page.evaluate(()=>document.querySelector('#viewport canvas').toDataURL('image/png'));fs.writeFileSync(out+'/'+n+'.png',Buffer.from(b.split(',')[1],'base64'));console.log('CAPTURED',n);}
 await page.click('[data-camera="eyes"]');await shot('01-eyes');report.resting=await page.evaluate(()=>__EYES__.audit(false));
 await page.click('[data-camera="lidBelow"]');await shot('02-under-upper');await page.click('[data-camera="lidSide"]');await shot('03-side');
 await page.click('[data-camera="eyes"]');await page.evaluate(()=>__EYES__.set({manualBlink:.5}));await shot('04-half');await page.evaluate(()=>__EYES__.set({manualBlink:1}));await shot('05-closed');
 await page.evaluate(()=>{__EYES__.set({manualBlink:0});__SKIN_LAB__.setView([.025,.070,.142],[.023,.069,.073]);});await shot('06-eye-macro');
 await page.evaluate(()=>__NATURAL_REVIEW__.scanRepair(false));await shot('11-unrepaired-scan-texture');await page.evaluate(()=>__NATURAL_REVIEW__.scanRepair(true));
 await page.selectOption('#layer','albedo');await shot('07-albedo');await page.selectOption('#layer','beauty');
 await page.selectOption('#lightPreset','raking');await shot('08-raking-macro');await page.selectOption('#lightPreset','studio');
 await page.click('[data-camera="portrait"]');await shot('09-portrait');await page.click('[data-camera="canthus"]');await shot('12-canthus-macro');
 await page.click('[data-camera="eyes"]');await page.evaluate(()=>__EYES__.set({enabled:false}));await shot('10-original-closed-skin');await page.evaluate(()=>__EYES__.set({enabled:true}));
 report.state=await page.evaluate(()=>__SKIN_LAB__.state);report.passed=report.errors.length===0;if(!report.passed)throw Error('Runtime errors');
})().catch(async e=>{report.passed=false;report.failure=e.stack;console.error(e);if(page)await page.screenshot({path:out+'/failure.png'}).catch(()=>{});process.exitCode=1;}).finally(async()=>{fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));if(browser)await browser.close();if(server)server.close();});
