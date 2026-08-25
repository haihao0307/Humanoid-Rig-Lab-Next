import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  HumanCoreRuntime, ProceduralDeformRuntimeV5, createBodyDNA, createRendererAdapterInputV5,
} from '../../src/modules/human-core-v5/index.js';
import { createPoseFrameV4 } from '../../src/modules/pose/pose-frame-v4.js';
import { ThreeProceduralHumanAdapterV5 } from '../../src/renderers/three/three-procedural-human-adapter-v5.js';

const container = document.querySelector('#viewport');
const loading = document.querySelector('#loading');
const forceWebGL = new URLSearchParams(location.search).get('forceWebGL') === '1';
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x01040a);
const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100);
camera.position.set(2.7, 1.45, 3.1);
const { renderer, backend } = await createRenderer();
container.append(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.95, 0); controls.enableDamping = true;
scene.add(new THREE.HemisphereLight(0xbad8ff, 0x24180e, 2.1));
const key = new THREE.DirectionalLight(0xffffff, 2.8); key.position.set(2, 4, 3); scene.add(key);
const rim = new THREE.DirectionalLight(0x61bfff, 1.2); rim.position.set(-3, 2, -3); scene.add(rim);
scene.add(new THREE.GridHelper(8, 40, 0x1f5d8a, 0x10243a));

const adapter = new ThreeProceduralHumanAdapterV5();
scene.add(adapter.getObject3D());
const skeletonGroup = new THREE.Group(); scene.add(skeletonGroup);
const primitiveGroup = new THREE.Group(); scene.add(primitiveGroup);
const coreRuntime = new HumanCoreRuntime();
const deformRuntime = new ProceduralDeformRuntimeV5();
let dna = null; let activePreset = 'Reference'; let activePose = 'A Pose'; let displayMode = 'Procedural Surface';
let manualDNA = {}; let rebuildChain = Promise.resolve(); let rebuildTimer = null;

const PRESETS = {
  Reference: {},
  Lean: { bodyType:{category:'ectomorph'}, mass:{weightKg:58}, fitnessProfile:{muscle:.35,fat:.16,distribution:{upperBody:.40,lowerBody:.42}}, proportion:{bodyThickness:{chest:.19,waist:.15,hip:.19}} },
  Muscular: { bodyType:{category:'mesomorph'}, mass:{weightKg:92}, fitnessProfile:{muscle:.88,fat:.16,distribution:{upperBody:.82,lowerBody:.75}}, proportion:{shoulderWidth:.49,bodyThickness:{chest:.31,waist:.22,hip:.27}} },
  Heavy: { bodyType:{category:'endomorph'}, mass:{weightKg:112}, fitnessProfile:{muscle:.42,fat:.84,distribution:{upperBody:.52,lowerBody:.62}}, proportion:{bodyThickness:{chest:.35,waist:.34,hip:.38},hipWidth:.25} },
  Tall: { proportion:{height:2.02,shoulderWidth:.46,hipWidth:.21,headToBodyRatio:8.1,limbLengths:{upperArm:.34,forearm:.30,handControl:.085,thigh:.52,lowerLeg:.49}} },
  Short: { proportion:{height:1.55,shoulderWidth:.36,hipWidth:.19,headToBodyRatio:6.8,limbLengths:{upperArm:.24,forearm:.21,handControl:.065,thigh:.36,lowerLeg:.34}} },
  Asymmetric: { asymmetry:{mode:'authored',leftRightScale:{shoulder:1.10,arm:1.08,hand:1.05,hip:1.06,leg:1.08,foot:1.04}} },
};
const POSES = ['A Pose','T Pose','Arm Raise 90','Arm Raise 150','Forearm Twist 180','Elbow Bend 140','Hip Flex','Knee Bend','Squat','Lunge'];
const DISPLAYS = ['Procedural Surface','Skeleton','Surface + Skeleton','Wireframe','Region Ownership','Field Primitives'];
const CAMERAS = ['Front','Left','Right','Back','Perspective','Fit','Reset'];

