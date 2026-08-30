export const LONG_BONE_GENERATOR_V1_ID = 'LongBoneGeneratorV1@1.2.0';

export const FEMUR_LOD_SPECS_V1 = Object.freeze({
  0: Object.freeze({ longitudinalSegments: 128, radialSegments: 64 }),
  1: Object.freeze({ longitudinalSegments: 64, radialSegments: 32 }),
  2: Object.freeze({ longitudinalSegments: 64, radialSegments: 24 }),
});

const REQUIRED_PARAMETERS = Object.freeze([
  'femurLength', 'shaftCenterlineKnots', 'shaftAnteriorBow', 'shaftMedialLateralBow',
  'shaftCrossSectionMajor', 'shaftCrossSectionMinor', 'headRadius', 'neckLength',
  'neckShaftAngle', 'femoralAnteversion', 'greaterTrochanterSize', 'lesserTrochanterSize',
  'distalCondyleWidth', 'distalCondyleDepth', 'intercondylarNotchWidth',
  'corticalThickness', 'surfaceDetail', 'leftRightAsymmetry',
  'headEllipsoidRatio', 'headFoveaDepth', 'headFoveaRadius',
  'neckCrossSectionMajor', 'neckCrossSectionMinor', 'neckSuperiorEdge', 'neckInferiorEdge', 'neckAnteriorEdge', 'neckPosteriorEdge',
  'greaterTrochanterTipHeight', 'greaterTrochanterAnteriorCrest', 'greaterTrochanterPosteriorCrest', 'trochantericFossaDepth',
  'intertrochantericLineHeight', 'intertrochantericCrestHeight',
  'shaftCrossSectionStations', 'shaftPosteriorRidge', 'lineaAsperaHeight', 'lineaAsperaWidth', 'proximalMetaphysisBlend', 'distalMetaphysisBlend',
  'medialCondyleScale', 'lateralCondyleScale', 'medialCondylePosteriorLength', 'lateralCondylePosteriorLength',
  'medialCondyleDistalOffset', 'lateralCondyleDistalOffset', 'medialEpicondyleSize', 'lateralEpicondyleSize', 'adductorTubercleSize',
  'intercondylarFossaWidth', 'intercondylarFossaDepth', 'patellarSurfaceDepth', 'medialTrochlearRidgeHeight', 'lateralTrochlearRidgeHeight', 'patellarGrooveDepth',
]);

/**
 * Generates one closed femur component from parameters. Left and right are
 * evaluated independently; no vertex mirroring, transform scale, or negative
 * scale is used. The returned arrays are already normalized to Float32/Uint32.
 */
export function generateFemurV1(parameters, { side, lod = 0, hipJointCenter = [0, 0, 0] } = {}) {
  validateParameters(parameters, side, lod, hipJointCenter);
  const spec = FEMUR_LOD_SPECS_V1[lod];
  const longitudinalSegments = spec.longitudinalSegments;
  const radialSegments = spec.radialSegments;
  const positions = [];
  const indices = [];
  const ringStarts = [];

  positions.push(...centerlinePoint(parameters, side, 0, hipJointCenter));
  for (let ring = 1; ring < longitudinalSegments; ring += 1) {
    const t = ring / longitudinalSegments;
    ringStarts.push(positions.length / 3);
    const center = centerlinePoint(parameters, side, t, hipJointCenter);
    const frame = crossSectionAt(parameters, side, t);
    for (let radial = 0; radial < radialSegments; radial += 1) {
      const theta = radial / radialSegments * Math.PI * 2;
      const point = crossSectionPoint(parameters, side, t, theta, center, frame);
      positions.push(...point);
    }
  }
  const topPole = positions.length / 3;
  positions.push(...centerlinePoint(parameters, side, 1, hipJointCenter));

  const firstRing = ringStarts[0];
  for (let radial = 0; radial < radialSegments; radial += 1) {
    const next = (radial + 1) % radialSegments;
    indices.push(0, firstRing + radial, firstRing + next);
  }
  for (let ring = 0; ring < ringStarts.length - 1; ring += 1) {
    const lower = ringStarts[ring];
    const upper = ringStarts[ring + 1];
    for (let radial = 0; radial < radialSegments; radial += 1) {
      const next = (radial + 1) % radialSegments;
      indices.push(lower + radial, upper + radial, upper + next);
      indices.push(lower + radial, upper + next, lower + next);
    }
  }
  const lastRing = ringStarts.at(-1);
  for (let radial = 0; radial < radialSegments; radial += 1) {
    const next = (radial + 1) % radialSegments;
    indices.push(lastRing + radial, topPole, lastRing + next);
  }

  const floatPositions = Float32Array.from(positions, Math.fround);
  const uintIndices = Uint32Array.from(indices);
  const normals = computeVertexNormals(floatPositions, uintIndices);
  return Object.freeze({
    generatorId: LONG_BONE_GENERATOR_V1_ID,
    boneId: `${side}_femur`,
    side,
    lod,
    positions: floatPositions,
    normals,
    indices: uintIndices,
    vertexCount: floatPositions.length / 3,
    triangleCount: uintIndices.length / 3,
    closedComponentExpected: true,
    negativeScaleUsed: false,
    runtimeBoneScaleUsed: false,
    parameterSnapshot: structuredClone(parameters),
  });
}

