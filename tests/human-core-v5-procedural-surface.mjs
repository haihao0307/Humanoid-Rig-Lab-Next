import assert from 'node:assert/strict';
import {
  BodyFieldCompilerV5, analyzeSurfaceGeometryV5, createBodyDNA, createHumanRigCoreV5,
  extractStableProceduralSurfaceV5, validateSurfaceRegionBindingV5,
} from '../src/modules/human-core-v5/index.js';

const referenceDNA = createBodyDNA({ bodyDNAId:'surface-reference', identity:{humanId:'surface-reference'}, proportionRevision:3 });
const rigCore = createHumanRigCoreV5({ bodyDNA:referenceDNA });
const field = new BodyFieldCompilerV5().compile({ bodyDNA:referenceDNA, rigCore });
const lowStart = performance.now();
const low = extractStableProceduralSurfaceV5(field, { resolution:28 });
const lowTime = performance.now() - lowStart;
const mediumStart = performance.now();
const surface = extractStableProceduralSurfaceV5(field, { resolution:40 });
const mediumTime = performance.now() - mediumStart;
const geometry = analyzeSurfaceGeometryV5(surface.positions, surface.indices);
assert.equal(geometry.boundaryEdgeCount, 0);
assert.equal(geometry.connectedComponentCount, 1);
assert.equal(geometry.nonFiniteVertexCount, 0);
assert.equal(geometry.outOfRangeIndexCount, 0);
assert.ok(geometry.degenerateTriangleRatio < .001);
assert.equal(validateSurfaceRegionBindingV5(surface, surface.metadata.vertexCount).valid, true);
assert.ok(relativeError(surface.metadata.measurements.height, referenceDNA.proportion.height) <= .02, 'Surface height exceeded 2%.');
assert.ok(relativeError(surface.metadata.measurements.shoulderWidth, referenceDNA.proportion.shoulderWidth) <= .03, 'Surface shoulder width exceeded 3%.');
assert.ok(relativeError(surface.metadata.measurements.hipWidth, referenceDNA.proportion.hipWidth) <= .03, 'Surface hip width exceeded 3%.');
for (const [key, dnaKey] of [['upperArm','upperArm'],['forearm','forearm'],['thigh','thigh'],['lowerLeg','lowerLeg']]) {
  assert.ok(relativeError(surface.metadata.measurements.limbEndpoints[key], referenceDNA.proportion.limbLengths[dnaKey]) <= .02);
}

const symmetricVolumes = regionVolumes(surface);
for (const pair of [['leftUpperArm','rightUpperArm'],['leftThigh','rightThigh'],['leftCalf','rightCalf'],['leftFoot','rightFoot']]) {
  assert.ok(relativeError(symmetricVolumes[pair[0]], symmetricVolumes[pair[1]]) <= .02, `${pair.join('/')} symmetry exceeded 2%.`);
}

const asymmetricDNA = createBodyDNA({
  bodyDNAId:'surface-asymmetric',identity:{humanId:'surface-asymmetric'},proportionRevision:4,
  asymmetry:{mode:'authored',leftRightScale:{shoulder:1.12,arm:1.10,hand:1.08,hip:1.06,leg:1.10,foot:1.06}},
});
const asymmetricRig = createHumanRigCoreV5({ bodyDNA:asymmetricDNA });
const asymmetricSurface = extractStableProceduralSurfaceV5(new BodyFieldCompilerV5().compile({bodyDNA:asymmetricDNA,rigCore:asymmetricRig}),{resolution:36});
const asymmetricVolumes = regionVolumes(asymmetricSurface);
assert.ok(asymmetricVolumes.leftUpperArm > asymmetricVolumes.rightUpperArm, 'Authored left arm asymmetry was averaged away.');
assert.ok(asymmetricVolumes.leftThigh > asymmetricVolumes.rightThigh, 'Authored left leg asymmetry was averaged away.');
assert.ok(lowTime < 1000, `Low resolution surface generation took ${lowTime.toFixed(2)} ms.`);
assert.ok(mediumTime < 3000, `Medium resolution surface generation took ${mediumTime.toFixed(2)} ms.`);

console.log(JSON.stringify({ lowGenerationMs:lowTime, mediumGenerationMs:mediumTime, vertexCount:surface.metadata.vertexCount, triangleCount:surface.metadata.triangleCount, workerMessageBytes:surface.positions.byteLength+surface.normals.byteLength+surface.indices.byteLength+surface.regionIds.byteLength+surface.regionBlendWeights.byteLength+surface.bindLocalData.byteLength }));
console.log('Human Core V5 Procedural Surface: watertight single component, geometry tolerances, deterministic region binding, and authored asymmetry passed.');

function relativeError(actual, expected){return Math.abs(actual-expected)/Math.max(1e-9,Math.abs(expected));}
function regionVolumes(surface){const points=Object.fromEntries(surface.regionNames.map((name)=>[name,[]]));for(let v=0;v<surface.positions.length/3;v++){const name=surface.regionNames[surface.regionIds[v*4]];points[name].push([surface.positions[v*3],surface.positions[v*3+1],surface.positions[v*3+2]]);}return Object.fromEntries(Object.entries(points).map(([name,list])=>[name,momentVolume(list)]));}
function momentVolume(points){if(points.length<4)return 0;const center=[0,0,0];for(const point of points)for(let axis=0;axis<3;axis++)center[axis]+=point[axis]/points.length;const c=[[0,0,0],[0,0,0],[0,0,0]];for(const point of points){const d=point.map((value,axis)=>value-center[axis]);for(let a=0;a<3;a++)for(let b=0;b<3;b++)c[a][b]+=d[a]*d[b]/points.length;}const det=c[0][0]*(c[1][1]*c[2][2]-c[1][2]*c[2][1])-c[0][1]*(c[1][0]*c[2][2]-c[1][2]*c[2][0])+c[0][2]*(c[1][0]*c[2][1]-c[1][1]*c[2][0]);return Math.sqrt(Math.max(0,det));}
