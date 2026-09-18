import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CAT_DNA_SCHEMA,
  DEFAULT_CAT_DNA,
  CAT_PARAMETER_DEFINITIONS,
  normalizeCatDNA,
  deriveCatSkeleton,
  deriveCatSections,
  deriveTailPoints,
  createCatSdf,
  deriveCollisionProxies,
  deriveCatMetrics,
  hashCatDNA,
  createSeededVariant,
  validateCatDNA
} from '../procedural-cat-v1/src/cat-procedural-core.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const calibration = JSON.parse(fs.readFileSync(path.join(root, 'procedural-cat-v1', 'P1_AUTHORITY_CALIBRATION.json'), 'utf8'));
const result = validateCatDNA(DEFAULT_CAT_DNA);
assert.equal(result.valid, true, result.errors.join('; '));
assert.equal(result.dna.schema, CAT_DNA_SCHEMA);
assert.ok(Object.keys(CAT_PARAMETER_DEFINITIONS).length >= 70);

const metrics = deriveCatMetrics(DEFAULT_CAT_DNA);
const authority = metrics.authorityCalibration;
assert.equal(authority.profile, 'european-shorthair-p1');
assert.ok(Math.abs(authority.shoulderHeightDeltaM) <= 0.001, 'shoulder height is outside P1 calibration tolerance');
for (const key of ['humerusDeltaM', 'radiusDeltaM', 'femurDeltaM', 'tibiaDeltaM']) {
  assert.ok(Math.abs(authority[key]) <= 1e-9, `${key} is outside P1 calibration tolerance`);
}
assert.equal(calibration.runtimeExternalAssets.animalMeshes, 0);
assert.equal(calibration.runtimeExternalAssets.imageTextures, 0);

const skeleton = deriveCatSkeleton(DEFAULT_CAT_DNA);
for (const [id, point] of Object.entries(skeleton.anchors)) {
  assert.equal(point.length, 3, `${id} must be a vec3`);
  assert.ok(point.every(Number.isFinite), `${id} contains non-finite values`);
}
for (const id of ['forePaw1', 'forePaw-1', 'hindPaw1', 'hindPaw-1']) {
  assert.ok(Math.abs(skeleton.anchors[id][2] - DEFAULT_CAT_DNA.paws.height * 0.5) < 1e-9, `${id} is not grounded`);
}

const sectionResult = deriveCatSections(DEFAULT_CAT_DNA);
assert.ok(sectionResult.sections.length >= 7);
assert.ok(sectionResult.sections.every((section) => section.ry > 0 && section.rz > 0));
const tail = deriveTailPoints(DEFAULT_CAT_DNA);
assert.ok(tail.points.length >= 7);
assert.deepEqual(tail.points[0], skeleton.anchors.tailRoot);

const sdf = createCatSdf(DEFAULT_CAT_DNA);
assert.ok(sdf(skeleton.anchors.pelvis[0], 0, skeleton.anchors.pelvis[2]) < 0, 'pelvis center must be inside');
assert.ok(sdf(1.5, 1.5, 1.5) > 0, 'far sample must be outside');
for (const point of [[-0.2,0,0.25],[0.1,0,0.28],[0.35,0,0.36],[-0.45,0.02,0.25],[0.12,0.06,0.16],[-0.12,-0.06,0.10]]) {
  assert.ok(Number.isFinite(sdf(...point)), `non-finite SDF at ${point}`);
}

const proxies = deriveCollisionProxies(DEFAULT_CAT_DNA);
assert.equal(proxies.length, 3);
assert.deepEqual(proxies.map((proxy) => proxy.id), ['pelvis', 'thorax', 'head']);
assert.ok(proxies.every((proxy) => proxy.radii.every((value) => value > 0)));
assert.ok(metrics.thoraxLumbarRatio > 1);
assert.ok(metrics.pelvisLumbarRatio > 1);
assert.ok(Object.values(metrics.pawGroundZ).every((value) => Math.abs(value) < 1e-9));

const variantA = createSeededVariant(DEFAULT_CAT_DNA, 201, 0.08);
const variantB = createSeededVariant(DEFAULT_CAT_DNA, 201, 0.08);
const variantC = createSeededVariant(DEFAULT_CAT_DNA, 202, 0.08);
assert.equal(hashCatDNA(variantA), hashCatDNA(variantB), 'seeded variant must be reproducible');
assert.notEqual(hashCatDNA(variantA), hashCatDNA(variantC), 'different seeds should generate distinct DNA');
assert.equal(validateCatDNA(variantA).valid, true);
assert.equal(validateCatDNA(variantC).valid, true);

const report = {
  schema: 'cat_kaopu/procedural_cat_p1_validation_report@1.0',
  valid: true,
  buildId: 'cat-procedural-body-v1-p1-authority-20260917',
  dnaSchema: CAT_DNA_SCHEMA,
  defaultHash: hashCatDNA(DEFAULT_CAT_DNA),
  parameterCount: Object.keys(CAT_PARAMETER_DEFINITIONS).length,
  sectionCount: sectionResult.sections.length,
  tailPointCount: tail.points.length,
  collisionProxyCount: proxies.length,
  authorityCalibration: authority,
  defaultMetrics: metrics,
  testedVariantHashes: [hashCatDNA(variantA), hashCatDNA(variantC)],
  externalAnimalMeshes: 0,
  externalImageTextures: 0,
  visualAcceptance: false,
  stableTopology: false,
  bindAcceptance: false,
  motionAcceptance: false,
  productionReady: false
};
const qaDir = path.join(root, 'qa', 'procedural-cat-v1-p1');
fs.mkdirSync(qaDir, { recursive: true });
fs.writeFileSync(path.join(qaDir, 'CAT_PROCEDURAL_V1_P1_TECHNICAL_QA_2026-09-17.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
