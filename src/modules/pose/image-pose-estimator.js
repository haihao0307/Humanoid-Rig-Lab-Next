export const MEDIAPIPE_TASKS_VISION_VERSION = '1.0.1';
export const MEDIAPIPE_POSE_MODEL = 'pose_landmarker_full_float16_v1';

const DEFAULT_TASKS_VISION_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_TASKS_VISION_VERSION}/vision_bundle.mjs`;
const DEFAULT_WASM_ROOT = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_TASKS_VISION_VERSION}/wasm`;
const DEFAULT_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';

const LANDMARK_NAMES = Object.freeze([
  'nose',
  'leftEyeInner', 'leftEye', 'leftEyeOuter',
  'rightEyeInner', 'rightEye', 'rightEyeOuter',
  'leftEar', 'rightEar', 'leftMouth', 'rightMouth',
  'leftShoulder', 'rightShoulder',
  'leftElbow', 'rightElbow',
  'leftWrist', 'rightWrist',
  'leftPinky', 'rightPinky',
  'leftIndex', 'rightIndex',
  'leftThumb', 'rightThumb',
  'leftHip', 'rightHip',
  'leftKnee', 'rightKnee',
  'leftAnkle', 'rightAnkle',
  'leftHeel', 'rightHeel',
  'leftFootIndex', 'rightFootIndex',
]);

let landmarkerPromise = null;
let activeRuntime = null;

export async function estimatePoseFromImage(image, options = {}) {
  if (!image) throw new Error('没有可以分析的图片。');
  const runtime = await getPoseLandmarker(options);
  const startedAt = performanceNow();
  const result = runtime.landmarker.detect(image);
  const elapsedMs = performanceNow() - startedAt;
  return normalizePoseLandmarkerResult(result, image, {
    modelUrl: runtime.modelUrl,
    delegate: runtime.delegate,
    inferenceMs: elapsedMs,
  });
}

export function normalizePoseLandmarkerResult(result, image, metadata = {}) {
  const landmarks = normalizeLandmarkList(result?.landmarks?.[0]);
  const worldLandmarks = normalizeLandmarkList(result?.worldLandmarks?.[0]);
  if (landmarks.length !== 33) {
    throw new Error('图片中没有检测到完整人物。请使用全身清晰、人物主体较大的图片。');
  }
  const imageWidth = Number(image?.naturalWidth || image?.videoWidth || image?.width || 0);
  const imageHeight = Number(image?.naturalHeight || image?.videoHeight || image?.height || 0);
  return {
    schema: 'humanoid_rig/pose_observation@1.0',
    sourceType: 'single_image',
    provider: 'MediaPipe Pose Landmarker',
    package: '@mediapipe/tasks-vision',
    packageVersion: MEDIAPIPE_TASKS_VISION_VERSION,
    model: MEDIAPIPE_POSE_MODEL,
    modelUrl: String(metadata.modelUrl || DEFAULT_MODEL_URL),
    delegate: String(metadata.delegate || 'unknown'),
    runningMode: 'IMAGE',
    image: {
      width: imageWidth,
      height: imageHeight,
      aspectRatio: imageHeight > 0 ? imageWidth / imageHeight : 1,
    },
    landmarks,
    worldLandmarks,
    confidence: summarizeConfidence(landmarks),
    inferenceMs: Number(metadata.inferenceMs || 0),
    createdAt: metadata.createdAt || new Date().toISOString(),
  };
}

export async function preloadPoseEstimator(options = {}) {
  const runtime = await getPoseLandmarker(options);
  return {
    provider: 'MediaPipe Pose Landmarker',
    packageVersion: MEDIAPIPE_TASKS_VISION_VERSION,
    model: MEDIAPIPE_POSE_MODEL,
    delegate: runtime.delegate,
  };
}

export function getPoseEstimatorStatus() {
  if (!activeRuntime) return { state: landmarkerPromise ? 'loading' : 'idle' };
  return {
    state: 'ready',
    provider: 'MediaPipe Pose Landmarker',
    packageVersion: MEDIAPIPE_TASKS_VISION_VERSION,
    model: MEDIAPIPE_POSE_MODEL,
    delegate: activeRuntime.delegate,
  };
}

async function getPoseLandmarker(options) {
  if (activeRuntime) return activeRuntime;
  if (!landmarkerPromise) {
    landmarkerPromise = createPoseLandmarker(options).catch((error) => {
      landmarkerPromise = null;
      throw error;
    });
  }
  activeRuntime = await landmarkerPromise;
  return activeRuntime;
}

