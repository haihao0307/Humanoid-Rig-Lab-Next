// Authored guide fields and runtime envelopes. Roots stay on the accepted R17
// scalp; a hanging shaft is allowed to leave that scalp. No stored mesh assets.
import {hairSeed} from './hair-profile.mjs';
import {scalpBoundary} from './hair-zones.mjs';
const TAU=2*Math.PI,clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
const mix=(a,b,t)=>a.map((v,k)=>v+(b[k]-v)*t),sub=(a,b)=>a.map((v,k)=>v-b[k]);
const unit=a=>{const r=Math.hypot(...a);return a.map(v=>v/Math.max(1e-12,r));};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const direction=(az,theta)=>[Math.sin(az)*Math.sin(theta),Math.cos(theta),Math.cos(az)*Math.sin(theta)];
const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0);
function sphereMix(a,b,t){
 const angle=Math.acos(Math.max(-.999999,Math.min(.999999,dot(a,b))));
 if(angle<.001)return unit(mix(a,b,t));
 return unit(a.map((v,k)=>(v*Math.sin((1-t)*angle)+b[k]*Math.sin(t*angle))/Math.sin(angle)));
}

// Uniform arc sampling prevents a gathered style's long guide section from
// becoming one huge ribbon. This temporary table is released after each strand.
function arcCurve(evaluate){
 const points=[],lengths=[0];let total=0;
 for(let i=0;i<=64;i++){const p=evaluate(i/64);if(i){total+=Math.hypot(...sub(p,points[i-1]));lengths.push(total);}points.push(p);}
 return t=>{if(t===0)return points[0];const distance=t*total;let lo=0,hi=64;
  while(lo+1<hi){const m=(lo+hi)>>1;if(lengths[m]<distance)lo=m;else hi=m;}
  return mix(points[lo],points[hi],clamp((distance-lengths[lo])/Math.max(1e-12,lengths[hi]-lengths[lo])));
 };
}

