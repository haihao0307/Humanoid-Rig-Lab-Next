'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const H = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hashFile = file => new Promise((resolve, reject) => {
  const hash = crypto.createHash('sha256'), input = fs.createReadStream(file);
  input.on('data', chunk => hash.update(chunk)); input.on('error', reject);
  input.on('end', () => resolve(hash.digest('hex')));
});
const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const assert = (ok, message) => { if (!ok) throw Error(message); };
(async () => {
  const B = read('BUILD.json'), version = path.basename(B.file).match(/R\d+/)[0], suffix = version.toLowerCase();
  const reports = {
    lifecycle: `qa/final-implicit-${suffix}/report.json`,
    normalViews: `qa/review-${suffix}/report.json`,
    materialCoordinates: `qa/material-coordinates-${suffix}/report.json`,
    numericParameters: 'qa/numeric-audit-final.json',
    structure: 'qa/program-structure-audit.json',
    materialRotation: `qa/rotation-material-coordinates-${suffix}/report.json`,
    jointTransitions: `qa/joints-${suffix}/report.json`,
    actualRayHits: `qa/ray-hits-${suffix}/report.json`
  };
  const R = Object.fromEntries(Object.entries(reports).map(([key, file]) => [key, read(file)]));
  assert(await hashFile(B.file) === B.sha256, 'Delivery hash changed');
  for (const source of B.sources) assert(await hashFile(source.file) === source.sha256, 'Source changed: ' + source.file);
  assert(await hashFile(B.data.file) === B.data.sha256, 'Numeric package changed');
  const prior=read('BUILD-R08.json'),coreUnchanged=B.sources.filter(s=>!/BodyImplicitWorker|BodyRay/.test(s.file)).every(s=>prior.sources.some(p=>p.file===s.file&&p.sha256===s.sha256));
  assert(coreUnchanged&&prior.data.sha256===B.data.sha256,'Prior full parameter comparisons no longer cover the active driver or input data');
  assert(R.lifecycle.functionalPassed && R.normalViews.passed && R.materialCoordinates.passed && R.structure.pass, 'Functional QA incomplete');
  for (const key of ['lifecycle','normalViews','materialCoordinates','materialRotation','jointTransitions']) {
    assert(R[key].sha256 === B.sha256, 'QA belongs to another artifact: ' + key);
    assert(R[key].browserClosed, 'QA browser not confirmed closed: ' + key);
    assert((R[key].errors || []).length === 0, 'Unresolved browser errors: ' + key);
    assert(R[key].checks.every(check => check.passed), 'Unpassed check: ' + key);
  }
  assert(R.actualRayHits.artifactSHA256===B.sha256&&R.actualRayHits.diagnosticCompleted&&R.actualRayHits.noDeepInteriorHits&&R.actualRayHits.browserClosed&&R.actualRayHits.errors.length===0,'Actual GPU intersection audit incomplete');
  assert(R.jointTransitions.shadingNormalMetricMatchesShader!==false,'Normal diagnostics use another shader rule');
  assert(R.lifecycle.caseFits?.every(c=>['global','local'].every(k=>c.pointConstraints[k].converged&&c.pointConstraints[k].positiveDefinite&&c.pointConstraints[k].coefficientClippingUsed===false)),'Some displayed fit cases did not converge');
  assert(R.numericParameters.finished && R.numericParameters.failures.length === 0 && R.numericParameters.completed === 2426, 'Parameter audit incomplete');
  const html = fs.readFileSync(B.file, 'utf8'), startToken = 'window.__BODY_WORKER_SOURCE__=', at = html.indexOf(startToken);
  assert(at >= 0, 'Embedded worker absent');
  const end = html.indexOf(';</script>', at), worker = JSON.parse(html.slice(at + startToken.length, end));
  const workerSources = B.sources.filter(s => !/BodyRay|BodyImplicitApp/.test(s.file));
  assert(workerSources.every(s => worker.includes(fs.readFileSync(s.file, 'utf8'))), 'Manifest worker not embedded in artifact');
  const original = path.resolve('../Human-Skin-Appendages-R01-20261018/delivery/人物_R15_眼部层次与湿润感.html');
  const originalHash = await hashFile(original);
  assert(originalHash === 'f63c538a548108f3f61657ddbec3c0c05fbb4f4456770ba7668c67b948247edd', 'Frozen original R15 changed');
  const evidence = [];
  for (const shot of [...R.normalViews.shots,...R.jointTransitions.shots]) {
    assert(await hashFile(shot.file) === shot.sha256, 'Screenshot changed: ' + shot.file);
    evidence.push({file:path.resolve(shot.file), sha256:shot.sha256, camera:shot.camera});
  }
  const fit = R.lifecycle.surfaceFit.newtonProjection;
  const now = new Date().toISOString();
  const delivery = {
    schema:'body-function-delivery/1', reviewedUTC:now, selectedVersion:version,
    artifact:B.file, sha256:B.sha256, bytes:B.bytes,
    scope:'BODY ONLY', representation:'implicit function + variables + procedural noise',
    characterTriangleFaces:0, characterElementBuffers:0, rasterPrimitive:'POINTS',
    runtimeSourceManifestMatches:true, embeddedWorkerMatches:true,
    originalR15:{file:original, sha256:originalHash, unchanged:true},
    controls:{originalCatalog:1916, bodyUI:965, bodyDriverInputsCompared:1213, individualComparisons:2426,
      parameterFailures:0, maxComparedComponentMM:R.numericParameters.maxMM, priorDriverAndInputDataUnchanged:coreUnchanged, parameterComparisonScope:'sampled body driver; not all final implicit surfaces', allCombinationsCertified:false},
    independentSurfaceProjection:{points:6000, ...fit, strictClosestPoint:false, fullHausdorff:false},
    materialCoordinates:R.materialCoordinates.translation,
    materialRotation:R.materialRotation.rotation,
    fitConstraints:R.lifecycle.baseline.report.field.stats.pointConstraints,
    fittedCases:R.lifecycle.caseFits,
    actualGpuRayIntersections:R.actualRayHits.cases,
    jointTransitions:R.jointTransitions.cases,
    checks:Object.fromEntries(['lifecycle','normalViews','materialCoordinates','materialRotation','jointTransitions'].map(k=>[k,R[k].checks.length])),
    reports:Object.fromEntries(Object.entries(reports).map(([k,v])=>[k,path.resolve(v)])),
    evidence, browsersClosed:true, headGenerated:false, headStateRetained:true,
    sourceDerivedCalibration:true, wholeBodySourceIndependent:false, visualAccepted:false,
    bodyReconstructionComplete:false, mainPlatformMigrated:false, publicRelease:false,
    nextPriority:['normal-distance body pigment roughness and oil layers under fixed light','residual wrist crease and shading defects','pose combinations and material coordinates under bending','shared neck boundary with separate head module','independent calibration data replacement'],
    limits:['Local fitting remains approximate','Original calibration, weights and correspondence data remain source-derived','Some original parameters are retained through archive/API rather than body-only UI','Head is intentionally absent from this body prototype']
  };
  fs.writeFileSync('DELIVERY.json', JSON.stringify(delivery, null, 2));
  fs.writeFileSync('TASK_ANCHOR.json', JSON.stringify({updatedUTC:now, scope:'BODY ONLY', currentBuild:'BUILD.json', delivery:'DELIVERY.json',
    route:'EXECUTION-ROUTE.md', status:'tested body prototype; visual work and independent data remain',
    hardStopUTC:process.env.BODY_HARD_STOP||'2026-10-23T08:21:00Z', headBoardUntouched:true, noCharacterTriangles:true}, null, 2));
  const page=require('./render-review.cjs')({B,version,suffix,fit,now,ray:R.actualRayHits});
  const reviewFile='delivery/身体重构_测试与自审.html';
  fs.writeFileSync(reviewFile,page);
  fs.writeFileSync('qa/final-integrity.json',JSON.stringify({checkedUTC:now,passed:true,artifactSHA256:B.sha256,
    sourceFilesVerified:B.sources.length,embeddedWorkerVerified:true,originalR15Unchanged:true,
    screenshotsVerified:evidence.length,reportHashes:Object.fromEntries(Object.entries(reports).map(([k,f])=>[k,H(fs.readFileSync(f))])),
    reviewFile:path.resolve(reviewFile),reviewSHA256:H(Buffer.from(page)),allSelectedQABrowsersClosed:true},null,2));
  console.log(JSON.stringify({selectedVersion:version,artifact:B.file,review:path.resolve(reviewFile),integrity:'passed',visualAccepted:false}));
})().catch(error=>{console.error(error);process.exitCode=1});
