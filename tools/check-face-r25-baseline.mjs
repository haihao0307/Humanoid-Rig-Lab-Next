import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const perioral=read('body/PerioralSurface.js');
const anatomy=read('body/FaceAnatomy.js');
const eye=read('body/EyeAnatomy.js');
const identity=read('body/FaceIdentity.js');
const appearance=read('body/FaceAppearance.js');
const assembly=JSON.parse(read('source/assembly.json'));

assert.match(perioral,/revision:\s*'r24-double-vermilion-height-final'/,'R25 must retain the accepted R24 lip checkpoint');
const centre=perioral.match(/\[0,\s*(-?\d*\.?\d+),\s*(-?\d*\.?\d+),\s*(-?\d*\.?\d+)\]/);
assert(centre,'central lip outline station missing');
const fissure=Number(centre[1]),top=Number(centre[2]),bottom=Number(centre[3]);
assert(Math.abs((top-fissure)-.00730)<1e-10,'accepted upper visible lip height changed');
assert(Math.abs((fissure-bottom)-.00900)<1e-10,'accepted lower visible lip height changed');
assert.match(anatomy,/revision:'r24-anatomical-nasal-body-and-rolled-alar-rim'/,'accepted H nose owner changed');
assert.match(anatomy,/nostrils:\{x:\.0095,y:1\.4780,rx:\.0039,ry:\.00255,tilt:\.46/,'accepted nostril aperture controls changed');
assert.match(anatomy,/\[1\.487,0\.2048\],\[1\.49,0\.2049\]/,'accepted H nasal tip profile changed');
assert.match(eye,/revision:'r25b-canthus-owned-aperture-family'/,'R25B eye aperture family is not active');
assert.match(eye,/baselineRevision:'r24-span-aware-lid-return'/,'R25B lost the recorded R24 eye baseline');
assert.match(eye,/function compactEyeAperturePoint/,'R25B shared aperture owner is missing');
assert.match(appearance,/coverage:'19 controls:/,'face appearance metadata is not synchronized with R25 identity controls');

const api=vm.runInNewContext(identity+'\n({FACE_IDENTITY_PARAMETERS,compileFaceIdentityShape,sampleFaceIdentity})');
assert.equal(api.FACE_IDENTITY_PARAMETERS.length,19,'R25A expects 19 bounded identity controls');
const byId=new Map(api.FACE_IDENTITY_PARAMETERS.map(parameter=>[parameter.id,parameter]));
for(const id of ['eyeFissureHeight','upperLidFullness']){
  assert(byId.has(id),'missing R25 eye identity control '+id);
  assert.equal(byId.get(id).sampleScale,0,id+' must remain excluded from seeded identities before visual validation');
}
const offsets=api.compileFaceIdentityShape({eyeFissureHeight:1,upperLidFullness:1});
assert.deepEqual(Array.from(offsets.lidUpperLeft),[0,1.15,.85]);
assert.deepEqual(Array.from(offsets.lidUpperRight),[0,1.15,.85]);
assert.deepEqual(Array.from(offsets.lidLowerLeft),[0,-1.05,0]);
assert.deepEqual(Array.from(offsets.lidLowerRight),[0,-1.05,0]);
const sampled=api.sampleFaceIdentity(4101);
assert(!Object.hasOwn(sampled.shape,'eyeFissureHeight'));
assert(!Object.hasOwn(sampled.shape,'upperLidFullness'));

const order=assembly.modules;
const before=(a,b)=>order.indexOf(a)>=0&&order.indexOf(a)<order.indexOf(b);
assert(before('body/HeadSculpt.js','body/FaceIdentity.js'));
assert(before('body/FaceIdentity.js','body/FaceControls.js'));
assert(before('body/PerioralSurface.js','body/FaceAnatomy.js'));
assert(before('body/FaceAnatomy.js','body/EyeAnatomy.js'));
assert(before('body/EyeAnatomy.js','body/CompactWorkbench.js'));

console.log(JSON.stringify({
  baseline:'dccd299a95661205325ee90a30f892fcf67e18ab',
  acceptedNoseLocked:true,
  upperVisibleLipMm:(top-fissure)*1000,
  lowerVisibleLipMm:(fissure-bottom)*1000,
  identityControls:api.FACE_IDENTITY_PARAMETERS.length,
  seededEyeControlsFrozen:true,
  assemblyOrderChecked:true,
  browserExecuted:false,
  gpuExecuted:false,
  visualAcceptance:false
}));