/* Exact GPU reduction of unresolved shadow-query pixels.  This checks every
 * pixel while avoiding a full shadow-map transfer to the CPU on each frame. */
(()=>{'use strict';
const vertex=`#version 300 es
precision highp float;precision highp int;
uniform vec2 uSize;uniform int uColumns;uniform float uTile;
void main(){int x=gl_VertexID%uColumns,y=gl_VertexID/uColumns;vec2 origin=vec2(float(x),float(y))*uTile;vec2 c=origin+min(vec2(uTile),uSize-origin)*.5;gl_Position=vec4(c/uSize*2.-1.,0.,1.);gl_PointSize=uTile;}`;
const fragment=`#version 300 es
precision highp float;precision highp int;precision highp usampler2D;
uniform sampler2D uOriginal;uniform usampler2D uReduced;uniform ivec2 uInputSize;uniform bool uFirst;
layout(location=0)out uvec4 oCount;
void main(){ivec2 origin=ivec2(gl_FragCoord.xy)*4;uint count=0u;for(int y=0;y<4;y++)for(int x=0;x<4;x++){ivec2 p=origin+ivec2(x,y);if(any(greaterThanEqual(p,uInputSize)))continue;if(uFirst){ivec4 v=ivec4(floor(texelFetch(uOriginal,p,0)*255.+.5));if(all(equal(v,ivec4(255,0,255,0))))count++;}else count+=texelFetch(uReduced,p,0).r;}oCount=uvec4(count,0u,0u,0u);}`;
function create(gl){
 const compile=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('动态阴影检查编译失败：'+gl.getShaderInfoLog(s));return s;},vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment),program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('动态阴影检查链接失败：'+gl.getProgramInfoLog(program));gl.deleteShader(vs);gl.deleteShader(fs);
 const loc=Object.fromEntries(['uSize','uColumns','uTile','uOriginal','uReduced','uInputSize','uFirst'].map(k=>[k,gl.getUniformLocation(program,k)])),framebuffer=gl.createFramebuffer(),dummy=gl.createTexture(),levels=[];
 function allocate(texture,w,h){gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32UI,w,h,0,gl.RGBA_INTEGER,gl.UNSIGNED_INT,null);}
 allocate(dummy,1,1);gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,dummy,0);const framebufferStatus=gl.checkFramebufferStatus(gl.FRAMEBUFFER),error=gl.getError(),supported=framebufferStatus===gl.FRAMEBUFFER_COMPLETE&&error===gl.NO_ERROR;gl.bindFramebuffer(gl.FRAMEBUFFER,null);if(!supported){gl.deleteTexture(dummy);gl.deleteFramebuffer(framebuffer);gl.deleteProgram(program);throw Error('当前设备不支持阴影并行检查');}let closed=false;
 function check(maps,dimensions){if(closed)throw Error('动态阴影检查已关闭');let total=0;gl.useProgram(program);gl.uniform1i(loc.uOriginal,0);gl.uniform1i(loc.uReduced,1);gl.disable(gl.BLEND);gl.disable(gl.DITHER);gl.disable(gl.DEPTH_TEST);gl.disable(gl.SCISSOR_TEST);gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.drawBuffers([gl.COLOR_ATTACHMENT0]);const tile=Math.min(64,gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1]);
  for(let map=0;map<maps.length;map++){let [w,h]=dimensions[map],previous=dummy,index=0;gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,maps[map]);do{const nw=Math.ceil(w/4),nh=Math.ceil(h/4);let level=levels[index];if(!level){level={texture:gl.createTexture(),w:0,h:0};levels[index]=level;}gl.activeTexture(gl.TEXTURE2);if(level.w!==nw||level.h!==nh){allocate(level.texture,nw,nh);level.w=nw;level.h=nh;}gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,level.texture,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('动态阴影检查画布不可用');gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,previous);gl.viewport(0,0,nw,nh);gl.uniform2f(loc.uSize,nw,nh);gl.uniform1i(loc.uColumns,Math.ceil(nw/tile));gl.uniform1f(loc.uTile,tile);gl.uniform2i(loc.uInputSize,w,h);gl.uniform1i(loc.uFirst,index===0?1:0);gl.drawArrays(gl.POINTS,0,Math.ceil(nw/tile)*Math.ceil(nh/tile));previous=level.texture;w=nw;h=nh;index++;}while(w>1||h>1);const result=new Uint32Array(4);gl.readPixels(0,0,1,1,gl.RGBA_INTEGER,gl.UNSIGNED_INT,result);total+=result[0];}
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);return total;
 }
 return{check,close(){closed=true;for(const level of levels)gl.deleteTexture(level.texture);gl.deleteTexture(dummy);gl.deleteFramebuffer(framebuffer);gl.deleteProgram(program);}};
}
globalThis.BodyShadowValidationR37={create};
})();
