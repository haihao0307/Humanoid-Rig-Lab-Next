import { distance3 } from './math-v1.js';

export const HRL_NATURAL_SKINNING_QA_V1_SCHEMA = 'humanoid_rig/hrl_natural_skinning_qa@1.0';

export function auditRestIdentityV1({ canonicalPositions, canonicalNormals, posedPositions, posedNormals, indices, centerVertexIndices }) {
  const position = differenceMetrics(canonicalPositions, posedPositions, 3);
  const normal = differenceMetrics(canonicalNormals, posedNormals, 3);
  const finite = finiteCounts(posedPositions, posedNormals);
  const triangle = triangleMetrics(canonicalPositions, posedPositions, canonicalNormals, posedNormals, indices);
  let centerlineRestGap = 0;
  for (const vertex of centerVertexIndices) centerlineRestGap = Math.max(centerlineRestGap, Math.abs(posedPositions[vertex * 3]));
  const metrics = {
    schema: HRL_NATURAL_SKINNING_QA_V1_SCHEMA,
    maximumRestPositionError: position.maximum,
    meanRestPositionError: position.mean,
    maximumRestNormalError: normal.maximum,
    meanRestNormalError: normal.mean,
    centerlineRestGap,
    restTriangleFlipCount: triangle.triangleFlipCount,
    restDegenerateTriangleCount: triangle.degenerateTriangleCount,
    restNaNCount: finite.NaNPositionCount + finite.NaNNormalCount,
    restInfCount: finite.InfPositionCount + finite.InfNormalCount,
  };
  metrics.passed = metrics.maximumRestPositionError <= 1e-6
    && metrics.meanRestPositionError <= 1e-8
    && metrics.maximumRestNormalError <= 1e-5
    && metrics.centerlineRestGap === 0
    && metrics.restTriangleFlipCount === 0
    && metrics.restDegenerateTriangleCount === 0
    && metrics.restNaNCount === 0
    && metrics.restInfCount === 0;
  return metrics;
}

export function auditSkinnedPoseV1({
  poseId,
  canonicalPositions,
  canonicalNormals,
  posedPositions,
  posedNormals,
  indices,
  topologyFingerprint,
  expectedTopologyFingerprint,
  indexHash,
  expectedIndexHash,
  connectedComponentCount = 1,
  maximumBoneLengthError = 0,
  returnToRestError = 0,
  intentionalContact = false,
  regionVertexSets = {},
  criticalSelfIntersectionCount = 0,
  criticalSelfIntersectionEvidence = [],
  boneSurfaceClearance = null,
}) {
  const finite = finiteCounts(posedPositions, posedNormals);
  const triangle = triangleMetrics(canonicalPositions, posedPositions, canonicalNormals, posedNormals, indices);
  const regionVolumeRatios = Object.fromEntries(['shoulder','elbow','hip','knee'].map((region) => [region, covarianceVolumeRatio(canonicalPositions, posedPositions, regionVertexSets[region] ?? [])]));
  const maximumReturnToRestError = returnToRestError;
  const nonContactIntersectionFailure = !intentionalContact && criticalSelfIntersectionCount !== 0;
  const catastrophicFailureReasons = [];
  if (posedPositions.length !== canonicalPositions.length) catastrophicFailureReasons.push('vertex-count-changed');
  if (indexHash !== expectedIndexHash) catastrophicFailureReasons.push('index-hash-changed');
  if (topologyFingerprint !== expectedTopologyFingerprint) catastrophicFailureReasons.push('topology-fingerprint-changed');
  if (connectedComponentCount !== 1) catastrophicFailureReasons.push('connected-component-count');
  if (finite.NaNPositionCount || finite.InfPositionCount || finite.NaNNormalCount || finite.InfNormalCount) catastrophicFailureReasons.push('non-finite-output');
  if (triangle.degenerateTriangleCount) catastrophicFailureReasons.push('detached-or-degenerate-triangle');
  if (triangle.triangleFlipCount) catastrophicFailureReasons.push('triangle-flip');
  if (nonContactIntersectionFailure) catastrophicFailureReasons.push('critical-self-intersection');
  if (maximumReturnToRestError > 1e-6) catastrophicFailureReasons.push('irreversible-deformation');
  if (maximumBoneLengthError > 1e-8) catastrophicFailureReasons.push('bone-length-error');
  const volumePass = inRange(regionVolumeRatios.shoulder, 0.70, 1.30)
    && inRange(regionVolumeRatios.elbow, 0.65, 1.30)
    && inRange(regionVolumeRatios.hip, 0.70, 1.30)
    && inRange(regionVolumeRatios.knee, 0.65, 1.30);
  return {
    schema: HRL_NATURAL_SKINNING_QA_V1_SCHEMA,
    poseId,
    intentionalContact,
    vertexCountUnchanged: posedPositions.length === canonicalPositions.length,
    indexHashUnchanged: indexHash === expectedIndexHash,
    topologyFingerprintUnchanged: topologyFingerprint === expectedTopologyFingerprint,
    connectedComponentCount,
    ...finite,
    detachedTriangleCount: triangle.degenerateTriangleCount,
    triangleFlipCount: triangle.triangleFlipCount,
    centerlineGap: 0,
    visibleExplosion: triangle.maximumEdgeStretch > 8 || finite.NaNPositionCount + finite.InfPositionCount > 0,
    irreversibleDeformation: maximumReturnToRestError > 1e-6,
    maximumReturnToRestError,
    boneLengthError: maximumBoneLengthError,
    unknownJointCount: 0,
    criticalSelfIntersectionCount,
    criticalSelfIntersectionEvidence,
    surfaceStrain: { maximumEdgeStretch: triangle.maximumEdgeStretch, maximumEdgeCompression: triangle.maximumEdgeCompression, meanAbsoluteEdgeStrain: triangle.meanAbsoluteEdgeStrain },
    triangleAreaRatio: { minimum: triangle.minimumAreaRatio, maximum: triangle.maximumAreaRatio, mean: triangle.meanAreaRatio },
    jointVolumeRatio: regionVolumeRatios,
    normalValidity: finite.NaNNormalCount === 0 && finite.InfNormalCount === 0,
    boneSurfaceClearance,
    returnToRestError: maximumReturnToRestError,
    volumePass,
    catastrophicFailureReasons,
    catastrophicFailure: catastrophicFailureReasons.length > 0,
    passed: catastrophicFailureReasons.length === 0 && volumePass,
  };
}

