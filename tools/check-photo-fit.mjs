import assert from 'node:assert/strict';
import {
  PHOTO_FIT_SCHEMA,
  MORPH_LIMITS,
  FIT_STAGES,
  createDefaultLandmarks,
  validateLandmarks,
  measureLandmarks,
  buildCandidateMorphs,
  applyCandidateToPreset,
  diffMorphs,
  createPhotoFitProfile
} from '../photo-fit/PhotoFitCore.mjs';

let checks = 0;
const ok = (value, message) => { assert.ok(value, message); checks++; };
const equal = (actual, expected, message) => { assert.equal(actual, expected, message); checks++; };
const deepEqual = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };
const throws = (fn, matcher, message) => { assert.throws(fn, matcher, message); checks++; };

const baseMorphs = {
  shoulderWidth: 1,
  chestWidth: 1,
  waistWidth: 1,
  hipWidth: 1,
  neckWidth: 1,
  limbVolume: 1,
  softness: 1,
  breastProjectionM: 0,
  faceWidth: 1
};
const basePreset = {
  schema: 'jarvis/character_preset@2',
  bodyPlanRevision: 9,
  bodyArchetype: 'adult-male@2',
  id: 'adult175',
  label: '175 cm 成人',
  seed: 0,
  bodySex: 'male',
  statureM: 1.75,
  strength: {schema: 'dummy'},
  biology: {schema: 'dummy'},
  appearance: {
    morphs: {...baseMorphs},
    skinLayers: {},
    lowerBody: {},
    torso: {},
    headNeck: {},
    shoulder: {},
    skinColor: [0.43, 0.29, 0.22]
  },
  task: {command: '', startOnSpawn: false}
};

const landmarks = createDefaultLandmarks('full', 2);
equal(Object.keys(landmarks).length, 24, 'full mode should expose 24 calibration landmarks');
equal(validateLandmarks(landmarks, 'full').headTop.source, 'manual', 'default landmarks are manual observations');
throws(() => validateLandmarks({...landmarks, headTop: {x: 2, y: 0}}, 'full'), /归一化图片范围/, 'out-of-range landmarks must fail');
throws(() => validateLandmarks({}, 'full'), /缺少关键点/, 'missing landmarks must fail');

const measured = measureLandmarks(landmarks, {
  mode: 'full',
  imageWidth: 1200,
  imageHeight: 2400,
  knownHeightM: 1.78,
  perspectiveWarning: true,
  looseClothing: false
});
equal(measured.mode, 'full', 'measurement mode should be preserved');
equal(measured.calibration.knownHeightM, 1.78, 'known height should be recorded');
ok(measured.calibration.pxPerMeter > 0, 'pixel scale should be calculated');
ok(measured.measurements.shoulderWidthByHeight.value > 0, 'shoulder ratio should be positive');
ok(measured.measurements.faceWidthByFaceHeight.value > 0, 'face ratio should be positive');
ok(measured.warnings.some(item => item.code === 'SINGLE_VIEW_DEPTH_UNKNOWN'), 'single-view depth warning is mandatory');
ok(measured.warnings.some(item => item.code === 'PERSPECTIVE_UNCALIBRATED'), 'manual perspective warning should be retained');
equal(measured.calibration.heightApplication, 'observation-only-current-rig-fixed-at-1.75m', 'height must not silently rewrite the current rig');

const candidate = buildCandidateMorphs(measured, baseMorphs, {
  gain: 0.68,
  manualMorphs: {limbVolume: 1.08, softness: 0.92}
});
for (const [key, value] of Object.entries(candidate.morphs)) {
  const [min, max] = MORPH_LIMITS[key];
  ok(value >= min && value <= max, `${key} should stay inside the current mother-body limit`);
}
equal(candidate.morphs.limbVolume, 1.08, 'manual limb volume should be exact');
equal(candidate.evidence.limbVolume.status, 'manual', 'manual evidence must be explicit');
equal(candidate.evidence.breastProjectionM.status, 'unknown', 'unobserved depth must remain unknown');
throws(() => buildCandidateMorphs(measured, baseMorphs, {manualMorphs: {limbVolume: 4}}), /越界/, 'manual morphs must respect limits');
throws(() => buildCandidateMorphs(measured, baseMorphs, {manualMorphs: {unknown: 1}}), /未知人工外形参数/, 'unknown morph keys must fail');

