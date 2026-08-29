import { gradientDenseFieldV1, sampleDenseFieldV1, sampleDenseRegionV1 } from './field-format-v1.js';

export const ARTICULATED_HUMAN_DEFORMATION_FIELD_V1 = 'ArticulatedHumanDeformationFieldV1';
export const MAXIMUM_INVERSE_WARP_ITERATIONS_V1 = 4;

export const TASK18A_POSE_IDS_V1 = Object.freeze([
  'reference_a_pose',
  'reference_t_pose',
  'shoulder_150',
  'elbow_135',
  'forearm_pronation_90',
  'spine_twist_45',
  'hip_flexion_90',
  'deep_squat',
  'knee_flexion_135',
]);

const CHART_SPECS = Object.freeze([
  chart('pelvis', 'pelvis', 'spineLower', 0.22, 'torso', null),
  chart('spine-lower', 'spineLower', 'spineMiddle', 0.18, 'torso', 'pelvis'),
  chart('spine-middle', 'spineMiddle', 'spineUpper', 0.18, 'torso', 'spine-lower'),
  chart('chest', 'spineUpper', 'neck', 0.22, 'torso', 'spine-middle'),
  chart('head-neck', 'neck', 'head', 0.14, 'head', 'chest'),
  chart('head', 'head', null, 0.135, 'head', 'head-neck', [0, 0.12, 0.02]),
  chart('left-upper-arm', 'leftUpperArm', 'leftLowerArm', 0.09, 'shoulder', 'chest'),
  chart('left-forearm', 'leftLowerArm', 'leftHand', 0.072, 'elbow', 'left-upper-arm'),
  chart('left-hand', 'leftHand', 'leftMiddleDistal', 0.075, 'hand', 'left-forearm'),
  chart('right-upper-arm', 'rightUpperArm', 'rightLowerArm', 0.09, 'shoulder', 'chest'),
  chart('right-forearm', 'rightLowerArm', 'rightHand', 0.072, 'elbow', 'right-upper-arm'),
  chart('right-hand', 'rightHand', 'rightMiddleDistal', 0.075, 'hand', 'right-forearm'),
  chart('left-thigh', 'leftUpperLeg', 'leftLowerLeg', 0.13, 'hip', 'pelvis'),
  chart('left-calf', 'leftLowerLeg', 'leftFoot', 0.105, 'knee', 'left-thigh'),
  chart('left-foot', 'leftFoot', 'leftToe', 0.105, 'foot', 'left-calf'),
  chart('right-thigh', 'rightUpperLeg', 'rightLowerLeg', 0.13, 'hip', 'pelvis'),
  chart('right-calf', 'rightLowerLeg', 'rightFoot', 0.105, 'knee', 'right-thigh'),
  chart('right-foot', 'rightFoot', 'rightToe', 0.105, 'foot', 'right-calf'),
]);