export function getFemurLandmarksV1(parameters, { side, hipJointCenter = [0, 0, 0] } = {}) {
  validateParameters(parameters, side, 0, hipJointCenter);
  const frame = getFemurMeasurementFrameV1(parameters, { side, hipJointCenter });
  const samples = {
    head_center: frame.headCenter,
    neck_center: frame.neckCenter,
    greater_trochanter: frame.greaterTrochanter,
    lesser_trochanter: frame.lesserTrochanter,
    medial_condyle: frame.medialCondyle,
    lateral_condyle: frame.lateralCondyle,
    intercondylar_notch: frame.intercondylarNotch,
    greater_trochanter_tip: frame.greaterTrochanterTip,
    trochanteric_fossa: frame.trochantericFossa,
    linea_aspera: frame.lineaAspera,
    medial_epicondyle: frame.medialEpicondyle,
    lateral_epicondyle: frame.lateralEpicondyle,
    adductor_tubercle: frame.adductorTubercle,
    intercondylar_fossa: frame.intercondylarFossa,
    patellar_surface: frame.patellarSurface,
    medial_trochlear_ridge: frame.medialTrochlearRidge,
    lateral_trochlear_ridge: frame.lateralTrochlearRidge,
    patellar_groove: frame.patellarGroove,
  };
  return Object.fromEntries(Object.entries(samples).map(([id, position]) => [`${side}_femur_${id}`, position.map(Math.fround)]));
}

export function getFemurLandmarkRecordsV1(parameters, options = {}) {
  const positions = getFemurLandmarksV1(parameters, options);
  const classification = (id) => {
    if (id.endsWith('_head_center')) return 'joint_center_candidate';
    if (id.endsWith('_neck_center')) return 'axis_candidate';
    if (id.endsWith('_intercondylar_notch')) return 'derived_internal_point';
    if (/_greater_trochanter_tip|_linea_aspera|_medial_condyle|_lateral_condyle|_intercondylar_fossa|_patellar_groove$/.test(id)) return 'lod_review_landmark';
    return 'surface_anatomical_landmark';
  };
  return Object.entries(positions).map(([id, position]) => ({ id, position, classification: classification(id) }));
}

