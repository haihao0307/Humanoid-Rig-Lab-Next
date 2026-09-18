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
  deriveTailPoints,
  normalizeCatDNA,
  validateCatDNA
} from '../procedural-cat-v1/src/cat-procedural-core.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const moduleRoot = path.resolve(here, '..');
const qaDir = path.join(moduleRoot, 'qa', 'procedural-cat-v1-p1-5');
const profilePath = path.join(moduleRoot, 'procedural-cat-v1', 'P1_5_NEUTRAL_STANCE_CANDIDATE.json');
const corePath = path.join(moduleRoot, 'procedural-cat-v1', 'src', 'cat-procedural-core.mjs');
fs.mkdirSync(qaDir, { recursive: true });

const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
const source = fs.readFileSync(corePath, 'utf8');
const dna = normalizeCatDNA(DEFAULT_CAT_DNA);
const validation = validateCatDNA(dna);
const metrics = deriveCatMetrics(dna);
const { anchors } = deriveCatSkeleton(dna);
const { sections } = deriveCatSections(dna);
const { points: tailPoints } = deriveTailPoints(dna);
const sdf = createCatSdf(dna);

assert.equal(validation.valid, true, validation.errors.join('; '));
assert.equal(dna.meta.id, 'grey-tabby-a-p1-5');
assert.equal(dna.meta.revision, 7);
assert.ok(Object.keys(CAT_PARAMETER_DEFINITIONS).length >= 75);
assert.equal(profile.policy.directMeasurementsUnchanged, true);

