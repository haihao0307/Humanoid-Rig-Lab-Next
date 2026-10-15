import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BASELINE, pitchMM, stitchPitchMM, subpixelCoverage, twillRepeatMM } from '../scale.mjs';
const near=(a,b,e=1e-10)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`);
test('14 oz reference construction resolves to millimetre pitches',()=>{
  near(pitchMM(BASELINE.warpEndsPerInch),0.42333333333333334);
  near(pitchMM(BASELINE.fillingPicksPerInch),0.635);
  near(twillRepeatMM(),1.6933333333333334);
});
test('11 stitches per 30mm gives an industrial-scale topstitch pitch',()=>near(stitchPitchMM(11),2.727272727272727));
test('subpixel thread preserves bounded energy instead of arbitrary geometric enlargement',()=>{
  const far=subpixelCoverage(.45,1.8,1.3),nearView=subpixelCoverage(.45,.15,1.3);
  assert.ok(far>0&&far<1);near(nearView,1);assert.ok(far<nearView);
});
test('invalid physical inputs are rejected',()=>{
  for(const x of[0,-1,NaN,Infinity])assert.throws(()=>pitchMM(x));
  assert.throws(()=>subpixelCoverage(.45,0));
});
test('inline and standalone runtimes define their JavaScript PI dependency',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const runtime=readFileSync(new URL('../runtime.js',import.meta.url),'utf8');
  for(const source of[html,runtime])assert.match(source,/const VERSION='DENIM-R17-GARMENT-SCALE';const PI=Math\.PI;/);
});
test('runtime is physical-scale and explicitly footprint filtered',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const runtime=readFileSync(new URL('../runtime.js',import.meta.url),'utf8');
  for(const source of[html,runtime]){
    assert.match(source,/\.0254\/60\.0/);assert.match(source,/\.0254\/40\.0/);
    assert.match(source,/fwidth\(vMaterial/);assert.match(source,/uThreadWidth\/ew\*uReadability/);
  }
  assert.match(html,/10,000|真实三维裤装|60 ends\/in/);
  assert.doesNotMatch(html,/<script[^>]+src=|<img|url\(https?:/i);
  const materialHTML=html.replace(/backdrop-filter\s*:\s*blur\([^)]*\)/gi,'');assert.doesNotMatch(materialHTML,/(^|[;{])\s*filter\s*:\s*blur/i);
});