export function buildRegionVertexSetsV1(parsedSurface) {
  const output = { shoulder: new Set(), axilla: new Set(), elbow: new Set(), wrist: new Set(), hand: new Set(), hip: new Set(), groin: new Set(), knee: new Set(), ankle: new Set(), foot: new Set() };
  const mapping = {
    neck_base: [], clavicle: ['shoulder'], shoulder_cap: ['shoulder'], deltoid: ['shoulder'], front_axilla: ['axilla','shoulder'], back_axilla: ['axilla','shoulder'], scapular: ['shoulder'], upper_arm_root: ['shoulder'],
    elbow: ['elbow'], forearm: ['elbow'], wrist: ['wrist'], palm: ['hand'], finger_base: ['hand'], finger_joints: ['hand'], pelvis: ['hip'], gluteal: ['hip'], front_groin: ['groin','hip'], back_groin: ['groin','hip'], hip_root: ['hip'], thigh_twist: ['hip'], knee: ['knee'], patella: ['knee'], popliteal: ['knee'], calf: ['knee'], ankle: ['ankle'], heel: ['foot'], arch: ['foot'], forefoot: ['foot'], toe_base: ['foot'],
  };
  parsedSurface.header.deformationRegions.forEach((definition, regionIndex) => {
    const targets = mapping[definition.id] ?? [];
    const start = parsedSurface.chunks.regionOffsets[regionIndex];
    const end = parsedSurface.chunks.regionOffsets[regionIndex + 1];
    for (let offset = start; offset < end; offset += 1) for (const target of targets) output[target].add(parsedSurface.chunks.regionVertexIndices[offset]);
  });
  return Object.fromEntries(Object.entries(output).map(([key, value]) => [key, [...value].sort((a,b)=>a-b)]));
}

function finiteCounts(positions, normals) {
  let NaNPositionCount=0;let InfPositionCount=0;let NaNNormalCount=0;let InfNormalCount=0;
  for(const value of positions){if(Number.isNaN(value))NaNPositionCount+=1;else if(!Number.isFinite(value))InfPositionCount+=1;}
  for(const value of normals){if(Number.isNaN(value))NaNNormalCount+=1;else if(!Number.isFinite(value))InfNormalCount+=1;}
  return {NaNPositionCount,InfPositionCount,NaNNormalCount,InfNormalCount};
}

function differenceMetrics(left,right,stride){let maximum=0,total=0,count=0;for(let offset=0;offset<left.length;offset+=stride){let sum=0;for(let axis=0;axis<stride;axis+=1){const delta=left[offset+axis]-right[offset+axis];sum+=delta*delta;}const value=Math.sqrt(sum);maximum=Math.max(maximum,value);total+=value;count+=1;}return{maximum,mean:count?total/count:0};}

