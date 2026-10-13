/* Finite sweatband and facing: one coordinate origin from the actual head.
 * The bill must not bias the section origin. Do not cap the facing reach at 20 mm.
 */
import {normals,sample} from './core.mjs';
import {cavityRadius} from './cavity.mjs';
const TAU=2*Math.PI;
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
function bandHead(hp,y,a){const h=sample(hp,y,a);if(!h.valid||h.r<.005)throw Error('Head has no valid surface at the bearing band');return h;}
export function flatcapSweatband(mesh,cap,hp,band,gap){
 const N=192,rows=9,t=.0012,height=.018,inset=.0003,at=band+height,P=[],UV=[],I=[],G=[];
 const attach=Array.from({length:N},(_,j)=>{const a=j/N*TAU,h=bandHead(hp,at,a),r=cavityRadius(cap,mesh.index,at,h.center,a);if(!Number.isFinite(r)||r<h.r+gap+t+inset)throw Error('Flatcap facing has no safe continuous crown attachment');return r-t-inset;});
 for(let layer=0;layer<2;layer++)for(let k=0;k<rows;k++)for(let j=0;j<=N;j++){
  const a=j/N*TAU,f=k/(rows-1),y=band+height*f,h=bandHead(hp,y,a),top=bandHead(hp,at,a),base=h.r+gap,w=smooth((f-.35)/.65),r=base+w*(attach[j%N]-top.r-gap)+layer*t;
  P.push(h.center[0]+r*Math.cos(a),y,h.center[1]+r*Math.sin(a));UV.push(j/N,f);G.push(layer*rows*N+k*N+j%N);
 }
 const step=N+1,L=rows*step;
 for(let k=0;k<rows-1;k++)for(let j=0;j<N;j++){const a=k*step+j,b=a+1,c=a+step,d=c+1;I.push(a,c,b,b,c,d,L+a,L+b,L+c,L+b,L+d,L+c);}
 for(let j=0;j<N;j++){const a=j,b=j+1,c=(rows-1)*step+j,d=c+1;I.push(a,b,L+b,a,L+b,L+a,c,L+d,d,c,L+c,L+d);}
 const m={position:Float32Array.from(P),uv:Float32Array.from(UV),index:Uint32Array.from(I),groups:Uint32Array.from(G),groupCount:2*rows*N};
 m.normal=normals(m,m.position);
 return {...m,nominalThicknessMM:1.2,construction:'finite-thickness sweatband and shaped facing, head-centred upper attachment to actual cap cavity',attachment:{method:'exact head-centred crown triangle cut, not bill bounding box',upperSetbackMM:inset*1000,radialClampRemoved:true},scope:'static finite fabric facing; no manufacturing or physical-seam certification'};
}
