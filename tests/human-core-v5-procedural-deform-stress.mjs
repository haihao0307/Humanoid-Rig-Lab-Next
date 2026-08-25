import assert from 'node:assert/strict';
import {
  HumanCoreRuntime, ProceduralDeformRuntimeV5, createBodyDNA, createRegionDeformationDriverFrameV5,
  createProceduralDeformValidationPoseV5,
} from '../src/modules/human-core-v5/index.js';

const dna=createBodyDNA({bodyDNAId:'deform-stress',identity:{humanId:'deform-stress'},proportionRevision:5});
const human=new HumanCoreRuntime();human.createHuman(dna);const rigCore=human.getRigCore();
const runtime=new ProceduralDeformRuntimeV5();runtime.compileHuman({bodyDNA:dna,rigCore});await runtime.generateCanonicalSurface({resolution:28,worker:false});
const canonicalTopology=runtime.getSurfaceMetadata().topologyFingerprint;
const poses={neutral:'t-pose',shoulder:'arm-raise-150-left',elbow:'elbow-bend-140-left',twist:'forearm-twist-180-left',hip:'hip-flex-left',knee:'knee-bend-left',squat:'squat'};
const frames={};
for(const [name,poseId] of Object.entries(poses)){const pose=createProceduralDeformValidationPoseV5({poseId,rigCore,bodyDNA:dna,timestamp:1});human.updatePose(pose);frames[name]=runtime.update({finalPose:pose,anatomyState:human.getAnatomyState()});assert.equal(frames[name].topologyFingerprint,canonicalTopology);assert.equal(frames[name].poseAuthority,'finalPose.localRotations');}

for(const [poseName,regionName,min,max] of [['shoulder','leftUpperArm',.75,1.25],['elbow','leftForearm',.75,1.25],['hip','leftThigh',.75,1.25],['knee','leftCalf',.75,1.25]]){
  const ratio=regionMomentVolume(frames[poseName],runtime.surface.regionNames,regionName)/regionMomentVolume(frames.neutral,runtime.surface.regionNames,regionName);assert.ok(ratio>=min&&ratio<=max,`${poseName} ${regionName} volume ratio ${ratio}.`);
}
const twistRadius=regionRmsRadius(frames.twist,runtime.surface.regionNames,'leftForearm')/regionRmsRadius(frames.neutral,runtime.surface.regionNames,'leftForearm');
assert.ok(twistRadius>=.85,`Forearm twist radius retention was ${twistRadius}.`);

const equivalentFixture=createProceduralDeformValidationPoseV5({poseId:'arm-raise-150-left',rigCore,bodyDNA:dna,timestamp:2});const equivalentQ=equivalentFixture.localRotations.leftUpperArm;const equivalentNegativeQ=equivalentQ.map((value)=>-value);
const equivalentPose=(rotation)=>({...structuredClone(equivalentFixture),localRotations:{leftUpperArm:rotation}});
const positivePose=equivalentPose(equivalentQ);human.updatePose(positivePose);const positiveDriver=createRegionDeformationDriverFrameV5({finalPose:positivePose,rigCore,anatomyState:human.getAnatomyState(),bodyDNA:dna});
const negativePose=equivalentPose(equivalentNegativeQ);human.updatePose(negativePose);const negativeDriver=createRegionDeformationDriverFrameV5({finalPose:negativePose,rigCore,anatomyState:human.getAnatomyState(),bodyDNA:dna});
for(const key of ['bend','twist','side'])assert.ok(Math.abs(positiveDriver.regions.leftShoulder[key]-negativeDriver.regions.leftShoulder[key])<1e-8,`Quaternion sign changed ${key}.`);

for(let i=0;i<80;i++){const pose=createProceduralDeformValidationPoseV5({poseId:i%2?'t-pose':'a-pose',rigCore,bodyDNA:dna,timestamp:i+10});human.updatePose(pose);runtime.update({finalPose:pose,anatomyState:human.getAnatomyState()});}
const diagnostics=runtime.getDiagnostics();
assert.ok(diagnostics.medianDeformationMs<5,`Median deformation ${diagnostics.medianDeformationMs} ms exceeded 5 ms.`);
assert.ok(diagnostics.p95DeformationMs<8,`P95 deformation ${diagnostics.p95DeformationMs} ms exceeded 8 ms.`);
assert.throws(()=>runtime.update({finalPose:{desiredPose:true},anatomyState:human.getAnatomyState()}),/Invalid PoseFrame V4/);
console.log(JSON.stringify({medianDeformationMs:diagnostics.medianDeformationMs,p95DeformationMs:diagnostics.p95DeformationMs,forearmTwistRadiusRetention:twistRadius}));
console.log('Human Core V5 Procedural Deform stress: stable topology, local-quaternion authority, DQS twist, joint volume gates, and CPU timing passed.');

function regionPoints(frame,names,name){const points=[];for(let v=0;v<frame.deformedPositions.length/3;v++)if(names[frame.regionIds[v*4]]===name)points.push([frame.deformedPositions[v*3],frame.deformedPositions[v*3+1],frame.deformedPositions[v*3+2]]);return points;}
function regionMoments(frame,names,name){const points=regionPoints(frame,names,name),center=[0,0,0];for(const p of points)for(let a=0;a<3;a++)center[a]+=p[a]/points.length;const c=[[0,0,0],[0,0,0],[0,0,0]];for(const p of points){const d=p.map((v,a)=>v-center[a]);for(let a=0;a<3;a++)for(let b=0;b<3;b++)c[a][b]+=d[a]*d[b]/points.length;}return{points,center,c};}
function regionMomentVolume(frame,names,name){const {c}=regionMoments(frame,names,name);const det=c[0][0]*(c[1][1]*c[2][2]-c[1][2]*c[2][1])-c[0][1]*(c[1][0]*c[2][2]-c[1][2]*c[2][0])+c[0][2]*(c[1][0]*c[2][1]-c[1][1]*c[2][0]);return Math.sqrt(Math.max(1e-18,det));}
function regionRmsRadius(frame,names,name){const {points,center}=regionMoments(frame,names,name);return Math.sqrt(points.reduce((sum,p)=>sum+p.reduce((s,v,a)=>s+(v-center[a])**2,0),0)/points.length);}
