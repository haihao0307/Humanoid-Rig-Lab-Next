import { createBodyFieldDefinitionV5, assertBodyFieldDefinitionV5 } from './body-field-definition-v5.js';
import { createComposedBodyFieldEvaluator } from './anatomical-field-composition-v5.js';

export class BodyFieldCompilerV5 {
  compile(input = {}) {
    const definition = createBodyFieldDefinitionV5(input);
    return createCanonicalBodyFieldV5(definition);
  }
}
export function createCanonicalBodyFieldV5(definitionInput) {
  const definition = structuredClone(definitionInput);
  assertBodyFieldDefinitionV5(definition);
  const evaluate = createComposedBodyFieldEvaluator(definition);
  return Object.freeze({
    schema: 'humanoid_rig/canonical_body_field@5.0',
    type: 'CanonicalBodyField',
    definition,
    fingerprint: definition.fingerprint,
    sample(point, options) {
      if (!Array.isArray(point) || point.length !== 3
        || !Number.isFinite(Number(point[0]))
        || !Number.isFinite(Number(point[1]))
        || !Number.isFinite(Number(point[2]))) {
        throw new Error('CanonicalBodyField sample point must be a finite vec3.');
      }
      const numericPoint = typeof point[0] === 'number'
        && typeof point[1] === 'number'
        && typeof point[2] === 'number'
        ? point
        : [Number(point[0]), Number(point[1]), Number(point[2])];
      return evaluate(numericPoint, options);
    },
  });
}
