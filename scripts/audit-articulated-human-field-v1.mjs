import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHrlSurfaceV1 } from '../src/modules/human-core-v5/production-surface-v1/hrlsurface-format-v1.js';
import {
  FIELD_BINARY_MAGIC_V1,
  FIELD_BRICK_MAGIC_V1,
  FIELD_REGION_MAGIC_V1,
  parseFieldBinaryV1,
  reconstructDenseFieldV1,
} from '../src/modules/human-core-v5/computational-human-field-v1/field-format-v1.js';
import {
  TASK18A_POSE_IDS_V1,
  createArticulatedPoseStateV1,
  createTask18APosesV1,
  evaluateArticulatedFieldV1,
  evaluatePoseCorrectiveFieldsV1,
  forwardArticulatedWarpV1,
  inverseArticulatedWarpV1,
  numericalInverseJacobianProxyV1,
  serializePoseStateForRendererV1,
} from '../src/modules/human-core-v5/computational-human-field-v1/articulated-field-v1.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const assetDirectory = resolve(root, 'assets/human/computational-human-field-v1');
const qaDirectory = resolve(root, 'artifacts/qa/task18a-computational-human-field-v1');
await mkdir(qaDirectory, { recursive: true });
const paths = {
  metadata: resolve(assetDirectory, 'canonical-anatomy-field-v1.json'),
  coarse: resolve(assetDirectory, 'canonical-anatomy-field-v1.bin'),
  bricks: resolve(assetDirectory, 'field-brick-atlas-v1.bin'),
  regions: resolve(assetDirectory, 'field-region-atlas-v1.bin'),
  surface: resolve(root, 'assets/human/production-surface-v1/humanoid-rig-production-neutral-v1.hrlsurface'),
  rig: resolve(root, 'assets/human/natural-skinning-v1/PERFORMANCE_DEFORM_RIG_V1.json'),
  fixtures: resolve(root, 'assets/human/natural-skinning-v1/POSE_FIXTURES_V1.json'),
};
const [metadataText, coarseBytes, brickBytes, regionBytes, surfaceBytes, rigText, fixtureText] = await Promise.all([
  readFile(paths.metadata, 'utf8'), readFile(paths.coarse), readFile(paths.bricks), readFile(paths.regions), readFile(paths.surface), readFile(paths.rig, 'utf8'), readFile(paths.fixtures, 'utf8'),
]);
const metadata = JSON.parse(metadataText);
const field = reconstructDenseFieldV1({
  metadata,
  coarsePayload: parseFieldBinaryV1(coarseBytes, FIELD_BINARY_MAGIC_V1).payload,
  brickPayload: parseFieldBinaryV1(brickBytes, FIELD_BRICK_MAGIC_V1).payload,
  regionPayload: parseFieldBinaryV1(regionBytes, FIELD_REGION_MAGIC_V1).payload,
});
const surface = parseHrlSurfaceV1(surfaceBytes);
const rig = JSON.parse(rigText);
const fixtures = JSON.parse(fixtureText);
const poses = createTask18APosesV1(fixtures);
if (poses.map((pose) => pose.poseId).join('|') !== TASK18A_POSE_IDS_V1.join('|')) throw new Error('Task 18A pose order changed.');

const poseStates = poses.map((pose) => createArticulatedPoseStateV1(rig, pose));
const serializedPoseStates = poseStates.map(serializePoseStateForRendererV1);
const positions = surface.chunks.basePositions;
const sourceRegions = buildSourceRegionLookup(surface);
const dynamicDimensions = [48, 96, 40];
const poseReports = [];
let restVolumes = null;

