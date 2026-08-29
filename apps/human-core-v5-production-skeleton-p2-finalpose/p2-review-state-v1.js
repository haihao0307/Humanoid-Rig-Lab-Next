export const P2_FIXED_POSE_IDS = Object.freeze([
  'reference-t',
  'reference-a',
  'locomotion-neutral',
  'walk-left-support',
  'walk-right-support',
  'turn-mid',
]);

export const P2_SEQUENCE_POSE_ID = 'sequence';
export const P2_REVIEW_POSE_IDS = Object.freeze([...P2_FIXED_POSE_IDS, P2_SEQUENCE_POSE_ID]);

export function normalizeP2ReviewPoseId(value, fallback = 'reference-t') {
  return P2_REVIEW_POSE_IDS.includes(value) ? value : fallback;
}

export function isP2SequenceRequest(searchParams) {
  return searchParams.get('sequence') === '1' || searchParams.get('pose') === P2_SEQUENCE_POSE_ID;
}

export function buildP2ReviewUrl(currentHref, {
  poseId,
  overlay = false,
  sequence = false,
  closeup,
} = {}) {
  const url = new URL(currentHref, 'http://127.0.0.1/');
  url.searchParams.set('pose', normalizeP2ReviewPoseId(poseId));
  if (overlay) url.searchParams.set('overlay', '1');
  else url.searchParams.delete('overlay');
  if (sequence) url.searchParams.set('sequence', '1');
  else url.searchParams.delete('sequence');
  if (closeup !== undefined) {
    if (closeup) url.searchParams.set('closeup', closeup);
    else url.searchParams.delete('closeup');
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

export function createP2PoseSynchronizationSnapshot({
  poseId,
  urlPoseId,
  selectPoseId,
  summaryPoseId,
} = {}) {
  const publicPoseId = normalizeP2ReviewPoseId(poseId);
  const snapshot = {
    urlPoseId: urlPoseId ?? null,
    selectPoseId: selectPoseId ?? null,
    summaryPoseId: summaryPoseId ?? null,
    publicPoseId,
  };
  snapshot.consistent = [
    snapshot.urlPoseId,
    snapshot.selectPoseId,
    snapshot.summaryPoseId,
    snapshot.publicPoseId,
  ].every((value) => value === publicPoseId);
  return snapshot;
}
