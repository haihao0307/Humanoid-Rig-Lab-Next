import { normalizeBodyProfile, REFERENCE_BODY_PROFILE } from '../../legacy/v8/src/body-profile.js';
import { createBodyShapeProfile } from '../../packages/body-shape/index.js';
import { createClothingProfile } from '../../packages/clothing-system/index.js';
import { createFaceIdentity } from '../../packages/face-system/index.js';
import {
  createDefinitionForBodyProfile,
  createImagePoseAsset,
  retargetPoseObservation,
} from '../../src/modules/pose/image-pose-retarget.js';

export const HRL_M01_ADAPTER = 'HRL-M01';
export const HRL_M03_ADAPTER = 'HRL-M03';
export const CHARACTER_IMAGE_ANALYSIS_SCHEMA = 'humanoid_rig/character_image_analysis@1.0';
export const PROPORTION_PROFILE_SCHEMA = 'humanoid_rig/proportion_profile@1.0';

export function analyzeCharacterImage({
  observation,
  source_image = {},
  base_state = {},
  character_name = 'Generated Character',
  at = null,
} = {}) {
  validateObservation(observation);
  const sourceImage = normalizeSourceImage(source_image, observation);
  const token = stableToken(sourceImage);
  const timestamp = validIso(at) ? at : new Date().toISOString();
  const characterId = `character_${token}`;
  const proportionProfile = analyzeProportionProfile(observation, {
    id: `proportion_${token}`,
    baseBodyProfile: base_state.character?.bodyProfile,
    revision: Number(base_state.moduleRevisions?.proportion || 0) + 1,
  });
  const bodyShape = analyzeBodyShape(observation, proportionProfile, `body_shape_${token}`);
  const faceIdentity = analyzeFaceIdentity(observation, `face_${token}`);
  const clothingProfile = createGeneratedClothingProfile(characterId, token);
  const definition = createDefinitionForBodyProfile(proportionProfile.body_profile);
  const candidate = retargetPoseObservation({
    definition,
    observation,
    compatibleRig: String(base_state.activeVersions?.rig || 'rig@0.4.0'),
    name: `${character_name} Image Pose`,
    assetId: `image_pose_${token}`,
    physics: base_state.character?.physics || {},
    settings: { autoPinFeet: true, preserveRootPosition: false, groundEnabled: true },
  });
  const imagePoseAsset = createImagePoseAsset(candidate, {
    fileName: sourceImage.file_name,
    mimeType: sourceImage.mime_type,
    byteLength: sourceImage.byte_length,
    width: sourceImage.width,
    height: sourceImage.height,
    contentHash: sourceImage.content_hash,
    storage: 'metadata-only',
  });
  const warnings = [
    '绝对身高沿用当前 HRL-M01 基准；单张图片只估算相对比例。',
    'BodyShape 和 FaceIdentity 为第一阶段参数估计，不代表最终真人重建。',
    'ClothingProfile 生成静态占位附件，不执行服装分割或材质识别。',
  ];
  return {
    schema: CHARACTER_IMAGE_ANALYSIS_SCHEMA,
    analysis_id: `analysis_${token}`,
    session_id: `generator_${token}`,
    character_id: characterId,
    character_name: String(character_name || 'Generated Character'),
    source_image: sourceImage,
    adapters: {
      proportion: { id: HRL_M01_ADAPTER, contract: 'normalizeBodyProfile', output: PROPORTION_PROFILE_SCHEMA },
      pose: { id: HRL_M03_ADAPTER, contract: 'retargetPoseObservation', output: 'humanoid_rig/pose_snapshot@1.0' },
    },
    confidence: {
      pose: round(Number(candidate.quality?.overallConfidence || observation.confidence?.average || 0), 4),
      proportion: proportionProfile.confidence,
      body_shape: round(proportionProfile.confidence * 0.7, 4),
      face_identity: faceConfidence(observation),
      clothing: 0.2,
    },
    warnings,
    outputs: {
      proportion_profile: proportionProfile,
      body_shape: bodyShape,
      face_identity: faceIdentity,
      clothing_profile: clothingProfile,
      pose_snapshot: structuredClone(candidate.poseSnapshot),
      image_pose_asset: imagePoseAsset,
      legacy_world_pose: structuredClone(candidate.legacyWorldPose),
      character_profile: null,
    },
    created_at: timestamp,
  };
}

