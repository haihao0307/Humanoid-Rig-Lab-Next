export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

export interface MaterialDNA {
  schema: 'humanoid_rig/material_dna@1.0';
  id: string;
  name: string;
  family: 'knit' | 'woven';
  revision: number;
  units: 'SI';
  mechanics: {
    thickness: number;
    arealDensity: number;
    warpStretch: number;
    weftStretch: number;
    shearCompliance: number;
    bendCompliance: number;
    damping: number;
    bodyFriction: number;
    selfFriction: number;
    airDrag: number;
  };
  optics: {
    baseColorLinear: Vec3;
    roughness: number;
    fiberSheen: number;
    anisotropy: number;
    opacity: number;
  };
  microstructure: {
    repeatUPerMeter: number;
    repeatVPerMeter: number;
    amplitude: number;
    phase: number;
    skew: number;
  };
  contentHash: string;
}

export interface GarmentDNA {
  schema: 'humanoid_rig/garment_dna@1.0';
  garmentId: string;
  revision: number;
  garmentType: 'crew_shirt';
  fitMode: 'close' | 'regular' | 'relaxed';
  units: 'meter';
  pattern: Record<string, number | string>;
  ease: Record<string, number>;
  topology: Record<string, number>;
  construction: Record<string, number | Vec2>;
  adaptation: Record<string, boolean | string>;
  materialDNA: MaterialDNA;
  contentHash: string;
}

export interface BodyProfileInput {
  subject_id?: string;
  subjectId?: string;
  proportion_revision?: number;
  proportionRevision?: number;
  measurements?: Record<string, number>;
  joint_table?: string[];
  jointTable?: string[];
}

export interface FitContract {
  schema: 'humanoid_rig/garment_fit_contract@1.0';
  garmentId: string;
  garmentRevision: number;
  garmentHash: string;
  subjectId: string;
  proportionRevision: number;
  bodyHash: string;
  units: 'meter';
  policy: Record<string, boolean | string>;
  resolved: Record<string, number>;
  contentHash: string;
}

export interface GarmentPayload {
  schema: 'humanoid_rig/garment_payload@1.0';
  formatVersion: 1;
  garmentId: string;
  garmentRevision: number;
  garmentHash: string;
  materialId: string;
  materialRevision: number;
  materialHash: string;
  subjectId: string;
  proportionRevision: number;
  bodyHash: string;
  fitContract: FitContract;
  patternGraphHash: string;
  jointTable: string[];
  regionTable: Record<string, string>;
  topology: {
    vertexCount: number;
    triangleCount: number;
    structuralEdgeCount: number;
    seamPairCount: number;
    stableAcrossBodyProfiles: true;
  };
  runtimeContract: Record<string, boolean | string>;
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  skinJoints: Uint16Array;
  skinWeights: Float32Array;
  materialCoords: Float32Array;
  regionIds: Uint16Array;
  seamPairs: Uint32Array;
  stretchEdges: Uint32Array;
  restLengths: Float32Array;
  inverseMass: Float32Array;
  followWeights: Float32Array;
  materialUniforms: Float32Array;
  contentHash: string;
  topologySignature: string;
}

export function createMaterialDNA(preset?: 'cotton_jersey' | 'wool_twill' | 'silk_satin', overrides?: Record<string, unknown>): MaterialDNA;
export function createStandardCrewShirtDNA(options?: Record<string, unknown>): GarmentDNA;
export function normalizeBodyProfile(input?: BodyProfileInput): BodyProfileInput & { contentHash: string; jointTable: string[] };
export function compileGarment(garmentDNA: GarmentDNA, bodyInput: BodyProfileInput): GarmentPayload;
export function encodeGarmentPayload(payload: GarmentPayload): ArrayBuffer;
export function decodeGarmentPayload(buffer: ArrayBuffer | ArrayBufferView): GarmentPayload;
export function createIdentitySkinMatrices(jointCount: number): Float32Array;
export function deformGarment(payload: GarmentPayload, skinMatrices: Float32Array, target?: Record<string, Float32Array>): Record<string, unknown>;
export function createHybridClothState(payload: GarmentPayload): Record<string, unknown>;
export function stepHybridCloth(payload: GarmentPayload, state: Record<string, unknown>, skinMatrices: Float32Array, deltaSeconds: number, options?: Record<string, unknown>): Record<string, unknown>;
export function createProceduralClothingService(): ProceduralClothingService;

export class ProceduralClothingService {
  registerGarment(garmentDNA: GarmentDNA): string;
  unregisterGarment(garmentId: string): boolean;
  compileForBody(garmentId: string, bodyProfile: BodyProfileInput, options?: { force?: boolean }): GarmentPayload;
  invalidateSubject(subjectId: string, proportionRevision?: number | null): number;
  createInstance(payload: GarmentPayload, options?: Record<string, unknown>): Record<string, unknown>;
  updateInstance(instanceId: string, skinMatrices: Float32Array, deltaSeconds?: number, options?: Record<string, unknown>): Record<string, unknown>;
  setInstanceMode(instanceId: string, mode: 'kinematic' | 'hybrid' | 'dynamic'): Record<string, unknown>;
  removeInstance(instanceId: string): boolean;
  encode(payload: GarmentPayload): ArrayBuffer;
  decode(buffer: ArrayBuffer | ArrayBufferView): GarmentPayload;
}