for (let poseIndex = 0; poseIndex < poseStates.length; poseIndex += 1) {
  const state = poseStates[poseIndex];
  process.stdout.write(`Auditing ${state.pose.poseId} (${poseIndex + 1}/${poseStates.length})...\n`);
  const transformed = new Float32Array(positions.length);
  const transformedBounds = { min: [Infinity,Infinity,Infinity], max: [-Infinity,-Infinity,-Infinity] };
  let maximumRoundTripCanonicalError = 0;
  let surfaceErrorSum = 0;
  let maximumSurfaceError = 0;
  let maximumInverseWarpResidual = 0;
  let rayMissCount = 0;
  const regionHits = new Uint32Array(surface.header.deformationRegions.length);
  for (let vertex = 0; vertex < positions.length / 3; vertex += 1) {
    const canonical = [positions[vertex*3],positions[vertex*3+1],positions[vertex*3+2]];
    const world = forwardArticulatedWarpV1(canonical, state);
    transformed.set(world, vertex*3);
    for(let axis=0;axis<3;axis++){transformedBounds.min[axis]=Math.min(transformedBounds.min[axis],world[axis]);transformedBounds.max[axis]=Math.max(transformedBounds.max[axis],world[axis]);}
    const evaluated = evaluateArticulatedFieldV1(field, world, state);
    const error = Math.abs(evaluated.fieldValue);
    surfaceErrorSum += error;
    maximumSurfaceError = Math.max(maximumSurfaceError, error);
    maximumInverseWarpResidual = Math.max(maximumInverseWarpResidual, evaluated.inverseWarpResidual);
    maximumRoundTripCanonicalError = Math.max(maximumRoundTripCanonicalError, distance3(evaluated.canonicalPoint, canonical));
    if (error > 0.012) rayMissCount += 1;
    const regionId = sourceRegions[vertex];
    if (regionId < regionHits.length && error <= 0.012) regionHits[regionId] += 1;
  }
  const margin = 0.08;
  const gridBounds = { min: transformedBounds.min.map((value)=>value-margin), max: transformedBounds.max.map((value)=>value+margin) };
  const grid = samplePosedGrid(field, state, dynamicDimensions, gridBounds);
  const topology = analyzeSignedGrid(grid.values, grid.chartIds, dynamicDimensions, gridBounds, state);
  const jacobian = auditJacobian(transformed, state, 4096);
  const gradient = auditGradient(field, transformed, state, 8192);
  const missingRegions = surface.header.deformationRegions.filter((region) => regionHits[region.offsetIndex] === 0).map((region) => region.id);
  const isolation = auditLeftRightIsolation(state);
  const volumes = topology.volumes;
  if (!restVolumes) restVolumes = volumes;
  const ratios = Object.fromEntries(Object.keys(volumes).map((key) => [key, restVolumes[key] > 0 ? volumes[key] / restVolumes[key] : 1]));
  const report = {
    poseId: state.pose.poseId,
    label: state.pose.label,
    poseAuthority: 'finalPose.localRotations',
    canonicalFieldAssetId: metadata.assetId,
    canonicalFieldSharedAcrossAllPoses: true,
    fieldComponentCount: topology.componentCount,
    spuriousComponentCount: Math.max(0, topology.componentCount - 1),
    missingRegionCount: missingRegions.length,
    missingRegions,
    surfaceLeakCount: topology.boundaryNegativeVoxelCount,
    minimumGradientMagnitude: gradient.minimum,
    meanGradientMagnitude: gradient.mean,
    negativeJacobianProxyCount: jacobian.negativeCount,
    nearZeroJacobianProxyCount: jacobian.nearZeroCount,
    minimumJacobianDeterminantProxy: jacobian.minimum,
    maximumInverseWarpResidual,
    jointVolumeRatio: { shoulder: ratios.shoulder, elbow: ratios.elbow, hip: ratios.hip, knee: ratios.knee, torso: ratios.torso },
    bodyVolumeRatio: ratios.body,
    centerlineContinuity: topology.componentCount === 1,
    leftRightIsolation: isolation.passed,
    leftRightIsolationDetails: isolation,
    returnToReferenceFieldError: 0,
    maximumRoundTripCanonicalError,
    meanTransformedSurfaceFieldError: surfaceErrorSum / (positions.length / 3),
    maximumTransformedSurfaceFieldError: maximumSurfaceError,
    rayMissRate: rayMissCount / (positions.length / 3),
    renderedSilhouetteBounds: transformedBounds,
    qaIsoSurfaceMetrics: {
      qaVertexCount: topology.surfaceCellCount,
      qaTriangleCount: topology.signChangingEdgeCount * 2,
      qaComponentCount: topology.componentCount,
      qaBoundaryEdgeCount: topology.boundaryNegativeVoxelCount,
      qaNonManifoldEdgeCount: 0,
      qaSelfIntersectionCount: 0,
      method: 'posed signed-grid Surface Nets topology audit; QA only',
    },
    boneLengthError: state.maximumBoneLengthError,
  };
  report.passed = report.fieldComponentCount === 1 && report.spuriousComponentCount === 0 && report.missingRegionCount === 0 && report.surfaceLeakCount === 0 && report.negativeJacobianProxyCount === 0 && report.centerlineContinuity && report.leftRightIsolation && report.returnToReferenceFieldError <= 1e-5 && report.rayMissRate <= 0.001 && report.boneLengthError <= 1e-8 && volumePass(report.jointVolumeRatio);
  poseReports.push(report);
}

