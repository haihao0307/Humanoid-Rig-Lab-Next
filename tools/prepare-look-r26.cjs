'use strict';
const fs=require('fs');
if(['src/BodyOriginalSkinR26.js','src/BodyAtlasRayR26.js'].some(f=>fs.existsSync(f)))throw Error('Historical one-time fork only; current sources already exist. Use tools/build.cjs to rebuild.');
let s=fs.readFileSync('src/BodyOriginalSkinR24.js','utf8');
const once=(a,b)=>{if(s.split(a).length!==2)throw Error('Missing look edit '+a.slice(0,65));s=s.replace(a,()=>b);};
once('const appearanceUniforms={};','const appearanceUniforms={},lightSettingsR26={},originalLightR26=pack.originalLightingR26||{};');
once("const unit=(a)=>",`const linearColourR26=hex=>{const n=parseInt(hex.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255].map(v=>{v/=255;return v<.04045?v*.0773993808:Math.pow((v+.055)*.9478672986,2.4);});};
function lightColourR26(index){const key=index===0?'key':'rim',source=currentProfile.shadows[index].colour,strength=lightSettingsR26[key]??originalLightR26[key],colour=lightSettingsR26[key+'Color']??originalLightR26[key+'Color'];if(strength===originalLightR26[key]&&colour===originalLightR26[key+'Color'])return source;return linearColourR26(colour).map(v=>v*strength);}
function lightingR26(values){for(const[k,v]of Object.entries(values)){if(!['key','rim','environment','exposure','environmentRotation','keyColor','rimColor'].includes(k))throw Error('当前原阴影尚不支持这个灯光设置');if(k.endsWith('Color')?!/^#[a-f0-9]{6}$/i.test(v):!Number.isFinite(v)||k!=='environmentRotation'&&v<0)throw Error('灯光数值无效');}Object.assign(lightSettingsR26,values);}
const unit=(a)=>`);
once("currentProfile.shadows.forEach((l,i)=>{values",`if(lightSettingsR26.environment!==undefined&&lightSettingsR26.environment!==originalLightR26.environment)values.envMapIntensity=lightSettingsR26.environment;
if(lightSettingsR26.environmentRotation!==undefined&&lightSettingsR26.environmentRotation!==originalLightR26.environmentRotation){const a=lightSettingsR26.environmentRotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a);values.envMapRotation=[c,0,s,0,1,0,-s,0,c];}
currentProfile.shadows.forEach((l,i)=>{values`);
once("values['directionalLights['+i+'].color']=l.colour;","values['directionalLights['+i+'].color']=lightColourR26(i);");
once("environment.exposure);draw();}","lightSettingsR26.exposure??environment.exposure);draw();}");
once("const names={bodyVariation:","const names={enabled:'fbEnabled',regionalColor:'fbRegional',bodyVariation:");
once("if(!names[k]||!Number.isFinite(v)||v<0||v>1)","if(!names[k]||(k==='enabled'?typeof v!=='boolean':!Number.isFinite(v)||v<0||v>1))");
once("appearanceUniforms[names[k]]=v;},redraw()","appearanceUniforms[names[k]]=k==='enabled'?(v?1:0):v;},lighting:lightingR26,redraw()");
fs.writeFileSync('src/BodyOriginalSkinR26.js',s.replace("bodySurfaceControls:structuredClone(appearanceUniforms)","bodySurfaceControls:structuredClone(appearanceUniforms),lightingOverrides:structuredClone(lightSettingsR26),shadowDirectionsUnchanged:true"));
let r=fs.readFileSync('src/BodyAtlasRayR25.js','utf8');
if(!r.includes('return{bodySurface(values)'))throw Error('Ray entry missing');
r=r.replace('return{bodySurface(values)','return{sourceLightingR26(values){if(!own)throw Error("原材质尚未载入");own.lighting(values);if(diagnostic===12)own.redraw();},bodySurface(values)');
fs.writeFileSync('src/BodyAtlasRayR26.js',r);
