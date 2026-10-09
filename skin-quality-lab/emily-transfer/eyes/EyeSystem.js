import * as THREE from 'three';

// Independent implementation after inspecting Digital Emily createEyes(),
// updateEyeRig() and updateDynamicEyeTexture(). No XG geometry or texture is copied.
// Units are metres, +Y up and +Z forward. Socket calibration belongs to this scan.
export const EYE_VERSION='eyes/6.1.0';
export const SOCKETS=[
 {name:'right',x:-.0300,y:.0690,z:.0627,sign:-1,rx:.0205,ry:.0175,half:.0119,radius:.0122},
 {name:'left', x:.0217,y:.0690,z:.0625,sign: 1,rx:.0203,ry:.0173,half:.0117,radius:.0122}
];
const clamp=THREE.MathUtils.clamp,mix=THREE.MathUtils.lerp;
const TAU=Math.PI*2,smooth=t=>t*t*(3-2*t);
export const eyeCutGLSL=`
uniform float uEyeCut;
bool inEyePatch(vec3 p){
 vec2 r=(p.xy-vec2(-.0300,.0690))/vec2(.0205,.0175);
 vec2 l=(p.xy-vec2(.0217,.0690))/vec2(.0203,.0173);
 return uEyeCut>.5&&p.z>.045&&(dot(r,r)<1.||dot(l,l)<1.);
}
`;

