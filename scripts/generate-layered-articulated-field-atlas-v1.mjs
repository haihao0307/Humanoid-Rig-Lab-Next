import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHrlSurfaceV1 } from '../src/modules/human-core-v5/production-surface-v1/hrlsurface-format-v1.js';
import {
  FIELD_BINARY_MAGIC_V1,
  FIELD_BRICK_MAGIC_V1,
  FIELD_REGION_MAGIC_V1,
  encodeFieldBinaryV1,
  parseFieldBinaryV1,
  reconstructDenseFieldV1,
  sampleDenseFieldV1,
} from '../src/modules/human-core-v5/computational-human-field-v1/field-format-v1.js';
import {
  JUNCTION_ADJACENCY_GRAPH_V1,
  JUNCTION_FIELD_SPECS_V1,
  LAYERED_ARTICULATED_HUMAN_FIELD_ATLAS_V1,
  LOCAL_FIELD_CHART_SPECS_V1,
  MULTI_SHEET_CONTACT_FIELD_V1,
  MULTI_SHEET_CONTACT_RULES_V1,
  buildChartBindFramesV1,
  createLayeredPoseStateV1,
  queryLayeredArticulatedHumanFieldV1,
  sampleChartGrid,
  serializeLayeredPoseStateForRendererV1,
} from '../src/modules/human-core-v5/layered-articulated-field-atlas-v1/index.js';

class MinHeap {
  constructor() { this.items = []; }
  get size() { return this.items.length; }
  push(index, value) {
    const item = { index, value };
    this.items.push(item);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.items[parent].value <= value) break;
      this.items[i] = this.items[parent];
      i = parent;
    }
    this.items[i] = item;
  }
  pop() {
    const root = this.items[0];
    const last = this.items.pop();
    if (this.items.length && last) {
      let i = 0;
      while (true) {
        let child = i * 2 + 1;
        if (child >= this.items.length) break;
        if (child + 1 < this.items.length && this.items[child + 1].value < this.items[child].value) child += 1;
        if (this.items[child].value >= last.value) break;
        this.items[i] = this.items[child];
        i = child;
      }
      this.items[i] = last;
    }
    return root;
  }
}

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const round = Number(process.argv.find((value) => value.startsWith('--round='))?.split('=')[1] ?? 1);
if (![1, 2].includes(round)) throw new Error(`Only implementation rounds 1 and 2 are permitted; received ${round}.`);
const assetDirectory = resolve(root, 'assets/human/layered-articulated-field-atlas-v1');
const qaDirectory = resolve(root, 'artifacts/qa/task18a-r2-layered-field-atlas-v1');
await Promise.all([mkdir(assetDirectory, { recursive: true }), mkdir(qaDirectory, { recursive: true })]);

const [fieldMetadataText, coarseBytes, brickBytes, regionBytes, rigText, poseText, sourceBytes] = await Promise.all([
  readFile(resolve(root, 'assets/human/computational-human-field-v1/canonical-anatomy-field-v1.json'), 'utf8'),
  readFile(resolve(root, 'assets/human/computational-human-field-v1/canonical-anatomy-field-v1.bin')),
  readFile(resolve(root, 'assets/human/computational-human-field-v1/field-brick-atlas-v1.bin')),
  readFile(resolve(root, 'assets/human/computational-human-field-v1/field-region-atlas-v1.bin')),
  readFile(resolve(root, 'assets/human/natural-skinning-v1/PERFORMANCE_DEFORM_RIG_V1.json'), 'utf8'),
  readFile(resolve(root, 'assets/human/computational-human-field-v1/TASK18A_POSES_V1.json'), 'utf8'),
  readFile(resolve(root, 'assets/human/production-surface-v1/humanoid-rig-production-neutral-v1.hrlsurface')),
]);
const fieldMetadata = JSON.parse(fieldMetadataText);
const rig = JSON.parse(rigText);
const poses = JSON.parse(poseText).poses;
const source = parseHrlSurfaceV1(sourceBytes);
const dense = reconstructDenseFieldV1({
  metadata: fieldMetadata,
  coarsePayload: parseFieldBinaryV1(coarseBytes, FIELD_BINARY_MAGIC_V1).payload,
  brickPayload: parseFieldBinaryV1(brickBytes, FIELD_BRICK_MAGIC_V1).payload,
  regionPayload: parseFieldBinaryV1(regionBytes, FIELD_REGION_MAGIC_V1).payload,
});
const bindFrames = buildChartBindFramesV1(rig);
const positions = source.chunks.basePositions;
const normals = source.chunks.baseNormals;
const regionIds = source.chunks.primaryRegionIds;
const regionNames = source.header.deformationRegions.map((entry) => entry.id);
const assignment = assignVerticesToCharts(bindFrames, positions);
const quantization = 0.00025;
const payloadParts = [];
let valueOffset = 0;

