/* V7: independent finite-width shafts. No scalp shell or coverage atlas.
 * Only 32 vec4 motion records stream to the GPU; rest geometry is immutable. */
const HAIR_VS=`#version 300 es
precision highp float;
layout(location=0) in vec3 position;
layout(location=1) in vec3 normal;
layout(location=2) in vec3 tangent;
layout(location=3) in vec2 uv;
layout(location=4) in vec2 variation;
layout(location=5) in vec4 pivotAngle;
layout(location=6) in float motionGroup;
uniform mat4 viewProjection;
uniform mat4 headMatrix;
uniform highp sampler2D groupMotion;
out vec3 worldPoint;
out vec3 strandTangent;
out vec3 surfaceNormal;
out vec2 hairUV;
flat out vec2 fiberInfo;
vec3 rotateHair(vec3 v,vec3 axis,float angle){
 return v*cos(angle)+cross(axis,v)*sin(angle)+axis*dot(axis,v)*(1.-cos(angle));
}
void main(){
 vec3 p=position,T=tangent,N=normal;
 if(pivotAngle.w>0.){
  vec3 drive=texelFetch(groupMotion,ivec2(int(motionGroup+.5),0),0).xyz/.003;
  float amplitude=length(drive);
  if(amplitude>1.e-7){
   vec3 axis=drive/amplitude;float angle=pivotAngle.w*min(amplitude,1.);
   p=pivotAngle.xyz+rotateHair(position-pivotAngle.xyz,axis,angle);
   T=rotateHair(T,axis,angle);N=rotateHair(N,axis,angle);
  }
 }
 vec4 world=headMatrix*vec4(p,1.);
 worldPoint=world.xyz;strandTangent=normalize(mat3(headMatrix)*T);
 surfaceNormal=normalize(mat3(headMatrix)*N);hairUV=uv;fiberInfo=variation;
 gl_Position=viewProjection*world;
}`;
const HAIR_FS=`#version 300 es
precision highp float;
in vec3 worldPoint;
in vec3 strandTangent;
in vec3 surfaceNormal;
in vec2 hairUV;
flat in vec2 fiberInfo;
uniform vec3 eye;
out vec4 fragColor;
void main(){
 vec3 T=normalize(strandTangent),N=normalize(surfaceNormal),L=normalize(vec3(-.4,.8,.5)),V=normalize(eye-worldPoint),H=normalize(L+V);
 float diffuse=sqrt(max(0.,1.-pow(dot(T,L),2.)));
 // Two inexpensive longitudinal lobes; not a full Marschner scattering model.
 float primary=pow(max(0.,1.-pow(clamp(dot(T,H)+.08,-1.,1.),2.)),55.);
 float secondary=pow(max(0.,1.-pow(clamp(dot(T,H)-.12,-1.,1.),2.)),18.);
 float shade=fiberInfo.y>3.5?.75:clamp(fiberInfo.x,.4,1.);
 vec3 base=vec3(.025,.013,.006)*(.70+.30*shade);
 vec3 colour=base*(.60+.40*diffuse)*(.75+.25*max(0.,dot(N,L)))+vec3(.045,.030,.018)*primary*.30+vec3(.020,.009,.003)*secondary*.18;
 fragColor=vec4(pow(colour/(vec3(1.)+colour),vec3(1./2.2)),1.);
}`;
class HairRenderer{
 constructor(hair,gl){
  this.hair=hair;this.gl=gl;this.shader=program(gl,HAIR_VS,HAIR_FS);this.u={};this.buffers=[];
  for(const name of ['viewProjection','headMatrix','eye','groupMotion'])this.u[name]=gl.getUniformLocation(this.shader.p,name);
  this.motionTexture=gl.createTexture();gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D,this.motionTexture);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,HAIR_SPEC.motionGroups,1,0,gl.RGBA,gl.FLOAT,hair.motion);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.activeTexture(gl.TEXTURE0);
  this.motionRevision=-1;this.rebuild();
 }
 rebuild(){
  const gl=this.gl,g=this.hair.geometry;for(const b of this.buffers)gl.deleteBuffer(b);this.buffers=[];
  if(this.vao)gl.deleteVertexArray(this.vao);this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);
  for(const [location,data,size]of [[0,g.p,3],[1,g.n,3],[2,g.t,3],[3,g.uv,2],[4,g.meta,2],[5,g.pivots,4],[6,g.groups,1]]){
   const b=gl.createBuffer();this.buffers.push(b);gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,0,0);
  }
  this.index=gl.createBuffer();this.buffers.push(this.index);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.index);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,g.near,gl.STATIC_DRAW);gl.bindVertexArray(null);this.motionRevision=-1;
 }
 draw(renderer,depthOnly=false){
  const h=this.hair;if(depthOnly||(!h.enabled&&!h.browIndexCount))return;
  const gl=this.gl,u=this.u,f=h.headFrame();
  gl.disable(gl.BLEND);gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.disable(gl.CULL_FACE);
  gl.useProgram(this.shader.p);gl.uniformMatrix4fv(u.viewProjection,false,renderer.vp);gl.uniformMatrix4fv(u.headMatrix,false,matrix(f.p,f.q));gl.uniform3fv(u.eye,renderer.eye);
  gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D,this.motionTexture);gl.uniform1i(u.groupMotion,4);
  if(this.motionRevision!==h.motionRevision){gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,HAIR_SPEC.motionGroups,1,gl.RGBA,gl.FLOAT,h.motion);this.motionRevision=h.motionRevision;}
  gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.index);
  gl.drawElements(gl.TRIANGLES,h.enabled?h.geometry.near.length:h.browIndexCount,gl.UNSIGNED_INT,h.enabled?0:h.browIndexOffset*4);
  gl.bindVertexArray(null);gl.activeTexture(gl.TEXTURE0);h.dirty=false;renderer.drawCalls++;
 }
 dispose(){const gl=this.gl;for(const b of this.buffers)gl.deleteBuffer(b);gl.deleteVertexArray(this.vao);gl.deleteTexture(this.motionTexture);gl.deleteProgram(this.shader.p);}
}
