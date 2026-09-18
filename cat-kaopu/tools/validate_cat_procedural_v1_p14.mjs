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
const qaDir = path.join(moduleRoot, 'qa', 'procedural-cat-v1-p1-4');
const profilePath = path.join(moduleRoot, 'procedural-cat-v1', 'P1_4_JOINT_CARRIER_CANDIDATE.json');
const corePath = path.join(moduleRoot, 'procedural-cat-v1', 'src', 'cat-procedural-core.mjs');
fs.mkdirSync(qaDir, { recursive: true });

const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
const coreSource = fs.readFileSync(corePath, 'utf8');
const dna = normalizeCatDNA(DEFAULT_CAT_DNA);
const validation = validateCatDNA(dna);
const metrics = deriveCatMetrics(dna);
const { anchors } = deriveCatSkeleton(dna);
const { sections } = deriveCatSections(dna);
const { points: tailPoints } = deriveTailPoints(dna);
const sdf = createCatSdf(dna);

assert.equal(validation.valid, true, validation.errors.join('; '));
assert.equal(dna.meta.id, 'grey-tabby-a-p1-4');
assert.equal(dna.meta.revision, 6);
assert.ok(Object.keys(CAT_PARAMETER_DEFINITIONS).length >= 75);
assert.equal(profile.policy.directMeasurementsUnchanged, true);
assert.equal(profile.policy.externalRuntimeMesh, false);
assert.equal(profile.policy.externalRuntimeTexture, false);

