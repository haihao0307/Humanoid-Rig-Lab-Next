import { createBodyDNA } from '../body-dna-v5.js';
import { assertHumanRigCoreV5, cloneHumanRigCoreV5 } from '../human-rig-core-v5.js';
import { assertHumanAnatomyStateV5 } from '../human-anatomy-state-v5.js';
import { assertPoseFrameV4 } from '../../pose/pose-frame-v4.js';
import { BodyFieldCompilerV5 } from './body-field-compiler-v5.js';
import { extractStableProceduralSurfaceV5 } from './surface-extractor-v5.js';
import { createRegionDeformationDriverFrameV5 } from './region-deformation-driver-v5.js';
import { PROCEDURAL_DEFORM_POLICY_V5 } from './procedural-deform-policy-v5.js';
import { createProceduralDeformFrameV5 } from './procedural-deform-frame-v5.js';
import { assertDeformedSurfaceNormalGateV5, rebuildDeformedSurfaceNormalsV5 } from './deformed-surface-normals-v5.js';
import { analyzeProceduralSurfaceDeformationQualityV5 } from './procedural-surface-deformation-quality-v5.js';
import { ProceduralSurfaceWorkerClientV5 } from './procedural-surface-worker-client-v5.js';
import {
  applyJointCorrectiveFieldsV5,
  createJointCorrectiveFieldFrameV5,
  JOINT_CORRECTIVE_FIELD_IDS_V5,
} from './joint-corrective-fields-v5.js';

export class ProceduralDeformRuntimeV5 {
  constructor({ compiler = new BodyFieldCompilerV5() } = {}) {
    this.compiler = compiler;
    this.bodyDNA = null; this.rigCore = null; this.field = null; this.surface = null; this.frame = null;
    this.driverFrame = null; this.disposed = false; this.timings = []; this.generatedByWorker = false;
    this.expectedPositions = null; this.expectedNormals = null; this.lastNormalDiagnostics = null;
  }

  compileHuman({ bodyDNA = {}, rigCore, fieldOptions = {} } = {}) {
    this.assertActive();
    this.bodyDNA = createBodyDNA(bodyDNA);
    this.rigCore = cloneHumanRigCoreV5(rigCore);
    assertHumanRigCoreV5(this.rigCore);
    this.field = this.compiler.compile({ bodyDNA: this.bodyDNA, rigCore: this.rigCore, fieldOptions });
    this.surface = null; this.frame = null;
    this.driverFrame = null; this.expectedPositions = null; this.expectedNormals = null; this.lastNormalDiagnostics = null;
    return structuredClone(this.field.definition);
  }

  async generateCanonicalSurface({ resolution = 28, worker = true } = {}) {
    this.assertCompiled();
    if (worker) {
      const client = new ProceduralSurfaceWorkerClientV5();
      try {
        this.surface = await client.generate({ fieldDefinition: this.field.definition, resolution });
        this.generatedByWorker = client.usedWorker;
      } finally { client.dispose(); }
    } else {
      this.surface = extractStableProceduralSurfaceV5(this.field, { resolution });
      this.generatedByWorker = false;
    }
    return this.getSurfaceMetadata();
  }

