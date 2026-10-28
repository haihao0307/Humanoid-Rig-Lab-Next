/* Display-only edge antialiasing for directly intersected body surfaces.
 * The surface, intersection, material inputs and person parameters are unchanged.
 * A single fullscreen compositor samples a copy of the finished colour buffer;
 * its screen triangle is not a character mesh. */
(()=>{'use strict';
const vertex=`#version 300 es
precision highp float;
void main(){
  vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));
  gl_Position=vec4(p*2.-1.,0.,1.);
}`;
const fragment=`#version 300 es
precision highp float;
uniform sampler2D picture;
uniform vec2 resolution;
out vec4 colour;
vec4 premul(vec2 uv){vec4 c=texture(picture,uv);return vec4(c.rgb*c.a,c.a);}
float luminance(vec4 c){return dot(c.rgb,vec3(.299,.587,.114));}
void main(){
  vec2 uv=gl_FragCoord.xy/resolution, px=1./resolution;
  vec4 m=premul(uv),nw=premul(uv+px*vec2(-1.,1.)),ne=premul(uv+px),
       sw=premul(uv-px),se=premul(uv+px*vec2(1.,-1.));
  float lm=luminance(m),lnw=luminance(nw),lne=luminance(ne),
        lsw=luminance(sw),lse=luminance(se);
  float low=min(lm,min(min(lnw,lne),min(lsw,lse)));
  float high=max(lm,max(max(lnw,lne),max(lsw,lse)));
  if(high-low<max(.025,high*.10)){colour=vec4(m.rgb/max(m.a,.000001),m.a);return;}
  vec2 dir=vec2(-((lnw+lne)-(lsw+lse)),(lnw+lsw)-(lne+lse));
  float reduce=max((lnw+lne+lsw+lse)*(.25*.125),1./128.);
  dir=clamp(dir/(min(abs(dir.x),abs(dir.y))+reduce),vec2(-8.),vec2(8.))*px;
  vec4 a=.5*(premul(uv+dir*(1./3.-.5))+premul(uv+dir*(2./3.-.5)));
  vec4 b=.5*a+.25*(premul(uv-dir*.5)+premul(uv+dir*.5));
  float lb=luminance(b);vec4 result=(lb<low||lb>high)?a:b;
  colour=vec4(result.rgb/max(result.a,.000001),result.a);
}`;

function size(canvas){
  const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);
  const scale=Math.min(2,Math.max(1,window.devicePixelRatio||1))*1.25;
  const targetW=w*scale,targetH=h*scale,maxPixels=1500000,maxSide=1920;
  const cap=Math.min(1,maxSide/targetW,maxSide/targetH,Math.sqrt(maxPixels/(targetW*targetH)));
  return [Math.max(1,Math.round(targetW*cap)),Math.max(1,Math.round(targetH*cap))];
}
function create(gl,canvas){
  const compile=(type,text)=>{const s=gl.createShader(type);gl.shaderSource(s,text);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('身体轮廓抗锯齿：'+gl.getShaderInfoLog(s));return s;};
  const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment),program=gl.createProgram();
  gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('身体轮廓抗锯齿：'+gl.getProgramInfoLog(program));
  gl.deleteShader(vs);gl.deleteShader(fs);
  const vao=gl.createVertexArray(),texture=gl.createTexture(),resolution=gl.getUniformLocation(program,'resolution'),picture=gl.getUniformLocation(program,'picture');
  // WebGL forbids copying an opaque RGB drawing buffer into an RGBA texture.
  const opaque=gl.getContextAttributes()?.alpha===false;
  let width=0,height=0,frames=0;
  function apply(){
    if(globalThis.__BODY_EDGE_AA_DISABLED__===true||gl.isContextLost()||!canvas.width||!canvas.height||gl.getParameter(gl.FRAMEBUFFER_BINDING)!==null)return false;
    const old={program:gl.getParameter(gl.CURRENT_PROGRAM),vao:gl.getParameter(gl.VERTEX_ARRAY_BINDING),active:gl.getParameter(gl.ACTIVE_TEXTURE),viewport:gl.getParameter(gl.VIEWPORT),mask:gl.getParameter(gl.COLOR_WRITEMASK),depth:gl.isEnabled(gl.DEPTH_TEST),blend:gl.isEnabled(gl.BLEND),scissor:gl.isEnabled(gl.SCISSOR_TEST),cull:gl.isEnabled(gl.CULL_FACE)};
    gl.activeTexture(gl.TEXTURE0);old.texture=gl.getParameter(gl.TEXTURE_BINDING_2D);gl.bindTexture(gl.TEXTURE_2D,texture);
    if(width!==canvas.width||height!==canvas.height){
      width=canvas.width;height=canvas.height;
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D,0,opaque?gl.RGB8:gl.RGBA8,width,height,0,opaque?gl.RGB:gl.RGBA,gl.UNSIGNED_BYTE,null);
    }
    gl.copyTexSubImage2D(gl.TEXTURE_2D,0,0,0,0,0,width,height);
    gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.disable(gl.SCISSOR_TEST);gl.disable(gl.CULL_FACE);gl.colorMask(true,true,true,true);
    gl.viewport(0,0,width,height);gl.bindVertexArray(vao);gl.useProgram(program);gl.uniform2f(resolution,width,height);gl.uniform1i(picture,0);gl.drawArrays(gl.TRIANGLES,0,3);
    gl.bindVertexArray(old.vao);gl.useProgram(old.program);gl.viewport(...old.viewport);gl.colorMask(...old.mask);
    for(const [flag,enabled] of [[gl.DEPTH_TEST,old.depth],[gl.BLEND,old.blend],[gl.SCISSOR_TEST,old.scissor],[gl.CULL_FACE,old.cull]])enabled?gl.enable(flag):gl.disable(flag);
    gl.bindTexture(gl.TEXTURE_2D,old.texture);gl.activeTexture(old.active);frames++;
    return true;
  }
  return{apply,report:()=>({enabled:true,method:'edge-aware colour filter',frames,width,height}),close(){gl.deleteTexture(texture);gl.deleteVertexArray(vao);gl.deleteProgram(program);}};
}
globalThis.BodyEdgeAA32={create,size};
})();
