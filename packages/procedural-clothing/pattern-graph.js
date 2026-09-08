import { FIT_CONTRACT_SCHEMA } from './constants.js';
import {
  canonicalStringify,
  clamp,
  hashString32,
  hex32,
  lerp,
  smoothstep,
} from './math.js';
import { normalizeBodyProfile } from './body-profile.js';
import { validateGarmentDNA } from './garment-dna.js';

function ellipseCircumference(a, b) {
  const h = ((a - b) ** 2) / ((a + b) ** 2);
  return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
}

function solveEllipseSemiWidth(circumference, semiDepth) {
  let low = Math.max(0.02, semiDepth * 0.5);
  let high = Math.max(circumference / 2, semiDepth * 1.2);
  for (let iteration = 0; iteration < 48; iteration += 1) {
    const middle = (low + high) * 0.5;
    const current = ellipseCircumference(middle, semiDepth);
    if (current < circumference) low = middle;
    else high = middle;
  }
  return (low + high) * 0.5;
}

export function resolveCrewShirtFit(garmentDNA, bodyInput) {
  validateGarmentDNA(garmentDNA);
  const bodyProfile = normalizeBodyProfile(bodyInput);
  const m = bodyProfile.measurements;
  const p = garmentDNA.pattern;
  const ease = garmentDNA.ease;
  const clearance = ease.surfaceClearance;

  const targetChestCircumference = m.chestCircumference + ease.chest;
  const targetWaistCircumference = m.waistCircumference + ease.waist;
  const baseHemCircumference = Math.max(m.waistCircumference, m.hipCircumference * 0.92);
  const targetHemCircumference = baseHemCircumference + ease.hem;
  const targetUpperArmCircumference = m.upperArmCircumference + ease.upperArm;

  const chestSemiDepth = m.chestDepth * 0.5 + clearance;
  const waistSemiDepth = m.waistDepth * 0.5 + clearance;
  const hemSemiDepth = lerp(waistSemiDepth, chestSemiDepth, 0.32);
  const chestSemiWidth = solveEllipseSemiWidth(targetChestCircumference, chestSemiDepth);
  const waistSemiWidth = solveEllipseSemiWidth(targetWaistCircumference, waistSemiDepth);
  const hemSemiWidth = solveEllipseSemiWidth(targetHemCircumference, hemSemiDepth);

  const shoulderY = m.shoulderY;
  const underarmY = Math.min(m.underarmY, shoulderY - m.bodyHeight * 0.06);
  const requestedBodyLength = m.bodyHeight * p.bodyLengthRatio;
  const bodyLength = clamp(requestedBodyLength, m.torsoLength * 0.78, m.torsoLength * 1.45);
  const hemY = shoulderY - bodyLength;
  const waistY = clamp(m.waistY, hemY + bodyLength * 0.18, underarmY - bodyLength * 0.10);

  const targetShoulderWidth = Math.max(
    m.shoulderWidth + ease.chest * 0.20,
    chestSemiWidth * 1.72,
  );
  const shoulderSemiWidth = targetShoulderWidth * 0.5;
  const necklineWidth = clamp(
    Math.max(m.neckCircumference / Math.PI * 0.93, targetShoulderWidth * p.necklineWidthRatio),
    targetShoulderWidth * 0.18,
    targetShoulderWidth * 0.42,
  );
  const frontNeckDrop = m.bodyHeight * p.frontNeckDropRatio;
  const backNeckDrop = m.bodyHeight * p.backNeckDropRatio;
  const shoulderDrop = m.bodyHeight * p.shoulderDropRatio;
  const sleeveLength = clamp(m.bodyHeight * p.sleeveLengthRatio, m.armLength * 0.22, m.armLength * 0.72);
  const sleeveStartRadius = targetUpperArmCircumference / (Math.PI * 2);
  const sleeveEndRadius = sleeveStartRadius * 0.82;
  const neckInnerSemiWidth = necklineWidth * 0.5;
  const neckInnerSemiDepth = Math.max(m.neckCircumference / (Math.PI * 2) * 0.78, neckInnerSemiWidth * 0.64);

  const fitContract = {
    schema: FIT_CONTRACT_SCHEMA,
    garmentId: garmentDNA.garmentId,
    garmentRevision: garmentDNA.revision,
    garmentHash: garmentDNA.contentHash,
    subjectId: bodyProfile.subjectId,
    proportionRevision: bodyProfile.proportionRevision,
    bodyHash: bodyProfile.contentHash,
    units: 'meter',
    policy: {
      method: 'measurement_driven_regeneration',
      topologyStable: true,
      wholeGarmentScaleAllowed: false,
      bodyIsReadOnly: true,
      finalPoseAuthority: 'simulationRig',
    },
    resolved: {
      bodyHeight: m.bodyHeight,
      shoulderY,
      underarmY,
      waistY,
      hemY,
      bodyLength,
      targetShoulderWidth,
      shoulderSemiWidth,
      chestSemiWidth,
      chestSemiDepth,
      waistSemiWidth,
      waistSemiDepth,
      hemSemiWidth,
      hemSemiDepth,
      necklineWidth,
      neckInnerSemiWidth,
      neckInnerSemiDepth,
      frontNeckDrop,
      backNeckDrop,
      shoulderDrop,
      sleeveLength,
      sleeveStartRadius,
      sleeveEndRadius,
      sleevePitchRadians: p.sleevePitchRadians,
      surfaceClearance: clearance,
    },
  };
  const withoutHash = { ...fitContract };
  delete withoutHash.contentHash;
  fitContract.contentHash = `fnv1a32:${hex32(hashString32(canonicalStringify(withoutHash)))}`;
  return { bodyProfile, fitContract };
}