async function createPoseLandmarker(options = {}) {
  const config = resolveEstimatorConfig(options);
  let visionModule;
  try {
    visionModule = await import(config.tasksVisionUrl);
  } catch (error) {
    throw new Error(`人体姿势识别运行库加载失败。请检查网络或改用本地 tasks-vision 资源。${errorMessage(error)}`);
  }
  const api = resolveVisionApi(visionModule);
  if (!api?.FilesetResolver || !api?.PoseLandmarker) {
    throw new Error('当前 tasks-vision 运行库没有提供 FilesetResolver 或 PoseLandmarker。');
  }

  let fileset;
  try {
    fileset = await api.FilesetResolver.forVisionTasks(config.wasmRoot);
  } catch (error) {
    throw new Error(`人体识别 WASM 初始化失败。${errorMessage(error)}`);
  }

  const createWithDelegate = async (delegate) => api.PoseLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: config.modelUrl,
      delegate,
    },
    runningMode: 'IMAGE',
    numPoses: 1,
    minPoseDetectionConfidence: clamp(options.minDetectionConfidence, 0, 1, 0.5),
    minPosePresenceConfidence: clamp(options.minPresenceConfidence, 0, 1, 0.5),
    minTrackingConfidence: clamp(options.minTrackingConfidence, 0, 1, 0.5),
    outputSegmentationMasks: false,
  });

  const requestedDelegate = String(options.delegate || config.delegate || 'GPU').toUpperCase();
  try {
    const landmarker = await createWithDelegate(requestedDelegate);
    return { landmarker, delegate: requestedDelegate, modelUrl: config.modelUrl };
  } catch (gpuError) {
    if (requestedDelegate === 'CPU') {
      throw new Error(`人体姿势模型初始化失败。${errorMessage(gpuError)}`);
    }
    try {
      const landmarker = await createWithDelegate('CPU');
      return { landmarker, delegate: 'CPU', modelUrl: config.modelUrl };
    } catch (cpuError) {
      throw new Error(`人体姿势模型在 GPU 与 CPU 模式下均无法初始化。${errorMessage(cpuError)}`);
    }
  }
}

function resolveEstimatorConfig(options) {
  const globalConfig = typeof globalThis === 'object' && globalThis.__HRL_IMAGE_POSE_ESTIMATOR__
    ? globalThis.__HRL_IMAGE_POSE_ESTIMATOR__
    : {};
  return {
    tasksVisionUrl: String(options.tasksVisionUrl || globalConfig.tasksVisionUrl || DEFAULT_TASKS_VISION_URL),
    wasmRoot: String(options.wasmRoot || globalConfig.wasmRoot || DEFAULT_WASM_ROOT),
    modelUrl: String(options.modelUrl || globalConfig.modelUrl || DEFAULT_MODEL_URL),
    delegate: String(options.delegate || globalConfig.delegate || 'GPU'),
  };
}

function resolveVisionApi(moduleNamespace) {
  if (moduleNamespace?.FilesetResolver && moduleNamespace?.PoseLandmarker) return moduleNamespace;
  if (moduleNamespace?.default?.FilesetResolver && moduleNamespace?.default?.PoseLandmarker) return moduleNamespace.default;
  return moduleNamespace;
}

function normalizeLandmarkList(values) {
  if (!Array.isArray(values)) return [];
  return values.map((value, index) => ({
    index,
    name: LANDMARK_NAMES[index] || `landmark_${index}`,
    x: finite(value?.x),
    y: finite(value?.y),
    z: finite(value?.z),
    visibility: confidenceValue(value?.visibility),
    presence: confidenceValue(value?.presence),
  }));
}

function summarizeConfidence(landmarks) {
  const bodyIndices = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 31, 32];
  const values = bodyIndices
    .map((index) => landmarkConfidence(landmarks[index]))
    .filter(Number.isFinite);
  const overall = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const lowConfidenceIndices = bodyIndices.filter((index) => landmarkConfidence(landmarks[index]) < 0.55);
  return {
    overall,
    minimum: values.length ? Math.min(...values) : 0,
    lowConfidenceIndices,
    lowConfidenceNames: lowConfidenceIndices.map((index) => LANDMARK_NAMES[index]),
  };
}

function landmarkConfidence(value) {
  const visibility = Number(value?.visibility);
  const presence = Number(value?.presence);
  if (Number.isFinite(visibility) && Number.isFinite(presence)) return Math.min(visibility, presence);
  if (Number.isFinite(visibility)) return visibility;
  if (Number.isFinite(presence)) return presence;
  return 0;
}

function confidenceValue(value) {
  if (value == null) return 0;
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : 0;
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function clamp(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function performanceNow() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function errorMessage(error) {
  const text = error instanceof Error ? error.message : String(error || '未知错误');
  return text ? ` ${text}` : '';
}

export { LANDMARK_NAMES };
