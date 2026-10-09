import {loadScanRepair,disposeScanRepair} from './ScanRepair.js';
import * as THREE from 'three';
import {ResearchEyes} from '../research/ResearchEyes.js';
const clamp=THREE.MathUtils.clamp,lerp=THREE.MathUtils.lerp;
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);},TAU=Math.PI*2;
// ET07 keeps the existing head, skin assets, ocular optics and contact solver.
// The closed scan is observed data; the open-lid surface is a fitted reconstruction.
function smoothReference(lid){
 const {A,R,entries}=lid;let z=Float64Array.from(entries,q=>q.src.z);
 for(let pass=0;pass<18;pass++){
  const next=z.slice();
  for(let j=1;j<R;j++)for(let a=0;a<A;a++){
   const k=j*(A+1)+a,l=j*(A+1)+(a+A-1)%A,r=j*(A+1)+(a+1)%A;
   next[k]=.34*z[k]+.18*(z[l]+z[r])+.15*(z[k-A-1]+z[k+A+1]);
  }
  // Smooth the closed crease along its length without changing the outer anchor.
  for(let a=0;a<A;a++)next[a]=.5*z[a]+.25*(z[(a+A-1)%A]+z[(a+1)%A]);
  for(let j=0;j<=R;j++)next[j*(A+1)+A]=next[j*(A+1)];z=next;
 }
 for(let i=0;i<entries.length;i++){
  const q=entries[i];q.tissueZ=lerp(q.src.z,z[i],.88*(1-smooth((q.t-.25)/.45)));
  q.tissueSeamZ=lerp(q.seamSrc.z,z[i%(A+1)],.88);
 }
}
function skinShader(material,c,isMargin=false){
 const before=material.onBeforeCompile;
 material.onBeforeCompile=s=>{
  before(s);
  s.vertexShader='attribute vec2 tissueUV,tissueDetailUV;attribute float tissueBand,tissueUpper;varying vec2 vTissueUV,vTissueDetailUV;varying float vTissueBand,vTissueUpper;\n'+s.vertexShader;
  s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvTissueUV=tissueUV;vTissueBand=tissueBand;vTissueDetailUV=tissueDetailUV;vTissueUpper=tissueUpper;');
  s.fragmentShader='varying vec2 vTissueUV,vTissueDetailUV;varying float vTissueBand,vTissueUpper;\n'+s.fragmentShader;
  // Read the same subject's skin in a resting-surface chart, not a stretched
  // one-dimensional slice of his captured closed crease. Boundary UV is exact.
  s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`\n#ifdef USE_MAP\n diffuseColor*=texture2D(map,vTissueUV);\n#endif\n`);
  for(const tex of ['uSpec','uSurface'])s.fragmentShader=s.fragmentShader.replaceAll('texture2D('+tex+',vMapUv)','texture2D('+tex+',vTissueUV)');
  for(const tex of ['normalMap','uMesoMap','uMicroMap'])s.fragmentShader=s.fragmentShader.replaceAll('texture2D('+tex+',vNormalMapUv)','texture2D('+tex+',vTissueUV)');
  s.fragmentShader=s.fragmentShader.replaceAll('poresAt(vNormalMapUv)','poresAt(vTissueUV)').replaceAll('dFdx(vNormalMapUv)','dFdx(vTissueUV)').replaceAll('dFdy(vNormalMapUv)','dFdy(vTissueUV)');
  // Separate the captured broad crease from fine surface structure. A copied
  // closed-eye normal field is not the new open-lid shape. Keep measured fine
  // skin frequencies instead of scaling the whole normal map to near zero.
  s.fragmentShader=s.fragmentShader.replace('mapN.xy*=normalScale',`float unbake=1.-smoothstep(.16,.68,vLidT);vec3 oldBroadN=textureLod(normalMap,vTissueUV,2.).xyz*2.-1.;mapN.xy-=oldBroadN.xy*unbake*.92;mapN=normalize(mapN);mapN.xy*=normalScale`);
  s.fragmentShader=s.fragmentShader.replace('vec2 slopes=mapN.xy',`vec3 oldBroadM=textureLod(uMesoMap,vTissueUV,2.).xyz*2.-1.;mesoN.xy-=oldBroadM.xy*unbake*.78;mesoN=normalize(mesoN);vec2 slopes=mapN.xy`);
  // Do not suppress all skin frequencies: retain fine detail and only reduce
  // the old scan's coarse normal field near the reconstructed free margin.
  s.fragmentShader=s.fragmentShader.replace('mapN.xy*=normalScale*(uBaseline>.5?1.:uDetail);','mapN.xy*=normalScale*(uBaseline>.5?1.:uDetail)*mix(.20,1.,smoothstep(.12,.66,vLidT));');
  s.fragmentShader=s.fragmentShader.replace('mapN.xy*=mix(.08,1.,smoothstep(.16,.55,vLidT));normal=normalize(tbn*normalize(mapN));','mapN.xy*=mix(.68,1.,smoothstep(.02,.35,vLidT));normal=normalize(tbn*normalize(mapN));');
  s.fragmentShader=s.fragmentShader.replace('diffuseColor.rgb=mix(diffuseColor.rgb*vec3(.77,.57,.52),diffuseColor.rgb,smoothstep(.008,.055,vLidT));','');
  s.fragmentShader=s.fragmentShader.replace('float skinVariation=skinNoise(vSkinPosition*105.);',`diffuseColor.rgb*=mix(vec3(.95,.78,.73),vec3(1.),smoothstep(.05,.86,vTissueBand));\n float skinVariation=skinNoise(vSkinPosition*105.);`);
  // The upper mobile lid needs its own material-density coordinates. Reusing
  // the closed-scan UV compresses and elongates otherwise valid pores.
  if(!isMargin){
   s.fragmentShader=s.fragmentShader.replace('vec2 slopes=mapN.xy',`float mobileLid=vTissueUpper*(1.-smoothstep(.36,.72,vLidT));
    vec3 cleanM=texture2D(uMesoMap,vTissueDetailUV).rgb*2.-1.;vec3 broadM=textureLod(uMesoMap,vTissueDetailUV,1.5).rgb*2.-1.;
    vec3 cleanMicro=texture2D(uMicroMap,vTissueDetailUV).rgb*2.-1.;
    mapN=normalize(mix(mapN,vec3(0.,0.,1.),mobileLid));
    mesoN=normalize(mix(mesoN,normalize(vec3((cleanM.xy-broadM.xy)*.65,1.)),mobileLid));
    microN=normalize(mix(microN,normalize(vec3(cleanMicro.xy*.72,1.)),mobileLid));
    vec2 slopes=mapN.xy`);
   s.fragmentShader=s.fragmentShader.replace('float skinSpecMask=', 'roughnessFactor+=.035*vTissueUpper*(1.-smoothstep(.36,.72,vLidT));\nfloat skinSpecMask=');
  }
  if(isMargin){
   const ns=s.fragmentShader.indexOf(' vec3 mapN=texture2D(normalMap'),ne=s.fragmentShader.indexOf('normal=normalize(tbn*normalize(mapN));',ns);
   if(ns>=0&&ne>=0)s.fragmentShader=s.fragmentShader.slice(0,ns)+' normal=nonPerturbedNormal;\n'+s.fragmentShader.slice(ne+'normal=normalize(tbn*normalize(mapN));'.length);

   s.vertexShader=s.vertexShader.replace('transformed+=normal*(texture2D(uSurface,uv).b-.5)*uRelief*.001*(1.-uBaseline)*smoothstep(.13,.68,eyelidT);','');
   s.fragmentShader=s.fragmentShader.replace('normal=normalize(tbn*normalize(mapN));','normal=normalize(tbn*normalize(vec3(mapN.xy*.18,mapN.z)));');
   s.fragmentShader=s.fragmentShader.replace('float skinSpecMask=','roughnessFactor=mix(.40,roughnessFactor,smoothstep(.06,.84,vTissueBand));\n float skinSpecMask=');
  }
 };
 material.customProgramCacheKey=()=>`ET073-tissue-${c.name}-${isMargin?'free-margin':'skin'}`;
 material.needsUpdate=true;
}
function configureTissue(rig,lid,c,sample){
 const {A,R,entries,mesh,edge,es}=lid,g=mesh.geometry,uv=g.attributes.uv,tu=[],tb=[],du=[],up=[],ao=g.attributes.skinOcclusion;
 smoothReference(lid);
 for(let i=0;i<entries.length;i++){
  const q=entries[i],weight=1-smooth(q.t/.74),upper=q.ny>=0;
  // Neutral-pose chart. UV remains attached to skin during motion rather than
  // projecting a stationary texture through the face every frame.
  const margin=rig.margin(c,q.a,0),seam=c.y-.0035+.0028*Math.pow(Math.abs(q.nx),1.7)-.0007*q.nx*c.sign;
  let x=q.xs+(margin.x-(c.x+c.half*q.nx))*weight,y=q.ys+(margin.y-seam)*weight;
  const repair=(1-smooth(q.t/.60))*Math.pow(Math.abs(q.ny),.5);
  y+=(upper?.00035:-.0017)*repair;
  const donor=sample(x,y),blend=upper?1-smooth((q.t-.10)/.36):1-smooth((q.t-.45)/.27);
  const u=lerp(q.src.u,donor.u,blend),v=lerp(q.src.v,donor.v,blend);
  tu.push(u,v);tb.push(1);du.push(donor.u,donor.v-215/4096);up.push(upper?1:0);uv.setXY(i,u,v);
  // Captured closed-lid occlusion does not describe an open, illuminated lid.
  ao.setX(i,lerp(q.src.ao,Math.max(q.src.ao,.91),.65*(1-smooth(q.t/.62))));
 }
 uv.needsUpdate=true;ao.needsUpdate=true;
 g.setAttribute('tissueUV',new THREE.Float32BufferAttribute(tu,2));g.setAttribute('tissueBand',new THREE.Float32BufferAttribute(tb,1));g.setAttribute('tissueDetailUV',new THREE.Float32BufferAttribute(du,2));g.setAttribute('tissueUpper',new THREE.Float32BufferAttribute(up,1));
 // Build the free margin with the identical skin shader, pigmentation, light
 // transport and controls. Its posterior band transitions to mucosa locally.
 const originalCallback=mesh.material.onBeforeCompile,edgeMaterial=mesh.material.clone();
 edgeMaterial.onBeforeCompile=originalCallback;edgeMaterial.vertexColors=false;
 const eg=edge.geometry,euv=[],et=[],eb=[],eao=[],edu=[],eup=[];
 for(let a=0;a<=A;a++)for(let q=0;q<=es;q++){
  const band=q/es;euv.push(tu[2*a],tu[2*a+1]);et.push(0);eb.push(band);eao.push(ao.getX(a));edu.push(du[2*a],du[2*a+1]);eup.push(up[a]);
 }
 eg.setAttribute('uv',new THREE.Float32BufferAttribute(euv,2));eg.setAttribute('tissueUV',new THREE.Float32BufferAttribute(euv,2));eg.setAttribute('eyelidT',new THREE.Float32BufferAttribute(et,1));eg.setAttribute('tissueBand',new THREE.Float32BufferAttribute(eb,1));eg.setAttribute('skinOcclusion',new THREE.Float32BufferAttribute(eao,1));eg.setAttribute('tissueDetailUV',new THREE.Float32BufferAttribute(edu,2));eg.setAttribute('tissueUpper',new THREE.Float32BufferAttribute(eup,1));
 edge.material.dispose();edge.material=edgeMaterial;skinShader(edgeMaterial,c,true);skinShader(mesh.material,c,false);
 lid.tissueReady=true;lid.tissueStats={source:'same original head skin maps',chart:'neutral-surface material coordinates, boundary UV preserved',externalSourceImages:0,derivedRepairTextures:3,upperLidMaterialDensityCoordinates:true};
}
function sharedNormals(lid){
 const N=lid.mesh.geometry.attributes.normal,E=lid.edge.geometry.attributes.normal;
 for(let a=0;a<=lid.A;a++){
  const k=a*(lid.es+1)+lid.es,ex=E.getX(k),ey=E.getY(k),ez=E.getZ(k),nx=N.getX(a),ny=N.getY(a),nz=N.getZ(a);
  let x=nx*.72+ex*.28,y=ny*.72+ey*.28,z=nz*.72+ez*.28,l=Math.hypot(x,y,z)||1;x/=l;y/=l;z/=l;
  N.setXYZ(a,x,y,z);E.setXYZ(k,x,y,z);
  for(let q=1;q<lid.es;q++){const j=a*(lid.es+1)+q,w=smooth((q/lid.es-.30)/.70)*.65;let xx=lerp(E.getX(j),x,w),yy=lerp(E.getY(j),y,w),zz=lerp(E.getZ(j),z,w),ll=Math.hypot(xx,yy,zz)||1;E.setXYZ(j,xx/ll,yy/ll,zz/ll);}
 }
 N.needsUpdate=true;E.needsUpdate=true;
}
function makeCanthus(rig,e){
 const U=48,V=16,p=new Float32Array((U+1)*(V+1)*3),colors=[],idx=[];
 for(let i=0;i<=U;i++)for(let j=0;j<=V;j++){
  const u=i/U,v=j/V,centre=Math.sin(Math.PI*v),warm=Math.sin(Math.PI*u)*centre;
  colors.push(.25+.045*warm,.092+.026*warm,.078+.022*warm);
  if(i<U&&j<V){const k=i*(V+1)+j;idx.push(k,k+V+1,k+1,k+1,k+V+1,k+V+2);}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(idx);
 const m=new THREE.MeshPhysicalMaterial({vertexColors:true,roughness:.44,metalness:0,ior:1.36,clearcoat:.28,clearcoatRoughness:.24,envMapIntensity:.20,side:THREE.DoubleSide});
 m.onBeforeCompile=s=>{s.uniforms.uEyePass=rig.pass;s.fragmentShader='uniform float uEyePass;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <opaque_fragment>','#include <opaque_fragment>\nif(uEyePass>.5&&uEyePass<1.5){gl_FragColor=vec4(0.);return;}');};
 const mesh=new THREE.Mesh(g,m);mesh.name='continuous-medial-tear-lake-'+e.c.name;mesh.frustumCulled=false;rig.group.add(mesh);
 e.caruncle.geometry.dispose();e.caruncle.material.dispose();e.caruncle.removeFromParent();e.caruncle=null;e.canthus={mesh,U,V};
}
function updateCanthus(rig,e,blink){
 if(!e.canthus)return;const {mesh,U,V}=e.canthus,P=mesh.geometry.attributes.position,c=e.c;
 rig._fittingEye=e;
 for(let i=0;i<=U;i++)for(let j=0;j<=V;j++){
  const t=i/U,v=j/V,roundEnd=.52+.48*Math.sin(Math.PI*v),u=-1+.155*t*roundEnd;
  const angle=Math.acos(u*c.sign),top=rig.margin(c,angle,blink),bottom=rig.margin(c,TAU-angle,blink);
  const x=lerp(top.x,bottom.x,v),y=lerp(top.y,bottom.y,v),front=rig.eyeFront(c,x,y);
  const mound=.00010*Math.sin(Math.PI*t)*Math.pow(Math.sin(Math.PI*v),1.4)*(1-blink);
  const plica=.00004*Math.exp(-Math.pow((t-.90)/.095,2))*Math.sin(Math.PI*v)*(1-blink);
  P.setXYZ(i*(V+1)+j,x,y,(front===null?lerp(top.z,bottom.z,v)-.00012:front+.00010)+mound+plica);
 }
 P.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.visible=blink<.995;rig._fittingEye=null;
}
export class NaturalEyes extends ResearchEyes {
 constructor(options){
  super(options);
  this.ready=this.ready.then(()=>{for(const e of this.eyes)makeCanthus(this,e);this.update(0,true);
   window.__NATURAL_REVIEW__={setVisibility:flags=>{for(const e of this.eyes){const parts={margin:e.lid.edge,rim:e.rim.mesh,inside:e.lid.inside,canthus:e.canthus.mesh,lashes:e.lashes.mesh};for(const [k,v]of Object.entries(flags))if(parts[k]&&typeof v==='boolean')parts[k].visible=v;}this.requestRender();}};
   this.requestRender();return this;});
  this.ready=this.ready.then(async()=>{await loadScanRepair(this);this.update(0,true);return this;});
 }
 makeLid(c,sample,material){const lid=super.makeLid(c,sample,material);configureTissue(this,lid,c,sample);return lid;}
 updateLid(e,blink){
  super.updateLid(e,blink);
  if(e.lid.tissueReady){sharedNormals(e.lid);for(const k of ['roughness','clearcoat','clearcoatRoughness','envMapIntensity'])e.lid.edge.material[k]=this.skin[k];}
  updateCanthus(this,e,this.config.manualBlink>=0?this.config.manualBlink:blink);
 }
 info(){return {...super.info(),naturalTissue:{version:'ET07.3',sameSkinAssets:true,extraTextures:3,localCaptureMarkRepair:true,continuousCanthalTissue:true,sharedMarginNormals:true,closedScanNotOpenGroundTruth:true}};}
 audit(detailed=false){
  const a=super.audit(detailed);a.version='ET07.3';a.scanRepair=this.scanRepair?{ready:true,enabled:this.scanRepair.uniforms.uRepairEnabled.value===1,extraTextures:3,originalAssetsModified:false,atlasSize:this.scanRepair.meta.atlasSize}:null;
  a.tissue=this.eyes.map(e=>{const {lid}=e,uv=lid.mesh.geometry.attributes.uv,N=lid.mesh.geometry.attributes.normal,EN=lid.edge.geometry.attributes.normal;let uvError=0,normalError=0;
   for(let i=0;i<=lid.A;i++){const q=lid.entries[lid.R*(lid.A+1)+i],k=lid.R*(lid.A+1)+i;uvError=Math.max(uvError,Math.hypot(uv.getX(k)-q.src.u,uv.getY(k)-q.src.v));const j=i*(lid.es+1)+lid.es;normalError=Math.max(normalError,Math.hypot(N.getX(i)-EN.getX(j),N.getY(i)-EN.getY(j),N.getZ(i)-EN.getZ(j)));}
   let canthusMin=Infinity,canthusPenetrations=0,canthusSamples=0,canthusInvalid=0;
   this._fittingEye=e;
   if(e.canthus){const g=e.canthus.mesh.geometry,p=g.attributes.position,ix=g.index.array;
    const test=(x,y,z)=>{if(![x,y,z].every(Number.isFinite)){canthusInvalid++;return;}const front=this.eyeFront(e.c,x,y);if(front===null)return;const gap=z-front;canthusMin=Math.min(canthusMin,gap);canthusSamples++;if(gap<-.0000001)canthusPenetrations++;};
    for(let i=0;i<p.count;i++)test(p.getX(i),p.getY(i),p.getZ(i));
    if(detailed)for(let i=0;i<ix.length;i+=3)for(const w of [[1/3,1/3,1/3],[.5,.5,0],[0,.5,.5],[.5,0,.5]]){const a=ix[i],b=ix[i+1],c=ix[i+2];test(w[0]*p.getX(a)+w[1]*p.getX(b)+w[2]*p.getX(c),w[0]*p.getY(a)+w[1]*p.getY(b)+w[2]*p.getY(c),w[0]*p.getZ(a)+w[1]*p.getZ(b)+w[2]*p.getZ(c));}
   }
   this._fittingEye=null;
   return {canthalContact:{minAxialGapMM:Number.isFinite(canthusMin)?canthusMin*1000:null,penetrations:canthusPenetrations,samples:canthusSamples,invalid:canthusInvalid},name:e.c.name,boundaryUVMaxError:uvError,sharedMarginNormalMaxError:normalError,sameAlbedoTexture:lid.mesh.material.map===this.skin.map&&lid.edge.material.map===this.skin.map,canthalPatch:!!e.canthus,...lid.tissueStats};
  });return a;
 }
 dispose(){disposeScanRepair(this);for(const e of this.eyes){e.canthus?.mesh.geometry.dispose();e.canthus?.mesh.material.dispose();e.canthus?.mesh.removeFromParent();}super.dispose();}
}
