import { compileGarment } from './garment-compiler.js';
import { createHybridClothState, deformGarment, stepHybridCloth } from './garment-runtime.js';
import { decodeGarmentPayload, encodeGarmentPayload } from './binary-codec.js';
import { RUNTIME_MODES } from './constants.js';
import { validateGarmentDNA } from './garment-dna.js';

function compiledKey(garmentDNA, bodyProfile) {
  const revision = bodyProfile?.proportion_revision ?? bodyProfile?.proportionRevision ?? 0;
  const subject = bodyProfile?.subject_id ?? bodyProfile?.subjectId ?? 'anonymous_subject';
  return `${garmentDNA.contentHash}|${subject}|${revision}`;
}

export class ProceduralClothingService {
  constructor() {
    this.garments = new Map();
    this.compiled = new Map();
    this.instances = new Map();
    this.nextInstanceId = 1;
  }
  registerGarment(garmentDNA) {
    validateGarmentDNA(garmentDNA);
    this.garments.set(garmentDNA.garmentId, garmentDNA);
    return garmentDNA.garmentId;
  }
  unregisterGarment(garmentId) { return this.garments.delete(garmentId); }
  compileForBody(garmentId, bodyProfile, options = {}) {
    const garmentDNA = this.garments.get(garmentId);
    if (!garmentDNA) throw new Error(`Garment is not registered: ${garmentId}`);
    const key = compiledKey(garmentDNA, bodyProfile);
    if (!options.force && this.compiled.has(key)) return this.compiled.get(key);
    const payload = compileGarment(garmentDNA, bodyProfile);
    this.compiled.set(key, payload);
    return payload;
  }
  invalidateSubject(subjectId, proportionRevision = null) {
    let removed = 0;
    for (const [key, payload] of this.compiled) {
      if (payload.subjectId !== subjectId) continue;
      if (proportionRevision !== null && payload.proportionRevision !== proportionRevision) continue;
      this.compiled.delete(key);
      removed += 1;
    }
    return removed;
  }
  createInstance(payload, options = {}) {
    const mode = options.mode ?? RUNTIME_MODES.KINEMATIC;
    if (!Object.values(RUNTIME_MODES).includes(mode)) throw new RangeError(`Unsupported runtime mode: ${mode}`);
    const instanceId = String(options.instanceId ?? `garment_instance_${this.nextInstanceId++}`);
    if (this.instances.has(instanceId)) throw new Error(`Garment instance already exists: ${instanceId}`);
    const instance = {
      instanceId,
      payload,
      mode,
      visible: options.visible ?? true,
      deformed: null,
      clothState: mode === RUNTIME_MODES.KINEMATIC ? null : createHybridClothState(payload),
      lastUpdateSeconds: null,
    };
    this.instances.set(instanceId, instance);
    return instance;
  }
  updateInstance(instanceId, skinMatrices, deltaSeconds = 1 / 60, options = {}) {
    const instance = this.instances.get(instanceId);
    if (!instance) throw new Error(`Garment instance not found: ${instanceId}`);
    if (instance.mode === RUNTIME_MODES.KINEMATIC) {
      instance.deformed = deformGarment(instance.payload, skinMatrices, instance.deformed ?? {});
    } else {
      stepHybridCloth(instance.payload, instance.clothState, skinMatrices, deltaSeconds, options);
      instance.deformed = {
        positions: instance.clothState.positions,
        normals: instance.clothState.targetNormals,
        indices: instance.payload.indices,
        materialCoords: instance.payload.materialCoords,
        regionIds: instance.payload.regionIds,
        contentHash: instance.payload.contentHash,
        proportionRevision: instance.payload.proportionRevision,
      };
    }
    instance.lastUpdateSeconds = deltaSeconds;
    return instance.deformed;
  }
  setInstanceMode(instanceId, mode) {
    const instance = this.instances.get(instanceId);
    if (!instance) throw new Error(`Garment instance not found: ${instanceId}`);
    if (!Object.values(RUNTIME_MODES).includes(mode)) throw new RangeError(`Unsupported runtime mode: ${mode}`);
    if (instance.mode !== mode) {
      instance.mode = mode;
      instance.clothState = mode === RUNTIME_MODES.KINEMATIC ? null : createHybridClothState(instance.payload);
      instance.deformed = null;
    }
    return instance;
  }
  removeInstance(instanceId) { return this.instances.delete(instanceId); }
  encode(payload) { return encodeGarmentPayload(payload); }
  decode(buffer) { return decodeGarmentPayload(buffer); }
}

export function createProceduralClothingService() {
  return new ProceduralClothingService();
}
