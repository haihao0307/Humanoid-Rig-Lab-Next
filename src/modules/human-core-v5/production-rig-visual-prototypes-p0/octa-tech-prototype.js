import { P0_CANDIDATES, createP0RigSnapshot } from './rig-prototype-data.js';
import { PALETTE, createBox, createOctaBone, createPlate, joint3, line3 } from './svg-projection-renderer.js';

export function createOctaTechPrototype() {
  const snapshot = createP0RigSnapshot();
  const primitives = [];
  for (const segment of snapshot.segments) {
    const width = segmentWidth(segment);
    primitives.push(...createOctaBone(segment.start, segment.end, width, {
      fill: PALETTE.coreDark,
      stroke: PALETTE.core,
      strokeWidth: 1.15,
      rollStroke: PALETTE.warm,
      opacity: 0.94,
    }));
  }
  primitives.push(
    createBox([0, 0.94, 0.016], [0.25, 0.09, 0.11], frameStyle()),
    createBox([0, 1.29, 0.006], [0.35, 0.12, 0.11], frameStyle()),
    createBox([0, 1.655, 0.055], [0.18, 0.22, 0.16], frameStyle()),
    createPlate([-0.758, 1.3287, -0.001], 0.13, 0.075, 0.025, plateStyle()),
    createPlate([0.758, 1.3287, -0.001], 0.13, 0.075, 0.025, plateStyle()),
    createPlate([-0.16, 0.075, -0.07], 0.12, 0.04, 0.25, plateStyle()),
    createPlate([0.16, 0.075, -0.07], 0.12, 0.04, 0.25, plateStyle()),
  );
  for (const joint of snapshot.joints) {
    primitives.push(joint3(joint.worldPosition, joint.id === 'hips' ? 0.016 : 0.0115, { fill: PALETTE.joint, stroke: PALETTE.coreDark }));
  }
  primitives.push(line3([[-0.83, 0.001, 0], [0.83, 0.001, 0]], { stroke: PALETTE.warm, strokeWidth: 1.2, opacity: 0.5 }));
  return { candidate: P0_CANDIDATES.OCTA_TECH, snapshot, primitives };
}

function segmentWidth(segment) {
  if (segment.id.startsWith('hips->') || segment.id.includes('UpperLeg')) return Math.min(0.072, segment.length * 0.20);
  if (segment.id.includes('upperChest') || segment.id.includes('UpperArm')) return Math.min(0.062, segment.length * 0.19);
  if (segment.id.includes('LowerArm') || segment.id.includes('LowerLeg')) return Math.min(0.047, segment.length * 0.16);
  return Math.min(0.052, segment.length * 0.18);
}

function frameStyle() { return { fill: '#153d50', stroke: PALETTE.warm, strokeWidth: 1.1, opacity: 0.38 }; }
function plateStyle() { return { fill: '#1a5064', stroke: PALETTE.core, strokeWidth: 1.1, opacity: 0.82 }; }
