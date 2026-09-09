/* JARVIS Human Presence 1.14.2.
 * Author-built stylized head and shoulder contours, simplified facial marks.
 * No skin surface, eyeballs, textures, imported meshes, image assets or bloom.
 * A single immutable Float32Array/GPU buffer. Two draws: anti-aliased contour ribbons then POINTS.
 * Important facial landmarks remain at tiny sizes; secondary contours fade.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.JarvisParticleFace=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const VERSION='1.14.2',STRIDE=8,MAX_POINTS=640;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const finite=(n,fallback=0)=>Number.isFinite(n)?n:fallback;
function build(seed=114201){
 let state=seed>>>0;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 // Authored silhouette profile: chin, jaw, cheek, temple, cranium. Units are avatar-only.
 const profile=[[-.34,.065,.20],[-.30,.16,.26],[-.22,.245,.31],[-.10,.31,.34],[.06,.36,.37],[.25,.425,.39],[.42,.423,.365],[.60,.427,.37],[.80,.447,.37],[.96,.415,.33],[1.08,.324,.26],[1.16,.185,.16],[1.20,0,0]];
 function shape(y){
  y=clamp(y,profile[0][0],profile.at(-1)[0]);let i=0;while(i<profile.length-2&&y>profile[i+1][0])i++;
  const a=profile[i],b=profile[i+1],t=(y-a[0])/(b[0]-a[0]),prev=profile[Math.max(0,i-1)],next=profile[Math.min(profile.length-1,i+2)],span=b[0]-a[0];
  if(y>1.08){const q=(y-1.04)/.16;return [.374*Math.sqrt(Math.max(0,1-q*q)),.298*Math.sqrt(Math.max(0,1-q*q))];}
  const interp=j=>{const m0=(b[j]-prev[j])/(b[0]-prev[0])*span,m1=(next[j]-a[j])/(next[0]-a[0])*span;return (2*t*t*t-3*t*t+1)*a[j]+(t*t*t-2*t*t+t)*m0+(-2*t*t*t+3*t*t)*b[j]+(t*t*t-t*t)*m1;};
  return[Math.max(0,interp(1)),Math.max(0,interp(2))];
 }
 function surface(x,y,extra=0){
  const [w,d]=shape(y),q=clamp(x/Math.max(.001,w),-.999,.999);
  const nose=.13*Math.exp(-Math.pow(x/.085,2)-Math.pow((y-.24)/.23,2));
  const cheek=.02*Math.exp(-Math.pow((Math.abs(x)-.25)/.13,2)-Math.pow((y-.20)/.19,2));
  return[x,y,d*Math.sqrt(Math.max(0,1-q*q))+nose+cheek+extra];
 }
 const lines=[],points=[],curves=[];
 const append=(dst,p,role,alpha,phase=0,jitter=0)=>dst.push(p[0],p[1]-.12,p[2],role,alpha,phase,jitter,0);
 function curve(fn,segments,role,alpha){
  const sampled=[];for(let i=0;i<=segments;i++)sampled.push(fn(i/segments));curves.push({role,segments});
  const vertex=(p,i,side)=>{const prev=sampled[Math.max(0,i-1)],next=sampled[Math.min(segments,i+1)],dx=next[0]-prev[0],dy=next[1]-prev[1],l=Math.hypot(dx,dy)||1;
   lines.push(p[0],p[1]-.12,p[2],role,alpha,-dy/l,dx/l,side);};
  for(let i=0;i<segments;i++){vertex(sampled[i],i,-1);vertex(sampled[i+1],i+1,-1);vertex(sampled[i],i,1);vertex(sampled[i],i,1);vertex(sampled[i+1],i+1,-1);vertex(sampled[i+1],i+1,1);}
 }
 const bez=(a,b,c,d,t)=>{const k=1-t;return a.map((x,i)=>k*k*k*x+3*k*k*t*b[i]+3*k*t*t*c[i]+t*t*t*d[i]);};
 const bezier=(a,b,c,d,n,role,alpha)=>curve(t=>bez(a,b,c,d,t),n,role,alpha);
 // Main contour is open at the neck. A shaped jaw prevents a uniform egg silhouette.
 for(const side of [-1,1]){
  curve(t=>{const a=t*Math.PI/2,y=-.34+1.54*Math.sin(a),[w]=shape(y);return[side*w,y,.012];},52,0,.82);
  // Small temple break and thin, non-solid outer ear mark.
  bezier([side*.425,.41,.006],[side*.515,.43,.015],[side*.49,.12,.04],[side*.392,.10,.045],12,1,.44);
 }
 // Crown and forehead contours deliberately leave interior negative space.
 for(const [i,y] of [.99,.88,.77,.66,-.20,-.28].entries()){
  curve(t=>{const a=-1.47+t*2.94,[w]=shape(y);return surface(w*Math.sin(a),y+.052*Math.cos(a)*(i<4?1:-1));},28,2,i<4?.40:.28);
 }
 for(const side of [-1,1])for(const y of [.29,.15,.055]){
  curve(t=>{const a=.46+t*.97,[w]=shape(y);return surface(side*w*Math.sin(a),y-.045*Math.sin(t*Math.PI));},15,2,.30);
 }
 // Side flow lines; they never cut through the central eyes, nose or mouth.
 for(const side of [-1,1])for(const [i,ratio] of [.70,.87].entries()){
  curve(t=>{const y=-.235+t*1.345,[w]=shape(y);return surface(side*w*ratio,y,.004);},32,2,i===0?.22:.31);
 }
 // Calm eyebrows and open eyelid strokes. No pupils, irises, whites or holes.
 for(const side of [-1,1]){
  curve(t=>surface(side*(.077+.255*t),.573+.035*Math.sin(t*Math.PI)-.030*t,.018),18,3,.62);
  curve(t=>surface(side*(.088+.227*t),.437+.025*Math.sin(t*Math.PI)-.004*t,.022),20,3,.88);
  curve(t=>surface(side*(.108+.185*t),.421-.017*Math.sin(t*Math.PI),.008),12,4,.12);
 }
 // Partial nasal bridge and tip. Open strokes keep the face light and stylized.
 curve(t=>surface(-.040-.010*t,.492-.276*t,.010),16,3,.43);
 bezier([-.050,.215,.493],[-.068,.133,.523],[.048,.122,.523],[.065,.186,.491],16,3,.52);
 // A quiet, slightly upturned mouth, represented by two short strokes only.
 curve(t=>surface(-.129+.258*t,-.085+.017*Math.pow(t*2-1,2),.020),22,3,.67);
 curve(t=>surface(-.075+.150*t,-.135-.007*Math.sin(t*Math.PI),.008),12,4,.22);
 // Neck and shoulders make the portrait read as a person even in a compact pane.
 for(const side of [-1,1]){
  bezier([side*.16,-.285,.10],[side*.145,-.37,.12],[side*.13,-.48,.14],[side*.215,-.56,.17],18,0,.50);
  bezier([side*.215,-.56,.17],[side*.41,-.65,.19],[side*.80,-.63,.05],[side*.91,-.925,-.04],28,0,.66);
  bezier([side*.215,-.56,.19],[side*.15,-.615,.255],[side*.06,-.625,.285],[0,-.635,.29],14,1,.39);
  bezier([side*.31,-.66,.18],[side*.43,-.67,.19],[side*.72,-.735,.09],[side*.82,-.89,.025],22,2,.23);
  bezier([side*.08,-.685,.30],[side*.24,-.72,.26],[side*.53,-.73,.19],[side*.74,-.83,.11],22,2,.19);
  curve(t=>[side*(.22+.49*t),-.80-.10*t,.29-.25*t],16,4,.12);
 }
 // A few detached signals behind the temples, without enclosing the head in a ring.
 for(const side of [-1,1])for(let i=0;i<3;i++){
  const y=.35+i*.24;
  bezier([side*.60,y-.09,-.20],[side*.635,y-.04,-.18],[side*.65,y+.01,-.18],[side*.64,y+.07,-.18],7,5,.13+i*.02);
 }
 // Progressive sampling: every prefix distributes detail over head, shoulders and air.
 for(let i=0;i<MAX_POINTS;i++){
  let p,alpha,role=6;const k=i%5;
  if(k<2){const y=-.30+random()*1.46,[w]=shape(y),side=random()<.5?-1:1,q=side*(.67+random()*.32);p=surface(w*q,y,.008);alpha=.24+random()*.32;}
  else if(k===2){const side=random()<.5?-1:1,t=random();p=bez([side*.22,-.58,.17],[side*.43,-.67,.19],[side*.78,-.70,.09],[side*.88,-.92,-.02],t);p[1]-=random()*.1;alpha=.18+random()*.33;}
  else{const side=random()<.5?-1:1,y=-.55+random()*1.60;p=[side*(.48+random()*.32),y,-.16-random()*.15];alpha=.12+random()*.23;role=7;}
  append(points,p,role,alpha,random(),random());
 }
 const data=new Float32Array(lines.length+points.length);data.set(lines);data.set(points,lines.length);
 return{data,count:MAX_POINTS,stride:STRIDE,seed:seed>>>0,lineVertexCount:lines.length/STRIDE,pointOffset:lines.length/STRIDE,curveCount:curves.length,anatomicalFeatures:7,features:['head','jaw','eyes','nose','mouth','neck','shoulders'],realisticEyeCount:0,filledSurfaceCount:0};
}
function budget(width,height,quality='balanced',dpr=1){
 width=Math.max(0,finite(width));height=Math.max(0,finite(height));
 const economy=quality==='economy',unit=Math.min(width/2.30,height/2.42),area=width*height;
 const ratio=Math.min(Math.max(.25,finite(dpr,1)),economy?1:1.5,Math.sqrt((economy?280000:600000)/Math.max(1,area)));
 const pointCount=Math.floor(clamp(unit*unit*(economy?.028:.055),28,economy?240:MAX_POINTS));
 return{unit,pointCount,ratio,width:Math.max(1,Math.floor(width*ratio)),height:Math.max(1,Math.floor(height*ratio)),frameCap:economy?20:30};
}
const VS=`precision highp float;
attribute vec4 aPosition;attribute vec4 aStyle;
uniform vec4 uView;uniform vec4 uFlow;uniform vec3 uPixel;uniform float uPass;
varying vec4 vColor;varying vec2 vShape;
void main(){
 vec3 p=aPosition.xyz;float role=aPosition.w,tm=uFlow.x,alpha=aStyle.x;
 // Light reacts to speaking; no opening cavity or realistic facial imitation.
 float feedback=uFlow.y*(.5+.5*sin(tm*5.2));
 if(role>6.5){p.x+=.010*sin(tm*.31+aStyle.y*13.);p.y+=.013*sin(tm*.28+aStyle.y*9.);}
 float yaw=uView.z+.026*sin(tm*.23),c=cos(yaw),s=sin(yaw);p.xz=mat2(c,-s,s,c)*p.xz;
 c=cos(uView.w);s=sin(uView.w);p.yz=mat2(c,s,-s,c)*p.yz;
 float depth=clamp(.84+p.z*.36,.54,1.);
 // Reduce secondary marks as screen size falls. Facial landmark strokes are retained.
 float secondary=step(1.5,role)*(1.-step(2.5,role))+step(3.5,role)*(1.-step(5.5,role));
 alpha*=mix(1.,mix(.20,1.,smoothstep(37.,140.,uPixel.y)),secondary);
 float tide=.5+.5*sin(p.y*2.6-tm*.32);
 vec3 color=mix(vec3(.20,.47,.82),vec3(.24,.78,.91),.35+.5*depth);
 color=mix(color,vec3(.34,.85,.91),tide*.28);
 if(role>2.5&&role<3.5)color=vec3(.36,.83,.91);
 alpha*=depth*(.93+.07*tide)+feedback*.08;
 float perspective=5.5/(5.5-p.z);
 vec2 clip=p.xy*uView.xy*perspective;
 if(uPass<.5){
  vec2 normal=normalize(aStyle.yz*vec2(cos(yaw),1.)+vec2(.000001));
  float width=role<1.5?1.30:role<2.5?.90:role<3.5?1.30:.82;
  // Width is in CSS pixels. Shrinking does not pack world-space splats together.
  clip+=normal*aStyle.w*width*uView.xy/uPixel.y;
 }
 gl_Position=vec4(clip,-p.z*.1,1.);
 gl_PointSize=clamp((.75+aStyle.z*.80)*uPixel.x,1.,2.5);
 vColor=vec4(color,min(.88,alpha));vShape=vec2(aStyle.w,uPass);
}`;
const FS=`precision mediump float;varying vec4 vColor;varying vec2 vShape;
void main(){float alpha=vColor.a;if(vShape.y>.5){vec2 q=gl_PointCoord*2.-1.;float d=dot(q,q);if(d>1.)discard;alpha*=1.-smoothstep(.0,1.,d);}else{alpha*=exp(-3.0*vShape.x*vShape.x)*(1.-smoothstep(.72,1.,abs(vShape.x)));}gl_FragColor=vec4(vColor.rgb,alpha);}`;
class Renderer{
 constructor(host,options={}){
  if(!host||!host.ownerDocument)throw Error('需要有效的形象容器');
  this.host=host;this.canvas=host.ownerDocument.createElement('canvas');
  this.canvas.setAttribute('role','img');this.canvas.setAttribute('aria-label','贾维斯光迹人像：可辨认的头部、简化五官与颈肩，由疏朗光线和粒子组成，可拖动观察');
  this.canvas.style.cssText='width:100%;height:100%;display:block;touch-action:none;background:radial-gradient(ellipse at 48% 50%,#0c2031 0%,#071320 47%,#050c15 85%)';
  host.replaceChildren(this.canvas);
  this.quality=options.quality==='economy'?'economy':'balanced';this.model=build();this.channels={};this.speaking=false;this.visible=true;this.disposed=false;this.lost=false;
  this.media=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');this.reduced=!!this.media?.matches;
  this.turn=[-.13,-.01];this.targetTurn=[-.13,-.01];this.draws=0;this.uploads=0;this.cpuMs=0;this.last=0;this.phase=0;this.raf=0;this.dirty=true;this.response=0;this.attention=0;this.down=null;
  this.gl=this.canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:true,depth:false,stencil:false,powerPreference:'low-power',preserveDrawingBuffer:false});
  if(!this.gl)throw Error('光迹人像需要 WebGL；文字与身体控制仍可继续');
  this.initialize();this.resize();
  this.frame=now=>{
   this.raf=0;if(!this.shouldRun())return;
   if(this.dirty||now-this.last>=1000/this.layout.frameCap-1){this.render(now);this.dirty=false;}
   if(!this.reduced||this.down)this.raf=requestAnimationFrame(this.frame);
  };
  this.onResize=()=>{if(this.resize())this.wake();};this.ro=new ResizeObserver(this.onResize);this.ro.observe(host);
  this.onVisibility=()=>{this.last=0;this.wake();};document.addEventListener('visibilitychange',this.onVisibility);
  this.onMotion=e=>{this.reduced=!!e.matches;this.last=0;this.wake();};this.media?.addEventListener?.('change',this.onMotion);
  this.canvas.onpointerdown=e=>{this.down={x:e.clientX,y:e.clientY,yaw:this.turn[0],pitch:this.turn[1]};this.canvas.setPointerCapture(e.pointerId);this.wake();};
  this.canvas.onpointermove=e=>{if(!this.down)return;this.targetTurn[0]=clamp(this.down.yaw+(e.clientX-this.down.x)*.004,-.5,.5);this.targetTurn[1]=clamp(this.down.pitch+(e.clientY-this.down.y)*.004,-.35,.35);this.wake();};
  this.canvas.onpointerup=this.canvas.onpointercancel=()=>{this.down=null;this.wake();};
  this.onLost=e=>{e.preventDefault();this.lost=true;cancelAnimationFrame(this.raf);this.raf=0;};
  this.onRestored=()=>{this.lost=false;this.initialize();this.resize(true);this.last=0;this.wake();};
  this.canvas.addEventListener('webglcontextlost',this.onLost);this.canvas.addEventListener('webglcontextrestored',this.onRestored);this.wake();
 }
 initialize(){
  const gl=this.gl;const shaders=[];
  const compile=(type,source)=>{const s=gl.createShader(type);if(!s)throw Error('无法创建人像着色器');shaders.push(s);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s)||'人像着色器编译失败');return s;};
  let p;
  try{p=gl.createProgram();if(!p)throw Error('无法创建人像程序');gl.attachShader(p,compile(gl.VERTEX_SHADER,VS));gl.attachShader(p,compile(gl.FRAGMENT_SHADER,FS));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p)||'人像程序链接失败');}
  catch(e){if(p)gl.deleteProgram(p);throw e;}finally{for(const s of shaders)gl.deleteShader(s);}
  this.program=p;gl.useProgram(p);this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,this.model.data,gl.STATIC_DRAW);this.uploads++;
  for(const [name,offset] of [['aPosition',0],['aStyle',16]]){const a=gl.getAttribLocation(p,name);gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,4,gl.FLOAT,false,32,offset);}
  this.u={};for(const n of ['uView','uFlow','uPixel','uPass'])this.u[n]=gl.getUniformLocation(p,n);
  gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.enable(gl.BLEND);
  gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(0,0,0,0);
 }
 resize(force=false){
  if(this.disposed)return false;const r=this.host.getBoundingClientRect(),next=budget(r.width,r.height,this.quality,globalThis.devicePixelRatio||1);
  const changed=force||this.width!==r.width||this.height!==r.height||this.canvas.width!==next.width||this.canvas.height!==next.height||this.layout?.pointCount!==next.pointCount;
  this.width=r.width;this.height=r.height;this.layout=next;this.pixel=next.ratio;
  if(changed){this.canvas.width=next.width;this.canvas.height=next.height;this.gl.viewport(0,0,next.width,next.height);}
  return changed;
 }
 shouldRun(){return !this.disposed&&!this.lost&&this.visible&&!document.hidden&&this.width>2&&this.height>2;}
 wake(){
  if(this.disposed)return;this.dirty=true;if(!this.frame)return;
  if(!this.shouldRun()){cancelAnimationFrame(this.raf);this.raf=0;this.last=0;return;}
  if(!this.raf)this.raf=requestAnimationFrame(this.frame);
 }
 render(now){
  if(!this.shouldRun())return;const start=performance.now(),gl=this.gl,u=this.u,b=this.layout;
  const dt=this.last?clamp((now-this.last)*.001,0,.10):0;this.last=now;
  if(!this.reduced)this.phase+=dt;
  const k=this.reduced?1:1-Math.exp(-Math.max(dt,.016)*8);
  this.turn[0]+=(this.targetTurn[0]-this.turn[0])*k;this.turn[1]+=(this.targetTurn[1]-this.turn[1])*k;
  this.response+=((this.speaking?1:0)-this.response)*k;
  const c=this.channels;this.attention=clamp(finite(c.eyeWideLeft)+finite(c.browInnerUp),0,1);
  gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(this.program);
  gl.uniform4f(u.uView,2*b.unit/Math.max(1,this.width),2*b.unit/Math.max(1,this.height),this.turn[0],this.turn[1]);
  gl.uniform4f(u.uFlow,this.phase,this.reduced?0:this.response,this.attention,0);
  gl.uniform3f(u.uPixel,b.ratio,b.unit,0);
  gl.uniform1f(u.uPass,0);gl.drawArrays(gl.TRIANGLES,0,this.model.lineVertexCount);
  gl.uniform1f(u.uPass,1);gl.drawArrays(gl.POINTS,this.model.pointOffset,b.pointCount);
  this.draws++;this.cpuMs=this.draws===1?performance.now()-start:this.cpuMs*.95+(performance.now()-start)*.05;
 }
 setFaceState(state){
  // Retain the old cognition contract. Channels modulate light on a stylized portrait; no realistic facial simulation.
  const c=state?.channels||{};const next={eyeWideLeft:clamp(finite(c.eyeWideLeft),0,1),browInnerUp:clamp(finite(c.browInnerUp),0,1)};
  if(next.eyeWideLeft!==this.channels.eyeWideLeft||next.browInnerUp!==this.channels.browInnerUp){this.channels=next;this.wake();}
 }
 setSpeaking(value){value=!!value;if(this.speaking!==value){this.speaking=value;this.wake();}}
 setVisible(value){value=!!value;if(this.visible!==value){this.visible=value;this.last=0;this.wake();}}
 setQuality(value){this.quality=value==='economy'?'economy':'balanced';this.resize();this.last=0;this.wake();return this.diagnostics();}
 diagnostics(){return{version:VERSION,renderer:'native-webgl-human-contours',appearance:'stylized-human-hologram',anatomicalFeatures:this.model.anatomicalFeatures,realisticEyeCount:0,filledSurfaceCount:0,quality:this.quality,pointCount:this.layout.pointCount,storedPointCount:this.model.count,lineVertexCount:this.model.lineVertexCount,curveCount:this.model.curveCount,cpuBufferBytes:this.model.data.byteLength,gpuBufferBytes:this.model.data.byteLength,bufferUploads:this.uploads,drawCallsPerFrame:2,draws:this.draws,frameCap:this.layout.frameCap,pixelRatio:this.pixel,backbufferWidth:this.canvas.width,backbufferHeight:this.canvas.height,textureCount:0,importedMeshCount:0,postprocessPasses:0,externalRequests:0,visible:this.visible,running:this.shouldRun(),continuousAnimation:this.shouldRun()&&!this.reduced,cpuSubmissionMsEMA:this.cpuMs,gpuTimeMeasured:false,reducedMotion:this.reduced,speaking:this.speaking,compositing:'bounded-straight-alpha-with-premultiplied-output',densityPolicy:'screen-area-adaptive',phase:this.phase};}
 dispose(){if(this.disposed)return;this.disposed=true;cancelAnimationFrame(this.raf);this.raf=0;this.ro.disconnect();document.removeEventListener('visibilitychange',this.onVisibility);this.media?.removeEventListener?.('change',this.onMotion);this.canvas.removeEventListener('webglcontextlost',this.onLost);this.canvas.removeEventListener('webglcontextrestored',this.onRestored);this.gl.deleteBuffer(this.buffer);this.gl.deleteProgram(this.program);this.canvas.remove();}
}
return{Renderer,build,budget,STRIDE,VERSION};
});