const close = (actual, expected, tolerance, label) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} != ${expected} ± ${tolerance}`);
};

// Direct dimensions and measured bone lengths remain immutable.
close(dna.global.bodyLength, 0.475, 0.0006, 'body length');
close(dna.global.shoulderHeight, 0.2525, 0.0006, 'external shoulder height');
close(dna.forelimb.scapulaLength, 0.0713, 0.0002, 'scapula');
close(dna.forelimb.humerusLength, 0.0995, 0.0002, 'humerus');
close(dna.forelimb.radiusLength, 0.0917, 0.0002, 'radius');
close(dna.forelimb.metacarpalLength, 0.0333, 0.0002, 'metacarpal');
close(dna.hindlimb.femurLength, 0.1315, 0.0030, 'femur');
close(dna.hindlimb.tibiaLength, 0.11161, 0.0003, 'tibia');

for (const [name, expected] of Object.entries({
  humerus: dna.forelimb.humerusLength,
  radius: dna.forelimb.radiusLength,
  metacarpal: dna.forelimb.metacarpalLength,
  femur: dna.hindlimb.femurLength,
  tibia: dna.hindlimb.tibiaLength,
  tarsus: dna.hindlimb.tarsusLength
})) close(metrics.actualSegmentLengthsM[name], expected, 1e-9, `actual ${name}`);

// Neutral stance gates. These are engineering envelopes, not anatomical truth labels.
assert.ok(metrics.shoulderJointHeightM > 0.20 && metrics.shoulderJointHeightM < dna.global.shoulderHeight, 'shoulder root not inside raised carrier envelope');
assert.ok(metrics.hipJointHeightM > 0.21 && metrics.hipJointHeightM < dna.global.hipHeight, 'hip root not inside raised carrier envelope');
assert.ok(metrics.forePawOffsetFromShoulderM > -0.018 && metrics.forePawOffsetFromShoulderM < 0.005, 'fore paw is not near shoulder plumb line');
assert.ok(metrics.hindPawOffsetFromHipM > 0.020 && metrics.hindPawOffsetFromHipM < 0.050, 'hind paw is not in neutral support envelope');
assert.ok(metrics.hockHeightM > 0.070 && metrics.hockHeightM < 0.095, 'hock remains too low or too upright');
assert.ok(metrics.stifleHeightM > metrics.hockHeightM + 0.035, 'stifle-hock vertical rhythm collapsed');
assert.ok(metrics.elbowHeightM > metrics.wristHeightM + 0.060, 'elbow-wrist rhythm collapsed');
assert.ok(Math.abs(metrics.foreReachCorrectionM) < 1e-9 && Math.abs(metrics.hindReachCorrectionM) < 1e-9, 'neutral chain required reach correction');
assert.ok(dna.tail.lift <= 0 && tailPoints.at(-1)[2] < anchors.tailRoot[2] - 0.02, 'tail is not relaxed below its root');
assert.ok(dna.head.width / dna.global.bodyLength < 0.22, 'head remains oversized');
assert.ok(dna.neck.baseWidth / dna.torso.thoraxWidth < 0.83, 'neck remains a broad tube');
assert.ok(dna.material.shortHairAmplitude <= 0.00002, 'hair relief can distort morphology');

for (const key of ['shoulder1', 'elbow1', 'wrist1', 'forePaw1', 'hip1', 'stifle1', 'hock1', 'hindPaw1', 'neckBase', 'neckTip', 'head', 'muzzle', 'tailRoot']) {
  assert.ok(sdf(...anchors[key]) < -0.001, `${key} is outside the continuous carrier`);
}

assert.ok(source.includes('function taperedEllipticCapsuleSdf'), 'elliptic limb carrier missing');
assert.ok(source.includes('dna.forelimb.humerusBackDeg'), 'forelimb neutral angle chain missing');
assert.ok(source.includes('forePawOffsetFromShoulderM'), 'neutral stance metrics missing');
assert.equal(sections.length, 10);
for (let i = 1; i < sections.length; i += 1) assert.ok(sections[i].x > sections[i - 1].x, `non-monotonic section ${i}`);
for (const section of sections) assert.ok(sdf(section.x, 0, section.z) < 0, `section center outside field at ${section.x}`);
assert.ok(Object.values(metrics.pawGroundZ).every((value) => Math.abs(value) < 1e-9));
assert.equal(metrics.externalAnimalMeshes, 0);
assert.equal(metrics.externalImageTextures, 0);
assert.equal(metrics.proceduralGeometry, true);
assert.equal(metrics.proceduralMaterial, true);
assert.ok(sdf(1.2, 1.2, 1.2) > 0);

const report = {
  schema: 'cat_kaopu/procedural_cat_p1_5_static_qa@1.0',
  buildId: profile.buildId,
  valid: true,
  dnaHash: metrics.dnaHash,
  parameterCount: Object.keys(CAT_PARAMETER_DEFINITIONS).length,
  directMeasurementsPreserved: profile.unchangedDirectMeasurements,
  actualSegmentLengthsM: metrics.actualSegmentLengthsM,
  neutralStance: {
    shoulderJointHeightM: metrics.shoulderJointHeightM,
    hipJointHeightM: metrics.hipJointHeightM,
    forePawOffsetFromShoulderM: metrics.forePawOffsetFromShoulderM,
    hindPawOffsetFromHipM: metrics.hindPawOffsetFromHipM,
    elbowHeightM: metrics.elbowHeightM,
    wristHeightM: metrics.wristHeightM,
    stifleHeightM: metrics.stifleHeightM,
    hockHeightM: metrics.hockHeightM,
    foreReachCorrectionM: metrics.foreReachCorrectionM,
    hindReachCorrectionM: metrics.hindReachCorrectionM,
    tailRootZ: anchors.tailRoot[2],
    tailTipZ: tailPoints.at(-1)[2],
    pawGroundZ: metrics.pawGroundZ
  },
  implementationChecks: {
    ellipticLimbCarriers: true,
    compactHeadNeck: true,
    loadBearingPaws: true,
    relaxedTail: true,
    continuousTorsoSections: sections.length
  },
  acceptance: {
    p1_5Technical: true,
    visualAcceptance: false,
    stableTopology: false,
    bindAcceptance: false,
    motionAcceptance: false,
    productionReady: false
  }
};

fs.writeFileSync(path.join(qaDir, 'CAT_PROCEDURAL_V1_P1_5_STATIC_QA_2026-09-18.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
