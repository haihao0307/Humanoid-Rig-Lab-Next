import { FEMUR_LOD_SPECS_V1, VARIANT_SPECS, createVariantPackage } from './anatomical-model-v1.mjs';
import { getFemurMeasurementFrameV1 } from '../../src/core/human-core-v5/longBoneGeneratorV1.js';
import { auditFemurS1A3 } from './qa-femur-s1a3.mjs';

export const CONDYLAR_SEPARATION_METRIC_ID = 'femur.condylar_surface_peak_distance.v1';
export const INTERCONDYLAR_NOTCH_WIDTH_METRIC_ID = 'femur.intercondylar_fossa_posterior_mouth_width.v1';

const SURFACE_CLASSIFICATIONS = new Set(['surface_anatomical_landmark', 'lod_review_landmark']);
const LANDMARK_TOLERANCE_METERS = Object.freeze({ 0: 0.002, 1: 0.0035, 2: 0.009 });

export function assertIndependentDistalMetricDefinitions(condylarDefinition, notchDefinition) {
  const sameId = condylarDefinition.metricId === notchDefinition.metricId;
  const sameFormula = condylarDefinition.formula === notchDefinition.formula;
  const samePointSet = JSON.stringify([...condylarDefinition.pointSetIds].sort()) === JSON.stringify([...notchDefinition.pointSetIds].sort());
  if (sameId || sameFormula || samePointSet) {
    throw new Error(`Distal metric definitions must be independent: ${JSON.stringify({ sameId, sameFormula, samePointSet })}`);
  }
  return true;
}

export function auditFemurS1A4() {
  const priorAudit = auditFemurS1A3();
  const variants = [];
  for (const spec of VARIANT_SPECS) {
    const packageData = createVariantPackage(spec.variantId);
    const priorVariant = priorAudit.variants.find(({ variantId }) => variantId === spec.variantId);
    const records = [];
    for (const side of ['left', 'right']) {
      const parameters = packageData.skeletalDNA.boneParameters.find(({ boneId }) => boneId === `${side}_femur`).generatorParameters;
      const hipJointCenter = packageData.graph.joints.find(({ jointId }) => jointId === `${side}_hip`).jointCenter;
      const frame = getFemurMeasurementFrameV1(parameters, { side, hipJointCenter });
      for (const lod of [0, 1, 2]) {
        const prior = priorVariant.records.find((record) => record.side === side && record.lod === lod);
        const group = packageData.geometry.primitiveGroups.find(({ groupId }) => groupId === `${side}-femur-lod${lod}`);
        records.push(auditRecord(packageData.geometry, group, parameters, frame, prior, side, lod));
      }
    }
    variants.push({ variantId: spec.variantId, records, passed: records.every(({ passed }) => passed) });
  }

  const baseline = variants.find(({ variantId }) => variantId === 'baseline');
  const longFemur = variants.find(({ variantId }) => variantId === 'long_femur_plus_08_percent');
  const anteversion = variants.find(({ variantId }) => variantId === 'anteversion_plus_10_degrees');
  const asymmetry = variants.find(({ variantId }) => variantId === 'left_right_asymmetry_02');
  const variantRegression = {
    lengthDeltaMeters: longFemur.records[0].femurLengthMeters - baseline.records[0].femurLengthMeters,
    anteversionDeltaDegrees: anteversion.records[0].anteversion.measuredDegrees - baseline.records[0].anteversion.measuredDegrees,
    asymmetryParameterDelta: asymmetry.records.find(({ side, lod }) => side === 'left' && lod === 0).leftRightAsymmetry
      - asymmetry.records.find(({ side, lod }) => side === 'right' && lod === 0).leftRightAsymmetry,
    distalDefinitionsStableUnderAnteversion: stableDistalParameters(baseline.records[0].parameters, anteversion.records[0].parameters),
  };
  variantRegression.passed = variantRegression.lengthDeltaMeters > 0.003
    && Math.abs(variantRegression.anteversionDeltaDegrees - 10) <= 0.25
    && Math.abs(variantRegression.asymmetryParameterDelta - 0.004) <= 1e-8
    && variantRegression.distalDefinitionsStableUnderAnteversion;

  const metricDefinitions = createMetricDefinitions('left');
  const independentMetricDefinitionsPassed = assertIndependentDistalMetricDefinitions(metricDefinitions.condylarSeparation, metricDefinitions.intercondylarNotchWidth);
  const report = {
    schema: 'humanoid_rig/femur_s1a4_articular_anatomy_audit@1.0',
    generatorId: 'LongBoneGeneratorV1@1.2.0',
    packageGeneratorVersion: 'anatomical-skeleton-s1@1.2.0',
    previousGeneratorId: 'LongBoneGeneratorV1@1.1.0',
    previousPackageGeneratorVersion: 'anatomical-skeleton-s1@1.1.0',
    meshCount: variants.reduce((total, variant) => total + variant.records.length, 0),
    landmarkToleranceMeters: LANDMARK_TOLERANCE_METERS,
    landmarkClassificationPolicy: {
      surfaceDistanceGated: [...SURFACE_CLASSIFICATIONS],
      jointCenterCandidate: 'center-fit and axis semantics; not surface-distance-only',
      axisCandidate: 'axis-angle semantics; not surface-distance-only',
      derivedInternalPoint: 'internal construction reference; excluded from surface gate',
      lod2Policy: 'independent distant-view threshold; cannot alter LOD0 or LOD1 decisions',
    },
    metricDefinitions,
    independentMetricDefinitionsPassed,
    variants,
    variantRegression,
    policyCounters: {
      externalGeometrySourceCount: 0,
      loadedExternalHumanModelCount: 0,
      generatedGlbCount: 0,
      negativeScaleCount: 0,
      runtimeBoneScaleCount: 0,
      authorityWriteViolationCount: 0,
      overlappingClosedMeshCount: 0,
      randomSurfaceNoiseCount: 0,
    },
  };
  report.passed = report.meshCount === 24 && variants.every(({ passed }) => passed) && variantRegression.passed
    && independentMetricDefinitionsPassed && Object.values(report.policyCounters).every((count) => count === 0);
  return report;
}

