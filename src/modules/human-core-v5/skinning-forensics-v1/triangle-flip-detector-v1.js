import { cross3, dot3, length3, normalize3, sub3 } from '../natural-skinning-v1/math-v1.js';

export const HRL_TRUE_TRIANGLE_INVERSION_DETECTOR_V1_SCHEMA = 'humanoid_rig/true_triangle_inversion_detector@1.0';

export function auditLegacyTriangleFlipsV1({ restPositions, restNormals, posedPositions, posedNormals, indices }) {
  const triangleIds = [];
  for (let triangleId = 0; triangleId < indices.length / 3; triangleId += 1) {
    const ids = triangleVertexIds(indices, triangleId);
    const restCross = triangleCross(restPositions, ids);
    const posedCross = triangleCross(posedPositions, ids);
    const restNormal = averageNormal(restNormals, ids);
    const posedNormal = averageNormal(posedNormals, ids);
    const restSign = Math.sign(dot3(restCross, restNormal));
    const posedSign = Math.sign(dot3(posedCross, posedNormal));
    if (restSign !== 0 && posedSign !== 0 && restSign !== posedSign) triangleIds.push(triangleId);
  }
  return {
    algorithm: 'legacy authored-normal agreement sign comparison',
    definition: 'compare sign(dot(rest ordered area vector, rest averaged vertex normal)) with sign(dot(posed ordered area vector, skinned averaged vertex normal))',
    limitation: 'a disagreement between interpolated/skinned normals and geometric face orientation is reported even when the local triangle map did not cross a degeneracy',
    triangleFlipCount: triangleIds.length,
    triangleIds,
  };
}

export function auditRestWorldNormalDotHeuristicV1({ restPositions, posedPositions, indices }) {
  const triangleIds = [];
  for (let triangleId = 0; triangleId < indices.length / 3; triangleId += 1) {
    const ids = triangleVertexIds(indices, triangleId);
    if (dot3(normalize3(triangleCross(restPositions, ids)), normalize3(triangleCross(posedPositions, ids))) < 0) triangleIds.push(triangleId);
  }
  return { algorithm:'forbidden single rest-world-normal dot heuristic', triangleFlipCount:triangleIds.length, triangleIds };
}

export function detectTrueTriangleInversionsV1({ restPositions, samplePositions, indices, deformedIndices = indices, degeneracyAreaRatio = 1e-5 }) {
  if (!Array.isArray(samplePositions) || samplePositions.length < 2) throw new Error('True inversion detection requires an ordered trajectory containing rest and posed samples.');
  const invertedTriangleIds=[];const evidence=[];let minimumObservedAreaRatio=Infinity;let degeneracyCrossingCount=0;let indexParityInversionCount=0;
  for(let triangleId=0;triangleId<indices.length/3;triangleId+=1){
    const restIds=triangleVertexIds(indices,triangleId);const posedIds=triangleVertexIds(deformedIndices,triangleId);const parity=indexPermutationParity(restIds,posedIds);const restArea=Math.max(1e-30,length3(triangleCross(restPositions,restIds))*0.5);
    const samples=samplePositions.map((positions,sampleIndex)=>{const areaVector=triangleCross(positions,posedIds);return{sampleIndex,area:length3(areaVector)*0.5,normal:normalize3(areaVector,[0,0,1])};});
    const ratios=samples.map((sample)=>sample.area/restArea);const minimumAreaRatio=Math.min(...ratios);minimumObservedAreaRatio=Math.min(minimumObservedAreaRatio,minimumAreaRatio);
    let inversionReason=null;let crossingSampleIndex=null;let orientationDotAcrossCrossing=null;
    if(parity===-1){inversionReason='index-parity-reversal';indexParityInversionCount+=1;}
    else{
      const degenerate=samples.findIndex((sample)=>sample.area/restArea<=degeneracyAreaRatio);
      if(degenerate>=0){const before=findNonDegenerate(samples,ratios,degenerate,-1,degeneracyAreaRatio);const after=findNonDegenerate(samples,ratios,degenerate,1,degeneracyAreaRatio);if(before&&after){orientationDotAcrossCrossing=dot3(before.normal,after.normal);if(orientationDotAcrossCrossing<0){inversionReason='oriented-area-reversal-after-degeneracy';crossingSampleIndex=degenerate;degeneracyCrossingCount+=1;}}}
      if(!inversionReason)for(let index=1;index<samples.length;index+=1){const orientationDot=dot3(samples[index-1].normal,samples[index].normal);if(orientationDot<-0.5&&Math.min(ratios[index-1],ratios[index])<=0.05){inversionReason='near-degenerate-temporal-orientation-discontinuity';crossingSampleIndex=index;orientationDotAcrossCrossing=orientationDot;degeneracyCrossingCount+=1;break;}}
    }
    if(inversionReason){invertedTriangleIds.push(triangleId);evidence.push({triangleId,canonicalVertexIds:restIds,deformedVertexIds:posedIds,inversionReason,crossingSampleIndex,minimumAreaRatio,orientationDotAcrossCrossing,indexPermutationParity:parity});}
  }
  return {
    schema:HRL_TRUE_TRIANGLE_INVERSION_DETECTOR_V1_SCHEMA,
    algorithm:'ordered local triangle trajectory; index parity plus oriented-area degeneracy crossing and temporal normal continuity',
    localTangentBasisUsed:true,orientedAreaUsed:true,localDeformationJacobianProxy:'area ratio and orientation continuity of the 2D-to-3D affine triangle map',degeneracyCrossingUsed:true,temporalContinuityUsed:true,
    degeneracyAreaRatio,trueTriangleInversionCount:invertedTriangleIds.length,invertedTriangleIds,evidence,degeneracyCrossingCount,indexParityInversionCount,minimumObservedAreaRatio:Number.isFinite(minimumObservedAreaRatio)?minimumObservedAreaRatio:null,
  };
}

function findNonDegenerate(samples,ratios,start,direction,threshold){for(let index=start+direction;index>=0&&index<samples.length;index+=direction)if(ratios[index]>threshold)return samples[index];return null;}
function triangleVertexIds(indices,triangleId){const offset=triangleId*3;return[Number(indices[offset]),Number(indices[offset+1]),Number(indices[offset+2])];}
function triangleCross(positions,ids){const a=point(positions,ids[0]);return cross3(sub3(point(positions,ids[1]),a),sub3(point(positions,ids[2]),a));}
function averageNormal(normals,ids){const value=[0,0,0];for(const id of ids){const normal=point(normals,id);value[0]+=normal[0];value[1]+=normal[1];value[2]+=normal[2];}return normalize3(value,[0,0,1]);}
function point(values,id){const offset=id*3;return[values[offset],values[offset+1],values[offset+2]];}
function indexPermutationParity(restIds,posedIds){if(restIds.every((value,index)=>value===posedIds[index]))return 1;if([...restIds].sort((a,b)=>a-b).join('/')!==[...posedIds].sort((a,b)=>a-b).join('/'))return 0;const permutation=posedIds.map((value)=>restIds.indexOf(value));let inversions=0;for(let a=0;a<permutation.length;a+=1)for(let b=a+1;b<permutation.length;b+=1)if(permutation[a]>permutation[b])inversions+=1;return inversions%2?-1:1;}
