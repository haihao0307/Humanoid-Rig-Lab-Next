'use strict';
const {replace}=require('../r32/render-integration.cjs');
function patch(source){
 const verify=process.env.BODY_R37_VERIFY_REDUCER==='1';
 let s=replace(source,' function update(frame,settings,epoch,profileOverride=null){'," let motionValidation=null;if(kind==='motion-r37')try{motionValidation=BodyShadowValidationR37.create(gl);}catch(e){console.warn('使用兼容的阴影检查方式：'+e.message);}\n function update(frame,settings,epoch,profileOverride=null){");
 const scan='const pixels=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);for(let j=0;j<pixels.length;j+=4)if(pixels[j]===255&&pixels[j+1]===0&&pixels[j+2]===255&&pixels[j+3]===0)unknownPixels++;';
 s=replace(s,scan,(verify?'':"if(!motionValidation){")+scan+(verify?'':'}'));
 s=replace(s,'}const error=gl.getError();gl.bindFramebuffer(gl.FRAMEBUFFER,null);',"}if(motionValidation){const count=motionValidation.check(maps,dimensions);"+(verify?"if(count!==unknownPixels)throw Error('阴影检查结果不一致');":'')+"unknownPixels=count;}const error=gl.getError();gl.bindFramebuffer(gl.FRAMEBUFFER,null);");
 s=replace(s,'enabled:true,updates,lastMS,unknownPixels,dimensions,matrices:lastMatrices',"enabled:true,updates,lastMS,unknownPixels,validationMethod:motionValidation?'gpu-reduction':'full-readback',dimensions,matrices:lastMatrices");
 s=replace(s,'close(){closed=true;for(const t of maps)', 'close(){closed=true;motionValidation?.close();for(const t of maps)');
 return s;
}
module.exports={patch};
