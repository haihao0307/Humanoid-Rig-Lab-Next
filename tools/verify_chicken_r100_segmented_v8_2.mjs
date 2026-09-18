import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  CHICKEN_PHASE1_SEGMENTED_NECK_REVISION,
  CHICKEN_PHASE1_SEGMENTED_TOPOLOGY_REVISION,
  CHICKEN_PHASE1_SEGMENTED_CURVE_REVISION,
  splitChickenPhase1BodyDomains,
  sampleChickenPhase1SegmentedNeckProfile,
  parameterizeChickenPhase1SegmentedControlPoints,
  prependChickenPhase1BuriedNeckRoot
} from '../runtime/chicken_phase1_segmented_neck_adapter.mjs';
import {
  createChickenPhase1Pchip,
  createChickenPhase1ArcLengthMap
} from '../runtime/chicken_phase1_centerline_sweep_adapter.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const HTML = fs.readFileSync(path.join(ROOT, 'CHICKEN_V46_R9_9_1_GAMEPLAY_HEAD.html'), 'utf8');
const RING_COUNT = 34;
const RING_SIZE = 28;
const ROOT_BURIAL = 0.09;
const FAR_ARC_THRESHOLD = 0.20;

function decodeFloat(id) {
  const match = HTML.match(new RegExp(`<script[^>]+id=["']${id}["'][^>]*>([^<]+)</script>`));
  assert.ok(match, `missing ${id}`);
  const bytes = Buffer.from(match[1].trim(), 'base64');
  return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
}

function decodeUint(id) {
  const match = HTML.match(new RegExp(`<script[^>]+id=["']${id}["'][^>]*>([^<]+)</script>`));
  assert.ok(match, `missing ${id}`);
  const bytes = Buffer.from(match[1].trim(), 'base64');
  return new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
}

const xs = decodeFloat('carrier-x');
const centers = decodeFloat('carrier-center');
const coefficients = decodeFloat('carrier-coef');
const sourceIndices = decodeUint('carrier-index');
const harmonics = Math.round((coefficients.length / xs.length - 1) / 2);
const sourceRingSize = 96;
const sourcePositions = new Float32Array(xs.length * sourceRingSize * 3 + 6);

for (let station = 0; station < xs.length; station++) {
  const x = xs[station];
  const cy = centers[station * 2];
  const cz = centers[station * 2 + 1];
  const offset = station * (1 + 2 * harmonics);
  for (let sample = 0; sample < sourceRingSize; sample++) {
    const theta = -Math.PI + 2 * Math.PI * sample / sourceRingSize;
    let radius = coefficients[offset];
    for (let harmonic = 1; harmonic <= harmonics; harmonic++) {
      radius += coefficients[offset + harmonic] * Math.cos(harmonic * theta);
      radius += coefficients[offset + harmonics + harmonic] * Math.sin(harmonic * theta);
    }
    const vertex = (station * sourceRingSize + sample) * 3;
    sourcePositions[vertex] = x;
    sourcePositions[vertex + 1] = cy + radius * Math.cos(theta);
    sourcePositions[vertex + 2] = cz + radius * Math.sin(theta);
  }
}
const posterior = xs.length * sourceRingSize * 3;
sourcePositions.set([xs[0], centers[0], centers[1]], posterior);
sourcePositions.set([xs.at(-1), centers.at(-2), centers.at(-1)], posterior + 3);
const domains = splitChickenPhase1BodyDomains(sourcePositions, sourceIndices);

const bind = {
  body_root: [-0.08, 0.39, 0.09], pelvis: [-0.08, 0.39, 0.09], chest: [0.10, 0.58, 0.09],
  neck_base: [0.10, 0.58, 0.09], neck_c0: [0.16, 0.65, 0.09], neck_c1: [0.22, 0.72, 0.09],
  neck_c2: [0.28, 0.80, 0.09], neck_c3: [0.34, 0.87, 0.09], head_base: [0.37, 0.91, 0.09],
  head: [0.39, 0.93, 0.09]
};
const parent = {
  body_root: null, pelvis: 'body_root', chest: 'pelvis', neck_base: 'chest', neck_c0: 'neck_base',
  neck_c1: 'neck_c0', neck_c2: 'neck_c1', neck_c3: 'neck_c2', head_base: 'neck_c3', head: 'head_base'
};
const PECK_SOURCE_PATH = path.join(ROOT, 'runtime', 'chicken_phase1_peck_adapter.mjs');
const PECK_SOURCE = fs.readFileSync(PECK_SOURCE_PATH, 'utf8');

