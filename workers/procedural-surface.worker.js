import { createCanonicalBodyFieldV5 } from '../src/modules/human-core-v5/procedural-deform/body-field-compiler-v5.js';
import { extractStableProceduralSurfaceV5 } from '../src/modules/human-core-v5/procedural-deform/surface-extractor-v5.js';

self.addEventListener('message', (event) => {
  const { requestId, fieldDefinition, resolution } = event.data ?? {};
  try {
    const field = createCanonicalBodyFieldV5(fieldDefinition);
    const surface = extractStableProceduralSurfaceV5(field, { resolution });
    const transfer = [
      surface.positions.buffer, surface.normals.buffer, surface.indices.buffer,
      surface.regionIds.buffer, surface.regionBlendWeights.buffer, surface.bindLocalData.buffer,
    ];
    self.postMessage({ requestId, surface }, transfer);
  } catch (error) {
    self.postMessage({ requestId, error: error?.stack ?? error?.message ?? String(error) });
  }
});
