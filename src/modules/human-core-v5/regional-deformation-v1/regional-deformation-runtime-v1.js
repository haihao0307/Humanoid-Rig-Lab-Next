import { blendDualQuaternions, transformPointByDualQuaternion } from '../natural-skinning-v1/math-v1.js';
import { buildVertexAdjacencyV1, buildTriangleRegionResolverV1 } from '../skinning-forensics-v1/forensics-metrics-v1.js';
import { buildRegionalDeformationCoordinatesV1 } from './regional-deformation-coordinates-v1.js';
import { createRegionalDeformationProfileV1, SPINE_LATTICE_RING_DEFINITIONS_V1 } from './regional-deformation-profile-v1.js';
import { applyElbowVolumeCorrectiveV1, applyKneeVolumeCorrectiveV1 } from './regional-deformation-volume-v1.js';
import { applyRegionalOrientationBarrierV1 } from './regional-deformation-barrier-v1.js';
import { applyRegionalCollisionBarrierV1 } from './regional-deformation-collision-v1.js';

export const HRL_REGIONAL_DEFORMATION_RUNTIME_V1_SCHEMA = 'humanoid_rig/regional_deformation_runtime@1.0';

export class HRLRegionalDeformationLayerV1 {
  constructor({ canonicalPositions, canonicalNormals, indices, surface, performanceRig, profile }) {
    this.canonicalPositions = canonicalPositions; this.canonicalNormals = canonicalNormals; this.indices = indices; this.surface = surface; this.performanceRig = performanceRig;
    this.profile = profile || createRegionalDeformationProfileV1(); this.paletteIndex = performanceRig.paletteIndex || Object.fromEntries(performanceRig.bonePaletteOrder.map((id, index) => [id, index]));
    this.coordinates = buildRegionalDeformationCoordinatesV1({ positions: canonicalPositions, surface, performanceRig }); this.adjacency = buildVertexAdjacencyV1(indices, canonicalPositions.length / 3); this.regionResolver = buildTriangleRegionResolverV1(surface);
    this.affectedMask = new Uint8Array(canonicalPositions.length / 3); for (const vertices of Object.values(this.coordinates.groups)) for (const vertex of vertices) this.affectedMask[vertex] = 1;
  }

  deform({ basePositions, baseNormals, frame, pose, previousPositions, enableBarriers = true, enableCollisionBarrier = true }) {
    const desired = new Float32Array(basePositions); const previous = previousPositions ? new Float32Array(previousPositions) : new Float32Array(basePositions);
    const spine = this.applySpineTorsoDeformer(desired, frame); const pelvis = this.applyPelvisHipGroinDeformer(desired, frame, pose);
    const elbow = applyElbowVolumeCorrectiveV1({ positions: desired, coordinates: this.coordinates, frame, pose, profile: this.profile });
    const knee = applyKneeVolumeCorrectiveV1({ positions: desired, coordinates: this.coordinates, frame, pose, profile: this.profile });
    let positions = desired; let orientation = disabledBarrier('RegionalOrientationBarrierV1'); let collision = disabledBarrier('RegionalCollisionBarrierV1'); let postCollisionOrientation = disabledBarrier('RegionalOrientationBarrierV1:post-collision');
    if (enableBarriers) {
      const oriented = applyRegionalOrientationBarrierV1({ restPositions: this.canonicalPositions, previousPositions: previous, candidatePositions: positions, indices: this.indices, affectedMask: this.affectedMask, adjacency: this.adjacency, profile: this.profile }); positions = oriented.outputPositions; orientation = oriented.metrics;
      if (enableCollisionBarrier) { const separated = applyRegionalCollisionBarrierV1({ previousPositions: previous, candidatePositions: positions, indices: this.indices, affectedMask: this.affectedMask, adjacency: this.adjacency, regionResolver: this.regionResolver, intentionalContact: Boolean(pose.intentionalContact), profile: this.profile }); positions = separated.outputPositions; collision = separated.metrics; }
      const reoriented = applyRegionalOrientationBarrierV1({ restPositions: this.canonicalPositions, previousPositions: previous, candidatePositions: positions, indices: this.indices, affectedMask: this.affectedMask, adjacency: this.adjacency, profile: this.profile }); positions = reoriented.outputPositions; postCollisionOrientation = reoriented.metrics;
    }
    const normals = recomputeVertexNormals(positions, this.indices); const latticeDebug = { spine: this.poseSpineLattice(frame), pelvisHipGroin: this.posePelvisLattice(frame) };
    return { schema: HRL_REGIONAL_DEFORMATION_RUNTIME_V1_SCHEMA, runtimeId: 'HRLRegionalDeformationLayerV1', positions, normals, basePositions, baseNormals, poseId: pose.poseId, indexTopologyModified: false, canonicalVertexIdentityModified: false, finalPoseWritten: false, coreRigModified: false, visibleSurfaceCount: 1, hiddenLatticeVisible: false, metrics: { spine, pelvisHipGroin: pelvis, elbow, knee, orientationBarrier: orientation, collisionBarrier: collision, postCollisionOrientationBarrier: postCollisionOrientation }, latticeDebug };
  }

