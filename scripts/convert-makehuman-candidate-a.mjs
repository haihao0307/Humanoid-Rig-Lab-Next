import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const args = parseArgs(process.argv.slice(2));
const sourceRoot = path.resolve(args['source-root'] ?? 'G:/Three.js/NEW/task15a-asset-source/mpfb2');
const outputDir = path.resolve(args['output-dir'] ?? 'assets/human/production-surface-v2/candidate-a');
const qaDir = path.resolve(args['qa-dir'] ?? 'artifacts/qa/task15a-production-surface-v2');
const sourceCommit = args['source-commit'] ?? '437dd513888a92399d1d3200d2e80859fae55abc';
const sourceFiles = Object.freeze({
  mesh: path.join(sourceRoot, 'src/mpfb/data/3dobjs/base.obj'),
  rig: path.join(sourceRoot, 'src/mpfb/data/rigs/standard/rig.game_engine.json'),
  weights: path.join(sourceRoot, 'src/mpfb/data/rigs/standard/weights.game_engine.json'),
  license: path.join(sourceRoot, 'LICENSE.ASSETS.md'),
});
for (const [kind, filename] of Object.entries(sourceFiles)) {
  if (!fs.existsSync(filename)) throw new Error(`Official ${kind} source is missing: ${filename}`);
}

const objText = fs.readFileSync(sourceFiles.mesh, 'utf8');
const rigData = JSON.parse(fs.readFileSync(sourceFiles.rig, 'utf8'));
const weightData = JSON.parse(fs.readFileSync(sourceFiles.weights, 'utf8'));
if (weightData.license !== 'CC0') throw new Error(`Official weights do not declare CC0: ${weightData.license}`);

const parsed = parseObj(objText);
const body = compactBody(parsed);
const boneOrder = topologicalBoneOrder(rigData);
const boneIndex = new Map(boneOrder.map((name, index) => [name, index]));
const boneHeads = new Map(boneOrder.map((name) => [name, resolvePosition(rigData[name].head, parsed)]));
const weights = buildWeights({ weightData, originalVertexIndices: body.originalVertexIndices, boneIndex });
if (weights.maximumDiscardedWeight > 0.08 || weights.meanDiscardedWeight > 0.01) {
  throw new Error(`Official weight truncation exceeds Task 15A limits: max=${weights.maximumDiscardedWeight}, mean=${weights.meanDiscardedWeight}`);
}

const glb = buildGlb({ body, rigData, boneOrder, boneHeads, weights });
fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(qaDir, { recursive: true });
const glbPath = path.join(outputDir, 'neutral-body-candidate-a.glb');
fs.writeFileSync(glbPath, glb);
const convertedHash = sha256(glb);
const originalHashes = Object.fromEntries(Object.entries(sourceFiles).map(([kind, filename]) => [kind, sha256(fs.readFileSync(filename))]));
const downloadedAt = new Date().toISOString();