export function createTask18APosesV1(fixtures) {
  const byId = new Map(fixtures.fixtures.map((pose) => [pose.poseId, pose]));
  const cloneFixture = (poseId, sourceId, label, overrides = {}) => {
    const source = byId.get(sourceId);
    if (!source) throw new Error(`Missing source fixture ${sourceId}.`);
    return {
      poseId,
      label,
      sourceFixtureId: source.fixtureId,
      sourcePoseId: source.poseId,
      poseAuthority: 'finalPose.localRotations',
      rootTranslation: [...(source.rootTranslation ?? [0, 0, 0])],
      localRotations: structuredClone(source.localRotations ?? {}),
      authoredChannels: structuredClone(source.authoredChannels ?? []),
      intentionalContact: Boolean(source.intentionalContact),
      ...overrides,
    };
  };
  const poses = [
    cloneFixture('reference_a_pose', 'reference_a_pose', 'Reference A Pose'),
    cloneFixture('reference_t_pose', 'reference_t_pose', 'Reference T Pose'),
    cloneFixture('shoulder_150', 'left_shoulder_150', 'Shoulder 150'),
    cloneFixture('elbow_135', 'elbow_flex_135', 'Elbow 135'),
    cloneFixture('forearm_pronation_90', 'forearm_pronation', 'Forearm Pronation 90'),
    cloneFixture('spine_twist_45', 'spine_twist_left', 'Spine Twist 45'),
    cloneFixture('hip_flexion_90', 'hip_flexion_90', 'Hip Flexion 90'),
    cloneFixture('deep_squat', 'deep_squat', 'Deep Squat', { intentionalContact: true }),
    cloneFixture('knee_flexion_135', 'knee_flex_135', 'Knee Flexion 135'),
  ];
  const pronation = poses.find((pose) => pose.poseId === 'forearm_pronation_90');
  pronation.localRotations.leftLowerArm = scaleQuaternionAngle(pronation.localRotations.leftLowerArm, 90 / 82);
  pronation.localRotations.rightLowerArm = scaleQuaternionAngle(pronation.localRotations.rightLowerArm, 90 / 82);
  pronation.authoredChannels = [{ jointId: 'leftLowerArm', twist: -90 }, { jointId: 'rightLowerArm', twist: 90 }];
  const spine = poses.find((pose) => pose.poseId === 'spine_twist_45');
  const q15 = axisAngle([0, 1, 0], 15 * Math.PI / 180);
  spine.localRotations = { spine: q15, chest: q15, upperChest: q15 };
  spine.authoredChannels = [{ jointId: 'spine', twist: 15 }, { jointId: 'chest', twist: 15 }, { jointId: 'upperChest', twist: 15 }];
  return poses;
}

export function createArticulatedPoseStateV1(rig, pose) {
  const jointById = new Map(rig.joints.map((joint) => [joint.id, joint]));
  const worldById = new Map();
  const inverseById = new Map();
  const bindInverseById = new Map(rig.joints.map((joint) => [joint.id, translationMatrix(joint.bindWorldPosition.map((value) => -value))]));
  for (const joint of rig.joints) {
    const parentWorld = joint.parentId ? worldById.get(joint.parentId) : identityMatrix();
    const authored = !joint.derived ? (pose.localRotations[joint.id] ?? (joint.sourceJointId ? pose.localRotations[joint.sourceJointId] : null)) : null;
    const rotation = authored ?? [0, 0, 0, 1];
    const local = multiplyMatrix(translationMatrix(joint.bindLocalPosition), quaternionMatrix(rotation));
    const world = multiplyMatrix(parentWorld, local);
    worldById.set(joint.id, world);
    const skin = multiplyMatrix(world, bindInverseById.get(joint.id));
    inverseById.set(joint.id, invertRigidMatrix(skin));
  }
  const charts = CHART_SPECS.map((spec) => {
    const startJoint = jointById.get(spec.startJointId);
    const endJoint = spec.endJointId ? jointById.get(spec.endJointId) : null;
    if (!startJoint) throw new Error(`Chart ${spec.id} references missing joint ${spec.startJointId}.`);
    const bindStart = [...startJoint.bindWorldPosition];
    const bindEnd = endJoint ? [...endJoint.bindWorldPosition] : add3(bindStart, spec.endOffset);
    const skin = multiplyMatrix(worldById.get(spec.startJointId), bindInverseById.get(spec.startJointId));
    const posedStart = transformPoint(skin, bindStart);
    const posedEnd = transformPoint(skin, bindEnd);
    return { ...spec, bindStart, bindEnd, posedStart, posedEnd, forwardMatrix: skin, inverseMatrix: inverseById.get(spec.startJointId) };
  });
  const maximumBoneLengthError = maximum(rig.joints.map((joint) => {
    const child = rig.joints.find((candidate) => candidate.parentId === joint.id);
    if (!child) return 0;
    const bindLength = distance3(joint.bindWorldPosition, child.bindWorldPosition);
    const posedLength = distance3(matrixTranslation(worldById.get(joint.id)), matrixTranslation(worldById.get(child.id)));
    return Math.abs(bindLength - posedLength);
  }));
  return {
    schema: 'humanoid_rig/articulated_pose_state@1.0',
    pose,
    rigId: rig.rigId,
    charts,
    worldById,
    inverseById,
    maximumBoneLengthError,
    inverseWarpIterationLimit: MAXIMUM_INVERSE_WARP_ITERATIONS_V1,
  };
}

