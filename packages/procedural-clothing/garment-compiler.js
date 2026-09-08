import { PAYLOAD_SCHEMA, REGION_NAMES } from './constants.js';
import {
  canonicalStringify,
  hashString32,
  hashTypedArrays32,
  hex32,
} from './math.js';
import { buildCrewShirtPatternGraph } from './pattern-graph.js';
import { compileMaterialUniformBlock } from './material-dna.js';
import { assertProceduralOnly } from './originality-guard.js';
import { generateCrewShirtGeometry } from './garment-geometry.js';

function validateArrayLengths(payload) {
  const vertexCount = payload.positions.length / 3;
  const checks = [
    ['normals', payload.normals.length, vertexCount * 3],
    ['materialCoords', payload.materialCoords.length, vertexCount * 2],
    ['regionIds', payload.regionIds.length, vertexCount],
    ['skinJoints', payload.skinJoints.length, vertexCount * 4],
    ['skinWeights', payload.skinWeights.length, vertexCount * 4],
    ['inverseMass', payload.inverseMass.length, vertexCount],
    ['followWeights', payload.followWeights.length, vertexCount],
  ];
  for (const [name, actual, expected] of checks) {
    if (actual !== expected) throw new Error(`${name} length ${actual} does not match ${expected}`);
  }
  if (payload.indices.length % 3 !== 0) throw new Error('indices length must be divisible by three');
  if (payload.seamPairs.length % 2 !== 0) throw new Error('seamPairs length must be divisible by two');
}

export function validateGarmentPayload(payload) {
  if (!payload || typeof payload !== 'object') throw new TypeError('payload must be an object');
  if (payload.schema !== PAYLOAD_SCHEMA) throw new RangeError(`Unsupported payload schema: ${payload.schema}`);
  const typedArrays = [
    'positions', 'normals', 'indices', 'skinJoints', 'skinWeights',
    'materialCoords', 'regionIds', 'seamPairs', 'stretchEdges',
    'restLengths', 'inverseMass', 'followWeights', 'materialUniforms',
  ];
  for (const key of typedArrays) {
    if (!ArrayBuffer.isView(payload[key])) throw new TypeError(`${key} must be a TypedArray`);
  }
  validateArrayLengths(payload);
  const vertexCount = payload.positions.length / 3;
  for (let index = 0; index < payload.indices.length; index += 1) {
    if (payload.indices[index] >= vertexCount) throw new RangeError(`index ${payload.indices[index]} exceeds vertex count`);
  }
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    let weightSum = 0;
    for (let channel = 0; channel < 4; channel += 1) weightSum += payload.skinWeights[vertex * 4 + channel];
    if (Math.abs(weightSum - 1) > 1e-4) throw new Error(`skin weights for vertex ${vertex} sum to ${weightSum}`);
  }
  return true;
}

export function compileGarment(garmentDNA, bodyInput) {
  assertProceduralOnly(garmentDNA);
  const { bodyProfile, fitContract, patternGraph } = buildCrewShirtPatternGraph(garmentDNA, bodyInput);
  const geometry = generateCrewShirtGeometry(garmentDNA, fitContract, bodyProfile.jointTable);
  const payload = {
    schema: PAYLOAD_SCHEMA,
    formatVersion: 1,
    garmentId: garmentDNA.garmentId,
    garmentRevision: garmentDNA.revision,
    garmentHash: garmentDNA.contentHash,
    materialId: garmentDNA.materialDNA.id,
    materialRevision: garmentDNA.materialDNA.revision,
    materialHash: garmentDNA.materialDNA.contentHash,
    subjectId: bodyProfile.subjectId,
    proportionRevision: bodyProfile.proportionRevision,
    bodyHash: bodyProfile.contentHash,
    fitContract,
    patternGraphHash: patternGraph.contentHash,
    jointTable: bodyProfile.jointTable,
    regionTable: REGION_NAMES,
    topology: {
      vertexCount: geometry.positions.length / 3,
      triangleCount: geometry.indices.length / 3,
      structuralEdgeCount: geometry.stretchEdges.length / 2,
      seamPairCount: geometry.seamPairs.length / 2,
      stableAcrossBodyProfiles: true,
    },
    runtimeContract: {
      matrixLayout: 'column_major_4x4',
      matrixMeaning: 'final_joint_world_times_inverse_bind',
      poseAuthority: 'simulationRig.finalPose',
      bodyMutationAllowed: false,
      collisionInput: 'optional_body_surface_sampler_or_sdf',
    },
    ...geometry,
    materialUniforms: compileMaterialUniformBlock(garmentDNA.materialDNA),
  };
  validateGarmentPayload(payload);
  const metadataForHash = {
    schema: payload.schema,
    garmentHash: payload.garmentHash,
    materialHash: payload.materialHash,
    bodyHash: payload.bodyHash,
    fitHash: payload.fitContract.contentHash,
    patternGraphHash: payload.patternGraphHash,
    jointTable: payload.jointTable,
    topology: payload.topology,
    runtimeContract: payload.runtimeContract,
  };
  const metadataHash = hashString32(canonicalStringify(metadataForHash));
  const dataHash = hashTypedArrays32([
    payload.positions, payload.normals, payload.indices, payload.skinJoints,
    payload.skinWeights, payload.materialCoords, payload.regionIds,
    payload.seamPairs, payload.stretchEdges, payload.restLengths,
    payload.inverseMass, payload.followWeights, payload.materialUniforms,
  ], metadataHash);
  payload.contentHash = `fnv1a32:${hex32(dataHash)}`;
  payload.topologySignature = `fnv1a32:${hex32(hashTypedArrays32([payload.indices, payload.regionIds]))}`;
  assertProceduralOnly({
    schema: payload.schema,
    garmentId: payload.garmentId,
    materialId: payload.materialId,
    jointTable: payload.jointTable,
    runtimeContract: payload.runtimeContract,
  });
  return payload;
}
