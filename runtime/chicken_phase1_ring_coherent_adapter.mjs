import {
  CHICKEN_PHASE1_VOLUME_NECK_BONE_ORDER,
  createChickenPhase1PeckAdapter
} from './chicken_phase1_peck_adapter.mjs';
import { summarizeVertexKinds } from './chicken_phase1_articulated_skin.mjs';

const EPSILON = 1e-8;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const sat = (value) => clamp(value, 0, 1);
const smooth = (a, b, value) => {
  const t = sat((value - a) / (b - a || 1));
  return t * t * (3 - 2 * t);
};

/**
 * Longitudinal control stations for the articulated head/neck chain.
 *
 * Important: these stations describe the chain parameter only. They are not
 * anatomical cross-section labels. The source body is one radial sweep whose
 * anterior stations contain both lower breast vertices and upper neck/head
 * vertices, so x alone must never decide whether a vertex follows the neck.
 */
const CARRIER_STATIONS = Object.freeze([
  Object.freeze({ x: -0.36, boneId: 'pelvis' }),
  Object.freeze({ x: 0.060, boneId: 'chest' }),
  Object.freeze({ x: 0.120, boneId: 'neck_base' }),
  Object.freeze({ x: 0.180, boneId: 'neck_c0' }),
  Object.freeze({ x: 0.240, boneId: 'neck_c1' }),
  Object.freeze({ x: 0.300, boneId: 'neck_c2' }),
  Object.freeze({ x: 0.350, boneId: 'neck_c3' }),
  Object.freeze({ x: 0.382, boneId: 'head_base' }),
  Object.freeze({ x: 0.420, boneId: 'head' })
]);

export function computeChickenPhase1CarrierStationBlend(x) {
  if (!Number.isFinite(x)) throw new TypeError('carrier station x must be finite');
  const first = CARRIER_STATIONS[0];
  const last = CARRIER_STATIONS[CARRIER_STATIONS.length - 1];
  if (x <= first.x) return Object.freeze([{ boneId: first.boneId, weight: 1 }]);
  if (x >= last.x) return Object.freeze([{ boneId: last.boneId, weight: 1 }]);

  for (let index = 0; index < CARRIER_STATIONS.length - 1; index++) {
    const a = CARRIER_STATIONS[index];
    const b = CARRIER_STATIONS[index + 1];
    if (x > b.x) continue;
    const t = smooth(a.x, b.x, x);
    const blend = [];
    if (1 - t > EPSILON) blend.push(Object.freeze({ boneId: a.boneId, weight: 1 - t }));
    if (t > EPSILON) blend.push(Object.freeze({ boneId: b.boneId, weight: t }));
    return Object.freeze(blend);
  }
  return Object.freeze([{ boneId: last.boneId, weight: 1 }]);
}

/**
 * Lower boundary of the anatomical neck/head sector in bind-pose space.
 * It follows the rising ventral contour rather than the radial-sweep station.
 */
export function computeChickenPhase1NeckSectorFloor(x) {
  if (!Number.isFinite(x)) throw new TypeError('neck sector x must be finite');
  if (x <= 0.14) return 0.52;
  if (x <= 0.24) return 0.52 + (x - 0.14) * 0.90;
  if (x <= 0.33) return 0.61 + (x - 0.24) * 1.22;
  if (x <= 0.41) return 0.72 + (x - 0.33) * 1.38;
  return 0.83;
}

/**
 * Returns 0 for torso/breast vertices and 1 for the articulated neck/head
 * sector.  The transition is intentionally two-dimensional: vertices at the
 * same x station can receive different domains according to y.
 */
export function computeChickenPhase1NeckSectorGate(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new TypeError('neck sector coordinates must be finite');
  }
  const floor = computeChickenPhase1NeckSectorFloor(x);
  const vertical = smooth(floor - 0.040, floor + 0.060, y);
  const anteriorOnset = smooth(0.045, 0.115, x);
  const cranialLock = smooth(0.395, 0.445, x) * smooth(0.760, 0.840, y);
  return sat(Math.max(vertical * anteriorOnset, cranialLock));
}

function computeTorsoAnchorBlend(x) {
  const chestWeight = smooth(-0.22, 0.035, x);
  const blend = [];
  if (1 - chestWeight > EPSILON) blend.push({ boneId: 'pelvis', weight: 1 - chestWeight });
  if (chestWeight > EPSILON) blend.push({ boneId: 'chest', weight: chestWeight });
  return blend;
}

