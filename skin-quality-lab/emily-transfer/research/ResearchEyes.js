import * as THREE from 'three';
import {FittedEyes} from '../eyes/FittedEyes.js';
import {REFERENCE_RAILS} from './ReferenceRails.js';
const clamp=THREE.MathUtils.clamp,lerp=THREE.MathUtils.lerp;
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const TAU=Math.PI*2;
/** A rasterized, contact-constrained adaptation of the papers' principles.
 * Not a trained AniEyelid network or a ShellNeRF volume. Units: metres.
 * Neutral margin proportions are measured from the CC0 MakeHuman hm08 mesh.
 */
function rail(u,upper){
 u=clamp(u,-1,1);const x=Math.abs(u),side=u<0?-1:1;
 const c=upper?[.38441346288415335,-.060,.10,.025]:[-.26980682201867545,-.040,-.07,-.003966655456640926];
 const residual=v=>(1-v*v)*(c[0]+v*(c[1]+v*(c[2]+v*c[3])));
 const k=upper?1:2,baseline=lerp(REFERENCE_RAILS[0][k],REFERENCE_RAILS[32][k],(u+1)*.5);
 const join=side<0?.72:.78;
 if(x<=join)return baseline+residual(u);
 const l=1-join,t=(x-join)/l,h=.00001,r0=residual(side*join);
 const d0=(residual(side*(join+h))-residual(side*(join-h)))/(2*h);
 const d1=upper?(side<0?-.50:-.62):(side<0?.27:.30);
 // Cubic Hermite meets the measured centre with a continuous tangent and the
 // canthus with a finite angle: no rectangular corner, no zero-angle cusp.
 return baseline+(2*t*t*t-3*t*t+1)*r0+(t*t*t-2*t*t+t)*l*d0+(t*t*t-t*t)*l*d1;
}
function ocularHeight(r,x,y){
 const rho=Math.hypot(x,y),limbus=r*.47,rc=r*.64;
 if(rho>=r)return {z:0,d:0,valid:false};
 const globe=Math.sqrt(r*r-rho*rho),zc=Math.sqrt(r*r-limbus*limbus)-Math.sqrt(rc*rc-limbus*limbus);
 if(rho>=limbus)return {z:globe,d:-rho/globe,valid:true};
 const cornea=zc+Math.sqrt(rc*rc-rho*rho),t=smooth((limbus-rho)/(r*.055));
 return {z:lerp(globe,cornea,t),valid:true};
}
function opticalMesh(r){
 const g=new THREE.SphereGeometry(r,128,96);g.rotateX(Math.PI/2);const p=g.attributes.position;
 for(let i=0;i<p.count;i++)if(p.getZ(i)>0){const h=ocularHeight(r,p.getX(i),p.getY(i));if(h.valid)p.setZ(i,h.z);}
 g.computeVertexNormals();return g;
}
export class ResearchEyes extends FittedEyes {
 constructor(options){
  super(options);
  this.config.squint=0;this.config.manualBlink=-1;
  this.state.reconstruction='ET06 connected palpebral envelope';this.state.trainedNeuralModel=false;
  this.ready=this.ready.then(()=>{
   for(const e of this.eyes){
    // A conservative fit from this head's observed closed outer surface.
    // This estimates depth only; it is not multiview iris-based calibration.
    const oldDepth=e.c.z,r=e.c.radius;let limit=oldDepth,samples=0;
    for(let ix=-12;ix<=12;ix++)for(let iy=-12;iy<=12;iy++){
     const x=ix/12*r*.80,y=iy/12*r*.80;if(x*x+y*y>r*r*.64)continue;
     const observed=e.c.referenceSurface(e.c.x+x,e.c.y+y);
     const envelope=ocularHeight(r,x,y);if(!envelope.valid)continue;
     limit=Math.min(limit,observed.z-envelope.z-.00058);samples++;
    }
    const fitted=Math.max(oldDepth-.004,limit);
    e.c.z=fitted;e.pivot.position.z=fitted;
    e.depthFit={source:'same closed-scan surface',method:'conservative outer-envelope constraint',assumedClosedGaze:'neutral',samples,initialDepthMM:oldDepth*1000,fittedDepthMM:fitted*1000,depthShiftMM:(fitted-oldDepth)*1000,limited:fitted!==limit,notFullPaperCalibration:true};
    e.ball.geometry.dispose();e.ball.geometry=opticalMesh(e.c.radius);
    // Three.js uses scene.environmentIntensity while material.envMap is null.
    // Bind the same environment explicitly so ocular intensity actually works.
    e.ball.material.envMap=this.scene.environment;
    e.ball.material.envMapIntensity=.38;
    e.ball.material.envMapRotation.copy(this.scene.environmentRotation);
    const previous=e.ball.material.onBeforeCompile;
    const edgeData=new Float32Array(64*4),edgeMap=new THREE.DataTexture(edgeData,64,1,THREE.RGBAFormat,THREE.FloatType);
    edgeMap.minFilter=THREE.LinearFilter;edgeMap.magFilter=THREE.LinearFilter;edgeMap.needsUpdate=true;
    e.edgeMap=edgeMap;e.edgeData=edgeData;
    e.ball.material.onBeforeCompile=s=>{
     previous(s);s.uniforms.uLidEdges={value:edgeMap};s.uniforms.uLidHalf={value:e.c.half};
     s.fragmentShader=s.fragmentShader.replace('float orbitContact(){','uniform sampler2D uLidEdges;uniform float uLidHalf;\nfloat orbitContact(){');
     const start=s.fragmentShader.indexOf('float orbitContact(){'),end=s.fragmentShader.indexOf('vec3 ocularAlbedo(){',start);
     s.fragmentShader=s.fragmentShader.slice(0,start)+`float orbitContact(){
      vec3 p=headEyePoint();float u=clamp(p.x/(2.*uLidHalf)+.5,0.,1.);
      vec4 bounds=texture2D(uLidEdges,vec2(u,.5));
      float top=.22+.78*smoothstep(0.,.0024,bounds.r-p.y);
      float bottom=.68+.32*smoothstep(0.,.0012,p.y-bounds.g);
      return top*bottom;
     }\n`+s.fragmentShader.slice(end);
    };
    e.ball.material.customProgramCacheKey=()=> 'ET03-two-sphere-optics-contact-1';e.ball.material.needsUpdate=true;
    const car=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),new THREE.MeshPhysicalMaterial({color:0x945e55,roughness:.36,clearcoat:.65,clearcoatRoughness:.14}));
    car.name='lacrimal-caruncle-'+e.c.name;car.scale.set(.00065,.00039,.00034);this.group.add(car);e.caruncle=car;
   }
   this.update(0,true);this.requestRender();return this;
  });
 }
 eyeFront(c,x,y){
  const e=this._fittingEye,inv=e?.surfaceInverse?.elements,r=c.radius,dx=x-c.x,dy=y-c.y;
  if(dx*dx+dy*dy>=r*r)return null;
  let z=Math.sqrt(r*r-dx*dx-dy*dy);
  // Only the corneal cap differs from the sphere. Its conservative bounding
  // ball is centred 0.98r forward with radius 0.53r. Rays outside its projected
  // disc hit the spherical sclera exactly, without a Newton solve.
  const capX=inv?inv[2]*r*.98:0,capY=inv?inv[6]*r*.98:0;
  if((dx-capX)*(dx-capX)+(dy-capY)*(dy-capY)>r*r*.2809)return c.z+z;
  const f=zz=>{const lx=inv?inv[0]*dx+inv[4]*dy+inv[8]*zz:dx,ly=inv?inv[1]*dx+inv[5]*dy+inv[9]*zz:dy,lz=inv?inv[2]*dx+inv[6]*dy+inv[10]*zz:zz,h=ocularHeight(r,lx,ly);return h.valid?lz-h.z:0;};
  for(let i=0;i<7;i++){const v=f(z),eps=.000004,der=(f(z+eps)-f(z-eps))/(2*eps);if(Math.abs(der)<.12)break;const dz=clamp(v/der,-.002,.002);z-=dz;if(Math.abs(dz)<.00000003)break;}
  return c.z+z;
 }
 margin(c,a,blink){
  const nx=Math.cos(a),upper=Math.sin(a)>=0,u=nx*c.sign,w=Math.max(0,1-nx*nx);
  const top=rail(u,true)*c.half,bottom=rail(u,false)*c.half;
  const pitch=c.gazePitch||0,yaw=c.gazeYaw||0,squint=this.config.squint||0;
  const open=this.config.opening??.88;
  let topOpen=top*open-pitch*.0052*w-.00175*squint*w;
  let bottomOpen=bottom*open-pitch*.0021*w+.00175*squint*w;
  if(topOpen<bottomOpen+.00008*w){const mid=(topOpen+bottomOpen)*.5;topOpen=mid+.00004*w;bottomOpen=mid-.00004*w;}
  const rest=upper?topOpen:bottomOpen;
  const closedY=c.y-.0035+.0028*Math.pow(Math.abs(nx),1.7)-.0007*nx*c.sign;
  const y=lerp(c.y-.0005+rest,closedY,blink);
  const x=c.x+c.half*nx+yaw*.00052*w*(1-blink);
  const front=this.eyeFront(c,x,y),corner=smooth((1-Math.abs(u))/(u<0?.24:.18));
  // Anterior free margin: upper lid is deliberately thicker than lower lid.
  // The posterior surface uses 0.085 mm axial numerical clearance, not a tear-film measurement.
  const openClearance=lerp(.00015,upper?.00078:.00030,corner);
  const clearance=lerp(openClearance,.00032,blink);
  let z=front===null?c.z+.003:front+clearance;
  // The scan anchors surrounding skin; a closing free margin stays on the globe.
  return new THREE.Vector3(x,y,z);
 }
 rimPoint(c,a,blink){return this.margin(c,a,blink);}
 makeLid(c,sample,mat){
  c.referenceSurface=sample;c.closedCurve=new Map();
  const A=256,R=48,p=[],n=[],uv=[],ao=[],ts=[],ix=[],entries=[];
  for(let j=0;j<=R;j++)for(let i=0;i<=A;i++){
   const t=j/R,a=i/A*TAU,nx=Math.cos(a),ny=Math.sin(a),u=nx*c.sign;
   const seam=c.y-.0035+.0028*Math.pow(Math.abs(nx),1.7)-.0007*nx*c.sign;
   const xo=c.x+c.rx*1.004*nx,yo=c.y+c.ry*1.004*ny;
   const xs=lerp(c.x+c.half*nx,xo,t),ys=lerp(seam,yo,t);
   const src=sample(xs,ys),seamSrc=sample(c.x+c.half*nx,seam),outer=sample(xo,yo);
   entries.push({a,t,nx,ny,u,xs,ys,xo,yo,src,seamSrc,outer});p.push(xs,ys,src.z);n.push(src.n.x,src.n.y,src.n.z);uv.push(src.u,src.v);ao.push(src.ao);ts.push(t);
   if(j<R&&i<A){const k=j*(A+1)+i;ix.push(k,k+A+1,k+1,k+1,k+A+1,k+A+2);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('skinOcclusion',new THREE.Float32BufferAttribute(ao,1));g.setAttribute('eyelidT',new THREE.Float32BufferAttribute(ts,1));g.setIndex(ix);
  const old=mat.onBeforeCompile;
  mat.onBeforeCompile=s=>{
   old(s);s.vertexShader='attribute float eyelidT;varying float vLidT;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvLidT=eyelidT;');
   s.vertexShader=s.vertexShader.replace('uRelief*.001*(1.-uBaseline)','uRelief*.001*(1.-uBaseline)*smoothstep(.13,.68,eyelidT)');
   s.uniforms.uResearchPatch={value:new THREE.Vector4(c.x,c.y,c.rx,c.ry)};
   s.fragmentShader='varying float vLidT;uniform vec4 uResearchPatch;\n'+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('normal=normalize(tbn*mapN);','mapN.xy*=mix(.08,1.,smoothstep(.16,.55,vLidT));normal=normalize(tbn*normalize(mapN));');
   s.fragmentShader=s.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nvec2 localPatch=(vSkinPosition.xy-uResearchPatch.xy)/uResearchPatch.zw;if(dot(localPatch,localPatch)>1.000001)discard;');
   s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb=mix(diffuseColor.rgb*vec3(.77,.57,.52),diffuseColor.rgb,smoothstep(.008,.055,vLidT));');
  };
  mat.customProgramCacheKey=()=> 'ET06.1-continuous-lid-shell';mat.side=THREE.DoubleSide;
  const m=new THREE.Mesh(g,mat);m.name='contact-eyelid-shell-'+c.name;m.frustumCulled=false;m.castShadow=false;m.receiveShadow=true;
  // Use the same deformation and support mask in the shadow pass. Unlike VSM,
  // PCF does not turn every shadow receiver into an implicit shadow caster.
  const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});
  depth.onBeforeCompile=s=>{
   s.uniforms.uLidSurface={value:this.skin.userData.surfaceTexture||null};
   // The skin callback supplies the same shared texture and relief uniforms.
   const probe={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:''};
   old(probe);Object.assign(s.uniforms,probe.uniforms);
   s.uniforms.uShadowPatch={value:new THREE.Vector4(c.x,c.y,c.rx,c.ry)};
   s.vertexShader='attribute float eyelidT;varying vec3 vLidShadowPosition;uniform sampler2D uSurface;uniform float uRelief,uBaseline;\n'+s.vertexShader;
   s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed+=normal*(texture2D(uSurface,uv).b-.5)*uRelief*.001*(1.-uBaseline)*smoothstep(.13,.68,eyelidT);vLidShadowPosition=transformed;');
   s.fragmentShader='varying vec3 vLidShadowPosition;uniform vec4 uShadowPatch;\n'+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nvec2 q=(vLidShadowPosition.xy-uShadowPatch.xy)/uShadowPatch.zw;if(dot(q,q)>1.000001)discard;');
  };
  depth.customProgramCacheKey=()=> 'ET03-lid-shadow-matched-4';m.customDepthMaterial=depth;
  const ni=64,ip=new Float32Array((A+1)*(ni+1)*3),ii=[];
  for(let j=0;j<ni;j++)for(let a=0;a<A;a++){const k=j*(A+1)+a;ii.push(k,k+1,k+A+1,k+1,k+A+2,k+A+1);}
  const ig=new THREE.BufferGeometry();ig.setAttribute('position',new THREE.BufferAttribute(ip,3));ig.setIndex(ii);
  const im=new THREE.MeshStandardMaterial({color:0x87504b,roughness:.50,side:THREE.FrontSide});
  const inside=new THREE.Mesh(ig,im);inside.name='inner-lid-contact-'+c.name;inside.frustumCulled=false;m.add(inside);
  // Free palpebral margin bridges the outer skin to the posterior contact shell.
  // It is a real strip, not a shader-only dark line; upper and lower thickness differ.
  const es=8,ep=new Float32Array((A+1)*(es+1)*3),ei=[];
  for(let a=0;a<A;a++)for(let q=0;q<es;q++){const k=a*(es+1)+q;ei.push(k,k+es+1,k+1,k+1,k+es+1,k+es+2);}
  const eg=new THREE.BufferGeometry();eg.setAttribute('position',new THREE.BufferAttribute(ep,3));eg.setIndex(ei);
  const eu=[],ec=[];
  for(let a=0;a<=A;a++)for(let q=0;q<=es;q++){
   const src=entries[a].seamSrc,t=q/es;
   eu.push(src.u,src.v);ec.push(lerp(.84,1,t),lerp(.66,1,t),lerp(.61,1,t));
  }
  eg.setAttribute('uv',new THREE.Float32BufferAttribute(eu,2));eg.setAttribute('color',new THREE.Float32BufferAttribute(ec,3));
  const em=new THREE.MeshPhysicalMaterial({color:0xffffff,map:this.skin.map,vertexColors:true,roughness:.46,metalness:0,clearcoat:.24,clearcoatRoughness:.22,ior:1.36,envMapIntensity:.32,side:THREE.DoubleSide});
  const edge=new THREE.Mesh(eg,em);edge.name='palpebral-free-margin-'+c.name;edge.frustumCulled=false;edge.castShadow=false;edge.receiveShadow=true;m.add(edge);
  return {mesh:m,entries,A,R,inside,ni,edge,es};
 }
 updateLid(e,blink){
  if(this.config.manualBlink>=0)blink=clamp(this.config.manualBlink,0,1);
  this._fittingEye=e;e.surfaceInverse=e.surfaceInverse||new THREE.Matrix4();e.surfaceInverse.makeRotationFromQuaternion(e.pivot.quaternion).invert();
  const {c,lid}=e,g=lid.mesh.geometry,P=g.attributes.position;let minClear=Infinity,penetration=0;
  const orientation=new THREE.Euler().setFromQuaternion(e.pivot.quaternion,'YXZ');c.gazePitch=orientation.x;c.gazeYaw=orientation.y;
  const margins=Array.from({length:lid.A+1},(_,i)=>this.margin(c,i/lid.A*TAU,blink));
  let closureError=0,boundaryError=0;
  for(let i=0;i<lid.entries.length;i++){
   const q=lid.entries[i],inner=margins[i%(lid.A+1)],t=q.t,weight=1-smooth(t/.74),side=q.ny>=0?1:-1,arc=Math.pow(Math.abs(q.ny),.8);
   const seam=c.y-.0035+.0028*Math.pow(Math.abs(q.nx),1.7)-.0007*q.nx*c.sign;
   let x=q.xs+(inner.x-(c.x+c.half*q.nx))*weight;
   let y=q.ys+(inner.y-(seam))*weight;
   y+=side*(q.ny>=0?.00019:.00012)*smooth(t/.055)*(1-smooth((t-.055)/.30))*arc*(1-blink);
   let z=(q.tissueZ??q.src.z)+(inner.z-(q.tissueSeamZ??q.seamSrc.z))*weight;
   const thickness=.00010+(q.ny>=0?.00068:.00042)*smooth(t/.09)*(1-smooth((t-.33)/.45));
   const eyeZ=this.eyeFront(c,x,y);
   if(eyeZ!==null&&t<.82){const b=eyeZ+thickness,k=.00010*smooth(t/.10)*(1-smooth((t-.58)/.20));z=Math.max(z,b)+(k>1e-10?k*Math.log1p(Math.exp(-Math.abs(z-b)/k)):0);}
   const fold=(q.ny>0?-.00022:.000055)*Math.exp(-Math.pow((t-(q.ny>0?.48:.40))/.14,2))*arc*(1-blink)*(1-blink);
   z+=fold;
   if(eyeZ!==null&&t<.60){const b=eyeZ+thickness,k=.000055*smooth(t/.10);z=Math.max(z,b)+(k>1e-10?k*Math.log1p(Math.exp(-Math.abs(z-b)/k)):0);}
   if(t>.82){const fade=smooth((t-.82)/.18);x=lerp(x,q.xs,fade);y=lerp(y,q.ys,fade);z=lerp(z,q.src.z,fade);}
   P.setXYZ(i,x,y,z);
   const error=Math.hypot(P.getX(i)-q.xs,P.getY(i)-q.ys,P.getZ(i)-q.src.z);
   if(blink>.999)closureError=Math.max(closureError,error);if(q.t===1)boundaryError=Math.max(boundaryError,error);
   if(eyeZ!==null&&t<.55){const actual=P.getZ(i)-eyeZ;minClear=Math.min(minClear,actual);if(actual<-.0000001)penetration++;}
  }
  P.needsUpdate=true;g.computeVertexNormals();const N=g.attributes.normal;
  for(let i=0;i<lid.entries.length;i++){const q=lid.entries[i],w=smooth((q.t-.72)/.28);if(w){const n=new THREE.Vector3(N.getX(i),N.getY(i),N.getZ(i)).lerp(q.src.n,w).normalize();N.setXYZ(i,n.x,n.y,n.z);}}N.needsUpdate=true;
  const IP=lid.inside.geometry.attributes.position,EP=lid.edge.geometry.attributes.position;
  const insetAt=(a)=>{const theta=a/lid.A*TAU,nx=Math.cos(theta),ny=Math.sin(theta),corner=smooth((1-Math.abs(nx))/.20);return (ny>=0?.00029:.00012)*corner*(1-blink);};
  // Hidden conjunctiva is a continuous spherical chart. No off-globe depth
  // fallbacks are joined by triangles that pass through the optical surface.
  for(let i=0;i<=lid.A;i++){
   const theta=i/lid.A*TAU,nx=Math.cos(theta),ny=Math.sin(theta),inset=insetAt(i);
   const ox=P.getX(i)-nx*inset,oy=P.getY(i)-ny*inset,r=c.radius;
   const ax=(ox-c.x)/r,ay=(oy-c.y)/r,az=Math.sqrt(Math.max(0,1-ax*ax-ay*ay));
   const bx=nx*Math.sin(1.44),by=ny*Math.sin(1.44),bz=Math.cos(1.44);
   const angle=Math.acos(clamp(ax*bx+ay*by+az*bz,-.999999,1)),sin=Math.sin(angle);
   for(let j=0;j<=lid.ni;j++){
    const t=j/lid.ni,wa=sin>.000001?Math.sin((1-t)*angle)/sin:1-t,wb=sin>.000001?Math.sin(t*angle)/sin:t;
    const x=j===0?ox:c.x+r*(wa*ax+wb*bx),y=j===0?oy:c.y+r*(wa*ay+wb*by),z=this.eyeFront(c,x,y);
    if(z===null)throw Error('Inner globe chart escaped support');
    IP.setXYZ(j*(lid.A+1)+i,x,y,z+.000085);
   }
  }
  IP.needsUpdate=true;lid.inside.geometry.computeVertexNormals();
  for(let a=0;a<=lid.A;a++){
   const theta=a/lid.A*TAU,nx=Math.cos(theta),ny=Math.sin(theta),corner=smooth((1-Math.abs(nx))/.20);
   for(let q=0;q<=lid.es;q++){
    const t=q/lid.es,b=Math.sin(Math.PI*t),k=a*(lid.es+1)+q,bulge=(ny>=0?.00016:.000035)*corner*(1-blink);
    const x=lerp(IP.getX(a),P.getX(a),t)+nx*b*bulge,y=lerp(IP.getY(a),P.getY(a),t)+ny*b*bulge;
    let z=lerp(IP.getZ(a),P.getZ(a),t)+b*.000025;
    const contact=this.eyeFront(c,x,y);if(contact!==null&&q>0&&q<lid.es)z=Math.max(z,contact+.000085);
    EP.setXYZ(k,x,y,z);
   }
  }
  EP.needsUpdate=true;lid.edge.geometry.computeVertexNormals();
  // The tear meniscus follows the posterior edge. It is not the lid geometry.
  const rp=e.rim.mesh.geometry.attributes.position;
  for(let a=0;a<=e.rim.A;a++){
   const theta=a/e.rim.A*TAU,row=a/e.rim.A*lid.A,i=Math.floor(row),j=Math.min(lid.A,i+1),f=row-i,nx=Math.cos(theta),ny=Math.sin(theta);
   const r=.000014+.000026*Math.max(0,-ny);
   for(let q=0;q<=e.rim.S;q++){const b=q/e.rim.S*TAU;rp.setXYZ(a*(e.rim.S+1)+q,lerp(IP.getX(i),IP.getX(j),f)+nx*Math.cos(b)*r,lerp(IP.getY(i),IP.getY(j),f)+ny*Math.cos(b)*r,lerp(IP.getZ(i),IP.getZ(j),f)+Math.sin(b)*r+.000005);}
  }
  rp.needsUpdate=true;e.rim.mesh.geometry.computeVertexNormals();
  const lp=e.lashes.mesh.geometry.attributes.position;
  for(let i=0;i<e.lashes.entries.length;i++){const q=e.lashes.entries[i],p=this.margin(c,q.a,blink);for(let j=0;j<5;j++){const t=j/4;for(let s=0;s<2;s++){const width=.000025*(1-.9*t)*(s?1:-1);lp.setXYZ(i*10+j*2+s,p.x+Math.cos(q.a)*q.len*t*.35+q.lean*t+width,p.y+Math.sin(q.a)*(q.len*t*.65+.00035),p.z+.00035+q.len*(.48*t+.35*t*t));}}}lp.needsUpdate=true;e.lashes.mesh.geometry.computeVertexNormals();
  if(e.caruncle){const a=c.sign>0?Math.PI:0,p=this.margin(c,a,blink);e.caruncle.position.copy(p).add(new THREE.Vector3(-c.sign*.00018,0,.00001));e.caruncle.visible=blink<.98;}
  if(e.edgeMap){for(let i=0;i<64;i++){const x=-1+2*i/63,a=Math.acos(clamp(x,-1,1)),top=this.margin(c,a,blink),bottom=this.margin(c,TAU-a,blink);e.edgeData[i*4]=top.y-c.y;e.edgeData[i*4+1]=bottom.y-c.y;e.edgeData[i*4+2]=0;e.edgeData[i*4+3]=1;}e.edgeMap.needsUpdate=true;}
  const topMid=margins[Math.round(lid.A*.25)],bottomMid=margins[Math.round(lid.A*.75)];
  const gapAtU=u=>{const nx=u*c.sign,a=Math.acos(clamp(nx,-1,1));return (this.margin(c,a,blink).y-this.margin(c,TAU-a,blink).y)*1000;};
  const topEye=this.eyeFront(c,topMid.x,topMid.y),bottomEye=this.eyeFront(c,bottomMid.x,bottomMid.y);
  e.contactReport={minOuterClearanceMM:Number.isFinite(minClear)?minClear*1000:null,penetratingTestVertices:penetration,innerShell:true,freeMarginMesh:true,outerBoundaryFixed:true,contactTestOuterRowsBelow:.55,eyeballHiddenForClosure:false,capturedClosureMaxDeviationMM:blink>.999?closureError*1000:null,outerBoundaryDeviationMM:boundaryError*1000,horizontalApertureMM:Math.abs(margins[0].x-margins[Math.round(lid.A*.5)].x)*1000,verticalApertureMM:(topMid.y-bottomMid.y)*1000,upperMarginThicknessMM:topEye===null?null:(topMid.z-topEye)*1000,lowerMarginThicknessMM:bottomEye===null?null:(bottomMid.z-bottomEye)*1000,posteriorTearGapMM:.085,medialGapAt90MM:gapAtU(-.90),lateralGapAt90MM:gapAtU(.90)};
  e.ball.visible=true;this._fittingEye=null;this.lastLid=blink;
 }
 update(dt,instant=false){
  const extraChanged=this._oldSquint!==this.config.squint||this._oldManual!==this.config.manualBlink;
  const changed=super.update(dt,instant);
  // The inherited motion update already invokes the overridden contact solver.
  // Only a non-motion control change needs an extra geometry update.
  if(!instant&&!changed&&extraChanged&&this.eyes)for(const e of this.eyes)this.updateLid(e,this.state.blink);
  this._oldSquint=this.config.squint;this._oldManual=this.config.manualBlink;
  for(const e of this.eyes)e.ball.material.envMapRotation.copy(this.scene.environmentRotation);
  this.state.contact=this.eyes?.map(e=>e.contactReport);return changed||extraChanged;
 }
 snapshot(){return {...super.snapshot(),squint:this.config.squint||0,manualBlink:this.config.manualBlink??-1};}
 restore(o){if(!o)return;super.restore(o);if(Number.isFinite(o.squint))this.config.squint=clamp(o.squint,0,1);if(Number.isFinite(o.manualBlink))this.config.manualBlink=clamp(o.manualBlink,-1,1);this.update(0,true);this.requestRender();}
 info(){return {...super.info(),reconstruction:'ET06 joined skin-margin-conjunctiva / finite canthal tangents',neuralTrainingPerformed:false,paperReproduction:false,depthCalibration:this.eyes.map(e=>e.depthFit),contact:this.eyes.map(e=>e.contactReport)};}
 audit(detailed=false){
  const rows=[];
  for(const e of this.eyes){
   this._fittingEye=e;const {c,lid}=e,P=lid.mesh.geometry.attributes.position,I=lid.inside.geometry.attributes.position,E=lid.edge.geometry.attributes.position;
   let seamMax=0,nonfinite=0,minGap=Infinity,penetrations=0,tested=0;
   for(let a=0;a<=lid.A;a++)for(const [p,i,j] of [[P,a,a*(lid.es+1)+lid.es],[I,a,a*(lid.es+1)]])seamMax=Math.max(seamMax,Math.hypot(p.getX(i)-E.getX(j),p.getY(i)-E.getY(j),p.getZ(i)-E.getZ(j)));
   for(const p of [P,I,E])for(let i=0;i<p.count;i++)if(![p.getX(i),p.getY(i),p.getZ(i)].every(Number.isFinite))nonfinite++;
   for(const p of [I,E])for(let i=0;i<p.count;i++){const z=this.eyeFront(c,p.getX(i),p.getY(i));if(z===null)continue;const gap=p.getZ(i)-z;minGap=Math.min(minGap,gap);tested++;if(gap<-.0000001)penetrations++;}
   let triangleMin=Infinity,trianglePenetrations=0,triangleSamples=0;
   if(detailed)for(const geo of [lid.inside.geometry,lid.edge.geometry]){
    const p=geo.attributes.position,ix=geo.index.array;
    for(let k=0;k<ix.length;k+=3)for(const w of [[1/3,1/3,1/3],[.5,.5,0],[0,.5,.5],[.5,0,.5]]){
     const a=ix[k],b=ix[k+1],d=ix[k+2],x=w[0]*p.getX(a)+w[1]*p.getX(b)+w[2]*p.getX(d),y=w[0]*p.getY(a)+w[1]*p.getY(b)+w[2]*p.getY(d),z=w[0]*p.getZ(a)+w[1]*p.getZ(b)+w[2]*p.getZ(d),front=this.eyeFront(c,x,y);
     if(front===null)continue;const gap=z-front;triangleSamples++;triangleMin=Math.min(triangleMin,gap);if(gap<-.0000001)trianglePenetrations++;
    }
   }
   const surfaceTests={triangleSamples,trianglePenetrations,triangleMinAxialGapMM:detailed?triangleMin*1000:null};
   const edgeLength=a=>{let d=0;for(let q=1;q<=lid.es;q++){const i=a*(lid.es+1)+q;d+=Math.hypot(E.getX(i)-E.getX(i-1),E.getY(i)-E.getY(i-1),E.getZ(i)-E.getZ(i-1));}return d*1000;};
   rows.push({surfaceTests,name:c.name,nonfiniteVertices:nonfinite,maxSharedEdgeErrorMM:seamMax*1000,posteriorAndMarginMinAxialGapMM:minGap*1000,posteriorAndMarginPenetrations:penetrations,contactTestVertices:tested,upperFreeMarginArcMM:edgeLength(lid.A/4),lowerFreeMarginArcMM:edgeLength(3*lid.A/4),radiusMM:c.radius*1000,irisRadiusRatio:.435,restingOpening:this.config.opening,eyeHidden:!e.ball.visible,outerBoundaryDeviationMM:e.contactReport.outerBoundaryDeviationMM,verticalApertureMM:e.contactReport.verticalApertureMM,horizontalApertureMM:e.contactReport.horizontalApertureMM});
  }
  this._fittingEye=null;return {version:'ET06.1',units:'millimetres',scope:'actual vertices, optional triangle centroids and all edge midpoints; rotated two-sphere; sampled static poses, not exhaustive continuous CCD',eyes:rows};
 }
 dispose(){for(const e of this.eyes){e.edgeMap?.dispose();e.lid.mesh.customDepthMaterial?.dispose();}super.dispose();}
}

// ET03 review correction R2

// ET03 captured-closure anchors R3

// ET03 observed closed-envelope fit R5

// ET03 matching shadow surfaces R4

// ET05 anatomical upper/lower free-margin reconstruction
