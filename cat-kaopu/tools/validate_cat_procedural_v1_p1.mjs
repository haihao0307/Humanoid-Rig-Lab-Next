import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CAT_CALIBRATION_PROFILE_ID,
  CAT_PARAMETER_DEFINITIONS,
  DEFAULT_CAT_DNA,
  createCatSdf,
  deriveCatMetrics,
  deriveCatSections,
  deriveCatSkeleton,
  deriveTailPoints,
  normalizeCatDNA,
  validateCatDNA
} from '../procedural-cat-v1/src/cat-procedural-core.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const moduleRoot = path.resolve(here, '..');
const calibrationPath = path.join(moduleRoot, 'procedural-cat-v1', 'P1_AUTHORITATIVE_CALIBRATION.json');
const qaDir = path.join(moduleRoot, 'qa', 'procedural-cat-v1-p1');
fs.mkdirSync(qaDir, { recursive: true });

const calibration = JSON.parse(fs.readFileSync(calibrationPath, 'utf8'));
const dna = normalizeCatDNA(DEFAULT_CAT_DNA);
const validation = validateCatDNA(dna);
const metrics = deriveCatMetrics(dna);
const { anchors } = deriveCatSkeleton(dna);
const { sections } = deriveCatSections(dna);
const { points: tailPoints } = deriveTailPoints(dna);
const sdf = createCatSdf(dna);

assert.equal(CAT_CALIBRATION_PROFILE_ID, 'cat-procedural-body-v1-p1-calibration-20260918');
assert.equal(validation.valid, true, validation.errors.join('; '));
assert.equal(dna.meta.id, 'grey-tabby-a-p1');
assert.equal(dna.meta.revision, 2);
assert.ok(Object.keys(CAT_PARAMETER_DEFINITIONS).length >= 75);

const close = (actual, expected, tolerance, label) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} != ${expected} ± ${tolerance}`);
};

// Direct published measurements retained without reinterpretation.
close(dna.global.bodyLength, 0.475, 0.0006, 'head-body length calibration');
close(dna.global.shoulderHeight, 0.2525, 0.0006, 'shoulder height calibration');
close(dna.forelimb.scapulaLength, 0.0713, 0.0002, 'scapula length');
close(dna.forelimb.humerusLength, 0.0995, 0.0002, 'humerus length');
close(dna.forelimb.radiusLength, 0.0917, 0.0002, 'radius length');
close(dna.forelimb.metacarpalLength, 0.0333, 0.0002, 'carpal/metacarpal length');
close(dna.hindlimb.femurLength, 0.1315, 0.0030, 'femur length');
close(dna.hindlimb.tibiaLength, 0.11161, 0.0003, 'tibia length');

const bodyEvidence = calibration.sources.find((source) => source.id === 'paton-2024-body-size').evidence;
assert.ok(dna.global.bodyLength >= bodyEvidence.bodyLengthM.ci95[0] && dna.global.bodyLength <= bodyEvidence.bodyLengthM.ci95[1]);
assert.ok(dna.global.shoulderHeight >= bodyEvidence.shoulderHeightM.ci95[0] && dna.global.shoulderHeight <= bodyEvidence.shoulderHeightM.ci95[1]);

// The procedural model must stay a coherent first-party field after calibration.
assert.equal(metrics.externalAnimalMeshes, 0);
assert.equal(metrics.externalImageTextures, 0);
assert.equal(metrics.proceduralGeometry, true);
assert.equal(metrics.proceduralMaterial, true);
assert.ok(Math.abs(metrics.noseToTailRootM - dna.global.bodyLength) < 0.035, 'generated nose-tail-root span drifted from calibrated body length');
assert.ok(dna.tail.length >= 0.22 && dna.tail.length <= 0.42);
assert.ok(metrics.thoraxLumbarRatio > 1.25 && metrics.thoraxLumbarRatio < 1.8);
assert.ok(metrics.pelvisLumbarRatio > 1.15 && metrics.pelvisLumbarRatio < 1.65);
assert.ok(Object.values(metrics.pawGroundZ).every((value) => Math.abs(value) < 1e-9));

for (const [id, point] of Object.entries(anchors)) {
  assert.equal(point.length, 3, `${id} is not vec3`);
  assert.ok(point.every(Number.isFinite), `${id} contains a non-finite value`);
}
assert.ok(sections.length >= 7);
for (let i = 1; i < sections.length; i += 1) {
  assert.ok(sections[i].x > sections[i - 1].x, `torso sections are not monotonic at ${i}`);
}
for (const section of sections) {
  assert.ok(section.ry > 0 && section.rz > 0);
  assert.ok(sdf(section.x, 0, section.z) < 0, `torso section center is outside at x=${section.x}`);
}
assert.deepEqual(tailPoints[0], anchors.tailRoot);
assert.ok(tailPoints.every((point) => point.every(Number.isFinite)));
assert.ok(sdf(anchors.head[0], 0, anchors.head[2]) < 0, 'head center is outside');
assert.ok(sdf(anchors.pelvis[0], 0, anchors.pelvis[2]) < 0, 'pelvis center is outside');
assert.ok(sdf(1.2, 1.2, 1.2) > 0, 'far field is not outside');

const evidenceClass = calibration.classification;
assert.ok(evidenceClass.directlyMeasured.includes('global.bodyLength'));
assert.ok(evidenceClass.directlyMeasured.includes('hindlimb.tibiaLength'));
assert.ok(evidenceClass.notYetAuthoritative.includes('soft-tissue cross-sectional widths and depths'));

const report = {
  schema: 'cat_kaopu/procedural_cat_p1_static_qa@1.0',
  buildId: calibration.buildId,
  valid: true,
  calibrationProfile: CAT_CALIBRATION_PROFILE_ID,
  dnaHash: metrics.dnaHash,
  parameterCount: Object.keys(CAT_PARAMETER_DEFINITIONS).length,
  evidenceSources: calibration.sources.map(({ id, doi, url }) => ({ id, doi, url })),
  evidenceClassification: evidenceClass,
  measuredChecks: {
    bodyLengthM: dna.global.bodyLength,
    shoulderHeightM: dna.global.shoulderHeight,
    scapulaLengthM: dna.forelimb.scapulaLength,
    humerusLengthM: dna.forelimb.humerusLength,
    radiusLengthM: dna.forelimb.radiusLength,
    metacarpalLengthM: dna.forelimb.metacarpalLength,
    femurLengthM: dna.hindlimb.femurLength,
    tibiaLengthM: dna.hindlimb.tibiaLength
  },
  generatedChecks: {
    noseToTailRootM: metrics.noseToTailRootM,
    tailLengthM: dna.tail.length,
    thoraxLumbarRatio: metrics.thoraxLumbarRatio,
    pelvisLumbarRatio: metrics.pelvisLumbarRatio,
    sectionCount: sections.length,
    tailPointCount: tailPoints.length,
    pawGroundZ: metrics.pawGroundZ,
    connectedAuthoringFieldExpected: true,
    externalAnimalMeshes: 0,
    externalImageTextures: 0
  },
  acceptance: {
    calibrationTechnical: true,
    visualAcceptance: false,
    stableTopology: false,
    bindAcceptance: false,
    motionAcceptance: false,
    productionReady: false
  }
};

const output = path.join(qaDir, 'CAT_PROCEDURAL_V1_P1_STATIC_QA_2026-09-18.json');
fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
