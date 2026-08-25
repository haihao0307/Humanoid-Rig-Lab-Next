import { createCanonicalBodyFieldV5 } from './body-field-compiler-v5.js';
import { extractStableProceduralSurfaceV5 } from './surface-extractor-v5.js';

export class ProceduralSurfaceWorkerClientV5 {
  constructor({ workerUrl = new URL('../../../../workers/procedural-surface.worker.js', import.meta.url) } = {}) {
    this.workerUrl = workerUrl;
    this.worker = null;
    this.usedWorker = false;
    this.sequence = 0;
  }

  async generate({ fieldDefinition, resolution = 28 } = {}) {
    if (typeof globalThis.Worker !== 'function') {
      this.usedWorker = false;
      return extractStableProceduralSurfaceV5(createCanonicalBodyFieldV5(fieldDefinition), { resolution });
    }
    this.usedWorker = true;
    if (!this.worker) this.worker = new Worker(this.workerUrl, { type: 'module', name: 'hrl-procedural-surface-v5' });
    const requestId = `surface-${++this.sequence}`;
    return new Promise((resolve, reject) => {
      const onMessage = (event) => {
        if (event.data?.requestId !== requestId) return;
        cleanup();
        if (event.data.error) reject(new Error(event.data.error));
        else resolve(reviveSurface(event.data.surface));
      };
      const onError = (event) => { cleanup(); reject(event.error ?? new Error(event.message ?? 'Procedural surface Worker failed.')); };
      const cleanup = () => { this.worker.removeEventListener('message', onMessage); this.worker.removeEventListener('error', onError); };
      this.worker.addEventListener('message', onMessage);
      this.worker.addEventListener('error', onError);
      this.worker.postMessage({ requestId, fieldDefinition, resolution });
    });
  }

  dispose() { this.worker?.terminate(); this.worker = null; }
}

function reviveSurface(surface) {
  return {
    ...surface,
    positions: new Float32Array(surface.positions),
    normals: new Float32Array(surface.normals),
    indices: new Uint32Array(surface.indices),
    regionIds: new Uint16Array(surface.regionIds),
    regionBlendWeights: new Float32Array(surface.regionBlendWeights),
    bindLocalData: new Float32Array(surface.bindLocalData),
  };
}