// Local triangle bins: ray/UV queries run only once at initialization, never per frame.
function surfaceSampler(geometry,c){
 const P=geometry.attributes.position,N=geometry.attributes.normal,UV=geometry.attributes.uv,AO=geometry.attributes.skinOcclusion,I=geometry.index.array;
 const size=40,minX=c.x-c.rx*1.08,minY=c.y-c.ry*1.08,w=c.rx*2.16,h=c.ry*2.16,bins=Array.from({length:size*size},()=>[]);
 const cell=(x,y)=>[clamp(Math.floor((x-minX)/w*size),0,size-1),clamp(Math.floor((y-minY)/h*size),0,size-1)];
 for(let k=0;k<I.length;k+=3){const a=I[k],b=I[k+1],d=I[k+2];if(Math.max(P.getZ(a),P.getZ(b),P.getZ(d))<.045)continue;
  const x0=Math.min(P.getX(a),P.getX(b),P.getX(d)),x1=Math.max(P.getX(a),P.getX(b),P.getX(d)),y0=Math.min(P.getY(a),P.getY(b),P.getY(d)),y1=Math.max(P.getY(a),P.getY(b),P.getY(d));
  if(x1<minX||x0>minX+w||y1<minY||y0>minY+h)continue;const lo=cell(x0,y0),hi=cell(x1,y1);
  for(let y=lo[1];y<=hi[1];y++)for(let x=lo[0];x<=hi[0];x++)bins[y*size+x].push(k);
 }
 return (x,y)=>{let best=null,z=-Infinity;const b=cell(x,y);
  for(const k of bins[b[1]*size+b[0]]){const a=I[k],b=I[k+1],d=I[k+2],ax=P.getX(a),ay=P.getY(a),bx=P.getX(b),by=P.getY(b),dx=P.getX(d),dy=P.getY(d);const den=(by-dy)*(ax-dx)+(dx-bx)*(ay-dy);if(Math.abs(den)<1e-14)continue;
   const u=((by-dy)*(x-dx)+(dx-bx)*(y-dy))/den,v=((dy-ay)*(x-dx)+(ax-dx)*(y-dy))/den,t=1-u-v;if(Math.min(u,v,t)<-.001)continue;
   const nz=u*P.getZ(a)+v*P.getZ(b)+t*P.getZ(d);if(nz<=z)continue;z=nz;
   best={z,u:u*UV.getX(a)+v*UV.getX(b)+t*UV.getX(d),v:u*UV.getY(a)+v*UV.getY(b)+t*UV.getY(d),ao:AO?u*AO.getX(a)+v*AO.getX(b)+t*AO.getX(d):.8,n:new THREE.Vector3(u*N.getX(a)+v*N.getX(b)+t*N.getX(d),u*N.getY(a)+v*N.getY(b)+t*N.getY(d),u*N.getZ(a)+v*N.getZ(b)+t*N.getZ(d)).normalize()};
  }if(!best)throw Error('Eye socket sampling missed source surface at '+x+','+y);return best;
 };
}
function random(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function irisField(){
 const W=1024,H=256,data=new Uint8Array(W*H*4),rnd=random(7813),table=Float32Array.from({length:2048},rnd);
 const ns=(x,salt=0)=>{let i=Math.floor(x),t=x-i;t=smooth(t);return mix(table[(i+salt)&2047],table[(i+1+salt)&2047],t);};
 for(let y=0;y<H;y++){let r=y/(H-1);for(let x=0;x<W;x++){let a=x/W,flow=x+11*Math.sin(r*5+a*TAU*3)+5*Math.sin(r*11+a*TAU*7),coarse=ns(flow*.075,97),fiber=ns(flow*.49,213),fine=ns(flow*1.7,579),band=ns(r*16+a*3,731);
  let crypt=ns(flow*.043,1091)*ns(r*24+coarse*7,1331);crypt=smooth(clamp((crypt-.47)*5,0,1))*Math.exp(-Math.pow((r-.38)/.23,2));
  const i=(y*W+x)*4;data[i]=clamp((.33+.46*coarse+.15*band-.35*crypt)*255,0,255);data[i+1]=clamp((.2+.48*fiber+.23*fine)*255,0,255);data[i+2]=clamp(crypt*255,0,255);data[i+3]=255;
 }}const t=new THREE.DataTexture(data,W,H);t.wrapS=THREE.RepeatWrapping;t.wrapT=THREE.ClampToEdgeWrapping;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;
}
function scleraField(){
 const size=768,canvas=document.createElement('canvas');canvas.width=canvas.height=size;const ctx=canvas.getContext('2d'),rnd=random(54861);
 ctx.fillStyle='#c7beb1';ctx.fillRect(0,0,size,size);const grad=ctx.createRadialGradient(384,384,190,384,384,530);grad.addColorStop(0,'rgba(180,140,130,0)');grad.addColorStop(1,'rgba(160,94,83,.32)');ctx.fillStyle=grad;ctx.fillRect(0,0,size,size);
 for(let i=0;i<67;i++){const a=rnd()*TAU,r0=330+rnd()*190,r1=190+rnd()*120,swing=(rnd()-.5)*.28;const point=(r,t)=>[384+Math.cos(a+t)*r,384+Math.sin(a+t)*r];let p0=point(r0,0),p1=point(mix(r0,r1,.3),swing),p2=point(mix(r0,r1,.65),-swing*.6),p3=point(r1,swing*.4);
  ctx.beginPath();ctx.moveTo(...p0);ctx.bezierCurveTo(...p1,...p2,...p3);ctx.strokeStyle='rgba(149,60,60,'+(.1+rnd()*.12)+')';ctx.lineWidth=.5+rnd()*1.0;ctx.stroke();
  if(i%2===0){ctx.beginPath();ctx.moveTo(...p2);let b=point(r1+15,swing+(.05+rnd()*.1));ctx.quadraticCurveTo(p2[0]+(rnd()-.5)*35,p2[1]+(rnd()-.5)*35,...b);ctx.lineWidth=.45;ctx.stroke();}
 }
 const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;return t;
}
const eyeFunctions=`
uniform sampler2D uIrisField,uScleraField;
uniform vec3 uEyeCamera,uIrisColor,uEyeKey,uEyeFill;
uniform float uPupil,uEyePass,uEyeWetness,uEyeRadius,uIrisDepth,uIrisLight,uEyeLayer;
varying vec3 vEyePoint,vEyeNormal;
vec3 ocularAlbedo(){
 vec3 P=vEyePoint/uEyeRadius,N=normalize(vEyeNormal),V=normalize(uEyeCamera-vEyePoint);
 vec3 ray=refract(-V,N,1./1.376);
 float travel=(uIrisDepth-P.z)/min(-.001,ray.z);
 vec2 hit=P.xy+ray.xy*max(travel,0.);const float irisRadius=.435;float r=length(hit)/irisRadius;
 vec2 scleraUV=vec2(.5)+P.xy*.5;
 vec3 sclera=texture2D(uScleraField,scleraUV).rgb;
 float facing=smoothstep(.55,.83,P.z);
 float irisMask=(1.-smoothstep(.976,1.035,r))*facing;
 float pupil=uPupil/irisRadius;float expanded=clamp((r-pupil)/max(.1,1.-pupil),0.,1.);
 float angle=atan(hit.y,hit.x)/6.2831853+.5;
 vec3 field=texture2D(uIrisField,vec2(angle,expanded)).rgb;
 float collar=exp(-pow((expanded-.24)/.10,2.));
 vec3 inner=vec3(.20,.125,.046);
 vec3 iris=mix(uIrisColor,inner,collar*.36)*(field.r*.95+.26)*(field.g*.47+.62);
 iris*=1.-field.b*.65;
 float ring=smoothstep(.84,1.00,r);iris*=1.-ring*.82;
 float pupilMask=1.-smoothstep(pupil-.008,pupil+.006,r);
 iris=mix(iris,vec3(.00035,.00024,.00018),pupilMask);
 float opposite=clamp(dot(normalize(vec3(-hit,.18)),normalize(uEyeKey)),0.,1.);
 iris*=.84+.36*opposite*uIrisLight;
 vec3 color=mix(sclera,iris,irisMask);
 // Eye-local smooth orbital shading; actual geometry provides occlusion at the rim.
 float lidShade=mix(.53,1.,(1.-smoothstep(-.24,.40,P.y)));
 return color*lidShade;
}
`;
function makeEyeMaterial(shared,fields){
 const m=new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:.24,metalness:0,ior:1.376,specularIntensity:.65,clearcoat:1,clearcoatRoughness:.065,envMapIntensity:.8});
 m.customProgramCacheKey=()=>EYE_VERSION+'/optics';
 m.onBeforeCompile=s=>{Object.assign(s.uniforms,shared,{uIrisField:{value:fields.iris},uScleraField:{value:fields.sclera}});
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vEyePoint,vEyeNormal;').replace('#include <begin_vertex>','#include <begin_vertex>\nvEyePoint=position;vEyeNormal=normal;');
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\n'+eyeFunctions).replace('#include <map_fragment>','diffuseColor.rgb*=ocularAlbedo();');
  s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(.27,.105,smoothstep(.78,.93,vEyePoint.z/uEyeRadius));');
  s.fragmentShader=s.fragmentShader.replace('#include <opaque_fragment>',`#include <opaque_fragment>
   if(uEyePass>.5&&uEyePass<1.5){gl_FragColor=vec4(0.);return;}
   if(uEyePass>1.5){gl_FragColor=vec4(diffuseColor.rgb,1.);return;}
   if(uEyeLayer>.5&&uEyeLayer<1.5)gl_FragColor.rgb=diffuseColor.rgb;
   if(uEyeLayer>1.5&&uEyeLayer<2.5)gl_FragColor.rgb=normal*.5+.5;
   if(uEyeLayer>2.5&&uEyeLayer<3.5)gl_FragColor.rgb=vec3(roughnessFactor);
  `);
 };
 return m;
}
function noDiffusion(material,pass){const old=material.onBeforeCompile;material.onBeforeCompile=s=>{old.call(material,s);s.uniforms.uEyePass=pass;s.fragmentShader='uniform float uEyePass;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <opaque_fragment>','#include <opaque_fragment>\nif(uEyePass>.5&&uEyePass<1.5){gl_FragColor=vec4(0.);return;}');};}
function ocularGeometry(radius){
 const g=new THREE.SphereGeometry(radius,112,80);g.rotateX(Math.PI/2);
 const p=g.attributes.position;for(let i=0;i<p.count;i++){let z=p.getZ(i)/radius;if(z>.75){let t=smooth(clamp((z-.75)/.25,0,1));p.setZ(i,p.getZ(i)+radius*.075*t*t);}}
 g.computeVertexNormals();return g;
}
export class EyeSystem{
 constructor({mesh,skin,scene,camera,canvas,pass,layer,key,fill,rim,requestRender}){
  Object.assign(this,{mesh,skin,scene,camera,canvas,pass,key,fill,rim,requestRender});
  this.config={enabled:true,mode:'camera',autoBlink:true,autoPupil:true,pupilMM:3.4,iris:'blue',wetness:.82,irisDepth:.83,opening:.88};
  this.state={version:EYE_VERSION,target:[0,.069,.65],clamped:false,blink:0,pupilMM:3.6,ready:false,lockErrorDegrees:[0,0],t:0};
  this.cut={value:1};this.group=new THREE.Group();this.group.name='ET02-fitted-eyes';scene.add(this.group);this.target=new THREE.Vector3(0,.069,.65);this.pointerTarget=this.target.clone();this.lockedTarget=this.target.clone();this.pointer=new THREE.Vector2();this.pointerActive=false;this.time=0;this.nextBlink=4.1;this.blinkStart=-99;this.rnd=random(7193);this.nextSaccade=2;this.pupil=.0017;
  this.fields={iris:irisField(),sclera:scleraField()};this.eyes=[];
  // Keep the existing material function for new lids, then clip only the old closed patch.
  const original=skin.onBeforeCompile;
  for(const c of SOCKETS){
   const sample=surfaceSampler(mesh.geometry,c),pivot=new THREE.Group();pivot.position.set(c.x,c.y,c.z);this.group.add(pivot);
   const uniforms={uEyePass:pass,uEyeLayer:layer,uEyeCamera:{value:new THREE.Vector3()},uPupil:{value:this.pupil/c.radius},uIrisColor:{value:new THREE.Color(.10,.21,.24)},uEyeKey:{value:new THREE.Vector3()},uEyeFill:{value:new THREE.Vector3()},uEyeWetness:{value:1},uEyeRadius:{value:c.radius},uIrisDepth:{value:.83},uIrisLight:{value:1}};
   const eyeMaterial=makeEyeMaterial(uniforms,this.fields),ball=new THREE.Mesh(ocularGeometry(c.radius),eyeMaterial);ball.name='optical-eye-'+c.name;ball.castShadow=false;ball.receiveShadow=false;pivot.add(ball);
   const lidMaterial=skin.clone();lidMaterial.onBeforeCompile=original;lidMaterial.customProgramCacheKey=()=>EYE_VERSION+'/skin-lids';
   const lid=this.makeLid(c,sample,lidMaterial),rim=this.makeRim(c),lashes=this.makeLashes(c);
   this.group.add(lid.mesh,rim.mesh,lashes.mesh);
   const e={c,sample,pivot,ball,uniforms,lid,rim,lashes,desired:new THREE.Quaternion(),direction:new THREE.Vector3(0,0,1),localTarget:new THREE.Vector3(),rotation:new THREE.Euler(0,0,0,'YXZ')};this.eyes.push(e);this.updateLid(e,0);
  }
  skin.onBeforeCompile=s=>{original(s);Object.assign(s.uniforms,{uEyeCut:this.cut});s.fragmentShader=eyeCutGLSL+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(inEyePatch(vSkinPosition))discard;');};skin.customProgramCacheKey=()=>EYE_VERSION+'/head-openings';skin.needsUpdate=true;
  this.move=e=>{if(e.buttons)return;const r=canvas.getBoundingClientRect();this.pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);this.pointerActive=true;requestRender();};canvas.addEventListener('pointermove',this.move);
  this.leave=()=>{this.pointerActive=false;};canvas.addEventListener('pointerleave',this.leave);
  this.click=e=>{if(e.shiftKey){this.lock();e.preventDefault();}};canvas.addEventListener('click',this.click);
  this.setPalette('blue');this.state.ready=true;this.update(.016,true);
 }
 makeLid(c,sample,mat){
  const A=160,R=20,p=[],uv=[],ao=[],n=[],indices=[],entries=[];
  for(let j=0;j<=R;j++){let t=j/R;for(let i=0;i<=A;i++){let a=i/A*TAU,nx=Math.cos(a),ny=Math.sin(a),x0=c.x+c.half*nx,seam=c.y-.0037+.0031*Math.pow(Math.abs(nx),1.8)-.0012*nx*c.sign;
    const xo=c.x+c.rx*1.035*nx,yo=c.y+c.ry*1.035*ny,tx=mix(x0,xo,t),ty=mix(seam,yo,t),src=sample(tx,ty),outer=sample(xo,yo);
    entries.push({t,a,nx,ny,xo,yo,src,outer});p.push(tx,ty,src.z);uv.push(src.u,src.v);ao.push(src.ao);n.push(src.n.x,src.n.y,src.n.z);
    if(j<R&&i<A){let k=j*(A+1)+i;indices.push(k,k+A+1,k+1,k+1,k+A+1,k+A+2);}
  }}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('skinOcclusion',new THREE.Float32BufferAttribute(ao,1));g.setIndex(indices);const m=new THREE.Mesh(g,mat);m.name='fitted-lids-'+c.name;m.frustumCulled=false;m.castShadow=true;m.receiveShadow=true;return {mesh:m,entries,A,R};
 }
 rimPoint(c,a,blink){
  const nx=Math.cos(a),ny=Math.sin(a),arc=Math.pow(Math.abs(ny),1.35);
  const medial=clamp((1-nx*c.sign)*.5,0,1),lateral=1-medial;
  const seam=c.y-.0035+.0028*Math.pow(Math.abs(nx),1.7)-.0007*nx*c.sign;
  const base=c.y-.00075-.00075*nx*c.sign;
  const upper=(.00390*(1-.16*medial-.06*lateral)+.00020*(.30-medial))*arc*this.config.opening;
  const lower=.00235*(.94-.10*medial)*arc*this.config.opening;
  const gazeFollow=clamp(-(c.gazePitch||0)*.00165,-.00048,.00048)*(ny>=0?1:.34);
  const open=base+(ny>=0?upper:-lower)+gazeFollow;
  const x=c.x+c.half*nx*(1-.028*medial),y=mix(open,seam,blink),dx=x-c.x,dy=y-c.y;
  const z=c.z+Math.sqrt(Math.max(.000006,c.radius*c.radius-dx*dx-dy*dy))+.00016;
  return new THREE.Vector3(x,y,z);
 }
 makeRim(c){
  const A=160,S=6,p=new Float32Array((A+1)*(S+1)*3),ix=[];for(let a=0;a<A;a++)for(let s=0;s<S;s++){let i=a*(S+1)+s;ix.push(i,i+S+1,i+1,i+1,i+S+1,i+S+2);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setIndex(ix);
  const m=new THREE.MeshPhysicalMaterial({color:0x8f5b55,roughness:.31,clearcoat:.72,clearcoatRoughness:.12,ior:1.376,envMapIntensity:.48,transparent:true,opacity:.52,depthWrite:false});noDiffusion(m,this.pass);
  const obj=new THREE.Mesh(g,m);obj.frustumCulled=false;obj.name='tear-meniscus-'+c.name;return {mesh:obj,A,S};
 }
 makeLashes(c){
  const entries=[],p=[],ix=[];for(let upper of [true,false])for(let i=0;i<(upper?38:10);i++){let t=(i+.5)/(upper?38:10),a=upper?t*Math.PI:Math.PI+t*Math.PI,len=(upper?.00078:.00028)+this.rnd()*(upper?.00068:.00028);entries.push({a,len,upper,lean:(this.rnd()-.5)*.0004});let k=p.length/3;for(let j=0;j<5;j++)for(let side of [-1,1])p.push(0,0,0);for(let j=0;j<4;j++)ix.push(k+j*2,k+j*2+1,k+j*2+2,k+j*2+1,k+j*2+3,k+j*2+2);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(ix);const mat=new THREE.MeshStandardMaterial({color:0x3b2b23,roughness:.72,side:THREE.DoubleSide,transparent:true,opacity:.64,depthWrite:false});noDiffusion(mat,this.pass);const m=new THREE.Mesh(g,mat);m.name='fine-eyelashes-'+c.name;m.frustumCulled=false;return {mesh:m,entries};
 }
 updateLid(e,blink){
  const {c,lid,rim,lashes}=e,P=lid.mesh.geometry.attributes.position;
  for(let i=0;i<lid.entries.length;i++){let q=lid.entries[i],inner=this.rimPoint(c,q.a,blink),t=q.t,s=smooth(t);P.setXYZ(i,mix(inner.x,q.xo,t),mix(inner.y,q.yo,t),mix(inner.z,q.src.z,s)+Math.sin(Math.PI*t)*.00018);}
  P.needsUpdate=true;lid.mesh.geometry.computeVertexNormals();const N=lid.mesh.geometry.attributes.normal;
  for(let i=0;i<lid.entries.length;i++){let q=lid.entries[i],t=smooth(clamp((q.t-.76)/.24,0,1));if(t){let n=new THREE.Vector3(N.getX(i),N.getY(i),N.getZ(i)).lerp(q.src.n,t).normalize();N.setXYZ(i,n.x,n.y,n.z);}}
  N.needsUpdate=true;
  const rp=rim.mesh.geometry.attributes.position;
  for(let a=0;a<=rim.A;a++){let theta=a/rim.A*TAU,pt=this.rimPoint(c,theta,blink),lower=smooth(clamp((-Math.sin(theta)+.08)/.92,0,1)),medial=clamp((1-Math.cos(theta)*c.sign)*.5,0,1);for(let s=0;s<=rim.S;s++){let b=s/rim.S*TAU,rad=.000016+.000060*lower+.000020*medial;rp.setXYZ(a*(rim.S+1)+s,pt.x+Math.cos(theta)*Math.cos(b)*rad,pt.y+Math.sin(theta)*Math.cos(b)*rad,pt.z+Math.sin(b)*rad+.000035);}}
  rp.needsUpdate=true;rim.mesh.geometry.computeVertexNormals();
  const lp=lashes.mesh.geometry.attributes.position;
  for(let i=0;i<lashes.entries.length;i++){let q=lashes.entries[i],pt=this.rimPoint(c,q.a,blink);for(let j=0;j<5;j++){let t=j/4;for(let s=0;s<2;s++){let width=.000025*(1-.9*t)*(s?1:-1);lp.setXYZ(i*10+j*2+s,pt.x+Math.cos(q.a)*q.len*t*.35+q.lean*t+width,pt.y+Math.sin(q.a)*q.len*t*.65,pt.z+.00015+q.len*(.48*t+.35*t*t));}}}
  lp.needsUpdate=true;lashes.mesh.geometry.computeVertexNormals();this.lastLid=blink;
 }
 installDepth(depthMaterial,fuzz){
  const original=depthMaterial.onBeforeCompile;
  depthMaterial.onBeforeCompile=s=>{original(s);s.uniforms.uEyeCut=this.cut;s.vertexShader='varying vec3 vEyeDepthPosition;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvEyeDepthPosition=position;');s.fragmentShader='varying vec3 vEyeDepthPosition;\n'+eyeCutGLSL+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(inEyePatch(vEyeDepthPosition))discard;');};depthMaterial.needsUpdate=true;depthMaterial.customProgramCacheKey=()=>EYE_VERSION+'/depth-hole';
  fuzz.material.uniforms.uEyeCut=this.cut;fuzz.material.vertexShader='varying vec3 vHairEyePosition;\n'+fuzz.material.vertexShader.replace('void main(){','void main(){vHairEyePosition=position;');fuzz.material.fragmentShader='varying vec3 vHairEyePosition;\n'+eyeCutGLSL+fuzz.material.fragmentShader.replace('void main(){','void main(){if(inEyePatch(vHairEyePosition))discard;');fuzz.material.needsUpdate=true;
 }
 setPalette(name){const colors={blue:[.10,.21,.24],hazel:[.19,.135,.065],brown:[.09,.039,.014],green:[.13,.18,.085]};if(!colors[name])return;this.config.iris=name;for(const e of this.eyes)e.uniforms.uIrisColor.value.setRGB(...colors[name]);this.requestRender();}
 lock(){this.config.mode='fixed';this.lockedTarget.copy(this.target);this.requestRender();}
 setMode(mode){if(!['camera','pointer','fixed','relaxed'].includes(mode))throw Error('Unknown gaze mode');if(mode==='fixed')this.lock();else this.config.mode=mode;this.requestRender();}
 setTarget(v){if(!Array.isArray(v)||v.length!==3||!v.every(Number.isFinite))throw Error('Gaze target must be three finite coordinates');this.lockedTarget.fromArray(v);this.config.mode='fixed';this.requestRender();}
 blink(){this.blinkStart=this.time;this.nextBlink=this.time+3.5+this.rnd()*2.4;this.requestRender();}
 update(dt,instant=false){
  dt=clamp(dt,0,.05);this.time+=dt;const c=this.config;this.cut.value=c.enabled?1:0;this.group.visible=c.enabled;if(!c.enabled)return false;
  if(c.mode==='camera')this.target.copy(this.camera.position);
  else if(c.mode==='pointer'){
   if(this.pointerActive){const center=new THREE.Vector3(-.004,.069,.074),normal=this.camera.position.clone().sub(center).normalize(),planeCenter=center.clone().addScaledVector(normal,.48),plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,planeCenter),ray=new THREE.Raycaster();ray.setFromCamera(this.pointer,this.camera);ray.ray.intersectPlane(plane,this.pointerTarget);}
   this.target.copy(this.pointerTarget);
  }else if(c.mode==='fixed')this.target.copy(this.lockedTarget);
  else {if(this.time>=this.nextSaccade){this.lockedTarget.set((this.rnd()-.5)*.24,.069+(this.rnd()-.5)*.08,.70);this.nextSaccade=this.time+1.1+this.rnd()*2.8;}this.target.copy(this.lockedTarget);}
  if(c.autoBlink&&this.time>=this.nextBlink)this.blink();let bt=this.time-this.blinkStart,blink=0;if(bt>=0&&bt<.28){blink=bt<.08?smooth(bt/.08):bt<.11?1:1-smooth((bt-.11)/.17);}
  let changed=Math.abs(blink-(this.state.blink||0))>.0002;this.state.blink=blink;
  const lightDir=this.key.position.clone().sub(this.key.target.position).normalize();let lightAmount=0;
  for(let i=0;i<this.eyes.length;i++){let e=this.eyes[i],v=e.localTarget.copy(this.target).sub(e.pivot.position);let yaw=Math.atan2(v.x,Math.max(.04,v.z)),pitch=-Math.atan2(v.y,Math.hypot(v.x,v.z));const cy=clamp(yaw,-.46,.46),cp=clamp(pitch,-.28,.30);e.c.gazePitch=cp;this.state.clamped=Math.abs(yaw-cy)>.001||Math.abs(pitch-cp)>.001;e.rotation.set(cp,cy,0,'YXZ');e.desired.setFromEuler(e.rotation);const before=e.pivot.quaternion.angleTo(e.desired);e.pivot.quaternion.slerp(e.desired,instant?1:1-Math.exp(-dt*22));changed=changed||before>.0001;
   e.lid.mesh.material.roughness=this.skin.roughness;e.lid.mesh.material.clearcoat=this.skin.clearcoat;e.lid.mesh.material.clearcoatRoughness=this.skin.clearcoatRoughness;e.lid.mesh.material.envMapIntensity=this.skin.envMapIntensity;e.pivot.updateMatrixWorld(true);e.direction.set(0,0,1).applyQuaternion(e.pivot.quaternion);this.state.lockErrorDegrees[i]=THREE.MathUtils.radToDeg(e.direction.angleTo(v.normalize()));
   e.uniforms.uEyeCamera.value.copy(this.camera.position);e.pivot.worldToLocal(e.uniforms.uEyeCamera.value);e.uniforms.uEyeKey.value.copy(lightDir).applyQuaternion(e.pivot.quaternion.clone().invert());e.uniforms.uEyeFill.value.copy(this.fill.position).normalize();e.uniforms.uIrisDepth.value=c.irisDepth;e.ball.material.clearcoat=c.wetness;e.ball.material.clearcoatRoughness=mix(.18,.065,c.wetness);
   lightAmount=Math.max(lightAmount,Math.max(0,e.direction.dot(lightDir))*this.key.intensity+this.fill.intensity*.5);
   if(changed||instant||this.lastOpening!==c.opening)this.updateLid(e,blink);
  }
  const targetPupil=c.autoPupil?clamp(.00285-.00048*lightAmount,.00125,.00285):clamp(c.pupilMM/2000,.001,.0038);const pd=targetPupil-this.pupil;this.pupil+=pd*(instant?1:1-Math.exp(-dt*(pd<0?9:2.5)));changed=changed||Math.abs(pd)>.0000005;
  for(let e of this.eyes)e.uniforms.uPupil.value=this.pupil/e.c.radius;
  this.lastOpening=c.opening;this.state.pupilMM=this.pupil*2000;this.state.target=this.target.toArray();this.state.mode=c.mode;this.state.t=this.time;return changed;
 }
 snapshot(){return {schema:'kaopu/eye-rig@1',...this.config,fixedTarget:this.lockedTarget.toArray()};}
 restore(o){if(!o)return;if(o.schema!=='kaopu/eye-rig@1')throw Error('Unsupported eye recipe');for(let k of ['enabled','autoBlink','autoPupil'])if(typeof o[k]==='boolean')this.config[k]=o[k];for(let [k,lo,hi] of [['pupilMM',2,7.6],['wetness',0,1],['opening',.56,1.15],['irisDepth',.72,.91]])if(Number.isFinite(o[k]))this.config[k]=clamp(o[k],lo,hi);if(o.fixedTarget)this.setTarget(o.fixedTarget);if(o.mode==='fixed')this.config.mode='fixed';else if(o.mode)this.setMode(o.mode);if(o.iris)this.setPalette(o.iris);this.update(0,true);}
 info(){return {...this.state,config:{...this.config},eyes:this.eyes.map(e=>({name:e.c.name,center:e.pivot.position.toArray(),quaternion:e.pivot.quaternion.toArray(),forward:e.direction.toArray(),triangles:e.ball.geometry.index.count/3})),sameSourceGeometry:this.mesh.geometry.uuid,externalEyeAssets:0};}
 dispose(){this.canvas.removeEventListener('pointermove',this.move);this.canvas.removeEventListener('pointerleave',this.leave);this.canvas.removeEventListener('click',this.click);this.group.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});this.fields.iris.dispose();this.fields.sclera.dispose();this.group.removeFromParent();}
}

// ET02 fitted calibration R2

// ET02 natural adult-eye calibration R3
