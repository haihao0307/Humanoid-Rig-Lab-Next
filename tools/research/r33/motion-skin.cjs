'use strict';
// During camera motion, shade mixed surface quads with the same derivative
// neighbourhood as the later high-quality frame. Uniform quads use the fast
// original pass. This affects display shading only, not the body surface.
const {replace}=require('../r32/render-integration.cjs');
function skin(text){
  text=replace(text,'uniform int ownQuadMode,ownFlip;','uniform int ownQuadMode,ownFlip,ownBoundaryOnly;',2);
  const oldVertex='if(any(greaterThanEqual(q,ownSize)))ownFlatCode=0;else{if(ownFlip==1)q.y=ownSize.y-1-q.y;ownFlatCode=int(texelFetch(ownWorld,q,0).w+.5);}}else{';
  const newVertex=`if(any(greaterThanEqual(q,ownSize)))ownFlatCode=0;else{if(ownFlip==1)q.y=ownSize.y-1-q.y;ownFlatCode=int(texelFetch(ownWorld,q,0).w+.5);}
if(ownBoundaryOnly==1){if(ownFlatCode==0){gl_Position=vec4(2.,2.,2.,1.);return;}ivec2 m=ownSize-ivec2(1),a=min(base,m),b=min(base+ivec2(1,0),m),c=min(base+ivec2(0,1),m),d=min(base+ivec2(1,1),m);if(ownFlip==1){a.y=m.y-a.y;b.y=m.y-b.y;c.y=m.y-c.y;d.y=m.y-d.y;}int c0=int(texelFetch(ownWorld,a,0).w+.5),c1=int(texelFetch(ownWorld,b,0).w+.5),c2=int(texelFetch(ownWorld,c,0).w+.5),c3=int(texelFetch(ownWorld,d,0).w+.5);bool skip=c0==c1&&c0==c2&&c0==c3;if(skip){gl_Position=vec4(2.,2.,2.,1.);return;}}}else{`;
  text=replace(text,oldVertex,newVertex);
  text=replace(text,"gl.uniform1i(gl.getUniformLocation(skin,'ownQuadMode'),precise?1:0);","gl.uniform1i(gl.getUniformLocation(skin,'ownQuadMode'),precise===true?1:0);gl.uniform1i(gl.getUniformLocation(skin,'ownBoundaryOnly'),0);");
  const old="if(precise){for(let y=0;y<2;y++)for(let x=0;x<2;x++){gl.uniform2i(gl.getUniformLocation(skin,'ownParity'),x,y);gl.drawArrays(gl.POINTS,0,Math.ceil(size[0]/2)*Math.ceil(size[1]/2));draws++;}}else{gl.drawArrays(gl.POINTS,0,Math.ceil(size[0]/tile)*Math.ceil(size[1]/tile));draws++;}";
  const next="if(precise===true){for(let y=0;y<2;y++)for(let x=0;x<2;x++){gl.uniform2i(gl.getUniformLocation(skin,'ownParity'),x,y);gl.drawArrays(gl.POINTS,0,Math.ceil(size[0]/2)*Math.ceil(size[1]/2));draws++;}}else if(precise===2){gl.uniform1i(gl.getUniformLocation(skin,'ownQuadMode'),0);gl.drawArrays(gl.POINTS,0,Math.ceil(size[0]/tile)*Math.ceil(size[1]/tile));draws++;gl.uniform1i(gl.getUniformLocation(skin,'ownQuadMode'),1);gl.uniform1i(gl.getUniformLocation(skin,'ownBoundaryOnly'),1);for(let y=0;y<2;y++)for(let x=0;x<2;x++){gl.uniform2i(gl.getUniformLocation(skin,'ownParity'),x,y);gl.drawArrays(gl.POINTS,0,Math.ceil(size[0]/2)*Math.ceil(size[1]/2));draws++;}gl.uniform1i(gl.getUniformLocation(skin,'ownBoundaryOnly'),0);}else{gl.drawArrays(gl.POINTS,0,Math.ceil(size[0]/tile)*Math.ceil(size[1]/tile));draws++;}";
  text=replace(text,old,next);
  return replace(text,'report:()=>({edgeAntialiasing:edgeAA.report(),','report:()=>({motionShading:lastPrecise===2?\'boundary-consistent\':lastPrecise===true?\'full-precision\':\'basic\',edgeAntialiasing:edgeAA.report(),');
}
function source(text){return replace(text,'own.render({textures:surfaceTextures,flip:0},camera,false)','own.render({textures:surfaceTextures,flip:0},camera,2)');}
module.exports={skin,source};
