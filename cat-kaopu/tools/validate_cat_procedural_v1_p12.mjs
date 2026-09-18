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
const qaDir = path.join(moduleRoot, 'qa', 'procedural-cat-v1-p1-2');
const profilePath = path.join(moduleRoot, 'procedural-cat-v1', 'P1_2_SILHOUETTE_CANDIDATE.json');
fs.mkdirSync(qaDir, { recursive: true });

const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
const dna = normalizeCatDNA(DEFAULT_CAT_DNA);
const validation = validateCatDNA(dna);
const metrics = deriveCatMetrics(dna);
const { anchors } = deriveCatSkeleton(dna);
const { sections } = deriveCatSections(dna);
const { points: tailPoints } = deriveTailPoints(dna);
const sdf = createCatSdf(dna);

assert.equal(validation.valid, true, validation.errors.join('; '));
assert.equal(dna.meta.id, 'grey-tabby-a-p1-2');
assert.equal(dna.meta.revision, 4);
assert.ok(Object.keys(CAT_PARAMETER_DEFINITIONS).length >= 75);
assert.equal(profile.policy.directMeasurementsUnchanged, true);

const close = (actual, expected, tolerance, label) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} != ${expected} ± ${tolerance}`);
};

// Published dimensions and bone lengths remain untouched.
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

// External dorsal measurements must no longer equal internal torso centers.
assert.ok(anchors.thorax[2] < dna.global.shoulderHeight - 0.035, 'thorax center remains too high');
assert.ok(anchors.pelvis[2] < dna.global.hipHeight - 0.035, 'pelvis center remains too high');
assert.ok(anchors.shoulder1[2] < dna.global.shoulderHeight, 'shoulder joint exceeds external withers height');
assert.ok(anchors.hip1[2] < dna.global.hipHeight + 0.010, 'hip joint exceeds external hip height excessively');

assert.equal(sections.length, 10, 'P1.2 torso must use ten continuous sections');
for (let i = 1; i < sections.length; i += 1) assert.ok(sections[i].x > sections[i - 1].x, `non-monotonic section ${i}`);
for (const section of sections) assert.ok(sdf(section.x, 0, section.z) < 0, `section center outside field at ${section.x}`);

const pelvisSection = sections.reduce((best, section) => Math.abs(section.x - anchors.pelvis[0]) < Math.abs(best.x - anchors.pelvis[0]) ? section : best, sections[0]);
const thoraxSection = sections.reduce((best, section) => Math.abs(section.x - anchors.thorax[0]) < Math.abs(best.x - anchors.thorax[0]) ? section : best, sections[0]);
const pelvisDorsal = pelvisSection.z + pelvisSection.rz * 0.91;
const thoraxDorsal = thoraxSection.z + thoraxSection.rz * 0.91;
assert.ok(Math.abs(pelvisDorsal - dna.global.hipHeight) < 0.025, `pelvis dorsal height drift ${pelvisDorsal}`);
assert.ok(Math.abs(thoraxDorsal - dna.global.shoulderHeight) < 0.025, `thorax dorsal height drift ${thoraxDorsal}`);

// Cat-like static posture and silhouette constraints.
assert.ok(anchors.stifle1[0] > anchors.hip1[0], 'stifle must be forward of hip');
assert.ok(anchors.hock1[0] < anchors.stifle1[0], 'hock must return behind stifle');
assert.ok(anchors.hindPaw1[0] > anchors.hock1[0], 'hind paw must project forward from hock');
assert.ok(dna.neck.length / dna.global.bodyLength < 0.18, 'visible neck candidate remains too long');
assert.ok(dna.head.earHeight / dna.head.height < 0.50, 'pinna remains too tall');
assert.ok(dna.head.muzzleLength / dna.head.cranialLength < 0.25, 'muzzle remains too long');
assert.ok(metrics.noseToTailRootM >= 0.44 && metrics.noseToTailRootM <= 0.50, 'nose-tail-root span left the evidence envelope');
assert.equal(dna.tail.segments, 20);
assert.equal(tailPoints.length, 21);
assert.ok(dna.coat.stripeContrast <= 0.35);
assert.ok(dna.material.shortHairAmplitude <= 0.0001);
assert.ok(Object.values(metrics.pawGroundZ).every((value) => Math.abs(value) < 1e-9));
assert.equal(metrics.externalAnimalMeshes, 0);
assert.equal(metrics.externalImageTextures, 0);
assert.equal(metrics.proceduralGeometry, true);
assert.equal(metrics.proceduralMaterial, true);
assert.ok(sdf(1.2, 1.2, 1.2) > 0);

const report = {
  schema: 'cat_kaopu/procedural_cat_p1_2_static_qa@1.0',
  buildId: profile.buildId,
  valid: true,
  dnaHash: metrics.dnaHash,
  parameterCount: Object.keys(CAT_PARAMETER_DEFINITIONS).length,
  directMeasurementsPreserved: profile.unchangedDirectMeasurements,
  externalVsInternalHeightsM: {
    externalShoulder: dna.global.shoulderHeight,
    thoraxCenter: anchors.thorax[2],
    derivedThoraxDorsal: thoraxDorsal,
    shoulderJoint: anchors.shoulder1[2],
    externalHip: dna.global.hipHeight,
    pelvisCenter: anchors.pelvis[2],
    derivedPelvisDorsal: pelvisDorsal,
    hipJoint: anchors.hip1[2]
  },
  skeleton: {
    actualSegmentLengthsM: metrics.actualSegmentLengthsM,
    hindChainX: {
      hip: anchors.hip1[0],
      stifle: anchors.stifle1[0],
      hock: anchors.hock1[0],
      paw: anchors.hindPaw1[0]
    }
  },
  silhouette: {
    bodyLengthM: dna.global.bodyLength,
    noseToTailRootM: metrics.noseToTailRootM,
    torsoSectionCount: sections.length,
    neckBodyRatio: dna.neck.length / dna.global.bodyLength,
    earHeadRatio: dna.head.earHeight / dna.head.height,
    muzzleCraniumRatio: dna.head.muzzleLength / dna.head.cranialLength,
    tailSegments: dna.tail.segments,
    shortHairAmplitudeM: dna.material.shortHairAmplitude,
    stripeContrast: dna.coat.stripeContrast,
    pawGroundZ: metrics.pawGroundZ
  },
  acceptance: {
    p1_2Technical: true,
    visualAcceptance: false,
    stableTopology: false,
    bindAcceptance: false,
    motionAcceptance: false,
    productionReady: false
  }
};

const output = path.join(qaDir, 'CAT_PROCEDURAL_V1_P1_2_STATIC_QA_2026-09-18.json');
fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