function mergeBoneBlend(entries) {
  const merged = new Map();
  for (const entry of entries) {
    if (!entry || entry.weight <= EPSILON) continue;
    merged.set(entry.boneId, (merged.get(entry.boneId) || 0) + entry.weight);
  }
  const selected = [...merged.entries()]
    .map(([boneId, weight]) => ({ boneId, weight }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 4);
  let total = selected.reduce((sum, item) => sum + item.weight, 0);
  if (total <= EPSILON) {
    selected.length = 0;
    selected.push({ boneId: 'pelvis', weight: 1 });
    total = 1;
  }
  return Object.freeze(selected.map((item) => Object.freeze({
    boneId: item.boneId,
    weight: item.weight / total
  })));
}

/**
 * Anatomically sector-gated carrier blend.  The lower sector remains on the
 * torso anchor while the upper sector follows the longitudinal neck chain.
 */
export function computeChickenPhase1SectorCarrierBlend(x, y) {
  const gate = computeChickenPhase1NeckSectorGate(x, y);
  const anchor = computeTorsoAnchorBlend(x)
    .map((item) => ({ ...item, weight: item.weight * (1 - gate) }));
  const chain = computeChickenPhase1CarrierStationBlend(x)
    .map((item) => ({ ...item, weight: item.weight * gate }));
  return mergeBoneBlend([...anchor, ...chain]);
}

function packBoneBlend(blend, boneIndex) {
  const indices = [0, 0, 0, 0];
  const weights = [0, 0, 0, 0];
  for (let slot = 0; slot < blend.length; slot++) {
    const index = boneIndex[blend[slot].boneId];
    if (!Number.isInteger(index)) throw new Error(`missing carrier bone ${blend[slot].boneId}`);
    indices[slot] = index;
    weights[slot] = blend[slot].weight;
  }
  return { indices, weights };
}

/**
 * Find one bind-space root per coat element.  All vertices sharing a seed use
 * exactly the same root x/y and therefore exactly the same skin weights.  This
 * keeps every procedural feather rigid while still separating low breast coat
 * from upper neck coat.
 */
export function computeChickenPhase1CoatRootAnchors(positions, seedValues, uvValues) {
  if (!positions || positions.length % 3 !== 0) {
    throw new TypeError('coat positions must contain xyz triples');
  }
  const count = positions.length / 3;
  const rootX = new Float32Array(count);
  const rootY = new Float32Array(count);

  if (!seedValues || seedValues.length !== count) {
    for (let index = 0; index < count; index++) {
      rootX[index] = positions[index * 3];
      rootY[index] = positions[index * 3 + 1];
    }
    return { rootX, rootY, rootRigid: false, elementCount: count };
  }

  const roots = new Map();
  for (let index = 0; index < count; index++) {
    const seed = seedValues[index];
    const station = uvValues && uvValues.length >= count * 2
      ? uvValues[index * 2]
      : index;
    let root = roots.get(seed);
    if (!root || station < root.station - 1e-6) {
      root = {
        station,
        sumX: positions[index * 3],
        sumY: positions[index * 3 + 1],
        samples: 1
      };
      roots.set(seed, root);
    } else if (Math.abs(station - root.station) <= 1e-6) {
      root.sumX += positions[index * 3];
      root.sumY += positions[index * 3 + 1];
      root.samples += 1;
    }
  }

  for (let index = 0; index < count; index++) {
    const root = roots.get(seedValues[index]);
    rootX[index] = root.sumX / root.samples;
    rootY[index] = root.sumY / root.samples;
  }
  return { rootX, rootY, rootRigid: true, elementCount: roots.size };
}

function summarizePrimaryCounts(counts) {
  const result = {};
  for (let index = 0; index < counts.length; index++) {
    if (counts[index]) result[CHICKEN_PHASE1_VOLUME_NECK_BONE_ORDER[index]] = counts[index];
  }
  return Object.freeze(result);
}

function rebindCarrierMesh(THREE, mesh, meshIndex, boneIndex, skeleton) {
  const geometry = mesh.geometry;
  const positions = geometry.attributes.position.array;
  const kind = mesh.userData?.materialKind || 'body';
  const count = positions.length / 3;
  const seedValues = geometry.attributes.seed?.array || null;
  const uvValues = geometry.attributes.uv?.array || null;
  const carrierUV = geometry.attributes.carrierUV?.array || null;
  const vertexKinds = geometry.attributes.kind?.array || null;
  const localCoords = geometry.attributes.localCoord?.array || null;
  const coatRoots = kind === 'coat'
    ? computeChickenPhase1CoatRootAnchors(positions, seedValues, uvValues)
    : null;
  const indices = new Uint16Array(count * 4);
  const weights = new Float32Array(count * 4);
  const primaryCounts = new Uint32Array(CHICKEN_PHASE1_VOLUME_NECK_BONE_ORDER.length);
  let maximumInfluences = 0;
  let lowerSectorVertices = 0;
  let upperSectorVertices = 0;
  let transitionSectorVertices = 0;
  let minimumGate = 1;
  let maximumGate = 0;

  for (let vertex = 0; vertex < count; vertex++) {
    const q = vertex * 3;
    const x = coatRoots ? coatRoots.rootX[vertex] : positions[q];
    const y = coatRoots ? coatRoots.rootY[vertex] : positions[q + 1];
    const gate = computeChickenPhase1NeckSectorGate(x, y);
    minimumGate = Math.min(minimumGate, gate);
    maximumGate = Math.max(maximumGate, gate);
    if (gate <= 0.15) lowerSectorVertices++;
    else if (gate >= 0.85) upperSectorVertices++;
    else transitionSectorVertices++;

    const blend = computeChickenPhase1SectorCarrierBlend(x, y);
    const packed = packBoneBlend(blend, boneIndex);
    maximumInfluences = Math.max(
      maximumInfluences,
      packed.weights.filter((weight) => weight > EPSILON).length
    );
    const offset = vertex * 4;
    for (let slot = 0; slot < 4; slot++) {
      indices[offset + slot] = packed.indices[slot];
      weights[offset + slot] = packed.weights[slot];
    }
    primaryCounts[packed.indices[0]]++;
  }

  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  mesh.bind(skeleton);
  mesh.normalizeSkinWeights();

  return Object.freeze({
    meshIndex,
    materialKind: kind,
    vertexCount: count,
    hasVertexKind: Boolean(vertexKinds),
    hasLocalCoord: Boolean(localCoords),
    hasCarrierUV: Boolean(carrierUV),
    generatedFootMesh: false,
    sectorGatedCarrier: kind === 'body',
    rootRigidSectorCoat: kind === 'coat' && coatRoots?.rootRigid === true,
    coatElementCount: coatRoots?.elementCount || 0,
    maximumCarrierInfluences: maximumInfluences,
    lowerSectorVertices,
    upperSectorVertices,
    transitionSectorVertices,
    neckSectorGateRange: Object.freeze([minimumGate, maximumGate]),
    vertexKindHistogram: summarizeVertexKinds(vertexKinds),
    primaryBoneCounts: summarizePrimaryCounts(primaryCounts)
  });
}

export function createChickenPhase1SectorGatedAdapter(THREE, baseSkin, options = {}) {
  if (!THREE?.Uint16BufferAttribute || !THREE?.Float32BufferAttribute) {
    throw new Error('THREE buffer attribute constructors are required');
  }
  if (baseSkin?.diagnostics?.().weightingRevision === 'sector-gated-carrier-and-root-rigid-coat-v6') {
    return baseSkin;
  }

  const incomingDiagnostics = baseSkin?.diagnostics?.() || {};
  const peckSkin = (
    incomingDiagnostics.boneCount === CHICKEN_PHASE1_VOLUME_NECK_BONE_ORDER.length
    && String(incomingDiagnostics.peckKinematicsRevision || '').startsWith('six-link-')
  )
    ? baseSkin
    : createChickenPhase1PeckAdapter(THREE, baseSkin, options);
  const sourceDiagnostics = peckSkin.diagnostics();
  if (sourceDiagnostics.boneCount !== CHICKEN_PHASE1_VOLUME_NECK_BONE_ORDER.length) {
    throw new Error('six-link peck skeleton was not installed before sector-gated carrier refit');
  }

  const boneIndex = Object.fromEntries(
    CHICKEN_PHASE1_VOLUME_NECK_BONE_ORDER.map((boneId, index) => [boneId, index])
  );
  const sourceAudits = new Map((sourceDiagnostics.meshAudits || []).map((audit) => [audit.meshIndex, audit]));
  const meshAudits = [];
  for (let meshIndex = 0; meshIndex < peckSkin.meshes.length; meshIndex++) {
    const mesh = peckSkin.meshes[meshIndex];
    const kind = mesh?.userData?.materialKind || 'body';
    if (mesh?.isSkinnedMesh && mesh.geometry?.attributes?.position && (kind === 'body' || kind === 'coat')) {
      meshAudits.push(rebindCarrierMesh(THREE, mesh, meshIndex, boneIndex, peckSkin.skeleton));
    } else if (sourceAudits.has(meshIndex)) {
      meshAudits.push(sourceAudits.get(meshIndex));
    }
  }

  const diagnostics = () => {
    const source = peckSkin.diagnostics();
    return {
      ...source,
      schema: 'life_ecosystem/chicken_phase1_articulated_skin_diagnostics@2.2',
      weightingRevision: 'sector-gated-carrier-and-root-rigid-coat-v6',
      peckKinematicsRevision: 'six-link-sector-gated-s-curve-v4',
      sourceWeightingRevision: source.weightingRevision || null,
      meshAudits
    };
  };

  return Object.freeze({
    bones: peckSkin.bones,
    skeleton: peckSkin.skeleton,
    meshes: peckSkin.meshes,
    applyPose: (pose) => peckSkin.applyPose(pose),
    verifyInvariants: () => peckSkin.verifyInvariants(),
    detach: () => peckSkin.detach(),
    diagnostics,
    rootOrigin: peckSkin.rootOrigin
  });
}

// Compatibility export: existing R10.0 integration imports this symbol.
export const createChickenPhase1RingCoherentAdapter = createChickenPhase1SectorGatedAdapter;
