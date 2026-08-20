import { normalizeFaceIdentity } from './face-profile.js';

export const FACE_RUNTIME_DESCRIPTOR_SCHEMA = 'humanoid_rig/face_runtime_descriptor@1.0';
export const FACE_BACKENDS = Object.freeze({
  FLAME: 'FLAME',
  THREE_DMM: '3DMM',
  AI_FACE_RECONSTRUCTION: 'AI_FACE_RECONSTRUCTION',
});

export function createFaceRuntimeDescriptor(profileInput) {
  const profile = normalizeFaceIdentity(profileInput);
  return {
    schema: FACE_RUNTIME_DESCRIPTOR_SCHEMA,
    face_id: profile.face_id,
    face_revision: profile.version,
    source: 'face-identity-parameters',
    canonical_parameters: {
      age: profile.age,
      face_shape: structuredClone(profile.face_shape),
      eye_shape: structuredClone(profile.eye_shape),
      nose_shape: structuredClone(profile.nose_shape),
      mouth_shape: structuredClone(profile.mouth_shape),
      expression_profile: structuredClone(profile.expression_profile),
    },
    backend_interfaces: [
      { backend: FACE_BACKENDS.FLAME, status: 'adapter-ready', expected_output: 'FLAME shape and expression coefficients' },
      { backend: FACE_BACKENDS.THREE_DMM, status: 'adapter-ready', expected_output: '3DMM identity and expression coefficients' },
      { backend: FACE_BACKENDS.AI_FACE_RECONSTRUCTION, status: 'adapter-ready', expected_output: 'reconstruction result reference' },
    ],
    writes: ['face.identity_descriptor'],
    preserves: ['skin', 'rig', 'bone_lengths', 'hierarchy', 'pose', 'animation_tracks'],
  };
}

export class FaceRuntime {
  constructor() {
    this.adapters = new Map();
  }

  registerAdapter(backend, adapter) {
    const id = normalizeBackend(backend);
    if (!adapter || typeof adapter.prepare !== 'function') {
      throw new TypeError('Face backend adapter must expose prepare(profile, descriptor).');
    }
    this.adapters.set(id, adapter);
    return this;
  }

  hasAdapter(backend) {
    return this.adapters.has(normalizeBackend(backend));
  }

  prepare(profileInput, { backend = null } = {}) {
    const profile = normalizeFaceIdentity(profileInput);
    const descriptor = createFaceRuntimeDescriptor(profile);
    if (!backend) return { descriptor, backend: null, payload: null };
    const id = normalizeBackend(backend);
    const adapter = this.adapters.get(id);
    if (!adapter) throw new Error(`Face backend ${id} is not registered.`);
    return {
      descriptor,
      backend: id,
      payload: adapter.prepare(structuredClone(profile), structuredClone(descriptor)),
    };
  }
}

function normalizeBackend(value) {
  const id = String(value || '');
  if (!Object.values(FACE_BACKENDS).includes(id)) throw new TypeError(`Unsupported face backend: ${id || '(empty)'}.`);
  return id;
}