const sourceLock = {
  schema: 'humanoid_rig/surface_source_lock@1.0',
  sourceProject: 'MakeHuman Community MPFB2',
  sourceRepository: 'https://github.com/makehumancommunity/mpfb2',
  sourceCommit,
  sourceFiles: [
    'src/mpfb/data/3dobjs/base.obj',
    'src/mpfb/data/rigs/standard/rig.game_engine.json',
    'src/mpfb/data/rigs/standard/weights.game_engine.json',
    'LICENSE.ASSETS.md',
  ],
  originalHashes,
  assetOnly: true,
  copiedProjectSourceCode: false,
  license: 'CC0-1.0',
};
const receipt = {
  schema: 'humanoid_rig/surface_asset_receipt@2.0',
  assetId: 'makehuman-hm08-neutral-game-engine-candidate-a',
  displayName: 'Production Surface V2 Neutral Body Candidate A',
  sourceProject: 'MakeHuman Community MPFB2',
  sourceRepository: 'https://github.com/makehumancommunity/mpfb2',
  sourceCommit,
  sourceFiles: sourceLock.sourceFiles,
  downloadedAt,
  originalHashes,
  convertedHash,
  convertedSize: glb.byteLength,
  license: 'CC0-1.0',
  licenseEvidence: [
    'https://static.makehumancommunity.org/about/license.html',
    'https://github.com/makehumancommunity/mpfb2/blob/437dd513888a92399d1d3200d2e80859fae55abc/LICENSE.ASSETS.md',
  ],
  conversionRoute: 'B',
  conversionScript: 'scripts/convert-makehuman-candidate-a.mjs',
  coordinateSystem: 'right-handed, +Y up, +Z forward',
  unit: 'meter',
  vertexCount: body.positions.length / 3,
  triangleCount: body.indices.length / 3,
  jointCount: boneOrder.length,
  maximumInfluences: weights.maximumInfluencesBeforeTruncation,
  weightTruncationMaximum: weights.maximumDiscardedWeight,
  weightTruncationMean: weights.meanDiscardedWeight,
  validatorResult: 'pending',
  productionApproved: false,
  userVisualAcceptance: 'pending',
};
const conversionReport = {
  schema: 'humanoid_rig/task15a_conversion_report@1.0',
  route: 'B',
  sourceCommit,
  sourceFiles: sourceLock.sourceFiles,
  bodyGroupOnly: true,
  omittedGroups: parsed.groupNames.filter((name) => name !== 'body'),
  helperGeometryRemoved: true,
  clothingRemoved: true,
  teethTongueInternalHelpersRemoved: true,
  automaticWeightsUsed: false,
  sourceVertexCount: parsed.positions.length,
  convertedVertexCount: receipt.vertexCount,
  convertedTriangleCount: receipt.triangleCount,
  jointCount: receipt.jointCount,
  maximumInfluencesBeforeTruncation: weights.maximumInfluencesBeforeTruncation,
  verticesAboveFourInfluences: weights.verticesAboveFourInfluences,
  maximumDiscardedWeight: weights.maximumDiscardedWeight,
  meanDiscardedWeight: weights.meanDiscardedWeight,
  zeroWeightVertices: weights.zeroWeightVertices,
  convertedHash,
  convertedSize: glb.byteLength,
};

writeJson(path.join(outputDir, 'SOURCE_LOCK.json'), sourceLock);
writeJson(path.join(outputDir, 'ASSET_RECEIPT.json'), receipt);
fs.writeFileSync(path.join(outputDir, 'LICENSE-ASSET.txt'), fs.readFileSync(sourceFiles.license));
writeJson(path.join(qaDir, 'conversion-report.json'), conversionReport);
console.log(JSON.stringify({ glbPath, receipt, conversionReport }, null, 2));

function parseObj(text) {
  const positions = [];
  const groupFaces = new Map();
  const groupVertices = new Map();
  let group = null;
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('v ')) {
      const [, x, y, z] = line.trim().split(/\s+/);
      positions.push([Number(x) * 0.1, Number(y) * 0.1, Number(z) * 0.1]);
    } else if (line.startsWith('g ')) {
      group = line.slice(2).trim();
      if (!groupFaces.has(group)) groupFaces.set(group, []);
      if (!groupVertices.has(group)) groupVertices.set(group, new Set());
    } else if (line.startsWith('f ') && group) {
      const face = line.slice(2).trim().split(/\s+/).map((token) => Number(token.split('/')[0]) - 1);
      groupFaces.get(group).push(face);
      const vertices = groupVertices.get(group);
      for (const index of face) vertices.add(index);
    }
  }
  if (!groupFaces.has('body')) throw new Error('Official OBJ does not contain the required body group.');
  return { positions, groupFaces, groupVertices, groupNames: [...groupFaces.keys()] };
}