export function getFemurMeasurementFrameV1(parameters, { side, hipJointCenter = [0, 0, 0] } = {}) {
  validateParameters(parameters, side, 0, hipJointCenter);
  const anatomy = anatomyFrame(parameters, side, hipJointCenter);
  const medial = [anatomy.medial, 0, 0];
  const lateral = [-anatomy.medial, 0, 0];
  const posterior = [0, 0, -1];
  const anterior = [0, 0, 1];
  const surface = (t, direction) => surfacePointInDirection(parameters, side, t, hipJointCenter, direction);
  return Object.freeze({
    headCenter: hipJointCenter.map(Math.fround),
    headRadius: Math.fround(parameters.headRadius),
    neckBase: anatomy.neckBase.map(Math.fround),
    neckCenter: mix3(anatomy.neckBase, anatomy.headAttach, 0.5).map(Math.fround),
    neckAxis: anatomy.neckAxis.map(Math.fround),
    shaftAxisToDistal: normalize3(subtract3(centerlinePoint(parameters, side, 0.24, hipJointCenter), centerlinePoint(parameters, side, 0.68, hipJointCenter))).map(Math.fround),
    greaterTrochanter: surface(0.75, lateral),
    greaterTrochanterTip: surface(0.78125, lateral),
    lesserTrochanter: surface(0.71875, normalize3(add3(scale3(medial, 0.68), scale3(posterior, 0.74)))),
    trochantericFossa: surface(0.75, normalize3(add3(scale3(lateral, 0.35), scale3(posterior, 0.94)))),
    lineaAspera: surface(0.46875, posterior),
    medialCondyle: surface(0.0625, medial),
    lateralCondyle: surface(0.0625, lateral),
    intercondylarNotch: surface(0.0625, posterior),
    medialEpicondyle: surface(0.125, medial),
    lateralEpicondyle: surface(0.125, lateral),
    adductorTubercle: surface(0.15625, normalize3(add3(scale3(medial, 0.86), scale3(posterior, 0.5)))),
    intercondylarFossa: surface(0.0625, posterior),
    patellarGroove: surface(0.09375, anterior),
    patellarSurface: surface(0.09375, anterior),
    medialTrochlearRidge: surface(0.09375, normalize3(add3(scale3(medial, 0.382683), scale3(anterior, 0.92388)))),
    lateralTrochlearRidge: surface(0.09375, normalize3(add3(scale3(lateral, 0.382683), scale3(anterior, 0.92388)))),
    posteriorCondyleMedial: surface(0.0625, normalize3(add3(scale3(medial, 0.608761), scale3(posterior, 0.793353)))),
    posteriorCondyleLateral: surface(0.0625, normalize3(add3(scale3(lateral, 0.608761), scale3(posterior, 0.793353)))),
    anteriorCondyleMedial: surface(0.09375, normalize3(add3(scale3(medial, 0.382683), scale3(anterior, 0.92388)))),
    anteriorCondyleLateral: surface(0.09375, normalize3(add3(scale3(lateral, 0.382683), scale3(anterior, 0.92388)))),
  });
}

function centerlinePoint(parameters, side, t, origin) {
  const anatomy = anatomyFrame(parameters, side, origin);
  if (t >= 0.9) {
    const alpha = (t - 0.9) / 0.1;
    const q = lerp(-0.86 * parameters.headRadius, parameters.headRadius, alpha);
    return add3(origin, scale3(anatomy.neckAxis, q)).map(Math.fround);
  }
  if (t >= 0.84) {
    return mix3(anatomy.neckBase, anatomy.headAttach, smoothstep(0.84, 0.9, t)).map(Math.fround);
  }
  const shaftStart = shaftCenter(parameters, side, 0.08, origin);
  const shaftEnd = shaftCenter(parameters, side, 0.82, origin);
  if (t < 0.17) return mix3(distalPole(parameters, origin), shaftStart, smoothstep(0, 0.17, t)).map(Math.fround);
  if (t < 0.7) return shaftCenter(parameters, side, lerp(0.08, 0.82, (t - 0.17) / 0.53), origin).map(Math.fround);
  return mix3(shaftEnd, anatomy.neckBase, smoothstep(0.7, 0.84, t)).map(Math.fround);
}

