const fs=require('node:fs'),path=require('node:path');const root=path.resolve(__dirname,'..');const read=p=>fs.readFileSync(path.join(root,p),'utf8');
function one(s,a,b){if(!s.includes(a)||s.indexOf(a)!==s.lastIndexOf(a))throw Error('Missing/nonunique '+a.slice(0,90));return s.replace(a,b);}
function edit(p,f){const s=read(p),n=f(s);if(n===s)throw Error('No repair install '+p);fs.writeFileSync(path.join(root,p),n);}
if(read('app.js').includes("VERSION='emily-transfer/7.2.0'")){console.log('ET072_ALREADY_INSTALLED');process.exit(0);}
if(!read('app.js').includes("VERSION='emily-transfer/7.1.0'"))throw Error('Require ET07.1 tested baseline');
edit('natural/NaturalEyes.js',s=>{
 s="import {loadScanRepair,disposeScanRepair} from './ScanRepair.js';\n"+s;
 s=one(s,'   this.requestRender();return this;});','   this.requestRender();return this;});\n  this.ready=this.ready.then(async()=>{await loadScanRepair(this);this.update(0,true);return this;});');
 s=s.replace('sameSkinAssets:true,extraTextures:0','sameSkinAssets:true,extraTextures:3,localCaptureMarkRepair:true');
 s=one(s,'a.version=\'ET07.1\';',"a.version='ET07.1';a.scanRepair=this.scanRepair?{ready:true,enabled:this.scanRepair.uniforms.uRepairEnabled.value===1,extraTextures:3,originalAssetsModified:false,atlasSize:this.scanRepair.meta.atlasSize}:null;");
 s=one(s,' dispose(){for(const e of this.eyes)',' dispose(){disposeScanRepair(this);for(const e of this.eyes)');
 return s.replaceAll('ET07.1','ET07.2');
});
for(const p of ['app.js','eyes/EyeSystem.js','talkinghead/IntegratedEyes.js','anatomy/bundle.cjs','natural/qa.cjs','natural/visual.cjs'])edit(p,s=>s.replaceAll('emily-transfer/7.1.0','emily-transfer/7.2.0').replaceAll('eyes/7.1.0','eyes/7.2.0').replaceAll('ET07.1','ET07.2'));
edit('app.js',s=>{
 s=one(s,'controls.minDistance=.10','controls.minDistance=.04');
 s=one(s,'const views={lidSide:',"const views={canthus:{p:[.009,.069,.12],t:[.0105,.068,.068]},lidSide:");
 s+=`\n// Temporary held comparison: identical pose, lights and geometry, repair atlas only.\nconst scanCompare=document.getElementById('scanRepairCompare');\nfunction setScanComparison(raw){if(!window.__NATURAL_REVIEW__?.scanRepair)return;window.__NATURAL_REVIEW__.scanRepair(!raw);scanCompare.classList.toggle('active',raw);dirty=true;}\nscanCompare.addEventListener('pointerdown',e=>{e.preventDefault();scanCompare.setPointerCapture?.(e.pointerId);setScanComparison(true);});\nfor(const name of ['pointerup','pointercancel','lostpointercapture','pointerleave'])scanCompare.addEventListener(name,()=>setScanComparison(false));\nscanCompare.addEventListener('keydown',e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();setScanComparison(true);}});scanCompare.addEventListener('keyup',()=>setScanComparison(false));window.addEventListener('blur',()=>setScanComparison(false));\n`;
 return s;
});
edit('index.html',s=>s.replaceAll('ET07.1','ET07.2').replace('<button data-camera="lidSide">','<button data-camera="canthus">眼角特写</button><button id="scanRepairCompare" title="保持姿态不变，对照未修复的原采集纹理">按住看采集纹理</button><button data-camera="lidSide">'));
edit('natural/qa.cjs',s=>{
 s=one(s,"assert.equal(v.version,'ET07.2');","assert.equal(v.version,'ET07.2');assert(v.scanRepair?.ready&&v.scanRepair.enabled&&v.scanRepair.extraTextures===3);assert.equal(v.scanRepair.originalAssetsModified,false);");
 s=one(s,"const source=await page.evaluate(()=>__EYES__.sourceGeometry());",`await page.locator('#scanRepairCompare').hover();await page.mouse.down();const rawCapture=await shot('09-original-capture-texture');await page.mouse.up();const repaired=await shot('10-repair-restored');
 report.checks.textureRepairToggle={rawDifference:diff(open,rawCapture),restoredDifference:diff(open,repaired),info:await page.evaluate(()=>__NATURAL_REVIEW__.repairInfo())};
 assert(report.checks.textureRepairToggle.rawDifference.meanRGB>.05,'Repair comparison must change actual skin pixels');assert(report.checks.textureRepairToggle.restoredDifference.meanRGB<.01,'Held repair comparison did not restore the same frame');
 const source=await page.evaluate(()=>__EYES__.sourceGeometry());`);
 return s;
});
edit('natural/visual.cjs',s=>{
 const start=s.indexOf(" await page.evaluate(()=>__NATURAL_REVIEW__.setVisibility({rim:false}));"),end=s.indexOf(" await page.selectOption('#layer','albedo');",start);if(start<0||end<0)throw Error('No temporary component-debug block');
 s=s.slice(0,start)+` await page.evaluate(()=>__NATURAL_REVIEW__.scanRepair(false));await shot('11-unrepaired-scan-texture');await page.evaluate(()=>__NATURAL_REVIEW__.scanRepair(true));
`+s.slice(end);
 s=one(s,"await shot('09-portrait');","await shot('09-portrait');await page.click('[data-camera=\"canthus\"]');await shot('12-canthus-macro');");return s;
});
edit('anatomy/bundle.cjs',s=>one(s,'sourceSkinTexturesChanged:false','sourceSkinTexturesChanged:false,derivedEyeRepairTextures:3,repairModuleSHA256:hash(read(\'natural/ScanRepair.js\')),repairDataSHA256:hash(read(\'natural/RepairData.js\')),repairSource:JSON.parse(read(\'natural/REPAIR_SOURCE.json\'))'));
console.log('ET072_CAPTURE_MARK_REPAIR_INSTALLED');
