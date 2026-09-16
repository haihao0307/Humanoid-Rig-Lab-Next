// Opt-in real-browser motion smoke. No desktop input; artifacts stay outside
// the source tree. This is execution/contact evidence, not visual acceptance.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const out=process.env.MOTION_QA_DIR||join(tmpdir(),'human-motion-qa');await mkdir(out,{recursive:true});
const args=['--no-sandbox','--enable-webgl','--ignore-gpu-blocklist'];
if(process.env.HUMANLAB_SOFTWARE_GL==='1')args.push('--use-angle=swiftshader','--enable-unsafe-swiftshader');
const browser=await chromium.launch({headless:true,args,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{})});
const page=await browser.newPage({viewport:{width:1100,height:760}}),pageErrors=[],results=[];
page.on('pageerror',error=>pageErrors.push(String(error)));
let startup=null,crowd=null,failure=null;
try{
 await page.goto(process.env.HUMANLAB_URL||'http://127.0.0.1:4173/index.html?qa=1',{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>{const w=document.querySelector('#bodyFrame')?.contentWindow;return w?.HumanLab?.population?.list().length>=2||w?.__startupError;},null,{timeout:480000});
 startup=await page.evaluate(()=>{
  const w=document.querySelector('#bodyFrame').contentWindow,lab=w.HumanLab;
  if(w.__startupError)throw Error(w.__startupError);lab.setAuto(false);lab.inspectBody('front');
  const gl=w.document.querySelector('#view').getContext('webgl2');
  const pose=lab.agent.locomotion.pose,apply=pose.apply;
  lab.motionQA={adoptedSamples:0,maxAdoptedAngleRad:0,floorSamples:0,loweredFloorSamples:0,maxLoweringM:0,maxFloorGapM:0};
  pose.apply=function(...args){const result=apply.apply(this,args),s=this.engine.state;
   if(args[0]?.groundSupport==='continuous-floor'){
    const report=this.report(),qa=lab.motionQA;qa.floorSamples++;
    qa.maxFloorGapM=Math.max(qa.maxFloorGapM,Math.abs(report.ground.y-.0005));
    qa.maxLoweringM=Math.max(qa.maxLoweringM,-report.groundCorrectionM);
    if(report.groundCorrectionM<-.000001)qa.loweredFloorSamples++;
   }
   for(const side of ['left','right']){const foot=s.feet[side];if(!foot.adoptedOrientation||!foot.contact||s.swing?.side===side)continue;
    const q=this.h.byId.get(side+'_foot').world.q,goal=foot.adoptedOrientation;
    const d=Math.min(1,Math.abs(q.reduce((sum,v,k)=>sum+v*goal[k],0)));
    lab.motionQA.maxAdoptedAngleRad=Math.max(lab.motionQA.maxAdoptedAngleRad,2*Math.acos(d));lab.motionQA.adoptedSamples++;
   }return result;
  };
  return{status:w.__humanStartup,population:lab.population.list().length,webgl:!!gl,contextLost:gl?.isContextLost()};
 });
 assert(startup.webgl&&!startup.contextLost);console.log('STARTUP '+JSON.stringify(startup));
 for(const command of ['坐下','躺下','坐下','起身','向前走1米','向左转90度','挥手']){
  console.log('BEGIN '+command);
  const result=await page.evaluate(command=>{
   const lab=document.querySelector('#bodyFrame').contentWindow.HumanLab,a=lab.agent,start=a.stats.completed,phases=new Set();
   lab.command(command);
   for(let i=0;i<240;i++){
    lab.advance(.1);phases.add(a.phase);if(a.error)throw Error(command+': '+a.error);
    if(a.stats.completed>start&&a.activity().readyForTask)break;
   }
   return{command,completed:a.stats.completed-start,ready:a.activity().readyForTask,posture:a.basic.posture,phases:[...phases],
    maxFootM:a.stats.maxFootPositionErrorM,maxBoneM:a.stats.maxBoneLengthErrorM,...lab.motionQA};
  },command);
  assert.equal(result.completed,1,command+' must complete');assert(result.ready);assert(result.maxFootM<.012);
  if(command==='起身'){assert(result.adoptedSamples>0);assert(result.maxAdoptedAngleRad<1e-6);}
  results.push(result);console.log('ACTION '+JSON.stringify(result));
  // The review cast is arranged along X; a side camera is occluded by the
  // neighbouring actor. Keep the whole body framed from a clear front angle.
  await page.evaluate(()=>{const lab=document.querySelector('#bodyFrame').contentWindow.HumanLab;lab.inspectBody('front');lab.renderer.yaw=0;lab.renderer.target=[lab.agent.pos[0],lab.human.bodyMetrics.statureM*.45,lab.agent.pos[2]];lab.render();});
  const png=await page.evaluate(()=>document.querySelector('#bodyFrame').contentWindow.HumanLab.renderer.canvas.toDataURL('image/png'));
  await writeFile(join(out,'motion-'+results.length+'.png'),Buffer.from(png.split(',')[1],'base64'));
 }
 await page.waitForFunction(()=>document.querySelector('#bodyFrame')?.contentWindow?.HumanLab?.population?.list().length>=6,null,{timeout:480000});
 crowd=await page.evaluate(()=>{
  const lab=document.querySelector('#bodyFrame').contentWindow.HumanLab,p=lab.population;
  const before=Object.fromEntries([...p.values()].map(a=>[a.id,a.agent.stats.completed]));
  const dispatch=p.dispatch('挥手',{targets:'all',mode:'replace'});
  for(let i=0;i<360;i++){
   lab.advance(.1);const actors=[...p.values()];
   for(const a of actors)if(a.agent.error)throw Error(a.id+': '+a.agent.error);
   if(actors.every(a=>a.agent.stats.completed>before[a.id]&&a.agent.activity().readyForTask))break;
  }
  return{dispatch,actors:[...p.values()].map(a=>({id:a.id,completed:a.agent.stats.completed-before[a.id],ready:a.agent.activity().readyForTask}))};
 });
 assert.equal(crowd.actors.length,6);for(const a of crowd.actors){assert.equal(a.completed,1);assert(a.ready);}
 assert(results.at(-1).floorSamples>0);assert(results.at(-1).loweredFloorSamples>0);assert(results.at(-1).maxFloorGapM<1e-6);
 assert.equal(pageErrors.length,0);console.log('PASS '+JSON.stringify({actions:results.length,simultaneousGestures:crowd.actors.length,pageErrors:0,visualAcceptance:false,crowdPerformanceMeasured:false}));
}catch(error){failure=String(error);console.error('FAIL '+failure);process.exitCode=1;
 try{console.error('STATE '+JSON.stringify(await page.evaluate(()=>{const w=document.querySelector('#bodyFrame')?.contentWindow,lab=w?.HumanLab;return{startup:w?.__humanStartup,startupError:w?.__startupError,population:lab?.population?.list().length,error:lab?.agent?.error,basic:lab?.agent?.basic?.report(),pose:lab?.agent?.locomotion?.pose.report()};})));}catch{}
}
finally{await writeFile(join(out,'motion-browser-results.json'),JSON.stringify({startup,results,crowd,pageErrors,failure,visualAcceptance:false},null,2));await browser.close();}
