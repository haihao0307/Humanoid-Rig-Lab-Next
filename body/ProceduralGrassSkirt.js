// Authored plant-fibre clothing, generated from the current personal surface.
// Closed opaque underlayer provides coverage; overlapping blades add detail.
// Pelvis/thigh skinning and bounded tip motion approximate drape, not cloth physics.
const GRASS_SKIRT_VERTEX=`#version 300 es
precision highp float;
layout(location=0)in vec3 position;
layout(location=1)in vec3 normal;
layout(location=2)in vec2 uv;
layout(location=3)in vec2 detail;
uniform mat4 viewProjection;
uniform sampler2D compactPalette;
uniform ivec3 skirtJoints;
uniform float skirtTime,skirtScale;
uniform vec4 skirtThighs[4];
out vec3 worldPoint,worldNormal;
out vec2 leafUV,leafDetail;
vec3 spin(vec4 q,vec3 p){return p+2.*cross(q.xyz,cross(q.xyz,p)+q.w*p);}
vec3 posed(int id,vec3 p){vec4 q=texelFetch(compactPalette,ivec2(0,id),0),d=texelFetch(compactPalette,ivec2(1,id),0);return spin(q,p)+2.*(q.w*d.xyz-d.w*q.xyz+cross(q.xyz,d.xyz));}
vec3 clearThigh(vec3 p,vec4 a,vec4 b,vec3 fallback){
 vec3 axis=b.xyz-a.xyz;float t=clamp(dot(p-a.xyz,axis)/max(dot(axis,axis),1e-9),0.,1.);
 vec3 centre=mix(a.xyz,b.xyz,t),delta=p-centre;float radius=mix(a.w,b.w,t),d=length(delta);
 return d<radius?centre+(d>1e-6?delta/d:normalize(fallback))*radius:p;
}
void main(){
 vec3 p=position;
 float hang=detail.y<1.5?pow(clamp(uv.y,0.,1.),2.):0.;
 if(detail.y>.5&&detail.y<1.5)p+=normal*sin(skirtTime*2.1+detail.x*41.+uv.y*3.)*.004*skirtScale*hang;
 vec3 pelvis=posed(skirtJoints.x,p),legs=(posed(skirtJoints.y,p)+posed(skirtJoints.z,p))*.5;
 worldPoint=mix(pelvis,legs,.32*hang);
 worldNormal=spin(texelFetch(compactPalette,ivec2(0,skirtJoints.x),0),normal);
 // The opaque backing and every blade use the same current thigh envelope.
 // This is bounded geometric clearance, not a cloth/force simulation.
 if(uv.y>.07&&detail.y<1.5)for(int iteration=0;iteration<3;iteration++){
  worldPoint=clearThigh(worldPoint,skirtThighs[0],skirtThighs[1],worldNormal);
  worldPoint=clearThigh(worldPoint,skirtThighs[2],skirtThighs[3],worldNormal);
  worldPoint.y=max(worldPoint.y,.006*skirtScale);
 }
 leafUV=uv;leafDetail=detail;gl_Position=viewProjection*vec4(worldPoint,1.);
}`;
const GRASS_SKIRT_FRAGMENT=`#version 300 es
precision highp float;
in vec3 worldPoint,worldNormal;
in vec2 leafUV,leafDetail;
uniform vec3 skirtColour;
out vec4 frag;
void main(){
 vec3 n=normalize(cross(dFdx(worldPoint),dFdy(worldPoint)));
 if(dot(n,worldNormal)<0.)n=-n;
 float light=.50+.50*max(0.,dot(n,normalize(vec3(-.35,.8,.65))));
 float vein=.88+.12*cos(leafUV.x*31.+sin(leafUV.y*18.+leafDetail.x*9.)*.6);
 float fold=.76+.24*sin(leafUV.x*3.14159265);
 float tone=.76+.38*leafDetail.x;
 vec3 colour=skirtColour;
 if(leafDetail.y>1.5){
  float weave=sin(leafUV.x*680.+leafUV.y*28.)*sin(leafUV.x*680.-leafUV.y*28.);
  vein=.84+.16*weave;fold=1.;colour=mix(skirtColour,vec3(.51,.36,.16),.65);
 }
 frag=vec4(colour*tone*light*vein*fold,1.);
}`;
class ProceduralGrassSkirt {
 constructor(surface,meshes){
  this.surface=surface;this.gl=surface.gl;this.buffers=[];
  const h=surface.boundHuman,s=surface.statureScale,hips=h.sourceBind.get('hips').p;
  const top=hips[1]+.145*s,length=.405*s,cx=hips[0],cz=hips[2],levels=12;
  const rings=Array.from({length:levels+1},()=>({rx:.16*s,rz:.13*s,points:[]}));
  const allowed=new Set(h.joints.flatMap((j,i)=>j.id==='hips'||j.id.includes('femur')||j.id.startsWith('spine')?[i]:[]));
  const thighIds=['left','right'].map(side=>h.joints.findIndex(j=>j.id===side+'_femur'));
  this.thighRadii=thighIds.map(()=>.07*s);this.thighUniform=new Float32Array(16);
  const thighRest=['left','right'].map(side=>[h.sourceBind.get(side+'_femur').p,h.sourceBind.get(side+'_tibia').p]);
  for(const mesh of meshes){if(mesh.name!=='skin')continue;
   for(let i=0;i<mesh.vertices;i++){
    for(let side=0;side<2;side++){
     let weight=0;for(let k=0;k<8;k++)if(mesh.binding.ids[i*8+k]===thighIds[side])weight+=mesh.binding.weights[i*8+k]/65535;
     if(weight<.6)continue;
     const p=[-mesh.positions[i*3],mesh.positions[i*3+1],mesh.positions[i*3+2]],a=thighRest[side][0],b=thighRest[side][1],axis=b.map((v,k)=>v-a[k]);
     const length2=axis.reduce((n,v)=>n+v*v,0),t=axis.reduce((n,v,k)=>n+(p[k]-a[k])*v,0)/length2;
     if(t<.08||t>.9)continue;
     this.thighRadii[side]=Math.max(this.thighRadii[side],Math.hypot(...p.map((v,k)=>v-a[k]-axis[k]*t))+.012*s);
    }
    const y=mesh.positions[i*3+1]*mesh.extent[1]+mesh.origin[1];if(y<top-length-.025*s||y>top+.025*s)continue;
    let bodyWeight=0;for(let k=0;k<8;k++)if(allowed.has(mesh.binding.ids[i*8+k]))bodyWeight+=mesh.binding.weights[i*8+k]/65535;
    if(bodyWeight<.45)continue;
    const x=-(mesh.positions[i*3]*mesh.extent[0]+mesh.origin[0])-cx,z=mesh.positions[i*3+2]*mesh.extent[2]+mesh.origin[2]-cz;
    const ring=rings[Math.max(0,Math.min(levels,Math.round((top-y)/length*levels)))];
    ring.rx=Math.max(ring.rx,Math.abs(x));ring.rz=Math.max(ring.rz,Math.abs(z));ring.points.push([x,z]);
   }
  }
  for(const ring of rings){let gain=1;for(const [x,z]of ring.points)gain=Math.max(gain,Math.hypot(x/ring.rx,z/ring.rz));ring.rx=ring.rx*gain+.012*s;ring.rz=ring.rz*gain+.012*s;delete ring.points;}
  // Carry the widest hip clearance down to the hem so the coverage layer does
  // not pinch into the gap between legs or follow the genital silhouette.
  for(let i=1;i<=levels;i++){rings[i].rx=Math.max(rings[i].rx,rings[i-1].rx+.0018*s);rings[i].rz=Math.max(rings[i].rz,rings[i-1].rz+.001*s);}
  const values=[],indices=[];
  const point=(angle,t,inflate=0)=>{const f=Math.max(0,Math.min(levels,t*levels)),a=Math.floor(f),b=Math.min(levels,a+1),w=f-a;
   // Extra drape allowance clears the posed thigh volume as the neutral source
   // legs settle into the live stance. Keep the waistband fitted, flare below it.
   const drape=Math.min(1,t),rx=rings[a].rx*(1-w)+rings[b].rx*w+inflate+.08*s*drape,rz=rings[a].rz*(1-w)+rings[b].rz*w+inflate+.11*s*drape;
   return[cx+Math.sin(angle)*rx,top-t*length,cz+Math.cos(angle)*rz];};
  const vertex=(angle,t,u,tone,kind,inflate=0)=>{const id=values.length/10;values.push(...point(angle,t,inflate),Math.sin(angle),0,Math.cos(angle),u,t,tone,kind);return id;};
  const quad=(a,b,c,d)=>indices.push(a,b,c,b,d,c);
  const rand=i=>{const v=Math.sin(i*127.1+(h.characterPreset.seed+1)*.031)*43758.5453;return v-Math.floor(v);};
  const sectors=128;
  // Continuous opaque woven backing, with no alpha gaps.
  for(let row=0;row<levels;row++)for(let i=0;i<sectors;i++){
   const a=i/sectors*Math.PI*2,b=(i+1)/sectors*Math.PI*2,t=row/levels,u=(row+1)/levels;
   quad(vertex(a,t,0,.5,0),vertex(b,t,1,.5,0),vertex(a,u,0,.5,0),vertex(b,u,1,.5,0));
  }
  // Two staggered layers of individually tapered, creased grass blades.
  for(let layer=0;layer<2;layer++)for(let i=0;i<sectors;i++){
   const angle=(i+layer*.47)/sectors*Math.PI*2,tone=rand(i+layer*sectors),end=1.02+.09*rand(i+401+layer),width=Math.PI*2/sectors*(1.08+.32*rand(i+91));
   const grid=[];
   for(let row=0;row<=8;row++){const t=row/8,endT=t*end,taper=t>.78?Math.max(.10,1-(t-.78)/.22*.90):1;
    const strip=[];for(let col=0;col<3;col++){const across=col/2,a=angle+(across-.5)*width*taper;
     strip.push(vertex(a,endT,across,tone,1,(.004+layer*.004+Math.sin(across*Math.PI)*.003)*s));}
    grid.push(strip);
   }
   for(let row=0;row<8;row++)for(let col=0;col<2;col++)quad(grid[row][col],grid[row][col+1],grid[row+1][col],grid[row+1][col+1]);
  }
  for(let row=0;row<3;row++)for(let i=0;i<sectors;i++){
   const a=i/sectors*Math.PI*2,b=(i+1)/sectors*Math.PI*2,t=row*.022,u=(row+1)*.022;
   quad(vertex(a,t,i/sectors,.55,2,.014*s),vertex(b,t,(i+1)/sectors,.55,2,.014*s),vertex(a,u,i/sectors,.55,2,.014*s),vertex(b,u,(i+1)/sectors,.55,2,.014*s));
  }
  const gl=this.gl;this.count=indices.length;this.geometryBytes=values.length*4+indices.length*2;
  this.report={generator:'procedural-grass-skirt@2',triangles:indices.length/3,blades:sectors*2,opaqueCoverage:true,waistY:top,lengthM:length,geometryBytes:this.geometryBytes,
   clearance:{method:'posed-thigh-capsules-and-flat-ground',radiiM:[...this.thighRadii],iterations:3,clothDynamics:false}};
  try{
   this.main=program(gl,GRASS_SKIRT_VERTEX,GRASS_SKIRT_FRAGMENT);this.depth=program(gl,GRASS_SKIRT_VERTEX,'#version 300 es\nprecision highp float;void main(){}');
   for(const p of [this.main,this.depth])for(const name of ['compactPalette','skirtJoints','skirtTime','skirtScale','skirtColour','skirtThighs[0]'])p.u[name]=gl.getUniformLocation(p.p,name);
   this.joints=['hips','left_femur','right_femur'].map(id=>h.joints.findIndex(j=>j.id===id));
   this.colour=h.characterPreset.seed===260912?[.48,.54,.22]:[.69,.61,.32];
   this.vao=gl.createVertexArray();if(!this.vao)throw Error('无法创建草裙绘制数组');gl.bindVertexArray(this.vao);
   const upload=(target,array)=>{const b=gl.createBuffer();if(!b)throw Error('无法创建草裙几何缓冲');this.buffers.push(b);gl.bindBuffer(target,b);gl.bufferData(target,array,gl.STATIC_DRAW);};
   upload(gl.ARRAY_BUFFER,new Float32Array(values));upload(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices));
   for(const [location,size,offset]of [[0,3,0],[1,3,3],[2,2,6],[3,2,8]]){gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,40,offset*4);}
   gl.bindVertexArray(null);
  }catch(error){this.dispose();throw error;}
 }
 draw(depth){
  const surface=this.surface;if(this.disposed||!surface.visible)return;
  const gl=this.gl,r=surface.renderer,p=depth?this.depth:this.main;gl.useProgram(p.p);
  gl.activeTexture(gl.TEXTURE0+COMPACT_PALETTE_UNIT);gl.bindTexture(gl.TEXTURE_2D,surface.texture);gl.uniform1i(p.u.compactPalette,COMPACT_PALETTE_UNIT);
  gl.uniformMatrix4fv(p.u.viewProjection,false,depth?r.lightVP:r.vp);gl.uniform3iv(p.u.skirtJoints,this.joints);gl.uniform1f(p.u.skirtScale,surface.statureScale);
  for(let side=0;side<2;side++)for(let end=0;end<2;end++){
   const j=surface.boundHuman.byId.get(['left','right'][side]+(end?'_tibia':'_femur')),at=(side*2+end)*4;
   this.thighUniform.set(j.world.p,at);this.thighUniform[at+3]=this.thighRadii[side]*(end?.85:1);
  }
  gl.uniform4fv(p.u['skirtThighs[0]'],this.thighUniform);
  gl.uniform1f(p.u.skirtTime,surface.lab.agent?.time||0);if(!depth)gl.uniform3fv(p.u.skirtColour,this.colour);
  gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);gl.bindVertexArray(this.vao);gl.drawElements(gl.TRIANGLES,this.count,gl.UNSIGNED_SHORT,0);
  if(depth)r.shadowDrawCalls++;else r.drawCalls++;gl.bindVertexArray(null);gl.activeTexture(gl.TEXTURE0);
 }
 dispose(){if(this.disposed)return;this.disposed=true;const gl=this.gl;for(const b of this.buffers)gl.deleteBuffer(b);if(this.vao)gl.deleteVertexArray(this.vao);if(this.main)gl.deleteProgram(this.main.p);if(this.depth)gl.deleteProgram(this.depth.p);this.buffers=[];}
}
