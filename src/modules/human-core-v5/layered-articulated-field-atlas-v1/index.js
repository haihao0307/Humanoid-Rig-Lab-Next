export const LAYERED_ARTICULATED_HUMAN_FIELD_ATLAS_V1 = 'HRLLayeredArticulatedHumanFieldAtlasV1';
export const MULTI_SHEET_CONTACT_FIELD_V1 = 'HRLMultiSheetContactFieldV1';
export const LAYERED_HUMAN_FIELD_RENDERER_V1 = 'HRLLayeredHumanFieldRendererV1';

export const LOCAL_FIELD_CHART_SPECS_V1 = Object.freeze([
  chart('head', 'head-sheet', ['head'], 'head', null, [0, 0.13, 0.018], ['head', 'face']),
  chart('neck', 'neck-sheet', ['neck', 'head'], 'neck', 'head', null, ['neck_base']),
  chart('chest', 'torso-sheet', ['spineUpper', 'chest', 'neck'], 'spineUpper', 'neck', null, ['clavicle', 'shoulder_cap', 'chest']),
  chart('abdomen', 'torso-sheet', ['spineLower', 'spineMiddle', 'spineUpper'], 'spineLower', 'spineUpper', null, ['abdomen', 'waist']),
  chart('pelvisCore', 'pelvis-sheet', ['pelvis', 'spineLower'], 'pelvis', 'spineLower', null, ['pelvis', 'front_groin', 'back_groin', 'gluteal']),
  chart('leftUpperArm', 'left-arm-sheet', ['leftUpperArm', 'leftUpperArmTwist01', 'leftUpperArmTwist02'], 'leftUpperArm', 'leftLowerArm', null, ['deltoid', 'upper_arm_root']),
  chart('rightUpperArm', 'right-arm-sheet', ['rightUpperArm', 'rightUpperArmTwist01', 'rightUpperArmTwist02'], 'rightUpperArm', 'rightLowerArm', null, ['deltoid', 'upper_arm_root']),
  chart('leftForearm', 'left-arm-sheet', ['leftLowerArm', 'leftForearmTwist01', 'leftForearmTwist02'], 'leftLowerArm', 'leftHand', null, ['elbow', 'forearm']),
  chart('rightForearm', 'right-arm-sheet', ['rightLowerArm', 'rightForearmTwist01', 'rightForearmTwist02'], 'rightLowerArm', 'rightHand', null, ['elbow', 'forearm']),
  chart('leftHand', 'left-hand-sheet', ['leftHand', 'leftMiddleProximal', 'leftMiddleDistal'], 'leftHand', 'leftMiddleDistal', null, ['wrist', 'palm', 'finger_base', 'finger_joints']),
  chart('rightHand', 'right-hand-sheet', ['rightHand', 'rightMiddleProximal', 'rightMiddleDistal'], 'rightHand', 'rightMiddleDistal', null, ['wrist', 'palm', 'finger_base', 'finger_joints']),
  chart('leftThigh', 'left-leg-sheet', ['leftUpperLeg', 'leftThighTwist01', 'leftThighTwist02'], 'leftUpperLeg', 'leftLowerLeg', null, ['hip', 'thigh']),
  chart('rightThigh', 'right-leg-sheet', ['rightUpperLeg', 'rightThighTwist01', 'rightThighTwist02'], 'rightUpperLeg', 'rightLowerLeg', null, ['hip', 'thigh']),
  chart('leftCalf', 'left-leg-sheet', ['leftLowerLeg', 'leftCalfTwist01'], 'leftLowerLeg', 'leftFoot', null, ['knee', 'patella', 'popliteal', 'calf']),
  chart('rightCalf', 'right-leg-sheet', ['rightLowerLeg', 'rightCalfTwist01'], 'rightLowerLeg', 'rightFoot', null, ['knee', 'patella', 'popliteal', 'calf']),
  chart('leftFoot', 'left-foot-sheet', ['leftFoot', 'leftToe'], 'leftFoot', 'leftToe', [0, 0, 0.085], ['ankle', 'heel', 'arch', 'forefoot', 'toe_base']),
  chart('rightFoot', 'right-foot-sheet', ['rightFoot', 'rightToe'], 'rightFoot', 'rightToe', [0, 0, 0.085], ['ankle', 'heel', 'arch', 'forefoot', 'toe_base']),
]);