buildButtons('#preset-list', Object.keys(PRESETS), async (name) => { activePreset=name; manualDNA={}; await queueRebuild(); });
buildButtons('#pose-list', POSES, (name) => { activePose=name; updatePose(); });
buildButtons('#display-list', DISPLAYS, (name) => { displayMode=name; updateVisibility(); });
buildButtons('#camera-list', CAMERAS, setCamera);
buildDNAControls();
await queueRebuild();
resize(); requestAnimationFrame(render);
addEventListener('resize', resize);

async function rebuildHuman() {
  loading.classList.remove('hidden');
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const source = mergeDNAInput(PRESETS[activePreset], manualDNA);
  dna = createBodyDNA({
    bodyDNAId:`body-dna-${activePreset.toLowerCase()}`, identity:{humanId:'procedural-preview-human',label:activePreset}, proportionRevision:1,
    ...source,
  });
  coreRuntime.createHuman(dna);
  deformRuntime.compileHuman({ bodyDNA:dna, rigCore:coreRuntime.getRigCore() });
  await deformRuntime.generateCanonicalSurface({ resolution: 40, worker: true });
  buildPrimitivePreview();
  updatePose();
  syncDNAControls();
  loading.classList.add('hidden');
}

function queueRebuild(){rebuildChain=rebuildChain.then(rebuildHuman);return rebuildChain;}

function updatePose() {
  const pose = poseFixture(activePose);
  coreRuntime.updatePose(pose);
  const frame = deformRuntime.update({ finalPose:pose, anatomyState:coreRuntime.getAnatomyState(), deltaTime:1/60 });
  adapter.update(createRendererAdapterInputV5(frame));
  buildSkeletonPreview(frame);
  updateVisibility(); updateDiagnostics();
}

function poseFixture(name) {
  const rotations = {};
  const q = (axis, degrees) => axisAngle(axis, degrees*Math.PI/180);
  if (name==='A Pose') { rotations.leftUpperArm=q([0,0,1],35); rotations.rightUpperArm=q([0,0,-1],35); }
  if (name==='Arm Raise 150') rotations.leftUpperArm=q([0,0,-1],60);
  if (name==='Forearm Twist 180') rotations.leftLowerArm=q([1,0,0],180);
  if (name==='Elbow Bend 140') rotations.leftLowerArm=q([0,0,1],140);
  if (name==='Hip Flex') rotations.leftUpperLeg=q([-1,0,0],70);
  if (name==='Knee Bend') rotations.leftLowerLeg=q([1,0,0],110);
  if (name==='Squat') { rotations.leftUpperLeg=q([-1,0,0],65);rotations.rightUpperLeg=q([-1,0,0],65);rotations.leftLowerLeg=q([1,0,0],105);rotations.rightLowerLeg=q([1,0,0],105); }
  if (name==='Lunge') { rotations.leftUpperLeg=q([-1,0,0],55);rotations.leftLowerLeg=q([1,0,0],80);rotations.rightUpperLeg=q([1,0,0],24);rotations.rightLowerLeg=q([1,0,0],30); }
  return createPoseFrameV4({ compatibleRig:coreRuntime.getRigCore().sourceRig.compatibleRig, rootJointId:'hips',
    rootPosition:[0,deformRuntime.field.definition.canonicalLayout.pelvisCenterY,0], rootRotation:[0,0,0,1], localRotations:rotations,
    contacts:[],ikTargets:[],constraintState:{fixture:name,wholeBodySolverV5:false},proportionRevision:dna.proportionRevision,timestamp:performance.now() });
}

