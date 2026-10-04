/* Authored continuous skin material fields, in canonical metres.
 * This module owns material variation only: no lighting, BRDF, exposure,
 * texture, external mesh, tissue simulation, or measured-person claim.
 * Concepts reviewed, implementation written for this project:
 * https://developer.nvidia.com/gpugems/gpugems3/part-iii-rendering/chapter-14-advanced-techniques-realistic-real-time-skin
 * https://graphics.pixar.com/library/BumpRoughness/paper.pdf
 * https://research.nvidia.com/publication/2016-02_real-time-rendering-procedural-multiscale-materials
 */
const COMPACT_SKIN_SURFACE=Object.freeze({revision:'r21-regional-colour-and-oil-response',
  // Authored characteristic spacings and peak height, not measured anatomy.
  // 35 um at full detail gives a 12.25 um bound at the default .35 control.
  meso:{wavelengthsM:[.0038,.0025,.0016],weights:[.52,.31,.17],amplitudeM:.000035,slopeVariance:.00055},
  pore:{spacingM:.00048,radiusM:.000095,depthM:.000022,occupancy:.58},
  groove:{spacingM:.00092,widthM:.000028,depthM:.0000045},
  plateau:{wavelengthsM:[.00072,.00034],amplitudeM:.000032,slopeVariance:.0085},
  pigment:{largeFrequency:19,middleFrequency:71,fineFrequency:287},
  vascular:{largeFrequency:83,fineFrequency:193},
  slopeVariance:.0045,maximumNormalSlope:.22,
  authoredParameters:true,measuredPhysiology:false,usesImages:false});