export const JUNCTION_FIELD_SPECS_V1 = Object.freeze([
  junction('neckChestJunction', 'chest', 'neck', ['neck', 'chest'], ['neck', 'spineUpper']),
  junction('leftShoulderAxillaJunction', 'chest', 'leftUpperArm', ['chest', 'leftUpperArm'], ['leftClavicle', 'leftScapula', 'leftUpperArm']),
  junction('rightShoulderAxillaJunction', 'chest', 'rightUpperArm', ['chest', 'rightUpperArm'], ['rightClavicle', 'rightScapula', 'rightUpperArm']),
  junction('leftElbowJunction', 'leftUpperArm', 'leftForearm', ['leftUpperArm', 'leftForearm'], ['leftLowerArm']),
  junction('rightElbowJunction', 'rightUpperArm', 'rightForearm', ['rightUpperArm', 'rightForearm'], ['rightLowerArm']),
  junction('spineLowerJunction', 'pelvisCore', 'abdomen', ['pelvisCore', 'abdomen'], ['pelvis', 'spineLower']),
  junction('spineMiddleJunction', 'abdomen', 'chest', ['abdomen', 'chest'], ['spineMiddle']),
  junction('spineUpperJunction', 'abdomen', 'chest', ['abdomen', 'chest'], ['spineUpper']),
  junction('leftHipGroinJunction', 'pelvisCore', 'leftThigh', ['pelvisCore', 'leftThigh'], ['pelvis', 'leftUpperLeg']),
  junction('rightHipGroinJunction', 'pelvisCore', 'rightThigh', ['pelvisCore', 'rightThigh'], ['pelvis', 'rightUpperLeg']),
  junction('centralGroinJunction', 'pelvisCore', 'leftThigh', ['pelvisCore', 'leftThigh', 'rightThigh'], ['pelvis']),
  junction('leftKneeJunction', 'leftThigh', 'leftCalf', ['leftThigh', 'leftCalf'], ['leftLowerLeg']),
  junction('rightKneeJunction', 'rightThigh', 'rightCalf', ['rightThigh', 'rightCalf'], ['rightLowerLeg']),
  junction('leftWristHandJunction', 'leftForearm', 'leftHand', ['leftForearm', 'leftHand'], ['leftHand']),
  junction('rightWristHandJunction', 'rightForearm', 'rightHand', ['rightForearm', 'rightHand'], ['rightHand']),
  junction('leftAnkleFootJunction', 'leftCalf', 'leftFoot', ['leftCalf', 'leftFoot'], ['leftFoot']),
  junction('rightAnkleFootJunction', 'rightCalf', 'rightFoot', ['rightCalf', 'rightFoot'], ['rightFoot']),
]);

export const JUNCTION_ADJACENCY_GRAPH_V1 = Object.freeze({
  schema: 'humanoid_rig/junction_adjacency_graph@1.0',
  authority: 'Only listed chart pairs may create a continuous blend.',
  edges: JUNCTION_FIELD_SPECS_V1
    .filter((entry) => entry.junctionId !== 'centralGroinJunction')
    .map((entry) => Object.freeze({ junctionId: entry.junctionId, charts: Object.freeze([entry.parentChartId, entry.childChartId]) })),
  forbiddenFusionPairs: Object.freeze([
    ['leftUpperArm', 'chest'], ['rightUpperArm', 'chest'], ['leftHand', 'chest'], ['rightHand', 'chest'],
    ['leftThigh', 'rightThigh'], ['leftThigh', 'abdomen'], ['rightThigh', 'abdomen'],
    ['leftCalf', 'rightThigh'], ['rightCalf', 'leftThigh'], ['leftFoot', 'rightCalf'], ['rightFoot', 'leftCalf'],
    ['leftHand', 'rightUpperArm'], ['rightHand', 'leftUpperArm'],
  ]),
});