function updateVisibility(){adapter.getObject3D().visible=!['Skeleton','Field Primitives'].includes(displayMode);skeletonGroup.visible=['Skeleton','Surface + Skeleton'].includes(displayMode);primitiveGroup.visible=displayMode==='Field Primitives';adapter.setDisplayMode(displayMode==='Wireframe'?'wireframe':displayMode==='Region Ownership'?'region-ownership':'surface');}
function buildSkeletonPreview(frame){
  disposeGroupChildren(skeletonGroup);
  const anchors=Object.fromEntries(Object.entries(frame.regionDiagnostics).map(([name,value])=>[name,new THREE.Vector3(...value.posedAnchor)]));
  const pairs=[['pelvis','lowerTorso'],['lowerTorso','upperTorso'],['upperTorso','neck'],['neck','head'],['upperTorso','leftUpperArm'],['leftUpperArm','leftForearm'],['leftForearm','leftPalm'],['upperTorso','rightUpperArm'],['rightUpperArm','rightForearm'],['rightForearm','rightPalm'],['pelvis','leftThigh'],['leftThigh','leftCalf'],['leftCalf','leftFoot'],['pelvis','rightThigh'],['rightThigh','rightCalf'],['rightCalf','rightFoot']];
  const segments=pairs.flatMap(([from,to])=>anchors[from]&&anchors[to]?[anchors[from],anchors[to]]:[]);
  const lineGeometry=new THREE.BufferGeometry().setFromPoints(segments);
  skeletonGroup.add(new THREE.LineSegments(lineGeometry,new THREE.LineBasicMaterial({color:0x55d6ff})));
  const pointGeometry=new THREE.BufferGeometry().setFromPoints(Object.values(anchors));
  skeletonGroup.add(new THREE.Points(pointGeometry,new THREE.PointsMaterial({color:0xffd166,size:.025})));
}
function buildPrimitivePreview(){disposeGroupChildren(primitiveGroup);const regions=deformRuntime.field.definition.regions;const cuts=deformRuntime.field.definition.subtractions.map((entry)=>({side:entry.side,primitive:entry.primitive,subtraction:true}));for(const region of [...regions,...cuts]){const p=region.primitive;const center=p.center??p.start.map((v,i)=>(v+p.end[i])/2);const radii=p.radii??p.startRadii;const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),new THREE.MeshBasicMaterial({color:region.subtraction?0xff5f57:region.side==='left'?0x36bff5:region.side==='right'?0xf27ab8:0xf5c76b,wireframe:true,transparent:true,opacity:.45}));mesh.position.fromArray(center);mesh.scale.fromArray(radii);primitiveGroup.add(mesh);}}
function disposeGroupChildren(group){for(const child of [...group.children]){child.geometry?.dispose();if(Array.isArray(child.material))child.material.forEach((material)=>material.dispose());else child.material?.dispose();group.remove(child);}}
function updateDiagnostics(){const s=deformRuntime.getSurfaceMetadata(),d=deformRuntime.getDiagnostics(),a=adapter.getDiagnostics();const values={
  'BodyDNA fingerprint':s.bodyDNAFingerprint,'Rig topology fingerprint':s.rigTopologyFingerprint,'Field generator':s.generatorVersion,'Surface cache key':s.cacheKey,
  'Vertex count':s.vertexCount,'Triangle count':s.triangleCount,'Connected components':s.generationDiagnostics.connectedComponentCount,'Boundary edges':s.generationDiagnostics.boundaryEdgeCount,
  'Topology fingerprint':s.topologyFingerprint,'Pose authority':d.poseAuthority,'Deformation policy':d.deformationPolicy,'Worker generation':d.generatedByWorker,
  'Worker generation time':`${s.generationDiagnostics.generationTimeMs.toFixed(2)} ms`,'Per-frame deformation':`${(d.medianDeformationMs??0).toFixed(2)} ms`,'Renderer upload':`${a.rendererUploadTimeMs.toFixed(2)} ms`,
  'Backend':backend,'GLB dependency':'none','Visual acceptance':'blocked-on-user-browser-acceptance'};document.querySelector('#diagnostics').innerHTML=Object.entries(values).map(([k,v])=>`<dt>${k}</dt><dd>${v}</dd>`).join('');}