function compactBody(parsed) {
  const faces = parsed.groupFaces.get('body');
  const referenced = [...parsed.groupVertices.get('body')].sort((a, b) => a - b);
  const remap = new Map(referenced.map((oldIndex, newIndex) => [oldIndex, newIndex]));
  const positions = new Float32Array(referenced.length * 3);
  referenced.forEach((oldIndex, newIndex) => positions.set(parsed.positions[oldIndex], newIndex * 3));
  const triangles = [];
  for (const face of faces) {
    if (face.length < 3) continue;
    for (let index = 1; index < face.length - 1; index += 1) {
      triangles.push(remap.get(face[0]), remap.get(face[index]), remap.get(face[index + 1]));
    }
  }
  const indices = new Uint32Array(triangles);
  const normals = computeNormals(positions, indices);
  return { positions, normals, indices, originalVertexIndices: referenced };
}

function computeNormals(positions, indices) {
  const normals = new Float32Array(positions.length);
  for (let offset = 0; offset < indices.length; offset += 3) {
    const ia = indices[offset] * 3; const ib = indices[offset + 1] * 3; const ic = indices[offset + 2] * 3;
    const abx = positions[ib] - positions[ia]; const aby = positions[ib + 1] - positions[ia + 1]; const abz = positions[ib + 2] - positions[ia + 2];
    const acx = positions[ic] - positions[ia]; const acy = positions[ic + 1] - positions[ia + 1]; const acz = positions[ic + 2] - positions[ia + 2];
    const nx = aby * acz - abz * acy; const ny = abz * acx - abx * acz; const nz = abx * acy - aby * acx;
    for (const base of [ia, ib, ic]) { normals[base] += nx; normals[base + 1] += ny; normals[base + 2] += nz; }
  }
  for (let offset = 0; offset < normals.length; offset += 3) {
    const length = Math.hypot(normals[offset], normals[offset + 1], normals[offset + 2]) || 1;
    normals[offset] /= length; normals[offset + 1] /= length; normals[offset + 2] /= length;
  }
  return normals;
}

function topologicalBoneOrder(rigData) {
  const pending = new Set(Object.keys(rigData)); const result = [];
  while (pending.size) {
    let progress = false;
    for (const name of [...pending].sort()) {
      const parent = rigData[name].parent;
      if (!parent || result.includes(parent)) { result.push(name); pending.delete(name); progress = true; }
    }
    if (!progress) throw new Error(`Rig hierarchy contains unresolved parents: ${[...pending].join(', ')}`);
  }
  return result;
}

function resolvePosition(strategy, parsed) {
  if (!strategy) throw new Error('Rig position strategy is missing.');
  if (strategy.strategy === 'VERTEX') return [...parsed.positions[strategy.vertex_index]];
  if (strategy.strategy === 'MEAN') return mean(strategy.vertex_indices.map((index) => parsed.positions[index]));
  if (strategy.strategy === 'CUBE') {
    const vertices = parsed.groupVertices.get(strategy.cube_name);
    if (!vertices?.size) throw new Error(`Rig CUBE group is missing: ${strategy.cube_name}`);
    return mean([...vertices].map((index) => parsed.positions[index]));
  }
  if (Array.isArray(strategy.default_position)) {
    const [x, blenderY, blenderZ] = strategy.default_position;
    return [x, blenderZ, -blenderY];
  }
  throw new Error(`Unsupported rig position strategy: ${strategy.strategy}`);
}

function mean(vectors) {
  const result = [0, 0, 0];
  for (const vector of vectors) { result[0] += vector[0]; result[1] += vector[1]; result[2] += vector[2]; }
  return result.map((value) => value / vectors.length);
}