function parseActivePeckProfile(source) {
  const objectMatch = source.match(/const peck=\{([^}]+)\};/);
  const crouchMatch = source.match(/rootCrouch:([+\-.0-9]+)\*peckDepth/);
  assert.ok(objectMatch, 'active peck angle table was not found');
  assert.ok(crouchMatch, 'active peck root crouch was not found');
  const raw = Object.fromEntries(objectMatch[1].split(',').map((entry) => {
    const [key, value] = entry.split(':').map((item) => item.trim());
    const numeric = Number(value);
    assert.ok(key && Number.isFinite(numeric), `invalid active peck entry: ${entry}`);
    return [key, numeric];
  }));
  const required = ['pelvis','chest','neckBase','neck0','neck1','neck2','neck3','headBase','head'];
  for (const key of required) assert.ok(Number.isFinite(raw[key]), `missing active peck key ${key}`);
  return Object.freeze({
    sha256: createHash('sha256').update(source).digest('hex'),
    rootCrouch: Number(crouchMatch[1]),
    angles: Object.freeze({
      pelvis: raw.pelvis,
      chest: raw.chest,
      neck_base: raw.neckBase,
      neck_c0: raw.neck0,
      neck_c1: raw.neck1,
      neck_c2: raw.neck2,
      neck_c3: raw.neck3,
      head_base: raw.headBase,
      head: raw.head
    })
  });
}

const peckProfile = parseActivePeckProfile(PECK_SOURCE);

function rotate2(vector, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return [
    cosine * vector[0] - sine * vector[1],
    sine * vector[0] + cosine * vector[1],
    vector[2]
  ];
}

function worldState(peck = false) {
  const output = {};
  for (const id of Object.keys(parent)) {
    const parentId = parent[id];
    const bindPosition = bind[id];
    const parentBind = parentId ? bind[parentId] : [0, 0, 0];
    const local = [
      bindPosition[0] - parentBind[0],
      bindPosition[1] - parentBind[1],
      bindPosition[2] - parentBind[2]
    ];
    if (!parentId) {
      output[id] = {
        position: [bindPosition[0], bindPosition[1] + (peck ? peckProfile.rootCrouch : 0), bindPosition[2]],
        angle: peck ? peckProfile.angles[id] || 0 : 0
      };
      continue;
    }
    const parentAngle = output[parentId].angle;
    const rotated = rotate2(local, parentAngle);
    output[id] = {
      position: [
        output[parentId].position[0] + rotated[0],
        output[parentId].position[1] + rotated[1],
        output[parentId].position[2] + rotated[2]
      ],
      angle: parentAngle + (peck ? peckProfile.angles[id] || 0 : 0)
    };
  }
  return output;
}

const bindState = worldState(false);
const poseState = worldState(true);
const neckIds = ['neck_base', 'neck_c0', 'neck_c1', 'neck_c2', 'neck_c3', 'head_base'];
const cervicalBind = neckIds.map((id) => bindState[id].position);
const cervicalPose = neckIds.map((id) => poseState[id].position);
const bindPoints = prependChickenPhase1BuriedNeckRoot(cervicalBind, ROOT_BURIAL);
const posePoints = prependChickenPhase1BuriedNeckRoot(cervicalPose, ROOT_BURIAL);
const curveParameters = parameterizeChickenPhase1SegmentedControlPoints(bindPoints);

function buildTube(points) {
  const curve = createChickenPhase1Pchip(curveParameters, points);
  const arc = createChickenPhase1ArcLengthMap(curve, 0, 1, 4096);
  const tube = [];
  const tubeCenters = [];
  for (let ring = 0; ring < RING_COUNT; ring++) {
    const fraction = ring / (RING_COUNT - 1);
    const t = arc.xAtFraction(fraction);
    const center = curve.evaluate(t);
    const derivative = curve.derivative(t);
    const derivativeLength = Math.hypot(...derivative);
    const tangentX = derivative[0] / derivativeLength;
    const tangentY = derivative[1] / derivativeLength;
    tubeCenters.push(center);
    const profile = sampleChickenPhase1SegmentedNeckProfile(fraction);
    const ringPoints = [];
    for (let sample = 0; sample < RING_SIZE; sample++) {
      const theta = 2 * Math.PI * sample / RING_SIZE;
      const cosine = Math.cos(theta);
      const sine = Math.sin(theta);
      const normalRadius = profile.normal * (cosine < 0 ? profile.ventral : 1);
      ringPoints.push([
        center[0] - tangentY * normalRadius * cosine,
        center[1] + tangentX * normalRadius * cosine,
        center[2] + profile.lateral * sine
      ]);
    }
    tube.push(ringPoints);
  }
  return { tube, centers: tubeCenters, length: arc.totalLength };
}

