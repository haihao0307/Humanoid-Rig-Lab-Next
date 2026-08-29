import { P0_CANDIDATES, createP0RigSnapshot } from './rig-prototype-data.js';
import { PALETTE, createBox, createDiamond, createRing, createWireOctaBone, joint3, line3, loop3 } from './svg-projection-renderer.js';

export function createControlStudioPrototype() {
  const snapshot = createP0RigSnapshot();
  const primitives = [];
  for (const segment of snapshot.segments) {
    primitives.push(...createWireOctaBone(segment.start, segment.end, Math.min(0.042, segment.length * 0.14), {
      stroke: PALETTE.core,
      strokeWidth: 1.25,
      opacity: 0.72,
    }));
  }
  for (const joint of snapshot.joints) {
    primitives.push(joint3(joint.worldPosition, 0.008, { fill: PALETTE.joint, stroke: PALETTE.coreDark, opacity: 0.9 }));
  }
  primitives.push(
    createRing([0, 0.015, 0], 0.29, 0.18, 'xz', 32, controlStyle(3.4)),
    createBox([0, 0.93, 0.016], [0.30, 0.14, 0.18], boxControlStyle()),
    createRing([0, 1.31, 0.01], 0.23, 0.15, 'xz', 32, controlStyle(3.1)),
    createBox([0, 1.65, 0.055], [0.23, 0.25, 0.22], boxControlStyle()),
    squareAt([-0.78, 1.329, -0.001], 0.12),
    squareAt([0.78, 1.329, -0.001], 0.12),
    footOutline(-0.16),
    footOutline(0.16),
    createDiamond([-0.49, 1.25, -0.20], 0.055, 'xy', controlStyle(2.5)),
    createDiamond([0.49, 1.25, -0.20], 0.055, 'xy', controlStyle(2.5)),
    createDiamond([-0.11, 0.52, -0.24], 0.062, 'xy', controlStyle(2.5)),
    createDiamond([0.11, 0.52, -0.24], 0.062, 'xy', controlStyle(2.5)),
    createRing([0, 1.66, -0.48], 0.075, 0.075, 'xy', 24, { stroke: PALETTE.warm, strokeWidth: 2.6, opacity: 0.92 }),
    line3([[-0.09, 1.66, -0.48], [0.09, 1.66, -0.48]], { stroke: PALETTE.warm, strokeWidth: 1.4, opacity: 0.9 }),
    line3([[0, 1.57, -0.48], [0, 1.75, -0.48]], { stroke: PALETTE.warm, strokeWidth: 1.4, opacity: 0.9 }),
    line3([[0, 1.65, 0.055], [0, 1.66, -0.405]], { stroke: PALETTE.warm, strokeWidth: 1.1, opacity: 0.5, dash: '5 5' }),
  );
  return { candidate: P0_CANDIDATES.CONTROL_STUDIO, snapshot, primitives };
}

function squareAt(center, size) {
  const half = size * 0.5;
  return loop3([
    [center[0] - half, center[1] - half, center[2]], [center[0] + half, center[1] - half, center[2]],
    [center[0] + half, center[1] + half, center[2]], [center[0] - half, center[1] + half, center[2]],
  ], controlStyle(2.8));
}

function footOutline(x) {
  return loop3([[x - 0.075, 0.075, 0.07], [x + 0.075, 0.075, 0.07], [x + 0.08, 0.055, -0.26], [x - 0.08, 0.055, -0.26]], controlStyle(2.8));
}

function controlStyle(strokeWidth) { return { stroke: PALETTE.control, strokeWidth, opacity: 0.92 }; }
function boxControlStyle() { return { fill: PALETTE.controlDark, stroke: PALETTE.control, strokeWidth: 1.7, opacity: 0.25 }; }
