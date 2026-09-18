/* Original short-beard generator; all distances are canonical metres.
 * Read 2026-09-18: Dua et al., Beard and Moustache Reconstruction, regional
 * direction/feathered-border sections (indexed article text):
 * https://pmc.ncbi.nlm.nih.gov/articles/PMC8719972/
 * Read abstracts: https://pubmed.ncbi.nlm.nih.gov/30580453/ and
 * https://pubmed.ncbi.nlm.nih.gov/2402610/ (regional density/morphology vary).
 * Only those structural principles are used. Groom dimensions, distribution,
 * fibre diameter and colours are authored art controls, not measured anatomy.
 * No image, scan, baked vertex list, or third-party groom is used.
 */
const COMPACT_BEARD_ANATOMY={revision:'r23-layered-correlated-short-beard',seed:923183,
  rootSpacingM:.00056,diameterM:.000046,lengthMinM:.00038,lengthMaxM:.00140,
  rootLiftM:.000023,segments:3,sides:3,maxStrands:5200,density:.95,
  correlationM:.0065,guideFraction:.24};
function compactBeardSmooth(x){const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);}
// Continuous low-frequency fields relate neighbouring fibres. Their amplitudes
// and millimetre scales are art direction, not follicle measurements.
function compactBeardGroomField(x,y,seed=COMPACT_BEARD_ANATOMY.seed,channel=0){
  const span=COMPACT_BEARD_ANATOMY.correlationM,px=x/span,py=(y-1.429)/(span*1.32),ix=Math.floor(px),iy=Math.floor(py);
  const hash=(a,b)=>{let h=((seed>>>0)^Math.imul(a,0x9e3779b1)^Math.imul(b,0x85ebca6b)^Math.imul(channel+1,0xc2b2ae35))>>>0;
    h=Math.imul(h^(h>>>16),0x7feb352d);h=Math.imul(h^(h>>>15),0x846ca68b);return ((h^(h>>>16))>>>0)/4294967296;};
  const sx=compactBeardSmooth(px-ix),sy=compactBeardSmooth(py-iy),a=hash(ix,iy),b=hash(ix+1,iy),c=hash(ix,iy+1),d=hash(ix+1,iy+1);
  return (a+(b-a)*sx)*(1-sy)+(c+(d-c)*sx)*sy;
}
function compactBeardDensity(x,y,options={}){
  const cx=options.centreX??-.0006,ax=Math.abs(x-cx),s=compactBeardSmooth;
  // Feather into the fitted face, before its source join and neck interface.
  const ellipse=Math.hypot((x+.0005)/.062,(y-1.512)/.086);
  const attachment=(1-s((ellipse-.88)/.09))*s((y-1.429)/.003);
  if(!attachment||y>1.499)return 0;
  const upperCheek=1.466+Math.max(0,ax-.024)*.80;
  const cheek=.64*s((ax-.022)/.010)*(1-s((ax-.053)/.005))
    *s((upperCheek-y)/.006)*s((y-1.434)/.009);
  const chin=.88*(1-s((ax-.018)/.012))*s((1.450-y)/.005);
  const moustache=.84*(1-s((ax-.018)/.007))*s((y-1.463)/.003)
    *s((1.4747-y)/.0028)*(.71+.29*s(ax/.006));
  const connector=.43*s((ax-.021)/.003)*(1-s((ax-.029)/.006))
    *s((y-1.442)/.005)*s((1.469-y)/.004);
  // Exact production vermilion bounds may be passed by the face owner.
  // Root clearance is followed by exact per-fibre vertex rejection below.
  const halfWidth=options.halfWidth??.0244;
  if(ax<halfWidth+.0016){
    const lip=options.lipOutline?.(x)??{top:1.463,bottom:1.453};
    if(y>lip.bottom-.0011&&y<lip.top+.0011)return 0;
  }
  const clump=.88+.22*compactBeardGroomField(x,y,options.seed,2);
  return Math.max(0,Math.min(1,Math.max(cheek,chin,moustache,connector)*attachment*clump*(options.density??COMPACT_BEARD_ANATOMY.density)));
}
function compactBeardGeometry(surface,options={}){
  if(typeof surface!=='function')throw new TypeError('Beard requires the final neutral face surface');
  const cfg=COMPACT_BEARD_ANATOMY,positions=[],normals=[],indices=[];
  const unit=v=>{const d=Math.hypot(...v);return d>1e-14?v.map(n=>n/d):[0,0,1];};
  const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,b)=>a.map(v=>v*b);
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const encode=n=>{const inv=1/(Math.abs(n[0])+Math.abs(n[1])+Math.abs(n[2]));let x=n[0]*inv,y=n[1]*inv;
    if(n[2]<0){const old=x;x=(1-Math.abs(y))*(old<0?-1:1);y=(1-Math.abs(old))*(y<0?-1:1);}return [Math.round(x*32767),Math.round(y*32767)];};
  const point=(x,y)=>[x,y,surface(x,y)],normal=(x,y)=>{const e=.00007;
    return unit([-(surface(x+e,y)-surface(x-e,y))/(2*e),-(surface(x,y+e)-surface(x,y-e))/(2*e),1]);};
  // A stable integer hash gives independent jitter per cell. Thinning the groom
  // changes neither retained roots nor strand length/direction, avoiding popping.
  const seed=(options.seed??cfg.seed)>>>0,random=(cell,salt)=>{let h=(seed^Math.imul(cell+1,0x9e3779b1)^Math.imul(salt+1,0x85ebca6b))>>>0;
    h=Math.imul(h^(h>>>16),0x7feb352d);h=Math.imul(h^(h>>>15),0x846ca68b);return ((h^(h>>>16))>>>0)/4294967296;};
  let strands=0,minLength=Infinity,maxLength=0,maxHeight=0,rejectedSurface=0,rejectedLip=0;
  const regionCounts={moustache:0,chin:0,cheek:0},layerCounts={fine:0,guide:0},step=cfg.rootSpacingM;
  const nx=Math.ceil(.120/step),ny=Math.ceil(.069/step);
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
    const cell=j*nx+i,x=-.060+(i+.06+.88*random(cell,0))*step,y=1.429+(j+.06+.88*random(cell,1))*step;
    if(random(cell,2)>=compactBeardDensity(x,y,options)||strands>=cfg.maxStrands)continue;
    const ax=Math.abs(x-(options.centreX??-.0006)),side=x<(options.centreX??-.0006)?-1:1;
    const region=y>1.463&&ax<.026?'moustache':ax<.023?'chin':'cheek';
    const lengthField=compactBeardGroomField(x,y,seed,0),directionField=compactBeardGroomField(x,y,seed,1);
    const guide=random(cell,7)<cfg.guideFraction,layer=guide?'guide':'fine';
    const variation=.64*lengthField+.36*random(cell,3),fraction=guide?.62+.38*variation:.55*variation;
    const length=cfg.lengthMinM+(cfg.lengthMaxM-cfg.lengthMinM)*fraction;
    const down=-1,out=side*(region==='moustache'?.80:region==='chin'?.10:.36)
      +(directionField-.5)*.42+(random(cell,4)-.5)*.12;
    const dzdx=(surface(x+.00007,y)-surface(x-.00007,y))/.00014;
    const dzdy=(surface(x,y+.00007)-surface(x,y-.00007))/.00014;
    const tangentScale=1/Math.hypot(out,down,dzdx*out+dzdy*down),dx=out*tangentScale,dy=down*tangentScale;
    const diameter=cfg.diameterM*(guide?1.06+.23*random(cell,5):.80+.25*random(cell,5)),phase=random(cell,6)*Math.PI*2;
    const centre=q=>{const px=x+dx*length*q,py=y+dy*length*q,n=normal(px,py);
      // Curved but almost tangent emergence; even the tip stays close to skin.
      const height=cfg.rootLiftM+length*(.12*q+.11*Math.sin(q*Math.PI*.75));
      return add(point(px,py),mul(n,height));};
    const centres=Array.from({length:cfg.segments+1},(_,k)=>centre(k/cfg.segments));
    if(centres.some(p=>p.some(v=>!Number.isFinite(v)))||!Number.isFinite(dzdx+dzdy)){rejectedSurface++;continue;}
    const base=positions.length/3;let touchesLip=false;
    for(let k=0;k<=cfg.segments;k++){
      const q=k/cfg.segments,p=centres[k],tangent=unit(sub(centre(Math.min(1,q+.001)),centre(Math.max(0,q-.001))));
      const radial=unit(cross(tangent,normal(p[0],p[1]))),up=unit(cross(tangent,radial));
      // A short trimmed fibre retains a narrow terminal cross-section. A zero
      // radius tip would create degenerate triangles and glittering needles.
      const radius=diameter*.5*(1-.62*q),slope=diameter*.31/length;
      for(let sideIndex=0;sideIndex<cfg.sides;sideIndex++){
        const a=phase+sideIndex/cfg.sides*Math.PI*2,r=add(mul(radial,Math.cos(a)),mul(up,Math.sin(a)));
        const vertex=add(p,mul(r,radius)),ax=Math.abs(vertex[0]-(options.centreX??-.0006));
        if(ax<(options.halfWidth??.0244)){
          const lip=options.lipOutline?.(vertex[0])??{top:1.463,bottom:1.453};
          if(vertex[1]>lip.bottom-.00008&&vertex[1]<lip.top+.00008)touchesLip=true;
        }
        positions.push(...vertex);normals.push(...encode(unit(add(r,mul(tangent,slope)))));
      }
      maxHeight=Math.max(maxHeight,cfg.rootLiftM+length*(.12*q+.11*Math.sin(q*Math.PI*.75)));
    }
    if(touchesLip){positions.length=base*3;normals.length=base*2;rejectedLip++;continue;}
    for(let k=0;k<cfg.segments;k++)for(let c=0;c<cfg.sides;c++){
      const a=base+k*cfg.sides+c,b=base+k*cfg.sides+(c+1)%cfg.sides,d=a+cfg.sides,e=b+cfg.sides;
      indices.push(a,b,d,b,e,d);
    }
    strands++;regionCounts[region]++;layerCounts[layer]++;minLength=Math.min(minLength,length);maxLength=Math.max(maxLength,length);
  }
  return {positions,normals,indices,report:{revision:cfg.revision,seed,strands,regionCounts,layerCounts,
    vertices:positions.length/3,triangles:indices.length/3,diameterM:cfg.diameterM,
    lengthRangeM:strands?[minLength,maxLength]:[0,0],maxCentreHeightM:maxHeight,rejectedSurface,rejectedLip,
    correlatedGroom:true,redLipVertexClearanceM:.00008,
    followsNeutralFace:true,requiresFaceJawAndIdentityDeformation:true,measuredAnatomy:false,visualAcceptance:false}};
}