  update({ finalPose, anatomyState, deltaTime = 1 / 60, timestamp = Date.now() } = {}) {
    this.assertReady();
    assertPoseFrameV4(finalPose);
    assertHumanAnatomyStateV5(anatomyState);
    if (finalPose.compatibleRig !== this.rigCore.sourceRig.compatibleRig) throw new Error('ProceduralDeformRuntime V5 received an incompatible finalPose Rig.');
    if (finalPose.proportionRevision !== this.bodyDNA.proportionRevision) throw new Error('ProceduralDeformRuntime V5 requires a surface regenerated for the finalPose proportion revision.');
    const started = performanceNow();
    this.driverFrame = createRegionDeformationDriverFrameV5({ finalPose, rigCore: this.rigCore, anatomyState, bodyDNA: this.bodyDNA, timestamp });
    const transforms = createRegionTransforms(this.field.definition, this.rigCore, finalPose);
    for (const transform of transforms.values()) transform.dual = dualQuaternionPart(transform.q, transform.t);
    const transformsByRegionIndex = this.surface.regionNames.map((regionName) => transforms.get(regionName) ?? IDENTITY_TRANSFORM);
    const correctionByRegionIndex = createRegionCorrectionContexts(
      this.field.definition,
      this.surface.regionNames,
      transformsByRegionIndex,
      this.driverFrame,
      anatomyState,
    );
    const jointCorrectiveFrame = createJointCorrectiveFieldFrameV5({
      surface: this.surface,
      fieldDefinition: this.field.definition,
      driverFrame: this.driverFrame,
      pelvisRotation: transforms.get('pelvis')?.q ?? finalPose.rootRotation,
    });
    const positions = new Float32Array(this.surface.positions.length);
    const expectedPositions = new Float32Array(this.surface.positions.length);
    const expectedNormals = new Float32Array(this.surface.normals.length);
    const regionDiagnostics = Object.fromEntries([...transforms].map(([regionName, transform]) => {
      const region = this.field.definition.regions.find((item) => item.regionId === regionName);
      const bindAnchor = primitiveAnchor(region.primitive, regionName, this.field.definition.canonicalLayout);
      return [regionName, {
        vertexCount: 0,
        bindAnchor,
        posedAnchor: add(rotate(transform.q, bindAnchor), transform.t),
        rotation: [...transform.q],
      }];
    }));
    for (let vertex = 0; vertex < this.surface.positions.length / 3; vertex += 1) {
      const blended = blendPreparedSurfaceVertex(this.surface, vertex, transformsByRegionIndex);
      const corrected = applyPreparedLocalImplicitCorrection(
        blended.position,
        this.surface.positions,
        vertex,
        correctionByRegionIndex[blended.primaryRegionIndex],
      );
      const positionOffset = vertex * 3;
      expectedPositions[positionOffset] = blended.position[0];
      expectedPositions[positionOffset + 1] = blended.position[1];
      expectedPositions[positionOffset + 2] = blended.position[2];
      const jointCorrected = applyJointCorrectiveFieldsV5({
        deformedPosition: corrected,
        canonicalPositions: this.surface.positions,
        surface: this.surface,
        vertex,
        correctiveFrame: jointCorrectiveFrame,
      });
      positions[positionOffset] = jointCorrected[0];
      positions[positionOffset + 1] = jointCorrected[1];
      positions[positionOffset + 2] = jointCorrected[2];
      expectedNormals[positionOffset] = blended.normal[0];
      expectedNormals[positionOffset + 1] = blended.normal[1];
      expectedNormals[positionOffset + 2] = blended.normal[2];
      const primary = this.surface.regionNames[blended.primaryRegionIndex] ?? 'upperTorso';
      regionDiagnostics[primary].vertexCount += 1;
    }
    const normalStarted = performanceNow();
    const normalResult = rebuildDeformedSurfaceNormalsV5({ deformedPositions: positions, indices: this.surface.indices });
    const normalRebuildDurationMs = performanceNow() - normalStarted;
    assertDeformedSurfaceNormalGateV5(normalResult.normalDiagnostics);
    this.expectedPositions = expectedPositions;
    this.expectedNormals = expectedNormals;
    this.lastNormalDiagnostics = { ...normalResult.normalDiagnostics, durationMs: normalRebuildDurationMs };
    this.frame = createProceduralDeformFrameV5({
      metadata: this.surface.metadata, deformedPositions: positions, deformedNormals: normalResult.deformedNormals,
      indices: this.surface.indices, regionIds: this.surface.regionIds, regionBlendWeights: this.surface.regionBlendWeights,
      regionDiagnostics,
      deformationDiagnostics: {
        deltaTime: Number(deltaTime) || 0,
        durationMs: 0,
        canonicalRecompute: true,
        accumulatedOffsets: false,
        policy: PROCEDURAL_DEFORM_POLICY_V5.policyId,
        correctionRegions: PROCEDURAL_DEFORM_POLICY_V5.localCorrectives,
        jointCorrectiveFields: {
          fieldIds: Object.values(JOINT_CORRECTIVE_FIELD_IDS_V5),
          deformOnly: true,
          activeHipFields: jointCorrectiveFrame.hipFields.map((field) => ({ ...field })),
        },
        normalRebuild: this.lastNormalDiagnostics,
      }, timestamp,
    });
    const elapsed = performanceNow() - started;
    this.frame.deformationDiagnostics.durationMs = elapsed;
    this.timings.push(elapsed); if (this.timings.length > 240) this.timings.shift();
    return this.getFrame();
  }