function crossSectionAt(parameters, side, t) {
  let rx;
  let rz;
  const distalEnd = parameters.distalMetaphysisBlend;
  const proximalStart = 1 - parameters.proximalMetaphysisBlend;
  if (t < distalEnd) {
    [rx, rz] = samplePairKeyframes([
      [0, 0, 0],
      [0.18, parameters.distalCondyleWidth * 0.34, parameters.distalCondyleDepth * 0.34],
      [0.45, parameters.distalCondyleWidth * 0.49, parameters.distalCondyleDepth * 0.48],
      [0.7, parameters.distalCondyleWidth * 0.46, parameters.distalCondyleDepth * 0.44],
      [1, parameters.shaftCrossSectionMajor * 1.42, parameters.shaftCrossSectionMinor * 1.38],
    ], t / distalEnd);
  } else if (t < proximalStart) {
    const station = sampleShaftStation(parameters.shaftCrossSectionStations, t);
    rx = station.medialLateralRadius;
    rz = station.anteriorPosteriorRadius;
  } else if (t < 0.9) {
    const attachRadius = parameters.headRadius * Math.sqrt(1 - 0.86 ** 2);
    const shaftStation = sampleShaftStation(parameters.shaftCrossSectionStations, proximalStart);
    [rx, rz] = samplePairKeyframes([
      [0, shaftStation.medialLateralRadius, shaftStation.anteriorPosteriorRadius],
      [.38, shaftStation.medialLateralRadius * 1.04, shaftStation.anteriorPosteriorRadius * 1.03],
      [.72, parameters.neckCrossSectionMajor, parameters.neckCrossSectionMinor],
      [1, attachRadius * parameters.headEllipsoidRatio, attachRadius / parameters.headEllipsoidRatio],
    ], (t - proximalStart) / (0.9 - proximalStart));
  } else {
    const q = lerp(-0.86 * parameters.headRadius, parameters.headRadius, (t - 0.9) / 0.1);
    const sphericalRadius = Math.sqrt(Math.max(0, parameters.headRadius ** 2 - q ** 2));
    rx = sphericalRadius * parameters.headEllipsoidRatio;
    rz = sphericalRadius / parameters.headEllipsoidRatio;
  }
  return { rx: Math.max(parameters.femurLength * 1e-6, rx), rz: Math.max(parameters.femurLength * 1e-6, rz) };
}