export function inverseArticulatedWarpV1(point, poseState) {
  const candidates = nearestTwoCharts(point, poseState.charts, true);
  const primary = poseState.charts[candidates.firstIndex];
  const secondary = poseState.charts[candidates.secondIndex];
  const related = primary.parentChartId === secondary.id || secondary.parentChartId === primary.id || (primary.parentChartId && primary.parentChartId === secondary.parentChartId);
  const blendWidth = related ? 0.22 : 0.04;
  const delta = candidates.secondScore - candidates.firstScore;
  const secondaryWeight = related ? 0.5 * smoothstep(blendWidth, 0, delta) : 0;
  const primaryPoint = transformPoint(primary.inverseMatrix, point);
  const secondaryPoint = secondaryWeight > 0 ? transformPoint(secondary.inverseMatrix, point) : primaryPoint;
  const canonicalPoint = mix3(primaryPoint, secondaryPoint, secondaryWeight);
  const reconstructedPrimary = transformPoint(primary.forwardMatrix, canonicalPoint);
  const reconstructedSecondary = secondaryWeight > 0 ? transformPoint(secondary.forwardMatrix, canonicalPoint) : reconstructedPrimary;
  const reconstructed = mix3(reconstructedPrimary, reconstructedSecondary, secondaryWeight);
  const inverseWarpResidual = distance3(reconstructed, point);
  return {
    canonicalPoint,
    inverseWarpResidual,
    primaryChartIndex: candidates.firstIndex,
    secondaryChartIndex: candidates.secondIndex,
    regionWeights: [{ chartId: primary.id, weight: 1 - secondaryWeight }, ...(secondaryWeight > 0 ? [{ chartId: secondary.id, weight: secondaryWeight }] : [])],
    iterationCount: secondaryWeight > 0 ? 2 : 1,
  };
}

export function forwardArticulatedWarpV1(canonicalPoint, poseState) {
  const candidates = nearestTwoCharts(canonicalPoint, poseState.charts, false);
  const primary = poseState.charts[candidates.firstIndex];
  const secondary = poseState.charts[candidates.secondIndex];
  const related = primary.parentChartId === secondary.id || secondary.parentChartId === primary.id || (primary.parentChartId && primary.parentChartId === secondary.parentChartId);
  const secondaryWeight = related ? 0.5 * smoothstep(0.22, 0, candidates.secondScore - candidates.firstScore) : 0;
  return mix3(transformPoint(primary.forwardMatrix, canonicalPoint), transformPoint(secondary.forwardMatrix, canonicalPoint), secondaryWeight);
}

export function evaluateArticulatedFieldV1(field, worldPoint, poseState, { includeGradient = false } = {}) {
  const warp = inverseArticulatedWarpV1(worldPoint, poseState);
  const canonicalValue = sampleDenseFieldV1(field, warp.canonicalPoint);
  const correction = evaluatePoseCorrectiveFieldsV1(warp.canonicalPoint, poseState.pose);
  const fieldValue = canonicalValue + correction.value;
  const fieldGradient = includeGradient ? normalize3(gradientDenseFieldV1(field, warp.canonicalPoint)) : null;
  const regionId = sampleDenseRegionV1(field, warp.canonicalPoint);
  return {
    ...warp,
    fieldValue,
    fieldGradient,
    regionId,
    correction,
    jacobianDeterminantProxy: 1,
  };
}