  getFrame() { return this.frame ? cloneFrame(this.frame) : null; }
  getSurfaceMetadata() { return this.surface ? structuredClone(this.surface.metadata) : null; }
  analyzeCurrentDeformationQuality({ detectSelfIntersections = true } = {}) {
    this.assertReady();
    if (!this.frame) throw new Error('ProceduralDeformRuntime V5 requires update() before deformation quality analysis.');
    return analyzeProceduralSurfaceDeformationQualityV5({
      canonicalPositions: this.surface.positions,
      deformedPositions: this.frame.deformedPositions,
      indices: this.surface.indices,
      expectedPositions: this.expectedPositions,
      expectedNormals: this.expectedNormals,
      regionIds: this.surface.regionIds,
      regionNames: this.surface.regionNames,
      detectSelfIntersections,
    });
  }
  getDiagnostics() {
    const sorted = [...this.timings].sort((a, b) => a - b);
    return {
      schema: 'humanoid_rig/procedural_deform_diagnostics@5.0',
      compiled: Boolean(this.field), surfaceReady: Boolean(this.surface), frameReady: Boolean(this.frame),
      fieldFingerprint: this.field?.fingerprint ?? null,
      surfaceCacheKey: this.surface?.metadata.cacheKey ?? null,
      topologyFingerprint: this.surface?.metadata.topologyFingerprint ?? null,
      poseAuthority: 'finalPose.localRotations', deformationPolicy: PROCEDURAL_DEFORM_POLICY_V5.policyId,
      generatedByWorker: this.generatedByWorker, glbDependency: false, rendererDependency: false,
      medianDeformationMs: percentile(sorted, 0.5), p95DeformationMs: percentile(sorted, 0.95),
      normalRebuild: this.lastNormalDiagnostics ? structuredClone(this.lastNormalDiagnostics) : null,
      visualAcceptance: false, productionReady: false,
    };
  }
  dispose() { this.bodyDNA = null; this.rigCore = null; this.field = null; this.surface = null; this.frame = null; this.driverFrame = null; this.expectedPositions = null; this.expectedNormals = null; this.lastNormalDiagnostics = null; this.disposed = true; }
  assertActive() { if (this.disposed) throw new Error('ProceduralDeformRuntime V5 is disposed.'); }
  assertCompiled() { this.assertActive(); if (!this.field) throw new Error('compileHuman() must run first.'); }
  assertReady() { this.assertCompiled(); if (!this.surface) throw new Error('generateCanonicalSurface() must run first.'); }
}

const IDENTITY_TRANSFORM = Object.freeze({ q: [0, 0, 0, 1], t: [0, 0, 0], dual: [0, 0, 0, 0] });
const REGION_DRIVER_MAP = Object.freeze({
  leftUpperArm: 'leftShoulder', rightUpperArm: 'rightShoulder', leftForearm: 'leftElbow', rightForearm: 'rightElbow',
  leftPalm: 'leftWrist', rightPalm: 'rightWrist', leftThigh: 'leftHip', rightThigh: 'rightHip',
  leftCalf: 'leftKnee', rightCalf: 'rightKnee', leftFoot: 'leftAnkle', rightFoot: 'rightAnkle',
  upperTorso: 'chest', lowerTorso: 'abdomen', pelvis: 'pelvis', neck: 'chest', head: 'chest',
});

function createRegionTransforms(definition, rigCore, pose) {
  const anchors = new Map();
  for (const region of definition.regions) anchors.set(region.sourceJointId, primitiveAnchor(region.primitive, region.regionId, definition.canonicalLayout));
  anchors.set('hips', definition.canonicalLayout.rigRootPosition ?? [0, definition.canonicalLayout.pelvisCenterY, 0]);
  const jointById = new Map(rigCore.joints.map((joint) => [joint.jointId, joint]));
  const regionBySourceJoint = new Map(definition.regions.map((region) => [region.sourceJointId, region]));
  const cache = new Map();
  function resolve(jointId) {
    if (cache.has(jointId)) return cache.get(jointId);
    const joint = jointById.get(jointId);
    const parentId = joint?.parentId ?? null;
    const bind = anchors.get(jointId) ?? (parentId ? anchors.get(parentId) : null) ?? anchors.get('hips');
    if (!parentId || jointId === pose.rootJointId) {
      const q = normalizeQuaternion(pose.rootRotation);
      const position = pose.rootPosition;
      const t = subtract(position, rotate(q, bind));
      const result = { q, t, posedAnchor: position, bindAnchor: bind };
      cache.set(jointId, result); return result;
    }
    const parent = resolve(parentId);
    const parentBind = anchors.get(parentId) ?? parent.bindAnchor;
    const localOffset = subtract(bind, parentBind);
    const posedAnchor = add(parent.posedAnchor, rotate(parent.q, localOffset));
    const localQ = normalizeQuaternion(pose.localRotations[jointId] ?? [0, 0, 0, 1]);
    const q = multiplyQuaternion(parent.q, localQ);
    const t = subtract(posedAnchor, rotate(q, bind));
    const sourceRegion = regionBySourceJoint.get(jointId);
    const virtualTwist = /Forearm$/.test(sourceRegion?.regionId ?? '')
      ? createContinuousLimbTwistContext({ parentQ: parent.q, posedAnchor, localQ, bindAnchor: bind, primitive: sourceRegion.primitive })
      : null;
    const result = { q, t, posedAnchor, bindAnchor: bind, virtualTwist };
    cache.set(jointId, result); return result;
  }
  const transforms = new Map();
  for (const region of definition.regions) transforms.set(region.regionId, resolve(region.sourceJointId));
  return transforms;
}

