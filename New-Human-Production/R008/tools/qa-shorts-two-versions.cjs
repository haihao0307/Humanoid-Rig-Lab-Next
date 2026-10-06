'use strict';
// Independent read-only packaging and raw manufacturing audit. No physical step.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const artifact=path.join(root,'qa/shorts-two-versions-20261002/index.html');
const out=path.join(root,'qa/shorts-two-versions-independent-20261002');
const report=JSON.parse(fs.readFileSync(path.join(root,'qa/shorts-v2-style-manufacturing-20261002.json')));
function paperAudit(d,xyz=report.manufacturedPositions){
 const uv=d.uv,tri=d.triangles;
 let maximum=0,worst=null,area=0;const vertexMass=Array(553).fill(0);
 for(let k=0;k<tri.length;k+=3){
  const ids=tri.slice(k,k+3),u=ids.map(i=>uv.slice(i*2,i*2+2)),p=ids.map(i=>xyz.slice(i*3,i*3+3));
  const du=u[1][0]-u[0][0],dv=u[1][1]-u[0][1],eu=u[2][0]-u[0][0],ev=u[2][1]-u[0][1],det=du*ev-dv*eu;
  const a=Math.abs(det)/2;area+=a;for(const i of ids)vertexMass[i]+=a*.22/3;
  const A=p[1].map((v,j)=>(ev*(v-p[0][j])-dv*(p[2][j]-p[0][j]))/det),B=p[1].map((v,j)=>(du*(p[2][j]-p[0][j])-eu*(v-p[0][j]))/det);
  const aa=A.reduce((s,v)=>s+v*v,0),bb=B.reduce((s,v)=>s+v*v,0),ab=A.reduce((s,v,j)=>s+v*B[j],0),hi=(aa+bb+Math.hypot(aa-bb,2*ab))/2,lo=hi?Math.max(0,aa*bb-ab*ab)/hi:0;
  const strain=Math.max(Math.abs(Math.sqrt(hi)-1),Math.abs(Math.sqrt(lo)-1));
  if(!Number.isFinite(strain))throw Error('Nonfinite raw paper metric');if(strain>maximum){maximum=strain;worst={triangle:k/3,sourceIndices:ids};}
 }
 const parents=Array.from({length:553},(_,i)=>i),find=i=>parents[i]===i?i:parents[i]=find(parents[i]);
 let gap=0,pairs=0;for(const s of d.seams)for(const p of s.pairs){parents[find(p.b)]=find(p.a);gap=Math.max(gap,Math.hypot(...[0,1,2].map(k=>xyz[p.a*3+k]-xyz[p.b*3+k])));pairs++;}
 const massDiff=Math.max(...vertexMass.map((v,i)=>Math.abs(v-d.mass[i]))),g=d.pieces.find(p=>p.id==='G');
 const width=Math.max(...g.materialCoordinates.map(u=>u[0]))-Math.min(...g.materialCoordinates.map(u=>u[0]));
 const hashes=Object.fromEntries(Object.entries(report.sourceHashes).map(([f,expected])=>[f,{expected,actual:sha(fs.readFileSync(path.join(root,f))),matches:expected===sha(fs.readFileSync(path.join(root,f)))}]));
 const stages=report.stages.map(s=>({id:s.id,valid:s.valid,paperUnchanged:s.paperUnchanged,dofs:s.dofs,seams:s.after.seams,beforeStrain:s.before.mainStrain,softStrain:s.soft.mainStrain,afterStrain:s.after.mainStrain,softGapM:s.seamGapM,weldedGapM:s.after.seamGapM,tracePeak:Math.max(...s.trace.map(t=>t.mainStrain)),lastPass:s.trace.at(-1).pass,bodyContactEnabled:s.bodyContactEnabled,elasticActivated:s.elasticActivated,actualMotionSteps:s.actualMotionSteps}));
 const stageChecks=stages.length===4&&stages.every((s,i)=>s.valid&&s.paperUnchanged&&s.afterStrain<=.05&&s.softGapM<=.0001&&s.weldedGapM===0&&s.dofs===[537,527,491,451][i]&&s.seams===[2,6,11,19][i]&&!s.bodyContactEnabled&&!s.elasticActivated&&s.actualMotionSteps===0);
 return {scope:'raw final 1659 values against actual loaded B@2 paper; stage intermediate reports are not full coordinate snapshots',rawValues:xyz.length,maximumPrincipalStrain:maximum,worst,areaM2:area,massKg:vertexMass.reduce((s,v)=>s+v,0),maximumVertexMassDifferenceKg:massDiff,seams:d.seams.length,sourcePairs:pairs,actualSourceQuotient:new Set(parents.map((_,i)=>find(i))).size,maximumSourcePairGapM:gap,gussetWidthM:width,expectedGussetWidthM:.060*d.receipt.gusset.actualStatureScale,stageChecks,stages,hashes,valid:xyz.length===1659&&maximum<=.05&&gap===0&&massDiff<=1e-12&&d.seams.length===19&&new Set(parents.map((_,i)=>find(i))).size===451&&Math.abs(width-.060*d.receipt.gusset.actualStatureScale)<1e-12&&stageChecks&&Object.values(hashes).every(h=>h.matches)};
}
module.exports={paperAudit};
if(require.main===module)(async()=>{
 fs.mkdirSync(out,{recursive:true});const html=fs.readFileSync(artifact,'utf8'),manifest=JSON.parse(fs.readFileSync(path.join(path.dirname(artifact),'BUILD.json')));
 const start=html.indexOf('const versions=')+'const versions='.length,end=html.indexOf(';\nfunction selectVersion',start),versions=JSON.parse(html.slice(start,end));
 const receipt={createdAt:new Date().toISOString(),scope:'packaging, two-version switching and saved manufacturing stage only; no body fit or physics acceptance',artifact,htmlSHA256:sha(Buffer.from(html)),matchesBuild:sha(Buffer.from(html))===manifest.htmlSHA256,versions:versions.map(({htmlBase64,...v})=>({...v,actualHTMLSHA256:sha(Buffer.from(htmlBase64,'base64')),matchesDeclaredHash:sha(Buffer.from(htmlBase64,'base64'))===v.htmlSHA256})),errors:[],httpRequests:[],physicalStepsExecuted:0,valid:false};
 const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>receipt.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')receipt.errors.push(m.text());});page.on('request',r=>{if(/^https?:/.test(r.url()))receipt.httpRequests.push(r.url());});page.on('requestfailed',r=>receipt.errors.push(r.url()+':'+r.failure()?.errorText));
  await page.goto(require('url').pathToFileURL(artifact).href,{waitUntil:'domcontentloaded'});
  let frame=page.frames().find(f=>f!==page.mainFrame());await frame.waitForFunction(()=>window.ShortStaticTest?.ready,null,{timeout:120000});
  receipt.original=await frame.evaluate(()=>({version:ShortStaticTest.version,report:ShortStaticTest.report(),canvas:!!document.querySelector('canvas')}));await page.screenshot({path:path.join(out,'original-loaded.png')});
  await Promise.all([page.waitForEvent('framenavigated',{predicate:f=>f===frame,timeout:120000}),page.evaluate(()=>ShortVersion.select('lowrise'))]);await frame.waitForFunction(()=>window.HumanShorts?.cloth||window.failure,null,{timeout:120000});
  frame=page.frames().find(f=>f!==page.mainFrame());const d=await frame.evaluate(()=>{if(window.failure)throw Error(window.failure);const h=HumanShorts,d=h.draft,c=h.cloth;return {version:h.version,versionId:h.versionId,recipe:d.version,receipt:d.receipt,uv:Array.from(d.sourceUV),triangles:Array.from(d.triangles),mass:Array.from(d.masses),seams:d.seams,pieces:d.pieces,step:c.steps,time:c.time,isMesh:c.mesh.isMesh,meshVertices:c.mesh.geometry.attributes.position.count,meshTriangles:c.mesh.geometry.index.count/3,moduleCount:Object.keys(window.__R008_MODULE_URLS__).length,preserveOriginalSubjectClothing:h.preserveOriginalSubjectClothing,initialMainStrain:c.audit(false).mainStrain};});
  receipt.lowrise={version:d.version,versionId:d.versionId,recipe:d.recipe,gusset:d.receipt.gusset,step:d.step,time:d.time,isMesh:d.isMesh,meshVertices:d.meshVertices,meshTriangles:d.meshTriangles,moduleCount:d.moduleCount,preserveOriginalSubjectClothing:d.preserveOriginalSubjectClothing,initialMainStrain:d.initialMainStrain};receipt.manufacturing=paperAudit(d);await page.screenshot({path:path.join(out,'lowrise-loaded.png')});
  await Promise.all([page.waitForEvent('framenavigated',{predicate:f=>f===frame,timeout:120000}),page.evaluate(()=>ShortVersion.select('original'))]);await frame.waitForFunction(()=>window.ShortStaticTest?.ready,null,{timeout:120000});frame=page.frames().find(f=>f!==page.mainFrame());receipt.returnToOriginal=await frame.evaluate(()=>({version:ShortStaticTest.version,ready:ShortStaticTest.ready,staticOnly:ShortStaticTest.report().staticOnly}));
  receipt.valid=receipt.matchesBuild&&receipt.versions.every(v=>v.matchesDeclaredHash)&&receipt.errors.length===0&&receipt.httpRequests.length===0&&receipt.original.canvas&&receipt.lowrise.isMesh&&d.step===0&&d.time===0&&d.recipe==='r008-low-rise-linen-casing-elastic-source-draft@2'&&d.preserveOriginalSubjectClothing===true&&receipt.returnToOriginal.staticOnly&&receipt.manufacturing.valid;
 }catch(e){receipt.errors.push(e.stack);}finally{await browser.close();receipt.bodyFitAccepted=false;receipt.motionAccepted=false;receipt.publicPromotionAllowed=false;fs.writeFileSync(path.join(out,'QA.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify({out,valid:receipt.valid,errors:receipt.errors,httpRequests:receipt.httpRequests,manufacturing:receipt.manufacturing?.valid,lowrise:receipt.lowrise,artifactSHA256:receipt.htmlSHA256},null,2));}
})().catch(e=>{console.error(e);process.exitCode=1;});
