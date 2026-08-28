import { normalizeQuaternion, rotateVectorByQuaternion } from '../../animation/quaternion.js';
import { compilePerformanceLocalRotations } from './performance-deform-rig-v1.js';
import { add3, blendDualQuaternions, composeWorldFrames, multiplyMatrices, rigidMatrixToDualQuaternion, scale3, transformDirection, transformPoint, transformPointByDualQuaternion } from './math-v1.js';

export const HRL_NATURAL_SKINNING_RUNTIME_V1_SCHEMA = 'humanoid_rig/hrl_natural_skinning_runtime@1.0';
export const SKINNING_MODES_V1 = Object.freeze(['lbs4','lbs8','dqs8','hybrid']);

export class HRLNaturalSkinningRuntimeV1 {
  constructor({ performanceRig, weights }) { this.performanceRig = performanceRig; this.weights = weights; }

  createFrame(finalPose = {}) {
    const localRotations = compilePerformanceLocalRotations(this.performanceRig, finalPose);
    const frames = composeWorldFrames(this.performanceRig.joints, localRotations, finalPose.rootTranslation ?? [0,0,0]);
    const skinMatrices = this.performanceRig.joints.map((joint,index)=>multiplyMatrices(frames.get(joint.id).worldMatrix,this.performanceRig.inverseBindMatrices[index]));
    const dualQuaternions = skinMatrices.map(rigidMatrixToDualQuaternion); let maximumBoneLengthError = 0;
    for (const joint of this.performanceRig.joints) {
      if (!joint.parentId || !frames.has(joint.parentId)) continue;
      const actual = Math.hypot(...frames.get(joint.id).worldPosition.map((value,axis)=>value-frames.get(joint.parentId).worldPosition[axis]));
      const expected = Math.hypot(...joint.bindLocalPosition); maximumBoneLengthError = Math.max(maximumBoneLengthError,Math.abs(actual-expected));
    }
    return { schema: HRL_NATURAL_SKINNING_RUNTIME_V1_SCHEMA, poseAuthority: 'finalPose.localRotations', localRotations, frames, skinMatrices, dualQuaternions, maximumBoneLengthError, boneScaleApplied: false };
  }

  skin({ positions, normals, frame, mode = 'hybrid' }) {
    if (!SKINNING_MODES_V1.includes(mode)) throw new Error(`Unknown skinning mode ${mode}.`); const vertexCount=positions.length/3;const outputPositions=new Float32Array(positions.length);const outputNormals=new Float32Array(normals.length);
    for(let vertex=0;vertex<vertexCount;vertex+=1){const point=read3(positions,vertex);const normal=read3(normals,vertex);const entries=weightEntries(this.weights,vertex,mode==='lbs4'?4:8);const lbs=skinLbs(point,normal,entries,frame.skinMatrices);let posedPoint=lbs.point;let posedNormal=lbs.normal;
      if(mode==='dqs8'||mode==='hybrid'){const dqs=skinDqs(point,normal,entries,frame.dualQuaternions);if(mode==='dqs8'){posedPoint=dqs.point;posedNormal=dqs.normal;}else{const blend=this.weights.hybridBlend[vertex];posedPoint=add3(scale3(lbs.point,1-blend),scale3(dqs.point,blend));posedNormal=normalize3(add3(scale3(lbs.normal,1-blend),scale3(dqs.normal,blend)),normal);}}
      write3(outputPositions,vertex,posedPoint);write3(outputNormals,vertex,posedNormal);
    }
    return { positions:outputPositions,normals:outputNormals,mode,vertexCount,indexTopologyModified:false,canonicalPositionsModified:false };
  }
}

function weightEntries(weights,vertex,limit){const result=[];for(let slot=0;slot<limit;slot+=1){const joints=slot<4?weights.joints0:weights.joints1;const values=slot<4?weights.weights0:weights.weights1;const offset=vertex*4+(slot%4);if(values[offset]>0)result.push({boneIndex:joints[offset],weight:values[offset]});}const sum=result.reduce((value,entry)=>value+entry.weight,0)||1;return result.map((entry)=>({...entry,weight:entry.weight/sum}));}
function skinLbs(point,normal,entries,matrices){let outputPoint=[0,0,0];let outputNormal=[0,0,0];for(const entry of entries){outputPoint=add3(outputPoint,scale3(transformPoint(matrices[entry.boneIndex],point),entry.weight));outputNormal=add3(outputNormal,scale3(transformDirection(matrices[entry.boneIndex],normal),entry.weight));}return{point:outputPoint,normal:normalize3(outputNormal,normal)};}
function skinDqs(point,normal,entries,dualQuaternions){const blended=blendDualQuaternions(entries.map((entry)=>({weight:entry.weight,dualQuaternion:dualQuaternions[entry.boneIndex]})));return{point:transformPointByDualQuaternion(blended,point),normal:normalize3(rotateVectorByQuaternion(normal,normalizeQuaternion(blended.real)),normal)};}
function read3(array,vertex){const offset=vertex*3;return[array[offset],array[offset+1],array[offset+2]];}
function write3(array,vertex,value){const offset=vertex*3;array[offset]=value[0];array[offset+1]=value[1];array[offset+2]=value[2];}
function normalize3(value,fallback){const length=Math.hypot(...value);return length>1e-12?value.map((component)=>component/length):[...fallback];}
