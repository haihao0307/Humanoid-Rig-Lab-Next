import { distance } from './math.mjs';

// Read only source landmarks. No copying meshes, old runtimes or animation
// tracks. This diagnostic proxy preserves per-side limb lengths, not skin.
export function rigFromSource(document) {
  const p = id => {
    const v = document.nodes?.[id]?.positionM;
    if (!Array.isArray(v) || v.length !== 3 || !v.every(Number.isFinite)) throw Error('Missing landmark: ' + id);
    return v;
  };
  const legs = Object.fromEntries(['left', 'right'].map(side => [side, {
    upper: distance(p(side + '_femur'), p(side + '_tibia')),
    lower: distance(p(side + '_tibia'), p(side + '_foot'))
  }]));
  const hipHalf = distance(p('left_femur'), p('right_femur')) / 2;
  const ankleHeight = Math.max(.03, (p('left_foot')[1] + p('right_foot')[1]) / 2 - document.sourceFloorM);
  const length = Math.min(...Object.values(legs).map(x => x.upper + x.lower));
  return { legs, hipHalf, ankleHeight, hipHeight: length * .94 + ankleHeight,
    torso: distance(p('hips'), p('head')), nodes: structuredClone(document.nodes), source: document.source,
    measuredMotion: false, visualAcceptance: false };
}
