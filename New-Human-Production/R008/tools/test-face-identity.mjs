import assert from 'node:assert/strict';
import {IDENTITY_PARAMETERS,identityTransform,identityBasis,normalizeIdentity,DEMO_IDENTITY,FACE_IDENTITY_SCHEMA,FACE_IDENTITY_SOURCE} from '../FaceIdentityModel.mjs';
import {FACE_LANDMARKS,referenceCoordinates,normalizeReference,LANDMARK_SCHEMA} from '../FaceLandmarks.mjs';
import {projectCanonical,FACE_MEASURES} from '../FaceMeasurements.mjs';
import {fitFaceReference,faceReferenceError} from '../FaceReferenceFit.mjs';
assert.equal(IDENTITY_PARAMETERS.length,53);assert.equal(FACE_LANDMARKS.length,82);assert.equal(FACE_MEASURES.length,27);assert.equal(new Set(FACE_LANDMARKS.map(p=>p.id)).size,82);
for(const d of IDENTITY_PARAMETERS){const p=d.centre.map((x,i)=>x+[.003,.004,.007][i]),basis=identityBasis(p,d),eps=.000001;
 for(let axis=0;axis<3;axis++){const up=identityTransform(p.map((x,i)=>x+(i===axis?eps:0)),{[d.id]:1}),down=identityTransform(p.map((x,i)=>x-(i===axis?eps:0)),{[d.id]:1});for(let k=0;k<3;k++)assert(Math.abs((up[k]-down[k])/(2*eps)-(axis===k?1:0)-basis.jacobian[k*3+axis])<.00001,d.id+' derivative');}}
const a=identityTransform([.050,1.657,.10],{eyeSpacingLeft:2,eyeTiltLeft:3}),b=identityTransform([-.050,1.657,.10],{eyeSpacingRight:2,eyeTiltRight:3});assert(Math.abs(a[0]+b[0])<1e-12&&Math.abs(a[1]-b[1])<1e-12);
assert.deepEqual(identityTransform([.1,1.3,0],DEMO_IDENTITY),[.1,1.3,0]);assert.deepEqual(identityTransform([.02,1.63,.1],{}),[.02,1.63,.1]);
// Broad bilateral brows must not pinch or displace the nasal midline.
assert.deepEqual(identityTransform([0,1.673,.108],{browLengthLeft:45,browLengthRight:45}),[0,1.673,.108]);
assert.deepEqual(identityTransform([-.02,1.673,.108],{browLengthLeft:45}),[-.02,1.673,.108]);
for(const [id,p]of [['foreheadHeight',[.015,1.685,.110]],['browLengthLeft',[.010,1.673,.108]],['browLengthRight',[-.010,1.673,.108]]]){const d=IDENTITY_PARAMETERS.find(d=>d.id===id),J=identityBasis(p,d).jacobian;for(let axis=0;axis<3;axis++){const e=1e-6,up=identityTransform(p.map((v,k)=>v+(k===axis?e:0)),{[id]:1}),down=identityTransform(p.map((v,k)=>v-(k===axis?e:0)),{[id]:1});for(let k=0;k<3;k++)assert(Math.abs((up[k]-down[k])/(2*e)-(k===axis?1:0)-J[k*3+axis])<1e-5,id+' transition derivative');}}
assert.throws(()=>normalizeIdentity({schema:FACE_IDENTITY_SCHEMA,source:FACE_IDENTITY_SOURCE,parameters:{eyeWidthLeft:99}}));assert.throws(()=>normalizeIdentity({schema:FACE_IDENTITY_SCHEMA,source:'other-person',parameters:{}}));
const basePoints=FACE_LANDMARKS.map(p=>({...p,point:[p.xy[0],p.xy[1],p.group==='鼻'?.14:.10]})),evaluate=parameters=>basePoints.map(p=>({...p,point:identityTransform(p.point,parameters)}));
const target=evaluate(DEMO_IDENTITY),reference=normalizeReference({schema:LANDMARK_SCHEMA,kind:'synthetic-demo',image:{width:1200,height:900},landmarks:Object.fromEntries(target.map(p=>{const q=projectCanonical(p.point);return [p.id,{xy:[.5+q[0]*2,.5+q[1]*2*1200/900],confidence:p.confidence,visible:true}];}))});
const scaled=referenceCoordinates({pupilLeft:[600,100],pupilRight:[400,100],nose:[500,200]}),rotated=referenceCoordinates({pupilLeft:[1200,700],pupilRight:[1200,300],nose:[1000,500]});for(const id of Object.keys(scaled))for(let k=0;k<2;k++)assert(Math.abs(scaled[id][k]-rotated[id][k])<1e-12);
const fitted=await fitFaceReference({reference,initial:normalizeIdentity(),evaluate});assert(fitted.after<fitted.before*.15,JSON.stringify(fitted));assert.equal(fitted.depthFitted,false);assert.equal(fitted.recipe.parameters.headDepth,undefined);
const missing={...reference,landmarks:{...reference.landmarks}};delete missing.landmarks.pupilLeft;assert.throws(()=>faceReferenceError(target,missing));
console.log(JSON.stringify({parameters:53,landmarks:82,before:fitted.before,after:fitted.after,iterations:fitted.iterations,photoDepthFitted:false}));
