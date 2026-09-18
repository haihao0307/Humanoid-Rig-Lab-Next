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
const qaDir = path.join(moduleRoot, 'qa', 'procedural-cat-v1-p1-3');
const profilePath = path.join(moduleRoot, 'procedural-cat-v1', 'P1_3_MASS_DISTRIBUTION_CANDIDATE.json');
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
assert.equal(dna.meta.id, 'grey-tabby-a-p1-3');
assert.equal(dna.meta.revision, 5);
assert.ok(Object.keys(CAT_PARAMETER_DEFINITIONS).length >= 75);
assert.equal(profile.policy.directMeasurementsUnchanged, true);

const close = (actual, expected, tolerance, label) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} != ${expected} ± ${tolerance}`);
};

// Published dimensions and measured limb segments are immutable in P1.3.
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

// P1.3 is explicitly a mass-distribution change, not a new scale model.
assert.ok(metrics.noseToTailRootM >= 0.44 && metrics.noseToTailRootM <= 0.50, 'nose-tail-root span left calibrated envelope');
assert.ok(metrics.thoraxLumbarRatio > 1.05 && metrics.thoraxLumbarRatio < 1.25, 'thorax/lumbar rhythm remains pinched or erased');
assert.ok(metrics.pelvisLumbarRatio > 1.02 && metrics.pelvisLumbarRatio < 1.18, 'pelvis/lumbar rhythm remains bulbous or erased');
assert.ok(dna.neck.length / dna.global.bodyLength < 0.13, 'visible neck remains too long');
assert.ok(dna.head.muzzleLength / dna.head.cranialLength < 0.22, 'muzzle remains too long');
assert.ok(dna.tail.segments >= 24 && tailPoints.length >= 25, 'tail sampling did not increase');
assert.ok(dna.coat.stripeContrast <= 0.22, 'coat contrast can still counterfeit body segmentation');
assert.ok(dna.material.shortHairAmplitude <= 0.00005, 'hair relief can still distort morphology');

assert.ok(coreSource.includes('dna.hindlimb.femurLength * 0.17, dna.hindlimb.upperRadius * 0.72, dna.hindlimb.upperRadius * 0.90'), 'hip helper bulb reduction missing');
assert.ok(coreSource.includes('dna.forelimb.scapulaLength * 0.22, dna.forelimb.upperRadius * 0.78, dna.forelimb.upperRadius * 0.92'), 'shoulder helper bulb reduction missing');
assert.ok(coreSource.includes("'neck.length': { group: '颈部', label: '颈部长度', min: 0.05"), 'short neck range missing');
assert.ok(coreSource.includes('brokenStripe'), 'broken subordinate tabby field missing');
assert.ok(coreSource.includes('(dna.paws.foreWidth + dna.paws.toeSplay) * 0.185'), 'forepaw toe fan missing');
assert.ok(coreSource.includes('(dna.paws.hindWidth + dna.paws.toeSplay) * 0.185'), 'hindpaw toe fan missing');

assert.equal(sections.length, 10);
for (let i = 1; i < sections.length; i += 1) assert.ok(sections[i].x > sections[i - 1].x, `non-monotonic section ${i}`);
for (const section of sections) assert.ok(sdf(section.x, 0, section.z) < 0, `section center outside field at ${section.x}`);
assert.ok(anchors.stifle1[0] > anchors.hip1[0], 'stifle must be forward of hip');
assert.ok(anchors.hock1[0] < anchors.stifle1[0], 'hock must return behind stifle');
assert.ok(anchors.hindPaw1[0] > anchors.hock1[0], 'hind paw must project forward from hock');
assert.ok(Object.values(metrics.pawGroundZ).every((value) => Math.abs(value) < 1e-9));
assert.equal(metrics.externalAnimalMeshes, 0);
assert.equal(metrics.externalImageTextures, 0);
assert.equal(metrics.proceduralGeometry, true);
assert.equal(metrics.proceduralMaterial, true);
assert.ok(sdf(1.2, 1.2, 1.2) > 0);

const report = {
  schema: 'cat_kaopu/procedural_cat_p1_3_static_qa@1.0',
  buildId: profile.buildId,
  valid: true,
  dnaHash: metrics.dnaHash,
  parameterCount: Object.keys(CAT_PARAMETER_DEFINITIONS).length,
  directMeasurementsPreserved: profile.unchangedDirectMeasurements,
  actualSegmentLengthsM: metrics.actualSegmentLengthsM,
  massDistribution: {
    thoraxWidthM: dna.torso.thoraxWidth,
    lumbarWidthM: dna.torso.lumbarWidth,
    pelvisWidthM: dna.torso.pelvisWidth,
    thoraxLumbarRatio: metrics.thoraxLumbarRatio,
    pelvisLumbarRatio: metrics.pelvisLumbarRatio,
    neckBodyRatio: dna.neck.length / dna.global.bodyLength,
    muzzleCraniumRatio: dna.head.muzzleLength / dna.head.cranialLength,
    tailSegments: dna.tail.segments,
    stripeContrast: dna.coat.stripeContrast,
    shortHairAmplitudeM: dna.material.shortHairAmplitude,
    pawGroundZ: metrics.pawGroundZ
  },
  implementationChecks: {
    shoulderHelperReduced: true,
    hipHelperReduced: true,
    toeFansPresent: true,
    brokenTabbyPresent: true,
    continuousTorsoSections: sections.length
  },
  acceptance: {
    p1_3Technical: true,
    visualAcceptance: false,
    stableTopology: false,
    bindAcceptance: false,
    motionAcceptance: false,
    productionReady: false
  }
};

const output = path.join(qaDir, 'CAT_PROCEDURAL_V1_P1_3_STATIC_QA_2026-09-18.json');
fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
