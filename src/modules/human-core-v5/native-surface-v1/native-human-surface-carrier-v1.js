import * as THREE from 'three';
import { createBodyDNA } from '../body-dna-v5.js';
import { assertHumanRigCoreV5 } from '../human-rig-core-v5.js';
import {
  NativeHumanSurfaceEvaluatorV1,
} from './native-human-surface-evaluator-v1.js';
import {
  NativeHumanSurfaceLandmarksV1,
} from './native-human-surface-landmarks-v1.js';
import {
  auditNativeHumanSurfaceGeometryV1,
} from './native-human-surface-metrics-v1.js';
import {
  assertNativeHumanSurfaceTopologyV1,
  createNativeHumanSurfaceTopologyV1,
} from './native-human-surface-topology-v1.js';

export const NATIVE_HUMAN_SURFACE_CARRIER_V1_SCHEMA = 'humanoid_rig/native_human_surface_carrier@1.0';

/**
 * Renderer-side carrier only. The generated BufferGeometry remains outside
 * HumanCoreState and the carrier never changes BodyDNA or HumanRigCore.
 */
export class NativeHumanSurfaceCarrierV1 {
  constructor({ topology = createNativeHumanSurfaceTopologyV1() } = {}) {
    assertNativeHumanSurfaceTopologyV1(topology);
    this.schema = NATIVE_HUMAN_SURFACE_CARRIER_V1_SCHEMA;
    this.type = 'NativeHumanSurfaceCarrierV1';
    this.topology = structuredClone(topology);
    this.evaluator = new NativeHumanSurfaceEvaluatorV1({ topology });
    this.landmarks = new NativeHumanSurfaceLandmarksV1({ topology });
    this.evaluation = null;
    this.landmarkEvaluation = null;
    this.geometry = null;
    this.metrics = null;
    this.externalHumanAssetRequests = 0;
  }

  compile({ bodyDNA, rigCore, auditSelfIntersections = false }) {
    const dna = createBodyDNA(bodyDNA);
    assertHumanRigCoreV5(rigCore);
    this.disposeGeometry();
    this.evaluation = this.evaluator.evaluate({ bodyDNA: dna, rigCore });
    this.landmarkEvaluation = this.landmarks.evaluate({
      evaluation: this.evaluation,
      bodyDNA: dna,
      rigCore,
    });
    this.geometry = createNativeHumanSurfaceBufferGeometryV1(this.evaluation);
    const audit = auditNativeHumanSurfaceGeometryV1({
      evaluation: this.evaluation,
      topology: this.topology,
      landmarkEvaluation: this.landmarkEvaluation,
      bodyDNA: dna,
      includeSelfIntersections: auditSelfIntersections,
    });
    this.metrics = audit;
    return this.getState();
  }

  getGeometry() {
    if (!this.geometry) throw new Error('NativeHumanSurfaceCarrierV1 requires compile() before getGeometry().');
    return this.geometry;
  }

  getEvaluation() {
    if (!this.evaluation) throw new Error('NativeHumanSurfaceCarrierV1 requires compile() before getEvaluation().');
    return cloneEvaluation(this.evaluation);
  }

  getState() {
    if (!this.evaluation || !this.geometry) throw new Error('NativeHumanSurfaceCarrierV1 requires compile() before getState().');
    return Object.freeze({
      schema: NATIVE_HUMAN_SURFACE_CARRIER_V1_SCHEMA,
      ready: true,
      bodyDNAId: this.evaluation.bodyDNAId,
      rigId: this.evaluation.rigId,
      topologyFingerprint: this.topology.topologyFingerprint,
      indexHash: this.topology.indexHash,
      geometryPresent: this.geometry.getAttribute('position')?.count === this.topology.vertexCount,
      geometryMetrics: structuredClone(this.metrics.geometryMetrics),
      landmarkMetrics: structuredClone(this.metrics.landmarkMetrics),
      externalHumanAssetRequests: this.externalHumanAssetRequests,
      writesHumanCoreState: false,
      createsSecondRig: false,
    });
  }

  disposeGeometry() {
    if (this.geometry) this.geometry.dispose();
    this.geometry = null;
  }

  dispose() {
    this.disposeGeometry();
    this.evaluation = null;
    this.landmarkEvaluation = null;
    this.metrics = null;
  }
}

export function createNativeHumanSurfaceBufferGeometryV1(evaluation) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(evaluation.positions), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(evaluation.normals), 3));
  geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(evaluation.indices), 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData = {
    schema: NATIVE_HUMAN_SURFACE_CARRIER_V1_SCHEMA,
    topologyFingerprint: evaluation.topologyFingerprint,
    indexHash: evaluation.indexHash,
    bodyDNAId: evaluation.bodyDNAId,
    rigId: evaluation.rigId,
    projectOwned: true,
    externalHumanMeshUsed: false,
  };
  return geometry;
}

function cloneEvaluation(value) {
  return {
    ...structuredClone({
      ...value,
      positions: undefined,
      normals: undefined,
      indices: undefined,
    }),
    positions: new Float64Array(value.positions),
    normals: new Float64Array(value.normals),
    indices: new Uint32Array(value.indices),
  };
}