export const MULTI_SHEET_CONTACT_RULES_V1 = Object.freeze([
  contact('left-arm-torso', ['leftUpperArm', 'leftForearm'], ['chest', 'abdomen']),
  contact('right-arm-torso', ['rightUpperArm', 'rightForearm'], ['chest', 'abdomen']),
  contact('left-hand-torso', ['leftHand'], ['chest', 'abdomen', 'pelvisCore']),
  contact('right-hand-torso', ['rightHand'], ['chest', 'abdomen', 'pelvisCore']),
  contact('left-right-thigh', ['leftThigh'], ['rightThigh']),
  contact('thigh-pelvis-non-junction', ['leftThigh', 'rightThigh'], ['pelvisCore']),
  contact('calf-thigh-deep-flexion', ['leftCalf', 'rightCalf'], ['leftThigh', 'rightThigh']),
  contact('hand-leg', ['leftHand', 'rightHand'], ['leftThigh', 'rightThigh', 'leftCalf', 'rightCalf']),
  contact('foot-opposite-leg', ['leftFoot'], ['rightThigh', 'rightCalf']),
  contact('right-foot-opposite-leg', ['rightFoot'], ['leftThigh', 'leftCalf']),
]);

export function buildChartBindFramesV1(rig) {
  const joints = new Map(rig.joints.map((entry) => [entry.id, entry]));
  return LOCAL_FIELD_CHART_SPECS_V1.map((spec) => {
    const start = requiredJoint(joints, spec.startJointId).bindWorldPosition;
    const end = spec.endJointId ? requiredJoint(joints, spec.endJointId).bindWorldPosition : add3(start, spec.endOffset ?? [0, 0.12, 0]);
    const center = scale3(add3(start, end), 0.5);
    const yAxis = normalize3(subtract3(end, start));
    const helper = Math.abs(dot3(yAxis, [0, 0, 1])) > 0.92 ? [1, 0, 0] : [0, 0, 1];
    const xAxis = normalize3(cross3(helper, yAxis));
    const zAxis = normalize3(cross3(yAxis, xAxis));
    return { ...structuredClone(spec), bindStart: [...start], bindEnd: [...end], bindCenter: center, bindAxes: [xAxis, yAxis, zAxis] };
  });
}

export function createLayeredPoseStateV1(rig, pose, atlas) {
  const joints = new Map(rig.joints.map((entry) => [entry.id, entry]));
  const worldById = new Map();
  const bindInverseById = new Map(rig.joints.map((joint) => [joint.id, translationMatrix(scale3(joint.bindWorldPosition, -1))]));
  for (const joint of rig.joints) {
    const parentWorld = joint.parentId ? worldById.get(joint.parentId) : identityMatrix();
    const authored = joint.derived ? null : (pose.localRotations?.[joint.id] ?? (joint.sourceJointId ? pose.localRotations?.[joint.sourceJointId] : null));
    const local = multiplyMatrix(translationMatrix(joint.bindLocalPosition), quaternionMatrix(authored ?? [0, 0, 0, 1]));
    worldById.set(joint.id, multiplyMatrix(parentWorld, local));
  }
  const charts = atlas.charts.map((chartAsset) => {
    const anchor = requiredJoint(joints, chartAsset.anchorJointIds[0]);
    const skin = multiplyMatrix(worldById.get(anchor.id), bindInverseById.get(anchor.id));
    const bindWorldFromLocal = frameMatrix(chartAsset.localFrame.bindCenter, chartAsset.localFrame.bindAxes);
    const posedWorldFromLocal = multiplyMatrix(skin, bindWorldFromLocal);
    return {
      ...chartAsset,
      posedWorldFromLocal,
      localFromPosedWorld: invertRigidMatrix(posedWorldFromLocal),
      chartLocalTransformDeterminant: determinantRigid3(posedWorldFromLocal),
    };
  });
  return {
    schema: 'humanoid_rig/layered_articulated_pose_state@1.0',
    poseId: pose.poseId,
    poseAuthority: 'finalPose.localRotations',
    globalInverseWarpEnabled: false,
    charts,
    worldById,
  };
}