// CPU reference is intentionally callable without a renderer. It supplies
// deterministic numerical fixtures for scale, filtering, and channel isolation.
function compactSkinClamp(v,a=0,b=1){return Math.max(a,Math.min(b,v));}
function compactSkinSmooth(a,b,v){const t=compactSkinClamp((v-a)/(b-a));return t*t*(3-2*t);}
function compactSkinHash(cell,salt=0){
  let h=(Math.imul(cell[0],1597334677)^Math.imul(cell[1],3812015801)^Math.imul(cell[2]||0,958282317)^Math.imul(salt,1103515245))>>>0;
  h=Math.imul(h^(h>>>15),2246822519)>>>0;h=Math.imul(h^(h>>>13),3266489917)>>>0;return (h^(h>>>16))>>>0;
}
function compactSkinRandom4(cell,salt){const h=compactSkinHash(cell,salt);return [h&255,(h>>>8)&255,(h>>>16)&255,h>>>24].map(v=>(v+.5)/256);}
function compactSkinNoise(p,salt){
  const i=p.map(Math.floor),f=p.map((v,k)=>{const t=v-i[k];return t*t*t*(t*(t*6-15)+10);});let sum=0;
  for(let x=0;x<2;x++)for(let y=0;y<2;y++)for(let z=0;z<2;z++){
    const weight=(x?f[0]:1-f[0])*(y?f[1]:1-f[1])*(z?f[2]:1-f[2]);
    sum+=weight*((compactSkinHash([i[0]+x,i[1]+y,i[2]+z],salt)&16777215)/16777216*2-1);
  }return sum;
}
function compactSkinBand(footprintM,wavelengthM){return 1-compactSkinSmooth(wavelengthM*.25,wavelengthM,footprintM);}
function compactSkinMeso(restP,footprintM,salt=0){
  const p=COMPACT_SKIN_SURFACE.meso,[x,y,z]=restP;
  // An orthonormal domain frame hides source-axis lattice alignment. Three
  // independently seeded quintic fields remain C2 across every cell boundary.
  const q=[(2*x+y-2*z)/3,(-2*x+2*y-z)/3,(x+2*y+2*z)/3];let value=0;
  for(let i=0;i<3;i++){
    const t=compactSkinClamp((footprintM/p.wavelengthsM[i]-.25)/.75),filter=1-t*t*t*(t*(t*6-15)+10);
    const noise=compactSkinNoise(q.map((v,k)=>v/p.wavelengthsM[i]+[11.7,29.3,43.1][(k+i)%3]),salt+1201+i*211);
    // Smooth bounded contrast gives low rolling irregularity without a
    // thresholded ridge, a cell edge, or amplification of pore depressions.
    value+=p.weights[i]*noise/Math.sqrt(.18+noise*noise)*filter;
  }return p.amplitudeM*value;
}
function compactSkinRegions(p){
  const region=(x,y,rx,ry)=>1-compactSkinSmooth(.05,1,((p[0]-x)/rx)**2+((p[1]-y)/ry)**2);
  const front=compactSkinSmooth(.08,.135,p[2]),face=front*compactSkinSmooth(1.405,1.435,p[1])*(1-compactSkinSmooth(1.612,1.645,p[1]))*(1-compactSkinSmooth(.067,.094,Math.abs(p[0])));
  const forehead=region(0,1.560,.061,.037)*face,nose=region(0,1.493,.020,.036)*face;
  const cheek=Math.max(region(.043,1.490,.029,.029),region(-.043,1.490,.029,.029))*face;
  const eye=Math.max(region(.030,1.520,.020,.013),region(-.030,1.520,.020,.013))*face;
  return {face,forehead,nose,cheek,eye,tZone:Math.max(nose,.68*forehead)};
}
// Elliptical compact pits, not thresholded noise. Filtering broadens each pit
// and conserves its planar integral before unresolved variation is retired.
function compactSkinPoreKernel(x,y,rx,ry,footprintM){
  const variance=footprintM*footprintM/12,ax=Math.sqrt(rx*rx+variance),ay=Math.sqrt(ry*ry+variance),q=x*x/(ax*ax)+y*y/(ay*ay);
  return q<1?Math.pow(1-q,3)*rx*ry/(ax*ay):0;
}
function compactSkinPores2D(p,footprintM,radiusScale=1,densityScale=1,salt=0){
  const config=COMPACT_SKIN_SURFACE.pore,spacing=config.spacingM,visibility=compactSkinBand(footprintM,spacing);
  if(visibility===0)return 0;
  const q=p.map(v=>v/spacing),cell=q.map(Math.floor);let sum=0;
  for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++){
    const id=[cell[0]+x,cell[1]+y,0],h=compactSkinRandom4(id,salt);
    if(h[2]>=config.occupancy*densityScale)continue;
    const r=config.radiusM*radiusScale*(.62+.76*h[3]),angle=(h[0]+h[3])*Math.PI*2,ca=Math.cos(angle),sa=Math.sin(angle);
    const dx=(q[0]-id[0]-.1-.8*h[0])*spacing,dy=(q[1]-id[1]-.1-.8*h[1])*spacing;
    sum+=(.55+.65*h[1])*compactSkinPoreKernel(ca*dx-sa*dy,sa*dx+ca*dy,r,r*(.64+.34*h[0]),footprintM);
  }return sum*visibility;
}
function compactSkinGrooves2D(p,footprintM,salt=0){
  const config=COMPACT_SKIN_SURFACE.groove,spacing=config.spacingM,visibility=compactSkinBand(footprintM,spacing*.62);
  if(visibility===0)return 0;
  const q=[p[0]/spacing*1.12,p[1]/spacing*.89],cell=q.map(Math.floor);let first=1e9,second=1e9,firstWeight=0,secondWeight=0;
  for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++){
    const id=[cell[0]+x,cell[1]+y,0],h=compactSkinRandom4(id,salt);
    const d=Math.hypot(q[0]-id[0]-.1-.8*h[0],q[1]-id[1]-.1-.8*h[1]);
    if(d<first){second=first;secondWeight=firstWeight;first=d;firstWeight=h[2];}else if(d<second){second=d;secondWeight=h[2];}
  }
  const width=config.widthM/spacing,filteredWidth=Math.sqrt(width*width+(footprintM/spacing)**2/12),gap=second-first;
  const edge=1-compactSkinSmooth(0,filteredWidth,gap);
  return edge*(.28+.72*Math.min(firstWeight,secondWeight))*width/filteredWidth*visibility;
}
function compactSkinEvaluateCPU(restP,restN,footprintM,seed=[0,0,0],surface=[.52,.25,.30],detail=[.30,.35,.13],stretch=1){
  const p=COMPACT_SKIN_SURFACE,region=compactSkinRegions(restP),footprint=Math.max(0,footprintM),s=seed.map(v=>Math.floor(v*97+.5));
  const salt=compactSkinHash(s,417),sample=(frequency,offset)=>compactSkinNoise(restP.map(v=>v*frequency),salt+offset)*compactSkinBand(footprint,1/frequency);
  const macro=sample(p.pigment.largeFrequency,13),middle=sample(p.pigment.middleFrequency,41),fine=sample(p.pigment.fineFrequency,83);
  const bloodField=.46*sample(p.vascular.largeFrequency,127)+.34*sample(p.vascular.fineFrequency,173)+.20*sample(653,181),oilField=sample(137,239);
  const microPigment=.60*sample(521,1871)+.40*sample(1133,1901);
  const melanin=detail[0]*(.045*macro+.035*middle+.075*fine+.15*microPigment);
  const vascular=detail[2]*(.06+1.90*region.cheek+1.10*region.nose+.20*region.forehead)*(.95+.25*bloodField);
  const pigment=[.60,.86,1.16].map((absorption,i)=>Math.exp(-melanin*absorption+vascular*[.35,-.50,-.70][i]));
  let oil=compactSkinClamp(surface[1]*(.35+1.50*region.tZone-.20*region.cheek-.25*region.eye)*(.86+.28*oilField));
  const radiusScale=(.90+.46*region.tZone+.12*region.cheek)* (1-.56*region.eye),densityScale=.68+.32*region.face;
  let weights=restN.map(v=>Math.abs(v)**4),sumWeights=weights.reduce((a,b)=>a+b,0);weights=sumWeights>1e-12?weights.map(v=>v/sumWeights):[0,0,1];
  const warp=[sample(151,281),sample(157,311),sample(163,349)].map(v=>v*.00013);
  const q=restP.map((v,i)=>v+warp[i]);let pits=0,grooves=0;
  for(let axis=0;axis<3;axis++)if(weights[axis]>.0001){const plane=axis===0?[q[1],q[2]]:axis===1?[q[2],q[0]]:[q[0],q[1]];
    pits+=weights[axis]*compactSkinPores2D(plane,footprint,radiusScale,densityScale,salt+axis*977+401);
    grooves+=weights[axis]*compactSkinGrooves2D(plane,footprint,salt+axis*1013+701);
  }
  const tissueDetail=detail[1]*(1-.62*region.eye),relaxation=1/Math.sqrt(compactSkinClamp(stretch,.55,1.8));
  const microHeightM=-tissueDetail*relaxation*(p.pore.depthM*pits+p.groove.depthM*grooves);
  // Shallow continuous corneum irregularity between sparse follicular pits.
  // This is an authored statistical surface, not a measured cell simulation.
  const plateauHeightM=tissueDetail*relaxation*p.plateau.amplitudeM*(.65*sample(1/p.plateau.wavelengthsM[0],2017)+.35*sample(1/p.plateau.wavelengthsM[1],2039));
  const mesoHeightM=detail[1]*relaxation*compactSkinMeso(restP,footprint,salt),heightM=microHeightM+mesoHeightM+plateauHeightM;
  const resolved=compactSkinBand(footprint,p.pore.radiusM*2),mesoResolved=compactSkinBand(footprint,p.meso.wavelengthsM[0]);
  const plateauResolved=compactSkinBand(footprint,p.plateau.wavelengthsM[0]);
  const unresolvedVariance=p.slopeVariance*tissueDetail*tissueDetail*(1-resolved*resolved)+p.meso.slopeVariance*detail[1]*detail[1]*(1-mesoResolved*mesoResolved)+p.plateau.slopeVariance*tissueDetail*tissueDetail*(1-plateauResolved*plateauResolved);
  // Roughness has its own broad/meso field, not the pigment or pore height.
  // Pits interrupt the oil film; they never darken the diffuse albedo.
  const roughField=.030*sample(41,1571)+.035*sample(173,1597)+.035*sample(691,1621);
  oil*=1-Math.min(.65,.60*tissueDetail*pits);
  const base=compactSkinClamp(surface[0]+.070*region.cheek-.105*region.tZone+.012*region.eye+roughField+.08*tissueDetail*pits-.012*(compactSkinClamp(stretch,.55,1.8)-1),.30,.85);
  const roughness=compactSkinClamp(Math.pow(base**4+unresolvedVariance,.25),.30,.85),cavity=1-Math.min(.18,.28*tissueDetail*pits);
  return {pigment,heightM,mesoHeightM,microHeightM,plateauHeightM,roughness,oil,cavity,vascular,unresolvedVariance,region,pits,grooves};
}

