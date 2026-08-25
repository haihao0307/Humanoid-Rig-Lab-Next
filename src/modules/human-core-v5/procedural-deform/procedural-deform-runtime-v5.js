import { createBodyDNA } from '../body-dna-v5.js';
import { assertHumanRigCoreV5, cloneHumanRigCoreV5 } from '../human-rig-core-v5.js';
import { assertHumanAnatomyStateV5 } from '../human-anatomy-state-v5.js';
import { assertPoseFrameV4 } from '../../pose/pose-frame-v4.js';
import { BodyFieldCompilerV5 } from './body-field-compiler-v5.js';
import { extractStableProceduralSurfaceV5 } from './surface-extractor-v5.js';
import { createRegionDeformationDriverFrameV5 } from './region-deformation-driver-v5.js';
import { PROCEDURAL_DEFORM_POLICY_V5 } from './procedural-deform-policy-v5.js';
import { createProceduralDeformFrameV5 } from './procedural-deform-frame-v5.js';
import { ProceduralSurfaceWorkerClientV5 } from './procedural-surface-worker-client-v5.js';

export class ProceduralDeformRuntimeV5 {
  constructor({ compiler = new BodyFieldCompilerV5() } = {}) {
    this.compiler = compiler;
    this.bodyDNA = null; this.rigCore = null; this.field = null; this.surface = null; this.frame = null;
    this.driverFrame = null; this.disposed = false; this.timings = []; this.generatedByWorker = false;
  }

  compileHuman({ bodyDNA = {}, rigCore, fieldOptions = {} } = {}) {
    this.assertActive();
    this.bodyDNA = createBodyDNA(bodyDNA);
    this.rigCore = cloneHumanRigCoreV5(rigCore);
    assertHumanRigCoreV5(this.rigCore);
    this.field = this.compiler.compile({ bodyDNA: this.bodyDNA, rigCore: this.rigCore, fieldOptions });
    this.surface = null; this.frame = null;
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
    const positions = new Float32Array(this.surface.positions.length);
    const normals = new Float32Array(this.surface.normals.length);
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
      positions[positionOffset] = corrected[0];
      positions[positionOffset + 1] = corrected[1];
      positions[positionOffset + 2] = corrected[2];
      normals[positionOffset] = blended.normal[0];
      normals[positionOffset + 1] = blended.normal[1];
      normals[positionOffset + 2] = blended.normal[2];
      const primary = this.surface.regionNames[blended.primaryRegionIndex] ?? 'upperTorso';
      regionDiagnostics[primary].vertexCount += 1;
    }
    this.frame = createProceduralDeformFrameV5({
      metadata: this.surface.metadata, deformedPositions: positions, deformedNormals: normals,
      indices: this.surface.indices, regionIds: this.surface.regionIds, regionBlendWeights: this.surface.regionBlendWeights,
      regionDiagnostics,
      deformationDiagnostics: {
        deltaTime: Number(deltaTime) || 0,
        durationMs: 0,
        canonicalRecompute: true,
        accumulatedOffsets: false,
        policy: PROCEDURAL_DEFORM_POLICY_V5.policyId,
        correctionRegions: PROCEDURAL_DEFORM_POLICY_V5.localCorrectives,
      }, timestamp,
    });
    const elapsed = performanceNow() - started;
    this.frame.deformationDiagnostics.durationMs = elapsed;
    this.timings.push(elapsed); if (this.timings.length > 240) this.timings.shift();
    return this.getFrame();
  }

  getFrame() { return this.frame ? cloneFrame(this.frame) : null; }
  getSurfaceMetadata() { return this.surface ? structuredClone(this.surface.metadata) : null; }
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
      visualAcceptance: false, productionReady: false,
    };
  }
  dispose() { this.bodyDNA = null; this.rigCore = null; this.field = null; this.surface = null; this.frame = null; this.driverFrame = null; this.disposed = true; }
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
    const result = { q, t, posedAnchor, bindAnchor: bind };
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
    const transform = transformsByRegionIndex[regionIndex] ?? IDENTITY_TRANSFORM;
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
    const activationDelta = (driver.volume - 1) * (localClass ? 0.055 : 0.035);
    const compressionDelta = -driver.compression * (/UpperArm|Thigh/.test(regionName) ? 0.018 : 0.012);
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
function add(a,b){return a.map((v,i)=>v+b[i]);} function subtract(a,b){return a.map((v,i)=>v-b[i]);}
function cloneFrame(frame) { return { ...frame, deformedPositions: new Float32Array(frame.deformedPositions), deformedNormals: new Float32Array(frame.deformedNormals), indices: new Uint32Array(frame.indices), regionIds: new Uint16Array(frame.regionIds), regionBlendWeights: new Float32Array(frame.regionBlendWeights), bounds: structuredClone(frame.bounds), regionDiagnostics: structuredClone(frame.regionDiagnostics), deformationDiagnostics: structuredClone(frame.deformationDiagnostics) }; }
function percentile(sorted, p) { if (!sorted.length) return null; return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))]; }
function performanceNow() { return globalThis.performance?.now?.() ?? Date.now(); }