  applySpineTorsoDeformer(output, frame) {
    let maximumCorrection = 0; let correctedVertexCount = 0; const ringIds = SPINE_LATTICE_RING_DEFINITIONS_V1.map((ring) => ring.boneId);
    for (const vertex of this.coordinates.groups.spineTorso) {
      const offset = vertex * 3; const segment = Math.min(ringIds.length - 2, this.coordinates.latticeCellId[vertex]); const t = this.coordinates.localCoordinates[offset];
      const target = this.transformByBones(read3(this.canonicalPositions, vertex), [[ringIds[segment], 1 - t], [ringIds[segment + 1], t]], frame); const base = read3(output, vertex); const weight = this.coordinates.blendWeight[vertex] * this.profile.spine.blendStrength; const blended = mix(base, target, weight);
      maximumCorrection = Math.max(maximumCorrection, distance(base, blended)); write3(output, vertex, blended); correctedVertexCount += 1;
    }
    return { deformerId: 'SpineTorsoDeformerV1', latticeId: 'SpineTorsoLatticeV1', correctedVertexCount, maximumCorrection, ringCount: this.coordinates.spineLattice.ringCount, controlsPerRing: this.coordinates.spineLattice.controlsPerRing, circumferenceCoordinateUsed: true, longitudinalCoordinateUsed: true, crossSectionRigidInterpolation: true };
  }

  applyPelvisHipGroinDeformer(output, frame, pose) {
    let maximumCorrection = 0; let correctedVertexCount = 0; let bridgeVertexCount = 0;
    for (const vertex of this.coordinates.groups.pelvisHipGroin) {
      const point = read3(this.canonicalPositions, vertex); const side = point[0] < -0.012 ? 'left' : point[0] > 0.012 ? 'right' : 'center'; const cell = this.coordinates.latticeCellId[vertex]; const weights = pelvisDriverWeights(side, cell, this.coordinates.localCoordinates[vertex * 3 + 1], this.profile.pelvisHipGroin);
      const target = this.transformByBones(point, weights, frame); const base = read3(output, vertex); const weight = this.coordinates.blendWeight[vertex] * this.profile.pelvisHipGroin.blendStrength; let blended = mix(base, target, weight);
      if (cell === 6 || cell === 7 || side === 'center') { bridgeVertexCount += 1; const pelvisTarget = this.transformByBones(point, [['pelvis', 1]], frame); blended = mix(blended, pelvisTarget, this.profile.pelvisHipGroin.bridgePelvisBias * weight); }
      const hipDegrees = Math.max(Math.abs(pose.regionalAngles?.leftUpperLeg?.bend || 0), Math.abs(pose.regionalAngles?.rightUpperLeg?.bend || 0)); if ((cell === 8 || cell === 9) && hipDegrees > 0) blended[2] -= this.profile.pelvisHipGroin.glutealStretch * Math.min(1, hipDegrees / 120) * weight;
      maximumCorrection = Math.max(maximumCorrection, distance(base, blended)); write3(output, vertex, blended); correctedVertexCount += 1;
    }
    return { deformerId: 'PelvisHipGroinDeformerV1', latticeId: 'PelvisHipGroinLatticeV1', correctedVertexCount, bridgeVertexCount, maximumCorrection, sectionCount: this.coordinates.pelvisLattice.sectionCount, asymmetricSidesIndependent: true, centerlineUnique: true };
  }

