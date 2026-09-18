import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  CHICKEN_PHASE1_SEGMENTED_NECK_REVISION,
  CHICKEN_PHASE1_SEGMENTED_TOPOLOGY_REVISION,
  CHICKEN_PHASE1_SEGMENTED_CURVE_REVISION,
  splitChickenPhase1BodyDomains,
  sampleChickenPhase1SegmentedNeckProfile,
  parameterizeChickenPhase1SegmentedControlPoints,
  prependChickenPhase1BuriedNeckRoot
} from '../runtime/chicken_phase1_segmented_neck_adapter.mjs';

assert.equal(CHICKEN_PHASE1_SEGMENTED_NECK_REVISION, 'segmented-rigid-head-and-buried-root-neck-v8-2');
assert.equal(CHICKEN_PHASE1_SEGMENTED_TOPOLOGY_REVISION, 'torso-buried-neck-rigid-head-v8-2');
assert.equal(CHICKEN_PHASE1_SEGMENTED_CURVE_REVISION, 'bone-centerline-parallel-transport-with-buried-root-v4');

const html=fs.readFileSync(new URL('../CHICKEN_V46_R9_9_1_GAMEPLAY_HEAD.html',import.meta.url),'utf8');
function decodeFloat(id){const m=html.match(new RegExp(`<script[^>]+id=["']${id}["'][^>]*>([^<]+)</script>`));assert.ok(m,`missing ${id}`);const b=Buffer.from(m[1].trim(),'base64');return new Float32Array(b.buffer,b.byteOffset,b.byteLength/4);}
function decodeUint(id){const m=html.match(new RegExp(`<script[^>]+id=["']${id}["'][^>]*>([^<]+)</script>`));assert.ok(m,`missing ${id}`);const b=Buffer.from(m[1].trim(),'base64');return new Uint32Array(b.buffer,b.byteOffset,b.byteLength/4);}
const xs=decodeFloat('carrier-x'),centers=decodeFloat('carrier-center'),coef=decodeFloat('carrier-coef'),indices=decodeUint('carrier-index');
const harmonics=Math.round((coef.length/xs.length-1)/2),ringSize=96;
const positions=new Float32Array(xs.length*ringSize*3+6);
for(let station=0;station<xs.length;station++){
 const x=xs[station],cy=centers[station*2],cz=centers[station*2+1],offset=station*(1+2*harmonics);
 for(let sample=0;sample<ringSize;sample++){
  const theta=-Math.PI+2*Math.PI*sample/ringSize;let radius=coef[offset];
  for(let h=1;h<=harmonics;h++){radius+=coef[offset+h]*Math.cos(h*theta)+coef[offset+harmonics+h]*Math.sin(h*theta);}
  const q=(station*ringSize+sample)*3;positions[q]=x;positions[q+1]=cy+radius*Math.cos(theta);positions[q+2]=cz+radius*Math.sin(theta);
 }
}
const posterior=xs.length*ringSize*3;positions.set([xs[0],centers[0],centers[1]],posterior);positions.set([xs.at(-1),centers.at(-2),centers.at(-1)],posterior+3);
const domains=splitChickenPhase1BodyDomains(positions,indices);
assert.equal(domains.headStartX,.392);
assert.equal(domains.torsoIndices.length/3,9966);
assert.equal(domains.headIndices.length/3,2016);
assert.ok(domains.torsoIndices.length+domains.headIndices.length<indices.length,'neck sector must be removed from the original carrier');

const profileSamples=[0,.12,.28,.48,.68,.84,1].map(sampleChickenPhase1SegmentedNeckProfile);
for(const p of profileSamples){assert.ok(p.normal>0&&p.lateral>0&&p.ventral>0&&p.ventral<=1);}
assert.ok(profileSamples[0].normal>profileSamples.at(-1).normal,'neck must taper toward head base');
assert.ok(profileSamples[0].lateral>profileSamples.at(-1).lateral,'neck lateral radius must taper');

const cervicalPoints=[[.10,.58,.09],[.16,.65,.09],[.22,.72,.09],[.28,.80,.09],[.34,.87,.09],[.37,.91,.09]];
const points=prependChickenPhase1BuriedNeckRoot(cervicalPoints,.09);
assert.equal(points.length,cervicalPoints.length+1);
assert.ok(points[0][0]<cervicalPoints[0][0]&&points[0][1]<cervicalPoints[0][1]);
assert.ok(Math.abs(Math.hypot(points[0][0]-points[1][0],points[0][1]-points[1][1],points[0][2]-points[1][2])-.09)<1e-12);
const parameters=parameterizeChickenPhase1SegmentedControlPoints(points);
assert.equal(parameters.length,points.length);assert.equal(parameters[0],0);assert.equal(parameters.at(-1),1);
for(let i=1;i<parameters.length;i++)assert.ok(parameters[i]>parameters[i-1]);

console.log(JSON.stringify({revision:CHICKEN_PHASE1_SEGMENTED_NECK_REVISION,torsoTriangles:domains.torsoIndices.length/3,headTriangles:domains.headIndices.length/3,buriedRoot:points[0],curveParameters:parameters,profiles:profileSamples},null,2));