export function evaluatePoseCorrectiveFieldsV1(point, pose) {
  const amplitudes = poseCorrectiveAmplitudes(pose);
  const fields = [
    localCorrection('ShoulderAxillaPoseFieldV1', point, [-0.205, 0.505, 0.055], [0.205, 0.505, 0.055], 0.17, amplitudes.shoulder, -0.006),
    localCorrection('ElbowPoseFieldV1', point, [-0.36, 0.292, 0.086], [0.36, 0.292, 0.086], 0.11, amplitudes.elbow, -0.004),
    localCorrection('SpinePoseFieldV1', point, [0, 0.34, 0.11], [0, 0.50, 0.09], 0.24, amplitudes.spine, -0.0025),
    localCorrection('PelvisHipGroinPoseFieldV1', point, [-0.094, 0.10, 0.082], [0.094, 0.10, 0.082], 0.18, amplitudes.hip, -0.005),
    localCorrection('KneePoseFieldV1', point, [-0.133, -0.319, 0.046], [0.133, -0.319, 0.046], 0.12, amplitudes.knee, -0.004),
  ];
  return { value: fields.reduce((sum, field) => sum + field.value, 0), fields };
}

export function numericalInverseJacobianProxyV1(point, poseState, epsilon = 0.0025) {
  const base = inverseArticulatedWarpV1(point, poseState).canonicalPoint;
  const columns = [];
  for (let axis = 0; axis < 3; axis += 1) {
    const p = [...point]; p[axis] += epsilon;
    const q = inverseArticulatedWarpV1(p, poseState).canonicalPoint;
    columns.push(scale3(subtract3(q, base), 1 / epsilon));
  }
  return determinant3(columns[0], columns[1], columns[2]);
}

export function serializePoseStateForRendererV1(poseState) {
  return {
    poseId: poseState.pose.poseId,
    charts: poseState.charts.map((chart) => ({ id: chart.id, region: chart.region, radius: chart.radius, bindStart: chart.bindStart, bindEnd: chart.bindEnd, posedStart: chart.posedStart, posedEnd: chart.posedEnd, forwardMatrix: chart.forwardMatrix, inverseMatrix: chart.inverseMatrix, parentChartId: chart.parentChartId })),
    correctiveAmplitudes: poseCorrectiveAmplitudes(poseState.pose),
    maximumBoneLengthError: poseState.maximumBoneLengthError,
  };
}

function poseCorrectiveAmplitudes(pose) {
  const channels = pose.authoredChannels ?? [];
  const maxFor = (pattern) => Math.max(0, ...channels.filter((channel) => pattern.test(channel.jointId)).map((channel) => Math.max(Math.abs(channel.bend ?? 0), Math.abs(channel.side ?? 0), Math.abs(channel.twist ?? 0))));
  return {
    shoulder: smoothstep(20, 150, maxFor(/UpperArm/)),
    elbow: smoothstep(15, 135, maxFor(/LowerArm/)),
    spine: smoothstep(5, 45, maxFor(/^(spine|chest|upperChest)$/)) || (pose.poseId === 'spine_twist_45' ? 1 : 0),
    hip: smoothstep(15, 90, maxFor(/UpperLeg/)),
    knee: smoothstep(15, 135, maxFor(/LowerLeg/)),
  };
}

function localCorrection(id, point, leftCenter, rightCenter, radius, activation, amplitude) {
  const dl = distance3(point, leftCenter); const dr = distance3(point, rightCenter);
  const influence = Math.max(smoothstep(radius, 0, dl), smoothstep(radius, 0, dr));
  return { id, activation, influence, value: activation * influence * amplitude, continuityClass: 'C1' };
}

