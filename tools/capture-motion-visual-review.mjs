// Opt-in screenshot evidence from the real production WebGL renderer.
// Run in a separate headless browser; never sends desktop input.
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const out=process.env.MOTION_QA_DIR;if(!out)throw Error('MOTION_QA_DIR must point outside the repository');
const gaitSequence=process.env.MOTION_QA_SEQUENCE==='gait',minimumActors=gaitSequence?1:6;
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--enable-webgl','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1100,height:760}}),records=[],errors=[];
page.on('pageerror',e=>errors.push(String(e)));
try{
 await page.goto(process.env.HUMANLAB_URL||'http://127.0.0.1:4173/index.html?qa=1',{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(n=>{const l=document.querySelector('#bodyFrame')?.contentWindow?.HumanLab;return l?.population?.list().length>=n&&l.compact?.chunks?.length>0;},minimumActors,{timeout:600000});
 const actors=await page.evaluate(()=>{const lab=document.querySelector('#bodyFrame').contentWindow.HumanLab;lab.setAuto(false);lab.setCameraFollow(false);return lab.population.list().map(a=>({id:a.id,label:a.label}));});
 console.log('READY '+JSON.stringify(actors));
 async function capture(actor,name){
  for(const [view,angle]of [['front',.15],['side',Math.PI/2]]){
   const result=await page.evaluate(({id,angle})=>{
    const lab=document.querySelector('#bodyFrame').contentWindow.HumanLab,a=lab.population.get(id),h=a.human,r=lab.renderer;
    lab.render();const compacts=r.compacts,compact=r.compact,tissue=r.tissue;
    // Only visibility changes for this inspection; do not move actors or alter poses.
    const floor=r.lastItems.filter(o=>o.materialKind===5&&!o.id);
    r.compacts=[a.compact];r.compact=a.compact;r.tissue=a.tissue;
    r.yaw=a.agent.yaw+angle;r.pitch=.035;r.projection='perspective';r.target=[a.agent.pos[0],h.bodyMetrics.statureM*.46,a.agent.pos[2]];r.distance=h.bodyMetrics.statureM*1.8;
    r.render([...floor,...h.bones,...h.cartilage,...h.tissue.items].filter(o=>o.visible!==false),[]);
    const png=r.canvas.toDataURL('image/png');r.compacts=compacts;r.compact=compact;r.tissue=tissue;
    return{png,phase:a.agent.phase,posture:a.agent.basic.posture,error:a.agent.error,root:a.agent.pos,yaw:a.agent.yaw,footErrorM:a.agent.stats.maxFootPositionErrorM,ground:h.minimumBoneY(),groundCorrectionM:h.motionDriver.report().groundCorrectionM,bodyResponse:a.agent.locomotion.phaseController.report().bodyResponse,headQ:h.byId.get('head').world.q};
   },{id:actor.id,angle});
   const file=actor.id+'-'+name+'-'+view+'.png';await writeFile(join(out,file),Buffer.from(result.png.split(',')[1],'base64'));
   delete result.png;records.push({actor:actor.label,file,...result});console.log('CAPTURE '+file+' '+result.phase);
   if(result.error)throw Error(result.error);
  }
 }
 async function advance(seconds){await page.evaluate(seconds=>{const l=document.querySelector('#bodyFrame').contentWindow.HumanLab;l.advance(seconds);for(const a of l.population.values())if(a.agent.error)throw Error(a.id+': '+a.agent.error);},seconds);}
 async function command(id,text){return page.evaluate(({id,text})=>{const l=document.querySelector('#bodyFrame').contentWindow.HumanLab;return l.population.dispatch(text,{targets:[id],mode:'replace'});},{id,text});}
 for(const actor of actors)await capture(actor,'stand');
 const lead=actors[0];
 if(gaitSequence){
  await command(lead.id,'向前走1米');
  for(let i=1;i<=16;i++){await advance(.15);await capture(lead,'walk-'+String(i).padStart(2,'0'));}
  await advance(6);await capture(lead,'walk-settled');
  await command(lead.id,'向左转90度');
  for(let i=1;i<=20;i++){await advance(.15);await capture(lead,'turn-'+String(i).padStart(2,'0'));}
  await advance(6);await capture(lead,'turn-settled');
 }else{
 for(const s of [{n:'sit-mid',c:'坐下',dt:1.1},{n:'seated',dt:1.5},{n:'prepare',c:'起身',dt:.5},{n:'rise-mid',dt:1.4},{n:'stood',dt:6},{n:'walk-start',c:'向前走1米',dt:.25},{n:'walk-mid',dt:.65},{n:'walk-stop',dt:7},{n:'turn-mid',c:'向左转90度',dt:.7},{n:'turned',dt:6}]){if(s.c)await command(lead.id,s.c);await advance(s.dt);await capture(lead,s.n);}
 await page.evaluate(()=>document.querySelector('#bodyFrame').contentWindow.HumanLab.population.dispatch('挥手',{targets:'all',mode:'replace'}));
 await advance(1.2);for(const actor of actors)await capture(actor,'wave-mid');
 await advance(6);for(const actor of actors)await capture(actor,'wave-end');
 }
}finally{await writeFile(join(out,'review.json'),JSON.stringify({records,errors,visualAcceptance:false,isolatedRendering:true},null,2));await browser.close();}
if(errors.length)throw Error(errors.join('\n'));