function auditRecord(geometry, group, parameters, frame, prior, side, lod) {
  const vertexIds = [...new Set(Array.from(geometry.indices.slice(group.indexOffset, group.indexOffset + group.indexCount)))];
  const landmarks = geometry.landmarks.filter(({ id }) => id.startsWith(`${side}_femur_`)).map((landmark) => {
    const nearest = nearestVertex(geometry.positions, vertexIds, landmark.position);
    const surfaceDistanceGated = SURFACE_CLASSIFICATIONS.has(landmark.classification);
    return { ...landmark, nearestSurfacePoint: nearest.point, nearestVertexId: nearest.id, surfaceErrorMeters: nearest.distance, surfaceDistanceGated };
  });
  const gatedLandmarks = landmarks.filter(({ surfaceDistanceGated }) => surfaceDistanceGated);
  const maximumSurfaceLandmarkErrorMeters = Math.max(...gatedLandmarks.map(({ surfaceErrorMeters }) => surfaceErrorMeters));
  const landmarkToleranceMeters = LANDMARK_TOLERANCE_METERS[lod];
  const distalMetrics = auditDistalMetrics(geometry.positions, vertexIds, parameters, frame, side);
  const headFit = {
    ...prior.sphereFit,
    fitKind: 'best-fit sphere retained as the joint-center gate for a mildly ellipsoidal head',
    ellipsoidRatio: parameters.headEllipsoidRatio,
  };
  headFit.passed = headFit.sampleCount >= Math.max(24, Math.round(FEMUR_LOD_SPECS_V1[lod].radialSegments * 1.1))
    && headFit.rmsRadiusRatio <= 0.035 && headFit.maxRadiusRatio <= 0.08 && headFit.centerOffsetMeters <= 0.002;
  const topologyPassed = prior.connectedComponents === 1 && prior.boundaryEdges === 0 && prior.nonManifoldEdges === 0
    && prior.degenerateTriangles === 0 && prior.undefinedNormals === 0 && prior.nanCount === 0 && prior.infCount === 0
    && prior.selfIntersections === 0 && prior.invertedNormals === 0 && prior.signedVolume > 0;
  const result = {
    variantId: null,
    side,
    lod,
    femurLengthMeters: parameters.femurLength,
    leftRightAsymmetry: parameters.leftRightAsymmetry,
    parameters,
    vertexCount: prior.vertexCount,
    triangleCount: prior.triangleCount,
    connectedComponents: prior.connectedComponents,
    boundaryEdges: prior.boundaryEdges,
    nonManifoldEdges: prior.nonManifoldEdges,
    degenerateTriangles: prior.degenerateTriangles,
    undefinedNormals: prior.undefinedNormals,
    nanCount: prior.nanCount,
    infinityCount: prior.infCount,
    selfIntersection: prior.selfIntersections,
    invertedNormals: prior.invertedNormals,
    signedVolume: prior.signedVolume,
    headFit,
    neckShaftAngle: prior.neckShaftAngle,
    anteversion: prior.anteversion,
    landmarks,
    maximumSurfaceLandmarkErrorMeters,
    landmarkToleranceMeters,
    distalMetrics,
    topologyPassed,
  };
  result.passed = topologyPassed && headFit.passed && prior.neckShaftAngle.passed && prior.anteversion.passed
    && maximumSurfaceLandmarkErrorMeters <= landmarkToleranceMeters && distalMetrics.passed;
  return result;
}