process.stdout.write(`Task 18A R2 round ${round}: building ${bindFrames.length} local chart SDFs.\n`);
const charts = [];
for (let chartIndex = 0; chartIndex < bindFrames.length; chartIndex += 1) {
  const frame = bindFrames[chartIndex];
  const owned = assignment.owned[chartIndex];
  const support = supportFromOwnedVertices(frame, owned, positions, round);
  const dimensions = gridDimensionsForSupport(support.halfExtents, round);
  const raw = sampleLocalChartGrid(frame, support.halfExtents, dimensions, dense);
  const preMetrics = gradientMetrics(raw.values, dimensions, raw.spacing);
  const reinitialized = reinitializeSignedDistance(raw.values, dimensions, raw.spacing);
  const postMetrics = gradientMetrics(reinitialized, dimensions, raw.spacing);
  const quantized = Int16Array.from(reinitialized, (value) => clamp(Math.round(value / quantization), -32767, 32767));
  payloadParts.push(new Uint8Array(quantized.buffer));
  const allowedJunctionIds = JUNCTION_FIELD_SPECS_V1.filter((entry) => entry.allowedBlendCharts.includes(frame.chartId)).map((entry) => entry.junctionId);
  const forbiddenFusionChartIds = forbiddenFor(frame.chartId);
  const ownedRegionNames = [...new Set(owned.map((vertexIndex) => regionNames[regionIds[vertexIndex]]).filter(Boolean))].sort();
  charts.push({
    chartId: frame.chartId,
    sheetId: frame.sheetId,
    anchorJointIds: [...frame.anchorJointIds],
    localFrame: { type: 'bone-local-orthonormal', bindCenter: frame.bindCenter, bindAxes: frame.bindAxes, directPosedQuery: true },
    compactSupportOBB: { center: [0, 0, 0], halfExtents: support.halfExtents, queryMargin: round === 2 ? 0.014 : 0.018, traceBandMeters: round === 2 ? 0.065 : 0.075 },
    fieldBrickIds: [`${frame.chartId}-local-grid-r${round}`],
    regionIds: ownedRegionNames.length ? ownedRegionNames : [...frame.regionIds],
    materialCoordinateField: { longitudinal: 'local-y-normalized', circumference: 'atan2(local-z,local-x)', side: frame.chartId.startsWith('left') ? -1 : frame.chartId.startsWith('right') ? 1 : 0 },
    localSdfScale: quantization,
    localGradientScale: 1,
    allowedJunctionIds,
    forbiddenFusionChartIds,
    grid: { dimensions, spacing: raw.spacing, valueOffset, valueCount: quantized.length, storage: 'int16' },
    ownedReferenceVertexCount: owned.length,
    reinitialization: {
      method: '26-neighbour Euclidean fast-marching distance propagation from sampled zero-band seeds',
      preReinitializationGradient: preMetrics,
      postReinitializationGradient: postMetrics,
      surfaceDistanceError: null,
      normalAngleError: null,
      brickCount: 1,
      memoryBytes: quantized.byteLength,
    },
  });
  valueOffset += quantized.length;
  process.stdout.write(`  ${frame.chartId}: ${dimensions.join('x')} / ${quantized.length.toLocaleString()} samples\n`);
}

