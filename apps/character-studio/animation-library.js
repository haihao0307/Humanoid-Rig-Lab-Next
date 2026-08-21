export const ANIMATION_LIBRARY_CATEGORIES = Object.freeze([
  Object.freeze({ id: 'idle', label: 'Idle' }),
  Object.freeze({ id: 'walk', label: 'Walk' }),
  Object.freeze({ id: 'run', label: 'Run' }),
  Object.freeze({ id: 'jump', label: 'Jump' }),
  Object.freeze({ id: 'gesture', label: 'Gesture' }),
  Object.freeze({ id: 'combat', label: 'Combat' }),
]);

export function resolveAnimationLibraryCategory(clip = {}) {
  const category = String(clip.assetMetadata?.category || clip.metadata?.category || '').toLowerCase();
  const searchable = [
    clip.clipId,
    clip.name,
    ...(clip.assetMetadata?.tags || []),
    ...(clip.metadata?.tags || []),
  ].join(' ').toLowerCase();

  if (category === 'idle' || /\bidle\b|breathe/.test(searchable)) return 'idle';
  if (category === 'combat' || /combat|attack|fight|punch|kick/.test(searchable)) return 'combat';
  if (category === 'jump' || /jump|hop|leap|squat/.test(searchable)) return 'jump';
  if (/\brun(?:ning)?\b|sprint|jog/.test(searchable)) return 'run';
  if (category === 'locomotion' || /walk|locomotion|step/.test(searchable)) return 'walk';
  return 'gesture';
}

export function buildAnimationLibrary(clips = []) {
  const groups = Object.fromEntries(ANIMATION_LIBRARY_CATEGORIES.map(({ id }) => [id, []]));
  for (const clip of Array.isArray(clips) ? clips : []) {
    groups[resolveAnimationLibraryCategory(clip)].push(clip);
  }
  for (const group of Object.values(groups)) {
    group.sort((left, right) => String(left.name).localeCompare(String(right.name)));
  }
  return groups;
}