function crossSectionPoint(parameters, side, t, theta, center, frame) {
  const tangent = sectionTangent(parameters, side, t);
  const basisX = perpendicularReference(tangent);
  const basisZ = normalize3(cross3(basisX, tangent));
  let radialOffset = 0;
  let axialOffset = 0;
  const medial = side === 'left' ? 1 : -1;
  const medialDirection = [medial, 0, 0];
  const lateralDirection = [-medial, 0, 0];
  const posterior = [0, 0, -1];
  const anterior = [0, 0, 1];
  const medialTheta = directionTheta(basisX, basisZ, tangent, medialDirection);
  const lateralTheta = directionTheta(basisX, basisZ, tangent, lateralDirection);
  const posteriorTheta = directionTheta(basisX, basisZ, tangent, posterior);
  const anteriorTheta = directionTheta(basisX, basisZ, tangent, anterior);
  if (t < parameters.distalMetaphysisBlend) {
    const normalizedT = t / parameters.distalMetaphysisBlend;
    const articularWeight = Math.sin(Math.PI * Math.min(1, normalizedT / 0.92)) ** 1.35;
    const medialPosteriorTheta = directionTheta(basisX, basisZ, tangent, normalize3(add3(scale3(medialDirection, .608761), scale3(posterior, .793353))));
    const lateralPosteriorTheta = directionTheta(basisX, basisZ, tangent, normalize3(add3(scale3(lateralDirection, .608761), scale3(posterior, .793353))));
    const medialAnteriorTheta = directionTheta(basisX, basisZ, tangent, normalize3(add3(scale3(medialDirection, .382683), scale3(anterior, .92388))));
    const lateralAnteriorTheta = directionTheta(basisX, basisZ, tangent, normalize3(add3(scale3(lateralDirection, .382683), scale3(anterior, .92388))));
    radialOffset += articularWeight * parameters.distalCondyleWidth * .07 * (
      parameters.medialCondyleScale * gaussianAngle(theta, medialTheta, .55)
      + parameters.lateralCondyleScale * gaussianAngle(theta, lateralTheta, .55)
    );
    radialOffset += articularWeight * (
      parameters.medialCondylePosteriorLength * gaussianAngle(theta, medialPosteriorTheta, .34)
      + parameters.lateralCondylePosteriorLength * gaussianAngle(theta, lateralPosteriorTheta, .34)
    );
    const fossaAngularWidth = Math.max(.24, parameters.intercondylarFossaWidth / parameters.distalCondyleWidth * 1.5);
    const fossaBasin = broadAngularBasin(theta, posteriorTheta, fossaAngularWidth);
    radialOffset -= articularWeight * parameters.intercondylarFossaDepth * fossaBasin;
    radialOffset += articularWeight * parameters.medialTrochlearRidgeHeight * gaussianAngle(theta, medialAnteriorTheta, .26);
    radialOffset += articularWeight * parameters.lateralTrochlearRidgeHeight * gaussianAngle(theta, lateralAnteriorTheta, .26);
    radialOffset -= articularWeight * parameters.patellarGrooveDepth * gaussianAngle(theta, anteriorTheta, .27);
    radialOffset += articularWeight * parameters.patellarSurfaceDepth * gaussianAngle(theta, anteriorTheta, .72);
    radialOffset += gaussian(t, parameters.distalMetaphysisBlend * .72, .018) * (
      parameters.medialEpicondyleSize * gaussianAngle(theta, medialTheta, .25)
      + parameters.lateralEpicondyleSize * gaussianAngle(theta, lateralTheta, .25)
    );
    const adductorTheta = directionTheta(basisX, basisZ, tangent, normalize3(add3(scale3(medialDirection, .86), scale3(posterior, .5))));
    radialOffset += gaussian(t, parameters.distalMetaphysisBlend * .86, .013) * parameters.adductorTubercleSize * gaussianAngle(theta, adductorTheta, .2);
    const fossaOpeningWeight = 1 - smoothstep(.025, parameters.distalMetaphysisBlend * .72, t);
    axialOffset += parameters.intercondylarFossaDepth * 1.15 * fossaBasin * fossaOpeningWeight;
    axialOffset += parameters.medialCondyleDistalOffset * gaussianAngle(theta, medialTheta, .48) * (1 - smoothstep(.02, .1, t));
    axialOffset += parameters.lateralCondyleDistalOffset * gaussianAngle(theta, lateralTheta, .48) * (1 - smoothstep(.02, .1, t));
  }
  if (t >= parameters.distalMetaphysisBlend && t < 1 - parameters.proximalMetaphysisBlend) {
    const station = sampleShaftStation(parameters.shaftCrossSectionStations, t);
    radialOffset += Math.min(frame.rx, frame.rz) * station.triangularity * Math.cos(3 * (theta - posteriorTheta));
    const ridgeWeight = gaussian(t, .46875, .19);
    radialOffset += ridgeWeight * parameters.shaftPosteriorRidge * gaussianAngle(theta, posteriorTheta, parameters.lineaAsperaWidth * 1.8);
    radialOffset += ridgeWeight * parameters.lineaAsperaHeight * (
      gaussianAngle(theta, posteriorTheta - parameters.lineaAsperaWidth, parameters.lineaAsperaWidth * .58)
      + gaussianAngle(theta, posteriorTheta + parameters.lineaAsperaWidth, parameters.lineaAsperaWidth * .58)
    );
  }
  if (t >= 0.64 && t < 0.9) {
    const lateralTheta = directionTheta(basisX, basisZ, tangent, [-medial, 0, 0]);
    const lesserTheta = directionTheta(basisX, basisZ, tangent, normalize3([medial * 0.68, 0, -0.74]));
    const greaterAnteriorTheta = directionTheta(basisX, basisZ, tangent, normalize3([-medial * .72, 0, .69]));
    const greaterPosteriorTheta = directionTheta(basisX, basisZ, tangent, normalize3([-medial * .72, 0, -.69]));
    radialOffset += gaussian(t, 0.75, 0.035) * parameters.greaterTrochanterSize * 0.90 * gaussianAngle(theta, lateralTheta, 0.38);
    radialOffset += gaussian(t, .78125, .025) * parameters.greaterTrochanterTipHeight * gaussianAngle(theta, lateralTheta, .28);
    radialOffset += gaussian(t, .75, .04) * parameters.greaterTrochanterAnteriorCrest * gaussianAngle(theta, greaterAnteriorTheta, .25);
    radialOffset += gaussian(t, .75, .04) * parameters.greaterTrochanterPosteriorCrest * gaussianAngle(theta, greaterPosteriorTheta, .25);
    const fossaTheta = directionTheta(basisX, basisZ, tangent, normalize3([-medial * .35, 0, -.94]));
    radialOffset -= gaussian(t, .75, .032) * parameters.trochantericFossaDepth * gaussianAngle(theta, fossaTheta, .27);
    radialOffset += gaussian(t, 0.71875, 0.028) * parameters.lesserTrochanterSize * 0.88 * gaussianAngle(theta, lesserTheta, 0.34);
    radialOffset += gaussian(t, .69, .05) * parameters.intertrochantericLineHeight * gaussianAngle(theta, anteriorTheta, .38);
    radialOffset += gaussian(t, .7, .05) * parameters.intertrochantericCrestHeight * gaussianAngle(theta, posteriorTheta, .35);
  }
  if (t >= 0.84 && t < .91) {
    const superiorTheta = directionTheta(basisX, basisZ, tangent, [0, 1, 0]);
    const inferiorTheta = directionTheta(basisX, basisZ, tangent, [0, -1, 0]);
    radialOffset += gaussian(t, .865, .035) * (
      parameters.neckSuperiorEdge * gaussianAngle(theta, superiorTheta, .42)
      + parameters.neckInferiorEdge * gaussianAngle(theta, inferiorTheta, .42)
      + parameters.neckAnteriorEdge * gaussianAngle(theta, anteriorTheta, .42)
      + parameters.neckPosteriorEdge * gaussianAngle(theta, posteriorTheta, .42)
    );
  }
  if (t >= .91) {
    const foveaDirection = normalize3(add3(scale3(posterior, .78), scale3([0, -1, 0], .62)));
    const foveaTheta = directionTheta(basisX, basisZ, tangent, foveaDirection);
    radialOffset -= parameters.headFoveaDepth * gaussian(t, .968, .017) * gaussianAngle(theta, foveaTheta, parameters.headFoveaRadius / parameters.headRadius * .7);
  }
  const radiusX = Math.max(parameters.femurLength * 1e-6, frame.rx + radialOffset);
  const radiusZ = Math.max(parameters.femurLength * 1e-6, frame.rz + radialOffset);
  return add3(add3(center, scale3(tangent, axialOffset)), add3(scale3(basisX, radiusX * Math.cos(theta)), scale3(basisZ, radiusZ * Math.sin(theta)))).map(Math.fround);
}