export function createHairStyle(resolved,scalp,radiusAt){
 const {design,styleScale:scale,profile}=resolved;if(!design)return null;
 const centre=scalp.centre,seed=profile.seed,phase=hairSeed(seed+'/groom')/4294967296*TAU;
 const bob=design==='bob'||design==='wavy-bob',tied=design==='high-bun'||design==='ponytail';
 let support=null;
 const at=(n,extra=0)=>{const r=Math.max(radiusAt(n),support?support(n):0)+extra;return n.map((v,k)=>centre[k]+v*r);};
 const edge=az=>scalpBoundary(Math.abs(az),Math.sign(az),resolved.rules);
 const volume=n=>{
  const top=smooth((n[1]-.05)/.8),front=smooth((n[2]+.15)/.9);
  return scale*(design==='quiff'?.020*top*(.45+.55*front):bob?.009*top:design==='pixie'?.009*top:design==='curtains'?.014*top*(.3+.7*smooth(Math.abs(n[0]+.035)/.22)):.006*top);
 };
 // Continuous front and rear fields keep adjacent locks on the same envelope.
 // A quiff reverses the front field toward the crown; other short cuts fall
 // forward, with shorter extensions at the temples and nape.
 function shortShell(half,u,v){
  if(design==='quiff'){
   const az=(u-.5)*Math.PI,backAz=Math.sign(az||1)*(Math.PI-Math.abs(az));
   const start=direction(az,edge(az).theta),end=direction(backAz,edge(backAz).theta),crown=unit([Math.sin(az),Math.cos(az),0]);
   const n=v<.37?sphereMix(start,crown,v/.37):sphereMix(crown,end,(v-.37)/.63);
   const lift=volume(n)*smooth(v/.13)*smooth((1-v)/.12);
   return at(n,.003+lift+.001*Math.sin(u*17+phase)*Math.sin(Math.PI*v));
  }
  const raw=(half===0?-.5:.5)*Math.PI+u*Math.PI,az=raw>Math.PI?raw-TAU:raw;
  const front=1-smooth(Math.abs(az)/1.3),t=v;
  const extension=front*(design==='fringe'?.23:design==='pixie'?.04+.30*smooth((az+.8)/1.6):design==='curtains'?.29:0);
  const end=edge(az).theta+extension,theta=.025+(end-.025)*t;
  const turn=(design==='pixie'?.23*smooth(t):design==='curtains'?Math.sign(az||1)*.48*smooth(t):.05*Math.sin(Math.PI*t))*front;
  const n=direction(az+turn,theta),interior=smooth((end-theta)/.30);
  const lift=volume(n)*interior+.0013*Math.sin(az*9+theta*3+phase)*Math.sin(Math.PI*t);
  return at(n,.0030+lift);
 }
 // Two fans begin along a curved part and sweep outwards, rather than opening
 // a gap in a circular helmet. The lower section carries the cut and gravity.
 function bobFanRaw(sign,u,v){
  const start=unit([-.12+.04*Math.sin(u*Math.PI),1,.70-1.42*u]);
  const az=sign*(.30+(Math.PI-.30)*u),hem=direction(az,1.57);
  const n=sphereMix(start,hem,clamp(v/.49));
  const q=at(n,.0100+volume(n)+.004*Math.sin(Math.PI*clamp(v/.49)));
  if(v>.49){
   const t=(v-.49)/.51,face=1-smooth(u/.28),drop=(design==='wavy-bob'?.110:.095)*(.72+.28*scale);
   const wave=design==='wavy-bob'?.0055*Math.sin(t*TAU*1.15+u*5+phase)*smooth(t):0;
   const radial=.004*Math.sin(Math.PI*t)-.008*smooth((t-.68)/.32)+wave;
   q[0]+=Math.sin(az)*radial;q[2]+=Math.cos(az)*radial;
   q[1]-=drop*t*(1-.10*face)+.0015*Math.sin(u*23+phase)*t*t;
  }
  return q;
 }
 // Blend both position and tangent through the shoulder of the haircut. A
 // position-only join leaves a horizontal lighting seam across every lock.
 function bobFan(sign,u,v){
  const lo=.36,hi=.64;if(v<=lo||v>=hi)return bobFanRaw(sign,u,v);
  const a=bobFanRaw(sign,u,lo),b=bobFanRaw(sign,u,hi),epsilon=.0002;
  const da=sub(bobFanRaw(sign,u,lo+epsilon),bobFanRaw(sign,u,lo-epsilon));
  const db=sub(bobFanRaw(sign,u,hi+epsilon),bobFanRaw(sign,u,hi-epsilon));
  const t=(v-lo)/(hi-lo),t2=t*t,t3=t2*t,k=(hi-lo)/(2*epsilon);
  return a.map((x,i)=>(2*t3-3*t2+1)*x+(t3-2*t2+t)*da[i]*k+(-2*t3+3*t2)*b[i]+(t3-t2)*db[i]*k);
 }
 const target=unit(design==='high-bun'?[0,.86,-.51]:[0,.04,-1]);
 const gather=(n,t)=>{
  let d=sphereMix(n,target,t);
  if(design==='ponytail'){
   const az=Math.atan2(d[0],d[2]),theta=Math.acos(Math.max(-1,Math.min(1,d[1])));
   // Tight sideburn hair passes above the ear on its way to the low tie.
   // A straight spherical route otherwise cuts across the auricle notch.
   d=direction(az,Math.min(theta,edge(az).theta-.025));
  }
  return at(d,.0018+.0032*smooth(t/.08)+volume(d)*.30+.0012*Math.sin(Math.PI*t));
 };
 let tie=gather(target,1);
 // A wound bundle has a centreline and cross-section, not a sphere with stripes.
 const bunCentre=[tie[0],tie[1]+.021,tie[2]-.007];
 const coil=v=>{const a=v*TAU*1.75,r=(.017+.005*Math.sin(Math.PI*v))*(.8+.2*scale);
  return mix([bunCentre[0]+Math.sin(a)*r,bunCentre[1]+(v-.5)*.024,bunCentre[2]+Math.cos(a)*r],[tie[0],tie[1]+.012,tie[2]-.006],smooth((v-.80)/.20));};
 const bun=(u,v)=>{const a=v*TAU*1.75,b=u*TAU,r=.012*(.75+.25*Math.sin(Math.PI*v))*(.8+.2*scale),c=coil(v);
  return [c[0]+Math.sin(a)*Math.cos(b)*r,c[1]+Math.sin(b)*r,c[2]+Math.cos(a)*Math.cos(b)*r];};
 const tailCentre=(clump,v)=>{const a=clump*TAU/3,spread=.006*smooth(v/.5),fall=.147*(.75+.25*scale);
  return [tie[0]+Math.sin(a)*spread+.004*Math.sin(v*3),tie[1]-fall*v,tie[2]-.008-.025*(1-Math.exp(-v*5))+Math.cos(a)*spread];};
 const tail=(clump,u,v)=>{const a=u*TAU,c=tailCentre(clump,v),r=(.0065+.003*Math.sin(Math.PI*v))*(1-.67*v)*(.85+.15*scale);
  return [c[0]+Math.cos(a)*r,c[1]+Math.sin(a)*r*.18,c[2]+Math.sin(a)*r];};
 const specs=[];
 if(bob){
  for(const sign of [-1,1])specs.push({locks:18,layers:2,rows:16,open:true,width:1.55,point:(u,v)=>bobFan(sign,u,v)});
 }else if(tied){
  for(const band of [.16,.49,.98])specs.push({locks:32,layers:1,rows:10,width:1.65,open:true,point:(u,v)=>{
   const az=(u-.5)*TAU,n=direction(az,edge(az).theta*band);return gather(n,v);
  }});
 }else for(const half of design==='quiff'?[0]:[0,1]){
  if(design==='curtains'&&half===0)for(const side of [0,1])specs.push({locks:12,layers:2,rows:12,width:1.5,open:true,point:(u,v)=>shortShell(0,side*.50001+u*.49998,v)});
  else specs.push({locks:design==='quiff'?32:24,layers:2,rows:design==='quiff'?18:12,width:1.5,open:true,point:(u,v)=>shortShell(half,u,v)});
 }
 if(design==='high-bun')specs.push({locks:12,layers:1,rows:36,width:1.6,point:bun,outward:(p,u,v)=>sub(p,coil(v))});
 if(design==='ponytail')for(let clump=0;clump<3;clump++)specs.push({locks:8,layers:1,rows:16,width:1.65,open:true,point:(u,v)=>tail(clump,u,v),outward:(p,u,v)=>sub(p,tailCentre(clump,v))});
 // Match each loose root to its field once, before arc sampling. The shaft
 // follows the same envelope instead of floating above an unrelated surface.
 let samples=null;
 function curve(strand){
  const root=strand.point(0),n=unit(sub(root,centre));
  const random=hairSeed(seed+'/'+strand.id)/4294967296,angle=TAU*random,ownLength=.94+.06*hairSeed(strand.id+'/tip')/4294967296;
  let evaluate;
  if(!tied){
   samples??=(bob?[-1,1]:design==='quiff'?[0]:[0,1]).flatMap(sign=>Array.from({length:25},(_,i)=>Array.from({length:21},(_,j)=>({sign,u:i/24,v:j/20,p:bob?bobFan(sign,i/24,j/20):shortShell(sign,i/24,j/20)}))).flat());
   let best=samples[0],distance=Infinity;
   for(const sample of samples){const d=sub(sample.p,root),r=dot(d,d);if(r<distance){distance=r;best=sample;}}
   const end=bob?Math.max(best.v,ownLength):Math.min(ownLength,best.v+.62);
   evaluate=t=>{const v=best.v+(Math.max(best.v,end)-best.v)*t;
    return mix(root,bob?bobFan(best.sign,best.u,v):shortShell(best.sign,best.u,v),smooth(t/.13));};
  }else if(tied){
   const split=design==='high-bun'?.57:.58;
   evaluate=t=>{
    if(t<split)return mix(root,gather(n,t/split),smooth(t/.045));
    const v=(t-split)/(1-split),q=design==='high-bun'?bun(random,v*ownLength):tail(hairSeed(strand.id)%3,random,v*ownLength);
    return mix(tie,q,smooth(v/.12));
   };
  }
  return arcCurve(t=>{const p=evaluate(t),f=Math.sin(Math.PI*t);if(t>0){
   const a=.00035*f*Math.sin(t*7+angle),lift=(.0006+.0014*random)*f,d=unit(sub(p,centre));
   for(let k=0;k<3;k++)p[k]+=d[k]*lift;p[0]+=a;p[2]+=a*.4;
  }return p;});
 }
 const baseVolume=n=>volume(n)*(bob||tied?0:.12);
 // The undergrowth has a fitted chord margin around local skull bumps. Outer
 // locks must clear that actual support, not only the uncorrected radial field.
 function attachSupport(base){
  const {positions,rows,columns}=base,radii=new Float32Array((rows+1)*(columns+1));
  for(let i=0;i<radii.length;i++)radii[i]=Math.hypot(...[0,1,2].map(k=>positions[i*3+k]-centre[k]));
  support=n=>{
   const az=Math.atan2(n[0],n[2]),theta=Math.acos(Math.max(-1,Math.min(1,n[1]))),limit=Math.min(scalp.thetaMax,edge(az).theta);
   if(theta>limit)return 0;
   const x=((Math.atan2(n[2],n[0])+TAU)%TAU)/TAU*columns,y=theta/limit*rows;
   const ix=Math.min(columns-1,Math.floor(x)),iy=Math.min(rows-1,Math.floor(y)),a=x-ix,b=y-iy,k=iy*(columns+1)+ix;
   return (1-b)*((1-a)*radii[k]+a*radii[k+1])+b*((1-a)*radii[k+columns+1]+a*radii[k+columns+2]);
  };
  const next=gather(target,1);for(let k=0;k<3;k++)bunCentre[k]+=next[k]-tie[k];tie=next;samples=null;
 }
 return {design,centre,volume,baseVolume,curve,specs,seed,attachSupport,segments:Math.max(resolved.budget.segmentsPerStrand,tied?18:bob?12:8)};
}

