import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  HumanCoreRuntime, PROCEDURAL_BODY_DNA_PRESETS_V5, ProceduralDeformRuntimeV5, V4Adapter, createBodyDNA,
  createProceduralDeformValidationPoseV5, createProceduralSimulationRigFrameV5,
} from '../../src/modules/human-core-v5/index.js';
import { SurfaceCarrierV2 } from '../../src/modules/human-core-v5/surface-v2/index.js';
import { createSmplSkinLayer } from '../../legacy/v8/src/smpl-skin.js';
import { TemplateCanonicalReferencePoseCalibratorV5 } from '../human-core-v5-template-reference-pose-retarget-pilot/template-canonical-reference-pose-calibrator-v5.js';

const QA_URL = './artifacts/qa/task15a-production-surface-v2';
const ASSET_URL = './assets/human/production-surface-v2/candidate-a/neutral-body-candidate-a.glb';
const RECEIPT_URL = './assets/human/production-surface-v2/candidate-a/ASSET_RECEIPT.json';
const SCENARIOS = Object.freeze({
  'reference-t': { poseId: 't-pose', label: 'Reference T' }, 'reference-a': { poseId: 'a-pose', label: 'Reference A' },
  'shoulder-150': { poseId: 'arm-raise-150-left', label: 'Shoulder Raise fixture' }, 'elbow-140': { poseId: 'elbow-bend-140-left', label: 'Elbow Bend 140' },
  'hip-flex': { poseId: 'hip-flex-left', label: 'Hip Flex 55' }, 'knee-bend': { poseId: 'knee-bend-left', label: 'Knee Bend 110' },
});
const search = new URLSearchParams(location.search); const consoleErrors = []; const pageErrors = [];
const originalConsoleError = console.error.bind(console); console.error = (...values) => { consoleErrors.push(values.map(formatError).join(' ')); originalConsoleError(...values); };
addEventListener('error', (event) => pageErrors.push(formatError(event.error ?? event.message)));
addEventListener('unhandledrejection', (event) => pageErrors.push(formatError(event.reason)));
publish({ ready:false, scenario:null, assetReceipt:null, sharedFinalPoseId:null, proceduralMetrics:null, legacyMetrics:null, candidateMetrics:null, assetRestoreGate:null, referencePoseGate:null, fullBasisGate:null, jointMapping:null, unsupportedCapabilities:null, consoleErrors, pageErrors, glbRequests:[], geometryPresent:null, runtimeMetrics:null });

const metrics = await fetch(`${QA_URL}/metrics.json`).then(readJson);
if (search.get('contact') === '1') await buildContactSheet(); else await buildComparison();

