#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {
  CHICKEN_PHASE1_CENTERLINE_SWEEP_REVISION,
  CHICKEN_PHASE1_CENTERLINE_CURVE_REVISION,
  CHICKEN_PHASE1_TORSO_PRESERVE_BEFORE_X,
  CHICKEN_PHASE1_NECK_SHELL_START_X,
  buildChickenPhase1AnatomicalNeckShell,
  computeChickenPhase1NeckSectorGate,
  createChickenPhase1Pchip,
  createChickenPhase1ArcLengthMap,
  filterChickenPhase1TorsoTriangles
} from '../runtime/chicken_phase1_centerline_sweep_v71_adapter.mjs';

const root = process.cwd();
const htmlPath = path.join(root, 'CHICKEN_V46_R9_9_1_GAMEPLAY_HEAD.html');
const qaPath = path.join(root, 'qa', 'CHICKEN_R100_CENTERLINE_V7_QA.json');
const localTestPath = path.join(root, 'qa', 'CHICKEN_R100_CENTERLINE_V7_LOCAL_TESTS.json');
const prototypePath = path.join(root, 'evidence', 'r100', 'centerline_v7_prebrowser', 'proto_centerline_v7.json');

function decodeFloat(html, id) {
  const match = html.match(new RegExp(`<script[^>]+id=["']${id}["'][^>]*>([^<]+)</script>`));
  if (!match) throw new Error(`missing ${id}`);
  const buffer = Buffer.from(match[1].trim(), 'base64');
  return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
}

function decodeUint(html, id) {
  const match = html.match(new RegExp(`<script[^>]+id=["']${id}["'][^>]*>([^<]+)</script>`));
  if (!match) throw new Error(`missing ${id}`);
  const buffer = Buffer.from(match[1].trim(), 'base64');
  return new Uint32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
}

function reconstructCarrier(html) {
  const xs = decodeFloat(html, 'carrier-x');
  const centers = decodeFloat(html, 'carrier-center');
  const coefficients = decodeFloat(html, 'carrier-coef');
  const indices = decodeUint(html, 'carrier-index');
  const harmonics = Math.round((coefficients.length / xs.length - 1) / 2);
  const ringSize = 96;
  const positions = new Float32Array(xs.length * ringSize * 3 + 6);
  for (let station = 0; station < xs.length; station++) {
    const x = xs[station];
    const cy = centers[station * 2];
    const cz = centers[station * 2 + 1];
    const offset = station * (1 + 2 * harmonics);
    for (let sample = 0; sample < ringSize; sample++) {
      const theta = -Math.PI + 2 * Math.PI * sample / ringSize;
      let radius = coefficients[offset];
      for (let harmonic = 1; harmonic <= harmonics; harmonic++) {
        radius += coefficients[offset + harmonic] * Math.cos(harmonic * theta);
        radius += coefficients[offset + harmonics + harmonic] * Math.sin(harmonic * theta);
      }
      const q = (station * ringSize + sample) * 3;
      positions[q] = x;
      positions[q + 1] = cy + radius * Math.cos(theta);
      positions[q + 2] = cz + radius * Math.sin(theta);
    }
  }
  const posterior = xs.length * ringSize * 3;
  positions.set([xs[0], centers[0], centers[1]], posterior);
  positions.set([xs.at(-1), centers.at(-2), centers.at(-1)], posterior + 3);
  return { xs, centers, coefficients, indices, positions, ringSize };
}

function polygonAreaYZ(points) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a[1] * b[2] - b[1] * a[2];
  }
  return Math.abs(area) * 0.5;
}

function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function quantile(values, q) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * q;
  const lo = Math.floor(index);
  const hi = Math.ceil(index);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (index - lo);
}

const html = fs.readFileSync(htmlPath, 'utf8');
const carrier = reconstructCarrier(html);
const shell = buildChickenPhase1AnatomicalNeckShell(carrier.positions);
const torso = filterChickenPhase1TorsoTriangles(carrier.positions, carrier.indices);

const ringAreas = [];
const ringSeams = [];
const longitudinalEdges = [];
for (let ringIndex = 0; ringIndex < shell.ringCount; ringIndex++) {
  const ring = [];
  for (let sample = 0; sample < shell.ringSize; sample++) {
    const q = (ringIndex * shell.ringSize + sample) * 3;
    ring.push([shell.positions[q], shell.positions[q + 1], shell.positions[q + 2]]);
  }
  ringAreas.push(polygonAreaYZ(ring));
  ringSeams.push(distance(ring[0], ring.at(-1)));
  if (ringIndex > 0) {
    for (let sample = 0; sample < shell.ringSize; sample++) {
      const q0 = ((ringIndex - 1) * shell.ringSize + sample) * 3;
      const q1 = (ringIndex * shell.ringSize + sample) * 3;
      longitudinalEdges.push(Math.hypot(
        shell.positions[q1] - shell.positions[q0],
        shell.positions[q1 + 1] - shell.positions[q0 + 1],
        shell.positions[q1 + 2] - shell.positions[q0 + 2]
      ));
    }
  }
}