const bindTube = buildTube(bindPoints);
const poseTube = buildTube(posePoints);
const longitudinal = [];
const radial = [];
const poseRadius = [];
for (let ring = 0; ring < RING_COUNT; ring++) {
  let maximumRadius = 0;
  for (let sample = 0; sample < RING_SIZE; sample++) {
    const bindPoint = bindTube.tube[ring][sample];
    const posePoint = poseTube.tube[ring][sample];
    const bindCenter = bindTube.centers[ring];
    const poseCenter = poseTube.centers[ring];
    const bindRadius = Math.hypot(
      bindPoint[0] - bindCenter[0], bindPoint[1] - bindCenter[1], bindPoint[2] - bindCenter[2]
    );
    const currentRadius = Math.hypot(
      posePoint[0] - poseCenter[0], posePoint[1] - poseCenter[1], posePoint[2] - poseCenter[2]
    );
    radial.push(currentRadius / Math.max(1e-8, bindRadius));
    maximumRadius = Math.max(maximumRadius, currentRadius);
    if (ring < RING_COUNT - 1) {
      const bindNext = bindTube.tube[ring + 1][sample];
      const poseNext = poseTube.tube[ring + 1][sample];
      const bindLength = Math.hypot(
        bindNext[0] - bindPoint[0], bindNext[1] - bindPoint[1], bindNext[2] - bindPoint[2]
      );
      const poseLength = Math.hypot(
        poseNext[0] - posePoint[0], poseNext[1] - posePoint[1], poseNext[2] - posePoint[2]
      );
      longitudinal.push(poseLength / Math.max(1e-8, bindLength));
    }
  }
  poseRadius.push(maximumRadius);
}

function quantile(values, q) {
  const sorted = [...values].sort((a, b) => a - b);
  const location = (sorted.length - 1) * q;
  const lower = Math.floor(location);
  const upper = Math.ceil(location);
  return lower === upper
    ? sorted[lower]
    : sorted[lower] + (sorted[upper] - sorted[lower]) * (location - lower);
}

function interpolateSeries(values, x) {
  if (x <= xs[0]) return values[0];
  if (x >= xs.at(-1)) return values.at(-1);
  for (let index = 0; index < xs.length - 1; index++) {
    if (x > xs[index + 1]) continue;
    const t = (x - xs[index]) / (xs[index + 1] - xs[index]);
    return values[index] + (values[index + 1] - values[index]) * t;
  }
  return values.at(-1);
}

function sourceInside(point) {
  const [x, y, z] = point;
  if (x < xs[0] || x > xs.at(-1)) return false;
  const cy = interpolateSeries(Array.from({ length: xs.length }, (_, i) => centers[i * 2]), x);
  const cz = interpolateSeries(Array.from({ length: xs.length }, (_, i) => centers[i * 2 + 1]), x);
  const stride = 1 + 2 * harmonics;
  const interpolated = [];
  for (let coefficient = 0; coefficient < stride; coefficient++) {
    interpolated.push(interpolateSeries(
      Array.from({ length: xs.length }, (_, i) => coefficients[i * stride + coefficient]),
      x
    ));
  }
  const dy = y - cy;
  const dz = z - cz;
  const theta = Math.atan2(dz, dy);
  const radius = Math.hypot(dy, dz);
  let surfaceRadius = interpolated[0];
  for (let harmonic = 1; harmonic <= harmonics; harmonic++) {
    surfaceRadius += interpolated[harmonic] * Math.cos(harmonic * theta);
    surfaceRadius += interpolated[harmonics + harmonic] * Math.sin(harmonic * theta);
  }
  return radius <= surfaceRadius + 1e-9;
}

const rootRingInsideFraction = bindTube.tube[0].filter(sourceInside).length / RING_SIZE;
const poseArc = [0];
for (let ring = 1; ring < RING_COUNT; ring++) {
  const previous = poseTube.centers[ring - 1];
  const current = poseTube.centers[ring];
  poseArc.push(poseArc.at(-1) + Math.hypot(
    current[0] - previous[0], current[1] - previous[1], current[2] - previous[2]
  ));
}
let farArcClearanceMin = Infinity;
for (let first = 0; first < RING_COUNT; first++) {
  for (let second = first + 1; second < RING_COUNT; second++) {
    if (poseArc[second] - poseArc[first] < FAR_ARC_THRESHOLD) continue;
    const a = poseTube.centers[first];
    const b = poseTube.centers[second];
    const clearance = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
      - poseRadius[first] - poseRadius[second];
    farArcClearanceMin = Math.min(farArcClearanceMin, clearance);
  }
}

const headVertexIds = [...new Set(Array.from(domains.headIndices))];
const headPose = poseState.head;
const headBind = bindState.head;
const posedHeadVertices = headVertexIds.map((vertex) => {
  const point = [
    sourcePositions[vertex * 3] - headBind.position[0],
    sourcePositions[vertex * 3 + 1] - headBind.position[1],
    sourcePositions[vertex * 3 + 2] - headBind.position[2]
  ];
  const rotated = rotate2(point, headPose.angle - headBind.angle);
  return [
    headPose.position[0] + rotated[0],
    headPose.position[1] + rotated[1],
    headPose.position[2] + rotated[2]
  ];
});
const headSeamDistances = poseTube.tube.at(-1).map((point) => {
  let nearest = Infinity;
  for (const headPoint of posedHeadVertices) {
    nearest = Math.min(nearest, Math.hypot(
      point[0] - headPoint[0], point[1] - headPoint[1], point[2] - headPoint[2]
    ));
  }
  return nearest;
});

