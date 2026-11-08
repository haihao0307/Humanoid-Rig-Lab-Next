// Isolated shared lighting adapter. Constant environment radiance remains
// constant after convolution, so it can be added to every numeric PMREM sample
// without an image or per-view update. Skin, eyes and oral tissues all receive
// this same texture, radiance, exposure and camera-relative direct lights.
import {createSourceScene as createOriginalSourceScene,sceneUniformData,sceneBackgroundCPU} from './SourceScene.mjs';
import {SOURCE_SCENE_PROFILE} from './SourceSceneProfile.mjs';
export {sceneUniformData,sceneBackgroundCPU};

export const MATERIAL_INSPECTION_R01=Object.freeze({
 revision:'human.material-inspection-light/20261107-r01',
 environmentSourceScale:.25,
 neutralEnvironmentRadiance:.55,
 exposure:.7,
 physicallyMeasuredReference:false,
 description:'Neutral studio inspection prior: original analytic environment plus an isotropic white radiance field; both original direct lamps retained.',
});
let activeProfile='original';
export function setMaterialInspectionProfile(profile){if(!['original','soft'].includes(profile))throw Error('Unknown material inspection profile');activeProfile=profile;}
export function materialInspectionProfile(){return activeProfile;}

export async function createSourceScene(gl){
 const original=await createOriginalSourceScene(gl),softTextures=[],locations=new WeakMap(),sourceRecords=[];
 for(const ref of SOURCE_SCENE_PROFILE.environmentFields){
  const response=await fetch(ref.url);if(!response.ok)throw Error('Cannot load numeric environment for material inspection');
  const buffer=await response.arrayBuffer(),header=new Uint32Array(buffer,0,4);
  if(header[0]!==0x45423131||header[1]!==ref.width||header[2]!==ref.height||header[3]!==4||buffer.byteLength!==ref.bytes)throw Error('Material inspection environment dimensions changed');
  const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),x=>x.toString(16).padStart(2,'0')).join('');if(sha256!==ref.sha256)throw Error('Material inspection environment provenance changed');sourceRecords.push({source:ref.url,sha256,bytes:ref.bytes});
  const values=new Float32Array(buffer,16).slice();for(let i=0;i<values.length;i+=4)for(let k=0;k<3;k++)values[i+k]=values[i+k]*MATERIAL_INSPECTION_R01.environmentSourceScale+MATERIAL_INSPECTION_R01.neutralEnvironmentRadiance;
  const texture=gl.createTexture();gl.activeTexture(gl.TEXTURE13);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,header[1],header[2],0,gl.RGBA,gl.FLOAT,values);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);if(gl.getError())throw Error('Cannot upload material inspection environment');softTextures.push(texture);
 }
 return {...original,bind(program,camera,settings){
  original.bind(program,camera,settings);
  if(activeProfile!=='soft'||settings.lighting!=='inspection')return;
  let U=locations.get(program);if(!U){U=Object.fromEntries(['u_sceneEnvironmentIntensity','envMapIntensity','ambientLightColor'].map(name=>[name,gl.getUniformLocation(program,name)]));locations.set(program,U);}
  gl.activeTexture(gl.TEXTURE13);gl.bindTexture(gl.TEXTURE_2D,softTextures[settings.reverse?1:0]);
  gl.uniform1f(U.u_sceneEnvironmentIntensity,1);
  // The legacy source shader uses envMapIntensity; the function eye/oral
  // shaders use u_sceneEnvironmentIntensity. Set both to the SAME energy.
  gl.uniform1f(U.envMapIntensity,1);gl.uniform3f(U.ambientLightColor,0,0,0);
 },report:()=>({...original.report(),materialInspection:{profile:activeProfile,...MATERIAL_INSPECTION_R01,sourceRecords}}),dispose(){for(const t of softTextures)gl.deleteTexture(t);original.dispose();}};
}