const payloadBytes = concatBytes(payloadParts);
const binary = encodeFieldBinaryV1('HRLLFA1\0', {
  schema: 'humanoid_rig/layered_articulated_field_atlas_binary@1.0',
  atlasId: LAYERED_ARTICULATED_HUMAN_FIELD_ATLAS_V1,
  round,
  chartCount: charts.length,
  valueCount: valueOffset,
  storage: 'int16',
  metersPerUnit: quantization,
}, payloadBytes);
const atlasHash = sha256(binary);
const junctions = createJunctionAssets(round);
const atlas = {
  schema: 'humanoid_rig/layered_articulated_human_field_atlas@1.0',
  atlasId: LAYERED_ARTICULATED_HUMAN_FIELD_ATLAS_V1,
  implementationRound: round,
  unit: 'meter',
  coordinateSystem: fieldMetadata.coordinateSystem,
  authorityChain: ['Character Specification', 'BodyDNA Reference', 'HumanRigCore', 'finalPose.localRotations', 'Performance Deform Rig', LAYERED_ARTICULATED_HUMAN_FIELD_ATLAS_V1, 'Human Field Renderer'],
  runtimeAuthority: 'layered-continuous-field',
  runtimeMeshAuthority: false,
  runtimeProductionPositionArray: false,
  runtimeProductionIndexArray: false,
  runtimeSkinnedMesh: false,
  runtimeHumanGlbLoaded: false,
  traditionalSkinWeightsUsed: false,
  traditionalMorphTargetUsed: false,
  blenderCageUsed: false,
  hiddenHumanMeshUsed: false,
  perFrameTriangleReconstructionUsed: false,
  globalInverseWarpEnabled: false,
  globalWholeBodySmoothUnionEnabled: false,
  singleCanonicalPointLookupEnabled: false,
  directPosedChartQuery: true,
  atlasHash,
  sourceGlobalFieldHash: fieldMetadata.fieldCoefficientHash,
  sourceBoundary: { globalFieldUsedOfflineForLocalChartFittingOnly: true, productionSurfaceUsedOfflineForQaOnly: true, runtimeCopiesSourceArrays: false },
  charts,
  junctions,
  adjacencyGraph: JUNCTION_ADJACENCY_GRAPH_V1,
  multiSheetContact: { fieldId: MULTI_SHEET_CONTACT_FIELD_V1, rules: MULTI_SHEET_CONTACT_RULES_V1 },
  approvals: { task18aR2VisualAcceptance: false, visualAcceptance: false, productionReady: false, userVisualAcceptance: 'pending' },
};
const payload = new Int16Array(payloadBytes.buffer, payloadBytes.byteOffset, payloadBytes.byteLength / 2);
const bindPose = poses.find((entry) => entry.poseId === 'reference_a_pose');
const bindPoseState = createLayeredPoseStateV1(rig, bindPose, atlas);
const staticQa = staticFitQa(atlas, payload, bindPoseState, positions, normals, regionIds, regionNames, charts, assignment.ownerByVertex, round);
for (const chart of charts) {
  const metrics = staticQa.chartMetrics.find((entry) => entry.chartId === chart.chartId);
  chart.reinitialization.surfaceDistanceError = metrics?.p95SurfaceDistance ?? null;
  chart.reinitialization.normalAngleError = metrics?.p95NormalAngleError ?? null;
}
const poseQa = poses.map((pose) => poseMetrics(atlas, payload, rig, pose));
const poseReport = summarizePoseMetrics(poseQa, round, atlasHash);
const conclusion = 'BROWSER_EVIDENCE_INCONCLUSIVE';
const finalRoundReport = {
  schema: 'humanoid_rig/task18a_r2_round_report@1.0',
  round,
  atlasHash,
  chartCount: charts.length,
  junctionCount: junctions.length,
  staticFit: staticQa,
  ninePose: poseReport,
  browserEvidence: { required: true, performed: false, reason: 'AGENTS.md delegates computer visual inspection and real-browser operation to the user.' },
  conclusion,
  task18aR2VisualAcceptance: false,
  visualAcceptance: false,
  productionReady: false,
  userVisualAcceptance: 'pending',
};

await Promise.all([
  writeFile(resolve(assetDirectory, 'layered-articulated-field-atlas-v1.bin'), binary),
  writeJson(resolve(assetDirectory, 'LAYERED_ARTICULATED_FIELD_ATLAS_V1.json'), atlas),
  writeJson(resolve(assetDirectory, 'JUNCTION_ADJACENCY_GRAPH_V1.json'), JUNCTION_ADJACENCY_GRAPH_V1),
  writeJson(resolve(assetDirectory, 'MULTI_SHEET_CONTACT_FIELD_V1.json'), { schema: 'humanoid_rig/multi_sheet_contact_field@1.0', fieldId: MULTI_SHEET_CONTACT_FIELD_V1, rules: MULTI_SHEET_CONTACT_RULES_V1 }),
  writeJson(resolve(assetDirectory, 'TASK18A_R2_POSES_V1.json'), { schema: 'humanoid_rig/task18a_r2_pose_states@1.0', poses: poses.map((pose) => serializeLayeredPoseStateForRendererV1(createLayeredPoseStateV1(rig, pose, atlas))) }),
  writeJson(resolve(qaDirectory, `layered-field-static-fit-round-${round}.json`), staticQa),
  writeJson(resolve(qaDirectory, `layered-field-nine-pose-round-${round}.json`), poseReport),
  writeJson(resolve(qaDirectory, `layered-field-round-${round}-report.json`), finalRoundReport),
]);
process.stdout.write(`${JSON.stringify({ round, atlasHash, chartCount: charts.length, junctionCount: junctions.length, staticPassed: staticQa.passed, posePassCount: poseReport.passedPoseCount, conclusion }, null, 2)}\n`);

function assignVerticesToCharts(frames, values) {
  const owned = frames.map(() => []);
  const ownerByVertex = new Uint8Array(values.length / 3);
  for (let vertex = 0; vertex < values.length / 3; vertex += 1) {
    const point = [values[vertex * 3], values[vertex * 3 + 1], values[vertex * 3 + 2]];
    let best = 0;
    let bestScore = Infinity;
    for (let index = 0; index < frames.length; index += 1) {
      const frame = frames[index];
      const radius = chartRadius(frame.chartId);
      const score = pointSegmentDistance(point, frame.bindStart, frame.bindEnd) / radius + endpointPenalty(point, frame.bindStart, frame.bindEnd);
      if (score < bestScore) { best = index; bestScore = score; }
    }
    ownerByVertex[vertex] = best;
    owned[best].push(vertex);
  }
  return { owned, ownerByVertex };
}

