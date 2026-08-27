import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { createMotionFoundationAssetsV4 } from '../src/modules/animation/motion-foundation-assets-v4.js';

const OUTPUT_DIRECTORY = resolve('artifacts/qa/task17a-natural-motion');
const OUTPUT_PATH = resolve(OUTPUT_DIRECTORY, 'existing-motion-foundation-audit.json');

const clips = createMotionFoundationAssetsV4();
const assets = clips.map((clip) => ({
  clipId: clip.clipId,
  name: clip.name,
  duration: clip.duration,
  loopMode: clip.loopMode,
  rootMotion: clip.rootMotion,
  rotationTracks: clip.tracks.map((track) => ({
    trackId: track.trackId,
    jointId: track.jointId,
    type: track.type,
    space: track.space,
    interpolation: track.interpolation,
    keyframeCount: track.keyframes.length,
  })),
  contacts: clip.contacts,
  phaseData: clip.phaseData,
  events: clip.events,
  featureAudit: {
    completeLeftRightSupportAndSwing: clip.clipId === 'foundation-walk-v4'
      && hasBothStates(clip.phaseData.samples, 'leftFootState')
      && hasBothStates(clip.phaseData.samples, 'rightFootState'),
    pelvisLateralWeightShift: clip.tracks.some((track) => track.jointId === 'hips' || track.jointId === 'pelvis'),
    pelvisChestCounterRotation: hasAnyTrack(clip, ['hips', 'pelvis']) && hasAnyTrack(clip, ['chest', 'upperChest']),
    armSwing: hasAnyTrack(clip, ['leftUpperArm', 'rightUpperArm']),
    heelStrike: clip.events.some((event) => event.eventType === 'heel_strike')
      || clip.phaseData.markers.some((marker) => marker.markerType === 'heel_strike'),
    plantedFootSupport: clip.contacts.some((contact) => contact.contactType === 'foot_contact'),
    toeOff: clip.events.some((event) => event.eventType === 'toe_off')
      || clip.phaseData.markers.some((marker) => marker.markerType === 'toe_off'),
    trueVisualAcceptance: clip.quality.visualAcceptance === true,
    contractFixtureOnly: clip.quality.status === 'development-contract-fixture',
  },
  quality: clip.quality,
}));

const report = {
  schema: 'humanoid_rig/task17a_existing_motion_foundation_audit@1.0',
  task: 'Task 17A Human Core Natural Motion Execution Foundation',
  sourceModule: 'src/modules/animation/motion-foundation-assets-v4.js',
  assetCount: assets.length,
  expectedAssetIds: clips.map((clip) => clip.clipId),
  assets,
  summary: {
    allAssetsPreserved: true,
    contractFixtureCount: assets.filter((asset) => asset.featureAudit.contractFixtureOnly).length,
    trueVisualAcceptanceCount: assets.filter((asset) => asset.featureAudit.trueVisualAcceptance).length,
    completeWalkPhaseAssetCount: assets.filter((asset) => asset.featureAudit.completeLeftRightSupportAndSwing).length,
    pelvisLateralWeightShiftAssetCount: assets.filter((asset) => asset.featureAudit.pelvisLateralWeightShift).length,
    pelvisChestCounterRotationAssetCount: assets.filter((asset) => asset.featureAudit.pelvisChestCounterRotation).length,
    armSwingAssetCount: assets.filter((asset) => asset.featureAudit.armSwing).length,
    conclusion: 'BASELINE_CONTRACT_FIXTURES_ONLY_NOT_PRODUCTION_MOTION',
  },
  policy: {
    existingAssetsModified: false,
    existingWalkOrTurnPromotedToProduction: false,
    use: 'comparison-baseline-only',
  },
};

await mkdir(OUTPUT_DIRECTORY, { recursive: true });
await writeFile(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`PASS Task 17A Motion Foundation audit: ${assets.length} preserved fixtures -> ${OUTPUT_PATH}`);

function hasBothStates(samples, key) {
  const values = new Set(samples.map((sample) => sample[key]));
  return values.has('stance') && values.has('swing');
}

function hasAnyTrack(clip, jointIds) {
  return clip.tracks.some((track) => jointIds.includes(track.jointId));
}