export function analyzeProportionProfile(observation, {
  id = 'proportion_generated',
  baseBodyProfile = {},
  revision = 1,
} = {}) {
  validateObservation(observation);
  const points = normalizedMetricPoints(observation);
  const sourceHeight = Math.max(0.2, verticalSpan(points));
  const inheritedHeight = Number(baseBodyProfile?.height || REFERENCE_BODY_PROFILE.height);
  const targetHeight = clamp(inheritedHeight, 1.4, 2.15, REFERENCE_BODY_PROFILE.height);
  const scale = targetHeight / sourceHeight;
  const avg = (...values) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const bodyProfile = normalizeBodyProfile({
    preset: `image-analysis-${id}`,
    height: targetHeight,
    shoulderWidth: distance(points[11], points[12]) * scale,
    hipWidth: distance(points[23], points[24]) * scale,
    upperArmLength: avg(distance(points[11], points[13]), distance(points[12], points[14])) * scale,
    forearmLength: avg(distance(points[13], points[15]), distance(points[14], points[16])) * scale,
    handControlLength: avg(distance(points[15], points[19]), distance(points[16], points[20])) * scale,
    thighLength: avg(distance(points[23], points[25]), distance(points[24], points[26])) * scale,
    lowerLegLength: avg(distance(points[25], points[27]), distance(points[26], points[28])) * scale,
    draftRevision: Math.max(1, Number(revision || 1)),
  });
  return {
    schema: PROPORTION_PROFILE_SCHEMA,
    proportion_profile_id: id,
    revision: Math.max(1, Number(revision || 1)),
    source_module: HRL_M01_ADAPTER,
    source_observation: observation.schema,
    confidence: proportionConfidence(observation),
    absolute_height_mode: 'inherit-current-profile',
    body_profile: bodyProfile,
  };
}

function analyzeBodyShape(observation, proportionProfile, id) {
  const points = normalizedMetricPoints(observation);
  const height = Math.max(0.2, verticalSpan(points));
  const shoulderRatio = distance(points[11], points[12]) / height;
  const hipRatio = distance(points[23], points[24]) / height;
  const torsoRatio = distance(midpoint(points[11], points[12]), midpoint(points[23], points[24])) / height;
  return createBodyShapeProfile({
    body_shape_id: id,
    name: 'Image Estimated Body Shape',
    version: 1,
    muscle: 0.5,
    fat: 0.5,
    shoulder_volume: normalizedAround(shoulderRatio, 0.23, 0.12),
    chest_volume: normalizedAround((shoulderRatio + torsoRatio) * 0.5, 0.28, 0.14),
    waist_volume: normalizedAround(torsoRatio, 0.29, 0.14),
    hip_volume: normalizedAround(hipRatio, 0.13, 0.08),
    arm_volume: 0.5,
    leg_volume: 0.5,
  });
}

function analyzeFaceIdentity(observation, id) {
  const points = normalizedMetricPoints(observation);
  const earWidth = Math.max(1e-6, distance(points[7], points[8]));
  const eyeWidth = distance(points[2], points[5]);
  const mouthWidth = distance(points[9], points[10]);
  const faceHeight = Math.max(1e-6, distance(points[0], midpoint(points[9], points[10])) * 2.2);
  return createFaceIdentity({
    face_id: id,
    version: 1,
    age: 30,
    face_shape: {
      width: clamp01(0.5 + (earWidth / faceHeight - 0.75) * 0.45),
      height: clamp01(0.5 + (faceHeight / earWidth - 1.3) * 0.25),
      jaw_width: 0.5,
      cheekbone: 0.5,
    },
    eye_shape: {
      size: 0.5,
      spacing: clamp01(0.5 + (eyeWidth / earWidth - 0.45) * 0.8),
      tilt: 0.5,
    },
    nose_shape: { width: 0.5, length: 0.5, bridge_height: 0.5 },
    mouth_shape: { width: clamp01(0.5 + (mouthWidth / earWidth - 0.38) * 0.8), fullness: 0.5, corner_curve: 0.5 },
    expression_profile: { profile_id: 'expression_neutral', revision: 1, default_expression: 'neutral' },
  });
}

