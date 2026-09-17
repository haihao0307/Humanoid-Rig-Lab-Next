import assert from 'node:assert/strict';
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

const defaultResult = validateCatDNA(DEFAULT_CAT_DNA);
assert.equal(defaultResult.valid, true, defaultResult.errors.join('; '));
assert.equal(defaultResult.dna.schema, CAT_DNA_SCHEMA);
assert.equal(defaultResult.metrics.externalAnimalMeshes, 0);
assert.equal(defaultResult.metrics.externalImageTextures, 0);
assert.equal(defaultResult.metrics.proceduralGeometry, true);
assert.equal(defaultResult.metrics.proceduralMaterial, true);
assert.ok(Object.keys(CAT_PARAMETER_DEFINITIONS).length >= 70, 'CatDNA must expose a broad production parameter surface');

const normalized = normalizeCatDNA({
  ...DEFAULT_CAT_DNA,
  global: { ...DEFAULT_CAT_DNA.global, bodyLength: 99, shoulderHeight: -1 },
  head: { ...DEFAULT_CAT_DNA.head, muzzleWidth: 99 },
  tail: { ...DEFAULT_CAT_DNA.tail, tipRadius: 1 }
});
assert.ok(normalized.global.bodyLength <= CAT_PARAMETER_DEFINITIONS['global.bodyLength'].max);
assert.ok(normalized.global.shoulderHeight >= CAT_PARAMETER_DEFINITIONS['global.shoulderHeight'].min);
assert.ok(normalized.head.muzzleWidth <= normalized.head.width * 0.82 + 1e-9);
assert.ok(normalized.tail.tipRadius <= normalized.tail.baseRadius * 0.55 + 1e-9);

const hashA = hashCatDNA(DEFAULT_CAT_DNA);
const hashB = hashCatDNA(JSON.parse(JSON.stringify(DEFAULT_CAT_DNA)));
assert.equal(hashA, hashB, 'CatDNA hash must be deterministic');

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
const samplePoints = [
  [-0.2, 0, 0.3], [0.1, 0, 0.34], [0.4, 0, 0.48],
  [-0.6, 0.02, 0.3], [0.18, 0.08, 0.18], [-0.12, -0.08, 0.12]
];
for (const point of samplePoints) assert.ok(Number.isFinite(sdf(...point)), `non-finite SDF at ${point}`);

const proxies = deriveCollisionProxies(DEFAULT_CAT_DNA);
assert.equal(proxies.length, 3);
assert.deepEqual(proxies.map((proxy) => proxy.id), ['pelvis', 'thorax', 'head']);
assert.ok(proxies.every((proxy) => proxy.radii.every((value) => value > 0)));

const metrics = deriveCatMetrics(DEFAULT_CAT_DNA);
assert.ok(metrics.thoraxLumbarRatio > 1);
assert.ok(metrics.pelvisLumbarRatio > 1);
assert.ok(Object.values(metrics.pawGroundZ).every((value) => Math.abs(value) < 1e-9));

const variantA = createSeededVariant(DEFAULT_CAT_DNA, 101, 0.11);
const variantB = createSeededVariant(DEFAULT_CAT_DNA, 101, 0.11);
const variantC = createSeededVariant(DEFAULT_CAT_DNA, 102, 0.11);
assert.equal(hashCatDNA(variantA), hashCatDNA(variantB), 'seeded variant must be reproducible');
assert.notEqual(hashCatDNA(variantA), hashCatDNA(variantC), 'different seeds should generate distinct DNA');
assert.equal(validateCatDNA(variantA).valid, true);
assert.equal(validateCatDNA(variantC).valid, true);

const report = {
  schema: 'cat_kaopu/procedural_cat_validation_report@1.0',
  valid: true,
  dnaSchema: CAT_DNA_SCHEMA,
  defaultHash: hashA,
  parameterCount: Object.keys(CAT_PARAMETER_DEFINITIONS).length,
  sectionCount: sectionResult.sections.length,
  tailPointCount: tail.points.length,
  collisionProxyCount: proxies.length,
  defaultMetrics: metrics,
  testedVariantHashes: [hashCatDNA(variantA), hashCatDNA(variantC)],
  externalAnimalMeshes: 0,
  externalImageTextures: 0
};
console.log(JSON.stringify(report, null, 2));
