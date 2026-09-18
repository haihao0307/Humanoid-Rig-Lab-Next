// Linen replacement for the existing human grass skirt. Real garment geometry.
// Uses the same individual surface envelope, palette, and movement attachment.
// This remains a skinned garment, not a physical cloth solver.
// Enlarge all procedural textile features while retaining physical rest UVs.
const LINEN_TEXTURE_SCALE=3;
const LINEN_SKIRT_VERTEX=`#version 300 es
precision highp float;
layout(location=0)in vec3 position;
layout(location=1)in vec3 normal;
layout(location=2)in vec2 uv;
layout(location=3)in vec3 detail;
uniform mat4 viewProjection,lightVP;
uniform sampler2D compactPalette;
uniform ivec3 skirtJoints;
uniform float skirtTime,skirtScale;
uniform vec4 skirtThighs[4];
out vec3 W,N;
out vec2 C;out vec4 linenShadow;
vec3 spin(vec4 q,vec3 p){return p+2.*cross(q.xyz,cross(q.xyz,p)+q.w*p);}
vec3 posed(int id,vec3 p){vec4 q=texelFetch(compactPalette,ivec2(0,id),0),d=texelFetch(compactPalette,ivec2(1,id),0);return spin(q,p)+2.*(q.w*d.xyz-d.w*q.xyz+cross(q.xyz,d.xyz));}
vec3 clearThigh(vec3 p,vec4 a,vec4 b,vec3 fallback){
 vec3 axis=b.xyz-a.xyz;float t=clamp(dot(p-a.xyz,axis)/max(dot(axis,axis),1e-9),0.,1.);
 vec3 centre=mix(a.xyz,b.xyz,t),delta=p-centre;float radius=max(.001,mix(a.w,b.w,t)+detail.z),d=length(delta);
 return d<radius?centre+(d>1e-6?delta/d:normalize(fallback))*radius:p;
}
void main(){
 vec3 p=position;
 float hang=detail.y<1.5?pow(clamp(detail.x,0.,1.),2.):0.;
 vec3 pelvis=posed(skirtJoints.x,p),legs=(posed(skirtJoints.y,p)+posed(skirtJoints.z,p))*.5;
 vec3 worldPoint=mix(pelvis,legs,.32*hang);
 vec3 worldNormal=normalize(mix(spin(texelFetch(compactPalette,ivec2(0,skirtJoints.x),0),normal),(spin(texelFetch(compactPalette,ivec2(0,skirtJoints.y),0),normal)+spin(texelFetch(compactPalette,ivec2(0,skirtJoints.z),0),normal))*.5,.32*hang));
 // All linen panels and turned hems use the current thigh envelope.
 // This is bounded geometric clearance, not a cloth/force simulation.
 if(detail.x>.07&&detail.y<1.5)for(int iteration=0;iteration<3;iteration++){
  worldPoint=clearThigh(worldPoint,skirtThighs[0],skirtThighs[1],worldNormal);
  worldPoint=clearThigh(worldPoint,skirtThighs[2],skirtThighs[3],worldNormal);
  worldPoint.y=max(worldPoint.y,.006*skirtScale);
 }
 W=worldPoint;N=worldNormal;C=uv/${LINEN_TEXTURE_SCALE.toFixed(1)};linenShadow=lightVP*vec4(worldPoint,1.);gl_Position=viewProjection*vec4(worldPoint,1.);
}`;
class ProceduralLinenSkirt {
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
     const p=[-(mesh.positions[i*3]*mesh.extent[0]+mesh.origin[0]),mesh.positions[i*3+1]*mesh.extent[1]+mesh.origin[1],mesh.positions[i*3+2]*mesh.extent[2]+mesh.origin[2]],a=thighRest[side][0],b=thighRest[side][1],axis=b.map((v,k)=>v-a[k]);
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
  const values=[],indices=[],panelCount=8,sectors=96,rows=28,thickness=.0009*s;
  const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
  const envelope=t=>{const f=Math.max(0,Math.min(levels,t*levels)),a=Math.floor(f),b=Math.min(levels,a+1),w=smooth(f-a);return {rx:rings[a].rx*(1-w)+rings[b].rx*w,rz:rings[a].rz*(1-w)+rings[b].rz*w};};
  const point=(a,t,offset=0)=>{
   const e=envelope(t),fold=.0065*s*(.18+.82*smooth(t))*(Math.sin(a*12+.5)+.34*Math.sin(a*19+.8));
   const rx=e.rx+.065*s*t+fold+offset,rz=e.rz+.085*s*t+fold+offset;
   const hem=.003*s*Math.sin(a*5+.4)*smooth((t-.75)/.25);
   return [cx+Math.sin(a)*rx,top-t*length+hem,cz+Math.cos(a)*rz];
  };
  const minus=(a,b)=>a.map((v,k)=>v-b[k]),cross3=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit3=a=>{const l=Math.hypot(...a);if(!(l>1e-12))throw Error('Invalid linen surface tangent');return a.map(v=>v/l);};
  const normalAt=(a,t)=>unit3(cross3(minus(point(a,Math.min(1,t+.0001)),point(a,Math.max(0,t-.0001))),minus(point(a+.0001,t),point(a-.0001,t))));
  const arc=(from,to,t)=>{let d=0,last=point(from,t);for(let i=1;i<=12;i++){const p=point(from+(to-from)*i/12,t);d+=Math.hypot(...minus(p,last));last=p;}return d*Math.sign(to-from);};
  const vertex=(a,t,offset,panel,kind=0,inward=false)=>{const p=point(a,t,offset),n=normalAt(a,t).map(v=>v*(inward?-1:1)),centre=(panel+.5)*Math.PI*2/panelCount;
   const id=values.length/11;values.push(...p,...n,arc(centre,a,t)*100,t*length*100,t,kind,offset);return id;};
  const quad=(a,b,c,d,inside=false)=>indices.push(...(inside?[a,b,c,b,d,c]:[a,c,b,b,c,d]));
  const panelRanges=[];
  // Eight separately parameterized gores. They meet on full shared boundaries;
  // the interior layer and turned edges are geometry, not painted stitch lines.
  for(let panel=0;panel<panelCount;panel++){
   const start=indices.length,a0=panel*Math.PI*2/panelCount,a1=(panel+1)*Math.PI*2/panelCount,cols=sectors/panelCount;
   for(const inside of [false,true]){const grid=[];for(let row=0;row<=rows;row++){const strip=[];for(let col=0;col<=cols;col++)strip.push(vertex(a0+(a1-a0)*col/cols,row/rows,inside?-thickness:0,panel,0,inside));grid.push(strip);}for(let row=0;row<rows;row++)for(let col=0;col<cols;col++)quad(grid[row][col],grid[row][col+1],grid[row+1][col],grid[row+1][col+1],inside);}
   // 8 mm turned seam allowances lie inside each real panel boundary.
   for(const side of [0,1]){const a=side?a1:a0,sign=side?-1:1;for(let row=2;row<rows-1;row++){const t=row/rows,u=(row+1)/rows,w=.008*s/Math.max(.1,envelope(t).rx);quad(vertex(a,t,-thickness,panel),vertex(a+sign*w,t,-.0024*s,panel),vertex(a,u,-thickness,panel),vertex(a+sign*w,u,-.0024*s,panel));}}
   panelRanges.push({panel,firstIndex:start,indexCount:indices.length-start});
  }
  // Turned hem: connect the outer and inner surfaces with a rounded lower edge.
  // Waistband: a separate 28 mm fabric band with an actual upper return.
  for(let i=0;i<sectors;i++){
   const a=i/sectors*Math.PI*2,b=(i+1)/sectors*Math.PI*2,panel=Math.floor(i/(sectors/panelCount));
   quad(vertex(a,1,0,panel),vertex(b,1,0,panel),vertex(a,1,-thickness,panel,0,true),vertex(b,1,-thickness,panel,0,true));
   for(const [t,u,off,kind]of [[.956,.980,.0012*s,0],[.980,1,.0011*s,0],[0,.035,.0018*s,2],[.035,.070,.0018*s,2]])quad(vertex(a,t,off,panel,kind),vertex(b,t,off,panel,kind),vertex(a,u,off,panel,kind),vertex(b,u,off,panel,kind));
   quad(vertex(a,0,.0018*s,panel,2),vertex(b,0,.0018*s,panel,2),vertex(a,0,-thickness,panel,2,true),vertex(b,0,-thickness,panel,2,true));
  }
  if(values.some(v=>!Number.isFinite(v))||values.length/10>65535)throw Error('Invalid linen geometry');
  const gl=this.gl;this.count=indices.length;this.geometryBytes=values.length*4+indices.length*2;
  this.report={generator:'procedural-linen-skirt@1',material:LINEN_MATERIAL_SOURCE.material,triangles:indices.length/3,panels:panelCount,panelRanges,blades:0,opaqueCoverage:true,waistY:top,lengthM:length,thicknessM:thickness,geometryBytes:this.geometryBytes,materialCoordinates:'centimeter, independent gore rest coordinates',textureScale:LINEN_TEXTURE_SCALE,hem:'turned geometry',waistband:'separate geometry',clearance:{method:'inherited posed thigh envelope and floor',radiiM:[...this.thighRadii],iterations:3,clothDynamics:false}};
  try{
   this.main=program(gl,LINEN_SKIRT_VERTEX,LINEN_MATERIAL_FRAGMENT);this.depth=program(gl,LINEN_SKIRT_VERTEX,'#version 300 es\nprecision highp float;void main(){}');
   for(const p of [this.main,this.depth])for(const name of ['compactPalette','skirtJoints','skirtTime','skirtScale','skirtColour','skirtThighs[0]'])p.u[name]=gl.getUniformLocation(p.p,name);
   this.joints=['hips','left_femur','right_femur'].map(id=>h.joints.findIndex(j=>j.id===id));
   this.materialUniforms=Object.fromEntries(['uCam','uMode','uMaterial','uLight','uNeutral','uCompare','uDiag','uViewport','uTime','uCoarse','uWeave','uSlub','uAge','uFarId','uSheen','uFuzz'].map(k=>[k,gl.getUniformLocation(this.main.p,k)]));
   this.vao=gl.createVertexArray();if(!this.vao)throw Error('无法创建亚麻裙绘制数组');gl.bindVertexArray(this.vao);
   const upload=(target,array)=>{const b=gl.createBuffer();if(!b)throw Error('无法创建亚麻裙几何缓冲');this.buffers.push(b);gl.bindBuffer(target,b);gl.bufferData(target,array,gl.STATIC_DRAW);};
   upload(gl.ARRAY_BUFFER,new Float32Array(values));upload(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices));
   for(const [location,size,offset]of [[0,3,0],[1,3,3],[2,2,6],[3,3,8]]){gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,44,offset*4);}
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
  gl.uniform1f(p.u.skirtTime,surface.lab.agent?.time||0);if(!depth){const u=this.materialUniforms;gl.uniform3fv(u.uCam,r.eye);gl.uniform2f(u.uViewport,gl.drawingBufferWidth,gl.drawingBufferHeight);for(const [key,value]of Object.entries({uMode:2,uMaterial:0,uLight:0,uNeutral:0,uCompare:0,uDiag:0}))gl.uniform1i(u[key],value);for(const [key,value]of Object.entries({uCoarse:1,uWeave:1,uSlub:1,uAge:.35,uFarId:1,uSheen:1,uFuzz:1,uTime:0}))gl.uniform1f(u[key],value);gl.uniformMatrix4fv(p.u.lightVP,false,r.lightVP);gl.uniform1i(p.u.shadow,1);gl.uniform1f(p.u.shadowsEnabled,r.quality==='shadow'&&r.shadowAvailable?1:0);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,r.shadow);}
  gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);gl.bindVertexArray(this.vao);gl.drawElements(gl.TRIANGLES,this.count,gl.UNSIGNED_SHORT,0);
  if(depth)r.shadowDrawCalls++;else r.drawCalls++;gl.bindVertexArray(null);gl.activeTexture(gl.TEXTURE0);
 }
 dispose(){if(this.disposed)return;this.disposed=true;const gl=this.gl;for(const b of this.buffers)gl.deleteBuffer(b);if(this.vao)gl.deleteVertexArray(this.vao);if(this.main)gl.deleteProgram(this.main.p);if(this.depth)gl.deleteProgram(this.depth.p);this.buffers=[];}
}
