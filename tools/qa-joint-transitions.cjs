'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{pathToFileURL}=require('url');
const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const B=JSON.parse(fs.readFileSync(process.env.BODY_BUILD_MANIFEST||'BUILD.json'));
const shaderSource=fs.readFileSync(B.sources.find(s=>/BodyRay/.test(s.file)).file,'utf8'),wristShift=Number(shaderSource.match(/float shift=i<2\?([\d.]+):0\./)?.[1]||0);
const out=process.env.BODY_JOINT_OUT||'qa/joint-transitions',H=b=>crypto.createHash('sha256').update(b).digest('hex');
fs.mkdirSync(out,{recursive:true});let browser;
const report={startedUTC:new Date().toISOString(),artifact:B.file,sha256:B.sha256,checks:[],cases:[],shots:[],errors:[],visualAccepted:false};
const save=()=>fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));
function measure(){
 const f=window.__QA_BODY_FIELD__,scalar=bodyImplicitR02.renderer.scalarFieldAt;
 const dot=(a,b)=>a.reduce((s,x,k)=>s+x*b[k],0),unit=a=>{const n=Math.hypot(...a)||1;return a.map(x=>x/n)},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)},depth=(p,b)=>Math.min(...p.flatMap((x,k)=>[x-b[k][0],b[k][1]-x]));
 function weight(p,i,shift=0){const d=depth(p,f.locals[i].bounds);if(d<=0)return 0;let w=smooth(d/.008);if(f.refinement){const r=f.refinement,t=Math.max(0,Math.min(1,(dot(p.map((x,k)=>x-r.origins[i][k]),r.axes[i])-r.ranges[i][0]-shift)/(r.ranges[i][1]-r.ranges[i][0])));w*=t*t*t*(t*(t*6-15)+10);}return w;}
 function direction(p){const g=f.dimensions,q=p.map((x,k)=>(x-f.bounds[k][0])/(f.bounds[k][1]-f.bounds[k][0])*g[k]-.5),lo=q.map(Math.floor),a=q.map((x,k)=>x-lo[k]),n=[0,0,0];for(let z=0;z<2;z++)for(let y=0;y<2;y++)for(let x=0;x<2;x++){const ids=[x,y,z].map((v,k)=>Math.max(0,Math.min(g[k]-1,lo[k]+v))),w=(x?a[0]:1-a[0])*(y?a[1]:1-a[1])*(z?a[2]:1-a[2]),at=(ids[0]+g[0]*(ids[1]+g[1]*ids[2]))*4;for(let k=0;k<3;k++)n[k]+=f.normalField[at+k]*w;}return n;}
 function normal(p){const localDepth=Math.max(...f.locals.map(r=>depth(p,r.bounds))),refine=f.refinement?Math.max(...f.locals.map((_,i)=>weight(p,i))):(localDepth>.008?1:0),e=f.refinement?.014*(1-refine)+.0012*refine:(localDepth>.008?.0012:.014),g=unit([0,1,2].map(k=>{const a=p.slice(),b=p.slice();a[k]+=e;b[k]-=e;return scalar(a)-scalar(b)}));if(!f.refinement&&refine===1)return g;const target=direction(p);if(dot(target,target)<.1)return g;const n=unit(target),normalRefine=f.refinement&&window.__QA_NORMAL_WRIST_SHIFT__?Math.max(...f.locals.map((_,i)=>weight(p,i,i<2?window.__QA_NORMAL_WRIST_SHIFT__:0))):refine,amount=.85*(1-normalRefine);return unit(g.map((x,k)=>x*(1-amount)+n[k]*amount));}
 const percentile=a=>{a.sort((x,y)=>x-y);return{count:a.length,mean:a.reduce((s,x)=>s+x,0)/(a.length||1),p95:a[Math.floor(a.length*.95)]??null,max:a.at(-1)??null}},names=['left wrist','right wrist','left ankle','right ankle'],origins=[f.joints[6],f.joints[7],f.joints[4],f.joints[5]],groups=[];
 for(let group=0;group<4;group++){
  const steps=[],projection=[],orientation=[];let candidates=0,unresolved=0;
  for(let i=0;i<f.samples.length/3;i++){
   const p=Array.from(f.samples.subarray(i*3,i*3+3));if(Math.hypot(...p.map((x,k)=>x-origins[group][k]))>.065)continue;candidates++;
   let q=p.slice();for(let it=0;it<5;it++){const d=scalar(q),e=.0015,g=[0,1,2].map(k=>{const a=q.slice(),b=q.slice();a[k]+=e;b[k]-=e;return(scalar(a)-scalar(b))/(2*e)}),gg=dot(g,g);if(gg<1e-8)break;const amount=Math.max(-.025,Math.min(.025,d/gg));q=q.map((x,k)=>x-amount*g[k]);}
   if(Math.abs(scalar(q))>.001||Math.hypot(...q.map((x,k)=>x-p[k]))>.015){unresolved++;continue;}
   projection.push(Math.hypot(...q.map((x,k)=>x-p[k]))*1000);const n=normal(q),axis=Math.abs(n[1])<.8?[0,1,0]:[1,0,0],u=unit(cross(n,axis)),v=unit(cross(n,u));
   for(const tangent of[u,v]){const a=normal(q.map((x,k)=>x-tangent[k]*.00025)),b=normal(q.map((x,k)=>x+tangent[k]*.00025));steps.push(Math.acos(Math.max(-1,Math.min(1,dot(a,b))))*180/Math.PI);}
   const reference=unit(Array.from(f.normals.subarray(i*3,i*3+3)));orientation.push(Math.acos(Math.max(-1,Math.min(1,dot(n,reference))))*180/Math.PI);
  }
  groups.push({name:names[group],origin:origins[group],candidateSamples:candidates,unresolvedProjection:unresolved,normalChangeOverHalfMillimetreDegrees:percentile(steps),sampleProjectionMM:percentile(projection),referenceNormalDifferenceDegrees:percentile(orientation)});
 }
 return{groups,finite:groups.every(g=>g.normalChangeOverHalfMillimetreDegrees.count>0&&Number.isFinite(g.normalChangeOverHalfMillimetreDegrees.max)),measurement:'CPU mirror of actual interpolated scalar/direction fields and base shader normal; 0.5mm tangential finite difference at projected near-joint samples, before procedural skin perturbation. Not independent anatomical or global smoothness certification.'};
}
(async()=>{const limit=setTimeout(async()=>{report.failure='joint check timeout';save();await browser?.close();process.exit(2)},18*60000);
 try{
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader']});
  const p=await browser.newPage({viewport:{width:1470,height:1120}});p.setDefaultTimeout(600000);p.on('pageerror',e=>report.errors.push(e.stack));await p.route(/^https?:/,r=>r.abort());
  await p.addInitScript(shift=>window.__QA_NORMAL_WRIST_SHIFT__=shift,wristShift);report.shaderNormalWristShift=wristShift;await p.addInitScript(()=>{const Original=window.Worker;window.Worker=class extends Original{constructor(...args){super(...args);this.addEventListener('message',e=>{if(e.data.type==='field')window.__QA_BODY_FIELD__=e.data;});}};});
  await p.goto(pathToFileURL(B.file).href,{waitUntil:'domcontentloaded',timeout:600000});await p.waitForFunction(()=>window.__BODY_IMPLICIT_R02_READY__||window.__BODY_IMPLICIT_R02_ERROR__);if(await p.evaluate(()=>!!window.__BODY_IMPLICIT_R02_ERROR__))throw Error(await p.evaluate(()=>window.__BODY_IMPLICIT_R02_ERROR__));await p.evaluate(()=>window.jointBaseline=bodyImplicitR02.archive());
  const update=async fn=>{const before=await p.evaluate(()=>__BODY_IMPLICIT_R02_UPDATES__);await fn();await p.waitForFunction(n=>__BODY_IMPLICIT_R02_UPDATES__>n&&!bodyImplicitR02.report().busy,before);};
  const capture=async name=>{const metrics=await p.evaluate(measure);report.cases.push({name,metrics});for(const view of['full','half']){await p.evaluate(v=>{bodyImplicitR02.view('oblique');bodyImplicitR02.view(v)},view);const file=out+'/'+name+'-'+view+'.png';await p.screenshot({path:file,clip:await p.locator('.stage').boundingBox()});report.shots.push({file,sha256:H(fs.readFileSync(file))});}save();console.log('JOINT_CASE',name,JSON.stringify(metrics.groups.map(g=>({region:g.name,p95:g.normalChangeOverHalfMillimetreDegrees.p95,max:g.normalChangeOverHalfMillimetreDegrees.max,unresolved:g.unresolvedProjection}))));};
  await capture('neutral');
  await update(()=>p.evaluate(()=>bodyImplicitR02.set('anny.pose:wrist.L.Z',25)));await capture('wrist-bent');
  await update(()=>p.evaluate(()=>bodyImplicitR02.restore(jointBaseline)));await update(()=>p.evaluate(()=>bodyImplicitR02.set('anny.pose:foot.L.X',25)));await capture('ankle-bent');
  await update(()=>p.evaluate(()=>bodyImplicitR02.restore(jointBaseline)));await update(()=>p.evaluate(()=>bodyImplicitR02.set('anny.pose:root.Z',30)));await capture('body-turned');
  report.checks.push({name:'joint measurements finite for every region and pose',passed:report.cases.every(c=>c.metrics.finite)});
  report.checks.push({name:'artifact stable and no browser errors',passed:H(fs.readFileSync(B.file))===B.sha256&&report.errors.length===0});report.passed=report.checks.every(c=>c.passed);if(!report.passed)process.exitCode=1;
 }catch(e){report.failure=e.stack;console.error(e);process.exitCode=1;}finally{clearTimeout(limit);await browser?.close();report.browserClosed=true;save();}})();