function primitiveAnchor(primitive, regionName, canonicalLayout) {
  if (primitive.start) return primitive.start;
  if (/Palm$/.test(regionName)) return [primitive.center[0] - Math.sign(primitive.center[0]) * primitive.radii[0], primitive.center[1], primitive.center[2]];
  if (/Foot$/.test(regionName)) return [primitive.center[0], canonicalLayout.ankleY, 0];
  return primitive.center;
}

function blendPreparedSurfaceVertex(surface, vertex, transformsByRegionIndex) {
  const positionOffset = vertex * 3;
  const influenceOffset = vertex * 4;
  const px = surface.positions[positionOffset];
  const py = surface.positions[positionOffset + 1];
  const pz = surface.positions[positionOffset + 2];
  const nx = surface.normals[positionOffset];
  const ny = surface.normals[positionOffset + 1];
  const nz = surface.normals[positionOffset + 2];
  let primaryRegionIndex = surface.regionIds[influenceOffset];
  let reference = transformsByRegionIndex[primaryRegionIndex]?.q ?? IDENTITY_TRANSFORM.q;
  let realX = 0; let realY = 0; let realZ = 0; let realW = 0;
  let dualX = 0; let dualY = 0; let dualZ = 0; let dualW = 0;
  let normalX = 0; let normalY = 0; let normalZ = 0;
  let influenceCount = 0;
  for (let influence = 0; influence < 4; influence += 1) {
    const offset = influenceOffset + influence;
    const weight = surface.regionBlendWeights[offset];
    if (weight <= 0) continue;
    const regionIndex = surface.regionIds[offset];
    const transform = resolveVertexInfluenceTransform(surface, vertex, influence, regionIndex, transformsByRegionIndex);
    if (influenceCount === 0) { primaryRegionIndex = regionIndex; reference = transform.q; }
    influenceCount += 1;
    const q = transform.q;
    const dual = transform.dual ?? IDENTITY_TRANSFORM.dual;
    const sign = q[0] * reference[0] + q[1] * reference[1] + q[2] * reference[2] + q[3] * reference[3] < 0 ? -1 : 1;
    const signedWeight = weight * sign;
    realX += q[0] * signedWeight; realY += q[1] * signedWeight; realZ += q[2] * signedWeight; realW += q[3] * signedWeight;
    dualX += dual[0] * signedWeight; dualY += dual[1] * signedWeight; dualZ += dual[2] * signedWeight; dualW += dual[3] * signedWeight;
    const rotatedNormal = rotateComponents(q[0], q[1], q[2], q[3], nx, ny, nz);
    normalX += rotatedNormal[0] * weight; normalY += rotatedNormal[1] * weight; normalZ += rotatedNormal[2] * weight;
  }
  if (!influenceCount) return { position: [px, py, pz], normal: [nx, ny, nz], primaryRegionIndex };
  const realLength = Math.hypot(realX, realY, realZ, realW) || 1;
  realX /= realLength; realY /= realLength; realZ /= realLength; realW /= realLength;
  dualX /= realLength; dualY /= realLength; dualZ /= realLength; dualW /= realLength;
  const rotatedPoint = rotateComponents(realX, realY, realZ, realW, px, py, pz);
  const translationX = 2 * (-dualW * realX + dualX * realW - dualY * realZ + dualZ * realY);
  const translationY = 2 * (-dualW * realY + dualX * realZ + dualY * realW - dualZ * realX);
  const translationZ = 2 * (-dualW * realZ - dualX * realY + dualY * realX + dualZ * realW);
  const normalLength = Math.hypot(normalX, normalY, normalZ) || 1;
  return {
    position: [rotatedPoint[0] + translationX, rotatedPoint[1] + translationY, rotatedPoint[2] + translationZ],
    normal: [normalX / normalLength, normalY / normalLength, normalZ / normalLength],
    primaryRegionIndex,
  };
}

