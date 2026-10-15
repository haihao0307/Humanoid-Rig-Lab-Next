import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import crypto from 'node:crypto';
const url=process.argv[2],label=process.argv[3]||'candidate';if(!url)throw Error('URL required');
mkdirSync('evidence',{recursive:true});const results=[],errors=[],shots={};
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const page=await browser.newPage({viewport:{width:1180,height:860},deviceScaleFactor:1});
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
const check=(name,pass,extra={})=>{results.push({name,pass,...extra});console.log(pass?'PASS':'FAIL',name,JSON.stringify(extra));if(!pass)throw Error(name)};
const audit=()=>page.evaluate(()=>DENIM_R17.audit());
async function settle(){await page.evaluate(()=>DENIM_R17.renderNow());await page.waitForTimeout(80)}
async function capture(name){await settle();const data=await page.evaluate(()=>DENIM_R17.capture());const b=Buffer.from(data.split(',')[1],'base64');writeFileSync(`evidence/${label}-${name}.png`,b);shots[name]=PNG.sync.read(b);const hash=crypto.createHash('sha256').update(b).digest('hex');let visible=0,blue=0,amber=0,lum=0,lum2=0,n=0;for(let i=0;i<shots[name].data.length;i+=4){const r=shots[name].data[i],g=shots[name].data[i+1],bl=shots[name].data[i+2],a=shots[name].data[i+3];if(a>5&&r+g+bl>12)visible++;if(bl>r*1.18&&bl>g*1.05&&bl>32)blue++;if(r>g*1.35&&g>bl*1.35&&r>80)amber++;const l=(r+g+bl)/3;lum+=l;lum2+=l*l;n++;}const variance=lum2/n-(lum/n)**2;check(name+' contains rendered image',b.length>12000&&visible>20000&&variance>120,{bytes:b.length,hash,visible,blue,amber,variance});return {hash,visible,blue,amber,variance}}
function diff(a,b){let sum=0,n=0,changed=0;for(let i=0;i<a.data.length;i+=4)for(let k=0;k<3;k++){const d=Math.abs(a.data[i+k]-b.data[i+k]);sum+=d;n++;if(d>4)changed++;}return {mae:sum/n,changedFraction:changed/n}}
try{
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:90000});await page.waitForFunction(()=>window.DENIM_R17?.audit().ready,null,{timeout:90000});
 let s=await audit();check('version and physical baseline',s.version==='DENIM-R17-GARMENT-SCALE'&&Math.abs(s.parameters.warpPitchMM-.4233333333)<1e-6&&Math.abs(s.parameters.fillPitchMM-.635)<1e-6&&Math.abs(s.parameters.stitchPitchMM-2.73)<.02,{parameters:s.parameters});
 check('actual procedural garment mesh',s.mesh.vertices>10000&&s.mesh.triangles>18000,s.mesh);
 await page.evaluate(()=>{DENIM_R17.setView('full');DENIM_R17.setParam('weaveScale',1);DENIM_R17.setParam('mode',0);});const full=await capture('full-physical');
 await page.evaluate(()=>DENIM_R17.setParam('weaveScale',.45));await capture('full-too-small');const scaleDiff=diff(shots['full-physical'],shots['full-too-small']);check('physical and underscale comparison actually differ',scaleDiff.mae>.35&&scaleDiff.changedFraction>.01,scaleDiff);
 await page.evaluate(()=>{DENIM_R17.setParam('weaveScale',1);DENIM_R17.setView('mid');});const mid=await capture('mid-physical');check('mid distance retains denim blue identity',mid.blue>15000,mid);
 await page.evaluate(()=>DENIM_R17.setParam('mode',1));await capture('mid-weave-only');const weaveDiff=diff(shots['mid-physical'],shots['mid-weave-only']);check('weave diagnostic is distinct',weaveDiff.mae>1.0,weaveDiff);
 await page.evaluate(()=>{DENIM_R17.setView('seam');DENIM_R17.setParam('mode',2);});const seam=await capture('seam-stitch-only');check('stitch macro keeps visible amber topstitch',seam.amber>500,seam);
 await page.evaluate(()=>{DENIM_R17.setParam('mode',0);DENIM_R17.setView('thigh');DENIM_R17.setMotion(false);});await capture('thigh-rest');
 await page.evaluate(()=>DENIM_R17.setMotion(true));await page.waitForTimeout(450);await capture('thigh-motion');const motionDiff=diff(shots['thigh-rest'],shots['thigh-motion']);check('garment motion changes actual current geometry',motionDiff.mae>.08&&motionDiff.changedFraction>.002,motionDiff);await page.evaluate(()=>DENIM_R17.setMotion(false));
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);await page.evaluate(()=>{DENIM_R17.setView('full');DENIM_R17.renderNow()});await capture('mobile');check('mobile viewport fits',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 s=await audit();check('no page or WebGL runtime errors',errors.length===0&&s.errors.length===0,{errors,auditErrors:s.errors});
 writeFileSync(`evidence/${label}.json`,JSON.stringify({url,label,results,errors,audit:s,limits:['SwiftShader functional verification only','Garment-scale visual candidate, not industrial metrology certification','Thread diameter is a display/geometry proxy; physical diameter remains separate from subpixel coverage']},null,2));
}catch(e){writeFileSync(`evidence/${label}-failure.json`,JSON.stringify({url,label,results,errors,failure:String(e),audit:await audit().catch(()=>null)},null,2));await page.screenshot({path:`evidence/${label}-failure.png`,fullPage:true}).catch(()=>{});throw e}finally{await browser.close()}