// Overlapping individual locks replace the continuous outer shell. Each strip
// carries across/along coordinates and a stable ID for procedural strand masks.
// All four LOD index ranges share vertices and the same total hair allocation.
export function appendHairStyleCoverage(base,style){
 if(!style?.specs.length)return base;
 const positions=Array.from(base.positions),regions=Array.from(base.regionData),normals=Array(base.positions.length).fill(0),patches=[];
 for(const [specId,spec]of style.specs.entries()){
  const {point,open}=spec,locks=spec.locks,rows=spec.rows,columns=2;
  for(let layer=0;layer<(spec.layers||1);layer++)for(let lock=0;lock<locks;lock++){
   const random=hairSeed(style.seed+'/'+specId+'/'+layer+'/'+lock)/4294967296;
   const phase=random*TAU,mid=(lock+.5+layer*.5+(random-.5)*.24)/locks;
   const end=open?(layer?.78+.22*random:.975+.025*random):1,begin=layer?(.035+.12*random):0;
   const width=(spec.width||1.5)*(layer?.62:1)/locks*(.82+.36*random),start=positions.length/3;
   for(let y=0;y<=rows;y++)for(let x=0;x<=columns;x++){
    const along=y/rows,across=x/columns,tipBlend=open?smooth((along-.65)/.25):0;
    // Restore the R20 cut only at the ends; retain the R21 outer course above it.
    const cutBegin=layer*.018*random,cutEnd=.965+.035*random;
    const currentV=begin+(end-begin)*along,v=currentV+(cutBegin+(cutEnd-cutBegin)*along-currentV)*tipBlend;
    const currentTaper=open?1-(layer?.68:.18)*smooth((along-.65)/.35):.75+.25*Math.sin(Math.PI*along);
    const cutTaper=1-.35*smooth((along-.88)/.12),taper=currentTaper+(cutTaper-currentTaper)*tipBlend;
    const cutWidth=(spec.width||1.5)*(layer?.82:1)/locks*(.88+.24*random),lockWidth=width+(cutWidth-width)*tipBlend;
    const shift=((layer?.35:.10)*(1-tipBlend)+.11*tipBlend)/locks*Math.sin(along*5+phase)*Math.sin(Math.PI*along);
    const u=Math.max(.00001,Math.min(.99999,mid+(across-.5)*lockWidth*taper+shift));
    const p=point(u,v),du=sub(point(Math.min(1,u+.0001),v),point(Math.max(0,u-.0001),v));
    const dv=sub(point(u,Math.min(1,v+.0001)),point(u,Math.max(0,v-.0001))),normal=unit(cross(du,dv));
    const radial=spec.outward?spec.outward(p,u,v):sub(p,style.centre);if(normal.reduce((s,a,k)=>s+a*radial[k],0)<0)for(let k=0;k<3;k++)normal[k]*=-1;
    const currentLift=.0003+layer*.0010+(.0004+(layer?.0030:.0006)*random)*Math.sin(Math.PI*along)+.0005*Math.sin(Math.PI*across);
    const cutLift=.0003+layer*.0011+(.00025+.0006*random)*Math.sin(Math.PI*along)+.00035*Math.sin(Math.PI*across);
    const lift=currentLift+(cutLift-currentLift)*tipBlend;
    positions.push(...p.map((a,k)=>a+normal[k]*lift));
    const acrossDirection=unit(du),widthMetres=Math.hypot(...du)/.0002*lockWidth*taper;
    const slope=Math.min(.7,(.0005-.00015*tipBlend)*Math.PI/Math.max(.001,widthMetres))*Math.cos(Math.PI*across);
    normals.push(...unit(normal.map((a,k)=>a-acrossDirection[k]*slope)));
    regions.push(-1-layer-random,across,along);
   }
   patches.push({start,rows,columns});
  }
 }
 const indices=[],levels=[];
 for(let lod=0;lod<4;lod++){
  const start=indices.length,old=base.levels[lod],step=Math.min(4,2**lod);
  indices.push(...base.indices.subarray(old.offsetBytes/2,old.offsetBytes/2+old.count));
  for(const p of patches)for(let y=0;y<p.rows;y+=step)for(let x=0;x<p.columns;x++){
   const a=p.start+y*(p.columns+1)+x,b=a+1,c=p.start+Math.min(p.rows,y+step)*(p.columns+1)+x,d=c+1;
   indices.push(a,c,b,b,c,d);
  }
  levels.push({...old,offsetBytes:start*2,count:indices.length-start,triangles:(indices.length-start)/3});
 }
 if(positions.length/3>65535)throw Error('Hairstyle vertex budget exceeded');
 const result={positions:new Float32Array(positions),regionData:new Float32Array(regions),styleNormals:new Float32Array(normals),indices:new Uint16Array(indices),levels,maxLOD:Math.min(1,base.maxLOD),lockCount:patches.length};
 result.geometryBytes=result.positions.byteLength+result.regionData.byteLength+result.styleNormals.byteLength+result.indices.byteLength;
 return result;
}
