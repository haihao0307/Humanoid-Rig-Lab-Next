import { P0_CANDIDATES, createP0RigSnapshot } from './rig-prototype-data.js';
import { PALETTE, createArc, createBox, createPlate, createRing, createWaistedBone, joint3, line3, loop3, vecAdd, vecScale, vecSub } from './svg-projection-renderer.js';

export function createHybridProductionPrototype() {
  const snapshot = createP0RigSnapshot();
  const byId = new Map(snapshot.joints.map((joint) => [joint.id, joint.worldPosition]));
  const primitives = [];

  for (const id of ['hips->spine', 'spine->chest', 'chest->upperChest', 'upperChest->neck', 'neck->head']) {
    const segment = snapshot.segments.find((item) => item.id === id);
    primitives.push(createWaistedBone(segment.start, segment.end, id === 'neck->head' ? 0.045 : 0.052, boneStyle()));
  }
  for (const side of ['left', 'right']) {
    addShoulder(primitives, byId, side);
    addArm(primitives, byId, side);
    addLeg(primitives, byId, side);
    addHand(primitives, byId.get(`${side}Hand`), side);
    addFoot(primitives, byId.get(`${side}Foot`), side);
  }
  addThorax(primitives);
  addPelvis(primitives);
  primitives.push(
    createBox([0, 1.65, 0.055], [0.19, 0.22, 0.17], { fill: '#355362', stroke: PALETTE.warm, strokeWidth: 1.15, opacity: 0.72 }),
    createRing([0, 1.64, 0.055], 0.105, 0.12, 'yz', 20, { stroke: PALETTE.core, strokeWidth: 1.1, opacity: 0.7 }),
  );
  for (const joint of snapshot.joints) {
    primitives.push(joint3(joint.worldPosition, 0.0105, { fill: PALETTE.joint, stroke: '#21414d', strokeWidth: 1.1 }));
  }
  return { candidate: P0_CANDIDATES.HYBRID_PRODUCTION, snapshot, primitives };
}

function addShoulder(primitives, byId, side) {
  const sign = side === 'left' ? -1 : 1;
  const shoulder = byId.get(`${side}Shoulder`);
  const upperArm = byId.get(`${side}UpperArm`);
  primitives.push(
    createArc([0, 1.335, 0.02], 0.19, sign < 0 ? Math.PI * 0.54 : -Math.PI * 0.04, sign < 0 ? Math.PI * 1.03 : Math.PI * 0.46, 'xy', 16, { stroke: PALETTE.warm, strokeWidth: 4.2, opacity: 0.82 }),
    createPlate([sign * 0.135, 1.355, 0.043], 0.10, 0.12, 0.024, { fill: '#42656b', stroke: PALETTE.accent, strokeWidth: 1, opacity: 0.72 }),
    createWaistedBone(shoulder, upperArm, 0.043, boneStyle()),
  );
}

function addArm(primitives, byId, side) {
  const upper = byId.get(`${side}UpperArm`);
  const lower = byId.get(`${side}LowerArm`);
  const hand = byId.get(`${side}Hand`);
  primitives.push(createWaistedBone(upper, lower, 0.057, boneStyle()));
  primitives.push(...dualRail(lower, hand, 0.023));
}

function addLeg(primitives, byId, side) {
  const upper = byId.get(`${side}UpperLeg`);
  const lower = byId.get(`${side}LowerLeg`);
  const foot = byId.get(`${side}Foot`);
  primitives.push(createWaistedBone(upper, lower, 0.077, { ...boneStyle(), fill: '#315b67' }));
  primitives.push(...dualRail(lower, foot, 0.028));
}