const beakLocal = [0.096, -0.011, 0];
const beakOffset = rotate2(beakLocal, headPose.angle);
const beak = [
  headPose.position[0] + beakOffset[0],
  headPose.position[1] + beakOffset[1],
  headPose.position[2] + beakOffset[2]
];

const metrics = {
  schema: 'life_ecosystem/chicken_segmented_geometry_qa@1.1',
  version: 'V4.6_R10.0_SEGMENTED_NECK_V8_2_CANDIDATE',
  revision: CHICKEN_PHASE1_SEGMENTED_NECK_REVISION,
  peckProfileSha256: peckProfile.sha256,
  passed: false,
  domains: {
    sourceTriangles: sourceIndices.length / 3,
    torsoTriangles: domains.torsoIndices.length / 3,
    headTriangles: domains.headIndices.length / 3,
    headStartX: domains.headStartX
  },
  tube: {
    startMode: 'buried-root',
    rootBurial: ROOT_BURIAL,
    ringCount: RING_COUNT,
    ringSize: RING_SIZE,
    vertices: RING_COUNT * RING_SIZE,
    triangles: (RING_COUNT - 1) * RING_SIZE * 2,
    bindCurveLength: bindTube.length,
    poseCurveLength: poseTube.length,
    curveLengthRatio: poseTube.length / bindTube.length,
    longitudinalRatioMin: Math.min(...longitudinal),
    longitudinalRatioMedian: quantile(longitudinal, 0.5),
    longitudinalRatioP95: quantile(longitudinal, 0.95),
    longitudinalRatioMax: Math.max(...longitudinal),
    radialRatioMin: Math.min(...radial),
    radialRatioMax: Math.max(...radial),
    farArcThreshold: FAR_ARC_THRESHOLD,
    farArcClearanceMin
  },
  seams: {
    rootRingInsideSourceFraction: rootRingInsideFraction,
    tubeEndToHead: {
      min: Math.min(...headSeamDistances),
      median: quantile(headSeamDistances, 0.5),
      max: Math.max(...headSeamDistances)
    }
  },
  contact: { beak, billGroundError: beak[1] },
  truthBoundary: {
    staticGeometryOnly: true,
    browserRenderPassed: false,
    manualVisualAcceptance: false,
    collisionComplete: false,
    groupTestAuthorized: false
  }
};
metrics.checks = {
  revision: metrics.revision === 'segmented-rigid-head-and-buried-root-neck-v8-2',
  topology: CHICKEN_PHASE1_SEGMENTED_TOPOLOGY_REVISION === 'torso-buried-neck-rigid-head-v8-2',
  curve: CHICKEN_PHASE1_SEGMENTED_CURVE_REVISION === 'bone-centerline-parallel-transport-with-buried-root-v4',
  domainCounts: metrics.domains.torsoTriangles === 9966 && metrics.domains.headTriangles === 2016,
  buriedRoot: metrics.tube.startMode === 'buried-root'
    && Math.abs(metrics.tube.rootBurial - 0.09) < 1e-12
    && bindPoints.length === 7,
  rootRingBuried: metrics.seams.rootRingInsideSourceFraction >= 0.95,
  headOverlap: metrics.seams.tubeEndToHead.max <= 0.065,
  farArcClearance: metrics.tube.farArcClearanceMin > 0,
  curveLengthStable: metrics.tube.curveLengthRatio >= 0.90 && metrics.tube.curveLengthRatio <= 1.10,
  longitudinalP95: metrics.tube.longitudinalRatioP95 <= 1.50,
  longitudinalMax: metrics.tube.longitudinalRatioMax <= 2.00,
  radialPreserved: Math.abs(metrics.tube.radialRatioMin - 1) <= 1e-9
    && Math.abs(metrics.tube.radialRatioMax - 1) <= 1e-9,
  billGrounded: metrics.contact.billGroundError >= -0.04 && metrics.contact.billGroundError <= 0.07
};
metrics.passed = Object.values(metrics.checks).every(Boolean);

fs.mkdirSync(path.join(ROOT, 'qa'), { recursive: true });
fs.writeFileSync(
  path.join(ROOT, 'qa', 'CHICKEN_R100_SEGMENTED_V8_2_GEOMETRY_QA.json'),
  `${JSON.stringify(metrics, null, 2)}\n`
);
console.log(JSON.stringify(metrics, null, 2));
if (!metrics.passed) process.exit(1);
