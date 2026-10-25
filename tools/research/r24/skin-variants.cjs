'use strict';
// Isolated arithmetic trials. Nothing here selects or certifies a product build.
exports.install=function(variant){
 const original=WebGL2RenderingContext.prototype.shaderSource;
 WebGL2RenderingContext.prototype.shaderSource=function(shader,text){
  if(text.includes('void originalBodyMain()')&&text.includes('ownQuadMode')){
   if(variant==='anchor-varyings'){
    const insertion=`
 if(ownQuadMode==1){
  ivec2 anchorPixel=ivec2(floor(gl_FragCoord.xy*.5)*2.)+ownParity;
  vec4 anchorWorld=texelFetch(ownWorld,ownAddress(anchorPixel),0),anchorNormal=texelFetch(ownNormal,ownAddress(anchorPixel),0),anchorSkin=texelFetch(ownSkin,ownAddress(anchorPixel),0);
  vec2 anchorUV=axis==0?anchorWorld.yz:axis==1?anchorWorld.zx:anchorWorld.xy,deltaUV=uv-anchorUV;
  vec3 anchorRaw=vec3(a.w*anchorUV.x+b.x*anchorUV.y+b.y,b.z*anchorUV.x+b.w*anchorUV.y+c.x,c.y*anchorUV.x+c.z*anchorUV.y+c.w);
  n=anchorNormal.xyz*length(anchorRaw)+vec3(a.w*deltaUV.x+b.x*deltaUV.y,b.z*deltaUV.x+b.w*deltaUV.y,c.y*deltaUV.x+c.z*deltaUV.y);
  rest=anchorSkin.xyz+vec3(sa.x*deltaUV.x+sa.y*deltaUV.y,sa.w*deltaUV.x+sb.x*deltaUV.y,sb.z*deltaUV.x+sb.w*deltaUV.y);
  dry=clamp(anchorSkin.w+sc.y*deltaUV.x+sc.z*deltaUV.y,0.,1.);
  palm=clamp(anchorNormal.w+dot(ownRecord(ownPalms,field).xy,deltaUV),0.,1.);
 }
`;
    if(!text.includes(' bool visible='))throw Error('Unexpected material adapter');
    text=text.replace(' bool visible=',insertion+' bool visible=');
   }else if(variant!=='control')throw Error('Unknown trial variant');
   window.__QA_VARIANT_SHADER__=text;
  }
  return original.call(this,shader,text);
 };
};
