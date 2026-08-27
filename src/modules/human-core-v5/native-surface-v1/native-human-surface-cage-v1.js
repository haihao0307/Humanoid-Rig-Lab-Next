import {
  NATIVE_HUMAN_SURFACE_TOPOLOGY_V1_ID,
  assertNativeHumanSurfaceTopologyV1,
  createNativeHumanSurfaceTopologyV1,
} from './native-human-surface-topology-v1.js';

export const NATIVE_HUMAN_SURFACE_CAGE_V1_SCHEMA = 'humanoid_rig/native_human_surface_cage@1.0';

/**
 * Immutable structural carrier for the authored cage parameters. It owns no
 * BodyDNA, rig, renderer, GPU object, or mutable HumanCoreState reference.
 */
export class NativeHumanSurfaceCageV1 {
  constructor({ topology = createNativeHumanSurfaceTopologyV1() } = {}) {
    assertNativeHumanSurfaceTopologyV1(topology);
    this.schema = NATIVE_HUMAN_SURFACE_CAGE_V1_SCHEMA;
    this.type = 'NativeHumanSurfaceCageV1';
    this.cageId = 'native-human-surface-cage-v1';
    this.topologyId = NATIVE_HUMAN_SURFACE_TOPOLOGY_V1_ID;
    this.topology = structuredClone(topology);
    this.controlCoordinates = topology.vertices.map((vertex) => [...vertex.controlCoordinate]);
    this.patchLayout = topology.vertices.map((vertex) => ({
      vertexId: vertex.vertexId,
      patchId: vertex.patchId,
      regionId: vertex.regionId,
      leftRightSide: vertex.leftRightSide,
      symmetryPartner: vertex.symmetryPartner,
      seamGroup: vertex.seamGroup,
    }));
    Object.freeze(this.controlCoordinates);
    Object.freeze(this.patchLayout);
  }

  getTopology() {
    return structuredClone(this.topology);
  }

  getControlCoordinates() {
    return this.controlCoordinates.map((coordinate) => [...coordinate]);
  }

  describeAuthority() {
    return Object.freeze({
      topology: 'NativeHumanSurfaceTopologyV1',
      proportions: 'BodyDNA',
      anatomicalAnchors: 'HumanRigCore',
      evaluator: 'NativeHumanSurfaceEvaluatorV1',
      createsSecondRig: false,
      usesBoneScaling: false,
      externalHumanMeshUsed: false,
    });
  }
}

export function createNativeHumanSurfaceCageV1(options = {}) {
  return new NativeHumanSurfaceCageV1(options);
}