function surfacePointInDirection(parameters, side, t, origin, direction) {
  const center = centerlinePoint(parameters, side, t, origin);
  const frame = crossSectionAt(parameters, side, t);
  const tangent = sectionTangent(parameters, side, t);
  const basisX = perpendicularReference(tangent);
  const basisZ = normalize3(cross3(basisX, tangent));
  return crossSectionPoint(parameters, side, t, directionTheta(basisX, basisZ, tangent, direction), center, frame);
}

function anatomyFrame(parameters, side, origin) {
  const medial = side === 'left' ? 1 : -1;
  const inclination = (180 - parameters.neckShaftAngle) * Math.PI / 180;
  const anteversion = parameters.femoralAnteversion * Math.PI / 180;
  const neckAxis = normalize3([
    medial * Math.sin(inclination) * Math.cos(anteversion),
    Math.cos(inclination),
    Math.sin(inclination) * Math.sin(anteversion),
  ]);
  return {
    medial,
    neckAxis,
    neckBase: subtract3(origin, scale3(neckAxis, parameters.neckLength)),
    headAttach: add3(origin, scale3(neckAxis, -0.86 * parameters.headRadius)),
  };
}

function shaftCenter(parameters, side, t, origin) {
  const medial = side === 'left' ? 1 : -1;
  const knot = sampleCenterlineKnots(parameters.shaftCenterlineKnots, t);
  const asymmetry = side === 'left' ? parameters.leftRightAsymmetry : -parameters.leftRightAsymmetry;
  return [
    origin[0] + medial * (parameters.shaftMedialLateralBow * Math.sin(Math.PI * t) + knot.medialLateralOffset + asymmetry * parameters.femurLength * 0.0025 * Math.sin(Math.PI * t)),
    origin[1] - parameters.femurLength * (1 - t),
    origin[2] + parameters.shaftAnteriorBow * Math.sin(Math.PI * t) + knot.anteriorOffset,
  ];
}

