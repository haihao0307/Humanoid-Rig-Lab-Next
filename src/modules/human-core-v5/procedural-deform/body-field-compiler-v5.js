import { createBodyFieldDefinitionV5, assertBodyFieldDefinitionV5 } from './body-field-definition-v5.js';
import { evaluateComposedBodyField } from './anatomical-field-composition-v5.js';

export class BodyFieldCompilerV5 {
  compile(input = {}) {
    const definition = createBodyFieldDefinitionV5(input);
    return createCanonicalBodyFieldV5(definition);
  }
}
export function createCanonicalBodyFieldV5(definitionInput) {
  const definition = structuredClone(definitionInput);
  assertBodyFieldDefinitionV5(definition);
  return Object.freeze({
    schema: 'humanoid_rig/canonical_body_field@5.0',
    type: 'CanonicalBodyField',
    definition,
    fingerprint: definition.fingerprint,
    sample(point, options) {
      if (!Array.isArray(point) || point.length !== 3 || point.some((value) => !Number.isFinite(Number(value)))) {
        throw new Error('CanonicalBodyField sample point must be a finite vec3.');
      }
      return evaluateComposedBodyField(definition, point.map(Number), options);
    },
  });
}