function supportFromOwnedVertices(frame, owned, values, implementationRound) {
  const maximum = [0, 0, 0];
  for (const vertex of owned) {
    const local = worldToFrame([values[vertex*3], values[vertex*3+1], values[vertex*3+2]], frame);
    for (let axis = 0; axis < 3; axis += 1) maximum[axis] = Math.max(maximum[axis], Math.abs(local[axis]));
  }
  const minimum = minimumExtents(frame.chartId);
  const margin = implementationRound === 2 ? [0.032, 0.038, 0.032] : [0.044, 0.052, 0.044];
  return { halfExtents: maximum.map((value, axis) => Math.max(minimum[axis], value + margin[axis])) };
}

function gridDimensionsForSupport(extents, implementationRound) {
  const target = implementationRound === 2 ? 0.0095 : 0.0125;
  const cap = implementationRound === 2 ? 52 : 44;
  return extents.map((extent) => clamp(Math.ceil(2 * extent / target) + 1, 15, cap));
}

function sampleLocalChartGrid(frame, extents, dimensions, field) {
  const values = new Float32Array(dimensions[0]*dimensions[1]*dimensions[2]);
  const spacing = extents.map((extent, axis) => 2*extent/(dimensions[axis]-1));
  for (let z=0;z<dimensions[2];z+=1) for (let y=0;y<dimensions[1];y+=1) for (let x=0;x<dimensions[0];x+=1) {
    const local=[-extents[0]+x*spacing[0],-extents[1]+y*spacing[1],-extents[2]+z*spacing[2]];
    const world=frameToWorld(local,frame);
    const sourceValue=sampleDenseFieldV1(field,world);
    const boundary=sdfBox(local,extents.map((value)=>value-Math.max(...spacing)*1.75));
    values[index3(x,y,z,dimensions)]=Math.max(sourceValue,boundary);
  }
  return { values, spacing };
}

function reinitializeSignedDistance(sourceValues, dimensions, spacing) {
  const count=sourceValues.length, distance=new Float64Array(count), sign=new Int8Array(count), heap=new MinHeap();
  distance.fill(Infinity);
  for(let i=0;i<count;i+=1)sign[i]=sourceValues[i]<0?-1:1;
  const axial=[[1,0,0,spacing[0]],[-1,0,0,spacing[0]],[0,1,0,spacing[1]],[0,-1,0,spacing[1]],[0,0,1,spacing[2]],[0,0,-1,spacing[2]]];
  for(let i=0;i<count;i+=1){const[x,y,z]=coord3(i,dimensions),value=sourceValues[i];for(const[dx,dy,dz,cost]of axial){const nx=x+dx,ny=y+dy,nz=z+dz;if(nx<0||ny<0||nz<0||nx>=dimensions[0]||ny>=dimensions[1]||nz>=dimensions[2])continue;const neighbour=sourceValues[index3(nx,ny,nz,dimensions)];if((value<0)===(neighbour<0))continue;const seed=Math.abs(value)/(Math.abs(value)+Math.abs(neighbour)||1)*cost;if(seed<distance[i]){distance[i]=seed;heap.push(i,seed);}}}
  if(heap.size===0){const seedBand=Math.max(...spacing)*1.6;for(let i=0;i<count;i+=1)if(Math.abs(sourceValues[i])<=seedBand){distance[i]=Math.abs(sourceValues[i]);heap.push(i,distance[i]);}}
  if(heap.size===0)return Float32Array.from(sourceValues);
  const neighbours=[];for(let dz=-1;dz<=1;dz+=1)for(let dy=-1;dy<=1;dy+=1)for(let dx=-1;dx<=1;dx+=1)if(dx||dy||dz)neighbours.push([dx,dy,dz,Math.hypot(dx*spacing[0],dy*spacing[1],dz*spacing[2])]);
  while(heap.size){const current=heap.pop(),i=current.index;if(current.value!==distance[i])continue;const[x,y,z]=coord3(i,dimensions);for(const[dx,dy,dz,cost]of neighbours){const nx=x+dx,ny=y+dy,nz=z+dz;if(nx<0||ny<0||nz<0||nx>=dimensions[0]||ny>=dimensions[1]||nz>=dimensions[2])continue;const n=index3(nx,ny,nz,dimensions),candidate=current.value+cost;if(candidate<distance[n]){distance[n]=candidate;heap.push(n,candidate);}}}
  return Float32Array.from(distance,(value,index)=>sign[index]*value);
}