function distalPole(parameters, origin) {
  return [origin[0], origin[1] - parameters.femurLength - parameters.distalCondyleDepth * 0.30, origin[2]];
}

function directionTheta(basisX, basisZ, tangent, direction) {
  const projected = subtract3(direction, scale3(tangent, dot3(direction, tangent)));
  const normalized = normalize3(projected);
  return Math.atan2(dot3(normalized, basisZ), dot3(normalized, basisX));
}

function perpendicularReference(tangent) {
  const reference = Math.abs(tangent[0]) < 0.92 ? [1, 0, 0] : [0, 0, 1];
  return normalize3(subtract3(reference, scale3(tangent, dot3(reference, tangent))));
}

function sectionTangent(parameters, side, t) {
  if (t <= 0.8) return [0, 1, 0];
  const neckAxis = anatomyFrame(parameters, side, [0, 0, 0]).neckAxis;
  if (t >= 0.9) return neckAxis;
  return normalize3(mix3([0, 1, 0], neckAxis, smoothstep(0.8, 0.9, t)));
}

function computeVertexNormals(positions, indices) {
  const normals = new Float64Array(positions.length);
  for (let index = 0; index < indices.length; index += 3) {
    const ia = indices[index] * 3;
    const ib = indices[index + 1] * 3;
    const ic = indices[index + 2] * 3;
    const ab = [positions[ib] - positions[ia], positions[ib + 1] - positions[ia + 1], positions[ib + 2] - positions[ia + 2]];
    const ac = [positions[ic] - positions[ia], positions[ic + 1] - positions[ia + 1], positions[ic + 2] - positions[ia + 2]];
    const cross = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    for (const vertex of [ia, ib, ic]) for (let component = 0; component < 3; component += 1) normals[vertex + component] += cross[component];
  }
  const output = new Float32Array(normals.length);
  for (let index = 0; index < normals.length; index += 3) {
    const length = Math.hypot(normals[index], normals[index + 1], normals[index + 2]);
    if (!(length > 1e-16)) throw new Error(`LongBoneGeneratorV1 produced an undefined normal at vertex ${index / 3}.`);
    output[index] = Math.fround(normals[index] / length);
    output[index + 1] = Math.fround(normals[index + 1] / length);
    output[index + 2] = Math.fround(normals[index + 2] / length);
  }
  return output;
}

function sampleCenterlineKnots(knots, t) {
  const normalized = knots.map((knot) => ({ t: Number(knot.t), anteriorOffset: Number(knot.anteriorOffset), medialLateralOffset: Number(knot.medialLateralOffset) })).sort((a, b) => a.t - b.t);
  if (t <= normalized[0].t) return normalized[0];
  if (t >= normalized.at(-1).t) return normalized.at(-1);
  const upperIndex = normalized.findIndex((knot) => knot.t >= t);
  const lower = normalized[upperIndex - 1];
  const upper = normalized[upperIndex];
  const alpha = (t - lower.t) / (upper.t - lower.t);
  return { anteriorOffset: lerp(lower.anteriorOffset, upper.anteriorOffset, alpha), medialLateralOffset: lerp(lower.medialLateralOffset, upper.medialLateralOffset, alpha) };
}

function samplePairKeyframes(keyframes, t) {
  const upperIndex = keyframes.findIndex(([key]) => key >= t);
  if (upperIndex <= 0) return keyframes[0].slice(1);
  const lower = keyframes[upperIndex - 1];
  const upper = keyframes[upperIndex];
  const alpha = smoothstep(lower[0], upper[0], t);
  return [lerp(lower[1], upper[1], alpha), lerp(lower[2], upper[2], alpha)];
}

