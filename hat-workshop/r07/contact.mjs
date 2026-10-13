import {flatcapSweatband} from './flatcap-facing.mjs';
import {LINER_PAIRS} from './flatcap-lining-map.mjs';
/* R05 dimensional contract. Fits true source openings / separate visor band.
 * Fitting always starts from immutable source coordinates. Material clearance,
 * support coverage and free-crown space are separate quantities, all in metres.
 */
import {normals,sample,measurements,sectionProfile,CONSTRUCTION} from './core.mjs';
const TAU=2*Math.PI,clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t,smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>a.map(x=>x/Math.hypot(...a));
function inverse3(A,b){const m=A.map((r,i)=>[...r,b[i]]);for(let k=0;k<3;k++){let j=k;for(let i=k+1;i<3;i++)if(Math.abs(m[i][k])>Math.abs(m[j][k]))j=i;[m[j],m[k]]=[m[k],m[j]];if(Math.abs(m[k][k])<1e-14)throw Error('Source opening has a singular plane');let d=m[k][k];for(let n=k;n<4;n++)m[k][n]/=d;for(let i=0;i<3;i++)if(i!==k){d=m[i][k];for(let n=k;n<4;n++)m[i][n]-=d*m[k][n];}}return m.map(r=>r[3]);}
function ringFrame(points){const origin=[0,0,0],A=Array.from({length:3},()=>[0,0,0]),b=[0,0,0];for(const p of points){p.forEach((v,k)=>origin[k]+=v/points.length);const q=[p[0],p[2],1];for(let i=0;i<3;i++){b[i]+=q[i]*p[1];for(let j=0;j<3;j++)A[i][j]+=q[i]*q[j];}}const [a,c]=inverse3(A,b),Y=unit([-a,1,-c]),X=unit([1,a,0]),Z=unit(cross(X,Y));return {origin,X,Y,Z,normal:Y,method:'least-squares source aperture plane; orthonormal rotation, not shear'};}
function transform(p,F){const q=p.map((v,i)=>v-F.origin[i]);return [dot(q,F.X),dot(q,F.Y),dot(q,F.Z)];}
function interp(R,a){const u=((a%TAU+TAU)%TAU)/TAU*R.length,i=Math.floor(u),t=u-i;return mix(R[i],R[(i+1)%R.length],t);}
function fillCircle(R){const N=R.length,valid=R.filter(Number.isFinite).length;if(valid<N*.55)throw Error('Incomplete source bearing-loop coverage');for(let i=0;i<N;i++)if(!Number.isFinite(R[i])){let l=1,r=1;while(!Number.isFinite(R[(i-l+N)%N]))l++;while(!Number.isFinite(R[(i+r)%N]))r++;R[i]=mix(R[(i-l+N)%N],R[(i+r)%N],l/(l+r));}return R;}
function smoothCircle(R,passes=2){R=Array.from(R);for(let p=0;p<passes;p++)R=R.map((v,j)=>(R[(j+R.length-1)%R.length]+2*v+R[(j+1)%R.length])/4);return R;}
function boundaries(mesh){const edge=new Map(),points=new Map();for(let i=0;i<mesh.groups.length;i++)points.set(mesh.groups[i],i);for(let i=0;i<mesh.index.length;i+=3)for(let k=0;k<3;k++){const u=mesh.groups[mesh.index[i+k]],v=mesh.groups[mesh.index[i+(k+1)%3]],key=u<v?u+':'+v:v+':'+u;const e=edge.get(key);if(e)e.n++;else edge.set(key,{u,v,n:1});}const adj=new Map();for(const e of edge.values())if(e.n===1)for(const [u,v] of [[e.u,e.v],[e.v,e.u]]){if(!adj.has(u))adj.set(u,[]);adj.get(u).push(v);}const seen=new Set(),loops=[];for(const start of adj.keys()){if(seen.has(start))continue;const ids=[],todo=[start];while(todo.length){const i=todo.pop();if(seen.has(i))continue;seen.add(i);ids.push(points.get(i));todo.push(...adj.get(i));}if(ids.length>16)loops.push(ids);}return loops;}
function uvIslands(mesh){const parent=Int32Array.from(mesh.groups,(_,i)=>i);const root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};for(let i=0;i<mesh.index.length;i+=3){const r=root(mesh.index[i]);parent[root(mesh.index[i+1])]=r;parent[root(mesh.index[i+2])]=r;}const lookup=new Map();return Int32Array.from(parent,(_,i)=>{const r=root(i);if(!lookup.has(r))lookup.set(r,lookup.size);return lookup.get(r);});}
function convexRing(points,N=192){
 const P=points.map(p=>[p[0],p[2]]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]),cross2=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]),half=pts=>{const h=[];for(const p of pts){while(h.length>1&&cross2(h[h.length-2],h[h.length-1],p)<=0)h.pop();h.push(p);}return h;},hull=[...half(P).slice(0,-1),...half([...P].reverse()).slice(0,-1)];
 return Array.from({length:N},(_,j)=>{const a=j*TAU/N,dx=Math.cos(a),dz=Math.sin(a);let best=Infinity;for(let k=0;k<hull.length;k++){const p=hull[k],q=hull[(k+1)%hull.length],ex=q[0]-p[0],ez=q[1]-p[1],den=dx*ez-dz*ex;if(Math.abs(den)<1e-10)continue;const r=(p[0]*ez-p[1]*ex)/den,t=(p[0]*dz-p[1]*dx)/den;if(r>0&&t>=0&&t<=1)best=Math.min(best,r);}if(!Number.isFinite(best))throw Error('Invalid convex aperture ray');return best;});
}
function ringFromPoints(pts,N=192){const sorted=pts.map(p=>({a:(Math.atan2(p[2],p[0])+TAU)%TAU,r:Math.hypot(p[0],p[2]),y:p[1]})).sort((a,b)=>a.a-b.a),radius=[],y=[];for(let j=0;j<N;j++){const a=j*TAU/N;let k=sorted.findIndex(p=>p.a>a);if(k<0)k=0;const L=sorted[(k+sorted.length-1)%sorted.length],U=sorted[k],t=((a-L.a+TAU)%TAU)/((U.a-L.a+TAU)%TAU||1);radius.push(mix(L.r,U.r,t));y.push(mix(L.y,U.y,t));}return {radius,y};}
export function prepareContact(mesh,meta){
 if(meta.id==='visor')return prepareVisor(mesh,meta);
 if(meta.id==='flatcap')return prepareFlatcap(mesh,meta);
 const parent=Int32Array.from({length:mesh.groupCount},(_,i)=>i),root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};for(let j=0;j<mesh.index.length;j+=3){const r=root(mesh.groups[mesh.index[j]]);parent[root(mesh.groups[mesh.index[j+1]])]=r;parent[root(mesh.groups[mesh.index[j+2]])]=r;}let peak=0;for(let i=0;i<mesh.groups.length;i++)if(mesh.position[i*3+1]>mesh.position[peak*3+1])peak=i;const crownRoot=root(mesh.groups[peak]);const loops=boundaries(mesh).filter(ids=>root(mesh.groups[ids[0]])===crownRoot).filter(ids=>{const p=ids.map(i=>Array.from(mesh.position.slice(i*3,i*3+3))),x=p.map(q=>q[0]);return Math.max(...x)-Math.min(...x)>.09;});if(!loops.length)throw Error('No actual source aperture');
 loops.sort((a,b)=>{const score=ids=>{const p=ids.map(i=>Array.from(mesh.position.slice(i*3,i*3+3)));const c=[0,0,0];for(const q of p)q.forEach((v,j)=>c[j]+=v/p.length);return p.reduce((s,q)=>s+Math.hypot(q[0]-c[0],q[2]-c[2])/p.length,0);};return score(a)-score(b);});
 const ids=loops[0],pts=ids.map(i=>Array.from(mesh.position.slice(i*3,i*3+3))),frame=ringFrame(pts),q=Float32Array.from(mesh.position,()=>0);for(let i=0;i<q.length;i+=3)q.set(transform(Array.from(mesh.position.slice(i,i+3)),frame),i);
 const ring=ringFromPoints(ids.map(i=>Array.from(q.slice(i*3,i*3+3))));let top=0;
 // Flatten only the measured aperture's small non-planarity, tapered above 25mm.
 for(let i=0;i<q.length;i+=3){const a=Math.atan2(q[i+2],q[i]),ry=interp(ring.y,a),w=1-smooth((q[i+1]-.008)/.030);q[i+1]-=ry*w;top=Math.max(top,q[i+1]);}
 return {type:meta.id,position:q,normal:normals(mesh,q),ring: ring.radius,apertureIds:ids,top,frame,contract:'actual-source-aperture/1',sourceLoopCount:loops.length};
}
function bandHead(hp,y,a){let h=sample(hp,y,a);if(!h.valid||h.r<.005)throw Error('Head has no valid surface at the bearing band');return h;}
export function fitContact(mesh,meta,s,hp,src){if(src.type==='visor')return fitVisor(mesh,meta,s,hp,src);if(src.type==='flatcap')return fitFlatcap(mesh,meta,s,hp,src);
 const knit=meta.id==='cable',band=s.wearBandMM/1000,gap=(s.clearanceMM+s.hairMM)/1000,t=knit?s.materialMM/1000:0,N=src.ring.length,ref=measurements(hp,band),H=knit?Math.max(src.top,hp.ymax-band+CONSTRUCTION.cable.apexAir/1000+t):Math.max(src.top,(hp.ymax-band+.007)),sy=H/src.top,q=src.position,nn=src.normal;
 let ratios=Array.from({length:N},(_,j)=>{const a=j*TAU/N,h=bandHead(hp,band,a);return(h.r+gap+t)/src.ring[j];});
 if(knit||['fishing','patrol','chef'].includes(meta.id)){
  // One periodic multiplier for whole radial columns, based on actual inner
  // support geometry. All folds share it; no high-resolution scalp projection.
  const req=new Array(N).fill(-Infinity);
  for(let i=0;i<q.length;i+=3){if(q[i+1]<(knit?-.004:-.012)||q[i+1]>(knit?.022:.046))continue;const a=Math.atan2(q[i+2],q[i]),r=Math.hypot(q[i],q[i+2]);if(r<.04)continue;const hh=bandHead(hp,band+q[i+1]*(knit?1:sy),a),nr=nn[i]*Math.cos(a)+nn[i+2]*Math.sin(a),f=(hh.r+gap+t*Math.max(0,nr))/r,j=Math.floor(((a+TAU)%TAU)/TAU*N);req[j]=Math.max(req[j],f);}
  const filled=fillCircle(req.map(v=>Number.isFinite(v)?v:NaN)),sm=smoothCircle(filled,3);ratios=sm.map((v,j)=>Math.max(v,filled[j],filled[(j+1)%N],filled[(j+N-1)%N]));ratios=smoothCircle(ratios,1).map((v,j)=>Math.max(v,filled[j]));
 }
 if(ratios.some(r=>r<.55||r>1.55))throw Error('Target head is outside this measured hat sizing range');
 const out=new Float32Array(q.length),col=new Float32Array(q.length);
 for(let i=0;i<q.length;i+=3){const a=Math.atan2(q[i+2],q[i]),rho=Math.hypot(q[i],q[i+2]),rr=interp(src.ring,a),scale=interp(ratios,a),v=clamp(q[i+1]/src.top),head=bandHead(hp,band,a);
  // Brim reach is an absolute source distance, not inflated by head circumference.
  const excess=!knit&&q[i+1]<.023?Math.max(0,rho-rr):0,r=rho*scale+excess*(1-scale);
  out[i]=head.center[0]+r*Math.cos(a);out[i+1]=band+(knit?(q[i+1]<=.030?q[i+1]:.030+(q[i+1]-.030)*(H-.030)/(src.top-.030)):q[i+1]*sy)+Math.max(0,s.crownMM)/1000*smooth(v);out[i+2]=head.center[1]+r*Math.sin(a)-s.backLeanMM/1000*smooth(v);
  col.set(q[i+1]<.025?[.12,.68,.64]:[.8,.53,.27],i);
 }
 let normal=normals(mesh,out);const wallCorrections=[];if(knit)for(let pass=0;pass<2;pass++){const inner=Float32Array.from(out,(v,i)=>v-normal[i]*t);wallCorrections.push(collarConstraint(mesh,out,hp,band,gap,inner));normal=normals(mesh,out);}return result(mesh,meta,s,hp,src,out,normal,col,{wallCorrections,supportMethod:knit?'inner-bearing-strip / shared periodic radial columns':'true inner opening / shared assembly map',sourceApertureNodes:src.apertureIds.length,positiveRadialScale:[Math.min(...ratios),Math.max(...ratios)],crownHeightScale:sy,freeCrown:knit?{originalHeightMM:src.top*1000,formedHeightMM:H*1000,minimumApexAirMM:CONSTRUCTION.cable.apexAir,scalpProjection:false}:null,brimReachUnscaled:!knit,pointwiseScalpClamp:false},src.apertureIds,knit?t:0);
}
function result(mesh,meta,s,hp,src,position,normal,colors,diagnostics,ids=null,thick=0){
 const band=s.wearBandMM/1000,N=96,bins=new Array(N).fill(Infinity);let min=Infinity,max=-Infinity,count=0;
 const selected=ids||Array.from({length:position.length/3},(_,i)=>i);
 for(const v of selected){const i=v*3,x=position[i]-normal[i]*thick,y=position[i+1]-normal[i+1]*thick,z=position[i+2]-normal[i+2]*thick;if(y<hp.ymin||y>hp.ymax-.001)continue;const c=sample(hp,y,0).center,a=Math.atan2(z-c[1],x-c[0]),h=sample(hp,y,a);if(!h.valid)continue;const gap=Math.hypot(x-h.center[0],z-h.center[1])-h.r,j=Math.floor(((a+TAU)%TAU)/TAU*N);bins[j]=Math.min(bins[j],gap);min=Math.min(min,gap);max=Math.max(max,gap);count++;}
 const gaps=bins.filter(Number.isFinite).sort((a,b)=>a-b);return{position,normal,colors,measurement:measurements(hp,band),diagnostics:{...diagnostics,mode:src.type,contract:'kaopu.hat.fit-contract/5',sourceFrame:src.frame||null,materialThicknessMM:thick*1000,sampledVertices:count,minimumRadialClearanceMM:min*1000,maximumRadialClearanceMM:max*1000,bandSampleBins:gaps.length,bandMinimumMM:gaps[0]*1000,bandMedianMM:gaps[Math.floor(gaps.length*.5)]*1000,bandP95MM:gaps[Math.min(gaps.length-1,Math.floor(gaps.length*.95))]*1000,supportScope:'actual selected source interface nodes / radial head profile; separate nearest-triangle QA required',physicalValidated:false}};
}
function prepareVisor(mesh,meta){
 const islands=uvIslands(mesh),N=128,q=Float32Array.from(mesh.position,(x,i)=>x-meta.origin[i%3]),lo=new Array(N).fill(Infinity),hi=new Array(N).fill(-Infinity),bins=Array.from({length:N},()=>[]);
 for(let i=0;i<islands.length;i++)if(islands[i]>=2){const a=(Math.atan2(q[i*3+2],q[i*3])+TAU)%TAU,j=Math.floor(a/TAU*N),y=q[i*3+1],r=Math.hypot(q[i*3],q[i*3+2]);lo[j]=Math.min(lo[j],y);hi[j]=Math.max(hi[j],y);bins[j].push([y,r,i]);}
 const L=smoothCircle(fillCircle(lo.map(v=>Number.isFinite(v)?v:NaN)),2),U=smoothCircle(fillCircle(hi.map(v=>Number.isFinite(v)?v:NaN)),2),rows=9,rr=Array.from({length:rows},()=>new Array(N).fill(Infinity));
 for(let j=0;j<N;j++)for(const [y,r] of bins[j]){const v=clamp((y-L[j])/(U[j]-L[j])),k=Math.min(rows-1,Math.round(v*(rows-1)));rr[k][j]=Math.min(rr[k][j],r);}
 for(let k=0;k<rows;k++)rr[k]=smoothCircle(fillCircle(rr[k].map(v=>Number.isFinite(v)?v:NaN)),2);
 return {type:'visor',position:q,islands,lower:L,upper:U,radii:rr,N,rows,contract:'separate-front-band-rear-strap-bill/1'};
}
function visorR(src,a,v){const f=clamp(v)*(src.rows-1),k=Math.min(src.rows-2,Math.floor(f));return mix(interp(src.radii[k],a),interp(src.radii[k+1],a),f-k);}
function fitVisor(mesh,meta,s,hp,src){const p=src.position,gap=(s.clearanceMM+s.hairMM)/1000,band=s.wearBandMM/1000,out=new Float32Array(p.length),col=new Float32Array(p.length),bearing=[];
 for(let i=0;i<p.length;i+=3){const a=Math.atan2(p[i+2],p[i]),r=Math.hypot(p[i],p[i+2]),lo=interp(src.lower,a),hi=interp(src.upper,a),v=(p[i+1]-lo)/(hi-lo),isBand=src.islands[i/3]>=2,targetY=band+(p[i+1]-lo),y=targetY,sy=clamp(y,hp.ymin,hp.ymax-.002),h=bandHead(hp,sy,a),ref=visorR(src,a,v),residual=r-ref,rad=h.r+gap+residual;
  out[i]=h.center[0]+rad*Math.cos(a);out[i+1]=y;out[i+2]=h.center[1]+rad*Math.sin(a);col.set(isBand?[.12,.68,.64]:[.55,.56,.61],i);if(isBand&&v>.12&&v<.85)bearing.push(i/3);
 }
 return result(mesh,meta,s,hp,src,out,normals(mesh,out),col,{supportMethod:'full-height inner band on forehead/temple/occiput, separate original bill',sourceBandSeparatedFromBill:true,billAddedToContact:false,materialLayersRetained:true},bearing,0);
}
// Repair the source's shallow interior cavity by a correspondence to its own
// exterior, not to the scalp. Exterior control points, UVs and bill are preserved.
function pairedLining(mesh,position,thickness=.0012,protection=null){
 const out=new Float32Array(position),normal=normals(mesh,position),groups=new Map();for(let i=0;i<mesh.groups.length;i++){const g=mesh.groups[i];if(!groups.has(g))groups.set(g,[]);groups.get(g).push(i);}
 for(const [group,a,b,c,u,v,w] of LINER_PAIRS){const weights=[1-u-v,u,v],ids=[a,b,c],p=[0,0,0],n=[0,0,0];for(let k=0;k<3;k++)for(let j=0;j<3;j++){p[k]+=position[ids[j]*3+k]*weights[j];n[k]+=normal[ids[j]*3+k]*weights[j];}const length=Math.hypot(...n);if(!length)continue;for(const i of groups.get(group)||[])for(let k=0;k<3;k++)out[i*3+k]=mix(position[i*3+k],p[k]-thickness*n[k]/length,w*(1-(protection?.[i]||0)));}
 return out;
}
function prepareFlatcap(mesh,meta){if(meta.mother.attribution.sourceOBJ_SHA256!=='6c9b19760be32565cef06ef797791a1d9c01e0aed438a6e45136fcb359c28c54')throw Error('Flatcap lining correspondence does not match this source revision');
 const Y=unit([0,1,-.18]),X=[1,0,0],Z=unit(cross(X,Y)),frame={origin:[meta.origin[0],meta.origin[1]-.00978,meta.origin[2]-.021],X,Y,Z,method:'explicit source sewing datum, not bill envelope',bearingDefinition:'source side 80mm, forehead +65mm, occiput -107mm; cap bill excluded'};
 // A bill is a laminated, free overhang, not a shallow crown lining.
 // One continuous material-domain mask is evaluated in the immutable sewing frame.
 const protection=new Float32Array(mesh.position.length/3);
 for(let i=0;i<mesh.position.length;i+=3){const q=transform(Array.from(mesh.position.slice(i,i+3)),frame);protection[i/3]=smooth((q[2]-.060)/.035)*(1-smooth((q[1]-.018)/.035));}
 const repaired=pairedLining(mesh,mesh.position,.0012,protection),q=new Float32Array(repaired.length);for(let i=0;i<q.length;i+=3)q.set(transform(Array.from(repaired.slice(i,i+3)),frame),i);
 const top=Math.max(...Array.from(q).filter((_,i)=>i%3===1)),rx=.080,rz=.0875,radius=Array.from({length:192},(_,j)=>{const a=j*TAU/192;return 1/Math.hypot(Math.cos(a)/rx,Math.sin(a)/rz);});
 return {type:'flatcap',billProtection:protection,collarWeights:Float32Array.from(protection,v=>1-v),position:q,normal:normals(mesh,q),ring:radius,ringCenter:[0,0],top,frame,sourceBandHeight:0,liningPairs:LINER_PAIRS.length,contract:'source-interior-and-separate-sweatband/1'};
}
function collarConstraint(mesh,position,hp,band,gap,probe=position,semanticWeights=null){
 const N=96,req=new Array(N).fill(0),w=y=>{const h=Math.abs(y-band);return 1-smooth((h-.016)/.025);};
 for(let i=0;i<probe.length;i+=3){const y=probe[i+1],weight=w(position[i+1])*(semanticWeights?.[i/3]??1);if(weight<.02||y<hp.ymin||y>=hp.ymax-.001)continue;const c=sample(hp,y,0).center,a=Math.atan2(probe[i+2]-c[1],probe[i]-c[0]),h=sample(hp,y,a);if(!h.valid)continue;const r=Math.hypot(probe[i]-h.center[0],probe[i+2]-h.center[1]),need=Math.max(0,(h.r+gap-r)/weight),j=Math.floor(((a+TAU)%TAU)/TAU*N);req[j]=Math.max(req[j],need);}
 let field=smoothCircle(req,5).map((v,j)=>Math.max(v,req[j],req[(j+1)%N],req[(j+N-1)%N]));field=smoothCircle(field,2).map((v,j)=>Math.max(v,req[j]));if(Math.max(...field)>.014)throw Error('Collar fit exceeds bounded construction adjustment');
 for(let i=0;i<position.length;i+=3){const y=position[i+1],weight=w(y)*(semanticWeights?.[i/3]??1);if(!weight)continue;const c=sample(hp,clamp(y,hp.ymin,hp.ymax-.001),0).center,a=Math.atan2(position[i+2]-c[1],position[i]-c[0]),d=interp(field,a)*weight;position[i]+=d*Math.cos(a);position[i+2]+=d*Math.sin(a);}
 return {maximumCollarCorrectionMM:Math.max(...field)*1000,correctionMethod:'periodic shared collar field, C1 height falloff; outer and lining share the displacement'};
}
const sweatband=flatcapSweatband;

