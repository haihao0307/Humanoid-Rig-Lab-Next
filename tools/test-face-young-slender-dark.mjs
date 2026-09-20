import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const identity=read('body/FaceIdentity.js');
const character=read('body/CharacterPresets.js');
const skin=read('body/SkinAppearance.js');

assert.match(identity,/const FACE_YOUNG_SLENDER_MALE_SHAPE=Object\.freeze\(\{/,'young slender role shape missing');
assert.match(character,/label:'年轻清瘦男性参考'/,'initial role label was not updated');
assert.match(character,/shape:FACE_YOUNG_SLENDER_MALE_SHAPE/,'initial role does not use the young slender identity');
assert.match(character,/baseColor:'#ad7d66'/,'initial role skin was not darkened');

const identityApi=vm.runInNewContext(identity+'\n({FACE_SCULPTED_MALE_SHAPE,FACE_YOUNG_SLENDER_MALE_SHAPE,validateFaceIdentityShape})');
const oldShape=identityApi.FACE_SCULPTED_MALE_SHAPE,newShape=identityApi.validateFaceIdentityShape(identityApi.FACE_YOUNG_SLENDER_MALE_SHAPE);

assert(newShape.headWidth<oldShape.headWidth,'head width did not decrease');
assert(newShape.cranialWidth<oldShape.cranialWidth,'temporal width did not decrease');
assert(newShape.cheekboneWidth<oldShape.cheekboneWidth,'cheekbone width did not decrease');
assert(newShape.jawWidth<oldShape.jawWidth,'jaw width did not decrease');
assert(newShape.lowerFaceFullness<oldShape.lowerFaceFullness,'lower-face fullness did not decrease');
assert(newShape.chinProjection<oldShape.chinProjection,'chin projection was not softened');
assert(newShape.noseLength<oldShape.noseLength,'nose length was not shortened for the younger role');
assert(newShape.lipFullness>oldShape.lipFullness,'lip fullness was not softened toward the younger role');

const skinPrefix=skin.slice(0,skin.indexOf('function resolveSkinMaterial'));
const skinApi=vm.runInNewContext(skinPrefix+'\n({validateSkinAppearance,skinHexToLinear})');
const young=skinApi.validateSkinAppearance({baseColor:'#ad7d66',undertone:-.02,redness:0,roughness:.54,oil:.18,scatter:.36,variation:.18,pores:.20,sunExposure:.20,weathering:.05});
const previous=skinApi.skinHexToLinear('#c7a18d'),current=skinApi.skinHexToLinear(young.baseColor);
const luminance=rgb=>.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
assert(luminance(current)<luminance(previous)*.78,'skin darkening is too small to survive the current lighting');
assert.equal(young.redness,0,'facial blush returned');
assert(young.roughness<.60&&young.pores<.35&&young.weathering<.16,'young skin surface was not softened');

console.log(JSON.stringify({
  role:'young-slender-darker',
  faceWidthDelta:newShape.headWidth-oldShape.headWidth,
  jawWidthDelta:newShape.jawWidth-oldShape.jawWidth,
  cheekboneWidthDelta:newShape.cheekboneWidth-oldShape.cheekboneWidth,
  skinBaseColor:young.baseColor,
  skinLuminanceRatio:luminance(current)/luminance(previous),
  redness:young.redness,
  beardExpected:false,
  browserExecuted:false,
  visualAcceptance:false
}));
