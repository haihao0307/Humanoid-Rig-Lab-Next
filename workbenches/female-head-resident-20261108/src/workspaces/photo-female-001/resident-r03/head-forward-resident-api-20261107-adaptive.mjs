// Isolated candidate: original trimmed source planes, parameterized through
// the unchanged female forward function. Points cover conservative search
// supports only. They do not represent or display a character polygon mesh.
import {shapeInverseGLSL} from './shape-inverse-f32.mjs';
import {shapeForwardJacobianGLSL,oralForwardJacobianGLSL} from './shape-forward-jacobian-f32-20261107.mjs';
const root='/src/workspaces/photo-female-001/resident-r03/data/';
export async function createExperimentalHeadForwardResident(gl,{size=768,component=0}={}){
 if(![0,5,6,7].includes(component))throw Error('forward component unsupported');
 const prior=gl.getParameter(gl.VERTEX_ARRAY_BINDING),vao=gl.createVertexArray();gl.bindVertexArray(vao);
 const [vs,fixture,data]=await Promise.all([fetch(new URL('./head-forward-vs-20261107.txt',import.meta.url)).then(r=>r.text()),fetch(root+'full-inverse-fixture.json').then(r=>r.json()),fetch(root+(component?`oral-webgl-${component}-root.bin`:'local-plane-root-probe.bin')).then(r=>r.arrayBuffer())]);
 const helpers=shapeInverseGLSL(fixture.spec,fixture.shape);
 const fs=`#version 300 es
precision highp float;precision highp int;
flat in vec3 vMin,vMax;flat in vec4 vP0,vP1,vP2,vP3,vErr,vScreen;flat in uint vID;
flat in vec3 vSrcMin,vSrcMax;flat in vec4 vS0,vS1,vS2,vS3,vOrient;
uniform vec3 uEye,uR0,uR1,uR2,uPlaneOrigin;uniform vec2 uPP;uniform float uF,uPlaneT;
layout(location=0)out highp uvec4 result;
layout(location=1)out highp vec4 sourceResult;
layout(location=2)out highp vec4 jacobianResult0;
layout(location=3)out highp vec4 jacobianResult1;
${helpers}
${(component?oralForwardJacobianGLSL:shapeForwardJacobianGLSL)(fixture.shape)}
void main(){
 if(any(lessThan(gl_FragCoord.xy,vScreen.xy))||any(greaterThan(gl_FragCoord.xy,vScreen.zw)))discard;
 vec2 uv=(gl_FragCoord.xy-uPP)/uF;vec3 d=uR0*uv.x+uR1*uv.y+uR2;
 float lo=0.,hi=6000.;for(int k=0;k<3;k++){if(abs(d[k])<1e-20){if(uEye[k]<vMin[k]||uEye[k]>vMax[k])discard;}else{float aa=(vMin[k]-uEye[k])/d[k],bb=(vMax[k]-uEye[k])/d[k];lo=max(lo,min(aa,bb)-.002);hi=min(hi,max(aa,bb)+.002);}}if(lo>hi)discard;
 if(!isinf(vErr.x)&&!isnan(vErr.x)){
  float aa=vP0.x+dot(vP0.yzw,uEye),bb=dot(vP0.yzw,d),ee=vErr.x+.000001*(1.+abs(aa)+abs(bb*lo)+abs(bb*hi));
  if(abs(bb)>1e-20){float ta=(-ee-aa)/bb,tb=(ee-aa)/bb;lo=max(lo,min(ta,tb));hi=min(hi,max(ta,tb));if(lo>hi)discard;}else if(abs(aa)>ee)discard;
  vec4 pp[3]=vec4[3](vP1,vP2,vP3);for(int j=0;j<3;j++){float xx=pp[j].x+dot(pp[j].yzw,uEye),yy=dot(pp[j].yzw,d),minimum=min(xx+yy*lo,xx+yy*hi),guard=vErr[j+1]+.000001*(1.+abs(xx)+abs(yy*lo)+abs(yy*hi));if(minimum>guard)discard;}
 }
 vec3 center=(vSrcMin+vSrcMax)*.5,n=vS0.yzw;
 vec3 axis=abs(n.x)<abs(n.y)?(abs(n.x)<abs(n.z)?vec3(1,0,0):vec3(0,0,1)):(abs(n.y)<abs(n.z)?vec3(0,1,0):vec3(0,0,1));
 vec3 t1=normalize(cross(n,axis)),t2=normalize(cross(n,t1));
 vec3 q0=center-n*((${component?'vS0.x+dot(n,center)':'vS0.x'})/dot(n,n)),q=q0,world;mat3 jac;
 vec3 a=uR0-uv.x*uR2,b=uR1-uv.y*uR2;
 for(int i=0;i<3;i++){
  femaleForwardJacobian(q,world,jac);
  vec3 r=world-uPlaneOrigin-uPlaneT*(uR0*uv.x+uR1*uv.y);
  vec2 f=vec2(dot(a,r),dot(b,r));
  vec3 j1=jac*t1,j2=jac*t2;
  float aa=dot(a,j1),ab=dot(a,j2),ba=dot(b,j1),bb=dot(b,j2),det=aa*bb-ab*ba;
  if(abs(det)<1e-12)discard;
  vec2 delta=vec2(bb*f.x-ab*f.y,aa*f.y-ba*f.x)/det;
  q-=delta.x*t1+delta.y*t2;
 }
 femaleForwardJacobian(q,world,jac);
 vec3 residualVector=world-uPlaneOrigin-uPlaneT*(uR0*uv.x+uR1*uv.y);
 float residual=max(abs(dot(a,residualVector)),abs(dot(b,residualVector)));
 if(isnan(residual)||isinf(residual)||residual>.0002)discard;
 if(any(lessThan(q,vSrcMin-vec3(.0001)))||any(greaterThan(q,vSrcMax+vec3(.0001))))discard;
 vec4 Q=vec4(1,${component?'q':'q-center'});if(any(greaterThan(vec3(dot(vS1,Q),dot(vS2,Q),dot(vS3,Q)),vec3(0))))discard;
 vec3 c0=cross(jac[1],jac[2]),c1=cross(jac[2],jac[0]),c2=cross(jac[0],jac[1]);
 vec3 normal=(mat3(c0,c1,c2)*vOrient.yzw)/dot(jac[0],c0);
 if(dot(normal,d)>=0.)discard;
 float t=uPlaneT+dot(uR2,world-uPlaneOrigin);if(t<=0.||t>=6000.)discard;
 gl_FragDepth=t/6000.;result=uvec4(vID,floatBitsToUint(t),floatBitsToUint(residual),0u);sourceResult=vec4(q,jac[0].x);jacobianResult0=vec4(jac[1].x,jac[2].x,jac[0].y,jac[1].y);jacobianResult1=vec4(jac[2].y,1.,0.,0.);
}`;
 function shader(t,s){const x=gl.createShader(t);gl.shaderSource(x,s);gl.compileShader(x);if(!gl.getShaderParameter(x,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(x));return x;}
 const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vs));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
 const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
 for(const [name,n,offset]of [['aMin',3,0],['aMax',3,12],['aID',1,24],['aP0',4,28],['aP1',4,44],['aP2',4,60],['aP3',4,76],['aErr',4,92],['aSrcMin',3,108],['aSrcMax',3,120],['aS0',4,132],['aS1',4,148],['aS2',4,164],['aS3',4,180],['aOrient',4,196]]){const at=gl.getAttribLocation(program,name);if(at>=0){gl.enableVertexAttribArray(at);gl.vertexAttribPointer(at,n,gl.FLOAT,false,212,offset);}}
 const initialSize=size,banks=new Map();
 function makeBank(n){size=n;
 const f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);
 function texture(format){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texStorage2D(gl.TEXTURE_2D,1,format,size,size);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);return t;}
 const winner=texture(gl.RGBA32UI),source=texture(gl.RGBA32F),jacobian0=texture(gl.RGBA32F),jacobian1=texture(gl.RGBA32F),uncertain=texture(gl.RGBA32UI);
 gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,winner,0);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT1,gl.TEXTURE_2D,source,0);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT2,gl.TEXTURE_2D,jacobian0,0);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT3,gl.TEXTURE_2D,jacobian1,0);gl.drawBuffers([gl.COLOR_ATTACHMENT0,gl.COLOR_ATTACHMENT1,gl.COLOR_ATTACHMENT2,gl.COLOR_ATTACHMENT3]);
 const depth=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT32F,size,size);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depth);
 if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('forward MRT incomplete');