function sampleShaftStation(stations, t) {
  const normalized = stations.map((station) => ({
    t: Number(station.t), medialLateralRadius: Number(station.medialLateralRadius), anteriorPosteriorRadius: Number(station.anteriorPosteriorRadius), triangularity: Number(station.triangularity),
  })).sort((a, b) => a.t - b.t);
  if (t <= normalized[0].t) return normalized[0];
  if (t >= normalized.at(-1).t) return normalized.at(-1);
  const upperIndex = normalized.findIndex((station) => station.t >= t);
  const lower = normalized[upperIndex - 1];
  const upper = normalized[upperIndex];
  const alpha = smoothstep(lower.t, upper.t, t);
  return {
    t, medialLateralRadius: lerp(lower.medialLateralRadius, upper.medialLateralRadius, alpha),
    anteriorPosteriorRadius: lerp(lower.anteriorPosteriorRadius, upper.anteriorPosteriorRadius, alpha),
    triangularity: lerp(lower.triangularity, upper.triangularity, alpha),
  };
}

function validateParameters(parameters, side, lod, origin) {
  if (!parameters || typeof parameters !== 'object') throw new Error('LongBoneGeneratorV1 requires parameters.');
  for (const key of REQUIRED_PARAMETERS) if (!(key in parameters)) throw new Error(`LongBoneGeneratorV1 is missing ${key}.`);
  for (const key of REQUIRED_PARAMETERS.filter((key) => !['shaftCenterlineKnots', 'shaftCrossSectionStations'].includes(key))) if (!Number.isFinite(Number(parameters[key]))) throw new Error(`${key} must be finite.`);
  if (!Array.isArray(parameters.shaftCenterlineKnots) || parameters.shaftCenterlineKnots.length < 2) throw new Error('shaftCenterlineKnots requires at least two records.');
  if (!Array.isArray(parameters.shaftCrossSectionStations) || parameters.shaftCrossSectionStations.length < 4) throw new Error('shaftCrossSectionStations requires at least four records.');
  if (!['left', 'right'].includes(side)) throw new Error('Femur side must be left or right.');
  if (!(lod in FEMUR_LOD_SPECS_V1)) throw new Error(`Unsupported femur LOD ${lod}.`);
  if (!Array.isArray(origin) || origin.length !== 3 || origin.some((value) => !Number.isFinite(Number(value)))) throw new Error('hipJointCenter must contain three finite values.');
  for (const key of ['femurLength', 'shaftCrossSectionMajor', 'shaftCrossSectionMinor', 'headRadius', 'neckLength', 'greaterTrochanterSize', 'lesserTrochanterSize', 'distalCondyleWidth', 'distalCondyleDepth', 'intercondylarNotchWidth', 'corticalThickness']) {
    if (!(parameters[key] > 0)) throw new Error(`${key} must be positive.`);
  }
}

function smoothstep(minimum, maximum, value) { const t = Math.min(1, Math.max(0, (value - minimum) / (maximum - minimum))); return t * t * (3 - 2 * t); }
function gaussian(value, center, width) { const x = (value - center) / width; return Math.exp(-0.5 * x * x); }
function gaussianAngle(value, center, width) { const delta = Math.atan2(Math.sin(value - center), Math.cos(value - center)); return Math.exp(-0.5 * (delta / width) ** 2); }
function broadAngularBasin(value, center, halfWidth) {
  const delta = Math.abs(Math.atan2(Math.sin(value - center), Math.cos(value - center)));
  const normalized = Math.min(1, delta / Math.max(1e-6, halfWidth));
  return (1 - normalized ** 4) ** 2;
}
function lerp(left, right, alpha) { return left + (right - left) * alpha; }
function mix3(left, right, alpha) { return left.map((value, index) => lerp(value, right[index], alpha)); }
function add3(left, right) { return left.map((value, index) => value + right[index]); }
function subtract3(left, right) { return left.map((value, index) => value - right[index]); }
function scale3(value, amount) { return value.map((component) => component * amount); }
function dot3(left, right) { return left.reduce((total, value, index) => total + value * right[index], 0); }
function cross3(left, right) { return [left[1] * right[2] - left[2] * right[1], left[2] * right[0] - left[0] * right[2], left[0] * right[1] - left[1] * right[0]]; }
function normalize3(value) { const magnitude = Math.hypot(...value); if (!(magnitude > 1e-12)) throw new Error('Cannot normalize a zero-length femur vector.'); return value.map((component) => component / magnitude); }
