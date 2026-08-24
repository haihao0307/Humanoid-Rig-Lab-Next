const axisAngle = (axis, angle) => {
  const half = angle * 0.5;
  const sine = Math.sin(half);
  return [axis[0] * sine, axis[1] * sine, axis[2] * sine, Math.cos(half)];
};

export const PRODUCTION_SKIN_V4_TEST_POSES = Object.freeze([
  Object.freeze({ id: 't-pose', localRotations: {
    leftUpperArm: axisAngle([0, 0, 1], Math.PI / 5),
    rightUpperArm: axisAngle([0, 0, 1], -Math.PI / 5),
  } }),
  Object.freeze({ id: 'a-pose', localRotations: {} }),
  Object.freeze({ id: 'arm-raise', localRotations: {
    leftUpperArm: axisAngle([0, 0, 1], Math.PI * 0.72),
    leftLowerArm: axisAngle([0, 1, 0], 0.25),
  } }),
  Object.freeze({ id: 'forearm-twist', localRotations: {
    leftLowerArm: axisAngle([1, 0, 0], Math.PI * 0.78),
    rightLowerArm: axisAngle([1, 0, 0], -Math.PI * 0.78),
  } }),
  Object.freeze({ id: 'squat', localRotations: {
    leftUpperLeg: axisAngle([1, 0, 0], -0.95),
    rightUpperLeg: axisAngle([1, 0, 0], -0.95),
    leftLowerLeg: axisAngle([1, 0, 0], 1.35),
    rightLowerLeg: axisAngle([1, 0, 0], 1.35),
    leftFoot: axisAngle([1, 0, 0], -0.40),
    rightFoot: axisAngle([1, 0, 0], -0.40),
  } }),
  Object.freeze({ id: 'lunge', localRotations: {
    leftUpperLeg: axisAngle([1, 0, 0], -0.85),
    leftLowerLeg: axisAngle([1, 0, 0], 1.10),
    rightUpperLeg: axisAngle([1, 0, 0], 0.42),
    rightLowerLeg: axisAngle([1, 0, 0], 0.18),
  } }),
  Object.freeze({ id: 'walk', localRotations: {
    leftUpperLeg: axisAngle([1, 0, 0], -0.55),
    rightUpperLeg: axisAngle([1, 0, 0], 0.55),
    leftLowerLeg: axisAngle([1, 0, 0], 0.72),
    rightLowerLeg: axisAngle([1, 0, 0], 0.12),
    leftFoot: axisAngle([1, 0, 0], -0.22),
    rightFoot: axisAngle([1, 0, 0], 0.18),
  } }),
]);