export function queryLayeredArticulatedHumanFieldV1(atlas, payload, worldPoint, poseState, { includeGradient = false } = {}) {
  const candidates = [];
  for (const chart of poseState.charts) {
    const localPoint = transformPoint(chart.localFromPosedWorld, worldPoint);
    if (!insideObb(localPoint, chart.compactSupportOBB.halfExtents, chart.compactSupportOBB.queryMargin ?? 0.012)) continue;
    const fieldValue = sampleChartGrid(chart, payload, localPoint);
    if (!Number.isFinite(fieldValue) || Math.abs(fieldValue) > chart.compactSupportOBB.traceBandMeters) continue;
    const gradient = includeGradient
      ? normalize3(transformDirection(chart.posedWorldFromLocal, chartGradient(chart, payload, localPoint)))
      : null;
    candidates.push({
      fieldValue,
      gradient,
      chartId: chart.chartId,
      sheetId: chart.sheetId,
      surfaceCandidate: true,
      contactClass: contactClassForChart(chart.chartId, poseState.charts),
      kind: 'chart',
      localPoint,
    });
  }
  const byChart = new Map(candidates.map((candidate) => [candidate.chartId, candidate]));
  for (const junction of atlas.junctions) {
    const parent = byChart.get(junction.parentChartId);
    const child = byChart.get(junction.childChartId);
    if (!parent || !child) continue;
    const radius = Math.max(junction.blendWidth, 1e-5);
    if (Math.max(Math.abs(parent.fieldValue), Math.abs(child.fieldValue)) > radius * 2.5) continue;
    const value = compactRUnion(parent.fieldValue, child.fieldValue, radius);
    candidates.push({
      fieldValue: value,
      gradient: includeGradient ? normalize3(add3(parent.gradient ?? [0, 1, 0], child.gradient ?? [0, 1, 0])) : null,
      chartId: junction.parentChartId,
      sheetId: `junction:${junction.junctionId}`,
      surfaceCandidate: true,
      contactClass: 'anatomical-junction',
      kind: 'junction',
      junctionId: junction.junctionId,
    });
  }
  candidates.sort((a, b) => Math.abs(a.fieldValue) - Math.abs(b.fieldValue));
  return {
    candidates,
    candidateChartCount: new Set(candidates.map((entry) => entry.chartId)).size,
    candidateSheetCount: new Set(candidates.map((entry) => entry.sheetId)).size,
    winner: candidates[0] ?? null,
  };
}

export function sampleChartGrid(chart, payload, localPoint) {
  const extents = chart.compactSupportOBB.halfExtents;
  const dimensions = chart.grid.dimensions;
  const nx = (localPoint[0] + extents[0]) / (2 * extents[0]);
  const ny = (localPoint[1] + extents[1]) / (2 * extents[1]);
  const nz = (localPoint[2] + extents[2]) / (2 * extents[2]);
  if (nx < 0 || nx > 1 || ny < 0 || ny > 1 || nz < 0 || nz > 1) return Infinity;
  const values = payload.subarray(chart.grid.valueOffset, chart.grid.valueOffset + chart.grid.valueCount);
  return trilinearInt16(values, dimensions, nx, ny, nz) * chart.localSdfScale;
}

export function serializeLayeredPoseStateForRendererV1(poseState) {
  return {
    poseId: poseState.poseId,
    globalInverseWarpEnabled: false,
    charts: poseState.charts.map((chart) => ({
      chartId: chart.chartId,
      sheetId: chart.sheetId,
      posedWorldFromLocal: chart.posedWorldFromLocal,
      localFromPosedWorld: chart.localFromPosedWorld,
      compactSupportOBB: chart.compactSupportOBB,
      chartLocalTransformDeterminant: chart.chartLocalTransformDeterminant,
    })),
  };
}

function chart(chartId, sheetId, anchorJointIds, startJointId, endJointId, endOffset, regionIds) {
  return Object.freeze({ chartId, sheetId, anchorJointIds: Object.freeze(anchorJointIds), startJointId, endJointId, endOffset, regionIds: Object.freeze(regionIds) });
}

function junction(junctionId, parentChartId, childChartId, allowedBlendCharts, jointIds) {
  return Object.freeze({ junctionId, parentChartId, childChartId, allowedBlendCharts: Object.freeze(allowedBlendCharts), jointIds: Object.freeze(jointIds) });
}

