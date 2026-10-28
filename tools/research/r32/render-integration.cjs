'use strict';
// Keep R31 renderers intact and explicitly apply the R32 display-only changes.
// Each anchor is checked so an upstream change cannot silently skip a surface.
function replace(text,from,to,count=1){
  const found=text.split(from).length-1;
  if(found!==count)throw Error('R32 renderer anchor mismatch: expected '+count+', got '+found+' for '+from.slice(0,110));
  return text.split(from).join(to);
}
const resized='function resize(){const [width,height]=BodyEdgeAA32.size(canvas);if(canvas.width===width&&canvas.height===height)return;canvas.width=width;canvas.height=height;draw();}';
function skin(text){
  text=replace(text,'function create(gl,canvas,pack,atlas,geometry,initialProfile,environment){','function create(gl,canvas,pack,atlas,geometry,initialProfile,environment){const edgeAA=BodyEdgeAA32.create(gl,canvas);');
  text=replace(text,"gl.uniform1f(gl.getUniformLocation(compose,'toneMappingExposure'),lightSettingsR26.exposure??environment.exposure);draw();}","gl.uniform1f(gl.getUniformLocation(compose,'toneMappingExposure'),lightSettingsR26.exposure??environment.exposure);draw();edgeAA.apply();}");
  return replace(text,'report:()=>({sourceActiveBodyMaterial:true','report:()=>({edgeAntialiasing:edgeAA.report(),sourceActiveBodyMaterial:true');
}
function source(text){
  text=replace(text,"if(!gl)throw Error('当前设备未提供所需的三维显示能力');","if(!gl)throw Error('当前设备未提供所需的三维显示能力');const edgeAA=BodyEdgeAA32.create(gl,canvas);");
  text=replace(text,'gl.drawArrays(gl.POINTS,0,columns*Math.ceil(canvas.height/tile));draws++;if(own&&diagnostic===12)own.render','gl.drawArrays(gl.POINTS,0,columns*Math.ceil(canvas.height/tile));draws++;if(!(own&&diagnostic===12)&&!probing)edgeAA.apply();if(own&&diagnostic===12)own.render');
  text=replace(text,'function resize(){const aspect=canvas.clientWidth/Math.max(1,canvas.clientHeight);canvas.width=Math.max(1,Math.min(1000,Math.round(canvas.clientWidth)));canvas.height=Math.max(1,Math.round(canvas.width/aspect));draw();}',resized);
  return replace(text,"report:()=>({schema:'body-source-atlas-ray/1'","report:()=>({edgeAntialiasing:own&&diagnostic===12?own.report().edgeAntialiasing:edgeAA.report(),schema:'body-source-atlas-ray/1'");
}
function precision(text){
  text=replace(text,'let gl=null,environmentBinding=null;','let gl=null,environmentBinding=null,edgeAA=null;');
  text=replace(text,"if(!gl)throw Error('精确核对的材质显示不可用');","if(!gl)throw Error('精确核对的材质显示不可用');edgeAA=BodyEdgeAA32.create(gl,overlay);");
  text=replace(text,"gl.drawArrays(gl.POINTS,0,columns*Math.ceil(height/tile));if(gl.getError()!==gl.NO_ERROR)throw Error('精确画面的材质未能完整生成');","gl.drawArrays(gl.POINTS,0,columns*Math.ceil(height/tile));edgeAA.apply();if(gl.getError()!==gl.NO_ERROR)throw Error('精确画面的材质未能完整生成');");
  text=replace(text,'gl.drawArrays(gl.POINTS,0,columns*Math.ceil(lastFrame.height/tile));if(gl.getError()!==gl.NO_ERROR)', 'gl.drawArrays(gl.POINTS,0,columns*Math.ceil(lastFrame.height/tile));edgeAA.apply();if(gl.getError()!==gl.NO_ERROR)');
  text=replace(text,'gl.uniform1i(loc.diagnostic,lastFrame.mode);gl.drawArrays(gl.POINTS,0,columns*Math.ceil(height/tile));return{width,height,colour,mask};','gl.uniform1i(loc.diagnostic,lastFrame.mode);gl.drawArrays(gl.POINTS,0,columns*Math.ceil(height/tile));edgeAA.apply();return{width,height,colour,mask};');
  return replace(text,'close(){lastParts=null;','close(){edgeAA?.close();lastParts=null;');
}
function pose(text){
  text=replace(text,'let gl=null,shader=null,','let gl=null,shader=null,edgeAA=null,');
  text=replace(text,"if(!gl)throw Error('这个设备未提供所需的三维显示能力');","if(!gl)throw Error('这个设备未提供所需的三维显示能力');edgeAA=BodyEdgeAA32.create(gl,canvas);");
  text=replace(text,'gl.drawArrays(gl.POINTS,0,columns*Math.ceil(canvas.height/tile));draws++;if(!probing','gl.drawArrays(gl.POINTS,0,columns*Math.ceil(canvas.height/tile));if(!probing)edgeAA.apply();draws++;if(!probing');
  text=replace(text,'function resize(){const ratio=canvas.clientWidth/Math.max(1,canvas.clientHeight);canvas.width=Math.max(1,Math.min(1000,Math.round(canvas.clientWidth)));canvas.height=Math.max(1,Math.round(canvas.width/ratio));draw();}',resized);
  text=replace(text,'mode=previous;tile=previousTile;draw();probing=false;','mode=previous;tile=previousTile;probing=false;draw();');
  text=replace(text,'report:()=>({ready:!lost,','report:()=>({edgeAntialiasing:edgeAA?.report(),ready:!lost,');
  text=replace(text,"if(gl.getError()!==gl.NO_ERROR)throw Error('连续函数显示数据未完整载入');","const uploadError=gl.getError();if(uploadError!==gl.NO_ERROR)throw Error('连续函数显示数据未完整载入（WebGL '+uploadError+'）');");
  return replace(text,'if(!lost){for(const t of textures)gl.deleteTexture(t);','if(!lost){edgeAA?.close();for(const t of textures)gl.deleteTexture(t);');
}
function adaptive(text){
  text=replace(text,"if(!gl)throw Error('浏览器不支持当前的三维求交显示');","if(!gl)throw Error('浏览器不支持当前的三维求交显示');const edgeAA=BodyEdgeAA32.create(gl,canvas);",2);
  text=replace(text,'gl.drawArrays(gl.POINTS,0,columns*Math.ceil(h/tile));draws++;','gl.drawArrays(gl.POINTS,0,columns*Math.ceil(h/tile));if(!probeDepth)edgeAA.apply();draws++;',2);
  text=replace(text,'function resize(){const width=Math.max(1,Math.min(1152,Math.round(canvas.clientWidth))),height=Math.max(1,Math.round(width*canvas.clientHeight/Math.max(1,canvas.clientWidth)));if(canvas.width===width&&canvas.height===height)return;canvas.width=width;canvas.height=height;if(current)draw();}','function resize(){const [width,height]=BodyEdgeAA32.size(canvas);if(canvas.width===width&&canvas.height===height)return;canvas.width=width;canvas.height=height;if(current)draw();}',2);
  text=replace(text,'close(){if(lifetimeClosed)return;lifetimeClosed=true;','close(){if(lifetimeClosed)return;edgeAA.close();lifetimeClosed=true;',2);
  text=replace(text,"report:()=>({version:'BODY-RAY-LOSSLESS-TRANSPORT-R22'","report:()=>({edgeAntialiasing:edgeAA.report(),version:'BODY-RAY-LOSSLESS-TRANSPORT-R22'");
  return replace(text,"report:()=>({version:'BODY-RAY-LOSSLESS-GPU-SCALAR-R24'","report:()=>({edgeAntialiasing:edgeAA.report(),version:'BODY-RAY-LOSSLESS-GPU-SCALAR-R24'");
}
module.exports={replace,skin,source,precision,pose,adaptive};
