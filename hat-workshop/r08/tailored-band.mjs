/* The bearing band and the free crown are distinct material components.
 * A fixed source crown is graded coherently; added sweatband is evaluated from
 * the same target head and attaches to the actual source-derived cavity. */
import {normals,sample} from './core.mjs';
import {cavityRadius,bearingSection,invalidateCavity} from './support.mjs';
const TAU=2*Math.PI,smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
export function addTailoredBand(mesh,meta,s,hp,out){
 const contained=['trilby','cloche','chef'].includes(meta.id),inset=contained?.00065:0;
 let band=s.wearBandMM/1000;const nominalBand=band,t=.0012,gap=.001,depth=.022,N=contained?192:96,rows=contained?9:7,P=[],UV=[],I=[],G=[];let minBurial=Infinity,minInnerGap=Infinity;
 let closed=false;for(let k=0;k<6;k++){const candidate=nominalBand+k*.002,y=candidate+.002,h=sample(hp,y,0);if(Array.from({length:N},(_,j)=>cavityRadius(out.position,mesh.index,y,h.center,j*TAU/N)).every(Number.isFinite)){band=candidate;closed=true;break;}}if(!closed)throw Error('承托区没有完整内腔截面，需单独标定');const c=sample(hp,band,0).center;
 // A small shared assembly allowance protects original shell/trim separation.
 let factor=1;for(const y of [band+.002,band+.008,band+.016,band+depth])for(let j=0;j<N;j++){const a=j*TAU/N,h=sample(hp,y,a),r=cavityRadius(out.position,mesh.index,y,h.center,a);if(!Number.isFinite(r))throw Error('该帽型的承托带尚未形成完整帽腔截面');factor=Math.max(factor,(h.r+gap+t+(contained?inset+.0002:.0004))/r);}
 // The crown must clear the upper skull too, independently of the bearing belt.
 // Enlarge the entire source assembly coherently, not individual contacting points.
 for(let y=band+depth+.008;y<hp.ymax-.004;y+=.010)for(let j=0;j<N;j++){
  const a=j*TAU/N,h=sample(hp,y,a),r=cavityRadius(out.position,mesh.index,y,h.center,a);
  if(h.valid&&Number.isFinite(r)&&r>.01)factor=Math.max(factor,(h.r+.001)/r);
 }
 factor*=1.001;if(factor>1.10)throw Error('内汗带所需余量超过固定母型范围');
 if(factor>1){for(let i=0;i<out.position.length;i+=3){out.position[i]=c[0]+(out.position[i]-c[0])*factor;out.position[i+2]=c[1]+(out.position[i+2]-c[1])*factor;}out.normal=normals(mesh,out.position);invalidateCavity(out.position);}
 const at=band+depth,ac=sample(hp,at,0).center,attach=Array.from({length:N},(_,j)=>cavityRadius(out.position,mesh.index,at,ac,j*TAU/N));if(attach.some(r=>!Number.isFinite(r)))throw Error('内汗带上缘不能连接当前帽腔');
 for(let layer=0;layer<2;layer++)for(let k=0;k<rows;k++)for(let j=0;j<=N;j++){
  const a=j*TAU/N,f=k/(rows-1),y=band+(contained?.002:.001)+f*(depth-(contained?.002:.001)),h=sample(hp,y,a),base=h.r+gap,upper=attach[j%N]-(contained?t+inset:t*.5);
  const topHead=sample(hp,at,a);if(upper<topHead.r+gap)throw Error('汗带附件不能穿入头部');const w=smooth((f-.50)/.50),wall=contained?cavityRadius(out.position,mesh.index,y,h.center,a):Infinity,innerR=Math.min(base+(upper-topHead.r-gap)*w,wall-t-inset),r=innerR+layer*t;
  if(contained){if(!Number.isFinite(wall)||innerR<h.r+gap-.00003)throw Error('R07汗带厚度与帽腔余量冲突，不能隐藏穿插');minBurial=Math.min(minBurial,wall-innerR-t);minInnerGap=Math.min(minInnerGap,innerR-h.r);}
  P.push(h.center[0]+r*Math.cos(a),y,h.center[1]+r*Math.sin(a));UV.push(j/N,f);G.push(layer*rows*N+k*N+j%N);
 }
 const step=N+1,L=rows*step;for(let k=0;k<rows-1;k++)for(let j=0;j<N;j++){const a=k*step+j,b=a+1,c=a+step,d=c+1;I.push(a,c,b,b,c,d,L+a,L+b,L+c,L+b,L+d,L+c);}for(let j=0;j<N;j++){const a=j,b=j+1,c=(rows-1)*step+j,d=c+1;I.push(a,b,L+b,a,L+b,L+a,c,L+d,d,c,L+c,L+d);}
 const B={position:Float32Array.from(P),uv:Float32Array.from(UV),index:Uint32Array.from(I),groups:Uint32Array.from(G),groupCount:2*rows*N,nominalThicknessMM:1.2,supportY:band,construction:'procedural finite-thickness inner bearing band; free crown stays independent'};B.normal=normals(B,B.position);out.sweatband=B;
 out.diagnostics.addedInnerBand={containedWithinCrown:contained,sampledOuterInsetMM:contained?minBurial*1000:null,sampledInnerHeadGapMM:contained?minInnerGap*1000:null,sourceCavityAttached:true,effectiveSupportPlaneMM:band*1000,sourceClosureAdjustmentMM:(band-nominalBand)*1000,materialThicknessMM:1.2,bandHeightMM:21,assemblyAllowanceScale:factor,freeCrownShapePreserved:true,materialCalibrated:false};return out;
}