return {f,winner,source,jacobian0,jacobian1,uncertain,depth};}
 for(const n of [384,768])banks.set(n,makeBank(n));size=initialSize;
 let {f,winner,source,jacobian0,jacobian1,uncertain,depth}=banks.get(size);
 function selectOutputBank(n){if(!banks.has(n))throw Error('Output bank was not preallocated: '+n);size=n;({f,winner,source,jacobian0,jacobian1,uncertain,depth}=banks.get(n));}
 const maxPoint=gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1];gl.bindVertexArray(prior);
 return {get size(){return size;},selectOutputBank,outputBanks:[384,768],render(c){
  const old=gl.getParameter(gl.VERTEX_ARRAY_BINDING);gl.bindVertexArray(vao);gl.useProgram(program);gl.viewport(0,0,size,size);gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.drawBuffers([gl.COLOR_ATTACHMENT0,gl.COLOR_ATTACHMENT1,gl.COLOR_ATTACHMENT2,gl.COLOR_ATTACHMENT3]);gl.disable(gl.BLEND);gl.disable(gl.DITHER);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);gl.clearDepth(1);gl.clear(gl.DEPTH_BUFFER_BIT);gl.clearBufferuiv(gl.COLOR,0,new Uint32Array(4));gl.clearBufferfv(gl.COLOR,1,new Float32Array(4));gl.clearBufferfv(gl.COLOR,2,new Float32Array(4));gl.clearBufferfv(gl.COLOR,3,new Float32Array(4));
  for(const [u,v]of [['uEye',c.eyeNativeMM],['uR0',c.rotationCV[0]],['uR1',c.rotationCV[1]],['uR2',c.rotationCV[2]]])gl.uniform3fv(gl.getUniformLocation(program,u),v);
  const planeT=c.rotationCV[2].reduce((s,x,k)=>s+x*([0,294,20][k]-c.eyeNativeMM[k]),0),origin=c.eyeNativeMM.map((x,k)=>x+planeT*c.rotationCV[2][k]);
  gl.uniform3fv(gl.getUniformLocation(program,'uPlaneOrigin'),origin);gl.uniform1f(gl.getUniformLocation(program,'uPlaneT'),planeT);gl.uniform2fv(gl.getUniformLocation(program,'uPP'),c.principalPointPX);gl.uniform1f(gl.getUniformLocation(program,'uF'),c.focalPX);gl.uniform1f(gl.getUniformLocation(program,'uSize'),size);gl.uniform1f(gl.getUniformLocation(program,'uMaxPoint'),maxPoint);
  const start=performance.now();gl.drawArrays(gl.POINTS,0,data.byteLength/212);gl.readBuffer(gl.COLOR_ATTACHMENT0);gl.bindVertexArray(old);return{winner,source,jacobian0,jacobian1,uncertain,wallMS:performance.now()-start};
 },read(){const a=new Uint32Array(size*size*4),b=new Float32Array(size*size*4),j0=new Float32Array(size*size*4),j1=new Float32Array(size*size*4);gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.readBuffer(gl.COLOR_ATTACHMENT0);gl.readPixels(0,0,size,size,gl.RGBA_INTEGER,gl.UNSIGNED_INT,a);gl.readBuffer(gl.COLOR_ATTACHMENT1);gl.readPixels(0,0,size,size,gl.RGBA,gl.FLOAT,b);gl.readBuffer(gl.COLOR_ATTACHMENT2);gl.readPixels(0,0,size,size,gl.RGBA,gl.FLOAT,j0);gl.readBuffer(gl.COLOR_ATTACHMENT3);gl.readPixels(0,0,size,size,gl.RGBA,gl.FLOAT,j1);return{winner:a,source:b,jacobian0:j0,jacobian1:j1,uncertain:new Uint32Array(size*size*4)};}};
}
