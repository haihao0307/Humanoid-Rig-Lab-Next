// Original procedural brow groom. Metres, authored proportions, no source assets.
// Lower/flatter male brow support: Goldstein & Katowitz (2005), PMID 16052142;
// Sclafani & Jung (2010), PMID 20231595. Only their abstracts were read.
// Growth/form description: Rajput (2021), DOI 10.1055/s-0041-1739253,
// publisher PDF page 490 text only; no figure or outside asset is incorporated.
// Hair direction principle: upright medial hairs transition to outward hairs,
// with upper/lower body hairs converging. This is an authored groom, not a scan.
const COMPACT_BROW_ANATOMY=Object.freeze({
  revision:'r23-low-arc-directed-brow-fibres',seed:91637,
  strandsPerSide:740,segments:5,sides:5,
  innerXM:.0120,outerXM:.0515,centreYM:1.5325,
  bodyThicknessM:.0055,archM:.00085,tailDropM:.00140,
  lengthM:.0042,radiusM:.000047,tipRadiusRatio:.08,
  liftM:.00017,asymmetryM:.00012
});
function compactBrowClamp(v,a,b){return Math.max(a,Math.min(b,v));}
function compactBrowSmooth(v){const t=compactBrowClamp(v,0,1);return t*t*t*(t*(t*6-15)+10);}
function compactBrowProfile(t,p=COMPACT_BROW_ANATOMY,side=1){
  const u=compactBrowClamp(t,0,1),arch=compactBrowSmooth(u/.62),tail=compactBrowSmooth((u-.65)/.35);
  return {
    x:side*(p.innerXM+(p.outerXM-p.innerXM)*u),
    y:p.centreYM+p.archM*arch-p.tailDropM*tail+side*p.asymmetryM*Math.sin(Math.PI*u),
    half:p.bodyThicknessM*.5*(.79+.21*Math.sin(Math.PI*u))*(1-.83*compactBrowSmooth((u-.61)/.39)),
    density:(.22+.78*compactBrowSmooth(u/.13))*(1-.79*compactBrowSmooth((u-.65)/.35))
  };
}
function compactCreateBrows(surface,options={}){
  if(typeof surface!=='function')throw new TypeError('A canonical face depth sampler is required for brows');
  const p={...COMPACT_BROW_ANATOMY,...options},finite=name=>{
    if(!Number.isFinite(p[name]))throw new TypeError('Non-finite brow parameter: '+name);
  };
  for(const name of Object.keys(COMPACT_BROW_ANATOMY))if(name!=='revision')finite(name);
  p.strandsPerSide=Math.round(compactBrowClamp(p.strandsPerSide,80,760));
  p.segments=Math.round(compactBrowClamp(p.segments,3,7));
  p.sides=Math.round(compactBrowClamp(p.sides,4,6));
  const verticesPerHair=(p.segments+1)*p.sides+2;
  p.strandsPerSide=Math.min(p.strandsPerSide,Math.floor(65534/(2*verticesPerHair)));
  p.innerXM=compactBrowClamp(p.innerXM,.009,.018);p.outerXM=compactBrowClamp(p.outerXM,.045,.057);
  p.centreYM=compactBrowClamp(p.centreYM,1.527,1.538);p.bodyThicknessM=compactBrowClamp(p.bodyThicknessM,.002,.006);
  p.archM=compactBrowClamp(p.archM,0,.003);p.tailDropM=compactBrowClamp(p.tailDropM,0,.0035);
  p.lengthM=compactBrowClamp(p.lengthM,.0025,.006);p.radiusM=compactBrowClamp(p.radiusM,.000025,.000075);
  p.tipRadiusRatio=compactBrowClamp(p.tipRadiusRatio,.04,.2);p.liftM=compactBrowClamp(p.liftM,.00006,.00035);
  p.asymmetryM=compactBrowClamp(p.asymmetryM,0,.0004);
  const positions=[],normals=[],indices=[],roots=[],bounds=[[Infinity,Infinity,Infinity],[-Infinity,-Infinity,-Infinity]];
  const normalise=a=>{const d=Math.hypot(...a);return a.map(v=>v/d);};
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const subtract=(a,b)=>a.map((v,i)=>v-b[i]);
  const encode=n=>{const d=Math.abs(n[0])+Math.abs(n[1])+Math.abs(n[2]);let x=n[0]/d,y=n[1]/d;
    if(n[2]<0){const old=x;x=(1-Math.abs(y))*(old<0?-1:1);y=(1-Math.abs(old))*(y<0?-1:1);}
    return [Math.round(x*32767),Math.round(y*32767)];};
  const append=(point,n)=>{positions.push(...point);normals.push(...encode(n));for(let k=0;k<3;k++){bounds[0][k]=Math.min(bounds[0][k],point[k]);bounds[1][k]=Math.max(bounds[1][k],point[k]);}};
  const skinNormal=(x,y)=>{const e=.00004;return normalise([-(surface(x+e,y)-surface(x-e,y))/(2*e),-(surface(x,y+e)-surface(x,y-e))/(2*e),1]);};
  let randomState=p.seed>>>0;const random=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296;};
  const regionCounts={head:0,body:0,tail:0};
  for(const side of [-1,1])for(let strand=0;strand<p.strandsPerSide;strand++){
    let t,profile;do{t=random()*.975;profile=compactBrowProfile(t,p,side);}while(random()>profile.density);
    // The root distribution has a dense centre and an irregular soft outline.
    // No skin-colour decal or opaque backing mesh fills the space between hairs.
    const band=(random()-.5)*1.8,head=1-compactBrowSmooth((t-.025)/.18),tail=compactBrowSmooth((t-.66)/.30);
    const x=profile.x,y=profile.y+band*profile.half-head*.00065;
    const length=p.lengthM*(.76+.38*random())*(1-.31*tail)*(1-.36*head),advance=length*(.93-.52*head);
    const tipT=compactBrowClamp(t+advance/(p.outerXM-p.innerXM),0,1.015),tipProfile=compactBrowProfile(tipT,p,side);
    const tipX=side*Math.min(p.outerXM+.0007,Math.abs(x)+advance);
    const bodyRise=(tipProfile.y-y)*(.36+.10*random())+.00015;
    const tipY=y+head*length*.66+(1-head)*(bodyRise-.00045*tail);
    const bend=(random()-.5)*.00032,rootRadius=p.radiusM*(.74+.40*random()),lift=p.liftM*(.72+.48*random());
    const at=q=>{const s=1-q,px=x+(tipX-x)*q,py=y+(tipY-y)*q+bend*4*s*q;
      // Start within the skin and emerge almost tangentially. The hump stays
      // below 0.35 mm; no floating flat ribbons with fixed frontal normals.
      const z=surface(px,py)-rootRadius*.35+rootRadius*1.55*compactBrowSmooth(q/.22)+lift*Math.sin(Math.PI*q);
      return [px,py,z];};
    const radius=q=>rootRadius*(p.tipRadiusRatio+(1-p.tipRadiusRatio)*Math.pow(1-q,1.2));
    const base=positions.length/3,centres=[],tangents=[];
    roots.push({side,t,point:at(0),tip:at(1),radiusM:rootRadius});regionCounts[t<.2?'head':t>.7?'tail':'body']++;
    for(let k=0;k<=p.segments;k++){
      const q=k/p.segments,point=at(q),lo=Math.max(0,q-.0001),hi=Math.min(1,q+.0001),delta=subtract(at(hi),at(lo));
      const tangent=normalise(delta),speed=Math.hypot(...delta)/(hi-lo),skin=skinNormal(point[0],point[1]);
      const across=normalise(cross(skin,tangent)),out=normalise(cross(tangent,across)),r=radius(q);
      const derivative=-rootRadius*(1-p.tipRadiusRatio)*1.2*Math.pow(1-q,.2)/speed;
      centres.push(point);tangents.push(tangent);
      for(let j=0;j<p.sides;j++){
        const angle=2*Math.PI*j/p.sides,radial=across.map((v,i)=>v*Math.cos(angle)+out[i]*Math.sin(angle));
        append(point.map((v,i)=>v+r*radial[i]),normalise(radial.map((v,i)=>v-derivative*tangent[i])));
      }
    }
    for(let k=0;k<p.segments;k++)for(let j=0;j<p.sides;j++){
      const next=(j+1)%p.sides,a=base+k*p.sides+j,b=a+p.sides,c=base+k*p.sides+next,d=c+p.sides;
      indices.push(a,c,b,c,d,b);
    }
    const root=positions.length/3;append(centres[0],tangents[0].map(v=>-v));
    const tip=positions.length/3;append(centres[p.segments],tangents[p.segments]);
    const end=base+p.segments*p.sides;
    for(let j=0;j<p.sides;j++){const next=(j+1)%p.sides;indices.push(root,base+next,base+j,tip,end+j,end+next);}
  }
  return {positions,normals,indices,report:{revision:p.revision,parameters:p,hairs:roots.length,vertices:positions.length/3,triangles:indices.length/3,bounds,regionCounts,
    geometry:'closed-tapered-curved-fibres',surfaceAttached:true,hasOpaqueBacking:false,measuredAnatomy:false},roots};
}
