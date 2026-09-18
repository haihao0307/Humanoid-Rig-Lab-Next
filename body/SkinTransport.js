/* Authored screen-space skin diffusion. Only diffuse radiance is transported;
 * the surface reflection, eyes, lips, hair and scene remain in the base image.
 * Method references: GPU Gems 3 ch.14; Jimenez et al., Separable SSS (2015).
 * This is our bounded approximation, not either paper's implementation, a
 * measured skin profile, volumetric transport, or off-screen transmission. */
const SKIN_TRANSPORT=Object.freeze({revision:'r20-separated-skin-diffusion',
 offsetsM:[-.003,-.002,-.0013,-.0008,-.0004,-.00015,0,.00015,.0004,.0008,.0013,.002,.003],
 narrowSigmaM:[.00016,.00012,.00010],wideSigmaM:[.00125,.00055,.00030],
 wideWeight:[.45,.28,.16],maximumSamples:4,authoredProfile:true});
function skinDiffusionKernel(){
 const p=SKIN_TRANSPORT,weights=p.offsetsM.map((r,i)=>{
  const width=i===0?(p.offsetsM[1]-r)*.5:i===12?(r-p.offsetsM[11])*.5:(p.offsetsM[i+1]-p.offsetsM[i-1])*.5;
  return [0,1,2].map(c=>{const a=p.narrowSigmaM[c],b=p.wideSigmaM[c],w=p.wideWeight[c];
   return width*((1-w)*Math.exp(-.5*(r/a)**2)/a+w*Math.exp(-.5*(r/b)**2)/b);});
 });
 const sums=[0,1,2].map(c=>weights.reduce((sum,w)=>sum+w[c],0));
 return weights.map(w=>w.map((v,c)=>v/sums[c]));
}
const SKIN_SCREEN_VERTEX=`#version 300 es
out vec2 uv;
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);uv=p;gl_Position=vec4(p*2.-1.,0.,1.);}`;
function skinDiffusionShader(){
 const offsets=SKIN_TRANSPORT.offsetsM.map(v=>v.toFixed(7)).join(','),weights=skinDiffusionKernel().map(w=>'vec3('+w.map(v=>v.toFixed(9)).join(',')+')').join(',');
 return `#version 300 es
precision highp float;
in vec2 uv;out vec4 frag;
uniform sampler2D image,original,material;
uniform vec2 axisScale;uniform float perspectiveMode;
const float offsetM[13]=float[13](${offsets});
const vec3 weight[13]=vec3[13](${weights});
void main(){
 vec4 centre=texture(original,uv);if(centre.a<.0001){frag=vec4(0.);return;}
 float depth=texture(material,uv).a/centre.a;
 vec4 initial=texture(image,uv);vec3 value=initial.rgb/max(initial.a,.0001),sum=vec3(0.);
 vec2 scale=axisScale/mix(1.,max(depth,.015),perspectiveMode);
 for(int i=0;i<13;i++){
  vec2 q=uv+offsetM[i]*scale;vec4 m=texture(original,q),sampleValue=texture(image,q);
  float qDepth=texture(material,q).a/max(m.a,.0001);
  // Reject holes, other materials and surfaces separated in view depth.
  // Invalid neighbours contribute the centre, conserving constant light.
  float gate=step(.0001,m.a)*(1.-smoothstep(.0006+abs(offsetM[i])*.5,.0012+abs(offsetM[i])*2.,abs(depth-qDepth)));
  gate*=step(0.,q.x)*step(q.x,1.)*step(0.,q.y)*step(q.y,1.);
  sum+=mix(value,sampleValue.rgb/max(sampleValue.a,.0001),gate)*weight[i];
 }
 frag=vec4(sum*centre.a,centre.a);
}`;
}
const SKIN_COMPOSITE_FRAGMENT=`#version 300 es
precision highp float;
in vec2 uv;out vec4 frag;
uniform sampler2D base,original,filtered,material;
vec3 display(vec3 c){c=max(c,vec3(0.));c=c/(1.+.25*c);return mix(12.92*c,1.055*pow(c,vec3(1./2.4))-.055,step(vec3(.0031308),c));}
void main(){
 vec4 source=texture(base,uv),diffuse=texture(original,uv);float amount=diffuse.a;
 if(amount<.0001){frag=source;return;}
 vec3 oldLight=diffuse.rgb/amount,residual=texture(material,uv).rgb/amount;
 vec4 blur=texture(filtered,uv);vec3 newLight=blur.rgb/max(blur.a,.0001);
 // Apply a linear-light diffuse change using the exact display transform.
 // The original AA coverage and specular image are retained; no inverse
 // tone mapping, whole-image blur, bloom, or camera-dependent colour noise.
 vec3 delta=display(residual+newLight)-display(residual+oldLight);
 frag=vec4(clamp(source.rgb+amount*delta,0.,1.),source.a);
}`;
class SkinTransport {
 constructor(gl){
  this.gl=gl;this.available=!!gl.getExtension('EXT_color_buffer_float');this.active=false;this.targets=null;this.failure=null;
  if(!this.available){this.failure='float colour buffers unavailable';return;}
  const compile=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const info=gl.getShaderInfoLog(s);gl.deleteShader(s);throw Error(info);}return s;};
  const make=fragment=>{const p=gl.createProgram(),vs=compile(gl.VERTEX_SHADER,SKIN_SCREEN_VERTEX),fs=compile(gl.FRAGMENT_SHADER,fragment);gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return {p,u:Object.fromEntries(['image','original','material','axisScale','perspectiveMode','base','filtered'].map(k=>[k,gl.getUniformLocation(p,k)]))};};
  this.blur=make(skinDiffusionShader());this.composite=make(SKIN_COMPOSITE_FRAGMENT);this.vao=gl.createVertexArray();
 }
 release(){if(!this.targets)return;const g=this.gl,t=this.targets;for(const f of t.fbos)g.deleteFramebuffer(f);for(const b of t.renderbuffers)g.deleteRenderbuffer(b);for(const texture of t.textures)g.deleteTexture(texture);this.targets=null;}
 allocate(w,h){
  if(this.targets?.w===w&&this.targets?.h===h)return;
  this.release();const g=this.gl,t={w,h,fbos:[],renderbuffers:[],textures:[],colours:[],temporary:[]};this.targets=t;
  const formats=[g.RGBA8,g.RGBA16F,g.RGBA16F],supported=[...g.getInternalformatParameter(g.RENDERBUFFER,g.RGBA16F,g.SAMPLES)];
  const cap=w*h>2500000?2:SKIN_TRANSPORT.maximumSamples;
  t.samples=Math.max(0,...supported.filter(s=>s<=cap&&[g.RGBA8,g.DEPTH_COMPONENT24].every(format=>[...g.getInternalformatParameter(g.RENDERBUFFER,format,g.SAMPLES)].includes(s))));
  const fbo=()=>{const f=g.createFramebuffer();t.fbos.push(f);g.bindFramebuffer(g.FRAMEBUFFER,f);return f;};
  const texture=(format,index)=>{const x=g.createTexture();t.textures.push(x);g.bindTexture(g.TEXTURE_2D,x);g.texStorage2D(g.TEXTURE_2D,1,format,w,h);for(const p of [g.TEXTURE_MIN_FILTER,g.TEXTURE_MAG_FILTER])g.texParameteri(g.TEXTURE_2D,p,g.LINEAR);for(const p of [g.TEXTURE_WRAP_S,g.TEXTURE_WRAP_T])g.texParameteri(g.TEXTURE_2D,p,g.CLAMP_TO_EDGE);g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0+index,g.TEXTURE_2D,x,0);return x;};
  const check=()=>{if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE)throw Error('Skin transport framebuffer incomplete');};
  t.resolve=fbo();formats.forEach((format,i)=>t.colours.push(texture(format,i)));g.drawBuffers([g.COLOR_ATTACHMENT0,g.COLOR_ATTACHMENT1,g.COLOR_ATTACHMENT2]);check();
  t.scene=fbo();for(const [i,format] of [...formats,g.DEPTH_COMPONENT24].entries()){
   const b=g.createRenderbuffer();t.renderbuffers.push(b);g.bindRenderbuffer(g.RENDERBUFFER,b);
   if(t.samples)g.renderbufferStorageMultisample(g.RENDERBUFFER,t.samples,format,w,h);else g.renderbufferStorage(g.RENDERBUFFER,format,w,h);
   g.framebufferRenderbuffer(g.FRAMEBUFFER,i===3?g.DEPTH_ATTACHMENT:g.COLOR_ATTACHMENT0+i,g.RENDERBUFFER,b);
  }g.drawBuffers([g.COLOR_ATTACHMENT0,g.COLOR_ATTACHMENT1,g.COLOR_ATTACHMENT2]);check();
  for(let i=0;i<2;i++){const f=fbo(),x=texture(g.RGBA16F,0);g.drawBuffers([g.COLOR_ATTACHMENT0]);check();t.temporary.push({f,x});}
  g.bindFramebuffer(g.FRAMEBUFFER,null);g.bindRenderbuffer(g.RENDERBUFFER,null);
  t.estimatedBytes=w*h*(24*Math.max(1,t.samples)+20+16);
 }
 begin(renderer,w,h,enabled){
  this.active=false;if(!enabled||!this.available||this.gl.isContextLost())return false;
  const g=this.gl,textureUnit=g.getParameter(g.ACTIVE_TEXTURE),currentBinding=g.getParameter(g.TEXTURE_BINDING_2D);
  const binding=this.targets?.textures.includes(currentBinding)?null:currentBinding;
  this.allocate(w,h);g.activeTexture(textureUnit);g.bindTexture(g.TEXTURE_2D,binding);const t=this.targets;this.active=true;
  g.bindFramebuffer(g.FRAMEBUFFER,t.scene);g.drawBuffers([g.COLOR_ATTACHMENT0,g.COLOR_ATTACHMENT1,g.COLOR_ATTACHMENT2]);g.viewport(0,0,w,h);
  g.clearBufferfv(g.COLOR,0,new Float32Array([...(renderer.background||[.029,.048,.063]),1]));
  g.clearBufferfv(g.COLOR,1,new Float32Array(4));g.clearBufferfv(g.COLOR,2,new Float32Array(4));g.clear(g.DEPTH_BUFFER_BIT);return true;
 }
 finish(renderer){
  if(!this.active)return;const g=this.gl,t=this.targets;
  g.bindFramebuffer(g.READ_FRAMEBUFFER,t.scene);g.bindFramebuffer(g.DRAW_FRAMEBUFFER,t.resolve);
  for(let i=0;i<3;i++){g.readBuffer(g.COLOR_ATTACHMENT0+i);g.drawBuffers([0,1,2].map(k=>k===i?g.COLOR_ATTACHMENT0+k:g.NONE));g.blitFramebuffer(0,0,t.w,t.h,0,0,t.w,t.h,g.COLOR_BUFFER_BIT,g.NEAREST);}
  g.disable(g.DEPTH_TEST);g.disable(g.BLEND);g.disable(g.SAMPLE_ALPHA_TO_COVERAGE);g.depthMask(false);g.bindVertexArray(this.vao);
  const bind=(p,key,x,unit)=>{g.activeTexture(g.TEXTURE0+unit);g.bindTexture(g.TEXTURE_2D,x);g.uniform1i(p.u[key],unit);};
  const focal=renderer.projection==='orthographic'?t.h/renderer.orthoHeight:t.h/(2*Math.tan(.36));
  const p=this.blur;g.useProgram(p.p);bind(p,'original',t.colours[1],1);bind(p,'material',t.colours[2],2);g.uniform1f(p.u.perspectiveMode,renderer.projection==='orthographic'?0:1);
  for(let axis=0;axis<2;axis++){g.bindFramebuffer(g.FRAMEBUFFER,t.temporary[axis].f);g.drawBuffers([g.COLOR_ATTACHMENT0]);bind(p,'image',axis?t.temporary[0].x:t.colours[1],0);g.uniform2f(p.u.axisScale,axis?0:focal/t.w,axis?focal/t.h:0);g.drawArrays(g.TRIANGLES,0,3);}
  g.bindFramebuffer(g.FRAMEBUFFER,null);const q=this.composite;g.useProgram(q.p);bind(q,'base',t.colours[0],0);bind(q,'original',t.colours[1],1);bind(q,'filtered',t.temporary[1].x,2);bind(q,'material',t.colours[2],3);g.drawArrays(g.TRIANGLES,0,3);
  g.bindVertexArray(null);g.depthMask(true);g.enable(g.DEPTH_TEST);g.activeTexture(g.TEXTURE0);renderer.drawCalls+=3;
 }
 report(){return {revision:SKIN_TRANSPORT.revision,available:this.available,active:this.active,fallback:this.failure,
  dimensions:this.targets?[this.targets.w,this.targets.h]:null,samples:this.targets?.samples||0,estimatedBytes:this.targets?.estimatedBytes||0,
  passes:this.active?3:0,maximumRadiusM:.003,transported:'diffuse only',measuredPhysiology:false};}
 dispose(){this.release();if(this.available){this.gl.deleteProgram(this.blur.p);this.gl.deleteProgram(this.composite.p);this.gl.deleteVertexArray(this.vao);}}
}