const rigPreset = applyCandidateToPreset(basePreset, candidate, 'rig');
equal(rigPreset.appearance.morphs.shoulderWidth, candidate.morphs.shoulderWidth, 'rig stage should write shoulder width');
equal(rigPreset.appearance.morphs.hipWidth, candidate.morphs.hipWidth, 'rig stage should write hip width');
equal(rigPreset.appearance.morphs.chestWidth, basePreset.appearance.morphs.chestWidth, 'rig stage should not write torso width');
deepEqual(rigPreset.task, basePreset.task, 'task data must survive a photo-fit stage');
equal(rigPreset.statureM, 1.75, 'photo-fit must not bypass the current fixed stature contract');

const cumulativePreset = applyCandidateToPreset(basePreset, candidate, ['rig', 'torso', 'face', 'volume']);
for (const key of [...FIT_STAGES.rig.keys, ...FIT_STAGES.torso.keys, ...FIT_STAGES.face.keys, ...FIT_STAGES.volume.keys]) {
  equal(cumulativePreset.appearance.morphs[key], candidate.morphs[key], `${key} should be applied by cumulative stages`);
}

const diff = diffMorphs(baseMorphs, candidate.morphs);
ok(Object.values(diff).some(item => item.changed), 'candidate should expose a usable diff');
equal(diff.limbVolume.after, 1.08, 'diff should retain exact manual values');

const profile = createPhotoFitProfile({
  source: {
    imageId: 'front-001',
    fileName: 'reference.jpg',
    mimeType: 'image/jpeg',
    width: 1200,
    height: 2400,
    sha256: 'abc123'
  },
  measurementResult: measured,
  candidate,
  basePreset,
  stageState: ['rig', 'torso']
});
equal(profile.schema, PHOTO_FIT_SCHEMA, 'profile schema should be versioned');
equal(profile.sourceImages[0].storage, 'local-session-only', 'profile should not claim cloud storage');
equal(profile.sourceImages[0].sha256, 'abc123', 'profile should preserve source digest');
equal(profile.policy.automaticIdentityClaim, false, 'R0 must not claim automatic identity reconstruction');
equal(profile.policy.depthInference, 'unknown-unless-multiview', 'depth uncertainty should be explicit');
deepEqual(profile.appliedStages, ['rig', 'torso'], 'applied stage history should be exported');
equal(profile.base.statureM, 1.75, 'base stature should remain an audit fact');
throws(() => createPhotoFitProfile({
  source: {dataUrl: 'data:image/png;base64,aaa'},
  measurementResult: measured,
  candidate,
  basePreset
}), /禁止保存图片二进制字段/, 'profile must reject embedded image bytes');

const headLandmarks = createDefaultLandmarks('head');
const headMeasured = measureLandmarks(headLandmarks, {mode: 'head', imageWidth: 1000, imageHeight: 1000});
equal(headMeasured.measurements.bodyHeightM, undefined, 'head mode should not invent a body height field');
ok(headMeasured.warnings.some(item => item.code === 'BODY_MEASUREMENTS_UNAVAILABLE'), 'head mode should expose its body-data boundary');
const headCandidate = buildCandidateMorphs(headMeasured, baseMorphs);
equal(headCandidate.evidence.shoulderWidth.status, 'unknown', 'head mode should not invent shoulder width');
ok(Number.isFinite(headCandidate.morphs.faceWidth), 'head mode should still produce a bounded face-width candidate');

console.log(JSON.stringify({
  schema: 'humanoid_rig/photo_fit_check@0.1',
  checks,
  mode: 'pure-data-no-browser',
  passed: true
}, null, 2));
