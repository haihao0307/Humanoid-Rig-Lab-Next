'use strict';
// The fixed-state atlas can also cast shadows for adjusted light directions.
const r32=require('../r32/render-integration.cjs'),r33=require('../r33/motion-skin.cjs');
function patch(input){let s=r33.source(r32.source(input));const R=r32.replace;
 s=R(s,'function create(canvas,initialAtlas,originalSkin=null){let atlas=initialAtlas,cpu=null,probing=false;','function create(canvas,initialAtlas,originalSkin=null){let atlas=initialAtlas,cpu=null,probing=false,shadowRendererR35=null,shadowErrorR35=null,atlasEpochR35=0;');
 const own="const own=originalSkin?BodyOriginalSkinR22.create(gl,canvas,originalSkin.pack,atlas,{fields:textures[1],skin:textures[5],palms:textures[3]},originalSkin.profile,environmentBinding):null;";
 const helper=own+"function updateAtlasShadowsR35(){if(!own)return;const report=own.report();if(report.shadowDirectionsUnchanged){own.setDynamicShadowsR35(null);shadowErrorR35=null;return;}try{if(!shadowRendererR35)shadowRendererR35=BodyDynamicShadowsR35.create(gl,{shader:program,textures,width,profiles:originalSkin.pack.profiles.baseline.shadows,baseline:originalSkin.pack.originalLightingR26,kind:'atlas'});own.setDynamicShadowsR35(shadowRendererR35.update(atlas,report.lightingOverrides,atlasEpochR35,own.currentProfile().shadows));shadowErrorR35=null;}catch(e){own.setDynamicShadowsR35(null);shadowErrorR35=e.message;}}";
 s=R(s,own,helper);
 s=R(s,'const changed=own.lighting(values);if(redraw&&changed&&diagnostic===12)own.redraw();','const changed=own.lighting(values);if(changed)updateAtlasShadowsR35();if(redraw&&changed&&diagnostic===12)own.redraw();');
 s=R(s,'atlas=next;gpuBytes=bytes;if(cpu)cpu.program(next);draw();','atlas=next;gpuBytes=bytes;atlasEpochR35++;updateAtlasShadowsR35();if(cpu)cpu.program(next);draw();');
 s=R(s,'originalSceneShadowsRestored:!!own,originalSkinOpticsRestored:false','originalSceneShadowsRestored:!!own?.report().sourceShadows,dynamicShadowR35:shadowRendererR35?.report()||null,dynamicShadowErrorR35:shadowErrorR35,originalSkinOpticsRestored:false');
 return s;
}
module.exports={patch};
