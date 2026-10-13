const V=(...a)=>new T.Vector3(...a),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function rectangle(w,h,r=4){const s=new T.Shape(),x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;}
function borderPoints(w,h,r=5,margin=3.2){return rectangle(w-2*margin,h-2*margin,Math.max(.5,r-margin)).getPoints(12).map(p=>[p.x,p.y]);}
class PanelAssembly{
 constructor(mats,config={}){this.root=new T.Group();this.parts=[];this.mats=mats;this.config={thicknessScale:1,tension:.8,response:true,age:0,craft:'plain',...config};this.positions=[];this.triangles=[];this.links=[];this.surfaceLinks=[];this.extraMass=[];this.skinMeshes=[];this.seams=[];this.nextId=0;this.weld=new Map();}
 // Explicit material-chart pipeline. Services are linked before construction.
 add(input){return PatternPhysics.add.call(this,AssemblyContract.prepare.call(this,input));}
 idsAt(part,u,v){return PatternPhysics.idsAt.call(this,part,u,v);}
 binding(part,u,v,p,n){return PatternPhysics.binding.call(this,part,u,v,p,n);}
 yarnBinding(path,panel,u,v,p,n){return YarnHost.binding.call(this,path,panel,u,v,p,n);}
 geometry(pos,nor,uv,idx,bindings){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(nor,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('uv1',g.attributes.uv.clone());g.setAttribute('compression',new T.Float32BufferAttribute(new Float32Array(pos.length/3),1));if(!this.config.thumbnail)for(const[name,key,size]of[['simIDs','ids',4],['simWeights','weights',4],['simDelta','delta',3],['simNormal','normal',3],['ageMask','age',3],['simIDsB','idsB',4],['simWeightsB','weightsB',4],['simDeltaB','deltaB',3],['simNormalB','normalB',3],['simBlend','blend',1]]){const dual=bindings.some(v=>v.blend!==undefined);if(key.endsWith('B')||key==='blend'){if(!dual)continue;}const packed=new Float32Array(bindings.length*size);for(let i=0;i<bindings.length;i++){const v=bindings[i],q=v[key]??(key==='blend'?[0]:v[key.slice(0,-1)]);for(let k=0;k<size;k++)packed[i*size+k]=q[k];}g.setAttribute(name,new T.BufferAttribute(packed,size));}g.setIndex(idx);g.computeBoundingSphere();return g;}
 buildPanel(part){return ClosedShell.buildPanel.call(this,part);}
 connect(a,uvA,b,uvB){this.connectBase(a,uvA,b,uvB);AssemblyContract.recordConnection.call(this,a,uvA,b,uvB);}
 connectBase(a,uvA,b,uvB){
  const A=this.idsAt(a,...uvA),B=this.idsAt(b,...uvB),weights=new Map();
  for(let i=0;i<4;i++){weights.set(A.ids[i],(weights.get(A.ids[i])||0)+A.weights[i]);weights.set(B.ids[i],(weights.get(B.ids[i])||0)-B.weights[i]);}
  const entries=[...weights].filter(([,w])=>Math.abs(w)>1e-10);if(!entries.length)return;
  const delta=V();for(const[id,w]of entries)delta.addScaledVector(V(...this.positions.slice(id*3,id*3+3)),w);
  this.surfaceLinks.push({ids:entries.map(e=>e[0]),weights:entries.map(e=>e[1]),length:delta.length()*.001,stiffness:100000});
 }
 attachRigid(object,part,u,v,massKg=0){object.updateMatrixWorld(true);const source=[];object.traverse(m=>{if(!m.isMesh)return;let g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();g.applyMatrix4(m.matrixWorld);const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv,bindings=[];for(let i=0;i<p.count;i++)bindings.push(this.binding(part,u,v,V().fromBufferAttribute(p,i),V().fromBufferAttribute(n,i)));const ng=this.geometry(Array.from(p.array),Array.from(n.array),uv?Array.from(uv.array):Array(p.count*2).fill(0),Array.from({length:p.count},(_,i)=>i),bindings);const nm=new T.Mesh(ng,m.material);nm.name='RIGID_FITTING/'+(m.name||'metal');nm.castShadow=nm.receiveShadow=true;nm.userData.hardware=true;this.root.add(nm);this.skinMeshes.push(nm);source.push(nm);});const ids=this.idsAt(part,u,v);for(let i=0;i<4;i++)this.extraMass.push([ids.ids[i],massKg*ids.weights[i]]);return source;}
 finish(){const root=this.finalizeBase();PatternPhysics.finalize.call(this,root);return AssemblyContract.finalize.call(this,root);}
 finalizeBase(){this.root.updateMatrixWorld(true);const b=new T.Box3().setFromObject(this.root),shift=.8-b.min.y;for(const m of this.skinMeshes){m.geometry.translate(0,shift,0);}for(let i=1;i<this.positions.length;i+=3)this.positions[i]+=shift;
  const data={positions:this.positions,triangles:this.triangles,links:this.links,surfaceLinks:this.surfaceLinks,extraMass:this.extraMass};const pixels=new Float32Array(this.positions.length/3*4);for(let i=0;i<this.positions.length/3;i++){pixels[i*4]=this.positions[i*3];pixels[i*4+1]=this.positions[i*3+1];pixels[i*4+2]=this.positions[i*3+2];pixels[i*4+3]=1;}const texture=new T.DataTexture(pixels,1,pixels.length/4,T.RGBAFormat,T.FloatType);texture.needsUpdate=true;
  const rig={staticPreview:!!this.config.thumbnail,data,texture,pixels,meshes:this.skinMeshes,parts:this.parts,seams:this.seams,age:this.config.age,bindingShift:shift};this.root.userData.rig=rig;this.root.userData.center=new T.Box3().setFromObject(this.root).getCenter(V());this.root.userData.patternReady=false;return this.root;
 }
}
const SKIN_HEADER=`uniform sampler2D uProductNodes;uniform float uProductNodeCount;
attribute vec4 simIDs;attribute vec4 simWeights;attribute vec3 simDelta;attribute vec3 simNormal;attribute vec3 ageMask;
attribute vec4 simIDsB;attribute vec4 simWeightsB;attribute vec3 simDeltaB;attribute vec3 simNormalB;attribute float simBlend;
varying vec3 vAgeMask;varying vec3 vRestMM;
vec3 nodePos(float id){return texelFetch(uProductNodes,ivec2(0,int(id)),0).xyz;}
vec3 nodeFrame(float id,float x){return texelFetch(uProductNodes,ivec2(int(x*3.),int(id)),0).xyz;}
mat3 basisFor(vec4 ids,vec4 weights){vec3 x=nodeFrame(ids.x,.5)*weights.x+nodeFrame(ids.y,.5)*weights.y+nodeFrame(ids.z,.5)*weights.z+nodeFrame(ids.w,.5)*weights.w;vec3 n=nodeFrame(ids.x,5./6.)*weights.x+nodeFrame(ids.y,5./6.)*weights.y+nodeFrame(ids.z,5./6.)*weights.z+nodeFrame(ids.w,5./6.)*weights.w;vec3 z=normalize(n+vec3(0.,1e-15,0.));x=normalize(x-z*dot(x,z)+vec3(1e-15,0.,0.));return mat3(x,cross(z,x),z);}
mat3 productBasis(){return basisFor(simIDs,simWeights);}
vec3 pointFor(vec4 ids,vec4 w,vec3 delta,mat3 basis){return nodePos(ids.x)*w.x+nodePos(ids.y)*w.y+nodePos(ids.z)*w.z+nodePos(ids.w)*w.w+basis*delta;}
vec3 productPoint(mat3 basis){vec3 p=pointFor(simIDs,simWeights,simDelta,basis);if(simBlend<=0.)return p;return mix(p,pointFor(simIDsB,simWeightsB,simDeltaB,basisFor(simIDsB,simWeightsB)),simBlend);}`;
function skinMaterial(source,rig,ageEnabled=true){
 const m=source.clone(),prior=source.onBeforeCompile;m.defaultAttributeValues={...(source.defaultAttributeValues||{}),simIDsB:[0,0,0,0],simWeightsB:[0,0,0,0],simDeltaB:[0,0,0],simNormalB:[0,0,1],simBlend:[0]};const previousKey=source.customProgramCacheKey?.()||'';m.onBeforeCompile=s=>{prior?.call(m,s);s.uniforms.uProductNodes={value:rig.texture};s.uniforms.uProductNodeCount={value:rig.nodeCount||rig.pixels.length/4};s.uniforms.uPatina={value:rig.age};m.userData.shader=s;
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\n'+SKIN_HEADER).replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nmat3 skinBasis=productBasis();objectNormal=normalize(skinBasis*simNormal);if(simBlend>0.)objectNormal=normalize(mix(objectNormal,basisFor(simIDsB,simWeightsB)*simNormalB,simBlend));').replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed=productPoint(productBasis());vAgeMask=ageMask;vRestMM=position;');
  if(ageEnabled){s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>\nuniform float uPatina;varying vec3 vAgeMask;varying vec3 vRestMM;
float ageNoise(vec3 p){return fract(sin(dot(p,vec3(12.989,78.231,31.117)))*43758.5453);}`);
   s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
float largeWear=.5+.5*sin(vRestMM.x*.039+sin(vRestMM.z*.081)*1.8+vRestMM.y*.043);
float fineWear=ageNoise(floor(vRestMM*vec3(7.,14.,5.)));
float rimWear=clamp(vAgeMask.x,0.,1.)*(.4+.6*largeWear);
float polish=uPatina*(rimWear*.48+vAgeMask.y*.20);
float sunFade=uPatina*vAgeMask.z*(.035+.065*largeWear);
diffuseColor.rgb*=1.+sunFade-rimWear*uPatina*.12;
diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*1.42+vec3(.027,.012,.004),uPatina*rimWear*.36);
float scratches=pow(fineWear,48.)*smoothstep(.42,.7,largeWear)*rimWear*uPatina;
diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*1.8+vec3(.028,.020,.01),scratches*.48);`);
   s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor-polish*.16+sunFade*.18,.14,.98);');
  }
 };m.customProgramCacheKey=()=>previousKey+'-R16-integer-node-fetch-'+ageEnabled;return m;
}
function installSkin(root){const rig=root.userData.rig;if(rig.staticPreview)return;const cache=new Map();const mat=(m,age)=>{const key=m.uuid+age;if(!cache.has(key))cache.set(key,skinMaterial(m,rig,age));return cache.get(key);};for(const mesh of rig.meshes){mesh.material=Array.isArray(mesh.material)?mesh.material.map((m,i)=>mat(m,true)):mat(mesh.material,!mesh.userData.thread);const depth=skinMaterial(new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking}),rig,false);mesh.customDepthMaterial=depth;mesh.frustumCulled=false;}rig.materialCache=cache;}
// Same material-frame embedding as R09; reusable scalar buffers replace
// per-node/per-face Vector3, slice and closure allocations. Geometry is unchanged.
function frameField(r,x){const N=r.nodeCount,pool=r._framePool||(r._framePool={t:new Float64Array(3*N),n:new Float64Array(3*N),out:new Float64Array(9*N)}),T=pool.t,Z=pool.n,O=pool.out;T.fill(0);Z.fill(0);
 for(const f of r.frameTriangles){const a=f.ids[0]*3,b=f.ids[1]*3,c=f.ids[2]*3,ex=x[b]-x[a],ey=x[b+1]-x[a+1],ez=x[b+2]-x[a+2],wx=x[c]-x[a],wy=x[c+1]-x[a+1],wz=x[c+2]-x[a+2],D=f.inv;
  let ux=ex*D[0]+wx*D[2],uy=ey*D[0]+wy*D[2],uz=ez*D[0]+wz*D[2],vx=ex*D[1]+wx*D[3],vy=ey*D[1]+wy*D[3],vz=ez*D[1]+wz*D[3];let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const il=1/(Math.sqrt(nx*nx+ny*ny+nz*nz)||1),area=f.flip?-f.area:f.area,iu=1/(Math.sqrt(ux*ux+uy*uy+uz*uz)||1);nx=nx*il*area;ny=ny*il*area;nz=nz*il*area;ux=ux*iu*f.area;uy=uy*iu*f.area;uz=uz*iu*f.area;
  for(const id of f.ids){const i=3*id;T[i]+=ux;T[i+1]+=uy;T[i+2]+=uz;Z[i]+=nx;Z[i+1]+=ny;Z[i+2]+=nz;}}
 for(let i=0;i<N;i++){const j=3*i,o=9*i,f=r.referenceFrames[i];let nx=Z[j],ny=Z[j+1],nz=Z[j+2],inv=1/(Math.sqrt(nx*nx+ny*ny+nz*nz)||1);nx*=inv;ny*=inv;nz*=inv;if(nx*nx+ny*ny+nz*nz<.1){nx=f.n.x;ny=f.n.y;nz=f.n.z;}let tx=T[j],ty=T[j+1],tz=T[j+2],d=-(tx*nx+ty*ny+tz*nz);tx+=nx*d;ty+=ny*d;tz+=nz*d;inv=1/(Math.sqrt(tx*tx+ty*ty+tz*tz)||1);tx*=inv;ty*=inv;tz*=inv;if(tx*tx+ty*ty+tz*tz<.1){tx=f.t.x;ty=f.t.y;tz=f.t.z;}O[o]=tx;O[o+1]=ty;O[o+2]=tz;O[o+3]=ny*tz-nz*ty;O[o+4]=nz*tx-nx*tz;O[o+5]=nx*ty-ny*tx;O[o+6]=nx;O[o+7]=ny;O[o+8]=nz;}
 return O;
}
function updateSkin(root,solver){const r=root.userData.rig;if(!r.nodeCount)throw Error('Physical skin contract missing');if(!r._r10Rest)r._r10Rest=frameField(r,solver.rest).slice();const A=r._r10Rest,B=frameField(r,solver.x),P=r.pixels;
 for(let i=0;i<r.nodeCount;i++){const o=9*i,f=r.referenceFrames[i];for(let k=0;k<3;k++)P[12*i+k]=solver.x[3*i+k]*1000;for(let side=0;side<2;side++){const v=side?f.n:f.t,da=v.x*A[o]+v.y*A[o+1]+v.z*A[o+2],db=v.x*A[o+3]+v.y*A[o+4]+v.z*A[o+5],dc=v.x*A[o+6]+v.y*A[o+7]+v.z*A[o+8];let x=B[o]*da+B[o+3]*db+B[o+6]*dc,y=B[o+1]*da+B[o+4]*db+B[o+7]*dc,z=B[o+2]*da+B[o+5]*db+B[o+8]*dc;const inv=1/(Math.sqrt(x*x+y*y+z*z)||1),at=12*i+(side?8:4);P[at]=x*inv;P[at+1]=y*inv;P[at+2]=z*inv;}}r.texture.needsUpdate=true;
}

function reskinMaterial(root,top){const rig=root.userData.rig;if(rig.staticPreview){for(const mesh of rig.meshes)if(mesh.userData.leather){if(Array.isArray(mesh.material))mesh.material[0]=top;else if(mesh.userData.binding)mesh.material=top;}return;}if(!rig.topVariants)rig.topVariants=new Map();if(!rig.topVariants.has(top.uuid)){for(const mat of rig.topVariants.values())mat.dispose();rig.topVariants.clear();rig.topVariants.set(top.uuid,skinMaterial(top,rig,true));}const m=rig.topVariants.get(top.uuid);for(const mesh of rig.meshes)if(mesh.userData.leather){if(Array.isArray(mesh.material))mesh.material[0]=m;else if(mesh.userData.binding)mesh.material=m;}}