const CONTINUOUS_LIMB_TWIST_STATIONS_V5 = Object.freeze([
  Object.freeze({ name: 'elbow', u: 0, twist: 0 }),
  Object.freeze({ name: 'proximal-forearm', u: 0.25, twist: 0.18 }),
  Object.freeze({ name: 'middle-forearm', u: 0.50, twist: 0.45 }),
  Object.freeze({ name: 'distal-forearm', u: 0.75, twist: 0.72 }),
  Object.freeze({ name: 'wrist', u: 1, twist: 1 }),
]);

function createContinuousLimbTwistContext({ parentQ, posedAnchor, localQ, bindAnchor, primitive }) {
  const axis = normalizeVector(subtract(primitive.end, primitive.start), [1, 0, 0]);
  const decomposition = decomposeSwingTwist(localQ, axis);
  return {
    policy: 'ContinuousLimbTwistFieldV5',
    validationOnlyJointCount: 0,
    stations: CONTINUOUS_LIMB_TWIST_STATIONS_V5,
    parentQ,
    posedAnchor,
    bindAnchor,
    swingQ: decomposition.swing,
    twistQ: decomposition.twist,
    twistActive: Math.hypot(decomposition.twist[0], decomposition.twist[1], decomposition.twist[2]) > 1e-8,
  };
}

function resolveVertexInfluenceTransform(surface, vertex, influence, regionIndex, transformsByRegionIndex) {
  const base = transformsByRegionIndex[regionIndex] ?? IDENTITY_TRANSFORM;
  if (!base.virtualTwist?.twistActive || !(surface.regionAxialU instanceof Float32Array)) return base;
  const rawU = surface.regionAxialU[vertex * 4 + influence];
  const twistAmount = interpolateTwistStations(rawU, base.virtualTwist.stations);
  const partialTwist = slerpQuaternion([0, 0, 0, 1], base.virtualTwist.twistQ, twistAmount);
  const localQ = normalizeQuaternion(multiplyQuaternion(base.virtualTwist.swingQ, partialTwist));
  const q = normalizeQuaternion(multiplyQuaternion(base.virtualTwist.parentQ, localQ));
  const t = subtract(base.virtualTwist.posedAnchor, rotate(q, base.virtualTwist.bindAnchor));
  return { q, t, dual: dualQuaternionPart(q, t) };
}

function interpolateTwistStations(value, stations) {
  const u = Math.min(1, Math.max(0, Number(value) || 0));
  for (let index = 1; index < stations.length; index += 1) {
    const right = stations[index];
    if (u > right.u) continue;
    const left = stations[index - 1];
    const t = (u - left.u) / Math.max(1e-9, right.u - left.u);
    return left.twist + (right.twist - left.twist) * t;
  }
  return stations.at(-1).twist;
}

function decomposeSwingTwist(qInput, axis) {
  const q = normalizeQuaternion(qInput);
  const projection = dotVector(q.slice(0, 3), axis);
  let twist = normalizeQuaternion([axis[0] * projection, axis[1] * projection, axis[2] * projection, q[3]]);
  if (dotQuaternion(twist, q) < 0) twist = twist.map((value) => -value);
  const swing = normalizeQuaternion(multiplyQuaternion(q, conjugate(twist)));
  return { swing, twist };
}

function slerpQuaternion(leftInput, rightInput, amount) {
  const left = normalizeQuaternion(leftInput);
  let right = normalizeQuaternion(rightInput);
  let cosine = dotQuaternion(left, right);
  if (cosine < 0) { right = right.map((value) => -value); cosine = -cosine; }
  if (cosine > 0.9995) return normalizeQuaternion(left.map((value, index) => value + (right[index] - value) * amount));
  const angle = Math.acos(Math.min(1, Math.max(-1, cosine)));
  const sine = Math.sin(angle);
  const leftWeight = Math.sin((1 - amount) * angle) / sine;
  const rightWeight = Math.sin(amount * angle) / sine;
  return left.map((value, index) => value * leftWeight + right[index] * rightWeight);
}