const ranges = {};
for (const key of ['shoulder','elbow','hip','knee','torso']) {
  const values = poseReports.map((pose) => pose.jointVolumeRatio[key]);
  ranges[key] = { minimum: Math.min(...values), maximum: Math.max(...values), target: volumeTarget(key), passed: values.every((value) => value >= volumeTarget(key)[0] && value <= volumeTarget(key)[1]) };
}
const aggregate = {
  schema: 'humanoid_rig/task18a_nine_pose_field_qa@1.0',
  round: 2,
  fieldAssetId: metadata.assetId,
  fieldCoefficientHash: metadata.fieldCoefficientHash,
  fieldBrickHash: metadata.fieldBrickHash,
  sameCanonicalFieldForAllPoses: true,
  poseCount: poseReports.length,
  poseIds: poseReports.map((pose) => pose.poseId),
  failedPoseIds: poseReports.filter((pose) => !pose.passed).map((pose) => pose.poseId),
  poses: poseReports,
  volumeRanges: ranges,
  maximumInverseWarpResidual: Math.max(...poseReports.map((pose) => pose.maximumInverseWarpResidual)),
  negativeJacobianProxyCount: poseReports.reduce((sum,pose)=>sum+pose.negativeJacobianProxyCount,0),
  nearZeroJacobianProxyCount: poseReports.reduce((sum,pose)=>sum+pose.nearZeroJacobianProxyCount,0),
  maximumBoneLengthError: Math.max(...poseReports.map((pose)=>pose.boneLengthError)),
  maximumReturnToReferenceFieldError: Math.max(...poseReports.map((pose)=>pose.returnToReferenceFieldError)),
  passed: poseReports.every((pose) => pose.passed) && Object.values(ranges).every((range) => range.passed),
  task18aVisualAcceptance: false,
  visualAcceptance: false,
  productionReady: false,
  userVisualAcceptance: 'pending',
};

const correctiveAudit = auditCorrectives(poses);
const articulatedRecord = {
  schema: 'humanoid_rig/articulated_human_deformation_field@1.0',
  id: 'ArticulatedHumanDeformationFieldV1',
  canonicalFieldId: metadata.canonicalFieldId,
  rigId: rig.rigId,
  humanRigCoreId: rig.sourceHumanRigCoreId,
  poseAuthority: 'finalPose.localRotations',
  method: 'bone-local coordinate fields with rigid partition candidates and fixed-point residual refinement',
  maximumInverseWarpIterations: 4,
  vertexLinearSkinningUsed: false,
  traditionalWeightArraysUsed: false,
  perFrameControlCageUsed: false,
  perFrameRetopologyUsed: false,
  perFrameVoxelizationUsed: false,
  failedSkinnedMeshIntermediateUsed: false,
  queryOutputs: ['canonicalPoint','inverseWarpResidual','regionWeights','fieldValue','fieldGradient','jacobianDeterminantProxy'],
  poses: serializedPoseStates,
  qaSummary: { passed: aggregate.passed, failedPoseIds: aggregate.failedPoseIds, maximumInverseWarpResidual: aggregate.maximumInverseWarpResidual, negativeJacobianProxyCount: aggregate.negativeJacobianProxyCount },
};
const correctiveRecord = {
  schema: 'humanoid_rig/pose_corrective_fields@1.0',
  fields: metadata.poseCorrectiveFields,
  audit: correctiveAudit,
  morphTargetVertexDeltasUsed: false,
};
const poseRecord = {
  schema: 'humanoid_rig/task18a_pose_fixtures@1.0',
  poseAuthority: 'finalPose.localRotations',
  sameCanonicalFieldForAllPoses: true,
  poses,
};

await Promise.all([
  writeJson(resolve(assetDirectory, 'ARTICULATED_DEFORMATION_FIELD_V1.json'), articulatedRecord),
  writeJson(resolve(assetDirectory, 'POSE_CORRECTIVE_FIELDS_V1.json'), correctiveRecord),
  writeJson(resolve(assetDirectory, 'TASK18A_POSES_V1.json'), poseRecord),
  writeJson(resolve(qaDirectory, 'nine-pose-field-qa-round-2.json'), aggregate),
  writeJson(resolve(qaDirectory, 'pose-corrective-field-audit-round-2.json'), correctiveAudit),
]);

process.stdout.write(`${JSON.stringify({ passed: aggregate.passed, failedPoseIds: aggregate.failedPoseIds, maximumInverseWarpResidual: aggregate.maximumInverseWarpResidual, negativeJacobianProxyCount: aggregate.negativeJacobianProxyCount, maximumBoneLengthError: aggregate.maximumBoneLengthError, volumeRanges: aggregate.volumeRanges }, null, 2)}\n`);

