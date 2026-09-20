// Preserve the exact accepted R2.4 opening and failed R2.5 fit diagnostics.
// This is evidence-only: no threshold, source paper, mass, rig or fit state is changed.
import fs from 'node:fs';
const replaceOnce=(text,from,to,label)=>{
  if(text.includes(to))return text;
  const first=text.indexOf(from),last=text.lastIndexOf(from);
  if(first<0||first!==last)throw Error('Ambiguous R2.5 preflight anchor: '+label);
  return text.replace(from,to);
};
const sourcePath='clothing/ShortsGussetAssemblyR2.js';
let source=fs.readFileSync(sourcePath,'utf8');
source=replaceOnce(source,
"  if(!Number.isFinite(placementMaterialLimit)||placementMaterialLimit<=0||placementMaterialLimit>.05)fail('invalid gusset placement material limit');\n  if(!geometryAtPlacement.landmarkOrderValid||!geometryAtPlacement.boundarySelfIntersectionFree||geometryAtPlacement.minimumTriangleAreaM2<=1e-8||geometryAtPlacement.maximumBoundaryEdgeStrain>.05||geometryAtPlacement.maximumRadialStrain>placementRadialLimit||centreFit.maximumPrincipalStrain>placementMaterialLimit)",
"  if(!Number.isFinite(placementMaterialLimit)||placementMaterialLimit<=0||placementMaterialLimit>.05)fail('invalid gusset placement material limit');\n  state.preflight={stage:'R2.5 actual accepted-rise opening preflight',geometryAtPlacement,centreFit,junctionReports,gussetPositions:gussetPositions.map(point=>[...point]),boundaryCentroid:[...boundaryCentroid],anchor:[...anchor],placementRadialLimit,placementMaterialLimit,riseReportSummary:{valid:riseReport?.valid===true,stepIndex:simulation.stepIndex,material:riseReport?.materialAtCheckpoint??null}};\n  if(!geometryAtPlacement.landmarkOrderValid||!geometryAtPlacement.boundarySelfIntersectionFree||geometryAtPlacement.minimumTriangleAreaM2<=1e-8||geometryAtPlacement.maximumBoundaryEdgeStrain>.05||geometryAtPlacement.maximumRadialStrain>placementRadialLimit||centreFit.maximumPrincipalStrain>placementMaterialLimit)",
'preflight state');
fs.writeFileSync(sourcePath,source);
const reviewPath='tools/review-shorts-gusset-r25.mjs';
let review=fs.readFileSync(reviewPath,'utf8');
const oldCatch="}catch(error){if(report)fs.writeFileSync(path.join(output,'gusset-report.json'),JSON.stringify(report,null,2));await page.screenshot({path:path.join(output,'browser-failure.png')}).catch(()=>{});fs.writeFileSync(path.join(output,'failure.txt'),String(error.stack||error));throw error;}finally{await browser.close();}";
const newCatch="}catch(error){\n  if(report)fs.writeFileSync(path.join(output,'gusset-report.json'),JSON.stringify(report,null,2));\n  const debug=await page.evaluate(()=>{const skirt=window.HumanLab?.compact?.skirt;return {startupError:window.__startupError||null,assemblyState:skirt?.assemblyState??null,preflight:skirt?.gussetState?.preflight??null,riseReport:skirt?.gussetRiseReport??null,diagnostics:skirt?.diagnostics?.()??null,snapshot:skirt?.simulation?.snapshot?.()??null};}).catch(e=>({captureError:String(e.stack||e)}));\n  fs.writeFileSync(path.join(output,'preflight-debug.json'),JSON.stringify(debug,null,2));\n  if(debug.snapshot)fs.writeFileSync(path.join(output,'rise-input-snapshot.json'),JSON.stringify(debug.snapshot,null,2));\n  await page.screenshot({path:path.join(output,'browser-failure.png')}).catch(()=>{});fs.writeFileSync(path.join(output,'failure.txt'),String(error.stack||error));throw error;\n}finally{await browser.close();}";
review=replaceOnce(review,oldCatch,newCatch,'browser failure evidence');
fs.writeFileSync(reviewPath,review);
console.log('R2.5 browser failures now retain exact opening, fit and snapshot evidence.');