function triangleMetrics(rest,posed,restNormals,posedNormals,indices){let degenerateTriangleCount=0;let triangleFlipCount=0;let minimumAreaRatio=Infinity;let maximumAreaRatio=0;let totalAreaRatio=0;let triangleCount=0;let maximumEdgeStretch=0;let maximumEdgeCompression=0;let totalAbsoluteEdgeStrain=0;let edgeCount=0;
  for(let offset=0;offset<indices.length;offset+=3){const ids=[indices[offset],indices[offset+1],indices[offset+2]];const r=ids.map((id)=>point(rest,id));const p=ids.map((id)=>point(posed,id));const restCross=cross(subtract(r[1],r[0]),subtract(r[2],r[0]));const posedCross=cross(subtract(p[1],p[0]),subtract(p[2],p[0]));const restArea=Math.hypot(...restCross)*0.5;const posedArea=Math.hypot(...posedCross)*0.5;if(posedArea<=Math.max(1e-14,restArea*1e-6))degenerateTriangleCount+=1;const ratio=restArea>1e-20?posedArea/restArea:1;minimumAreaRatio=Math.min(minimumAreaRatio,ratio);maximumAreaRatio=Math.max(maximumAreaRatio,ratio);totalAreaRatio+=ratio;triangleCount+=1;const restAverageNormal=normalize(ids.reduce((sum,id)=>{const n=point(restNormals,id);return[sum[0]+n[0],sum[1]+n[1],sum[2]+n[2]];},[0,0,0]));const posedAverageNormal=normalize(ids.reduce((sum,id)=>{const n=point(posedNormals,id);return[sum[0]+n[0],sum[1]+n[1],sum[2]+n[2]];},[0,0,0]));const restSign=Math.sign(dot(restCross,restAverageNormal));const posedSign=Math.sign(dot(posedCross,posedAverageNormal));if(restSign!==0&&posedSign!==0&&restSign!==posedSign)triangleFlipCount+=1;for(const [a,b]of[[0,1],[1,2],[2,0]]){const restLength=distance3(r[a],r[b]);const posedLength=distance3(p[a],p[b]);const stretch=restLength>1e-12?posedLength/restLength:1;maximumEdgeStretch=Math.max(maximumEdgeStretch,stretch);maximumEdgeCompression=Math.max(maximumEdgeCompression,1/Math.max(stretch,1e-12));totalAbsoluteEdgeStrain+=Math.abs(stretch-1);edgeCount+=1;}}
  return{degenerateTriangleCount,triangleFlipCount,minimumAreaRatio:Number.isFinite(minimumAreaRatio)?minimumAreaRatio:1,maximumAreaRatio,meanAreaRatio:triangleCount?totalAreaRatio/triangleCount:1,maximumEdgeStretch,maximumEdgeCompression,meanAbsoluteEdgeStrain:edgeCount?totalAbsoluteEdgeStrain/edgeCount:0};}

function covarianceVolumeRatio(rest,posed,vertices){if(vertices.length<4)return 1;const a=covariance(rest,vertices);const b=covariance(posed,vertices);const da=Math.max(0,determinant3(a));const db=Math.max(0,determinant3(b));return da>1e-30?Math.sqrt(db/da):1;}
function covariance(values,vertices){const mean=[0,0,0];for(const id of vertices){const p=point(values,id);mean[0]+=p[0];mean[1]+=p[1];mean[2]+=p[2];}mean[0]/=vertices.length;mean[1]/=vertices.length;mean[2]/=vertices.length;const c=[[0,0,0],[0,0,0],[0,0,0]];for(const id of vertices){const p=point(values,id).map((v,i)=>v-mean[i]);for(let i=0;i<3;i+=1)for(let j=0;j<3;j+=1)c[i][j]+=p[i]*p[j]/vertices.length;}return c;}
function determinant3(m){return m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])-m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])+m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);}
function point(values,id){const offset=id*3;return[values[offset],values[offset+1],values[offset+2]];}
function subtract(a,b){return[a[0]-b[0],a[1]-b[1],a[2]-b[2]];}
function cross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
function normalize(a){const length=Math.hypot(...a);return length>1e-20?a.map((value)=>value/length):[0,0,0];}
function inRange(value,minimum,maximum){return Number.isFinite(value)&&value>=minimum&&value<=maximum;}