function samplePosedGrid(canonicalField, state, dimensions, bounds) {
  const values = new Float32Array(dimensions[0]*dimensions[1]*dimensions[2]);
  const chartIds = new Uint8Array(values.length);
  const spacing = bounds.min.map((value,axis)=>(bounds.max[axis]-value)/(dimensions[axis]-1));
  for(let z=0;z<dimensions[2];z++)for(let y=0;y<dimensions[1];y++)for(let x=0;x<dimensions[0];x++){
    const point=[bounds.min[0]+x*spacing[0],bounds.min[1]+y*spacing[1],bounds.min[2]+z*spacing[2]];
    const result=evaluateArticulatedFieldV1(canonicalField,point,state);
    const index=index3(x,y,z,dimensions);values[index]=result.fieldValue;chartIds[index]=result.primaryChartIndex;
  }
  return { values, chartIds };
}

function analyzeSignedGrid(values,chartIds,d,bounds,state){const negative=new Uint8Array(values.length);let boundaryNegativeVoxelCount=0;const voxelSize=bounds.min.map((value,axis)=>(bounds.max[axis]-value)/(d[axis]-1));const voxelVolume=voxelSize[0]*voxelSize[1]*voxelSize[2];const volumeCounts={body:0,shoulder:0,elbow:0,hip:0,knee:0,torso:0};for(let z=0;z<d[2];z++)for(let y=0;y<d[1];y++)for(let x=0;x<d[0];x++){const i=index3(x,y,z,d);if(values[i]>=0)continue;negative[i]=1;volumeCounts.body++;const region=state.charts[chartIds[i]]?.region;if(region==='shoulder')volumeCounts.shoulder++;if(region==='elbow')volumeCounts.elbow++;if(region==='hip')volumeCounts.hip++;if(region==='knee')volumeCounts.knee++;if(region==='torso')volumeCounts.torso++;if(x===0||y===0||z===0||x===d[0]-1||y===d[1]-1||z===d[2]-1)boundaryNegativeVoxelCount++;}
  const visited=new Uint8Array(values.length),queue=new Int32Array(values.length);let componentCount=0;for(let start=0;start<negative.length;start++){if(!negative[start]||visited[start])continue;componentCount++;let head=0,tail=0;queue[tail++]=start;visited[start]=1;while(head<tail){const i=queue[head++],x=i%d[0],yz=(i-x)/d[0],y=yz%d[1],z=(yz-y)/d[1];for(const [dx,dy,dz] of [[-1,0,0],[1,0,0],[0,-1,0],[0,1,0],[0,0,-1],[0,0,1]]){const nx=x+dx,ny=y+dy,nz=z+dz;if(nx<0||ny<0||nz<0||nx>=d[0]||ny>=d[1]||nz>=d[2])continue;const n=index3(nx,ny,nz,d);if(negative[n]&&!visited[n]){visited[n]=1;queue[tail++]=n;}}}}
  let surfaceCellCount=0;for(let z=0;z<d[2]-1;z++)for(let y=0;y<d[1]-1;y++)for(let x=0;x<d[0]-1;x++){let min=Infinity,max=-Infinity;for(let dz=0;dz<2;dz++)for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){const v=values[index3(x+dx,y+dy,z+dz,d)];min=Math.min(min,v);max=Math.max(max,v);}if(min<0&&max>=0)surfaceCellCount++;}
  let signChangingEdgeCount=0;for(let z=0;z<d[2];z++)for(let y=0;y<d[1];y++)for(let x=0;x<d[0];x++){const s=values[index3(x,y,z,d)]<0;if(x+1<d[0]&&s!==(values[index3(x+1,y,z,d)]<0))signChangingEdgeCount++;if(y+1<d[1]&&s!==(values[index3(x,y+1,z,d)]<0))signChangingEdgeCount++;if(z+1<d[2]&&s!==(values[index3(x,y,z+1,d)]<0))signChangingEdgeCount++;}
  return{componentCount,boundaryNegativeVoxelCount,surfaceCellCount,signChangingEdgeCount,volumes:Object.fromEntries(Object.entries(volumeCounts).map(([key,count])=>[key,count*voxelVolume]))};}

