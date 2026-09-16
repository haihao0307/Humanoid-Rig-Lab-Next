// R2 independent hair ribbons. The head uses the body's same bind-pose delta.
const COMPACT_HAIR_VERTEX=`#version 300 es
precision highp float;
layout(location=0)in vec2 corner;
layout(location=1)in vec3 segmentStart;
layout(location=2)in vec3 segmentEnd;
layout(location=3)in vec2 strandRadius;
layout(location=4)in float strandTone;
layout(location=5)in vec3 styleNormal;
uniform mat4 viewProjection;
uniform sampler2D compactPalette;
uniform int hairJoint,hairSegments;
uniform vec2 viewportSize;
uniform float projectionScale,hairTime,hairWind,hairWidthScale,hairBasePass,hairBaseInflation,hairStatureScale,hairNatural;
uniform vec3 hairEye,hairScalpCenter;
uniform vec4 hairGroom;
out float vAcross,vCoverage,vLight,vTone,vAlong,vSpec;
out vec3 vLocal,vScalpData;
out vec3 vHairWorld,vHairNormal;
vec3 hairRotate(vec4 q,vec3 p){return p+2.*cross(q.xyz,cross(q.xyz,p)+q.w*p);}
void main(){
 vec4 q=texelFetch(compactPalette,ivec2(0,hairJoint),0),d=texelFetch(compactPalette,ivec2(1,hairJoint),0);
 vec3 translation=2.*(q.w*d.xyz-d.w*q.xyz+cross(q.xyz,d.xyz));
 vec3 lightDirection=normalize(vec3(.3,.6,.7));
 if(hairBasePass>.5){
  bool styled=dot(styleNormal,styleNormal)>.01;
  vec3 n=styled?normalize(styleNormal):normalize(segmentStart-hairScalpCenter),flow=vec3(hairGroom.x,n.z,-n.y);
  vec3 t=normalize(flow-n*dot(flow,n)+vec3(1e-7,0.,0.));
  vec3 local=segmentStart+n*hairBaseInflation*(styled?.15:1.),p=hairRotate(q,vec3(-local.x,local.yz)*hairStatureScale)+translation;
  vec3 normal=hairRotate(q,vec3(-n.x,n.yz)),tangent=hairRotate(q,vec3(-t.x,t.yz));
  gl_Position=viewProjection*vec4(p,1.);vLocal=segmentStart;vScalpData=segmentEnd;
  vHairWorld=p;vHairNormal=normal;
  vAcross=0.;vCoverage=1.;vTone=-1.;vAlong=0.;vLight=.38+.62*max(0.,dot(normal,lightDirection));
  float th=dot(tangent,normalize(lightDirection+normalize(hairEye-p)));
  vSpec=pow(sqrt(max(0.,1.-th*th)),48.)*max(0.,dot(normal,lightDirection));
  return;
 }
 float ta=float(gl_InstanceID%hairSegments)/float(hairSegments),tb=ta+1./float(hairSegments);
 vec3 wind=vec3(sin(hairTime*1.6+abs(strandTone)*21.),0.,cos(hairTime*1.3+abs(strandTone)*17.))*.00020*hairWind;
 vec3 pa=vec3(-segmentStart.x,segmentStart.yz)+wind*ta*ta,pb=vec3(-segmentEnd.x,segmentEnd.yz)+wind*tb*tb;
 pa=hairRotate(q,pa*hairStatureScale)+translation;pb=hairRotate(q,pb*hairStatureScale)+translation;
 vec4 a=viewProjection*vec4(pa,1.),b=viewProjection*vec4(pb,1.);
 vLocal=mix(segmentStart,segmentEnd,corner.y);vScalpData=vec3(0.);
 vHairWorld=mix(pa,pb,corner.y);vHairNormal=vec3(0.,1.,0.);
 vAcross=corner.x;vCoverage=0.;vTone=strandTone;vAlong=mix(ta,tb,corner.y);vLight=0.;vSpec=0.;
 if(a.w<=.015||b.w<=.015){gl_Position=vec4(2.,2.,2.,1.);return;}
 vec2 delta=(b.xy/b.w-a.xy/a.w)*viewportSize,side=normalize(vec2(-delta.y,delta.x)+vec2(1e-9,0.));
 vec4 p=mix(a,b,corner.y);float radius=mix(strandRadius.x,strandRadius.y,corner.y)*hairWidthScale*hairStatureScale;
 float pixelRadius=radius*projectionScale*viewportSize.y/(2.*max(p.w,1e-6)),expanded=max(pixelRadius,.64);
 p.xy+=side*corner.x*expanded*2./viewportSize*p.w;gl_Position=p;
 vAcross=corner.x;vCoverage=min(1.,pixelRadius/expanded);vTone=strandTone;
 vec3 tangent=normalize(pb-pa+vec3(1e-10));
 vec3 n=normalize(vLocal-hairScalpCenter),normal=hairRotate(q,vec3(-n.x,n.yz));
 float alignment=dot(tangent,lightDirection);
 vLight=(.48+.52*sqrt(max(0.,1.-alignment*alignment)))*(.55+.45*max(0.,dot(normal,lightDirection)));
 float th=dot(tangent,normalize(lightDirection+normalize(hairEye-mix(pa,pb,corner.y))));
 vSpec=pow(sqrt(max(0.,1.-th*th)),36.);
}`;
const COMPACT_HAIR_FRAGMENT=`#version 300 es
precision highp float;
in float vAcross,vCoverage,vLight,vTone,vAlong,vSpec;
in vec3 vLocal,vScalpData;
in vec3 vHairWorld,vHairNormal;
uniform vec3 hairColour,hairScalpCenter,hairEye;
uniform float hairSampleCoverage,hairBasePass,hairNatural;
uniform vec4 hairGroom;
out vec4 frag;
float hairRandom(float x){return fract(sin(x*127.1+31.7)*43758.5453);}
void main(){
 if(hairBasePass>.5){
  if(vScalpData.x<-.5){
   float key=-vScalpData.x-1.,id=fract(key),layer=min(1.,floor(key)),u=vScalpData.y,t=vScalpData.z;
   float strand=u*mix(28.,18.,layer),cell=floor(strand),aa=max(fwidth(strand),.08);
   float coverage=0.,tone=0.,crossSection=0.,flowSlope=0.;
   // Analytic fibre coverage: the spaces between hairs are actually open.
   // Three neighbours cover the bounded lateral bend without a texture atlas.
   for(int i=-1;i<=1;i++){
    float index=cell+float(i),random=hairRandom(index+id*197.);
    float phase=random*6.2831853,frequency=3.+4.*hairRandom(index+id*311.);
    float bend=.24*sin(t*frequency+phase)*sin(3.14159*t);
    float offset=strand-(index+.5+bend),width=mix(.41,.27,layer)*mix(.65,1.1,random)*mix(1.,.35,smoothstep(.65,1.,t));
    float fibre=clamp((width+.5*aa-abs(offset))/aa,0.,1.);
    float tip=.84+.16*hairRandom(index+id*613.),tipAA=max(fwidth(t),.006);
    fibre*=1.-smoothstep(tip-tipAA,tip+tipAA,t);
    coverage+=fibre;tone+=fibre*random;crossSection+=fibre*clamp(offset/max(width,.05),-1.,1.);
    flowSlope+=fibre*(.018*cos(t*frequency+phase));
   }
   float random=tone/max(coverage,.001),filtered=smoothstep(.8,2.2,aa);
   float rootStart=(1.-layer)*.012*hairRandom(cell+id*103.);
   float end=1.-smoothstep(.94,1.,t),root=smoothstep(rootStart,rootStart+mix(.012,.035,layer),t);
   coverage=mix(min(1.,coverage),mix(.96,.64,layer)*end,filtered);
   // The inner course closes the volume; only its tips become sparse. Making
   // every layer translucent exposes the skull through otherwise dense hair.
   coverage=mix(mix(1.,coverage,smoothstep(.82,.99,t)),coverage,layer);
   // R20's short, dense cut replaces the R21 translucent fringe at the tips.
   float cutStrand=u*19.+sin(t*7.+id*23.)*.20,cutRandom=hairRandom(floor(cutStrand)+id*139.);
   float cutEnd=.94+.06*cutRandom,cutTip=1.-smoothstep(cutEnd-max(.005,fwidth(t)),cutEnd,t);
   float tipBlend=smoothstep(.65,.90,t);coverage=mix(coverage,cutTip,tipBlend);
   float edgeAA=mix(max(fwidth(u),.001)*1.3,max(fwidth(u),.002)*1.5,tipBlend);
   float edge=smoothstep(0.,edgeAA,min(u,1.-u)),alpha=coverage*edge*root;
   vec3 dx=dFdx(vHairWorld),dy=dFdy(vHairWorld),normal=normalize(vHairNormal);
   vec3 alongWorld=dy*dFdx(u)-dx*dFdy(u);
   float orientation=sign(dFdx(u)*dFdy(t)-dFdy(u)*dFdx(t));
   vec3 tangent=normalize((alongWorld-normal*dot(normal,alongWorld))*orientation+vec3(1e-12));
   vec3 across=normalize(cross(normal,tangent)+vec3(1e-12));
   tangent=normalize(tangent+across*flowSlope/max(coverage,.1));
   normal=normalize(normal+across*crossSection*.40*(1.-filtered));
   if(alpha<(hairSampleCoverage>.5?.025:.35))discard;
   vec3 light=normalize(vec3(.3,.6,.7)),eye=normalize(hairEye-vHairWorld),halfway=normalize(light+eye);
   float tl=dot(tangent,light),diffuse=sqrt(max(0.,1.-tl*tl));
   float angle=dot(tangent,halfway)+.018*sin(id*43.),shifted=angle+.14;
   float primary=pow(sqrt(max(0.,1.-angle*angle)),100.),secondary=pow(sqrt(max(0.,1.-shifted*shifted)),30.);
   float clump=u*5.+.13*sin(t*4.+id*17.),clumpTone=hairRandom(floor(clump)+id*97.);
   float grain=mix(.65+.58*random,.94,filtered)*(.83+.30*clumpTone),depth=mix(.84,.97,layer)*(.92+.08*sin(3.14159*u));
   float facing=.28+.72*max(0.,dot(normal,light));
   vec3 colour=hairColour*(.30+.66*diffuse)*(.65+.35*max(0.,dot(normal,light)))*grain*depth*mix(.80,1.10,t);
   colour+=(vec3(.018)*primary+sqrt(hairColour)*secondary*.08)*facing*(.60+.40*random)*(.60+.60*clumpTone);
   frag=vec4(pow(max(colour,vec3(0.)),vec3(1./2.2)),hairSampleCoverage>.5?alpha:1.);return;
  }
  float phi=vScalpData.y,theta=vScalpData.z;
  float naturalStrand=phi*850.+theta*hairGroom.x*180.+sin(theta*9.+phi*5.)*3.,naturalAA=fwidth(naturalStrand);
  float boundary=hairNatural>.5?.06+.15*hairRandom(floor(phi*360.)):0.;
  float alpha=smoothstep(boundary,1.,vScalpData.x);
  if(alpha<(hairSampleCoverage>.5?.025:.35))discard;
  if(hairNatural>.5){
   float grain=mix(.82+.18*hairRandom(floor(naturalStrand)),.91,smoothstep(.4,1.5,naturalAA));
   vec3 colour=hairColour*vLight*grain*.88+sqrt(hairColour)*vSpec*.025;
   frag=vec4(pow(max(colour,vec3(0.)),vec3(1./2.2)),hairSampleCoverage>.5?alpha:1.);return;
  }
  float phase=phi*140.+theta*hairGroom.x*45.+1.3*sin(theta*13.+phi*11.)+hairGroom.w;
  float filtered=1.-smoothstep(1.5,4.,fwidth(phase));
  float grain=mix(.85,.69+.31*(.5+.5*sin(phase)),filtered);
  float locks=.9+.1*sin(phi*17.+theta*21.+hairGroom.w);
  vec3 linearColour=hairColour*vLight*grain*locks*.78+sqrt(hairColour)*vSpec*.022;
  frag=vec4(pow(max(linearColour,vec3(0.)),vec3(1./2.2)),hairSampleCoverage>.5?alpha:1.);return;
 }
 float band=(vAcross+1.)*3.5+abs(vTone)*19.+sin(vAlong*7.+abs(vTone)*13.)*.16;
 float filtered=1.-smoothstep(.25,1.,fwidth(band));
 float fibres=mix(.82,.70+.30*pow(.5+.5*sin(band*6.2831853),2.),filtered);
 if(hairNatural>.5)fibres=mix(.87,.72+.28*hairRandom(floor(band*5.)+abs(vTone)*311.),filtered);
 if(vTone>0.)fibres=1.;
 float alpha=clamp((1.-smoothstep(.62,1.,abs(vAcross)))*vCoverage*1.5,0.,1.);
 if(alpha<(hairSampleCoverage>.5?.025:.35))discard;
 vec3 linearColour=hairColour*vLight*abs(vTone)*fibres*mix(.72,1.16,vAlong)+sqrt(hairColour)*vSpec*(hairNatural>.5?.024:.075);
 frag=vec4(pow(max(linearColour,vec3(0.)),vec3(1./2.2)),hairSampleCoverage>.5?alpha:1.);
}`;

