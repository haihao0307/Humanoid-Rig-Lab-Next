import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CAT_PARAMETER_DEFINITIONS,
  DEFAULT_CAT_DNA,
  createCatSdf,
  deriveCatMetrics,
  deriveCatSections,
  deriveCatSkeleton,
  normalizeCatDNA,
  validateCatDNA
} from '../procedural-cat-v1/src/cat-procedural-core.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const moduleRoot = path.resolve(here, '..');
const qaDir = path.join(moduleRoot, 'qa', 'procedural-cat-v1-p1-1');
const candidatePath = path.join(moduleRoot, 'procedural-cat-v1', 'P1_1_MORPHOLOGY_CANDIDATE.json');
fs.mkdirSync(qaDir, { recursive: true });

const candidate = JSON.parse(fs.readFileSync(candidatePath, 'utf8'));
const dna = normalizeCatDNA(DEFAULT_CAT_DNA);
const validation = validateCatDNA(dna);
const metrics = deriveCatMetrics(dna);
const { anchors } = deriveCatSkeleton(dna);
const { sections } = deriveCatSections(dna);
const sdf = createCatSdf(dna);

assert.equal(validation.valid, true, validation.errors.join('; '));
assert.equal(dna.meta.id, 'grey-tabby-a-p1-1');
assert.equal(dna.meta.revision, 3);
assert.equal(candidate.policy.directMeasurementsUnchanged, true);
assert.ok(Object.keys(CAT_PARAMETER_DEFINITIONS).length >= 75);

const close = (actual, expected, tolerance, label) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} != ${expected} ± ${tolerance}`);
};

// P1.1 must not move the direct measurement anchors established in P1.
close(dna.global.bodyLength, 0.475, 0.0006, 'body length');
close(dna.global.shoulderHeight, 0.2525, 0.0006, 'external shoulder height');
close(dna.forelimb.scapulaLength, 0.0713, 0.0002, 'scapula');
close(dna.forelimb.humerusLength, 0.0995, 0.0002, 'humerus DNA');
close(dna.forelimb.radiusLength, 0.0917, 0.0002, 'radius DNA');
close(dna.forelimb.metacarpalLength, 0.0333, 0.0002, 'metacarpal DNA');
close(dna.hindlimb.femurLength, 0.1315, 0.0030, 'femur DNA');
close(dna.hindlimb.tibiaLength, 0.11161, 0.0003, 'tibia DNA');

// Derived neutral skeleton must preserve those lengths exactly rather than
// scaling all segments to an external withers-height measurement.
close(metrics.actualSegmentLengthsM.humerus, dna.forelimb.humerusLength, 1e-9, 'actual humerus');
close(metrics.actualSegmentLengthsM.radius, dna.forelimb.radiusLength, 1e-9, 'actual radius');
close(metrics.actualSegmentLengthsM.metacarpal, dna.forelimb.metacarpalLength, 1e-9, 'actual metacarpal');
close(metrics.actualSegmentLengthsM.femur, dna.hindlimb.femurLength, 1e-9, 'actual femur');
close(metrics.actualSegmentLengthsM.tibia, dna.hindlimb.tibiaLength, 1e-9, 'actual tibia');
close(metrics.actualSegmentLengthsM.tarsus, dna.hindlimb.tarsusLength, 1e-9, 'actual tarsus');

assert.ok(anchors.shoulder1[2] < dna.global.shoulderHeight, 'shoulder joint should sit below external withers height');
assert.ok(Math.abs(anchors.hip1[2] - dna.global.hipHeight) < 0.025, 'hip joint and external hip height diverged excessively');
assert.ok(anchors.stifle1[0] > anchors.hip1[0], 'stifle must project forward from hip');
assert.ok(anchors.hock1[0] < anchors.stifle1[0], 'hock must return behind stifle');
assert.ok(anchors.hindPaw1[0] > anchors.hock1[0], 'hind paw must project forward from hock');
assert.ok(dna.head.earHeight / dna.head.height < 0.65, 'pinna remains oversized relative to head');
assert.ok(dna.neck.length / dna.global.bodyLength < 0.23, 'neck remains too long relative to body');
assert.ok(dna.head.muzzleLength / dna.head.cranialLength < 0.30, 'muzzle remains too long for the feline candidate');
assert.ok(dna.coat.stripeFrequency < 10, 'coat remains mechanically over-periodic');
assert.ok(dna.material.shortHairAmplitude <= 0.0002, 'hair relief is large enough to distort morphology review');

for (const section of sections) {
  assert.ok(sdf(section.x, 0, section.z) < 0, `section center outside field at ${section.x}`);
}
for (const id of ['forePaw1', 'forePaw-1', 'hindPaw1', 'hindPaw-1']) {
  assert.ok(Math.abs(anchors[id][2] - dna.paws.height * 0.5) < 1e-9, `${id} not grounded`);
}
assert.ok(metrics.externalAnimalMeshes === 0 && metrics.externalImageTextures === 0);
assert.ok(metrics.proceduralGeometry === true && metrics.proceduralMaterial === true);

const report = {
  schema: 'cat_kaopu/procedural_cat_p1_1_static_qa@1.0',
  buildId: candidate.buildId,
  valid: true,
  dnaHash: metrics.dnaHash,
  parameterCount: Object.keys(CAT_PARAMETER_DEFINITIONS).length,
  directMeasurementsPreserved: candidate.unchangedDirectMeasurements,
  skeleton: {
    externalShoulderHeightM: dna.global.shoulderHeight,
    shoulderJointHeightM: anchors.shoulder1[2],
    externalHipHeightM: dna.global.hipHeight,
    hipJointHeightM: anchors.hip1[2],
    actualSegmentLengthsM: metrics.actualSegmentLengthsM,
    hindChainX: {
      hip: anchors.hip1[0],
      stifle: anchors.stifle1[0],
      hock: anchors.hock1[0],
      paw: anchors.hindPaw1[0]
    }
  },
  morphology: {
    neckBodyRatio: dna.neck.length / dna.global.bodyLength,
    earHeadRatio: dna.head.earHeight / dna.head.height,
    muzzleCraniumRatio: dna.head.muzzleLength / dna.head.cranialLength,
    stripeFrequency: dna.coat.stripeFrequency,
    shortHairAmplitudeM: dna.material.shortHairAmplitude,
    torsoSectionCount: sections.length,
    pawGroundZ: metrics.pawGroundZ
  },
  acceptance: {
    p1_1Technical: true,
    visualAcceptance: false,
    stableTopology: false,
    bindAcceptance: false,
    motionAcceptance: false,
    productionReady: false
  }
};

const output = path.join(qaDir, 'CAT_PROCEDURAL_V1_P1_1_STATIC_QA_2026-09-18.json');
fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