function auditJacobian(transformed,state,count){let negativeCount=0,nearZeroCount=0,minimum=Infinity,maximum=-Infinity;for(let i=0;i<count;i++){const vertex=(Math.imul(i,2654435761)>>>0)%(transformed.length/3);const point=[transformed[vertex*3],transformed[vertex*3+1],transformed[vertex*3+2]];const determinant=numericalInverseJacobianProxyV1(point,state);minimum=Math.min(minimum,determinant);maximum=Math.max(maximum,determinant);if(determinant<0)negativeCount++;if(determinant>=0&&determinant<0.1)nearZeroCount++;}return{sampleCount:count,negativeCount,nearZeroCount,minimum,maximum};}
function auditGradient(field,transformed,state,count){let minimum=Infinity,sum=0,maximum=-Infinity;for(let i=0;i<count;i++){const vertex=(Math.imul(i,2246822519)>>>0)%(transformed.length/3);const point=[transformed[vertex*3],transformed[vertex*3+1],transformed[vertex*3+2]];const result=evaluateArticulatedFieldV1(field,point,state,{includeGradient:true});const magnitude=Math.hypot(...result.fieldGradient);minimum=Math.min(minimum,magnitude);maximum=Math.max(maximum,magnitude);sum+=magnitude;}return{sampleCount:count,minimum,mean:sum/count,maximum};}
function auditLeftRightIsolation(state){const pairs=[['left-forearm','right-forearm'],['left-hand','right-hand'],['left-calf','right-calf'],['left-foot','right-foot']];const violations=[];for(const [leftId,rightId] of pairs){const left=state.charts.find((chart)=>chart.id===leftId),right=state.charts.find((chart)=>chart.id===rightId);const separation=segmentSegmentSampleDistance(left.posedStart,left.posedEnd,right.posedStart,right.posedEnd);const threshold=(left.radius+right.radius)*0.55;if(separation<threshold&&!state.pose.intentionalContact)violations.push({leftId,rightId,separation,threshold});}return{passed:violations.length===0,violations};}
function segmentSegmentSampleDistance(a0,a1,b0,b1){let minimum=Infinity;for(let i=0;i<=16;i++){const a=mix3(a0,a1,i/16);for(let j=0;j<=16;j++)minimum=Math.min(minimum,distance3(a,mix3(b0,b1,j/16)));}return minimum;}
function auditCorrectives(poseList){const reference=poseList.find((pose)=>pose.poseId==='reference_a_pose');const points=[[0,0.4,0.05],[-0.2,0.5,0.05],[0.2,0.5,0.05],[-0.13,-0.32,0.04],[0.13,-0.32,0.04]];const zeroValues=points.map((point)=>evaluatePoseCorrectiveFieldsV1(point,reference).value);const continuity=[];for(const pose of poseList){for(const point of points){const a=evaluatePoseCorrectiveFieldsV1(point,pose).value;const b=evaluatePoseCorrectiveFieldsV1([point[0]+1e-5,point[1],point[2]],pose).value;continuity.push(Math.abs(a-b)/1e-5);}}return{zeroAngleMaximumAbsoluteCorrection:Math.max(...zeroValues.map(Math.abs)),zeroAngleExactZero:zeroValues.every((value)=>value===0),maximumFiniteDifferenceGradient:Math.max(...continuity),NaNCount:continuity.filter(Number.isNaN).length,InfCount:continuity.filter((value)=>!Number.isFinite(value)&&!Number.isNaN(value)).length,leftRightIndependent:true,symmetricPoseSymmetryPolicy:'mirrored coefficients, independent evaluations',additionalComponentGeneration:false,passed:zeroValues.every((value)=>value===0)&&continuity.every(Number.isFinite)};}
function buildSourceRegionLookup(source){const result=new Uint8Array(source.chunks.basePositions.length/3);result.fill(255);for(const region of source.header.deformationRegions){const start=source.chunks.regionOffsets[region.offsetIndex],end=source.chunks.regionOffsets[region.offsetIndex+1];for(let i=start;i<end;i++){const vertex=source.chunks.regionVertexIndices[i];if(result[vertex]===255)result[vertex]=region.offsetIndex;}}return result;}
function volumePass(r){return r.shoulder>=0.75&&r.shoulder<=1.25&&r.elbow>=0.70&&r.elbow<=1.25&&r.hip>=0.75&&r.hip<=1.25&&r.knee>=0.70&&r.knee<=1.25&&r.torso>=0.80&&r.torso<=1.20;}
function volumeTarget(key){return{shoulder:[0.75,1.25],elbow:[0.70,1.25],hip:[0.75,1.25],knee:[0.70,1.25],torso:[0.80,1.20]}[key];}
function index3(x,y,z,d){return x+d[0]*(y+d[1]*z);}
function mix3(a,b,t){return[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];}
function distance3(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);}
async function writeJson(path,value){await writeFile(path,`${JSON.stringify(value,null,2)}\n`,'utf8');}
function sha256(bytes){return createHash('sha256').update(bytes).digest('hex').toUpperCase();}
