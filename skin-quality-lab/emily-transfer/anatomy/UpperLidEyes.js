import * as THREE from 'three';
import {ResearchEyes} from '../research/ResearchEyes.js';
const clamp=THREE.MathUtils.clamp,lerp=THREE.MathUtils.lerp,TAU=Math.PI*2;
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const upperWeight=a=>Math.pow(Math.max(0,Math.sin(a)),.65);
/** ET05: actual anterior skin -> bevel -> posterior lid-wiper surface.
 * Metres. Inherits ET03 contact geometry and ET04's single final-pose writer.
 * The 0.035 mm inner clearance is a numerical wet-contact allowance, not an
 * anatomical air gap. Dimensions are a fitted template, not subject ground truth.
 */
export class UpperLidEyes extends ResearchEyes {
 constructor(options){
  super(options);
  this.ready=this.ready.then(()=>{
   for(const e of this.eyes){
    const old=e.c.radius;e.c.radius=.012;e.ball.geometry.scale(e.c.radius/old,e.c.radius/old,e.c.radius/old);e.ball.geometry.computeVertexNormals();
    e.uniforms.uEyeRadius.value=e.c.radius;
    const prev=e.ball.material.onBeforeCompile;
    e.ball.material.onBeforeCompile=s=>{prev(s);s.fragmentShader=s.fragmentShader.replace('const float irisRadius=.456;','const float irisRadius=.438;');};
    e.ball.material.customProgramCacheKey=()=> 'ET05-ocular-scale';e.ball.material.needsUpdate=true;
    e.depthFit={...e.depthFit,ET05RadiusMM:12,ET05CenterUnchanged:true};
   }
   this.update(0,true);this.requestRender();return this;
  });
 }
 margin(c,a,blink){
  const nx=Math.cos(a),u=nx*c.sign,w=Math.sqrt(Math.max(0,1-nx*nx)),isUpper=Math.sin(a)>=0;
  // Correct the ET03 least-squares endpoint overshoot. Its positive u^2 term
  // made a near-rectangular aperture and obtuse canthi despite plausible height.
  const baseline=.0548245*u;
  const top=(baseline+(1-u*u)*(.310-.085*u-.025*u*u))*c.half;
  const oldBottom=baseline+(1-u*u)*(-.269806822+u*(-.075591125+u*(-.259134445-.003966655*u)));
  const taper=smooth((Math.abs(u)-.38)/.47);
  const bottom=lerp(oldBottom,baseline-(1-u*u)*(.270+.015*u),taper)*c.half;
  const pitch=c.gazePitch||0,yaw=c.gazeYaw||0,squint=this.config.squint||0,open=this.config.opening||1;
  let up=top*open-pitch*.0051*w-.0018*squint*w,down=bottom*open-pitch*.0023*w+.0017*squint*w;
  if(up<down+.00006*w){const mid=(up+down)*.5;up=mid+.00003*w;down=mid-.00003*w;}
  const closed=c.y-.0035+.0028*Math.pow(Math.abs(nx),1.7)-.0007*u;
  const y=lerp(c.y-.0005+(isUpper?up:down),closed,blink),x=c.x+c.half*nx+yaw*.00045*w*(1-blink);
  const z=this.eyeFront(c,x,y);
  // Posterior aperture stays on the globe; anterior skin is lifted separately.
  return new THREE.Vector3(x,y,z===null?c.z+.003:z+.000035);
 }
 makeLid(c,sample,mat){
  if(!c.et05Half){c.half*=.97;c.et05Half=true;}
  const lid=super.makeLid(c,sample,mat),A=lid.A,B=8,positions=new Float32Array((A+1)*(B+1)*3),uvs=new Float32Array((A+1)*(B+1)*2),occlusion=new Float32Array((A+1)*(B+1)),ts=new Float32Array((A+1)*(B+1)),depths=new Float32Array((A+1)*(B+1)),idx=[];
  for(let j=0;j<=B;j++)for(let i=0;i<=A;i++){
   const k=j*(A+1)+i,q=lid.entries[i];uvs[k*2]=q.src.u;uvs[k*2+1]=q.src.v;occlusion[k]=q.src.ao;ts[k]=.045;depths[k]=j/B;
   if(j<B&&i<A)idx.push(k,k+1,k+A+1,k+1,k+A+2,k+A+1);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(positions,3));g.setAttribute('uv',new THREE.BufferAttribute(uvs,2));g.setAttribute('skinOcclusion',new THREE.BufferAttribute(occlusion,1));g.setAttribute('eyelidT',new THREE.BufferAttribute(ts,1));g.setAttribute('marginDepth',new THREE.BufferAttribute(depths,1));g.setIndex(idx);g.computeVertexNormals();
  const bandMat=lid.mesh.material.clone(),prev=lid.mesh.material.onBeforeCompile;
  bandMat.onBeforeCompile=s=>{prev(s);s.vertexShader='attribute float marginDepth;varying float vMarginDepth;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvMarginDepth=marginDepth;');s.fragmentShader='varying float vMarginDepth;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb*=mix(vec3(1.),vec3(.82,.64,.60),smoothstep(.35,1.,vMarginDepth)*.45);');s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=max(roughnessFactor,.38);');};
  bandMat.customProgramCacheKey=()=> 'ET05-sealed-lid-margin';bandMat.side=THREE.DoubleSide;
  const band=new THREE.Mesh(g,bandMat);band.name='ET05-anterior-to-posterior-rim-'+c.name;band.frustumCulled=false;band.castShadow=true;band.receiveShadow=true;lid.mesh.add(band);lid.band=band;lid.B=B;
  return lid;
 }
 updateLid(e,blink){
  super.updateLid(e,blink);
  if(this.config.manualBlink>=0)blink=clamp(this.config.manualBlink,0,1);
  const {c,lid}=e;if(!lid.band)return;
  this._fittingEye=e;
  const P=lid.mesh.geometry.attributes.position,IP=lid.inside.geometry.attributes.position;
  // Keep the accepted lower lid away from the corners. Upper lid has a true
  // pretarsal volume instead of a 65-micrometre edge between two unjoined sheets.
  for(let i=0;i<lid.entries.length;i++){
   const q=lid.entries[i],arc=upperWeight(q.a),t=q.t;
   if(arc<1e-8||t>.78)continue;
   const support=1-smooth(t/.62),roll=(1-smooth(t/.22));
   const x=P.getX(i),y=P.getY(i)+.00032*arc*roll;
   let z=P.getZ(i);
   const front=this.eyeFront(c,x,y),thickness=(.00012+.00105*arc*(.78+.22*Math.sin(Math.PI*Math.min(1,t/.34))))*support;
   if(front!==null)z=Math.max(z,front+thickness);
   // Wide, low pretarsal convexity; do not add a hose along the edge.
   z+=.00018*arc*Math.sin(Math.PI*clamp(t/.50,0,1))*(1-blink*.35)*support;
   P.setXYZ(i,x,y,z);
  }
  P.needsUpdate=true;lid.mesh.geometry.computeVertexNormals();const N=lid.mesh.geometry.attributes.normal;
  for(let i=0;i<lid.entries.length;i++){const q=lid.entries[i],f=smooth((q.t-.72)/.28);if(f){const n=new THREE.Vector3(N.getX(i),N.getY(i),N.getZ(i)).lerp(q.src.n,f).normalize();N.setXYZ(i,n.x,n.y,n.z);}}N.needsUpdate=true;
  const margin=[];
  for(let i=0;i<=lid.A;i++)margin.push(this.margin(c,i/lid.A*TAU,blink));
  // Rebuild inner surface, with its edge exactly equal to the posterior bevel.
  for(let j=0;j<=lid.ni;j++)for(let i=0;i<=lid.A;i++){
   const row=j/lid.ni*.42*lid.R,lo=Math.floor(row),hi=Math.min(lid.R,lo+1),f=row-lo,ia=lo*(lid.A+1)+i,ib=hi*(lid.A+1)+i;
   let x=lerp(P.getX(ia),P.getX(ib),f),y=lerp(P.getY(ia),P.getY(ib),f);
   if(j===0){x=margin[i].x;y=margin[i].y;}
   const z=this.eyeFront(c,x,y),outer=lerp(P.getZ(ia),P.getZ(ib),f);
   IP.setXYZ(j*(lid.A+1)+i,x,y,z===null?outer-.0003:z+.000035);
  }
  IP.needsUpdate=true;lid.inside.geometry.computeVertexNormals();
  const BP=lid.band.geometry.attributes.position;
  for(let j=0;j<=lid.B;j++)for(let i=0;i<=lid.A;i++){
   const t=j/lid.B,a=i/lid.A*TAU,arc=upperWeight(a),outer=new THREE.Vector3().fromBufferAttribute(P,i),inner=new THREE.Vector3().fromBufferAttribute(IP,i);
   const v=outer.lerp(inner,t);v.y+=Math.sin(Math.PI*t)*.00007*arc;v.z+=Math.sin(Math.PI*t)*.000065*arc;
   BP.setXYZ(j*(lid.A+1)+i,v.x,v.y,v.z);
  }
  BP.needsUpdate=true;lid.band.geometry.computeVertexNormals();
  // Move lashes to the anterior margin, not the wet posterior contact line.
  const LP=e.lashes.mesh.geometry.attributes.position;
  for(let i=0;i<e.lashes.entries.length;i++){
   const q=e.lashes.entries[i],a=((q.a%TAU)+TAU)%TAU,k=a/TAU*lid.A,lo=Math.floor(k),hi=Math.min(lid.A,lo+1),f=k-lo;
   const anterior=new THREE.Vector3().fromBufferAttribute(P,lo).lerp(new THREE.Vector3().fromBufferAttribute(P,hi),f),back=this.margin(c,q.a,blink);
   const dx=anterior.x-back.x,dy=anterior.y-back.y,dz=anterior.z-back.z;
   for(let j=0;j<10;j++){const ix=i*10+j;LP.setXYZ(ix,LP.getX(ix)+dx,LP.getY(ix)+dy,LP.getZ(ix)+dz);}
  }
  LP.needsUpdate=true;e.lashes.mesh.geometry.computeVertexNormals();
  let minThickness=Infinity,maxThickness=0,seamError=0,innerClear=Infinity,penetrations=0;
  for(let i=0;i<=lid.A;i++){
   const a=i/lid.A*TAU;if(Math.sin(a)>.35){const d=new THREE.Vector3().fromBufferAttribute(P,i).distanceTo(new THREE.Vector3().fromBufferAttribute(IP,i))*1000;minThickness=Math.min(minThickness,d);maxThickness=Math.max(maxThickness,d);}
   seamError=Math.max(seamError,new THREE.Vector3().fromBufferAttribute(BP,i).distanceTo(new THREE.Vector3().fromBufferAttribute(P,i)),new THREE.Vector3().fromBufferAttribute(BP,lid.B*(lid.A+1)+i).distanceTo(new THREE.Vector3().fromBufferAttribute(IP,i)));
  }
  for(let i=0;i<IP.count;i++){const z=this.eyeFront(c,IP.getX(i),IP.getY(i));if(z!==null){const d=IP.getZ(i)-z;innerClear=Math.min(innerClear,d);if(d<-.0000001)penetrations++;}}
  const top=this.margin(c,Math.PI/2,blink),bottom=this.margin(c,Math.PI*1.5,blink);
  e.structureReport={globeDiameterMM:c.radius*2000,irisSurfaceDiameterMM:c.radius*.438*2000,apertureWidthMM:c.half*2000,centralApertureMM:(top.y-bottom.y)*1000,upperRimThicknessMM:[minThickness,maxThickness],rimJoinErrorMM:seamError*1000,innerClearanceMM:Number.isFinite(innerClear)?innerClear*1000:null,innerPenetratingVertices:penetrations,rimSegments:lid.A,rimDepthRows:lid.B,realJoinedMargin:true,notMedicalCalibration:true};
  e.contactReport={...e.contactReport,innerPenetratingVertices:penetrations,upperMarginJoined:true};
  this._fittingEye=null;
 }
 info(){return {...super.info(),eyeRadiusMM:12,reconstruction:'ET05 joined upper eyelid volume',structure:this.eyes.map(e=>e.structureReport)};}
}
