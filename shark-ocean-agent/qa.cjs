const {chromium}=require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const root=__dirname,out=path.join(root,'evidence');fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'};
const server=http.createServer((req,res)=>{let file=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/'||req.url==='/?qa')file=path.join(root,'index.html');if(!file.startsWith(root)){res.writeHead(403);return res.end();}fs.readFile(file,(e,b)=>{res.writeHead(e?404:200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(e?'Not found':b);});});
const report={head:process.env.GITHUB_SHA,browser:null,checks:[],errors:[],consoleErrors:[],requests:[],visualApproved:false,productionApproved:false};
const check=(name,pass,detail)=>report.checks.push({name,pass:!!pass,detail});
(async()=>{await new Promise(r=>server.listen(8765,'127.0.0.1',r));let browser;try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});report.browser=browser.version();
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',e=>{if(e.type()==='error')report.consoleErrors.push(e.text());});page.on('request',r=>report.requests.push(r.url()));
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'networkidle',timeout:60000});await page.waitForFunction(()=>window.SHARK_LAB?.ready,{timeout:60000});await page.evaluate(()=>SHARK_LAB.setManual(true));
 const audit=await page.evaluate(()=>SHARK_LAB.audit());report.initial=audit;check('actual_skinned_mesh',audit.skinnedMeshes===1&&audit.boneCount===29,audit);check('normalized_weights',audit.maxWeightError<1e-6);
 await page.screenshot({path:path.join(out,'01-ocean.png')});
 for(const mode of['neutral','studio','diagnostic']){await page.evaluate(m=>{SHARK_LAB.setMode(m);SHARK_LAB.homeView();},mode);await page.waitForTimeout(500);await page.screenshot({path:path.join(out,'02-'+mode+'.png')});}
 await page.evaluate(()=>{SHARK_LAB.setMode('ocean');SHARK_LAB.advance(8);SHARK_LAB.homeView();});let a=await page.evaluate(()=>SHARK_LAB.audit());check('no_spontaneous_predation',a.consumed===0&&!a.permission);
 let parsed=await page.evaluate(()=>SHARK_LAB.parse('先绕鱼群游两圈，再捕食两条银色小鱼，然后潜到水下六米'));check('compositional_plan',parsed.ok&&parsed.plan.tasks.map(t=>t.type).join(',')==='orbit,hunt,depth',parsed);
 await page.evaluate(async()=>{await SHARK_LAB.command('捕食最近的一条鱼');SHARK_LAB.advance(2);await SHARK_LAB.command('潜到水下六米');SHARK_LAB.advance(20);});
 a=await page.evaluate(()=>SHARK_LAB.audit());const state=await page.evaluate(()=>({depth:-SHARK_LAB.state.position.y,active:SHARK_LAB.state.active?.type,permission:SHARK_LAB.state.permission}));check('new_command_cancels_hunt',!state.permission&&state.active!=='hunt',state);check('depth_converges',Math.abs(state.depth-6)<.3,state);
 await page.evaluate(async()=>{await SHARK_LAB.command('捕食最近的一条鱼');SHARK_LAB.advance(60);SHARK_LAB.homeView();});a=await page.evaluate(()=>SHARK_LAB.audit());report.afterHunt=a;check('predation_completed',a.consumed>=1,a.events.filter(e=>e.type==='mouth_contact'||e.type==='prey_consumed'));
 const contacts=a.events.filter(e=>e.type==='mouth_contact'),consumed=a.events.filter(e=>e.type==='prey_consumed');check('contact_before_consumption',consumed.every(e=>contacts.some(c=>c.id===e.id&&c.time<e.time&&c.distance<.205&&c.epoch===e.epoch))&&consumed.length>0);check('bone_lengths_unchanged',a.maxLengthError<1e-9&&a.maxScaleError===0);
 await page.screenshot({path:path.join(out,'03-after-hunt.png')});
 await page.evaluate(async()=>{await SHARK_LAB.command('张开嘴巴三秒');SHARK_LAB.advance(.8);SHARK_LAB.setMode('neutral');SHARK_LAB.homeView();SHARK_LAB.camera.position.copy(SHARK_LAB.state.position).add({x:2,y:.15,z:3.2});});await page.waitForTimeout(500);await page.screenshot({path:path.join(out,'04-mouth-open.png')});
 await page.evaluate(async()=>{await SHARK_LAB.command('停止');SHARK_LAB.advance(1);SHARK_LAB.setMode('ocean');SHARK_LAB.homeView();});
 const malformed=await page.evaluate(async()=>SHARK_LAB.command('跳到月球上'));check('unsupported_rejected',!malformed.ok);
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500);await page.screenshot({path:path.join(out,'05-mobile.png')});check('mobile_no_horizontal_overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.locator('#pause').click();check('pause_button',await page.evaluate(()=>SHARK_LAB.state.paused));
 check('no_browser_errors',report.errors.length===0&&report.consoleErrors.length===0);check('no_external_visual_assets',!report.requests.some(u=>/\.(glb|gltf|obj|fbx|png|jpg|jpeg|hdr|webp)(\?|$)/i.test(u)));
 report.final=await page.evaluate(()=>SHARK_LAB.exportState());
 }catch(e){report.fatal=String(e);check('browser_completed',false,String(e));}finally{fs.writeFileSync(path.join(out,'BROWSER_QA.json'),JSON.stringify(report,null,2));if(browser)await browser.close();server.close();console.log(JSON.stringify({head:report.head,checks:report.checks,errors:report.errors,console:report.consoleErrors,fatal:report.fatal},null,2));if(report.checks.some(c=>!c.pass))process.exitCode=1;}})();