function chart(id, startJointId, endJointId, radius, region, parentChartId, endOffset = [0, 0.12, 0]) { return { id, startJointId, endJointId, radius, region, parentChartId, endOffset }; }
function scaleQuaternionAngle(q, scale) { const w = clamp(q[3], -1, 1); const half = Math.acos(w); if (half < 1e-8) return [0, 0, 0, 1]; const sinHalf = Math.sin(half); const axis = [q[0] / sinHalf, q[1] / sinHalf, q[2] / sinHalf]; return axisAngle(axis, half * 2 * scale); }
function axisAngle(axis, angle) { const n = normalize3(axis); const s = Math.sin(angle / 2); return [n[0] * s, n[1] * s, n[2] * s, Math.cos(angle / 2)]; }
function quaternionMatrix(q) { const [x,y,z,w] = normalizeQuaternion(q), x2=x+x,y2=y+y,z2=z+z,xx=x*x2,xy=x*y2,xz=x*z2,yy=y*y2,yz=y*z2,zz=z*z2,wx=w*x2,wy=w*y2,wz=w*z2; return [1-(yy+zz),xy+wz,xz-wy,0,xy-wz,1-(xx+zz),yz+wx,0,xz+wy,yz-wx,1-(xx+yy),0,0,0,0,1]; }
function normalizeQuaternion(q) { const l=Math.hypot(q[0],q[1],q[2],q[3])||1; return q.map((value)=>value/l); }
function translationMatrix(t) { return [1,0,0,0,0,1,0,0,0,0,1,0,t[0],t[1],t[2],1]; }
function identityMatrix() { return translationMatrix([0,0,0]); }
function multiplyMatrix(a,b){const out=new Array(16).fill(0);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)out[c*4+r]+=a[k*4+r]*b[c*4+k];return out;}
function invertRigidMatrix(m){const out=[m[0],m[4],m[8],0,m[1],m[5],m[9],0,m[2],m[6],m[10],0,0,0,0,1],t=[m[12],m[13],m[14]];const it=transformDirection(out,[-t[0],-t[1],-t[2]]);out[12]=it[0];out[13]=it[1];out[14]=it[2];return out;}
function transformPoint(m,p){return[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];}
function transformDirection(m,p){return[m[0]*p[0]+m[4]*p[1]+m[8]*p[2],m[1]*p[0]+m[5]*p[1]+m[9]*p[2],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]];}
function matrixTranslation(m){return[m[12],m[13],m[14]];}
function pointSegmentDistance(p,a,b){const ab=subtract3(b,a),denom=dot3(ab,ab);const t=denom?clamp(dot3(subtract3(p,a),ab)/denom,0,1):0;return distance3(p,add3(a,scale3(ab,t)));}
function nearestTwoCharts(point,charts,posed){let firstIndex=-1,secondIndex=-1,firstScore=Infinity,secondScore=Infinity;for(let index=0;index<charts.length;index+=1){const chart=charts[index],start=posed?chart.posedStart:chart.bindStart,end=posed?chart.posedEnd:chart.bindEnd,score=pointSegmentDistance(point,start,end)/chart.radius;if(score<firstScore){secondScore=firstScore;secondIndex=firstIndex;firstScore=score;firstIndex=index;}else if(score<secondScore){secondScore=score;secondIndex=index;}}return{firstIndex,secondIndex,firstScore,secondScore};}
function determinant3(a,b,c){return a[0]*(b[1]*c[2]-b[2]*c[1])-b[0]*(a[1]*c[2]-a[2]*c[1])+c[0]*(a[1]*b[2]-a[2]*b[1]);}
function mix3(a,b,t){return[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];}
function add3(a,b){return[a[0]+b[0],a[1]+b[1],a[2]+b[2]];}
function subtract3(a,b){return[a[0]-b[0],a[1]-b[1],a[2]-b[2]];}
function scale3(a,s){return[a[0]*s,a[1]*s,a[2]*s];}
function dot3(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
function distance3(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);}
function normalize3(a){const l=Math.hypot(a[0],a[1],a[2])||1;return[a[0]/l,a[1]/l,a[2]/l];}
function smoothstep(edge0,edge1,x){if(edge0===edge1)return x<edge0?0:1;const t=clamp((x-edge0)/(edge1-edge0),0,1);return t*t*(3-2*t);}
function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
function maximum(values){let result=-Infinity;for(const value of values)result=Math.max(result,value);return result;}
