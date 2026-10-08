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
 const x=clamp((u+1)*.5,0,1)*(REFERENCE_RAILS.length-1),i=Math.min(REFERENCE_RAILS.length-2,Math.floor(x)),t=x-i,k=upper?1:2;
 const a=REFERENCE_RAILS[Math.max(0,i-1)][k],b=REFERENCE_RAILS[i][k],c=REFERENCE_RAILS[i+1][k],d=REFERENCE_RAILS[Math.min(REFERENCE_RAILS.length-1,i+2)][k];
 return .5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);
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
  this.state.reconstruction='ET03 contact-constrained shell';this.state.trainedNeuralModel=false;
  this.ready=this.ready.then(()=>{
   for(const e of this.eyes){
    e.ball.geometry.dispose();e.ball.geometry=opticalMesh(e.c.radius);
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
  const f=zz=>{const lx=inv?inv[0]*dx+inv[4]*dy+inv[8]*zz:dx,ly=inv?inv[1]*dx+inv[5]*dy+inv[9]*zz:dy,lz=inv?inv[2]*dx+inv[6]*dy+inv[10]*zz:zz,h=ocularHeight(r,lx,ly);return h.valid?lz-h.z:0;};
  for(let i=0;i<7;i++){const v=f(z),eps=.000004,der=(f(z+eps)-f(z-eps))/(2*eps);if(Math.abs(der)<.12)break;const dz=clamp(v/der,-.002,.002);z-=dz;if(Math.abs(dz)<.00000003)break;}
  return c.z+z;
 }
 margin(c,a,blink){
  const nx=Math.cos(a),upper=Math.sin(a)>=0,u=nx*c.sign,w=Math.sqrt(Math.max(0,1-nx*nx));
  const top=rail(u,true)*c.half,bottom=rail(u,false)*c.half,center=lerp(bottom,top,.22);
  const pitch=c.gazePitch||0,yaw=c.gazeYaw||0;
  const gaze=-pitch*(upper?.0056:.0023)*w,squint=this.config.squint||0;
  const rest=(upper?top:bottom)*(this.config.opening||1),narrow=(upper?-.0020:.0020)*squint*w;
  const y=c.y-.0005+lerp(rest+gaze+narrow,center,blink);
  const x=c.x+c.half*nx+yaw*.0006*w*(1-blink);
  const z=this.eyeFront(c,x,y);return new THREE.Vector3(x,y,z===null?c.z+.003:z+.00009);
 }
 rimPoint(c,a,blink){return this.margin(c,a,blink);}
 makeLid(c,sample,mat){
  const A=192,R=32,p=[],n=[],uv=[],ao=[],ts=[],ix=[],entries=[];
  for(let j=0;j<=R;j++)for(let i=0;i<=A;i++){
   const t=j/R,a=i/A*TAU,nx=Math.cos(a),ny=Math.sin(a),u=nx*c.sign;
   const seam=c.y-.0035+.0028*Math.pow(Math.abs(nx),1.7)-.0007*nx*c.sign;
   const xo=c.x+c.rx*1.004*nx,yo=c.y+c.ry*1.004*ny;
   const xs=lerp(c.x+c.half*nx,xo,t),ys=lerp(seam+(ny>=0?.00045:-.00045),yo,t);
   const src=sample(xs,ys),seamSrc=sample(c.x+c.half*nx,seam+(ny>=0?.00045:-.00045)),outer=sample(xo,yo);
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
   s.fragmentShader=s.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nvec2 localPatch=(vSkinPosition.xy-uResearchPatch.xy)/uResearchPatch.zw;if(dot(localPatch,localPatch)>1.000001)discard;');
   s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb=mix(diffuseColor.rgb*vec3(.77,.57,.52),diffuseColor.rgb,smoothstep(.008,.055,vLidT));');
  };
  mat.customProgramCacheKey=()=> 'ET03-continuous-lid-shell-1';mat.side=THREE.DoubleSide;
  const m=new THREE.Mesh(g,mat);m.name='contact-eyelid-shell-'+c.name;m.frustumCulled=false;m.castShadow=false;m.receiveShadow=true;
  const ni=14,ip=new Float32Array((A+1)*(ni+1)*3),ii=[];
  for(let j=0;j<ni;j++)for(let a=0;a<A;a++){const k=j*(A+1)+a;ii.push(k,k+1,k+A+1,k+1,k+A+2,k+A+1);}
  const ig=new THREE.BufferGeometry();ig.setAttribute('position',new THREE.BufferAttribute(ip,3));ig.setIndex(ii);
  const im=new THREE.MeshStandardMaterial({color:0x96574f,roughness:.46,side:THREE.DoubleSide});
  const inside=new THREE.Mesh(ig,im);inside.name='inner-lid-contact-'+c.name;inside.frustumCulled=false;m.add(inside);
  return {mesh:m,entries,A,R,inside,ni};
 }
 updateLid(e,blink){
  if(this.config.manualBlink>=0)blink=clamp(this.config.manualBlink,0,1);
  this._fittingEye=e;e.surfaceInverse=e.surfaceInverse||new THREE.Matrix4();e.surfaceInverse.makeRotationFromQuaternion(e.pivot.quaternion).invert();
  const {c,lid}=e,g=lid.mesh.geometry,P=g.attributes.position;let minClear=Infinity,penetration=0;
  for(let i=0;i<lid.entries.length;i++){
   const q=lid.entries[i],inner=this.margin(c,q.a,blink),t=q.t,weight=1-smooth(t),side=q.ny>=0?1:-1,arc=Math.pow(Math.abs(q.ny),.8);
   const seam=c.y-.0035+.0028*Math.pow(Math.abs(q.nx),1.7)-.0007*q.nx*c.sign;
   let x=q.xs+(inner.x-(c.x+c.half*q.nx))*weight;
   let y=q.ys+(inner.y-(seam+(q.ny>=0?.00045:-.00045)))*weight;
   y+=side*.00043*smooth(t/.045)*(1-smooth((t-.045)/.30))*arc;
   let z=q.src.z+(inner.z-q.seamSrc.z)*weight;
   const thickness=.00010+.00056*smooth(t/.055)*(1-smooth((t-.35)/.45));
   const eyeZ=this.eyeFront(c,x,y);
   if(eyeZ!==null&&t<.82)z=Math.max(z,eyeZ+thickness);
   const fold=(q.ny>0?-.00044:.00012)*Math.exp(-Math.pow((t-(q.ny>0?.43:.38))/.105,2))*arc*(1-blink)*(1-blink);
   z+=fold;
   if(eyeZ!==null&&t<.60)z=Math.max(z,eyeZ+thickness);
   if(t>.82){const fade=smooth((t-.82)/.18);x=lerp(x,q.xs,fade);y=lerp(y,q.ys,fade);z=lerp(z,q.src.z,fade);}
   P.setXYZ(i,x,y,z);
   if(eyeZ!==null&&t<.55){const actual=P.getZ(i)-eyeZ;minClear=Math.min(minClear,actual);if(actual<-.0000001)penetration++;}
  }
  P.needsUpdate=true;g.computeVertexNormals();const N=g.attributes.normal;
  for(let i=0;i<lid.entries.length;i++){const q=lid.entries[i],w=smooth((q.t-.72)/.28);if(w){const n=new THREE.Vector3(N.getX(i),N.getY(i),N.getZ(i)).lerp(q.src.n,w).normalize();N.setXYZ(i,n.x,n.y,n.z);}}N.needsUpdate=true;
  const IP=lid.inside.geometry.attributes.position;
  for(let j=0;j<=lid.ni;j++)for(let i=0;i<=lid.A;i++){
   const t=j/lid.ni*.42,idx=Math.round(t*lid.R)*(lid.A+1)+i,x=P.getX(idx),y=P.getY(idx),z=this.eyeFront(c,x,y);
   IP.setXYZ(j*(lid.A+1)+i,x,y,z===null?P.getZ(idx)-.0003:z+.000035);
  }
  IP.needsUpdate=true;lid.inside.geometry.computeVertexNormals();
  const rp=e.rim.mesh.geometry.attributes.position;
  for(let a=0;a<=e.rim.A;a++){const theta=a/e.rim.A*TAU,p=this.margin(c,theta,blink),lower=Math.max(0,-Math.sin(theta));for(let s=0;s<=e.rim.S;s++){const b=s/e.rim.S*TAU,r=.000014+.000065*lower;rp.setXYZ(a*(e.rim.S+1)+s,p.x+Math.cos(theta)*Math.cos(b)*r,p.y+Math.sin(theta)*Math.cos(b)*r,p.z+Math.sin(b)*r+.000028);}}
  rp.needsUpdate=true;e.rim.mesh.geometry.computeVertexNormals();
  const lp=e.lashes.mesh.geometry.attributes.position;
  for(let i=0;i<e.lashes.entries.length;i++){const q=e.lashes.entries[i],p=this.margin(c,q.a,blink);for(let j=0;j<5;j++){const t=j/4;for(let s=0;s<2;s++){const width=.000025*(1-.9*t)*(s?1:-1);lp.setXYZ(i*10+j*2+s,p.x+Math.cos(q.a)*q.len*t*.35+q.lean*t+width,p.y+Math.sin(q.a)*(q.len*t*.65+.00035),p.z+.00035+q.len*(.48*t+.35*t*t));}}}lp.needsUpdate=true;e.lashes.mesh.geometry.computeVertexNormals();
  if(e.caruncle){const a=c.sign>0?Math.PI:0,p=this.margin(c,a,blink);e.caruncle.position.copy(p).add(new THREE.Vector3(-c.sign*.00018,0,.00001));e.caruncle.visible=blink<.98;}
  if(e.edgeMap){for(let i=0;i<64;i++){const x=-1+2*i/63,a=Math.acos(clamp(x,-1,1)),top=this.margin(c,a,blink),bottom=this.margin(c,TAU-a,blink);e.edgeData[i*4]=top.y-c.y;e.edgeData[i*4+1]=bottom.y-c.y;e.edgeData[i*4+2]=0;e.edgeData[i*4+3]=1;}e.edgeMap.needsUpdate=true;}
  e.contactReport={minOuterClearanceMM:Number.isFinite(minClear)?minClear*1000:null,penetratingTestVertices:penetration,innerShell:true,outerBoundaryFixed:true,contactTestOuterRowsBelow:.55,eyeballHiddenForClosure:false};
  e.ball.visible=true;this._fittingEye=null;this.lastLid=blink;
 }
 update(dt,instant=false){
  if(this.eyes)for(const e of this.eyes)e.c.gazeYaw=e.rotation?.y||0;
  const changed=super.update(dt,instant);
  if(this.eyes)for(const e of this.eyes){if(instant||changed||this._oldSquint!==this.config.squint||this._oldManual!==this.config.manualBlink)this.updateLid(e,this.state.blink);}
  this._oldSquint=this.config.squint;this._oldManual=this.config.manualBlink;
  this.state.contact=this.eyes?.map(e=>e.contactReport);return changed;
 }
 snapshot(){return {...super.snapshot(),squint:this.config.squint||0,manualBlink:this.config.manualBlink??-1};}
 restore(o){if(!o)return;super.restore(o);if(Number.isFinite(o.squint))this.config.squint=clamp(o.squint,0,1);if(Number.isFinite(o.manualBlink))this.config.manualBlink=clamp(o.manualBlink,-1,1);this.update(0,true);this.requestRender();}
 info(){return {...super.info(),reconstruction:'ET03 contact shell / CC0 measured margin rails',neuralTrainingPerformed:false,paperReproduction:false,contact:this.eyes.map(e=>e.contactReport)};}
 dispose(){for(const e of this.eyes)e.edgeMap?.dispose();super.dispose();}
}
