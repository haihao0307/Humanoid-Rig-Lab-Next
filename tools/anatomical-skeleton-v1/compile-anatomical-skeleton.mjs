import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  COORDINATE_SYSTEM,
  FEMUR_LOD_SPECS_V1,
  GENERATOR_VERSION,
  LONG_BONE_GENERATOR_V1_ID,
  POLICY_ID,
  VARIANT_SPECS,
  createVariantPackage,
  sha256Stable,
  skeletalDnaHash,
} from './anatomical-model-v1.mjs';
import { writeHrlBoneFile } from './write-hrlbone.mjs';

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(toolDirectory, '../..');
const assetRoot = path.join(repositoryRoot, 'assets/human/anatomical-skeleton-s1');
const compiledRoot = path.join(assetRoot, 'compiled');

export async function compileAnatomicalSkeletonS1({ outputRoot = assetRoot } = {}) {
  const outputCompiledRoot = path.join(outputRoot, 'compiled');
  await mkdir(outputCompiledRoot, { recursive: true });
  const compiled = [];
  for (const spec of VARIANT_SPECS) {
    const variant = createVariantPackage(spec.variantId);
    const binaryPath = path.join(outputCompiledRoot, spec.fileName);
    const encoded = await writeHrlBoneFile(binaryPath, variant.geometry);
    const dnaHash = skeletalDnaHash(variant.skeletalDNA);
    const manifest = {
      schema: 'humanoid_rig/hrl_bone_binary_manifest@1.0', schemaVersion: 1, type: 'HrlBoneBinaryManifest',
      format: 'HRL Bone Binary Geometry V1', magic: 'HRLBONE1', byteOrder: 'little-endian', coordinateSystem: COORDINATE_SYSTEM,
      generatorVersion: GENERATOR_VERSION, variantId: spec.variantId, skeletalDnaRevision: variant.skeletalDNA.revision,
      skeletalDnaHash: dnaHash, anatomicalProfileHash: variant.profile.anatomyProfileHash,
      binaryPath: `compiled/${spec.fileName}`, byteLength: encoded.byteLength, sha256: encoded.sha256, contentChecksum: encoded.contentChecksum,
      primitiveGroups: variant.geometry.primitiveGroups.map((group) => ({ ...group })),
      semanticGroups: variant.geometry.semanticGroups.map((group) => ({ ...group })),
      jointMarkers: variant.geometry.jointMarkers.map((marker) => ({ ...marker, position: marker.position.map(Math.fround) })),
      landmarks: variant.geometry.landmarks.map((marker) => ({ ...marker, position: marker.position.map(Math.fround) })),
      aabb: encoded.aabb,
      deterministicInputs: { seed: variant.skeletalDNA.seed, precision: variant.skeletalDNA.precision, generatorVersion: GENERATOR_VERSION, skeletalDnaHash: dnaHash },
      policy: { proceduralGenerationOnly: true, externalGeometrySourceCount: 0, loadedExternalHumanModelCount: 0, generatedGlbCount: 0, runtimeBoneScaleCount: 0 },
    };
    const slug = outputSlug(spec.variantId);
    await writeJson(path.join(outputRoot, `SKELETAL_DNA_${slug}.json`), variant.skeletalDNA);
    await writeJson(path.join(outputRoot, `ANATOMICAL_PROFILE_${slug}.json`), variant.profile);
    await writeJson(path.join(outputRoot, `HUMANRIGCORE_MAPPING_${slug}.json`), variant.mapping);
    await writeJson(path.join(outputRoot, `HRLBONE_MANIFEST_${slug}.json`), manifest);
    if (spec.variantId === 'baseline') {
      await writeJson(path.join(outputRoot, 'ANATOMICAL_GRAPH_S1.json'), variant.graph);
      await writeJson(path.join(outputRoot, 'SKELETAL_DNA_BASELINE.json'), variant.skeletalDNA);
      await writeJson(path.join(outputRoot, 'ANATOMICAL_PROFILE_S1.json'), variant.profile);
      await writeJson(path.join(outputRoot, 'HUMANRIGCORE_MAPPING_S1.json'), variant.mapping);
    }
    compiled.push({
      variantId: spec.variantId, label: spec.label, revision: spec.revision, fileName: spec.fileName,
      binaryPath: manifest.binaryPath, manifestPath: `HRLBONE_MANIFEST_${slug}.json`, skeletalDnaPath: `SKELETAL_DNA_${slug}.json`,
      anatomicalProfilePath: `ANATOMICAL_PROFILE_${slug}.json`, mappingPath: `HUMANRIGCORE_MAPPING_${slug}.json`,
      skeletalDnaHash: dnaHash, anatomicalProfileHash: variant.profile.anatomyProfileHash,
      sha256: encoded.sha256, contentChecksum: encoded.contentChecksum, byteLength: encoded.byteLength,
      meshes: variant.geometry.meshes.map((mesh) => ({ side: mesh.side, lod: mesh.lod, vertexCount: mesh.vertexCount, triangleCount: mesh.triangleCount })),
    });
  }
  const generatorRegistry = {
    schema: 'humanoid_rig/anatomical_generator_registry@1.0', type: 'AnatomicalGeneratorRegistry', version: GENERATOR_VERSION,
    policyId: POLICY_ID, proceduralGenerationOnly: true, externalGeometrySourceCount: 0,
    generators: [
      { generatorId: 'SkeletonLineGeneratorV1@1.0.0', outputPrimitives: ['LINES', 'POINTS'], deterministic: true },
      { generatorId: LONG_BONE_GENERATOR_V1_ID, outputPrimitives: ['TRIANGLES'], supportedBoneIds: ['left_femur', 'right_femur'], deterministic: true, lodSpecs: FEMUR_LOD_SPECS_V1 },
    ],
  };
  generatorRegistry.generatorRegistryHash = sha256Stable(generatorRegistry);
  await writeJson(path.join(outputRoot, 'GENERATOR_REGISTRY_S1.json'), generatorRegistry);
  const registry = {
    schema: 'humanoid_rig/anatomical_variant_registry@1.0', type: 'AnatomicalVariantRegistry',
    generatorVersion: GENERATOR_VERSION, generatorRegistryHash: generatorRegistry.generatorRegistryHash,
    policyId: POLICY_ID, coordinateSystem: COORDINATE_SYSTEM,
    variants: compiled,
  };
  registry.variantRegistryHash = sha256Stable(registry);
  await writeJson(path.join(outputRoot, 'VARIANT_REGISTRY_S1.json'), registry);
  return { outputRoot, compiledRoot: outputCompiledRoot, generatorRegistry, registry };
}

function outputSlug(variantId) {
  if (variantId === 'baseline') return 'BASELINE';
  if (variantId === 'long_femur_plus_08_percent') return 'LONG_FEMUR_PLUS_08';
  if (variantId === 'anteversion_plus_10_degrees') return 'ANTEVERSION_PLUS_10';
  if (variantId === 'left_right_asymmetry_02') return 'ASYMMETRY_02';
  return variantId.toUpperCase();
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const result = await compileAnatomicalSkeletonS1();
  for (const variant of result.registry.variants) {
    console.log(`${variant.variantId}: ${variant.byteLength} bytes ${variant.sha256}`);
  }
}