async function buildComparison() {
  const scenarioId = search.get('scenario') ?? 'reference-t'; const spec = SCENARIOS[scenarioId]; if (!spec) throw new Error(`Unknown Task 15A scenario ${scenarioId}.`);
  applyFocus(search.get('focus'));
  const record = metrics.scenarios.find((entry) => entry.scenarioId === scenarioId); if (!record) throw new Error(`Missing metrics for ${scenarioId}.`);
  const bodyDNA = createBodyDNA({ ...structuredClone(PROCEDURAL_BODY_DNA_PRESETS_V5.Reference), bodyDNAId:'task15a-production-surface-v2-reference', identity:{humanId:'task15a-production-surface-v2-reference',label:'Task 15A shared reference'}, proportionRevision:15 });
  const human = new HumanCoreRuntime(); human.createHuman(bodyDNA); const rigCore = human.getRigCore();
  const finalPose = createProceduralDeformValidationPoseV5({ poseId:spec.poseId, rigCore, bodyDNA, timestamp:1 });
  const referencePose = createProceduralDeformValidationPoseV5({ poseId:'t-pose', rigCore, bodyDNA, timestamp:0 });
  human.updatePose(finalPose);
  const sourceFrame = createProceduralSimulationRigFrameV5({ finalPose, rigCore, bodyDNA });
  const referenceFrame = createProceduralSimulationRigFrameV5({ finalPose:referencePose, rigCore, bodyDNA });
  const adapted = V4Adapter.humanRigCoreToExistingRig(rigCore, { bodyDNA, pose:'T' });
  const proceduralView = createView(document.querySelector('#procedural-viewport'), 0xc8aa92);
  const legacyView = createView(document.querySelector('#legacy-viewport'), 0xaedbc6);
  const candidateView = createView(document.querySelector('#candidate-viewport'), 0xb9876e);
  const procedural = new ProceduralDeformRuntimeV5(); procedural.compileHuman({ bodyDNA, rigCore }); await procedural.generateCanonicalSurface({ resolution:48, worker:false, projectionMode:'legacy' });
  const proceduralFrame = procedural.update({ finalPose, anatomyState:human.getAnatomyState(), timestamp:1 });
  const proceduralGeometry = geometryFromPositions(proceduralFrame.deformedPositions, proceduralFrame.indices, proceduralFrame.deformedNormals);
  proceduralView.scene.add(new THREE.Mesh(proceduralGeometry, proceduralView.material));
  const legacy = await createSmplSkinLayer(THREE, legacyView.scene, adapted.definition, { legacyDiagnosticRuntimeWeights:false }); if (legacy.detailPromise) await legacy.detailPromise;
  const legacyRetarget = new TemplateCanonicalReferencePoseCalibratorV5({ THREE, templateLayer:legacy, rigCore, sourceReferenceFrame:referenceFrame }); legacyRetarget.apply(finalPose); legacy.mesh.material = legacyView.material;
  const candidate = new SurfaceCarrierV2({ THREE, GLTFLoader, scene:candidateView.scene, rigCore, sourceReferenceFrame:referenceFrame });
  await candidate.load({ url:ASSET_URL, receiptUrl:RECEIPT_URL }); candidate.applyFinalPose(finalPose); candidate.getMesh().material = candidateView.material;
  if (search.get('rig') === '1') candidateView.scene.add(createRigOverlay(sourceFrame));
  configureCloseup([proceduralView,legacyView,candidateView], search.get('closeup'), scenarioId);
  for (const view of [proceduralView,legacyView,candidateView]) render(view); await nextFrames(3); for (const view of [proceduralView,legacyView,candidateView]) render(view);
  document.querySelector('#scenario-title').textContent = `${spec.label}${search.get('rig') === '1' ? ' · Rig Overlay' : ''}${search.get('closeup') ? ` · ${search.get('closeup')}` : ''}`;
  document.querySelector('#authority-summary').textContent = 'Same BodyDNA · same HumanRigCore · same finalPose · same root · same camera/light/material policy';
  document.querySelector('#procedural-caption').textContent = `${spec.label} · Procedural R48 truth`;
  document.querySelector('#legacy-caption').textContent = `${spec.label} · frozen Pilot D baseline`;
  document.querySelector('#candidate-caption').textContent = `${spec.label} · official MakeHuman CC0 Candidate A`;
  populateMetrics(record);
  const glbRequests = performance.getEntriesByType('resource').filter((entry) => /neutral-body-candidate-a\.glb(?:$|[?#])/i.test(entry.name)).map((entry) => entry.name);
  const state = { ready:true, scenario:scenarioId, assetReceipt:candidate.getAssetReceipt(), sharedFinalPoseId:record.sharedFinalPoseId, proceduralMetrics:record.sourceMetrics, legacyMetrics:record.legacyMetrics, candidateMetrics:record.candidateMetrics, assetRestoreGate:metrics.assetRestoreGate, referencePoseGate:metrics.referencePoseGate, fullBasisGate:metrics.fullBasisGate, jointMapping:Object.fromEntries([...candidate.getJointMap()].map(([id,bone]) => [id,bone.name])), unsupportedCapabilities:candidate.performanceRig.getUnsupportedCapabilities(), consoleErrors:[...consoleErrors], pageErrors:[...pageErrors], glbRequests, geometryPresent:{procedural:proceduralGeometry.getAttribute('position').count>0,legacy:legacy.mesh.geometry.getAttribute('position').count>0,candidate:candidate.getMesh().geometry.getAttribute('position').count>0}, runtimeMetrics:candidate.getRuntimeMetrics() };
  document.querySelector('#loading').classList.add('hidden'); document.body.dataset.candidateReady='true'; publish(state);
}

function populateMetrics(record) {
  const a=record.measuredAngles; const rows=[['Shoulder°',...a.shoulderElevationDeg],['Elbow°',...a.elbowFlexionDeg],['Hip°',...a.hipFlexionDeg],['Knee°',...a.kneeFlexionDeg],['Joint max m',0,record.legacyMetrics.maximumMappedJointWorldError,record.candidateMetrics.maximumMappedJointWorldError],['Joint mean m',0,record.legacyMetrics.meanMappedJointWorldError,record.candidateMetrics.meanMappedJointWorldError],['Wrist m',0,record.legacyMetrics.wristEndpointError.maximum,record.candidateMetrics.wristEndpointError.maximum],['Ankle m',0,record.legacyMetrics.ankleEndpointError.maximum,record.candidateMetrics.ankleEndpointError.maximum],['Introduced',0,record.legacyMetrics.introducedPairCount,record.candidateMetrics.poseIntroducedPairCount]];
  document.querySelector('#metrics-table').innerHTML=`<div class="panel"><div class="metric-grid"><div class="label">Metric</div><div>Procedural</div><div>Legacy</div><div>Candidate A</div>${rows.map(([label,...values])=>`<div class="label">${label}</div>${values.map((value)=>`<div>${metric(value)}</div>`).join('')}`).join('')}</div></div>`;
  document.querySelector('#audit-checklist').innerHTML=`<div class="panel"><b>Asset Restore</b> <span class="${metrics.assetRestoreGate.passed?'pass':'fail'}">${metrics.assetRestoreGate.passed?'PASS':'FAIL'}</span><br><b>Reference Pose</b> <span class="${metrics.referencePoseGate.passed?'pass':'fail'}">${metrics.referencePoseGate.passed?'PASS':'FAIL'}</span><br><b>Full Basis</b> <span class="${metrics.fullBasisGate.passed?'pass':'fail'}">${metrics.fullBasisGate.passed?'PASS':'FAIL'}</span><br><b>Conclusion</b> ${metrics.finalConclusion}<br><b>productionApproved</b> false</div>`;
}

async function buildContactSheet() {
  document.querySelector('#comparison-page').classList.add('hidden'); const sheet=document.querySelector('#contact-sheet'); sheet.classList.remove('hidden');
  const rows=metrics.scenarios.map((record)=>`${imageCell('procedural',record.scenarioId)}${imageCell('legacy-pilot-d',record.scenarioId)}${imageCell('candidate-a',record.scenarioId)}<div class="contact-cell contact-summary"><b>${record.scenarioId}</b><br>Angles P/L/A: ${record.measuredAngles.shoulderElevationDeg.map(metric).join('/')} shoulder<br>${record.measuredAngles.elbowFlexionDeg.map(metric).join('/')} elbow<br>Joint max/mean: ${metric(record.candidateMetrics.maximumMappedJointWorldError)}/${metric(record.candidateMetrics.meanMappedJointWorldError)} m<br>Endpoints W/A: ${metric(record.candidateMetrics.wristEndpointError.maximum)}/${metric(record.candidateMetrics.ankleEndpointError.maximum)} m<br>Introduced: ${record.candidateMetrics.poseIntroducedPairCount}<br>${metrics.finalConclusion}</div>`).join('');
  sheet.innerHTML=`<h1 class="contact-heading">Task 15A Production Surface V2 · Candidate A</h1><p class="contact-subtitle">Procedural R48 vs frozen Legacy Pilot D vs official MakeHuman CC0 Candidate A</p><div class="contact-grid"><div class="contact-title">Procedural R48</div><div class="contact-title">Legacy Pilot D</div><div class="contact-title">Candidate A</div><div class="contact-title">Metrics / penetration / judgment</div>${rows}</div>`;
  await Promise.all([...sheet.querySelectorAll('img')].map((image)=>image.decode())); document.querySelector('#loading').classList.add('hidden'); document.body.dataset.candidateReady='true'; publish({ready:true,scenario:'contact-sheet',assetReceipt:metrics.assetReceipt,sharedFinalPoseId:null,proceduralMetrics:null,legacyMetrics:null,candidateMetrics:null,assetRestoreGate:metrics.assetRestoreGate,referencePoseGate:metrics.referencePoseGate,fullBasisGate:metrics.fullBasisGate,jointMapping:null,unsupportedCapabilities:metrics.unsupportedCapabilities,consoleErrors:[...consoleErrors],pageErrors:[...pageErrors],glbRequests:[],geometryPresent:{procedural:true,legacy:true,candidate:true},runtimeMetrics:metrics.runtimeMetrics});
}

function createView(host,color){const canvas=document.createElement('canvas');const context=canvas.getContext('webgl2',{antialias:true,preserveDrawingBuffer:true});if(!context)throw new Error('Task 15A requires WebGL2.');const renderer=new THREE.WebGLRenderer({canvas,context,antialias:true});renderer.setPixelRatio(1);renderer.setSize(586,704,false);renderer.outputColorSpace=THREE.SRGBColorSpace;host.append(canvas);const scene=new THREE.Scene();scene.background=new THREE.Color(0x060b12);scene.add(new THREE.HemisphereLight(0xdbeeff,0x2b1b14,2.2));const key=new THREE.DirectionalLight(0xffead7,3.1);key.position.set(2.8,4.2,3.6);scene.add(key);const rim=new THREE.DirectionalLight(0x6abaff,1.3);rim.position.set(-3,2.5,-3);scene.add(rim);const ground=new THREE.GridHelper(5,30,0x244b68,0x102638);ground.position.y=-.015;scene.add(ground);const camera=new THREE.OrthographicCamera(-.84,.84,1.02,-1.02,.01,20);camera.position.set(0,.92,3.2);camera.lookAt(0,.92,0);const material=new THREE.MeshStandardMaterial({color,roughness:.68,metalness:.01,side:THREE.FrontSide});return{renderer,scene,camera,material};}
function configureCloseup(views,closeup,scenario){if(!closeup)return;const configs={shoulder:{target:[-.25,1.42,0],half:.38},'shoulder-back':{target:[-.25,1.42,0],half:.38,back:true},axilla:{target:[-.30,1.30,0],half:.30},'elbow-outer':{target:[-.55,1.18,0],half:.30},'elbow-inner':{target:[-.55,1.18,0],half:.30,back:true},'hip-front':{target:[-.10,.91,0],half:.34},'hip-side':{target:[-.10,.91,0],half:.34,side:true},'knee-front':{target:[-.14,.49,0],half:.30},'knee-back':{target:[-.14,.49,0],half:.30,back:true}};const config=configs[closeup];if(!config)return;document.body.classList.add('closeup-page');for(const view of views){const aspect=586/704;view.camera.left=-config.half*aspect;view.camera.right=config.half*aspect;view.camera.top=config.half;view.camera.bottom=-config.half;view.camera.position.set(config.side?2.5:0,config.target[1],config.back?-2.5:2.5);view.camera.lookAt(...config.target);view.camera.updateProjectionMatrix();}}
function applyFocus(focus){if(!['procedural','legacy','candidate'].includes(focus))return;document.querySelector('#comparison-page').classList.add('focus-page');for(const card of document.querySelectorAll('.surface-card'))if(card.id!==`${focus}-card`)card.classList.add('hidden');}
function createRigOverlay(frame){const positions=[];for(const segment of frame.segments){const a=frame.joints[segment.parentId]?.worldPosition,b=frame.joints[segment.jointId]?.worldPosition;if(a&&b)positions.push(...a,...b);}const group=new THREE.Group();const lines=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3)),new THREE.LineBasicMaterial({color:0x31d7ff,depthTest:false}));lines.renderOrder=20;group.add(lines);return group;}
function geometryFromPositions(positions,indices,normals){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(positions),3));geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices),1));if(normals)geometry.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(normals),3));else geometry.computeVertexNormals();return geometry;}
function imageCell(dir,id){return`<div class="contact-cell"><img src="${QA_URL}/${dir}/${id}.png" alt="${dir} ${id}"></div>`;}
function render(view){view.renderer.render(view.scene,view.camera);}function nextFrames(count){return new Promise((resolve)=>{const step=()=>count--<=0?resolve():requestAnimationFrame(step);requestAnimationFrame(step);});}
function publish(value){const snapshot=structuredClone(value);window.__PRODUCTION_SURFACE_V2_CANDIDATE_A__=Object.freeze({...snapshot,getState:()=>structuredClone(snapshot),waitForIdle:async()=>structuredClone(snapshot)});document.querySelector('#candidate-state').textContent=JSON.stringify(snapshot);}
async function readJson(response){if(!response.ok)throw new Error(`Task 15A evidence unavailable: HTTP ${response.status}`);return response.json();}function metric(value){return Number.isFinite(value)?Number(value).toFixed(3):'n/a';}function formatError(value){return value instanceof Error?`${value.name}: ${value.message}`:String(value);}