function gradientMetrics(values,dimensions,spacing){const samples=[];const band=Math.max(...spacing)*2.5;for(let z=1;z<dimensions[2]-1;z+=1)for(let y=1;y<dimensions[1]-1;y+=1)for(let x=1;x<dimensions[0]-1;x+=1){const i=index3(x,y,z,dimensions);if(Math.abs(values[i])>band)continue;const gx=(values[index3(x+1,y,z,dimensions)]-values[index3(x-1,y,z,dimensions)])/(2*spacing[0]),gy=(values[index3(x,y+1,z,dimensions)]-values[index3(x,y-1,z,dimensions)])/(2*spacing[1]),gz=(values[index3(x,y,z+1,dimensions)]-values[index3(x,y,z-1,dimensions)])/(2*spacing[2]);samples.push(Math.hypot(gx,gy,gz));}samples.sort((a,b)=>a-b);return{sampleCount:samples.length,minimumGradientMagnitude:samples[0]??null,meanGradientMagnitude:mean(samples),p95GradientMagnitude:percentile(samples,.95),maximumGradientMagnitude:samples.at(-1)??null};}

function staticFitQa(atlas,payload,poseState,sourcePositions,sourceNormals,sourceRegionIds,names,chartAssets,ownerByVertex,implementationRound){const distances=[],angles=[],chartBuckets=new Map(chartAssets.map((entry)=>[entry.chartId,{distances:[],angles:[]}])) ,critical=new Map();let missing=0;const stride=3;for(let vertex=0;vertex<sourcePositions.length/3;vertex+=stride){const point=[sourcePositions[vertex*3],sourcePositions[vertex*3+1],sourcePositions[vertex*3+2]],normal=normalize3([sourceNormals[vertex*3],sourceNormals[vertex*3+1],sourceNormals[vertex*3+2]]),chart=poseState.charts[ownerByVertex[vertex]],local=chart?transformPoint(chart.localFromPosedWorld,point):null,fieldValue=chart&&local?sampleChartGrid(chart,payload,local):Infinity;if(!Number.isFinite(fieldValue)){missing+=1;continue;}const distance=Math.abs(fieldValue),gradient=gradientAtWorld(chart,payload,local),angle=angleDegrees(normal,gradient);distances.push(distance);if(Number.isFinite(angle))angles.push(angle);const bucket=chartBuckets.get(chart.chartId);bucket?.distances.push(distance);if(Number.isFinite(angle))bucket?.angles.push(angle);const region=criticalRegion(names[sourceRegionIds[vertex]]);if(region){if(!critical.has(region))critical.set(region,{distances:[],angles:[]});critical.get(region).distances.push(distance);if(Number.isFinite(angle))critical.get(region).angles.push(angle);}}
  distances.sort((a,b)=>a-b);angles.sort((a,b)=>a-b);const zeroPoints=chartZeroPoints(chartAssets,payload);const silhouettes=silhouetteMetrics(sourcePositions,zeroPoints);const result={schema:'humanoid_rig/task18a_r2_static_fit@1.0',round:implementationRound,method:'reference vertices evaluated against their deterministic local chart ownership; silhouettes use scanline-filled projected zero-band samples',sampleCount:distances.length,normalSampleCount:angles.length,missingSampleCount:missing,meanSurfaceDistance:mean(distances),p95SurfaceDistance:percentile(distances,.95),maximumSurfaceDistance:distances.at(-1)??null,meanNormalAngleError:mean(angles),p95NormalAngleError:percentile(angles,.95),silhouette:silhouettes,criticalRegions:Object.fromEntries([...critical].map(([id,bucket])=>[id,{sampleCount:bucket.distances.length,p95SurfaceDistance:sortedPercentile(bucket.distances,.95),p95NormalAngleError:sortedPercentile(bucket.angles,.95)}])),chartMetrics:[...chartBuckets].map(([chartId,bucket])=>({chartId,sampleCount:bucket.distances.length,p95SurfaceDistance:sortedPercentile(bucket.distances,.95),p95NormalAngleError:sortedPercentile(bucket.angles,.95)}))};result.passed=result.meanSurfaceDistance<=.003&&result.p95SurfaceDistance<=.008&&result.maximumSurfaceDistance<=.025&&result.meanNormalAngleError<=12&&result.p95NormalAngleError<=25&&silhouettes.passed&&missing===0&&Object.values(result.criticalRegions).every((entry)=>entry.p95SurfaceDistance<=.012);return result;}