const close = (actual, expected, tolerance, label) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} != ${expected} ± ${tolerance}`);
};
const distance = (a, b) => Math.hypot(...a.map((value, index) => value - b[index]));

close(dna.global.bodyLength, 0.475, 0.0006, 'body length');
close(dna.global.shoulderHeight, 0.2525, 0.0006, 'external shoulder height');
close(dna.forelimb.scapulaLength, 0.0713, 0.0002, 'scapula');
close(dna.forelimb.humerusLength, 0.0995, 0.0002, 'humerus DNA');
close(dna.forelimb.radiusLength, 0.0917, 0.0002, 'radius DNA');
close(dna.forelimb.metacarpalLength, 0.0333, 0.0002, 'metacarpal DNA');
close(dna.hindlimb.femurLength, 0.1315, 0.0030, 'femur DNA');
close(dna.hindlimb.tibiaLength, 0.11161, 0.0003, 'tibia DNA');

for (const [name, expected] of Object.entries({
  humerus: dna.forelimb.humerusLength,
  radius: dna.forelimb.radiusLength,
  metacarpal: dna.forelimb.metacarpalLength,
  femur: dna.hindlimb.femurLength,
  tibia: dna.hindlimb.tibiaLength,
  tarsus: dna.hindlimb.tarsusLength
})) close(metrics.actualSegmentLengthsM[name], expected, 1e-9, `actual ${name}`);

for (const id of ['shoulder1', 'shoulder-1', 'hip1', 'hip-1', 'neckBase', 'neckTip', 'tailRoot']) {
  assert.ok(sdf(...anchors[id]) < -0.001, `${id} is not embedded in the carrier`);
}
assert.ok(metrics.shoulderJointHeightM < dna.global.shoulderHeight - 0.03, 'shoulder joint still follows dorsal silhouette instead of carrier center');
assert.ok(metrics.hipJointHeightM < dna.global.hipHeight - 0.03, 'hip joint still follows dorsal silhouette instead of carrier center');
assert.ok(metrics.foreReachCorrectionM < 1e-8, 'forelimb measured chain required reach correction');
assert.ok(metrics.hindReachCorrectionM < 1e-8, 'hindlimb measured chain required reach correction');

assert.ok(anchors.elbow1[2] < anchors.shoulder1[2] && anchors.wrist1[2] < anchors.elbow1[2], 'forelimb vertical order invalid');
assert.ok(anchors.stifle1[0] > anchors.hip1[0], 'stifle must project forward from hip');
assert.ok(anchors.hock1[0] < anchors.stifle1[0], 'hock must return behind stifle');
assert.ok(anchors.hindPaw1[0] > anchors.hock1[0], 'hind paw must project forward from hock');
assert.ok(Object.values(metrics.pawGroundZ).every((value) => Math.abs(value) < 1e-9), 'four paws are not grounded');

assert.ok(metrics.thoraxLumbarRatio > 1.05 && metrics.thoraxLumbarRatio < 1.25, 'thorax/lumbar rhythm outside candidate envelope');
assert.ok(metrics.pelvisLumbarRatio > 1.02 && metrics.pelvisLumbarRatio < 1.18, 'pelvis/lumbar rhythm outside candidate envelope');
assert.ok(dna.neck.length / dna.global.bodyLength < 0.12, 'visible neck remains too long');
assert.ok(dna.head.muzzleLength / dna.head.cranialLength < 0.19, 'muzzle remains too long');
assert.ok(dna.tail.segments >= 28 && tailPoints.length >= 29, 'tail sampling did not increase');
assert.ok(dna.coat.stripeContrast <= 0.18, 'coat can still counterfeit body segmentation');
assert.ok(dna.material.shortHairAmplitude <= 0.00003, 'hair relief can still distort morphology');

assert.ok(coreSource.includes('solvePlanarTwoBone'), 'fixed-length planar IK missing');
assert.ok(coreSource.includes('foreReachCorrection'), 'reach diagnostic missing');
assert.ok(coreSource.includes('const braincase'), 'compact cranial field missing');
assert.ok(coreSource.includes('const facialCenter'), 'facial carrier field missing');
assert.ok(coreSource.includes('Math.pow(1 - u, 0.92)'), 'triangular pinna taper missing');
assert.ok(coreSource.includes('dna.paws.foreLength * (0.53'), 'fore toe fan missing');
assert.ok(coreSource.includes('dna.paws.hindLength * (0.54'), 'hind toe fan missing');
assert.ok(coreSource.includes('i < 3 ? 0.009 : 0.007'), 'tail-root integration missing');

assert.equal(sections.length, 10);
for (let i = 1; i < sections.length; i += 1) assert.ok(sections[i].x > sections[i - 1].x, `non-monotonic section ${i}`);
for (const section of sections) assert.ok(sdf(section.x, 0, section.z) < 0, `section center outside field at ${section.x}`);
assert.equal(metrics.externalAnimalMeshes, 0);
assert.equal(metrics.externalImageTextures, 0);
assert.equal(metrics.proceduralGeometry, true);
assert.equal(metrics.proceduralMaterial, true);
assert.ok(sdf(1.2, 1.2, 1.2) > 0);

const report = {
  schema: 'cat_kaopu/procedural_cat_p1_4_static_qa@1.0',
  buildId: profile.buildId,
  valid: true,
  dnaHash: metrics.dnaHash,
  parameterCount: Object.keys(CAT_PARAMETER_DEFINITIONS).length,
  directMeasurementsPreserved: profile.unchangedDirectMeasurements,
  actualSegmentLengthsM: metrics.actualSegmentLengthsM,
  jointCarrier: {
    shoulderJointHeightM: metrics.shoulderJointHeightM,
    hipJointHeightM: metrics.hipJointHeightM,
    shoulderCarrierSdfM: sdf(...anchors.shoulder1),
    hipCarrierSdfM: sdf(...anchors.hip1),
    foreReachCorrectionM: metrics.foreReachCorrectionM,
    hindReachCorrectionM: metrics.hindReachCorrectionM,
    foreChainM: {
      humerus: distance(anchors.shoulder1, anchors.elbow1),
      radius: distance(anchors.elbow1, anchors.wrist1),
      metacarpal: distance(anchors.wrist1, anchors.forePaw1)
    },
    hindChainM: {
      femur: distance(anchors.hip1, anchors.stifle1),
      tibia: distance(anchors.stifle1, anchors.hock1),
      tarsus: distance(anchors.hock1, anchors.hindPaw1)
    },
    pawGroundZ: metrics.pawGroundZ
  },
  silhouette: {
    thoraxLumbarRatio: metrics.thoraxLumbarRatio,
    pelvisLumbarRatio: metrics.pelvisLumbarRatio,
    neckBodyRatio: dna.neck.length / dna.global.bodyLength,
    muzzleCraniumRatio: dna.head.muzzleLength / dna.head.cranialLength,
    tailSegments: dna.tail.segments,
    stripeContrast: dna.coat.stripeContrast,
    shortHairAmplitudeM: dna.material.shortHairAmplitude
  },
  acceptance: {
    p1_4Technical: true,
    visualAcceptance: false,
    stableTopology: false,
    bindAcceptance: false,
    motionAcceptance: false,
    productionReady: false
  }
};

const output = path.join(qaDir, 'CAT_PROCEDURAL_V1_P1_4_STATIC_QA_2026-09-18.json');
fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
