import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
// Run with an unpacked checkout of 4b52c59cb21f05e1999d1850d443cb18a4adf591.
// The delivered full package contains this pinned source separately.
const sourceRoot=path.resolve(process.argv[2]||'source-core');
const outputRoot=path.resolve(process.argv[3]||path.dirname(fileURLToPath(import.meta.url)));
const read=p=>fs.readFileSync(path.join(sourceRoot,p),'utf8');
const {assemble}=await import(pathToFileURL(path.join(sourceRoot,'tools/build-pure.mjs')).href);
const {runtime}=assemble();
let prefix=runtime.split('// MODULE app')[0];
const reference=JSON.parse(read('reconstruction/rig-reference.json'));
const refLiteral='const R2_RIG='+JSON.stringify(reference)+';';
if(!prefix.includes(refLiteral))throw Error('Original source reference signature changed');
prefix=prefix.replace(refLiteral,'const R2_RIG=structuredClone(subjectReference);');
// More iterations are allowed on the new sampled support surface. None of
// the clearance, contact, hinge, attachment or bone-length gates is relaxed.
const oldBudget='pass<(anchored||candidate.floorPalmTargets||candidate.floorLegTargets?8:1)';
if(!prefix.includes(oldBudget))throw Error('Original ground solver signature changed');
prefix=prefix.replace(oldBudget,'pass<(anchored||candidate.floorPalmTargets||candidate.floorLegTargets?24:1)');
const bindingSource=read('body/CompactBinding.js');
const binding=bindingSource.split('/*__COMPACT_BINDING_CORE__*/')[0];
const dqs=bindingSource.slice(bindingSource.indexOf('function r2DeformPoint'));
const output=`// Generated from original Human Workbench 4b52c59cb21f05e1999d1850d443cb18a4adf591.\n// Explicit subject adaptation: ground-contact iteration cap 8 -> 24.\nexport function createInheritedHumanCore(subjectReference){\nconst window=globalThis.window||globalThis;\nconst location=globalThis.location||{search:''};\n${read('control/NPCRoutineCatalog.js')}\n${prefix}\n${binding}\n${dqs}\nfunction build(input,log=()=>{}){const h=new Human(input);h.tissue=new ReconstructionState(h);const w=new World();w.applyPreset('empty');const a=new Agent(h,w,log);return {h,w,a};}\nreturn {build,Human,World,Agent,ReconstructionState,r2SourceFrames,compactSourceRig,r2DeformPoint,MotionLab,MotionLabPose,resolveCharacterRig,resolveCharacterMetrics,r2SampleMotion,r2NeutralMotion,r2StandingCaptureMotion,r2StandingGestureDescriptor,r2CaptureMotion,r2ReferenceDescriptor,R2_MOTION,qm,inv,rotate,sub,add,mul,dist,qi,qy,qx,qz,qslerp,frame,compose,inverse};\n}\n`;
fs.mkdirSync(outputRoot,{recursive:true});fs.writeFileSync(path.join(outputRoot,'inherited-core.mjs'),output);
const files=['body/ReconstructionRig.js','body/MotionLabPose.js','body/ReferenceMotion.js','body/NaturalLocomotion.js','body/ContactHandPose.js','body/CompactBinding.js','control/TaskAgent.js','control/BasicController.js','control/PlanForecast.js','reconstruction/binding.mjs','reconstruction/anatomy-rules.mjs','motion/source-lock.json'];
fs.writeFileSync(path.join(outputRoot,'inherited-source-lock.json'),JSON.stringify({sourceCommit:'4b52c59cb21f05e1999d1850d443cb18a4adf591',groundIterations:24,acceptanceThresholdsUnchanged:true,files:files.map(p=>({path:p,sha256:crypto.createHash('sha256').update(read(p)).digest('hex')}))},null,2));
console.log('Original core compiled:',Buffer.byteLength(output),'bytes');
