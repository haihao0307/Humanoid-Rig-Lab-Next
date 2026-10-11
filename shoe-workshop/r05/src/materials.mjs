import * as T from 'three';
import {ShoeMaterials as R04,CATALOGUE} from '../../r04/src/materials.mjs';
export {CATALOGUE};
const MEAN=[.08401343,.02765351,.00580022];
/** Shoe adapter: keep the pinned R10 grain/scan/finish kernels unchanged. */
export class ShoeMaterials extends R04{
 shell(part,state,plane){const mats=super.shell(part,state,plane);if(state.material==='clay')return mats;
  // The donor's very dark scan must not multiply a second full leather colour on the flesh side.
  // Same documented scan mean as donor grain(); no new material calibration is implied.
  const flesh=mats[1];flesh.normalScale.set(.1,.1);flesh.roughness=.98;flesh.sheen=.12;flesh.color.r/=MEAN[0];flesh.color.g/=MEAN[1];flesh.color.b/=MEAN[2];flesh.userData={...flesh.userData,albedoTransfer:'mean-normalized R10 scan',strengthCalibrated:false};
  flesh.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#ifdef USE_MAP\nvec4 leatherTexel=texture2D(map,vMapUv);leatherTexel.rgb=mix(vec3(.08401343,.02765351,.00580022),leatherTexel.rgb,.22);diffuseColor*=leatherTexel;\n#endif');};flesh.customProgramCacheKey=()=> 'r05-matte-flesh-mean-transfer';
  if(part.kind==='footbed'){mats[0].dispose();const top=flesh.clone();top.onBeforeCompile=flesh.onBeforeCompile;top.customProgramCacheKey=flesh.customProgramCacheKey;top.name='DERIVED_P19_SOCKLINER';top.color=new T.Color('#a6825c');top.color.r/=MEAN[0];top.color.g/=MEAN[1];top.color.b/=MEAN[2];top.normalScale.set(.14,.14);top.roughness=.94;top.userData={...flesh.userData,surfaceRole:'derived-matte-footbed'};mats[0]=top;}
  return mats;
 }
 report(){return {...super.report(),sourceGeometryScale:'Appearance-only conformal surface millimetres / 96; original manufacturing coordinates retained',fleshAlbedoTransfer:'same source-mean normalization as pinned donor grain',donorUnchanged:true};}
}