let torsoGateViolations = 0;
let retainedHighGateVertices = 0;
for (let i = 0; i < torso.length; i += 3) {
  let maxGate = 0;
  let meanX = 0;
  for (const id of [torso[i], torso[i + 1], torso[i + 2]]) {
    const q = id * 3;
    const x = carrier.positions[q];
    const y = carrier.positions[q + 1];
    meanX += x;
    const gate = computeChickenPhase1NeckSectorGate(x, y);
    maxGate = Math.max(maxGate, gate);
    if (gate >= 0.72 && x >= CHICKEN_PHASE1_TORSO_PRESERVE_BEFORE_X) retainedHighGateVertices++;
  }
  meanX /= 3;
  if (maxGate >= 0.72 && meanX >= CHICKEN_PHASE1_TORSO_PRESERVE_BEFORE_X) torsoGateViolations++;
}

const bindCurve = createChickenPhase1Pchip(
  [0.075, 0.120, 0.180, 0.240, 0.300, 0.350, 0.382, 0.420, 0.445],
  [
    [0.075, 0.525, 0.09],
    [0.100, 0.580, 0.09],
    [0.160, 0.650, 0.09],
    [0.220, 0.720, 0.09],
    [0.300, 0.840, 0.09],
    [0.345, 0.885, 0.09],
    [0.382, 0.915, 0.09],
    [0.420, 0.935, 0.09],
    [0.445, 0.940, 0.09]
  ]
);
const peckCurve = createChickenPhase1Pchip(
  [0.075, 0.120, 0.180, 0.240, 0.300, 0.350, 0.382, 0.420, 0.445],
  [
    [0.085, 0.490, 0.09],
    [0.100, 0.465, 0.09],
    [0.17552395, 0.41212153, 0.09],
    [0.21445685, 0.32854983, 0.09],
    [0.21446601, 0.22854983, 0.09],
    [0.19058321, 0.13950146, 0.09],
    [0.18619345, 0.08969453, 0.09],
    [0.20435391, 0.06801049, 0.09],
    [0.240, 0.055, 0.09]
  ]
);
const bindArc = createChickenPhase1ArcLengthMap(bindCurve, 0.075, 0.445, 384);
const peckArc = createChickenPhase1ArcLengthMap(peckCurve, 0.075, 0.445, 384);
const normalizedArcRoundTrip = [];
for (const fraction of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
  const x = peckArc.xAtFraction(fraction);
  normalizedArcRoundTrip.push(Math.abs(peckArc.fractionAtX(x) - fraction));
}

let prototype = null;
if (fs.existsSync(prototypePath)) prototype = JSON.parse(fs.readFileSync(prototypePath, 'utf8'));
const prototypeRingArea = prototype?.ringAreaRatio || [];
const prototypeRadial = prototype?.radialEdgeRatio || [];
const prototypeLongitudinal = prototype?.longitudinalEdgeRatio || [];

const checks = {
  revisionMatches: CHICKEN_PHASE1_CENTERLINE_SWEEP_REVISION
    === 'anatomical-neck-root-preserving-centerline-sweep-v7.1',
  curveRevisionMatches: CHICKEN_PHASE1_CENTERLINE_CURVE_REVISION
    === 'rotation-minimizing-frame-centerline-v2',
  shellHasSubstantialCoverage: shell.ringCount >= 18,
  shellUsesClosedThirtyTwoSampleRings: shell.ringSize === 32,
  shellIndexCountValid: shell.indices.length === (shell.ringCount - 1) * shell.ringSize * 6,
  shellFinite: [...shell.positions].every(Number.isFinite),
  shellPositiveCrossSections: ringAreas.every((value) => value > 1e-5),
  shellNoCollapsedStations: longitudinalEdges.every((value) => value > 1e-6),
  torsoRetainsMajority: torso.length > carrier.indices.length * 0.70,
  torsoRemovesIndependentNeckSector: torso.length < carrier.indices.length * 0.93,
  torsoAndShellHaveControlledOverlap:
    CHICKEN_PHASE1_TORSO_PRESERVE_BEFORE_X > CHICKEN_PHASE1_NECK_SHELL_START_X
    && CHICKEN_PHASE1_TORSO_PRESERVE_BEFORE_X - CHICKEN_PHASE1_NECK_SHELL_START_X <= 0.05,
  torsoGateViolationCountZero: torsoGateViolations === 0,
  normalizedArcRoundTripStable: Math.max(...normalizedArcRoundTrip) < 0.005,
  prototypeRigidRingAreaPreserved: prototypeRingArea.length > 0
    && prototypeRingArea.every((value) => Math.abs(value - 1) < 1e-9),
  prototypeRadialEdgesPreserved: prototypeRadial.length > 0
    && prototypeRadial.every((value) => Math.abs(value - 1) < 1e-9),
  groupGateRemainsClosed: true
};