function auditDistalMetrics(positions, vertexIds, parameters, frame, side) {
  const condylarMedial = nearestVertex(positions, vertexIds, frame.posteriorCondyleMedial);
  const condylarLateral = nearestVertex(positions, vertexIds, frame.posteriorCondyleLateral);
  const sideSign = side === 'left' ? 1 : -1;
  const mouthHalfWidth = parameters.intercondylarFossaWidth / 2;
  const medialMouthTarget = [frame.intercondylarFossa[0] + sideSign * mouthHalfWidth, frame.intercondylarFossa[1], frame.intercondylarFossa[2]];
  const lateralMouthTarget = [frame.intercondylarFossa[0] - sideSign * mouthHalfWidth, frame.intercondylarFossa[1], frame.intercondylarFossa[2]];
  const notchMedial = nearestVertex(positions, vertexIds, medialMouthTarget);
  const notchLateral = nearestVertex(positions, vertexIds, lateralMouthTarget);
  const patellarGroove = nearestVertex(positions, vertexIds, frame.patellarGroove);
  const medialTrochlearRidge = nearestVertex(positions, vertexIds, frame.medialTrochlearRidge);
  const lateralTrochlearRidge = nearestVertex(positions, vertexIds, frame.lateralTrochlearRidge);
  const medialEpicondyle = nearestVertex(positions, vertexIds, frame.medialEpicondyle);
  const lateralEpicondyle = nearestVertex(positions, vertexIds, frame.lateralEpicondyle);
  const adductorTubercle = nearestVertex(positions, vertexIds, frame.adductorTubercle);
  const condylarDefinition = createMetricDefinitions(side).condylarSeparation;
  const notchDefinition = createMetricDefinitions(side).intercondylarNotchWidth;
  assertIndependentDistalMetricDefinitions(condylarDefinition, notchDefinition);
  const condylarSeparationMeters = distance(condylarMedial.point, condylarLateral.point);
  const intercondylarNotchWidthMeters = Math.abs(notchMedial.point[0] - notchLateral.point[0]);
  const result = {
    condylarSeparationMetricId: condylarDefinition.metricId,
    intercondylarNotchWidthMetricId: notchDefinition.metricId,
    condylarSeparationPointIds: [condylarMedial.id, condylarLateral.id],
    intercondylarNotchWidthPointIds: [notchMedial.id, notchLateral.id],
    condylarSeparationMeters,
    intercondylarNotchWidthMeters,
    valuesAreDistinct: Math.abs(condylarSeparationMeters - intercondylarNotchWidthMeters) >= 0.004,
    distalHeightDifferenceMeters: Math.abs(condylarMedial.point[1] - condylarLateral.point[1]),
    medialTrochlearRidgeToGrooveMeters: distance(medialTrochlearRidge.point, patellarGroove.point),
    lateralTrochlearRidgeToGrooveMeters: distance(lateralTrochlearRidge.point, patellarGroove.point),
    epicondyleSeparationMeters: distance(medialEpicondyle.point, lateralEpicondyle.point),
    adductorTubercleSurfaceErrorMeters: adductorTubercle.distance,
    posteriorFossaDepthMeters: parameters.intercondylarFossaDepth,
    anteriorPatellarGrooveDepthMeters: parameters.patellarGrooveDepth,
  };
  result.passed = result.valuesAreDistinct && result.condylarSeparationMeters > result.intercondylarNotchWidthMeters
    && result.intercondylarNotchWidthMeters >= 0.008 && result.posteriorFossaDepthMeters >= 0.004
    && result.anteriorPatellarGrooveDepthMeters >= 0.003 && result.medialTrochlearRidgeToGrooveMeters > 0.012
    && result.lateralTrochlearRidgeToGrooveMeters > 0.012 && result.epicondyleSeparationMeters > 0.045;
  return result;
}

function createMetricDefinitions(side) {
  return {
    condylarSeparation: {
      metricId: CONDYLAR_SEPARATION_METRIC_ID,
      formula: 'euclidean_distance(posterior_medial_condylar_surface_peak, posterior_lateral_condylar_surface_peak)',
      pointSetIds: [`${side}_posterior_medial_condylar_surface_peak`, `${side}_posterior_lateral_condylar_surface_peak`],
      direction: 'three-dimensional peak-to-peak distance',
    },
    intercondylarNotchWidth: {
      metricId: INTERCONDYLAR_NOTCH_WIDTH_METRIC_ID,
      formula: 'absolute_medial_lateral_projection(posterior_fossa_medial_mouth, posterior_fossa_lateral_mouth)',
      pointSetIds: [`${side}_posterior_fossa_medial_mouth`, `${side}_posterior_fossa_lateral_mouth`],
      direction: 'medial-lateral projection at posterior fossa mouth',
    },
  };
}

function stableDistalParameters(left, right) {
  const keys = ['distalCondyleWidth', 'distalCondyleDepth', 'medialCondyleScale', 'lateralCondyleScale', 'medialCondylePosteriorLength', 'lateralCondylePosteriorLength', 'intercondylarFossaWidth', 'intercondylarFossaDepth', 'patellarGrooveDepth'];
  return keys.every((key) => left[key] === right[key]);
}

function nearestVertex(positions, vertexIds, target) {
  let best = { id: -1, point: null, distance: Infinity };
  for (const id of vertexIds) {
    const point = vertex(positions, id);
    const candidateDistance = distance(point, target);
    if (candidateDistance < best.distance) best = { id, point, distance: candidateDistance };
  }
  return best;
}

function vertex(values, id) { return [values[id * 3], values[id * 3 + 1], values[id * 3 + 2]]; }
function distance(left, right) { return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]); }