function createGeneratedClothingProfile(characterId, token) {
  return createClothingProfile({
    clothing_profile_id: `clothing_${token}`,
    character_id: characterId,
    version: 1,
    assets: [
      { clothing_id: `top_${token}`, type: 'top', material: { base_color: '#526d9e' } },
      { clothing_id: `pants_${token}`, type: 'pants', material: { base_color: '#303a4d' } },
      { clothing_id: `shoes_${token}`, type: 'shoes', material: { base_color: '#25282d' } },
    ],
  });
}

function normalizeSourceImage(value, observation) {
  const source = value && typeof value === 'object' ? value : {};
  const hash = String(source.content_hash || source.contentHash || '').toLowerCase();
  if (!/^[a-f0-9]{16,128}$/.test(hash)) throw new TypeError('source_image.content_hash must contain a stable hexadecimal image hash.');
  return {
    file_name: String(source.file_name || source.fileName || 'character-image'),
    mime_type: String(source.mime_type || source.mimeType || 'application/octet-stream'),
    byte_length: Math.max(0, Number(source.byte_length || source.byteLength || 0)),
    width: Math.max(0, Number(source.width || observation.image?.width || 0)),
    height: Math.max(0, Number(source.height || observation.image?.height || 0)),
    content_hash: hash,
    binary_storage: 'not-in-project-state',
  };
}

function stableToken(sourceImage) { return sourceImage.content_hash.slice(0, 12); }
function validateObservation(value) {
  if (!value || value.schema !== 'humanoid_rig/pose_observation@1.0' || !Array.isArray(value.landmarks) || value.landmarks.length !== 33) {
    throw new TypeError('Character image analysis requires one HRL-M03 PoseObservation with 33 landmarks.');
  }
}
function normalizedMetricPoints(observation) {
  const values = usableWorldLandmarks(observation.worldLandmarks) ? observation.worldLandmarks : observation.landmarks;
  const aspect = usableWorldLandmarks(observation.worldLandmarks) ? 1 : clamp(observation.image?.aspectRatio, 0.2, 5, 1);
  return values.map((point) => ({
    x: Number(point.x || 0) * aspect,
    y: Number(point.y || 0),
    z: Number(point.z || 0),
  }));
}
function usableWorldLandmarks(value) {
  return Array.isArray(value) && value.length === 33 && [11, 12, 23, 24, 27, 28]
    .every((index) => [value[index]?.x, value[index]?.y, value[index]?.z].every((item) => Number.isFinite(Number(item))));
}
function verticalSpan(points) {
  const top = Math.min(points[0].y, points[7].y, points[8].y);
  const bottom = Math.max(points[27].y, points[28].y, points[29].y, points[30].y, points[31].y, points[32].y);
  return Math.abs(bottom - top);
}
function proportionConfidence(observation) {
  const required = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
  const values = required.map((index) => confidence(observation.landmarks[index]));
  return round(values.reduce((sum, value) => sum + value, 0) / values.length, 4);
}
function faceConfidence(observation) {
  const values = [0, 2, 5, 7, 8, 9, 10].map((index) => confidence(observation.landmarks[index]));
  return round(values.reduce((sum, value) => sum + value, 0) / values.length * 0.65, 4);
}
function confidence(point) {
  const visibility = Number(point?.visibility);
  const presence = Number(point?.presence);
  if (Number.isFinite(visibility) && Number.isFinite(presence)) return clamp01(Math.min(visibility, presence));
  if (Number.isFinite(visibility)) return clamp01(visibility);
  return 0.5;
}
function distance(left, right) { return Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z); }
function midpoint(left, right) { return { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2, z: (left.z + right.z) / 2 }; }
function normalizedAround(value, center, span) { return clamp01(0.5 + (value - center) / Math.max(1e-6, span) * 0.5); }
function clamp01(value) { return Math.min(1, Math.max(0, Number(value) || 0)); }
function clamp(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}
function round(value, digits) { const scale = 10 ** digits; return Math.round(Number(value) * scale) / scale; }
function validIso(value) { return Number.isFinite(Date.parse(value || '')); }