export function buildCrewShirtPatternGraph(garmentDNA, bodyInput) {
  const { bodyProfile, fitContract } = resolveCrewShirtFit(garmentDNA, bodyInput);
  const r = fitContract.resolved;
  const t = garmentDNA.topology;
  const graph = {
    schema: 'humanoid_rig/pattern_graph@1.0',
    graphId: `${garmentDNA.garmentId}:pattern`,
    garmentHash: garmentDNA.contentHash,
    fitHash: fitContract.contentHash,
    units: 'meter',
    panels: [
      {
        id: 'torso_front',
        generator: 'shirt.torso_panel.front@1',
        resolution: [Math.floor(t.torsoCircumferenceSegments / 2) + 1, t.torsoLengthSegments + 1],
        grainDirection: garmentDNA.construction.grainDirection,
        boundaryFunctions: ['hem', 'side_curve', 'front_neckline', 'shoulder_slope', 'armhole_curve'],
      },
      {
        id: 'torso_back',
        generator: 'shirt.torso_panel.back@1',
        resolution: [Math.floor(t.torsoCircumferenceSegments / 2) + 1, t.torsoLengthSegments + 1],
        grainDirection: garmentDNA.construction.grainDirection,
        boundaryFunctions: ['hem', 'side_curve', 'back_neckline', 'shoulder_slope', 'armhole_curve'],
      },
      {
        id: 'left_sleeve',
        generator: 'shirt.sleeve_tube.left@1',
        resolution: [t.sleeveCircumferenceSegments, t.sleeveLengthSegments + 1],
        grainDirection: [1, 0],
        boundaryFunctions: ['armscye', 'sleeve_hem'],
      },
      {
        id: 'right_sleeve',
        generator: 'shirt.sleeve_tube.right@1',
        resolution: [t.sleeveCircumferenceSegments, t.sleeveLengthSegments + 1],
        grainDirection: [1, 0],
        boundaryFunctions: ['armscye', 'sleeve_hem'],
      },
      {
        id: 'collar_band',
        generator: 'shirt.collar_band@1',
        resolution: [t.collarSegments, t.collarRadialSegments + 1],
        grainDirection: [1, 0],
        boundaryFunctions: ['neckline_inner', 'neckline_outer'],
      },
    ],
    seams: [
      { id: 'left_side', a: 'torso_front.left_side', b: 'torso_back.left_side', mode: 'paired_constraint' },
      { id: 'right_side', a: 'torso_front.right_side', b: 'torso_back.right_side', mode: 'paired_constraint' },
      { id: 'left_shoulder', a: 'torso_front.left_shoulder', b: 'torso_back.left_shoulder', mode: 'paired_constraint' },
      { id: 'right_shoulder', a: 'torso_front.right_shoulder', b: 'torso_back.right_shoulder', mode: 'paired_constraint' },
      { id: 'left_armscye', a: 'torso.armhole.left', b: 'left_sleeve.armscye', mode: 'proximity_constraint' },
      { id: 'right_armscye', a: 'torso.armhole.right', b: 'right_sleeve.armscye', mode: 'proximity_constraint' },
      { id: 'collar', a: 'torso.neckline', b: 'collar_band.outer', mode: 'proximity_constraint' },
    ],
    resolvedDimensions: r,
  };
  graph.contentHash = `fnv1a32:${hex32(hashString32(canonicalStringify(graph)))}`;
  return { bodyProfile, fitContract, patternGraph: graph };
}

export function sampleTorsoShape(fitContract, y) {
  const r = fitContract.resolved;
  if (y <= r.waistY) {
    const t = smoothstep(r.hemY, r.waistY, y);
    return {
      semiWidth: lerp(r.hemSemiWidth, r.waistSemiWidth, t),
      semiDepth: lerp(r.hemSemiDepth, r.waistSemiDepth, t),
    };
  }
  const t = smoothstep(r.waistY, r.underarmY, y);
  return {
    semiWidth: lerp(r.waistSemiWidth, r.chestSemiWidth, t),
    semiDepth: lerp(r.waistSemiDepth, r.chestSemiDepth, t),
  };
}
