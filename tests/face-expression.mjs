import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  FACE_EXPRESSION_CHANNELS,
  FACE_EXPRESSION_SCHEMA,
  FaceEditor,
  createFaceAnalysisAdapter,
  createFaceExpressionRuntimeDescriptor,
  createFaceExpressionState,
  createFaceState,
  imageAnalysisResultToExpressionState,
  mirrorFaceExpression,
  normalizeFaceExpression,
  validateFaceExpression,
  validateFaceExpressionRuntimeDescriptor,
} from '../packages/face-system/index.js';
import { CharacterManager } from '../packages/character-core/index.js';
import { createDefaultState } from '../src/default-state.js';
import { normalizeProjectState } from '../src/state-schema.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const defaultExpression = createFaceExpressionState();
assert.equal(defaultExpression.schema, FACE_EXPRESSION_SCHEMA);
assert.equal(defaultExpression.expressionRevision, 1);
assert.deepEqual(Object.keys(defaultExpression.channels), [...FACE_EXPRESSION_CHANNELS]);
assert.ok(Object.values(defaultExpression.channels).every((value) => value === 0));

const normalized = normalizeFaceExpression({
  expressionRevision: 4,
  channels: { eyeBlinkLeft: 2, eyeBlinkRight: -1, jawOpen: '0.35' },
});
assert.equal(normalized.expressionRevision, 4);
assert.equal(normalized.channels.eyeBlinkLeft, 1);
assert.equal(normalized.channels.eyeBlinkRight, 0);
assert.equal(normalized.channels.jawOpen, 0.35);
const invalidRange = structuredClone(defaultExpression);
invalidRange.channels.jawOpen = 1.01;
assert.throws(() => validateFaceExpression(invalidRange), /between 0 and 1/);
assert.throws(
  () => createFaceExpressionState({ channels: { unknownChannel: 0.5 } }),
  /not part of the Face Expression contract/,
);

const asymmetric = createFaceExpressionState({
  channels: {
    eyeBlinkLeft: 0.1,
    eyeBlinkRight: 0.8,
    mouthSmileLeft: 0.25,
    mouthSmileRight: 0.9,
    jawLeft: 0.7,
    jawRight: 0.2,
    cheekSquintLeft: 0.4,
    cheekSquintRight: 0.6,
    browInnerUp: 0.55,
  },
});
const mirrored = mirrorFaceExpression(asymmetric);
assert.equal(mirrored.channels.eyeBlinkLeft, 0.8);
assert.equal(mirrored.channels.eyeBlinkRight, 0.1);
assert.equal(mirrored.channels.mouthSmileLeft, 0.9);
assert.equal(mirrored.channels.mouthSmileRight, 0.25);
assert.equal(mirrored.channels.jawLeft, 0.2);
assert.equal(mirrored.channels.jawRight, 0.7);
assert.equal(mirrored.channels.cheekSquintLeft, 0.6);
assert.equal(mirrored.channels.cheekSquintRight, 0.4);
assert.equal(mirrored.channels.browInnerUp, 0.55);
assert.equal(asymmetric.channels.eyeBlinkLeft, 0.1);

const runtimeDescriptor = createFaceExpressionRuntimeDescriptor(asymmetric);
assert.equal(runtimeDescriptor.expressionSchema, FACE_EXPRESSION_SCHEMA);
assert.equal(runtimeDescriptor.deformationMode, 'interface-only');
assert.equal(runtimeDescriptor.meshReference, null);
assert.deepEqual(runtimeDescriptor.morphTargets, []);
assert.deepEqual(runtimeDescriptor.correctiveTargets, []);
assert.equal(validateFaceExpressionRuntimeDescriptor(runtimeDescriptor), true);

const adapter = createFaceAnalysisAdapter({
  analyze: async () => ({ eyeBlinkLeft: 0.2, mouthSmileLeft: 0.5 }),
});
assert.equal(adapter.schema, 'humanoid_rig/face_analysis_adapter@1.0');
assert.equal(imageAnalysisResultToExpressionState({ eyeBlinkLeft: 0.2 }).channels.eyeBlinkLeft, 0.2);
assert.equal(adapter.toExpressionState({ mouthSmileLeft: 0.5 }).channels.mouthSmileLeft, 0.5);