function compactSkinSurfaceShader(){
  const p=COMPACT_SKIN_SURFACE,f=v=>Number(v).toFixed(9);
  return `
// Surface fields are evaluated in the same undeformed metre frame on every
// skin chunk. The caller owns BRDF, illumination, base colour and exposure.
// The field hash needs all 32 integer bits, including on mobile fragment GPUs.
precision highp int;
struct CompactSkinSurface {vec3 pigment;float heightM;float roughness;float oil;float cavity;float vascular;float unresolvedVariance;};
uint compactSkinHash(ivec3 c,uint salt){
  uint h=uint(c.x)*1597334677u^uint(c.y)*3812015801u^uint(c.z)*958282317u^salt*1103515245u;
  h=(h^(h>>15u))*2246822519u;h=(h^(h>>13u))*3266489917u;return h^(h>>16u);
}
vec4 compactSkinRandom4(ivec3 c,uint salt){uint h=compactSkinHash(c,salt);return (vec4(float(h&255u),float((h>>8u)&255u),float((h>>16u)&255u),float(h>>24u))+.5)/256.;}
float compactSkinNoise(vec3 p,uint salt){
  ivec3 i=ivec3(floor(p));vec3 f=fract(p);f=f*f*f*(f*(f*6.-15.)+10.);float sum=0.;
  for(int x=0;x<2;x++)for(int y=0;y<2;y++)for(int z=0;z<2;z++){
    vec3 w=mix(1.-f,f,vec3(float(x),float(y),float(z)));
    sum+=w.x*w.y*w.z*(float(compactSkinHash(i+ivec3(x,y,z),salt)&16777215u)/16777216.*2.-1.);
  }return sum;
}
float compactSkinBand(float footprint,float wavelength){return 1.-smoothstep(wavelength*.25,wavelength,footprint);}
float compactSkinRegion(vec3 p,vec2 centre,vec2 radius){vec2 q=(p.xy-centre)/radius;return 1.-smoothstep(.05,1.,dot(q,q));}
vec4 compactSkinRegions(vec3 p,out float nose,out float forehead){
  float face=smoothstep(.08,.135,p.z)*smoothstep(1.405,1.435,p.y)*(1.-smoothstep(1.612,1.645,p.y))*(1.-smoothstep(.067,.094,abs(p.x)));
  forehead=compactSkinRegion(p,vec2(0.,1.560),vec2(.061,.037))*face;nose=compactSkinRegion(p,vec2(0.,1.493),vec2(.020,.036))*face;
  float cheek=max(compactSkinRegion(p,vec2(.043,1.490),vec2(.029)),compactSkinRegion(p,vec2(-.043,1.490),vec2(.029)))*face;
  float eye=max(compactSkinRegion(p,vec2(.030,1.520),vec2(.020,.013)),compactSkinRegion(p,vec2(-.030,1.520),vec2(.020,.013)))*face;
  return vec4(max(nose,.68*forehead),cheek,eye,face);
}
float compactSkinFilteredNoise(vec3 p,float frequency,float footprint,uint salt){return compactSkinNoise(p*frequency,salt)*compactSkinBand(footprint,1./frequency);}
float compactSkinMeso(vec3 p,float footprint,uint salt){
  vec3 q=vec3(2.*p.x+p.y-2.*p.z,-2.*p.x+2.*p.y-p.z,p.x+2.*p.y+2.*p.z)/3.;
  vec3 wavelengths=vec3(${p.meso.wavelengthsM.map(f).join(',')}),weights=vec3(${p.meso.weights.map(f).join(',')});float value=0.;
  for(int i=0;i<3;i++){
    float t=clamp((footprint/wavelengths[i]-.25)/.75,0.,1.),bandWeight=1.-t*t*t*(t*(t*6.-15.)+10.);
    vec3 offset=i==0?vec3(11.7,29.3,43.1):i==1?vec3(29.3,43.1,11.7):vec3(43.1,11.7,29.3);
    float noise=compactSkinNoise(q/wavelengths[i]+offset,salt+1201u+uint(i)*211u);
    value+=weights[i]*noise*inversesqrt(.18+noise*noise)*bandWeight;
  }return ${f(p.meso.amplitudeM)}*value;
}
float compactSkinPoreKernel(vec2 q,vec2 radius,float footprint){
  vec2 widened=sqrt(radius*radius+vec2(footprint*footprint/12.));float r2=dot(q/widened,q/widened),t=max(0.,1.-r2);
  return t*t*t*radius.x*radius.y/(widened.x*widened.y);
}
float compactSkinPores2D(vec2 p,float footprint,float radiusScale,float densityScale,uint salt){
  float spacing=${f(p.pore.spacingM)},visibility=compactSkinBand(footprint,spacing);if(visibility<=0.)return 0.;
  vec2 q=p/spacing;ivec2 cell=ivec2(floor(q));float sum=0.;
  for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){
    ivec2 id=cell+ivec2(x,y);vec4 h=compactSkinRandom4(ivec3(id,0),salt);if(h.z>=${f(p.pore.occupancy)}*densityScale)continue;
    float r=${f(p.pore.radiusM)}*radiusScale*(.62+.76*h.w),angle=(h.x+h.w)*6.28318530718,ca=cos(angle),sa=sin(angle);
    vec2 delta=(q-vec2(id)-.1-.8*h.xy)*spacing;delta=vec2(ca*delta.x-sa*delta.y,sa*delta.x+ca*delta.y);
    sum+=(.55+.65*h.y)*compactSkinPoreKernel(delta,vec2(r,r*(.64+.34*h.x)),footprint);
  }return sum*visibility;
}
float compactSkinGrooves2D(vec2 p,float footprint,uint salt){
  float spacing=${f(p.groove.spacingM)},visibility=compactSkinBand(footprint,spacing*.62);if(visibility<=0.)return 0.;
  vec2 q=p/spacing*vec2(1.12,.89);ivec2 cell=ivec2(floor(q));float first=1e9,second=1e9,firstWeight=0.,secondWeight=0.;
  for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){
    ivec2 id=cell+ivec2(x,y);vec4 h=compactSkinRandom4(ivec3(id,0),salt);float d=length(q-vec2(id)-.1-.8*h.xy);
    if(d<first){second=first;secondWeight=firstWeight;first=d;firstWeight=h.z;}else if(d<second){second=d;secondWeight=h.z;}
  }
  float width=${f(p.groove.widthM)}/spacing,filteredWidth=sqrt(width*width+pow(footprint/spacing,2.)/12.);
  return (1.-smoothstep(0.,filteredWidth,second-first))*(.28+.72*min(firstWeight,secondWeight))*width/filteredWidth*visibility;
}
CompactSkinSurface compactSkinEvaluate(vec3 restP,vec3 restN,float footprintM,vec3 seed,vec3 surface,vec3 detail,float stretch){
  CompactSkinSurface result;float footprint=max(0.,footprintM),nose,forehead;vec4 region=compactSkinRegions(restP,nose,forehead);
  uint salt=compactSkinHash(ivec3(floor(seed*97.+.5)),417u);
  float macro=compactSkinFilteredNoise(restP,${f(p.pigment.largeFrequency)},footprint,salt+13u);
  float middle=compactSkinFilteredNoise(restP,${f(p.pigment.middleFrequency)},footprint,salt+41u);
  float fine=compactSkinFilteredNoise(restP,${f(p.pigment.fineFrequency)},footprint,salt+83u);
  float bloodField=.46*compactSkinFilteredNoise(restP,${f(p.vascular.largeFrequency)},footprint,salt+127u)+.34*compactSkinFilteredNoise(restP,${f(p.vascular.fineFrequency)},footprint,salt+173u)+.20*compactSkinFilteredNoise(restP,653.,footprint,salt+181u);
  float oilField=compactSkinFilteredNoise(restP,137.,footprint,salt+239u);
  float microPigment=.60*compactSkinFilteredNoise(restP,521.,footprint,salt+1871u)+.40*compactSkinFilteredNoise(restP,1133.,footprint,salt+1901u);
  float melanin=detail.x*(.045*macro+.035*middle+.075*fine+.15*microPigment);
  result.vascular=detail.z*(.06+1.90*region.y+1.10*nose+.20*forehead)*(.95+.25*bloodField);
  result.pigment=exp(-melanin*vec3(.60,.86,1.16)+result.vascular*vec3(.35,-.50,-.70));
  result.oil=clamp(surface.y*(.35+1.50*region.x-.20*region.y-.25*region.z)*(.86+.28*oilField),0.,1.);
  float radiusScale=(.90+.46*region.x+.12*region.y)*(1.-.56*region.z),densityScale=.68+.32*region.w;
  vec3 weights=pow(abs(restN),vec3(4.));float sumWeights=dot(weights,vec3(1.));weights=sumWeights>1e-12?weights/sumWeights:vec3(0.,0.,1.);
  vec3 warp=vec3(compactSkinFilteredNoise(restP,151.,footprint,salt+281u),compactSkinFilteredNoise(restP,157.,footprint,salt+311u),compactSkinFilteredNoise(restP,163.,footprint,salt+349u))*.00013;
  vec3 q=restP+warp;float pits=0.,grooves=0.;
  for(int axis=0;axis<3;axis++)if(weights[axis]>.0001){
    vec2 plane=axis==0?q.yz:axis==1?q.zx:q.xy;
    pits+=weights[axis]*compactSkinPores2D(plane,footprint,radiusScale,densityScale,salt+uint(axis)*977u+401u);
    grooves+=weights[axis]*compactSkinGrooves2D(plane,footprint,salt+uint(axis)*1013u+701u);
  }
  float tissueDetail=detail.y*(1.-.62*region.z),relaxation=inversesqrt(clamp(stretch,.55,1.8));
  float microHeight=-tissueDetail*relaxation*(${f(p.pore.depthM)}*pits+${f(p.groove.depthM)}*grooves);
  float plateauHeight=tissueDetail*relaxation*${f(p.plateau.amplitudeM)}*(.65*compactSkinFilteredNoise(restP,${f(1/p.plateau.wavelengthsM[0])},footprint,salt+2017u)+.35*compactSkinFilteredNoise(restP,${f(1/p.plateau.wavelengthsM[1])},footprint,salt+2039u));
  result.heightM=microHeight+detail.y*relaxation*compactSkinMeso(restP,footprint,salt)+plateauHeight;
  float resolved=compactSkinBand(footprint,${f(p.pore.radiusM*2)});
  float mesoResolved=compactSkinBand(footprint,${f(p.meso.wavelengthsM[0])});
  float plateauResolved=compactSkinBand(footprint,${f(p.plateau.wavelengthsM[0])});
  result.unresolvedVariance=${f(p.slopeVariance)}*tissueDetail*tissueDetail*(1.-resolved*resolved)+${f(p.meso.slopeVariance)}*detail.y*detail.y*(1.-mesoResolved*mesoResolved)+${f(p.plateau.slopeVariance)}*tissueDetail*tissueDetail*(1.-plateauResolved*plateauResolved);
  float roughField=.030*compactSkinFilteredNoise(restP,41.,footprint,salt+1571u)+.035*compactSkinFilteredNoise(restP,173.,footprint,salt+1597u)+.035*compactSkinFilteredNoise(restP,691.,footprint,salt+1621u);
  result.oil*=1.-min(.65,.60*tissueDetail*pits);
  float base=clamp(surface.x+.070*region.y-.105*region.x+.012*region.z+roughField+.08*tissueDetail*pits-.012*(clamp(stretch,.55,1.8)-1.),.30,.85);
  result.roughness=clamp(pow(pow(base,4.)+result.unresolvedVariance,.25),.30,.85);
  result.cavity=1.-min(.18,.28*tissueDetail*pits);return result;
}
vec3 compactSkinPerturbNormal(vec3 worldP,vec3 worldN,float heightM){
  vec3 dx=dFdx(worldP),dy=dFdy(worldP),rx=cross(dy,worldN),ry=cross(worldN,dx);float determinant=dot(dx,rx);
  float areaScale=max(length(dx)*length(dy),1e-16);
  vec3 gradient=sign(determinant)*(dFdx(heightM)*rx+dFdy(heightM)*ry)/max(abs(determinant),areaScale*.05);
  gradient*=min(1.,${f(p.maximumNormalSlope)}/max(length(gradient),.00001));return normalize(worldN-gradient);
}
`;
}