  transformByBones(point, weights, frame) {
    const entries = weights.filter(([, weight]) => weight > 1e-8).map(([id, weight]) => ({ weight, dualQuaternion: frame.dualQuaternions[this.paletteIndex[id]] })).filter((entry) => entry.dualQuaternion); const sum = entries.reduce((value, entry) => value + entry.weight, 0) || 1; for (const entry of entries) entry.weight /= sum;
    return entries.length ? transformPointByDualQuaternion(blendDualQuaternions(entries), point) : [...point];
  }

  poseSpineLattice(frame) { return { ...this.coordinates.spineLattice, rings: this.coordinates.spineLattice.rings.map((ring) => ({ ...ring, controls: ring.controls.map((control) => ({ ...control, posedPosition: this.transformByBones(control.restPosition, [[ring.boneId, 1]], frame) })) })) }; }
  posePelvisLattice(frame) { return { ...this.coordinates.pelvisLattice, sections: this.coordinates.pelvisLattice.sections.map((section) => ({ ...section, controls: section.controls.map((control) => ({ ...control, posedPosition: this.transformByBones(control.restPosition, section.driverIds.map((id) => [id, 1 / section.driverIds.length]), frame) })) })) }; }
}

function pelvisDriverWeights(side, cell, longitudinal, profile) {
  if (side === 'center' || cell === 0 || cell === 1 || cell === 6 || cell === 7) return [['pelvis', 1]];
  const prefix = side;
  const thigh = Math.max(0.18, Math.min(0.88, 0.34 + (1 - longitudinal) * 0.48)) * (profile.thighRootFollow || 0.78); const remaining = Math.max(0.08, 1 - thigh);
  if (cell === 4 || cell === 5) return [['pelvis', remaining * 0.22], [`${prefix}UpperLeg`, thigh * 0.56], [`${prefix}ThighTwist01`, thigh * 0.29], [`${prefix}ThighTwist02`, thigh * 0.15]];
  return [['pelvis', remaining], [`${prefix}UpperLeg`, thigh * 0.76], [`${prefix}ThighTwist01`, thigh * 0.24]];
}
function disabledBarrier(id) { return { barrierId: id, disabled: true, passed: true, finalViolationCount: 0, criticalSelfIntersectionCount: 0 }; }
function recomputeVertexNormals(positions, indices) { const normals = new Float32Array(positions.length); for (let offset = 0; offset < indices.length; offset += 3) { const a = indices[offset], b = indices[offset + 1], c = indices[offset + 2], pa = read3(positions, a), pb = read3(positions, b), pc = read3(positions, c); const normal = cross(subtract(pb, pa), subtract(pc, pa)); for (const vertex of [a, b, c]) { normals[vertex * 3] += normal[0]; normals[vertex * 3 + 1] += normal[1]; normals[vertex * 3 + 2] += normal[2]; } } for (let vertex = 0; vertex < normals.length / 3; vertex += 1) { const value = read3(normals, vertex); const length = Math.hypot(...value) || 1; write3(normals, vertex, value.map((component) => component / length)); } return normals; }
function read3(values, vertex) { const offset = vertex * 3; return [values[offset], values[offset + 1], values[offset + 2]]; }
function write3(values, vertex, point) { const offset = vertex * 3; values[offset] = point[0]; values[offset + 1] = point[1]; values[offset + 2] = point[2]; }
function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function subtract(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function distance(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