function addThorax(primitives) {
  for (const [y, rx, rz] of [[1.20, 0.16, 0.075], [1.255, 0.19, 0.09], [1.31, 0.205, 0.10], [1.365, 0.19, 0.085]]) {
    primitives.push(
      createArc([0, y, 0.015], rx, Math.PI * 0.08, Math.PI * 0.92, 'xy', 18, { stroke: PALETTE.core, strokeWidth: 2.1, opacity: 0.8 }),
      createArc([0, y, 0.015], rz, -Math.PI * 0.42, Math.PI * 0.42, 'yz', 12, { stroke: PALETTE.accent, strokeWidth: 1.25, opacity: 0.62 }),
    );
  }
  primitives.push(line3([[0, 1.18, 0.09], [0, 1.39, 0.08]], { stroke: PALETTE.warm, strokeWidth: 2, opacity: 0.68 }));
}

function addPelvis(primitives) {
  primitives.push(
    createArc([-0.105, 0.96, 0.018], 0.13, Math.PI * 0.15, Math.PI * 1.12, 'xy', 16, { stroke: PALETTE.core, strokeWidth: 4, opacity: 0.82 }),
    createArc([0.105, 0.96, 0.018], 0.13, -Math.PI * 0.12, Math.PI * 0.85, 'xy', 16, { stroke: PALETTE.core, strokeWidth: 4, opacity: 0.82 }),
    createRing([0, 0.93, 0.016], 0.16, 0.10, 'xz', 24, { stroke: PALETTE.accent, strokeWidth: 2.2, opacity: 0.72 }),
    line3([[-0.16, 0.91, 0.03], [0, 0.86, 0.075], [0.16, 0.91, 0.03]], { stroke: PALETTE.warm, strokeWidth: 3, opacity: 0.78 }),
  );
}

function addHand(primitives, hand, side) {
  const sign = side === 'left' ? -1 : 1;
  primitives.push(
    createPlate([hand[0] + sign * 0.045, hand[1], hand[2]], 0.12, 0.082, 0.026, { fill: '#305a63', stroke: PALETTE.accent, strokeWidth: 1.15, opacity: 0.86 }),
    ...[-0.026, -0.009, 0.009, 0.026].map((dy) => line3([[hand[0] + sign * 0.01, hand[1] + dy, hand[2]], [hand[0] + sign * 0.105, hand[1] + dy * 1.15, hand[2]]], { stroke: PALETTE.core, strokeWidth: 1.1, opacity: 0.72 })),
  );
}

function addFoot(primitives, foot, side) {
  const sign = side === 'left' ? -1 : 1;
  const x = foot[0];
  const y = foot[1];
  primitives.push(
    loop3([[x - 0.055, y - 0.035, 0.045], [x + 0.055, y - 0.035, 0.045], [x + 0.062, y - 0.045, -0.20], [x - 0.062, y - 0.045, -0.20]], { stroke: PALETTE.core, strokeWidth: 2.2, opacity: 0.85 }),
    line3([[x - 0.055, y - 0.035, 0.045], [x, y - 0.006, -0.075], [x + 0.062, y - 0.045, -0.20]], { stroke: PALETTE.warm, strokeWidth: 1.6, opacity: 0.78 }),
    line3([[x, y - 0.02, -0.16], [x + sign * 0.008, y - 0.02, -0.245]], { stroke: PALETTE.accent, strokeWidth: 2, opacity: 0.74 }),
  );
}

function dualRail(start, end, spacing) {
  const direction = vecSub(end, start);
  const offset = [0, 0, spacing];
  return [
    line3([vecAdd(start, offset), vecAdd(end, vecScale(offset, 0.72))], { stroke: PALETTE.core, strokeWidth: 4.4, opacity: 0.86 }),
    line3([vecAdd(start, vecScale(offset, -1)), vecAdd(end, vecScale(offset, -0.72))], { stroke: PALETTE.accent, strokeWidth: 3.2, opacity: 0.8 }),
    line3([vecAdd(start, vecScale(direction, 0.5)), vecAdd(vecAdd(start, vecScale(direction, 0.5)), offset)], { stroke: PALETTE.warm, strokeWidth: 1.2, opacity: 0.7 }),
  ];
}

function boneStyle() { return { fill: '#294d5b', stroke: PALETTE.core, strokeWidth: 1.05, opacity: 0.9 }; }
