import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  NATIVE_HUMAN_SURFACE_LANDMARK_MAP_V1,
  createNativeHumanSurfaceCageV1,
  createNativeHumanSurfaceTopologyV1,
} from '../src/modules/human-core-v5/native-surface-v1/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(root, 'assets', 'human', 'native-surface-v1');
const topology = createNativeHumanSurfaceTopologyV1();
const cage = createNativeHumanSurfaceCageV1({ topology });

const topologyAsset = {
  ...topology,
  generatedBy: 'scripts/generate-native-human-surface-v1.mjs',
  generationPolicy: 'deterministic-project-authored-cage-no-external-human-mesh',
};
const patchAtlasAsset = {
  schema: 'humanoid_rig/anatomical_patch_atlas@1.0',
  schemaVersion: 1,
  atlasId: 'native-human-surface-anatomical-patch-atlas-v1',
  topologyFingerprint: topology.topologyFingerprint,
  patchCount: topology.patches.length,
  patches: topology.patches,
  vertexAssignments: cage.patchLayout,
  junctions: {
    shoulder: 'continuous silhouette bridge with clavicle slope, acromion crest, deltoid volume and axilla floor',
    hip: 'continuous pelvis-to-thigh bridge around independent left/right hip centers',
    axilla: 'front/back shell depth reduction at the authored axilla floor; never overlapping tubes',
    groin: 'single closed cage with a shared groin vertex and separated left/right inner-thigh boundaries',
    knee: 'front patella depth accent and rear popliteal depth reduction on the same fixed patch',
  },
  externalHumanMeshUsed: false,
};
const landmarkAsset = {
  schema: 'humanoid_rig/native_human_surface_landmark_map@1.0',
  schemaVersion: 1,
  landmarkMapId: 'native-human-surface-landmark-map-v1',
  topologyFingerprint: topology.topologyFingerprint,
  definitionsDistinguishSkinAndCenters: true,
  landmarks: NATIVE_HUMAN_SURFACE_LANDMARK_MAP_V1,
  externalHumanMeshUsed: false,
};

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeJson(path.join(outputDirectory, 'canonical-topology-v1.json'), topologyAsset),
  writeJson(path.join(outputDirectory, 'anatomical-patch-atlas-v1.json'), patchAtlasAsset),
  writeJson(path.join(outputDirectory, 'landmark-map-v1.json'), landmarkAsset),
]);

process.stdout.write(`${JSON.stringify({
  topologyFingerprint: topology.topologyFingerprint,
  indexHash: topology.indexHash,
  vertexCount: topology.vertexCount,
  triangleCount: topology.triangleCount,
  outputDirectory,
  externalHumanMeshUsed: false,
})}\n`);

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
