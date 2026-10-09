import * as THREE from 'three';
import {REPAIR_META,REPAIR_DATA} from './RepairData.js';
const atlasGLSL=`
uniform sampler2D uRepairColor,uRepairBands,uRepairSurface;
uniform vec4 uRepairRect;uniform float uRepairEnabled;
vec2 repairUV(vec2 uv){return (uv-uRepairRect.xy)/uRepairRect.zw;}
float repairMask(vec2 uv){vec2 p=repairUV(uv);float valid=step(0.,p.x)*step(p.x,1.)*step(0.,p.y)*step(p.y,1.);return texture2D(uRepairColor,p).a*valid*uRepairEnabled;}
vec4 repairSkinColor(vec4 src,vec2 uv){return vec4(mix(src.rgb,texture2D(uRepairColor,repairUV(uv)).rgb,repairMask(uv)),src.a);}
vec4 repairSkinSurface(vec4 src,vec2 uv){return mix(src,texture2D(uRepairSurface,repairUV(uv)),repairMask(uv));}
vec3 repairBaseNormal(vec3 src,vec2 uv){return normalize(mix(src,vec3(0.,0.,1.),repairMask(uv)));}
vec3 repairBand(vec3 src,vec2 uv,bool micro){vec4 b=texture2D(uRepairBands,repairUV(uv));vec2 xy=(micro?b.ba:b.rg)*2.-1.;vec3 n=vec3(xy,sqrt(max(.01,1.-dot(xy,xy))));return normalize(mix(src,n,repairMask(uv)));}
`;
export async function loadScanRepair(rig){
 const loader=new THREE.TextureLoader();
 const textures=await Promise.all(['color','normalBands','surface'].map(async name=>{const t=await loader.loadAsync(REPAIR_DATA[name]);t.flipY=true;t.colorSpace=name==='color'?THREE.SRGBColorSpace:THREE.NoColorSpace;t.anisotropy=8;t.needsUpdate=true;return t;}));
 const uniforms={uRepairColor:{value:textures[0]},uRepairBands:{value:textures[1]},uRepairSurface:{value:textures[2]},uRepairRect:{value:new THREE.Vector4(...REPAIR_META.uvRect)},uRepairEnabled:{value:1}};
 rig.scanRepair={textures,uniforms,meta:REPAIR_META};
 for(const e of rig.eyes)for(const mat of [e.lid.mesh.material,e.lid.edge.material]){
  const before=mat.onBeforeCompile,key=mat.customProgramCacheKey.bind(mat);
  mat.onBeforeCompile=s=>{
   before(s);Object.assign(s.uniforms,uniforms);
   s.fragmentShader=s.fragmentShader.replaceAll('texture2D(map,vTissueUV)','repairSkinColor(texture2D(map,vTissueUV),vTissueUV)');
   s.fragmentShader=s.fragmentShader.replaceAll('texture2D(uSurface,vTissueUV)','repairSkinSurface(texture2D(uSurface,vTissueUV),vTissueUV)');
   s.vertexShader=s.vertexShader.replaceAll('texture2D(uSurface,uv)','repairSkinSurface(texture2D(uSurface,uv),uv)');
   s.fragmentShader=s.fragmentShader.replaceAll('texture2D(normalMap,vTissueUV).xyz*2.-1.','repairBaseNormal(texture2D(normalMap,vTissueUV).xyz*2.-1.,vTissueUV)');
   s.fragmentShader=s.fragmentShader.replaceAll('texture2D(uMesoMap,vTissueUV).rgb*2.-1.','repairBand(texture2D(uMesoMap,vTissueUV).rgb*2.-1.,vTissueUV,false)');
   s.fragmentShader=s.fragmentShader.replaceAll('texture2D(uMicroMap,vTissueUV).rgb*2.-1.','repairBand(texture2D(uMicroMap,vTissueUV).rgb*2.-1.,vTissueUV,true)');
   s.fragmentShader=s.fragmentShader.replaceAll('oldBroadN.xy*unbake*.92','oldBroadN.xy*unbake*.92*(1.-repairMask(vTissueUV))').replaceAll('oldBroadM.xy*unbake*.78','oldBroadM.xy*unbake*.78*(1.-repairMask(vTissueUV))');
   s.fragmentShader=s.fragmentShader.replaceAll('float skinSpecMask=texture2D(uSpec,vTissueUV).r;','float skinSpecMask=mix(texture2D(uSpec,vTissueUV).r,.48,repairMask(vTissueUV));');
   s.vertexShader=atlasGLSL+s.vertexShader;s.fragmentShader=atlasGLSL+s.fragmentShader;
  };
  mat.customProgramCacheKey=()=>key()+'/same-scan-repair-072';mat.needsUpdate=true;
 }
 window.__NATURAL_REVIEW__.scanRepair=enabled=>{uniforms.uRepairEnabled.value=enabled?1:0;rig.requestRender();};
 window.__NATURAL_REVIEW__.repairInfo=()=>({enabled:uniforms.uRepairEnabled.value===1,ready:textures.every(t=>t.image?.width===REPAIR_META.atlasSize[0]),...REPAIR_META});
 rig.requestRender();return rig;
}
export function disposeScanRepair(rig){for(const t of rig.scanRepair?.textures||[])t.dispose();}