const faceEditor = new FaceEditor();
const project = createDefaultState();
const expressionDraft = faceEditor.updateExpression(project.faceSystem, {
  channels: { mouthSmileLeft: 0.75, jawOpen: 0.4 },
}, { expected_revision: project.faceSystem.revision });
assert.equal(expressionDraft.expression.expressionRevision, 2);
const expressionSaved = faceEditor.saveExpressionVersion(expressionDraft, {
  expected_revision: expressionDraft.revision,
});
const characterManager = new CharacterManager();
const savedCharacter = characterManager.save(project.characterCore, {
  character_id: 'character_001',
  expression_revision: expressionSaved.expression.expressionRevision,
  expression_runtime_descriptor: expressionSaved.expression_runtime_descriptor,
}, { expected_revision: project.characterCore.revision });
assert.equal(savedCharacter.profile.expression_revision, 2);
assert.equal(savedCharacter.profile.expression_runtime_descriptor.expressionSchema, FACE_EXPRESSION_SCHEMA);
assert.equal(savedCharacter.state.versions.character_001.at(-1).profile.expression_revision, 2);

const legacy = structuredClone(project);
legacy.schemaVersion = 7;
delete legacy.characterCore.profiles.character_001.face_identity;
legacy.characterCore.profiles.character_001.face_revision = 0;
for (const versions of Object.values(legacy.characterCore.versions)) {
  for (const version of versions) {
    delete version.profile.face_identity;
    version.profile.face_revision = 0;
  }
}
delete legacy.faceSystem.expression;
delete legacy.faceSystem.expression_runtime_descriptor;
for (const profile of Object.values(legacy.characterCore.profiles)) {
  delete profile.expression_revision;
  delete profile.expression_runtime_descriptor;
}
for (const versions of Object.values(legacy.characterCore.versions)) {
  for (const version of versions) {
    delete version.profile.expression_revision;
    delete version.profile.expression_runtime_descriptor;
  }
}
const migrated = normalizeProjectState(legacy);
const migratedCharacter = migrated.characterCore.profiles.character_001;
assert.equal(migrated.schemaVersion, 11);
assert.equal(migrated.faceSystem.expression.expressionRevision, 1);
assert.equal(migratedCharacter.face_identity.face_id, 'face_001');
assert.equal(migratedCharacter.expression_revision, 1);
assert.equal(migratedCharacter.expression_runtime_descriptor.expressionSchema, FACE_EXPRESSION_SCHEMA);

const schema = JSON.parse(await readFile(join(root, 'schemas/face-expression.schema.json'), 'utf8'));
assert.equal(schema.additionalProperties, false);
assert.deepEqual(schema.$defs.channel, { type: 'number', minimum: 0, maximum: 1 });
assert.ok(schema.properties.channels.required.includes('jawOpen'));
const characterSchema = JSON.parse(await readFile(join(root, 'schemas/character-profile.schema.json'), 'utf8'));
assert.ok(characterSchema.properties.expression_revision);
assert.ok(characterSchema.properties.expression_runtime_descriptor);
const studioSource = await readFile(join(root, 'apps/character-studio/index.js'), 'utf8');
const facePanelSource = await readFile(join(root, 'apps/character-studio/panels/face-panel.js'), 'utf8');
assert.match(facePanelSource, /Expression Channels/);
assert.match(facePanelSource, /applyFaceExpression/);
assert.match(facePanelSource, /data-expression-channel/);
assert.match(studioSource, /expressionState/);

console.log('PASS FaceExpressionState default creation, channel normalization, validation, and mirror');
console.log('PASS Face expression runtime descriptor and image-analysis adapter interface');
console.log('PASS Face Expression CharacterProfile save and old CharacterProfile migration');
console.log('PASS Character Studio Face Expression Panel mount and ProjectHub integration contract');
