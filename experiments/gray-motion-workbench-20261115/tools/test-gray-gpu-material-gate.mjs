// Compare the gray-only material gate with the same WebGL2 source pipeline.
import fs from 'node:fs';
import {createRequire} from 'node:module';
const {chromium}=createRequire('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const work='G:/Three.js/Human/Human-Motion-Continuity-R07-20261106/',endpoint=JSON.parse(fs.readFileSync(work+'.runtime/gray-gpu-research-playwright.json')),browser=await chromium.connectOverCDP(endpoint.cdp),context=await browser.newContext({viewport:{width:1280,height:850}}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
let out;
try{
 await page.goto('http://127.0.0.1:19066/',{waitUntil:'domcontentloaded',timeout:240000});
 await page.waitForFunction(()=>{const r=window.grayResearchPreview?.report();return r?.ready&&r.frame!==null&&!r.busy},null,{timeout:300000});
 const src=fs.readFileSync(work+'research/gray-only-material-propagation-gate.mjs','utf8');
 await page.evaluate(async src=>{const mod=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(src));const v=document.querySelector('#legacy').contentWindow.__IDENTITY_QA__.viewer();window.__materialGate=mod.installGrayOnlyMaterialPropagationGate(v);},src);
 const rows=[];
 for(const [id,frame]of [['cmu_02_03',6],['m2m_attack_ground_pound',32],['ual1_crouch_fwd_loop',32],['m2m_walk_female',20],['m2m_run_female',12],['ual1_sitting_enter',19],['ual1_sitting_exit',15],['m2m_pistol_prone',37]]){
  await page.evaluate(async({id,frame})=>{await grayResearchPreview.selectAction(id);await grayResearchPreview.seek(frame);},{id,frame});
  const row=await page.evaluate(({id,frame})=>{
   const v=document.querySelector('#legacy').contentWindow.__IDENTITY_QA__.viewer(),fold=[...v.foldSurfaces.values()][0],cache=fold.cacheEnabled;fold.cacheEnabled=false;
   try{
    __materialGate.setEnabled(false);let t=performance.now();v.update();const baselineMS=performance.now()-t,p=Float32Array.from(v.geometry.attributes.position.array),n=Float32Array.from(v.geometry.attributes.normal.array);
    __materialGate.setEnabled(true);t=performance.now();v.update();const gatedMS=performance.now()-t,a=v.geometry.attributes.position.array,b=v.geometry.attributes.normal.array;let positionDifferences=0,normalDifferences=0;
    for(let i=0;i<p.length;i++){if(a[i]!==p[i])positionDifferences++;if(b[i]!==n[i])normalDifferences++;}
    __materialGate.setEnabled(false);v.update();let restoredPositionDifferences=0,restoredNormalDifferences=0;for(let i=0;i<p.length;i++){if(v.geometry.attributes.position.array[i]!==p[i])restoredPositionDifferences++;if(v.geometry.attributes.normal.array[i]!==n[i])restoredNormalDifferences++;}
    return{id,frame,baselineMS,gatedMS,positionDifferences,normalDifferences,restoredPositionDifferences,restoredNormalDifferences};
   }finally{fold.cacheEnabled=cache;}
  },{id,frame});rows.push(row);console.log(JSON.stringify(row));
 }
 out={schema:'gray-gpu-material-gate-source-check/1',scope:'identical pose and same WebGL2 refinement, gray positions and normals only; skin and lash output are not tested or supported',rows,errors,releaseReady:false};
}catch(e){out={error:String(e),errors,releaseReady:false};console.error(e.stack);}finally{fs.writeFileSync(work+'review/gray-gpu-material-gate-source-check-20261115.json',JSON.stringify(out,null,2)+'\n');await context.close();await browser.close();}
if(out.error||errors.length||out.rows.some(r=>r.positionDifferences||r.normalDifferences||r.restoredPositionDifferences||r.restoredNormalDifferences))process.exitCode=2;