function createRegionCorrectionContexts(definition, regionNames, transformsByRegionIndex, driverFrame, anatomyState) {
  const anatomyBias = anatomyState.deformationSignal?.application?.writesMesh === false ? 1 : 0;
  const regionById = new Map(definition.regions.map((region) => [region.regionId, region]));
  return regionNames.map((regionName, regionIndex) => {
    const driver = driverFrame.regions[REGION_DRIVER_MAP[regionName]];
    if (!driver || !anatomyBias) return null;
    const region = regionById.get(regionName);
    const primitive = region.primitive;
    const center = primitive.center ?? [
      (primitive.start[0] + primitive.end[0]) * 0.5,
      (primitive.start[1] + primitive.end[1]) * 0.5,
      (primitive.start[2] + primitive.end[2]) * 0.5,
    ];
    const localClass = /UpperArm|Forearm|Palm|Thigh|Calf|Foot/.test(regionName);
    const motionActivation = Math.min(1, Math.hypot(driver.bend, driver.twist, driver.side) / (Math.PI / 2));
    const activationDelta = (driver.volume - 1) * (localClass ? 0.055 : 0.035) * motionActivation;
    const compressionDelta = -driver.compression * (/UpperArm|Thigh/.test(regionName) ? 0.018 : 0.012) * motionActivation;
    return { center, q: transformsByRegionIndex[regionIndex].q, activationDelta, compressionDelta };
  });
}

function applyPreparedLocalImplicitCorrection(deformed, bindPositions, vertex, context) {
  if (!context) return deformed;
  const offset = vertex * 3;
  const radialX = bindPositions[offset] - context.center[0];
  const radialY = bindPositions[offset + 1] - context.center[1];
  const radialZ = bindPositions[offset + 2] - context.center[2];
  const q = context.q;
  const correction = rotateComponents(
    q[0], q[1], q[2], q[3],
    radialX * context.activationDelta,
    radialY * context.compressionDelta,
    radialZ * context.activationDelta,
  );
  return [deformed[0] + correction[0], deformed[1] + correction[1], deformed[2] + correction[2]];
}

function rotateComponents(qx, qy, qz, qw, vx, vy, vz) {
  const tx = 2 * (qy * vz - qz * vy);
  const ty = 2 * (qz * vx - qx * vz);
  const tz = 2 * (qx * vy - qy * vx);
  return [
    vx + qw * tx + qy * tz - qz * ty,
    vy + qw * ty + qz * tx - qx * tz,
    vz + qw * tz + qx * ty - qy * tx,
  ];
}

function dualQuaternionPart(q, t) { return multiplyQuaternion([t[0], t[1], t[2], 0], q).map((value) => value * 0.5); }
function multiplyQuaternion(a, b) { return [a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1], a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0], a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3], a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]]; }
function conjugate(q) { return [-q[0], -q[1], -q[2], q[3]]; }
function rotate(q, v) { const result = multiplyQuaternion(multiplyQuaternion(q, [v[0], v[1], v[2], 0]), conjugate(q)); return result.slice(0, 3); }
function normalizeQuaternion(value) { const q = Array.from(value, Number); const l = Math.hypot(...q) || 1; return q.map((item) => item / l); }
function normalizeVector(value, fallback) { const length = Math.hypot(...value); return length > 1e-9 ? value.map((item) => item / length) : [...fallback]; }
function dotVector(a, b) { return a.reduce((sum, value, index) => sum + value * b[index], 0); }
function dotQuaternion(a, b) { return a.reduce((sum, value, index) => sum + value * b[index], 0); }
function add(a,b){return a.map((v,i)=>v+b[i]);} function subtract(a,b){return a.map((v,i)=>v-b[i]);}
function cloneFrame(frame) { return { ...frame, deformedPositions: new Float32Array(frame.deformedPositions), deformedNormals: new Float32Array(frame.deformedNormals), indices: new Uint32Array(frame.indices), regionIds: new Uint16Array(frame.regionIds), regionBlendWeights: new Float32Array(frame.regionBlendWeights), bounds: structuredClone(frame.bounds), regionDiagnostics: structuredClone(frame.regionDiagnostics), deformationDiagnostics: structuredClone(frame.deformationDiagnostics) }; }
function percentile(sorted, p) { if (!sorted.length) return null; return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))]; }
function performanceNow() { return globalThis.performance?.now?.() ?? Date.now(); }
