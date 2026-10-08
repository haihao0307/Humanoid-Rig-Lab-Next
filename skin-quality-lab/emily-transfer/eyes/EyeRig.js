import * as THREE from 'three';
// Independent implementation learned from alteredqualia's Digital Emily:
// curved inner iris, separate smooth reflection surface, light-dependent pupil,
// caustic approximation and two eyes aiming at one smoothed world-space target.
// No original Emily geometry, texture or XG engine is copied into this module.
export const EYE_VERSION='ET02.0';
const clamp=THREE.MathUtils.clamp, mix=THREE.MathUtils.lerp, rad=THREE.MathUtils.degToRad;
export const FIT=[
 {id:'right',x:-.0315,y:.0683,z:.0570,r:.0175,outerX:.019,outerUp:.0110,outerDown:.0095,innerX:.0141,up:.0048,down:.0034,tilt:.0011,closedY:.0641,seed:17},
 {id:'left',x:.0280,y:.0680,z:.0543,r:.0175,outerX:.019,outerUp:.0110,outerDown:.0095,innerX:.0141,up:.0048,down:.0034,tilt:-.0011,closedY:.0641,seed:49}
];
const HEADER=`uniform float ePupil,eIrisR,eWet,eCaustic,eVeins,eSeed,eRefract,ePass,eOpen;
uniform vec3 eIrisColor,eCamera,eKey,eFill,eRim,eKeyColor,eFillColor,eRimColor;
uniform mat3 eNormalMatrix;uniform mat4 eToHead;
uniform vec4 eSocket;uniform vec2 eLid;varying vec3 vEyeP;
float hashE(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noiseE(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hashE(i),hashE(i+vec2(1,0)),f.x),mix(hashE(i+vec2(0,1)),hashE(i+vec2(1)),f.x),f.y);}
float fiberE(float a,float r){float n=sin(a*73.+sin(r*19.+a*8.)*1.4)+.56*sin(a*173.+r*27.+sin(a*39.))+.27*sin(a*389.-r*68.)+.13*sin(a*717.+r*34.);return n*.25+.5;}
`;
const COLOR=`
 if(ePass>.5)discard;
 vec3 hpClip=(eToHead*vec4(vEyeP,1.)).xyz;float ec=(hpClip.x-eSocket.x)/eSocket.z;
 if(abs(ec)>1.)discard;
 float archClip=pow(max(0.,1.-ec*ec),.8);float midClip=mix(.0641+.0036*ec*ec,eSocket.y,eOpen)+eSocket.w*ec;
 if(hpClip.y>midClip+eLid.x*archClip*eOpen||hpClip.y<midClip-eLid.y*archClip*eOpen)discard;
 vec3 ep=vEyeP;vec3 eV=normalize(eCamera-ep);float er=length(ep.xy);
 // Refract through the convex corneal surface, then intersect the recessed iris bowl.
 vec3 eN=normalize(ep);float cap=1.-smoothstep(.31,.47,er);
 eN=normalize(mix(eN,vec3(ep.xy*1.40,ep.z-.16),cap));
 vec3 ray=refract(-eV,eN,1./mix(1.,1.376,eRefract));
 float travel=max(0.,(.82-ep.z)/min(-.08,ray.z));
 vec3 ip=ep+ray*travel;
 for(int j=0;j<3;j++){float rr=length(ip.xy)/eIrisR;float bowl=.85-.085*pow(max(0.,1.-rr*rr),2.);travel=max(0.,(bowl-ep.z)/min(-.08,ray.z));ip=ep+ray*travel;}
 vec2 iq=ip.xy/eIrisR;float ir=length(iq),ia=atan(iq.y,iq.x)+eSeed;
 float edgeAA=max(fwidth(ir),.003);float pupilR=clamp(ePupil,.16,.65);
 float stroma=clamp((ir-pupilR)/(1.-pupilR),0.,1.);
 float fiber=fiberE(ia,stroma);float fib2=noiseE(vec2(ia*56.,stroma*9.+eSeed));
 float crypt=noiseE(vec2(ia*18.,stroma*15.));
 float collarette=.34+.045*sin(ia*14.)+.024*sin(ia*31.);
 float coll=exp(-pow((stroma-collarette)/.060,2.));
 vec3 iris=eIrisColor*(.38+.97*fiber+.37*fib2);
 iris=mix(iris,vec3(.17,.093,.034)*(.5+fiber),.34*(1.-smoothstep(.15,.58,stroma)));
 iris*=1.-.38*coll*crypt;
 float fissure=smoothstep(.68,.87,noiseE(vec2(ia*35.,stroma*11.)))*exp(-pow((stroma-.4)/.29,2.));iris*=1.-fissure*.45;
 float limbal=1.-smoothstep(.89+.008*sin(ia*71.),1.015,ir);iris*=.31+.69*limbal;
 float pupMask=1.-smoothstep(pupilR-edgeAA,pupilR+edgeAA,ir);
 iris=mix(iris,vec3(.0012,.0013,.0014),pupMask);
 float irisMask=(1.-smoothstep(.993-edgeAA,1.005+edgeAA,ir))*smoothstep(.1,.7,ep.z);
 vec3 white=vec3(.28,.258,.23)*(1.+.035*(noiseE(ep.xy*70.)-.5));
 float vessel=0.;float outerWhite=smoothstep(.42,.92,er);
 for(int j=0;j<7;j++){float fj=float(j);float sy=(fj-3.)*.103+.018*sin(fj*8.+eSeed);float path=sy+.035*sin(ep.x*12.+fj*3.)+.012*sin(ep.x*39.+fj);
 float dist=abs(ep.y-path);float width=.0026+fj*.00015;float aa=max(fwidth(ep.y),.001);
 vessel+=1.-smoothstep(width,width+aa,dist);
 float branch=abs(ep.y-path-(ep.x-.62)*(.3*sin(fj*7.)));
 vessel+=.4*(1.-smoothstep(width*.6,width+aa,branch))*smoothstep(.55,.95,abs(ep.x));}
 vessel=clamp(vessel*outerWhite*eVeins,0.,.8);white*=mix(vec3(1.),vec3(.75,.30,.24),vessel*.55);
 float bloodEdge=smoothstep(.58,1.,er)*.16;white*=vec3(1.,1.-bloodEdge,1.-bloodEdge*.85);
 diffuseColor.rgb=mix(white,iris,irisMask);
 // A real per-eye local lighting basis drives the opposed iris caustic crescent.
 float crescent=max(0.,dot(normalize(vec3(-iq,.25)),normalize(vec3(eKey.xy,.2))));
 float focus=pow(crescent,2.)*smoothstep(pupilR+.02,.72,ir)*(1.-smoothstep(.84,1.,ir));
 diffuseColor.rgb*=1.+irisMask*(1.-pupMask)*eCaustic*focus*length(eKeyColor)*.85;
`;
const NORMAL=`
 #include <normal_fragment_maps>
 vec3 bowlNormal=normalize(vec3(-iq*.32,1.));
 bowlNormal.xy+=vec2(dFdx(fiber),dFdy(fiber))*.022;
 normal=normalize(mix(normal,eNormalMatrix*bowlNormal,irisMask));
`;
export class EyeRig {
 constructor({scene,mesh,skin,fuzz,pass,camera,controls,viewport,key,fill,rim,depthMaterial,onDirty,onPose}){
  Object.assign(this,{scene,mesh,skin,fuzz,pass,camera,controls,viewport,key,fill,rim,onDirty,onPose});
  this.config={enabled:true,mode:'camera',autoBlink:false,autoPupil:true,headFollow:false,headYaw:0,headPitch:0,iris:'blue',pupil:.32,wet:.92,refraction:1,caustic:.7,veins:.28,openness:1};
  this.target=new THREE.Vector3(0,.069,.62);this.pointer=new THREE.Vector2();this.manualTarget=this.target.clone();this.time=0;this.blinkAt=-100;this.nextBlink=4.3;this.pupil=.30;this.open=1;this.yaw=0;this.pitch=0;this.parts=[];this.dirty=true;
  this.root=new THREE.Group();this.root.name='ET02_head_eye_coordinator';scene.add(this.root);this.root.add(mesh,fuzz);
  this.clipUniform={value:1};const baseSkinCompile=skin.onBeforeCompile;
  this.patchMaterial=skin.clone();this.patchMaterial.transparent=true;this.patchMaterial.depthWrite=false;
  this.patchMaterial.onBeforeCompile=s=>{baseSkinCompile(s);s.fragmentShader=s.fragmentShader.replace('#include <opaque_fragment>',`
  float outerFade=1.;
  ${FIT.map(f=>`{vec2 q=vSkinPosition.xy-vec2(${f.x},${f.y});float b=q.y>0.?${f.outerUp}:${f.outerDown};float r=length(q/vec2(${f.outerX},b));if(r<1.05)outerFade=1.-smoothstep(.997,1.,r);}`).join('\n')}
  diffuseColor.a*=outerFade;
  #include <opaque_fragment>`);};this.patchMaterial.customProgramCacheKey=()=> 'ET02-lid-skin';this.patchMaterial.side=THREE.DoubleSide;
  this.makeClipping(skin,baseSkinCompile);this.depthMaterial=depthMaterial;
  const rawDepthCompile=depthMaterial.onBeforeCompile;this.makeClipping(depthMaterial,rawDepthCompile,true);
  this.lidDepth=depthMaterial.clone();this.lidDepth.onBeforeCompile=rawDepthCompile;this.lidDepth.customProgramCacheKey=()=> 'ET02-lid-depth';
  this.samplingMesh=this.makeSamplingMesh(mesh.geometry);
  this.eyes=FIT.map(f=>this.makeEye(f));
  this.samplingMesh.geometry.dispose();this.samplingMesh.material.dispose();this.samplingMesh=null;
  this.root.updateMatrixWorld(true);this.update(0,true);
  this.onMove=e=>{if(this.config.mode!=='pointer'||e.buttons)return;const r=viewport.getBoundingClientRect();this.pointer.set((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2);this.dirty=true;};viewport.addEventListener('pointermove',this.onMove);
 }
 makeSamplingMesh(g){const p=g.attributes.position,ids=g.index.array,ix=[];for(let i=0;i<ids.length;i+=3){let ok=false;for(let k=0;k<3;k++){const j=ids[i+k],x=p.getX(j),y=p.getY(j),z=p.getZ(j);if(Math.abs(x)<.061&&y>.052&&y<.086&&z>.020)ok=true;}if(ok)ix.push(ids[i],ids[i+1],ids[i+2]);}const q=new THREE.BufferGeometry();q.setAttribute('position',p);q.setAttribute('normal',g.attributes.normal);q.setAttribute('uv',g.attributes.uv);q.setAttribute('skinOcclusion',g.attributes.skinOcclusion);q.setIndex(ix);q.computeBoundingSphere();const m=new THREE.Mesh(q,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));m.updateMatrixWorld(true);return m;}
 sample(x,y){const r=new THREE.Raycaster(new THREE.Vector3(x,y,.25),new THREE.Vector3(0,0,-1));const h=r.intersectObject(this.samplingMesh,false)[0];if(!h)throw Error('Eye fitting surface missing '+x+','+y);return {p:h.point.clone(),uv:h.uv.clone(),n:h.normal?.clone()||h.face.normal.clone(),ao:.91};}
 makeClipping(mat,compile,depth=false){const clip=this.clipUniform;mat.onBeforeCompile=s=>{compile(s);s.uniforms.eEnable=clip;s.vertexShader='varying vec3 vEyeCutP;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvEyeCutP=position;');s.fragmentShader='varying vec3 vEyeCutP;uniform float eEnable;\n'+s.fragmentShader;
 const lines=FIT.map(f=>`{vec2 d=vEyeCutP.xy-vec2(${f.x},${f.y});float b=d.y>0.?${f.outerUp}:${f.outerDown};if(dot(d/vec2(${f.outerX},b),d/vec2(${f.outerX},b))<.99&&vEyeCutP.z>.028)discard;}`).join('\n');
 s.fragmentShader=s.fragmentShader.replace('void main() {','void main() {\nif(eEnable>.5){'+lines+'}\n');};mat.customProgramCacheKey=()=>depth?'ET02-head-depth-cut':'ET02-head-skin-cut';mat.needsUpdate=true;}
 makeEye(f){const eye={fit:f,group:new THREE.Group(),open:1,pitch:0};eye.group.name='ET02_'+f.id+'_eye';eye.group.position.set(f.x,f.y,f.z);eye.group.scale.setScalar(f.r);this.root.add(eye.group);
 const g=new THREE.SphereGeometry(1,96,64);const p=g.attributes.position;for(let i=0;i<p.count;i++){let z=p.getZ(i),r=Math.hypot(p.getX(i),p.getY(i));if(z>0)z+=.095*Math.pow(Math.max(0,1-(r/.44)**2),1.6);p.setZ(i,z);}g.computeVertexNormals();
 const u={ePass:this.pass,ePupil:{value:.3},eIrisR:{value:.335},eWet:{value:.92},eCaustic:{value:.7},eVeins:{value:.28},eSeed:{value:f.seed},eRefract:{value:1},eOpen:{value:1},eIrisColor:{value:new THREE.Color(.050,.105,.128)},eCamera:{value:new THREE.Vector3()},eKey:{value:new THREE.Vector3()},eFill:{value:new THREE.Vector3()},eRim:{value:new THREE.Vector3()},eKeyColor:{value:new THREE.Color()},eFillColor:{value:new THREE.Color()},eRimColor:{value:new THREE.Color()},eNormalMatrix:{value:new THREE.Matrix3()},eToHead:{value:new THREE.Matrix4()},eLid:{value:new THREE.Vector2(f.up,f.down)},eSocket:{value:new THREE.Vector4(f.x,f.y,f.innerX,f.tilt)}};
 const mat=new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:.45,metalness:0,ior:1.376,specularIntensity:.42,clearcoat:1,clearcoatRoughness:.035,envMapIntensity:.8});
 mat.onBeforeCompile=s=>{Object.assign(s.uniforms,u);s.vertexShader='varying vec3 vEyeP;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvEyeP=position;');s.fragmentShader=HEADER+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',COLOR);s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',NORMAL);s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(.38,.55,irisMask);');s.fragmentShader=s.fragmentShader.replace('#include <opaque_fragment>',`
 vec3 hp=(eToHead*vec4(vEyeP,1.)).xyz;float ex=clamp((hp.x-eSocket.x)/eSocket.z,-1.,1.);float arch=pow(max(.0,1.-ex*ex),.8);float mid=eSocket.y+eSocket.w*ex;
 float top=mid+eLid.x*arch*eOpen;float bottom=mid-eLid.y*arch*eOpen;
 float lidShadow=1.-.54*exp(-max(0.,top-hp.y)/.0029)-.17*exp(-max(0.,hp.y-bottom)/.0016);
 outgoingLight*=clamp(lidShadow,.35,1.);
 #include <opaque_fragment>`);};mat.customProgramCacheKey=()=> 'ET02-refracted-eye';
 eye.mesh=new THREE.Mesh(g,mat);eye.mesh.name='refracted_cornea_iris_'+f.id;eye.group.add(eye.mesh);eye.u=u;eye.material=mat;
 eye.lid=this.makeLid(eye);this.root.add(eye.lid.mesh);this.makeRim(eye);this.updateLid(eye,1);this.parts.push(eye.lid.mesh);return eye;
 }
 makeLid(eye){const f=eye.fit,N=112,K=14,verts=[],uv=[],ao=[],ix=[],samples=[];for(let j=0;j<=K;j++){const t=j/K;for(let i=0;i<=N;i++){const a=i/N*Math.PI*2,c=Math.cos(a),s=Math.sin(a),outerY=s>=0?f.outerUp:f.outerDown;let x=f.x+mix(f.innerX,f.outerX,t)*c;let closed=f.closedY+.0036*c*c+f.tilt*c;
 let y=mix(closed+(s>=0?.00035:-.00025),f.y+outerY*s,t);
 // At the radial seam UVs are sampled on the original closed-lid crease;
 // the same tissue coordinates are then lifted around the installed eyeball.
 const q=this.sample(x,y);const op=this.sample(f.x+f.outerX*c,f.y+outerY*s);samples.push({t,c,s,p:q.p,op:op.p,n:q.n});verts.push(x,y,q.p.z);uv.push(q.uv.x,q.uv.y);ao.push(q.ao);
 if(j<K&&i<N){const id=j*(N+1)+i;ix.push(id,id+N+1,id+1,id+1,id+N+1,id+N+2);}}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('skinOcclusion',new THREE.Float32BufferAttribute(ao,1));g.setIndex(ix);g.computeVertexNormals();const mesh=new THREE.Mesh(g,this.patchMaterial);mesh.name='fitted_'+f.id+'_upper_lower_eyelids';mesh.castShadow=true;mesh.receiveShadow=true;mesh.customDepthMaterial=this.lidDepth;mesh.frustumCulled=false;
 const lid={mesh,samples,N,K};eye.lid=lid;this.updateLid(eye,1);return lid;
 }
 makeRim(eye){const N=eye.lid.N,R=6,p=new Float32Array((N+1)*R*3),uv=new Float32Array((N+1)*R*2),ix=[];for(let i=0;i<=N;i++){for(let k=0;k<R;k++){const j=i*R+k;uv[j*2]=eye.lid.mesh.geometry.attributes.uv.getX(i);uv[j*2+1]=eye.lid.mesh.geometry.attributes.uv.getY(i);if(i<N){const a=j,b=i*R+(k+1)%R,c=(i+1)*R+k,d=(i+1)*R+(k+1)%R;ix.push(a,b,c,b,d,c);}}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.setIndex(ix);const mat=new THREE.MeshPhysicalMaterial({map:this.skin.map,color:0xe8bca8,roughness:.35,metalness:0,clearcoat:1,clearcoatRoughness:.07,envMapIntensity:.65,side:THREE.DoubleSide});const pass=this.pass;mat.onBeforeCompile=s=>{s.uniforms.eyePass=pass;s.fragmentShader='uniform float eyePass;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('void main() {','void main() {if(eyePass>.5)discard;');};eye.rim=new THREE.Mesh(g,mat);eye.rim.name='wet_lid_margin_'+eye.fit.id;eye.rim.frustumCulled=false;this.root.add(eye.rim);}
 updateLid(eye,open){const f=eye.fit,{mesh,samples}=eye.lid,p=mesh.geometry.attributes.position,axis=new THREE.Vector3(0,0,1).applyQuaternion(eye.group.quaternion);for(let i=0;i<samples.length;i++){const q=samples[i],{t,c,s}=q;const mid=mix(f.closedY+.0036*c*c,f.y,open)+f.tilt*c;const xi=f.x+f.innerX*c;const yi=mid+(s>=0?f.up:f.down)*Math.sign(s)*Math.pow(Math.abs(s),1.6)*open;
 const dx=xi-f.x,dy=yi-f.y;const corneaR2=(dx-axis.x*f.r)**2+(dy-axis.y*f.r)**2;const bulge=.095*f.r*Math.pow(Math.max(0,1-corneaR2/(f.r*.44)**2),1.6)*axis.z;
 let zi=f.z+Math.sqrt(Math.max(.000006,f.r*f.r-dx*dx-dy*dy))+bulge+.00020;
 const outer=q.op;let x=mix(xi,outer.x,t),y=mix(yi,outer.y,t);let z=mix(zi,outer.z,t*t*(3.-2.*t));z+=Math.sin(Math.PI*t)*.00030*(s>0?1:.3)*open;z+=.000016*t*t;
 p.setXYZ(i,x,y,z);}
 p.needsUpdate=true;mesh.geometry.computeVertexNormals();const n=mesh.geometry.attributes.normal;for(let i=0;i<samples.length;i++){const q=samples[i];if(q.t>.75){const w=THREE.MathUtils.smoothstep(q.t,.75,1);const v=new THREE.Vector3(n.getX(i),n.getY(i),n.getZ(i)).lerp(q.n,w).normalize();n.setXYZ(i,v.x,v.y,v.z);}}n.needsUpdate=true;eye.open=open;if(eye.rim){const rp=eye.rim.geometry.attributes.position,R=6;for(let i=0;i<=eye.lid.N;i++){const a=i/eye.lid.N*Math.PI*2;for(let k=0;k<R;k++){const w=k/R*Math.PI*2,rr=.00014;rp.setXYZ(i*R+k,p.getX(i)+Math.cos(a)*Math.cos(w)*rr,p.getY(i)+Math.sin(a)*Math.cos(w)*rr,p.getZ(i)-.00006+Math.sin(w)*rr);}}rp.needsUpdate=true;eye.rim.geometry.computeVertexNormals();}}
 set(values){if(!values||typeof values!=='object')throw Error('Invalid eye configuration');const ranges={headYaw:[-22,22],headPitch:[-12,12],pupil:[.16,.65],wet:[0,1],refraction:[0,1],caustic:[0,1.5],veins:[0,1],openness:[0,1.1]};for(const [k,v] of Object.entries(values)){if(k in ranges&&Number.isFinite(v))this.config[k]=clamp(v,...ranges[k]);else if(['enabled','autoBlink','autoPupil','headFollow'].includes(k)&&typeof v==='boolean')this.config[k]=v;else if(k==='mode'&&['camera','pointer','locked'].includes(v))this.config.mode=v;else if(k==='iris'&&['blue','hazel','brown','gray'].includes(v))this.config.iris=v;}this.dirty=true;this.onDirty();}
 lock(){this.manualTarget.copy(this.target);this.config.mode='locked';this.dirty=true;this.onDirty();}
 setTarget(p){if(!Array.isArray(p)||p.length!==3||!p.every(Number.isFinite))throw Error('Invalid eye target');this.manualTarget.fromArray(p);this.config.mode='locked';this.dirty=true;this.onDirty();}
 blink(){this.blinkAt=this.time;this.dirty=true;this.onDirty();}
 update(dt,force=false){dt=clamp(dt,0,.08);this.time+=dt;const cfg=this.config;let changed=this.dirty||force;this.clipUniform.value=cfg.enabled?1:0;for(const e of this.eyes){e.group.visible=cfg.enabled;e.lid.mesh.visible=cfg.enabled;if(e.rim)e.rim.visible=cfg.enabled;}
 const previous=this.target.clone();if(cfg.mode==='camera'){this.target.copy(this.camera.position);}else if(cfg.mode==='pointer'){const right=new THREE.Vector3(1,0,0).applyQuaternion(this.camera.quaternion),up=new THREE.Vector3(0,1,0).applyQuaternion(this.camera.quaternion);this.target.copy(this.camera.position).addScaledVector(right,this.pointer.x*.28).addScaledVector(up,this.pointer.y*.20);}else this.target.copy(this.manualTarget);
 if(previous.distanceToSquared(this.target)>1e-12)changed=true;
 let yaw=rad(clamp(Number(cfg.headYaw)||0,-22,22)),pitch=rad(clamp(Number(cfg.headPitch)||0,-12,12));
 if(cfg.headFollow){const d=this.target.clone().sub(new THREE.Vector3(0,.069,.06));yaw+=clamp(Math.atan2(d.x,d.z)*.32,-.25,.25);pitch-=clamp(Math.atan2(d.y,Math.hypot(d.x,d.z))*.24,-.13,.13);}
 const factor=force?1:1-Math.exp(-dt/Math.max(.08,cfg.headFollow?.32:.12));this.yaw=mix(this.yaw,yaw,factor);this.pitch=mix(this.pitch,pitch,factor);
 if(Math.abs(this.root.rotation.y-this.yaw)+Math.abs(this.root.rotation.x-this.pitch)>1e-6){this.root.rotation.set(this.pitch,this.yaw,0,'YXZ');this.root.updateMatrixWorld(true);this.onPose();changed=true;}
 if(cfg.autoBlink&&this.time>this.nextBlink){this.blinkAt=this.time;this.nextBlink=this.time+4.0+1.5*Math.sin(this.time*3.7)**2;}
 let phase=(this.time-this.blinkAt)/.25,blink=phase>=0&&phase<1?Math.sin(Math.PI*phase)**1.4:0;let open=clamp(Number(cfg.openness),0,1.1)*(1-blink);
 if(force||Math.abs(open-this.open)>.0001){this.open=open;for(const eye of this.eyes)this.updateLid(eye,open);this.onPose();changed=true;}
 const pGoal=cfg.autoPupil?clamp(.48-.16*Math.log2(1+this.key.intensity*.6+this.fill.intensity*.4),.20,.53):clamp(Number(cfg.pupil),.16,.65);const pn=mix(this.pupil,pGoal,force?1:1-Math.exp(-dt/(pGoal<this.pupil?.20:.70)));if(Math.abs(pn-this.pupil)>1e-5){this.pupil=pn;changed=true;}
 this.root.updateMatrixWorld(true);const invRoot=this.root.matrixWorld.clone().invert(),targetLocal=this.target.clone().applyMatrix4(invRoot);this.limited=false;
 for(const eye of this.eyes){const d=targetLocal.clone().sub(eye.group.position),distance=Math.hypot(d.x,d.z),rawYaw=Math.atan2(d.x,d.z),rawPitch=Math.atan2(d.y,distance);const gy=clamp(rawYaw,rad(-29),rad(29)),gp=clamp(rawPitch,rad(-19),rad(21));if(Math.abs(gy-rawYaw)>.001||Math.abs(gp-rawPitch)>.001)this.limited=true;
 const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(-gp,gy,0,'YXZ'));if(eye.group.quaternion.angleTo(q)>1e-5){eye.group.quaternion.slerp(q,force?1:1-Math.exp(-dt/.055));this.updateLid(eye,open);this.onPose();changed=true;}eye.group.updateMatrixWorld(true);
 const inverse=eye.group.matrixWorld.clone().invert();eye.u.eCamera.value.copy(this.camera.position).applyMatrix4(inverse);eye.u.eToHead.value.copy(invRoot).multiply(eye.group.matrixWorld);eye.u.eNormalMatrix.value.getNormalMatrix(new THREE.Matrix4().multiplyMatrices(this.camera.matrixWorldInverse,eye.group.matrixWorld));
 for(const [light,uk,uc] of [[this.key,'eKey','eKeyColor'],[this.fill,'eFill','eFillColor'],[this.rim,'eRim','eRimColor']]){const ld=light.position.clone().sub(light.target.position).normalize();eye.u[uk].value.copy(ld).transformDirection(inverse);eye.u[uc].value.copy(light.color).multiplyScalar(light.intensity);}
 eye.u.ePupil.value=this.pupil;eye.u.eWet.value=cfg.wet;eye.u.eCaustic.value=cfg.caustic;eye.u.eVeins.value=cfg.veins;eye.u.eRefract.value=cfg.refraction;eye.u.eOpen.value=open;
 const colors={blue:[.038,.080,.098],hazel:[.15,.12,.044],brown:[.11,.052,.019],gray:[.11,.135,.139]};eye.u.eIrisColor.value.setRGB(...(colors[cfg.iris]||colors.blue));eye.material.clearcoat=Math.max(.00001,clamp(cfg.wet,0,1));eye.material.clearcoatRoughness=.08-.052*cfg.wet;
 }
 this.patchMaterial.roughness=this.skin.roughness;this.patchMaterial.clearcoat=this.skin.clearcoat;this.patchMaterial.clearcoatRoughness=this.skin.clearcoatRoughness;this.patchMaterial.envMapIntensity=this.skin.envMapIntensity;
 this.dirty=false;return changed;
 }
 poseInfo(){this.root.updateMatrixWorld(true);return {version:EYE_VERSION,mode:this.config.mode,target:this.target.toArray(),limited:this.limited,headRotation:[this.pitch,this.yaw],open:this.open,pupil:this.pupil,eyes:this.eyes.map(e=>{let o=e.group.getWorldPosition(new THREE.Vector3()),q=e.group.getWorldQuaternion(new THREE.Quaternion()),d=new THREE.Vector3(0,0,1).applyQuaternion(q),to=this.target.clone().sub(o).normalize();return {id:e.fit.id,center:o.toArray(),direction:d.toArray(),targetErrorDegrees:THREE.MathUtils.radToDeg(d.angleTo(to)),quaternion:q.toArray(),triangles:e.mesh.geometry.index.count/3};}),headGeometryUnmodified:true};}
}
