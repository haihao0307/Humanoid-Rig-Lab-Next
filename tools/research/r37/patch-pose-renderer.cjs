'use strict';
// During playback only the per-function coefficients change. The conservative
// clip bounds, source skin fields and leaf ordering are reused unchanged.
const {replace}=require('../r32/render-integration.cjs');
function patch(input){
 const shadowSize=process.env.BODY_R37_REFERENCE_SHADOWS==='1'?2048:Number(process.env.BODY_R37_TEST_SHADOW_SIZE||1024);if(![512,768,1024,2048].includes(shadowSize))throw Error('Unsupported motion shadow test size');
 let text=replace(input,'frameEpoch=0,probing=false;', 'frameEpoch=0,probing=false,motionFunctionData=null,motionPreviewR37=false,motionShadowRendererR37=null;');
 const helper=`function uploadMotionFrameR37(){
  const count=frame.program.functions,h=Math.max(1,Math.ceil(count*44/4/width)),size=width*h*4;if(!motionFunctionData||motionFunctionData.length!==size)motionFunctionData=new Float32Array(size);const a=motionFunctionData,c=frame.coefficients,n=frame.normals,d=frame.program.domains,iv=frame.inverse,g=frame.geometric;
  for(let f=0;f<count;f++){const at=f*44,j=f*9,k=f*6;for(let r=0;r<3;r++){const q=j+r*3,z=at+r*4,h=at+20+r*4,o=at+32+r*4;a[z]=c[q];a[z+1]=c[q+1];a[z+2]=c[q+2];a[z+3]=g[f*3+r];a[h]=n[q];a[h+1]=n[q+1];a[h+2]=n[q+2];a[o]=d[q];a[o+1]=d[q+1];a[o+2]=d[q+2];}a[at+12]=iv[k];a[at+13]=iv[k+1];a[at+14]=iv[k+2];a[at+15]=frame.inverseAxes[f];a[at+16]=iv[k+3];a[at+17]=iv[k+4];a[at+18]=iv[k+5];}
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,textures[1]);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,width,h,gl.RGBA,gl.FLOAT,a);const error=gl.getError();if(error!==gl.NO_ERROR)throw Error('动作表面更新失败（WebGL '+error+'）');
 }
 `;
 text=replace(text,'function initialize(){',helper+'function initialize(){motionPreviewR37=false;motionShadowRendererR37=null;');
 text=replace(text,'originalRenderer.setDynamicShadowsR35(shadowRenderer.update(frame,lightingSettings,frameEpoch));','originalRenderer.setDynamicShadowsR35((motionPreviewR37&&motionShadowRendererR37?motionShadowRendererR37:shadowRenderer).update(frame,lightingSettings,frameEpoch));');
 const old="},appearance(value){mode=value==='normals'?2:value==='source-light'?5:value==='skin'?1:0;draw();}";
 const shadowKind=process.env.BODY_R37_TEST_DISABLE_REDUCER==='1'?'':',kind:"motion-r37"';
 const next="},setMotionFrameR37(next){if(lost)throw Error('画面正在恢复，动作暂时保留');const prior=frame,wasPreview=motionPreviewR37,same=prior.nodes===next.nodes&&prior.ids===next.ids&&prior.sourceMaterial===next.sourceMaterial&&prior.program.functions===next.program.functions;try{if(originalRenderer&&!motionShadowRendererR37){const profiles=originalSkin.pack.profiles.baseline.shadows.map(p=>({...p,width:Math.min(1024,p.width),height:Math.min(1024,p.height)}));motionShadowRendererR37=BodyDynamicShadowsR35.create(gl,{shader,textures,width,profiles,baseline:originalLighting"+shadowKind+"});}frame=next;motionPreviewR37=true;if(same)uploadMotionFrameR37();else uploadFrame();frameEpoch++;worldKey=null;worldData=null;draw();}catch(e){frame=prior;motionPreviewR37=wasPreview;uploadFrame();draw();throw e;}},endMotionPreviewR37(){motionPreviewR37=false;},appearance(value){mode=value==='normals'?2:value==='source-light'?5:value==='skin'?1:0;draw();}";
 text=replace(text,old,next.replaceAll('Math.min(1024,p.width)','Math.min('+shadowSize+',p.width)').replaceAll('Math.min(1024,p.height)','Math.min('+shadowSize+',p.height)'));
 text=replace(text,'return shadowRenderer.read(index);','return (motionPreviewR37&&motionShadowRendererR37?motionShadowRendererR37:shadowRenderer).read(index);');
 text=replace(text,'dynamicShadow:shadowRenderer?.report()||null','dynamicShadow:(motionPreviewR37&&motionShadowRendererR37?motionShadowRendererR37:shadowRenderer)?.report()||null');
 text=replace(text,'unknownPixelsRenderer?.close();shadowRenderer?.close();originalRenderer?.close();','unknownPixelsRenderer?.close();motionShadowRendererR37?.close();shadowRenderer?.close();originalRenderer?.close();');
 return text;
}
module.exports={patch};