class CompactHairRenderer{
 constructor(surface,data){
  this.surface=surface;this.lab=surface.lab;this.gl=surface.gl;this.report=data.report;this.time=0;this.statureScale=surface.statureScale;
  if(!this.report.shape||!sameCharacterShape(this.report.shape,surface.shape))throw Error('毛发与当前人物体型不匹配');
  const gl=this.gl;this.buffers=[];
  try{
  this.program=program(gl,COMPACT_HAIR_VERTEX,COMPACT_HAIR_FRAGMENT);
  for(const name of ['compactPalette','hairJoint','hairSegments','viewportSize','projectionScale','hairTime','hairWind','hairWidthScale','hairColour','hairEye','hairSampleCoverage','hairBasePass','hairBaseInflation','hairStatureScale','hairScalpCenter','hairGroom','hairNatural'])this.program.u[name]=gl.getUniformLocation(this.program.p,name);
  if(!(data.segments instanceof Float32Array)||data.segments.length%9||data.segments.byteLength>this.report.maximumGeometryBytes||data.segments.length!==this.report.strands*this.report.segmentsPerStrand*9)throw Error('毛发缓冲区与预算不符');
  this.vao=gl.createVertexArray();if(!this.vao)throw Error('无法创建毛发绘制数组');gl.bindVertexArray(this.vao);
  const buffer=(target,array)=>{const b=gl.createBuffer();if(!b)throw Error('无法创建毛发几何缓冲');this.buffers.push(b);gl.bindBuffer(target,b);gl.bufferData(target,array,gl.STATIC_DRAW);return b;};
  buffer(gl.ARRAY_BUFFER,new Float32Array([-1,0,1,0,-1,1,1,1]));
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  buffer(gl.ARRAY_BUFFER,data.segments);
  for(const [location,size,offset]of [[1,3,0],[2,3,3],[3,2,6],[4,1,8]]){
   gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,36,offset*4);gl.vertexAttribDivisor(location,1);
  }
  buffer(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array([0,1,2,2,1,3]));
  this.segmentCount=data.segments.length/9;this.geometryBytes=data.segments.byteLength+44;
  this.coverageLevels=[];
  if(data.coverage){
   const c=data.coverage;
   if(!(c.positions instanceof Float32Array)||c.positions.length%3||!(c.regionData instanceof Float32Array)||c.regionData.length!==c.positions.length||!c.regionData.every(Number.isFinite)||!(c.indices instanceof Uint16Array)||c.levels.length!==4||!Number.isInteger(c.maxLOD)||c.maxLOD<0||c.maxLOD>3||c.indices.some(i=>i>=c.positions.length/3)||c.levels.some(l=>!Number.isInteger(l.count)||l.count%3||l.offsetBytes%2||l.offsetBytes<0||l.offsetBytes+l.count*2>c.indices.byteLength||!Number.isFinite(l.inflation)||l.inflation<0))throw Error('毛发底层缓冲无效');
   if(c.styleNormals&&(!(c.styleNormals instanceof Float32Array)||c.styleNormals.length!==c.positions.length||!c.styleNormals.every(Number.isFinite)))throw Error('发型法线缓冲无效');
   this.geometryBytes+=c.positions.byteLength+c.regionData.byteLength+c.indices.byteLength+(c.styleNormals?.byteLength||0);
   if(this.geometryBytes-44>this.report.maximumGeometryBytes)throw Error('毛发底层和发束超出共享预算');
   this.coverageVAO=gl.createVertexArray();if(!this.coverageVAO)throw Error('无法创建毛发底层绘制数组');gl.bindVertexArray(this.coverageVAO);
   buffer(gl.ARRAY_BUFFER,c.positions);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,12,0);
   buffer(gl.ARRAY_BUFFER,c.regionData);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,3,gl.FLOAT,false,12,0);
   if(c.styleNormals){buffer(gl.ARRAY_BUFFER,c.styleNormals);gl.enableVertexAttribArray(5);gl.vertexAttribPointer(5,3,gl.FLOAT,false,12,0);}
   buffer(gl.ELEMENT_ARRAY_BUFFER,c.indices);this.coverageLevels=c.levels.map(l=>({...l}));this.coverageMaxLOD=c.maxLOD;
  }
  this.scalpCenter=new Float32Array(this.report.scalpCenter);
  this.naturalMode=['bob','wavy-bob','curtains'].includes(this.report.styleDesign)?2:this.report.styleDesign&&this.report.styleDesign!=='legacy'?1:0;
  const groom=this.report.groom;this.groom=new Float32Array([groom.sweep,groom.part,groom.hairlineInset,(groom.seed%4093)/4093*2*Math.PI]);
  this.headJoint=this.lab.human.joints.findIndex(j=>j.id==='head');
  if(this.headJoint<0)throw Error('Reconstructed hair requires the shared head joint');
  this.triangles=this.segmentCount*2+(this.coverageLevels[0]?.triangles||0);this.visible=false;this.lod=null;
  this.sampleCoverage=gl.getParameter(gl.SAMPLES)>1;this.setColor(this.report.profile.color);
  }catch(error){gl.bindVertexArray(null);this.dispose();throw error;}
 }
 setColor(hex){this.colour=new Float32Array([1,3,5].map(i=>{const c=parseInt(hex.slice(i,i+2),16)/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;}));}
 update(dt){if(Number.isFinite(dt)&&this.lab.hair?.windEnabled&&this.lab.hair.windSpeed>0){this.time=(this.time+Math.max(0,Math.min(dt,.1)))%3600;needsRedraw=true;}}
 selectLOD(){
  const r=this.lab.renderer,c=this.report.scalpCenter.map(v=>v*this.statureScale),t=this.surface.headTransform;
  const centre=t?add(rotate(t.q,[-c[0],c[1],c[2]]),t.p):[-c[0],c[1],c[2]],m=r.vp;
  const w=m[3]*centre[0]+m[7]*centre[1]+m[11]*centre[2]+m[15];
  const scale=r.projection==='orthographic'?2/r.orthoHeight:1/Math.tan(.36);
  const pixels=this.report.headDiameterMetres*this.statureScale*scale*r.canvas.height/(2*Math.max(.015,w));
  const thresholds=[160,70,28];
  if(this.lod===null)this.lod=pixels>=160?0:pixels>=70?1:pixels>=28?2:3;
  while(this.lod<3&&pixels<thresholds[this.lod]*.88)this.lod++;
  while(this.lod>0&&pixels>thresholds[this.lod-1]*1.12)this.lod--;
  const strands=this.report.strands,active=w<=0?0:Math.min(strands,Math.max(1,Math.ceil(strands/2**this.lod)));
  this.activeStrands=active;this.drawSegmentCount=active*this.report.segmentsPerStrand;
  this.coverageLevel=this.coverageLevels[Math.min(this.lod,this.coverageMaxLOD)];this.triangles=this.drawSegmentCount*2+(active&&this.coverageLevel?this.coverageLevel.triangles:0);
  this.widthScale=active?Math.min(4,strands/active):1;
 }
 draw(){
  this.visible=this.surface.visible&&this.lab.hair?.enabled!==false&&this.surface.view==='skin';
  if(!this.visible)return;
  this.selectLOD();if(!this.drawSegmentCount){this.visible=false;return;}
  const gl=this.gl,r=this.lab.renderer,p=this.program;
  gl.useProgram(p.p);gl.uniformMatrix4fv(p.u.viewProjection,false,r.vp);
  gl.uniform1i(p.u.compactPalette,COMPACT_PALETTE_UNIT);gl.uniform1i(p.u.hairJoint,this.headJoint);gl.uniform1i(p.u.hairSegments,this.report.segmentsPerStrand);gl.uniform1f(p.u.hairStatureScale,this.statureScale);
  gl.uniform2f(p.u.viewportSize,r.canvas.width,r.canvas.height);gl.uniform1f(p.u.projectionScale,r.projection==='orthographic'?2/r.orthoHeight:1/Math.tan(.36));
  gl.uniform1f(p.u.hairTime,this.time);gl.uniform1f(p.u.hairWind,this.lab.hair?.windEnabled?this.lab.hair.windSpeed:0);
  gl.uniform1f(p.u.hairWidthScale,this.widthScale);gl.uniform3fv(p.u.hairColour,this.colour);gl.uniform3fv(p.u.hairEye,r.eye);gl.uniform1f(p.u.hairSampleCoverage,this.sampleCoverage?1:0);
  gl.uniform3fv(p.u.hairScalpCenter,this.scalpCenter);gl.uniform4fv(p.u.hairGroom,this.groom);
  gl.uniform1f(p.u.hairNatural,this.naturalMode);
  gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.disable(gl.BLEND);gl.depthMask(true);
  if(this.sampleCoverage)gl.enable(gl.SAMPLE_ALPHA_TO_COVERAGE);
  if(this.coverageVAO&&this.coverageLevel){gl.uniform1f(p.u.hairBasePass,1);gl.uniform1f(p.u.hairBaseInflation,this.coverageLevel.inflation);gl.bindVertexArray(this.coverageVAO);gl.drawElements(gl.TRIANGLES,this.coverageLevel.count,gl.UNSIGNED_SHORT,this.coverageLevel.offsetBytes);r.drawCalls++;}
  gl.uniform1f(p.u.hairBasePass,0);
  gl.bindVertexArray(this.vao);gl.drawElementsInstanced(gl.TRIANGLES,6,gl.UNSIGNED_SHORT,0,this.drawSegmentCount);r.drawCalls++;
  gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);gl.bindVertexArray(null);
 }
 dispose(){if(this.disposed)return;this.disposed=true;this.visible=false;const gl=this.gl;for(const b of this.buffers)gl.deleteBuffer(b);if(this.vao)gl.deleteVertexArray(this.vao);if(this.coverageVAO)gl.deleteVertexArray(this.coverageVAO);if(this.program)gl.deleteProgram(this.program.p);this.buffers=[];this.geometryBytes=0;}
}