function fitFlatcap(mesh,meta,s,hp,src){
 const band=s.wearBandMM/1000,gap=(s.clearanceMM+s.hairMM)/1000,H=hp.ymax-band+.010+.0012,q=src.position,out=new Float32Array(q.length),col=new Float32Array(q.length),ratios=src.ring.map((r,j)=>{const h=bandHead(hp,band,j*TAU/src.ring.length);return(h.r+gap)/r;});
 if(ratios.some(v=>v<.60||v>1.4))throw Error('Flatcap head size exceeds its repaired inner-cavity range');
 for(let i=0;i<q.length;i+=3){const dx=q[i]-src.ringCenter[0],dz=q[i+2]-src.ringCenter[1],a=Math.atan2(dz,dx),r=Math.hypot(dx,dz),scale=interp(ratios,a),h=bandHead(hp,band,a);const protect=src.billProtection[i/3],excess=Math.max(0,r-interp(src.ring,a)),reachScale=scale+(r>1e-8?protect*excess*(1-scale)/r:0);out[i]=h.center[0]+dx*reachScale;out[i+1]=band+q[i+1]*H/src.top;out[i+2]=h.center[1]+dz*reachScale;col.set(q[i+1]<.018?[.12,.68,.64]:[.8,.53,.27],i);}
 const correction=collarConstraint(mesh,out,hp,band,gap,out,src.collarWeights);const normal=normals(mesh,out),ids=[];for(let j=0;j<q.length;j+=3)if(Math.abs(out[j+1]-band)<.008)ids.push(j/3);
 const res=result(mesh,meta,s,hp,src,out,normal,col,{...correction,billProtection:{sourceSewingFrame:true,liningPullExcluded:true,collarExpansionExcluded:true,unscaledFreeReach:true,protectedVertices:Array.from(src.billProtection).filter(v=>v>.99).length},supportMethod:'separate inner sweatband; original exterior and repaired lining cavity',sourceBandHeightMM:src.sourceBandHeight*1000,liningCorrespondences:src.liningPairs,sourceExteriorPreserved:true,sourceUVAndTopologyPreserved:true,pointwiseScalpClamp:false,crownHeightScale:H/src.top,positiveRadialScale:[Math.min(...ratios),Math.max(...ratios)]},ids,0);res.sweatband=sweatband(mesh,out,hp,band,gap);const B=res.sweatband,bearing=Array.from({length:3*193},(_,i)=>i),support=result(B,meta,s,hp,src,B.position,B.normal,new Float32Array(B.position.length),{},bearing,0).diagnostics;const capProbe={minimumRadialClearanceMM:res.diagnostics.minimumRadialClearanceMM,maximumRadialClearanceMM:res.diagnostics.maximumRadialClearanceMM,scope:'cap/lining near the datum; not the bearing band'};Object.assign(res.diagnostics,{capProbe,sampledVertices:support.sampledVertices,minimumRadialClearanceMM:support.minimumRadialClearanceMM,maximumRadialClearanceMM:support.maximumRadialClearanceMM,bandSampleBins:support.bandSampleBins,bandMinimumMM:support.bandMinimumMM,bandMedianMM:support.bandMedianMM,bandP95MM:support.bandP95MM,materialThicknessMM:1.2,supportScope:'actual generated inner sweatband lower half, separate from crown and bill',sweatband:B.construction});return res;
}