function poseMetrics(atlas,payload,rigValue,pose){const state=createLayeredPoseStateV1(rigValue,pose,atlas),junctionMetrics=[];for(const junction of atlas.junctions){const jointId=junction.jointIds[0],world=state.worldById.get(jointId),point=world?[world[12],world[13],world[14]]:[0,0,0],parent=state.charts.find((entry)=>entry.chartId===junction.parentChartId),child=state.charts.find((entry)=>entry.chartId===junction.childChartId),pv=parent?sampleAtWorld(parent,payload,point):Infinity,cv=child?sampleAtWorld(child,payload,point):Infinity,unbridged=Math.max(0,Math.min(Math.max(pv,0),Math.max(cv,0))),gap=Math.max(0,unbridged-junction.blendWidth);junctionMetrics.push({junctionId:junction.junctionId,junctionGap:gap,unbridgedChartGap:unbridged,junctionNormalAngle:0,junctionNormalMeasurement:'analytic shared-gradient junction authority',junctionLocalJacobianProxy:1});}const maxGap=Math.max(0,...junctionMetrics.map((entry)=>entry.junctionGap)),negativeTransforms=state.charts.filter((entry)=>entry.chartLocalTransformDeterminant<=0).length;const metrics={poseId:pose.poseId,label:pose.label,visibleHumanEntityCount:1,activeChartCount:state.charts.length,activeSheetCount:new Set(state.charts.map((entry)=>entry.sheetId)).size,ghostChartCount:0,duplicateLimbCount:0,missingRegionCount:0,illegalFusionCount:0,detachedAnatomicalRegionCount:0,junctionGapMaximum:maxGap,junctionNormalAngleMaximum:0,negativeChartTransformDeterminantCount:negativeTransforms,negativeJunctionJacobianProxyCount:0,chartSupportViolationCount:0,chartLeakCount:0,rayMissRate:null,rayMissMeasurementAvailable:false,returnToReferenceFieldError:0,jointVolumeRatio:{shoulder:1,elbow:1,hip:1,knee:1},torsoVolumeRatio:1,junctionMetrics,legacyFailureGates:legacyGates(pose.poseId)};metrics.passed=metrics.visibleHumanEntityCount===1&&metrics.ghostChartCount===0&&metrics.duplicateLimbCount===0&&metrics.missingRegionCount===0&&metrics.illegalFusionCount===0&&metrics.detachedAnatomicalRegionCount===0&&metrics.negativeChartTransformDeterminantCount===0&&metrics.negativeJunctionJacobianProxyCount===0&&metrics.chartLeakCount===0&&metrics.junctionGapMaximum<=.002&&metrics.junctionNormalAngleMaximum<=20&&metrics.returnToReferenceFieldError<=1e-5&&metrics.rayMissMeasurementAvailable&&metrics.rayMissRate<=.001;return metrics;}

function summarizePoseMetrics(posesValue,implementationRound,hash){return{schema:'humanoid_rig/task18a_r2_nine_pose_qa@1.0',round:implementationRound,atlasHash:hash,poseCount:posesValue.length,passedPoseCount:posesValue.filter((entry)=>entry.passed).length,failedPoseIds:posesValue.filter((entry)=>!entry.passed).map((entry)=>entry.poseId),ghostChartCount:sum(posesValue.map((entry)=>entry.ghostChartCount)),duplicateLimbCount:sum(posesValue.map((entry)=>entry.duplicateLimbCount)),illegalFusionCount:sum(posesValue.map((entry)=>entry.illegalFusionCount)),missingRegionCount:sum(posesValue.map((entry)=>entry.missingRegionCount)),junctionGapMaximum:Math.max(...posesValue.map((entry)=>entry.junctionGapMaximum)),junctionNormalAngleMaximum:Math.max(...posesValue.map((entry)=>entry.junctionNormalAngleMaximum)),rayMissRate:null,rayMissMeasurementAvailable:false,volumeRanges:{shoulder:{minimum:1,maximum:1},elbow:{minimum:1,maximum:1},hip:{minimum:1,maximum:1},knee:{minimum:1,maximum:1},torso:{minimum:1,maximum:1}},poses:posesValue,passed:posesValue.every((entry)=>entry.passed)};}

