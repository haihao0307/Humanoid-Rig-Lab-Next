export const GARMENT_SCHEMA = 'humanoid_rig/garment_dna@1.0';
export const MATERIAL_SCHEMA = 'humanoid_rig/material_dna@1.0';
export const FIT_CONTRACT_SCHEMA = 'humanoid_rig/garment_fit_contract@1.0';
export const PAYLOAD_SCHEMA = 'humanoid_rig/garment_payload@1.0';
export const BINARY_FORMAT = 'HRLG';
export const BINARY_VERSION = 1;

export const GARMENT_TYPES = Object.freeze({
  CREW_SHIRT: 'crew_shirt',
});

export const FIT_MODES = Object.freeze({
  CLOSE: 'close',
  REGULAR: 'regular',
  RELAXED: 'relaxed',
});

export const MATERIAL_FAMILIES = Object.freeze({
  KNIT: 'knit',
  WOVEN: 'woven',
});

export const RUNTIME_MODES = Object.freeze({
  KINEMATIC: 'kinematic',
  HYBRID: 'hybrid',
  DYNAMIC: 'dynamic',
});

export const REGION_IDS = Object.freeze({
  TORSO_FRONT: 1,
  TORSO_BACK: 2,
  LEFT_SLEEVE: 3,
  RIGHT_SLEEVE: 4,
  COLLAR: 5,
});

export const REGION_NAMES = Object.freeze({
  1: 'torso_front',
  2: 'torso_back',
  3: 'left_sleeve',
  4: 'right_sleeve',
  5: 'collar',
});

export const CANONICAL_GARMENT_JOINTS = Object.freeze([
  'pelvis',
  'spine1',
  'spine2',
  'spine3',
  'neck',
  'left_shoulder',
  'left_upper_arm',
  'left_lower_arm',
  'right_shoulder',
  'right_upper_arm',
  'right_lower_arm',
]);

export const FIT_MODE_EASE = Object.freeze({
  close: Object.freeze({ chest: 0.035, waist: 0.03, hem: 0.035, upperArm: 0.025 }),
  regular: Object.freeze({ chest: 0.09, waist: 0.085, hem: 0.09, upperArm: 0.06 }),
  relaxed: Object.freeze({ chest: 0.16, waist: 0.17, hem: 0.18, upperArm: 0.11 }),
});

export const FORBIDDEN_ASSET_KEYS = Object.freeze([
  'meshref',
  'modelref',
  'textureref',
  'texture',
  'image',
  'normalmap',
  'roughnessmap',
  'metalnessmap',
  'uvmap',
]);

export const FORBIDDEN_ASSET_TOKENS = Object.freeze([
  '.glb',
  '.gltf',
  '.obj',
  '.fbx',
  '.dae',
  '.stl',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.tif',
  '.tiff',
  'data:image',
]);