function buildWeights({ weightData, originalVertexIndices, boneIndex }) {
  const influenceByVertex = new Map();
  for (const [boneName, entries] of Object.entries(weightData.weights)) {
    if (!boneIndex.has(boneName)) throw new Error(`Official weights reference a missing rig bone: ${boneName}`);
    const joint = boneIndex.get(boneName);
    for (const [vertexIndex, weight] of entries) {
      if (!influenceByVertex.has(vertexIndex)) influenceByVertex.set(vertexIndex, []);
      influenceByVertex.get(vertexIndex).push({ joint, weight: Number(weight), boneName });
    }
  }
  const joints = new Uint16Array(originalVertexIndices.length * 4);
  const weights = new Float32Array(originalVertexIndices.length * 4);
  let maximumInfluencesBeforeTruncation = 0; let verticesAboveFourInfluences = 0; let maximumDiscardedWeight = 0; let discardedWeightSum = 0; let zeroWeightVertices = 0;
  originalVertexIndices.forEach((originalIndex, compactIndex) => {
    const influences = [...(influenceByVertex.get(originalIndex) ?? [])].filter((entry) => entry.weight > 0).sort((a, b) => b.weight - a.weight || a.joint - b.joint);
    maximumInfluencesBeforeTruncation = Math.max(maximumInfluencesBeforeTruncation, influences.length);
    if (influences.length > 4) verticesAboveFourInfluences += 1;
    if (!influences.length) { zeroWeightVertices += 1; throw new Error(`Official weights are missing for body vertex ${originalIndex}.`); }
    const kept = influences.slice(0, 4); const discarded = influences.slice(4).reduce((sum, entry) => sum + entry.weight, 0);
    maximumDiscardedWeight = Math.max(maximumDiscardedWeight, discarded); discardedWeightSum += discarded;
    const sum = kept.reduce((total, entry) => total + entry.weight, 0);
    kept.forEach((entry, slot) => { joints[compactIndex * 4 + slot] = entry.joint; weights[compactIndex * 4 + slot] = entry.weight / sum; });
  });
  return { joints, weights, maximumInfluencesBeforeTruncation, verticesAboveFourInfluences, maximumDiscardedWeight, meanDiscardedWeight: discardedWeightSum / originalVertexIndices.length, zeroWeightVertices };
}

function buildGlb({ body, rigData, boneOrder, boneHeads, weights }) {
  const chunks = []; const bufferViews = []; const accessors = [];
  const append = (typed, target = undefined) => {
    let offset = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const pad = (4 - (offset % 4)) % 4; if (pad) { chunks.push(Buffer.alloc(pad)); offset += pad; }
    const bytes = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength); chunks.push(bytes);
    const view = { buffer: 0, byteOffset: offset, byteLength: bytes.length }; if (target) view.target = target;
    bufferViews.push(view); return bufferViews.length - 1;
  };
  const addAccessor = (typed, componentType, type, count, options = {}) => {
    const bufferView = append(typed, options.target); const accessor = { bufferView, componentType, count, type };
    if (options.min) accessor.min = options.min; if (options.max) accessor.max = options.max; if (options.normalized) accessor.normalized = true;
    accessors.push(accessor); return accessors.length - 1;
  };
  const bounds = vectorBounds(body.positions);
  const positionAccessor = addAccessor(body.positions, 5126, 'VEC3', body.positions.length / 3, { target: 34962, ...bounds });
  const normalAccessor = addAccessor(body.normals, 5126, 'VEC3', body.normals.length / 3, { target: 34962 });
  const jointAccessor = addAccessor(weights.joints, 5123, 'VEC4', weights.joints.length / 4, { target: 34962 });
  const weightAccessor = addAccessor(weights.weights, 5126, 'VEC4', weights.weights.length / 4, { target: 34962 });
  const indexAccessor = addAccessor(body.indices, 5125, 'SCALAR', body.indices.length, { target: 34963, min: [0], max: [body.positions.length / 3 - 1] });
  const inverseBindMatrices = new Float32Array(boneOrder.length * 16);
  boneOrder.forEach((name, index) => inverseBindMatrices.set(translationMatrix(boneHeads.get(name).map((value) => -value)), index * 16));
  const inverseBindAccessor = addAccessor(inverseBindMatrices, 5126, 'MAT4', boneOrder.length);
  const nodes = [{ name: 'NeutralBodyCandidateA', mesh: 0, skin: 0 }];
  const nodeIndexByBone = new Map(boneOrder.map((name, index) => [name, index + 1]));
  for (const name of boneOrder) {
    const parent = rigData[name].parent;
    const head = boneHeads.get(name); const parentHead = parent ? boneHeads.get(parent) : [0, 0, 0];
    nodes.push({ name, translation: head.map((value, axis) => value - parentHead[axis]) });
  }
  for (const name of boneOrder) {
    const parent = rigData[name].parent;
    if (!parent) continue;
    const parentNode = nodes[nodeIndexByBone.get(parent)];
    if (!parentNode.children) parentNode.children = [];
    parentNode.children.push(nodeIndexByBone.get(name));
  }
  const rootNodes = boneOrder.filter((name) => !rigData[name].parent).map((name) => nodeIndexByBone.get(name));
  const bin = Buffer.concat(chunks);
  const gltf = {
    asset: { version: '2.0', generator: 'Humanoid-Rig-Lab-Next Task15A CC0 asset converter', extras: { sourceRepository: 'https://github.com/makehumancommunity/mpfb2', sourceCommit, license: 'CC0-1.0' } },
    scene: 0,
    scenes: [{ name: 'CandidateAScene', nodes: [0, ...rootNodes] }],
    nodes,
    meshes: [{ name: 'CandidateABodyMesh', primitives: [{ attributes: { POSITION: positionAccessor, NORMAL: normalAccessor, JOINTS_0: jointAccessor, WEIGHTS_0: weightAccessor }, indices: indexAccessor, material: 0 }] }],
    skins: [{ name: 'CandidateAGameEngineSkin', inverseBindMatrices: inverseBindAccessor, skeleton: nodeIndexByBone.get('Root'), joints: boneOrder.map((name) => nodeIndexByBone.get(name)) }],
    materials: [{ name: 'CandidateANeutralSkin', pbrMetallicRoughness: { baseColorFactor: [0.61, 0.37, 0.25, 1], metallicFactor: 0, roughnessFactor: 0.7 }, doubleSided: false }],
    accessors,
    bufferViews,
    buffers: [{ byteLength: bin.length }],
  };
  return encodeGlb(gltf, bin);
}