function buildDNAControls(){const definitions=[['Height','proportion.height',1.45,2.15,.01],['Shoulder width','proportion.shoulderWidth',.32,.56,.01],['Hip width','proportion.hipWidth',.16,.32,.01],['Chest thickness','proportion.bodyThickness.chest',.16,.42,.01],['Waist thickness','proportion.bodyThickness.waist',.12,.40,.01],['Hip thickness','proportion.bodyThickness.hip',.16,.44,.01],['Upper arm','proportion.limbLengths.upperArm',.22,.40,.005],['Forearm','proportion.limbLengths.forearm',.18,.35,.005],['Thigh','proportion.limbLengths.thigh',.34,.58,.005],['Lower leg','proportion.limbLengths.lowerLeg',.32,.56,.005],['Weight kg','mass.weightKg',45,130,1],['Muscle','fitnessProfile.muscle',0,1,.01],['Fat','fitnessProfile.fat',0,1,.01]];const root=document.querySelector('#dna-controls');root.innerHTML='<h2>BodyDNA 参数</h2>'+definitions.map(([label,path,min,max,step])=>`<label class="control">${label}<output data-output="${path}">-</output><input data-dna-path="${path}" type="range" min="${min}" max="${max}" step="${step}"></label>`).join('');for(const input of root.querySelectorAll('[data-dna-path]'))input.addEventListener('input',()=>{setNested(manualDNA,input.dataset.dnaPath,Number(input.value));root.querySelector(`[data-output="${input.dataset.dnaPath}"]`).textContent=Number(input.value).toFixed(input.step<1?3:0);clearTimeout(rebuildTimer);rebuildTimer=setTimeout(()=>queueRebuild(),140);});}
function syncDNAControls(){for(const input of document.querySelectorAll('[data-dna-path]')){const value=getNested(dna,input.dataset.dnaPath);if(!Number.isFinite(value))continue;input.value=String(value);document.querySelector(`[data-output="${input.dataset.dnaPath}"]`).textContent=value.toFixed(Number(input.step)<1?3:0);}}
function buildButtons(selector,names,handler){const root=document.querySelector(selector);for(const name of names){const button=document.createElement('button');button.textContent=name;button.onclick=async()=>{[...root.children].forEach((item)=>item.classList.toggle('active',item===button));await handler(name)};root.append(button);}root.firstElementChild?.classList.add('active');}
function setCamera(name){const target=new THREE.Vector3(0,dna?.proportion.height*.5??.9,0);const distance=2.9;if(name==='Front')camera.position.set(0,target.y,distance);if(name==='Back')camera.position.set(0,target.y,-distance);if(name==='Left')camera.position.set(-distance,target.y,0);if(name==='Right')camera.position.set(distance,target.y,0);if(name==='Perspective')camera.position.set(2.4,target.y+0.45,2.8);if(name==='Fit')camera.position.set(0,target.y,dna.proportion.height*1.5);if(name==='Reset')camera.position.set(2.7,1.45,3.1);controls.target.copy(target);controls.update();}
function axisAngle(axis,angle){const l=Math.hypot(...axis)||1,h=angle/2;return [axis[0]/l*Math.sin(h),axis[1]/l*Math.sin(h),axis[2]/l*Math.sin(h),Math.cos(h)];}
function mergeDNAInput(base,override){const result=structuredClone(base??{});for(const [key,value] of Object.entries(override??{})){if(value&&typeof value==='object'&&!Array.isArray(value))result[key]=mergeDNAInput(result[key]??{},value);else result[key]=value;}return result;}
function setNested(target,path,value){const keys=path.split('.');let cursor=target;for(const key of keys.slice(0,-1))cursor=cursor[key]??={};cursor[keys.at(-1)]=value;}
function getNested(target,path){return path.split('.').reduce((value,key)=>value?.[key],target);}
async function createRenderer(){if(!forceWebGL&&navigator.gpu){try{const {WebGPURenderer}=await import('three/webgpu');const value=new WebGPURenderer({antialias:true});await value.init();return{renderer:value,backend:'WebGPU'}}catch(error){console.warn('WebGPU unavailable; falling back to WebGL2.',error)}}return{renderer:new THREE.WebGLRenderer({antialias:true}),backend:forceWebGL?'WebGL2 forced':'WebGL2 fallback'};}
function resize(){const w=container.clientWidth,h=container.clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(w,h,false);}
function render(){controls.update();renderer.render(scene,camera);requestAnimationFrame(render);}