function contact(contactClass, a, b) { return Object.freeze({ contactClass, a: Object.freeze(a), b: Object.freeze(b), unionAllowed: false, preserveIndependentSheets: true }); }
function requiredJoint(joints, id) { const result = joints.get(id); if (!result) throw new Error(`Missing required joint ${id}.`); return result; }
function insideObb(point, extents, margin) { return point.every((value, axis) => Math.abs(value) <= extents[axis] + margin); }
function contactClassForChart(id) { return MULTI_SHEET_CONTACT_RULES_V1.some((rule) => rule.a.includes(id) || rule.b.includes(id)) ? 'multi-sheet-capable' : 'none'; }
function compactRUnion(a, b, radius) { const h = Math.max(radius - Math.abs(a - b), 0) / radius; return Math.min(a, b) - h * h * radius * 0.125; }
function chartGradient(chart, payload, point) { const e = Math.max(chart.grid.spacing[0], chart.grid.spacing[1], chart.grid.spacing[2]) * 0.65; return normalize3([sampleChartGrid(chart,payload,[point[0]+e,point[1],point[2]])-sampleChartGrid(chart,payload,[point[0]-e,point[1],point[2]]),sampleChartGrid(chart,payload,[point[0],point[1]+e,point[2]])-sampleChartGrid(chart,payload,[point[0],point[1]-e,point[2]]),sampleChartGrid(chart,payload,[point[0],point[1],point[2]+e])-sampleChartGrid(chart,payload,[point[0],point[1],point[2]-e])]); }
function trilinearInt16(values,d,nx,ny,nz){const x=nx*(d[0]-1),y=ny*(d[1]-1),z=nz*(d[2]-1),x0=Math.floor(x),y0=Math.floor(y),z0=Math.floor(z),x1=Math.min(x0+1,d[0]-1),y1=Math.min(y0+1,d[1]-1),z1=Math.min(z0+1,d[2]-1),tx=x-x0,ty=y-y0,tz=z-z0;const s=(ix,iy,iz)=>values[ix+d[0]*(iy+d[1]*iz)];const a=mix(s(x0,y0,z0),s(x1,y0,z0),tx),b=mix(s(x0,y1,z0),s(x1,y1,z0),tx),c=mix(s(x0,y0,z1),s(x1,y0,z1),tx),e=mix(s(x0,y1,z1),s(x1,y1,z1),tx);return mix(mix(a,b,ty),mix(c,e,ty),tz);}
function frameMatrix(center,axes){return[axes[0][0],axes[0][1],axes[0][2],0,axes[1][0],axes[1][1],axes[1][2],0,axes[2][0],axes[2][1],axes[2][2],0,center[0],center[1],center[2],1];}
function identityMatrix(){return[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];}
function translationMatrix(t){return[1,0,0,0,0,1,0,0,0,0,1,0,t[0],t[1],t[2],1];}
function quaternionMatrix(q){const[x,y,z,w]=normalizeQuaternion(q),x2=x+x,y2=y+y,z2=z+z,xx=x*x2,xy=x*y2,xz=x*z2,yy=y*y2,yz=y*z2,zz=z*z2,wx=w*x2,wy=w*y2,wz=w*z2;return[1-(yy+zz),xy+wz,xz-wy,0,xy-wz,1-(xx+zz),yz+wx,0,xz+wy,yz-wx,1-(xx+yy),0,0,0,0,1];}
function normalizeQuaternion(q){const length=Math.hypot(...q)||1;return q.map((value)=>value/length);}
function multiplyMatrix(a,b){const out=new Array(16).fill(0);for(let column=0;column<4;column+=1)for(let row=0;row<4;row+=1)for(let k=0;k<4;k+=1)out[column*4+row]+=a[k*4+row]*b[column*4+k];return out;}
function invertRigidMatrix(m){const out=[m[0],m[4],m[8],0,m[1],m[5],m[9],0,m[2],m[6],m[10],0,0,0,0,1],t=[m[12],m[13],m[14]],it=transformDirection(out,scale3(t,-1));out[12]=it[0];out[13]=it[1];out[14]=it[2];return out;}
function determinantRigid3(m){return m[0]*(m[5]*m[10]-m[6]*m[9])-m[4]*(m[1]*m[10]-m[2]*m[9])+m[8]*(m[1]*m[6]-m[2]*m[5]);}
function transformPoint(m,p){return[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];}
function transformDirection(m,p){return[m[0]*p[0]+m[4]*p[1]+m[8]*p[2],m[1]*p[0]+m[5]*p[1]+m[9]*p[2],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]];}
function cross3(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function dot3(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
function add3(a,b){return[a[0]+b[0],a[1]+b[1],a[2]+b[2]];}
function subtract3(a,b){return[a[0]-b[0],a[1]-b[1],a[2]-b[2]];}
function scale3(a,s){return[a[0]*s,a[1]*s,a[2]*s];}
function normalize3(a){const length=Math.hypot(...a)||1;return a.map((value)=>value/length);}
function mix(a,b,t){return a+(b-a)*t;}