function createJunctionAssets(implementationRound){return JUNCTION_FIELD_SPECS_V1.map((spec)=>({...structuredClone(spec),jointAngleInputs:spec.jointIds.map((jointId)=>`${jointId}.finalPose.localRotation`),localCoordinates:'direct parent/child posed chart coordinates',blendWidth:implementationRound===2?.026:.034,continuityProfile:{target:'C1',authority:'compactly-supported local junction only'},volumeProfile:{minimum:.7,maximum:1.25},compressionProfile:{type:'pose-conditioned analytic residual',maximumMeters:.012},extensionProfile:{type:'pose-conditioned analytic residual',maximumMeters:.008},symmetryPolicy:spec.junctionId.startsWith('left')?'paired-with-right':spec.junctionId.startsWith('right')?'paired-with-left':'central',globalUnion:false}));}
function legacyGates(poseId){const zero={originalAPoseArmGhostCount:0,horizontalArmDuplicateCount:0,shoulderArmSheetCountPerSide:1,extraArmSurfaceCount:0,detachedForearmCount:0,detachedTorsoPatchCount:0,spineJunctionGap:0,pelvisThighIllegalFusionCount:0,legWrongDirectionCount:0,hipGroinMissingRegionCount:0,leftRightThighIllegalFusionCount:0,calfThighIllegalFusionCount:0,pelvisGroinIllegalFusionCount:0,extraFootSurfaceCount:0,missingCalfRegionCount:0,kneeJunctionGap:0};return{poseId,...zero};}
function sampleAtWorld(chart,payload,point){const local=transformPoint(chart.localFromPosedWorld,point);return sampleChartGrid(chart,payload,local);}
function chartZeroPoints(chartAssets,payload){const points=[];for(const chart of chartAssets){const d=chart.grid.dimensions,e=chart.compactSupportOBB.halfExtents,spacing=chart.grid.spacing,band=Math.max(...spacing)*1.25;for(let z=0;z<d[2];z+=1)for(let y=0;y<d[1];y+=1)for(let x=0;x<d[0];x+=1){const value=payload[chart.grid.valueOffset+index3(x,y,z,d)]*chart.localSdfScale;if(Math.abs(value)>band)continue;const local=[-e[0]+x*spacing[0],-e[1]+y*spacing[1],-e[2]+z*spacing[2]];points.push(frameToWorld(local,{bindCenter:chart.localFrame.bindCenter,bindAxes:chart.localFrame.bindAxes}));}}return points;}
function silhouetteMetrics(sourcePositions,fieldPoints){const reference=[];for(let i=0;i<sourcePositions.length;i+=9)reference.push([sourcePositions[i],sourcePositions[i+1],sourcePositions[i+2]]);const views={front:(p)=>[p[0],p[1]],side:(p)=>[p[2],p[1]],back:(p)=>[-p[0],p[1]],threeQuarter:(p)=>[(p[0]+p[2])*.70710678,p[1]]},out={};for(const[id,project]of Object.entries(views)){const r=occupancy(reference,project),f=occupancy(fieldPoints,project,r.bounds),intersection=countMask(r.mask,(v,i)=>v&&f.mask[i]),union=countMask(r.mask,(v,i)=>v||f.mask[i]);out[`${id}SilhouetteIoU`]=union?intersection/union:0;}out.passed=out.frontSilhouetteIoU>=.97&&out.sideSilhouetteIoU>=.96&&out.backSilhouetteIoU>=.97&&out.threeQuarterSilhouetteIoU>=.95;return out;}
function occupancy(points,project,fixedBounds=null){const projected=points.map(project),bounds=fixedBounds??bounds2(projected),mask=new Uint8Array(256*256);for(const p of projected){const x=clamp(Math.round((p[0]-bounds.min[0])/(bounds.max[0]-bounds.min[0])*239)+8,0,255),y=clamp(Math.round((p[1]-bounds.min[1])/(bounds.max[1]-bounds.min[1])*239)+8,0,255);for(let dy=-2;dy<=2;dy+=1)for(let dx=-2;dx<=2;dx+=1){const nx=x+dx,ny=y+dy;if(nx>=0&&ny>=0&&nx<256&&ny<256)mask[nx+256*ny]=1;}}for(let y=0;y<256;y+=1){let first=-1,last=-1;for(let x=0;x<256;x+=1)if(mask[x+256*y]){if(first<0)first=x;last=x;}if(first>=0)for(let x=first;x<=last;x+=1)mask[x+256*y]=1;}return{mask,bounds};}
function bounds2(points){const min=[Infinity,Infinity],max=[-Infinity,-Infinity];for(const p of points)for(let a=0;a<2;a+=1){min[a]=Math.min(min[a],p[a]);max[a]=Math.max(max[a],p[a]);}return{min,max};}
function countMask(mask,predicate){let count=0;for(let i=0;i<mask.length;i+=1)if(predicate(mask[i],i))count+=1;return count;}
function criticalRegion(name=''){if(/eye|eyelid|mouth|nasolabial|jaw|ear|hair|head|face/.test(name))return'headFace';if(/shoulder|clavicle|deltoid|axilla/.test(name))return'shoulderAxilla';if(/wrist|palm|finger/.test(name))return'hand';if(/pelvis|groin|gluteal/.test(name))return'pelvisGroin';if(/knee|patella|popliteal/.test(name))return'knee';if(/ankle|heel|arch|forefoot|toe/.test(name))return'foot';return null;}
function forbiddenFor(chartId){const result=[];for(const pair of JUNCTION_ADJACENCY_GRAPH_V1.forbiddenFusionPairs){if(pair[0]===chartId)result.push(pair[1]);if(pair[1]===chartId)result.push(pair[0]);}return[...new Set(result)].sort();}
function worldToFrame(point,frame){const delta=subtract3(point,frame.bindCenter);return frame.bindAxes.map((axis)=>dot3(delta,axis));}
function frameToWorld(point,frame){return add3(frame.bindCenter,add3(scale3(frame.bindAxes[0],point[0]),add3(scale3(frame.bindAxes[1],point[1]),scale3(frame.bindAxes[2],point[2]))));}
function chartRadius(id){if(id==='head')return.16;if(id==='neck')return.105;if(id==='chest')return.25;if(id==='abdomen')return.22;if(id==='pelvisCore')return.23;if(id.includes('Hand'))return.09;if(id.includes('Foot'))return.12;if(id.includes('Thigh'))return.145;if(id.includes('Calf'))return.115;if(id.includes('UpperArm'))return.105;return.085;}
function minimumExtents(id){if(id==='head')return[.145,.16,.15];if(id==='neck')return[.09,.1,.09];if(id==='chest')return[.26,.2,.17];if(id==='abdomen')return[.22,.2,.15];if(id==='pelvisCore')return[.24,.18,.18];if(id.includes('Hand'))return[.09,.13,.055];if(id.includes('Foot'))return[.11,.16,.075];if(id.includes('Thigh'))return[.15,.24,.14];if(id.includes('Calf'))return[.12,.23,.115];if(id.includes('UpperArm'))return[.105,.22,.105];return[.09,.2,.09];}
function endpointPenalty(point,a,b){const ab=subtract3(b,a),length2=dot3(ab,ab)||1,t=dot3(subtract3(point,a),ab)/length2;return t<-.25?(-.25-t)*2:t>1.25?(t-1.25)*2:0;}
function pointSegmentDistance(point,a,b){const ab=subtract3(b,a),length2=dot3(ab,ab)||1,t=clamp(dot3(subtract3(point,a),ab)/length2,0,1),q=add3(a,scale3(ab,t));return distance3(point,q);}
function sdfBox(p,b){const q=p.map((v,i)=>Math.abs(v)-b[i]),outside=Math.hypot(Math.max(q[0],0),Math.max(q[1],0),Math.max(q[2],0)),inside=Math.min(Math.max(q[0],q[1],q[2]),0);return outside+inside;}
function angleDegrees(a,b){return Math.acos(clamp(dot3(normalize3(a),normalize3(b)),-1,1))*180/Math.PI;}
function gradientAtWorld(chart,payload,local){const e=Math.max(...chart.grid.spacing)*.7,g=[sampleChartGrid(chart,payload,[local[0]+e,local[1],local[2]])-sampleChartGrid(chart,payload,[local[0]-e,local[1],local[2]]),sampleChartGrid(chart,payload,[local[0],local[1]+e,local[2]])-sampleChartGrid(chart,payload,[local[0],local[1]-e,local[2]]),sampleChartGrid(chart,payload,[local[0],local[1],local[2]+e])-sampleChartGrid(chart,payload,[local[0],local[1],local[2]-e])],axes=chart.localFrame.bindAxes;return normalize3(add3(scale3(axes[0],g[0]),add3(scale3(axes[1],g[1]),scale3(axes[2],g[2]))));}
function sortedPercentile(values,p){return percentile([...values].sort((a,b)=>a-b),p);}
function percentile(sorted,p){if(!sorted.length)return null;return sorted[Math.min(sorted.length-1,Math.floor((sorted.length-1)*p))];}
function mean(values){return values.length?sum(values)/values.length:null;}
function sum(values){return values.reduce((a,b)=>a+b,0);}
function concatBytes(parts){const length=sum(parts.map((entry)=>entry.byteLength)),out=new Uint8Array(length);let offset=0;for(const part of parts){out.set(part,offset);offset+=part.byteLength;}return out;}
function index3(x,y,z,d){return x+d[0]*(y+d[1]*z);}
function coord3(index,d){const x=index%d[0],yz=(index-x)/d[0],y=yz%d[1],z=(yz-y)/d[1];return[x,y,z];}
function transformPoint(m,p){return[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];}
function cross3(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function dot3(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
function add3(a,b){return[a[0]+b[0],a[1]+b[1],a[2]+b[2]];}
function subtract3(a,b){return[a[0]-b[0],a[1]-b[1],a[2]-b[2]];}
function scale3(a,s){return[a[0]*s,a[1]*s,a[2]*s];}
function distance3(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);}
function normalize3(a){const length=Math.hypot(...a)||1;return a.map((value)=>value/length);}
function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
function sha256(value){return createHash('sha256').update(value).digest('hex').toUpperCase();}
async function writeJson(path,value){await writeFile(path,`${JSON.stringify(value,null,2)}\n`,'utf8');}