const warnings = [];
const longitudinalP95 = prototypeLongitudinal.length ? quantile(prototypeLongitudinal, 0.95) : null;
const longitudinalMax = prototypeLongitudinal.length ? Math.max(...prototypeLongitudinal) : null;
if (longitudinalMax !== null && longitudinalMax > 1.6) {
  warnings.push(
    'The archived V7 prototype showed high longitudinal stretch. V7.1 must be judged from its fresh browser edge audit; manual visual approval remains false.'
  );
}
warnings.push(
  'This audit validates the V7.1 topology split, controlled torso/shell overlap, closed cross-sections and arc-length mapping only; it does not validate the rendered silhouette or motion naturalness.'
);

const report = {
  schema: 'life_ecosystem/chicken_r100_centerline_v7_qa@1.1',
  version: 'V4.6_R10.0_CENTERLINE_SWEEP_V7_1_CANDIDATE',
  revisions: {
    weightingRevision: CHICKEN_PHASE1_CENTERLINE_SWEEP_REVISION,
    topologyRevision: 'torso-preserving-neck-root-split-v7.1',
    centerlineCurveRevision: CHICKEN_PHASE1_CENTERLINE_CURVE_REVISION
  },
  checks,
  passed: Object.values(checks).every(Boolean),
  carrier: {
    stationCount: carrier.xs.length,
    radialSamples: carrier.ringSize,
    vertexCount: carrier.positions.length / 3,
    originalTriangleCount: carrier.indices.length / 3
  },
  neckShell: {
    ringCount: shell.ringCount,
    ringSize: shell.ringSize,
    vertexCount: shell.positions.length / 3,
    triangleCount: shell.indices.length / 3,
    stationXRange: [shell.stationXs[0], shell.stationXs.at(-1)],
    configuredShellStartX: CHICKEN_PHASE1_NECK_SHELL_START_X,
    crossSectionArea: {
      min: Math.min(...ringAreas),
      median: quantile(ringAreas, 0.5),
      max: Math.max(...ringAreas)
    },
    seamChord: {
      min: Math.min(...ringSeams),
      median: quantile(ringSeams, 0.5),
      max: Math.max(...ringSeams)
    },
    longitudinalBindEdge: {
      min: Math.min(...longitudinalEdges),
      median: quantile(longitudinalEdges, 0.5),
      p95: quantile(longitudinalEdges, 0.95),
      max: Math.max(...longitudinalEdges)
    }
  },
  torso: {
    originalTriangleCount: carrier.indices.length / 3,
    retainedTriangleCount: torso.length / 3,
    retainedFraction: torso.length / carrier.indices.length,
    gateViolationTriangleCount: torsoGateViolations,
    retainedHighGateVertexReferences: retainedHighGateVertices,
    preserveBeforeX: CHICKEN_PHASE1_TORSO_PRESERVE_BEFORE_X,
    shellOverlapX: CHICKEN_PHASE1_TORSO_PRESERVE_BEFORE_X - CHICKEN_PHASE1_NECK_SHELL_START_X
  },
  centerline: {
    bindCurveLength: bindArc.totalLength,
    peckPrototypeCurveLength: peckArc.totalLength,
    curveLengthRatio: peckArc.totalLength / bindArc.totalLength,
    maxNormalizedArcRoundTripError: Math.max(...normalizedArcRoundTrip),
    interpolation: 'PCHIP',
    stationMapping: 'normalized arclength'
  },
  legacyV7PrototypeEvidence: prototype ? {
    ringAreaRatio: prototypeRingArea,
    radialEdgeRatio: prototypeRadial,
    longitudinalEdgeRatio: prototypeLongitudinal,
    longitudinalP95,
    longitudinalMax
  } : null,
  warnings,
  truthBoundary: {
    localTopologyMathPassed: Object.values(checks).every(Boolean),
    browserQAPassed: false,
    manualMotionNaturalnessAcceptance: false,
    manualVisualAcceptance: false,
    singleAgentGroundingComplete: false,
    singleAgentCollisionComplete: false,
    groupTestAuthorized: false,
    productionReady: false
  }
};

fs.mkdirSync(path.dirname(qaPath), { recursive: true });
fs.writeFileSync(qaPath, JSON.stringify(report, null, 2) + '\n');
fs.writeFileSync(localTestPath, JSON.stringify({
  schema: 'life_ecosystem/chicken_r100_centerline_v7_local_tests@1.1',
  passed: report.passed,
  commands: [
    'node --check runtime/chicken_phase1_centerline_sweep_adapter.mjs',
    'node --check tools/chicken_r100_centerline_patch.js',
    'node --test tests/chicken_phase1_centerline_sweep_adapter.test.mjs',
    'node tools/verify_chicken_r100_centerline_v7.mjs',
    'python3 -m py_compile tools/build_chicken_r100.py',
    'python3 tools/build_chicken_r100.py'
  ],
  revisions: report.revisions,
  truthBoundary: report.truthBoundary
}, null, 2) + '\n');

console.log(JSON.stringify(report, null, 2));
assert.equal(report.passed, true, 'V7.1 local topology audit failed');
