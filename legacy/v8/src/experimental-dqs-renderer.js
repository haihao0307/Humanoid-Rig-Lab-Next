import {
  deformSurfaceDqs as deformSurfaceDqsReference,
  skinMatricesToDualQuaternions as convertSkinMatricesToDualQuaternions,
} from './smpl-skin.js';

export const EXPERIMENTAL_DQS_RENDERER = Object.freeze({
  id: 'experimental-dqs-reference-v1',
  status: 'experimental',
  defaultRenderer: false,
  defaultSkinningMode: 'lbs',
  input: Object.freeze(['restPositions', 'restNormals', 'skinIndices', 'skinWeights', 'boneTransforms']),
  output: Object.freeze(['positions', 'normals']),
});

export class ExperimentalDqsRenderer {
  constructor({ enabled = false } = {}) {
    this.enabled = Boolean(enabled);
  }

  deform({
    restPositions,
    restNormals,
    skinIndices,
    skinWeights,
    boneTransforms,
    outputPositions = new Float32Array(restPositions?.length || 0),
    outputNormals = new Float32Array(restNormals?.length || restPositions?.length || 0),
  }) {
    if (!this.enabled) throw new Error('Experimental DQS renderer must be explicitly enabled.');
    const dualQuaternions = skinMatricesToDualQuaternions(boneTransforms);
    deformVerticesDqs(
      restPositions,
      restNormals,
      outputPositions,
      outputNormals,
      skinIndices,
      skinWeights,
      dualQuaternions,
    );
    return { positions: outputPositions, normals: outputNormals, dualQuaternions };
  }
}

export function skinMatricesToDualQuaternions(boneTransforms, output) {
  return convertSkinMatricesToDualQuaternions(boneTransforms, output);
}

export function deformVerticesDqs(
  restPositions,
  restNormals,
  outputPositions,
  outputNormals,
  skinIndices,
  skinWeights,
  dualQuaternions,
) {
  return deformSurfaceDqsReference(
    restPositions,
    restNormals,
    outputPositions,
    outputNormals,
    skinIndices,
    skinWeights,
    dualQuaternions,
  );
}
