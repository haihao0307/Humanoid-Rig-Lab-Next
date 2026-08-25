import assert from 'node:assert/strict';
import {
  HumanCoreRuntime, ProceduralDeformRuntimeV5, createBodyDNA, createRegionDeformationDriverFrameV5,
} from '../src/modules/human-core-v5/index.js';
import { createPoseFrameV4 } from '../src/modules/pose/pose-frame-v4.js';

const dna=createBodyDNA({bodyDNAId:'deform-stress',identity:{humanId:'deform-stress'},proportionRevision:5});
const human=new HumanCoreRuntime();human.createHuman(dna);const rigCore=human.getRigCore();
const runtime=new ProceduralDeformRuntimeV5();runtime.compileHuman({bodyDNA:dna,rigCore});await runtime.generateCanonicalSurface({resolution:28,worker:false});
const canonicalTopology=runtime.getSurfaceMetadata().topologyFingerprint;
const poses={
  neutral:{},shoulder:{leftUpperArm:q([0,0,1],150)},elbow:{leftLowerArm:q([0,0,1],140)},twist:{leftLowerArm:q([1,0,0],180)},
  hip:{leftUpperLeg:q([1,0,0],80)},knee:{leftLowerLeg:q([1,0,0],125)},squat:{leftUpperLeg:q([1,0,0],65),rightUpperLeg:q([1,0,0],65),leftLowerLeg:q([1,0,0],-105),rightLowerLeg:q([1,0,0],-105)},
};
const frames={};
for(const [name,rotations] of Object.entries(poses)){const pose=createPoseFrameV4({compatibleRig:rigCore.sourceRig.compatibleRig,rootJointId:'hips',rootPosition:[0,runtime.field.definition.canonicalLayout.pelvisCenterY,0],rootRotation:[0,0,0,1],localRotations:rotations,contacts:[],ikTargets:[],constraintState:{fixture:name},proportionRevision:dna.proportionRevision,timestamp:1});human.updatePose(pose);frames[name]=runtime.update({finalPose:pose,anatomyState:human.getAnatomyState()});assert.equal(frames[name].topologyFingerprint,canonicalTopology);assert.equal(frames[name].poseAuthority,'finalPose.localRotations');}

for(const [poseName,regionName,min,max] of [['shoulder','leftUpperArm',.75,1.25],['elbow','leftForearm',.75,1.25],['hip','leftThigh',.75,1.25],['knee','leftCalf',.75,1.25]]){
  const ratio=regionMomentVolume(frames[poseName],runtime.surface.regionNames,regionName)/regionMomentVolume(frames.neutral,runtime.surface.regionNames,regionName);assert.ok(ratio>=min&&ratio<=max,`${poseName} ${regionName} volume ratio ${ratio}.`);
}
const twistRadius=regionRmsRadius(frames.twist,runtime.surface.regionNames,'leftForearm')/regionRmsRadius(frames.neutral,runtime.surface.regionNames,'leftForearm');
assert.ok(twistRadius>=.85,`Forearm twist radius retention was ${twistRadius}.`);

const equivalentQ=q([0,0,1],60);const equivalentNegativeQ=equivalentQ.map((value)=>-value);
const equivalentPose=(rotation)=>createPoseFrameV4({compatibleRig:rigCore.sourceRig.compatibleRig,rootJointId:'hips',rootPosition:[0,runtime.field.definition.canonicalLayout.pelvisCenterY,0],rootRotation:[0,0,0,1],localRotations:{leftUpperArm:rotation},proportionRevision:dna.proportionRevision,timestamp:2});
const positivePose=equivalentPose(equivalentQ);human.updatePose(positivePose);const positiveDriver=createRegionDeformationDriverFrameV5({finalPose:positivePose,rigCore,anatomyState:human.getAnatomyState(),bodyDNA:dna});
const negativePose=equivalentPose(equivalentNegativeQ);human.updatePose(negativePose);const negativeDriver=createRegionDeformationDriverFrameV5({finalPose:negativePose,rigCore,anatomyState:human.getAnatomyState(),bodyDNA:dna});
for(const key of ['bend','twist','side'])assert.ok(Math.abs(positiveDriver.regions.leftShoulder[key]-negativeDriver.regions.leftShoulder[key])<1e-8,`Quaternion sign changed ${key}.`);

for(let i=0;i<80;i++){const pose=createPoseFrameV4({compatibleRig:rigCore.sourceRig.compatibleRig,rootJointId:'hips',rootPosition:[0,runtime.field.definition.canonicalLayout.pelvisCenterY,0],rootRotation:[0,0,0,1],localRotations:{leftUpperArm:q([0,0,1],i%2?90:45)},proportionRevision:dna.proportionRevision,timestamp:i+10});human.updatePose(pose);runtime.update({finalPose:pose,anatomyState:human.getAnatomyState()});}
const diagnostics=runtime.getDiagnostics();
assert.ok(diagnostics.medianDeformationMs<5,`Median deformation ${diagnostics.medianDeformationMs} ms exceeded 5 ms.`);
assert.ok(diagnostics.p95DeformationMs<8,`P95 deformation ${diagnostics.p95DeformationMs} ms exceeded 8 ms.`);
assert.throws(()=>runtime.update({finalPose:{desiredPose:true},anatomyState:human.getAnatomyState()}),/Invalid PoseFrame V4/);
console.log(JSON.stringify({medianDeformationMs:diagnostics.medianDeformationMs,p95DeformationMs:diagnostics.p95DeformationMs,forearmTwistRadiusRetention:twistRadius}));
console.log('Human Core V5 Procedural Deform stress: stable topology, local-quaternion authority, DQS twist, joint volume gates, and CPU timing passed.');

function q(axis,degrees){const angle=degrees*Math.PI/180,half=angle/2,length=Math.hypot(...axis)||1;return axis.map((v)=>v/length*Math.sin(half)).concat(Math.cos(half));}
function regionPoints(frame,names,name){const points=[];for(let v=0;v<frame.deformedPositions.length/3;v++)if(names[frame.regionIds[v*4]]===name)points.push([frame.deformedPositions[v*3],frame.deformedPositions[v*3+1],frame.deformedPositions[v*3+2]]);return points;}
function regionMoments(frame,names,name){const points=regionPoints(frame,names,name),center=[0,0,0];for(const p of points)for(let a=0;a<3;a++)center[a]+=p[a]/points.length;const c=[[0,0,0],[0,0,0],[0,0,0]];for(const p of points){const d=p.map((v,a)=>v-center[a]);for(let a=0;a<3;a++)for(let b=0;b<3;b++)c[a][b]+=d[a]*d[b]/points.length;}return{points,center,c};}
function regionMomentVolume(frame,names,name){const {c}=regionMoments(frame,names,name);const det=c[0][0]*(c[1][1]*c[2][2]-c[1][2]*c[2][1])-c[0][1]*(c[1][0]*c[2][2]-c[1][2]*c[2][0])+c[0][2]*(c[1][0]*c[2][1]-c[1][1]*c[2][0]);return Math.sqrt(Math.max(1e-18,det));}
function regionRmsRadius(frame,names,name){const {points,center}=regionMoments(frame,names,name);return Math.sqrt(points.reduce((sum,p)=>sum+p.reduce((s,v,a)=>s+(v-center[a])**2,0),0)/points.length);}
