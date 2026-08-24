import { createMotionClipV4, assertMotionClipV4 } from './motion-clip-v4.js';

export const MOTION_RETARGET_PROFILE_V4_SCHEMA = 'humanoid_rig/motion_retarget_profile@4.0';

export function createMotionRetargetProfile(input = {}) {
  const sourceDimensions = normalizeDimensions(input.sourceDimensions);
  const targetDimensions = normalizeDimensions(input.targetDimensions, sourceDimensions);
  return {
    schema: MOTION_RETARGET_PROFILE_V4_SCHEMA,
    schemaVersion: 4,
    profileId: String(input.profileId || 'motion-retarget-v4'),
    sourceRigVersion: String(input.sourceRigVersion || 'rig@0.4.0'),
    targetRigVersion: String(input.targetRigVersion || input.sourceRigVersion || 'rig@0.4.0'),
    sourceProportionRevision: revision(input.sourceProportionRevision),
    targetProportionRevision: revision(input.targetProportionRevision),
    sourceDimensions,
    targetDimensions,
    rootMotionScale: ratio(targetDimensions.height, sourceDimensions.height),
    legScale: ratio(targetDimensions.legLength, sourceDimensions.legLength),
    armScale: ratio(targetDimensions.armLength, sourceDimensions.armLength),
    preserveLocalQuaternions: true,
  };
}

export function validateMotionRetargetProfile(value) {
  const errors = [];
  if (value?.schema !== MOTION_RETARGET_PROFILE_V4_SCHEMA) errors.push('RETARGET_PROFILE_SCHEMA_INVALID');
  if (!String(value?.sourceRigVersion || '').trim()) errors.push('SOURCE_RIG_REQUIRED');
  if (!String(value?.targetRigVersion || '').trim()) errors.push('TARGET_RIG_REQUIRED');
  for (const field of ['rootMotionScale', 'legScale', 'armScale']) {
    if (!(Number(value?.[field]) > 0)) errors.push(`RETARGET_${field.toUpperCase()}_INVALID`);
  }
  if (value?.preserveLocalQuaternions !== true) errors.push('LOCAL_QUATERNION_PRESERVATION_REQUIRED');
  return { valid: errors.length === 0, errors };
}

/**
 * Retargets root/contact spatial data only. Joint local quaternions are cloned
 * byte-for-number so proportion adaptation cannot rewrite authored rotations.
 */
export function retargetMotionClipV4(clipInput, profileInput) {
  const clip = createMotionClipV4(clipInput);
  assertMotionClipV4(clip);
  const profile = profileInput?.schema === MOTION_RETARGET_PROFILE_V4_SCHEMA
    ? structuredClone(profileInput)
    : createMotionRetargetProfile(profileInput);
  const validation = validateMotionRetargetProfile(profile);
  if (!validation.valid) throw new Error(`Invalid MotionRetargetProfile V4: ${validation.errors.join(' ')}`);
  if (profile.sourceRigVersion !== clip.sourceRigVersion) {
    throw new Error(`Motion retarget source rig ${profile.sourceRigVersion} does not match clip ${clip.sourceRigVersion}.`);
  }

  return createMotionClipV4({
    ...structuredClone(clip),
    rootMotion: {
      ...structuredClone(clip.rootMotion),
      positionTrack: {
        ...structuredClone(clip.rootMotion.positionTrack),
        keyframes: clip.rootMotion.positionTrack.keyframes.map((key) => ({
          time: key.time,
          value: scaleRootPosition(key.value, profile),
        })),
      },
    },
    contacts: clip.contacts.map((contact) => ({
      ...structuredClone(contact),
      position: scaleContactPosition(contact, profile),
    })),
    tracks: clip.tracks.map((track) => ({
      ...structuredClone(track),
      keyframes: track.keyframes.map((key) => ({ time: key.time, value: [...key.value] })),
    })),
    metadata: {
      ...structuredClone(clip.metadata),
      runtimeRetarget: {
        profileId: profile.profileId,
        targetRigVersion: profile.targetRigVersion,
        targetProportionRevision: profile.targetProportionRevision,
        rootMotionScale: profile.rootMotionScale,
        legScale: profile.legScale,
        armScale: profile.armScale,
        localQuaternionsPreserved: true,
      },
    },
  });
}

export function buildMotionContactIkTargets(contacts = []) {
  return contacts.map((contact) => ({
    targetId: `motion-contact-${contact.contactId}`,
    source: 'motion-contact-data-v4',
    jointId: contact.jointId,
    targetType: contact.contactType === 'hand_contact' ? 'hand' : 'foot',
    position: [...contact.position],
    normal: [...contact.normal],
    confidence: contact.confidence,
  }));
}

function scaleRootPosition(value, profile) {
  return [
    Number(value[0]) * profile.rootMotionScale,
    Number(value[1]) * profile.legScale,
    Number(value[2]) * profile.rootMotionScale,
  ];
}

function scaleContactPosition(contact, profile) {
  const amount = contact.contactType === 'hand_contact' ? profile.armScale : profile.legScale;
  return [Number(contact.position[0]) * amount, Number(contact.position[1]) * amount, Number(contact.position[2]) * amount];
}

function normalizeDimensions(input = {}, fallback = { height: 1, legLength: 1, armLength: 1 }) {
  return {
    height: positive(input.height, fallback.height),
    legLength: positive(input.legLength, fallback.legLength),
    armLength: positive(input.armLength, fallback.armLength),
  };
}

function positive(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function ratio(target, source) {
  return Math.max(0.01, Number(target) / Math.max(0.01, Number(source)));
}

function revision(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
}
