import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const face=read('body/FaceAnatomy.js');
const skin=read('body/SkinAppearance.js');
const character=read('body/CharacterPresets.js');

assert.match(face,/compactBeardGeometry\(surface,\{[^}]*density:0\}\)/s,'production face must request zero beard density');
assert.match(face,/if\(beard\.report\.strands\)output\.push\(compactFaceGeneratedMesh\('faceBeard'/,'zero-strand beard must not create a draw mesh');
assert.match(character,/skin:\{baseColor:'#c7a18d',roughness:\.60,oil:\.15,redness:0\}/,'initial character must use neutral redness');

const prefix=skin.slice(0,skin.indexOf('function resolveSkinMaterial'));
const api=vm.runInNewContext(prefix+'\n({SKIN_DEFAULT,SKIN_PRESETS,EAST_ASIAN_SKIN_PRESETS,SKIN_CONTROLS,skinPreset,sampleSkinAppearance,validateSkinAppearance,characterSkinAppearance})');
const plain=value=>JSON.parse(JSON.stringify(value));

assert.equal(api.SKIN_DEFAULT.redness,0,'new skin recipes default to no authored facial blush');
assert(api.EAST_ASIAN_SKIN_PRESETS.every(p=>p.redness===0),'scene skin swatches must default to neutral redness');
for(const preset of [...api.SKIN_PRESETS,...api.EAST_ASIAN_SKIN_PRESETS])assert.equal(api.skinPreset(preset.id,4101).redness,0,'preset '+preset.id+' reintroduced redness');
for(const palette of ['east-asian','general'])for(let seed=0;seed<64;seed++)assert.equal(api.sampleSkinAppearance(seed,palette).redness,0,palette+' sampled face reintroduced redness at seed '+seed);
assert.equal(api.characterSkinAppearance({skinColor:[.5,.4,.3]}).redness,0,'legacy colour import must not silently restore blush');
assert.equal(api.validateSkinAppearance({...plain(api.SKIN_DEFAULT),redness:.42}).redness,.42,'explicit user redness control must remain available');
assert(api.SKIN_CONTROLS.some(c=>c.key==='redness'&&c.min===0&&c.max===1),'redness remains an opt-in editable control');

console.log(JSON.stringify({
  cleanShavenProduction:true,
  beardGeneratorRetained:/function compactBeardGeometry\(/.test(read('body/BeardAnatomy.js')),
  defaultRedness:api.SKIN_DEFAULT.redness,
  scenePresetsChecked:api.EAST_ASIAN_SKIN_PRESETS.length,
  generalPresetsChecked:api.SKIN_PRESETS.length,
  sampledFacesChecked:128,
  explicitRednessControlRetained:true,
  browserExecuted:false,
  gpuExecuted:false,
  visualAcceptance:false
}));