function vectorBounds(values) {
  const min = [Infinity, Infinity, Infinity]; const max = [-Infinity, -Infinity, -Infinity];
  for (let offset = 0; offset < values.length; offset += 3) for (let axis = 0; axis < 3; axis += 1) { min[axis] = Math.min(min[axis], values[offset + axis]); max[axis] = Math.max(max[axis], values[offset + axis]); }
  return { min, max };
}
function translationMatrix([x, y, z]) { return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1]); }
function encodeGlb(json, bin) {
  const jsonRaw = Buffer.from(JSON.stringify(json)); const jsonPad = (4 - (jsonRaw.length % 4)) % 4; const jsonChunk = Buffer.concat([jsonRaw, Buffer.alloc(jsonPad, 0x20)]);
  const binPad = (4 - (bin.length % 4)) % 4; const binChunk = Buffer.concat([bin, Buffer.alloc(binPad)]);
  const output = Buffer.alloc(12 + 8 + jsonChunk.length + 8 + binChunk.length);
  output.writeUInt32LE(0x46546c67, 0); output.writeUInt32LE(2, 4); output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(jsonChunk.length, 12); output.writeUInt32LE(0x4e4f534a, 16); jsonChunk.copy(output, 20);
  const binHeader = 20 + jsonChunk.length; output.writeUInt32LE(binChunk.length, binHeader); output.writeUInt32LE(0x004e4942, binHeader + 4); binChunk.copy(output, binHeader + 8);
  return output;
}
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex').toUpperCase(); }
function writeJson(filename, value) { fs.writeFileSync(filename, `${JSON.stringify(value, null, 2)}\n`); }
function parseArgs(values) { const result = {}; for (let index = 0; index < values.length; index += 2) result[values[index].replace(/^--/, '')] = values[index + 1]; return result; }
