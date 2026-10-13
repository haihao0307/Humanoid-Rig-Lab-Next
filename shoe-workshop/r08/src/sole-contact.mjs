import {MeshRay} from '../../r07/src/ray.mjs';
import {refineForDeformation} from '../../r07/src/refine-sole.mjs';
import {add,sub,mul,dot,cross,unit,smooth,clamp} from '../../r07/src/geometry.mjs';
const rayOf=(g,outer=false)=>new MeshRay({positions:Array.from(g.attributes.position.array),indices:Array.from(g.index.array).slice(0,outer?g.groups[0].count:g.index.count)});
/** Register the existing FOREFOOT cupsole wall against the FINAL upper surface,
 * including the few mm below the lip. No extra welt/cover, no depth offset.
 * The old single-height lip match can leave real leather protrusion below it.
 */
export function seatSoleWall(source,parts){
 const sr=rayOf(source),uppers=parts.filter(p=>![19,29,20].includes(p.id)).map(p=>rayOf(p.geometry,true)),ps=source.userData.seating.profiles,N=ps.length,ys=[-.12,-.5,-1,-1.5,-2,-2.5,-3],measurements=[];
 const blendY=(y,Y)=>smooth((y-(Y-4))/2),blendR=(r,R)=>smooth((r/R-.5)/.5);
 const required=ps.map(p=>{const x=Math.cos(p.angle),z=Math.sin(p.angle);if(z<.82)return 0;let delta=0;for(const dy of ys){const y=p.nativeLipY+dy,o=[180*x,y,180*z],d=[-x,0,-z],h=sr.ray(o,d);if(!h||h.distance>179)continue;const R=180-h.distance;let skin=-Infinity;for(const r of uppers){const q=r.ray(o,d);if(q&&q.distance<179)skin=Math.max(skin,180-q.distance);}if(!Number.isFinite(skin))continue;const gap=R-skin,w=blendY(y,p.nativeLipY)*blendR(R,p.nativeRadius);if(w<.02)continue;const need=Math.max(0,.18-gap)/w;delta=Math.max(delta,need);measurements.push({angle:p.angle,y,soleRadius:R,skinRadius:skin,gapMm:gap,requiredMm:need});}return Math.min(.8,delta);});
 // Conservative neighbour envelope survives angular interpolation; still <=0.8mm.
 const ds=required.map((v,i)=>Math.max(v,required[(i+N-1)%N],required[(i+1)%N])*smooth((Math.sin(ps[i].angle)-.82)/.10));
 const warp=q=>{const[x,y,z]=q,r=Math.hypot(x,z);if(r<1)return q.slice();const a=((Math.atan2(z,x)+Math.PI*2)%(Math.PI*2))/(Math.PI*2)*N,i=Math.floor(a),j=(i+1)%N,t=a-i,R=ps[i].nativeRadius*(1-t)+ps[j].nativeRadius*t,Y=ps[i].nativeLipY*(1-t)+ps[j].nativeLipY*t,dr=(ds[i]*(1-t)+ds[j]*t)*blendR(r,R)*blendY(y,Y);return[x+x/r*dr,y,z+z/r*dr];};
 const g=refineForDeformation(source,warp),p=g.attributes.position.array,n=g.attributes.normal.array,before=new Float32Array(p),oldN=new Float32Array(n);let maxMove=0,minDet=Infinity;
 for(let i=0;i<p.length;i+=3){const q=Array.from(before.slice(i,i+3)),v=warp(q);p.set(v,i);maxMove=Math.max(maxMove,Math.hypot(...sub(v,q)));const h=.02,J=[0,1,2].map(k=>{const a=q.slice(),b=q.slice();a[k]+=h;b[k]-=h;return mul(sub(warp(a),warp(b)),1/(2*h));}),C=[cross(J[1],J[2]),cross(J[2],J[0]),cross(J[0],J[1])],det=dot(J[0],C[0]);if(!(det>0))throw Error('Invalid final sole contact Jacobian');minDet=Math.min(minDet,det);n.set(unit(add(add(mul(C[0],oldN[i]),mul(C[1],oldN[i+1])),mul(C[2],oldN[i+2]))),i);}
 g.attributes.position.needsUpdate=true;g.attributes.normal.needsUpdate=true;g.computeBoundingBox();g.computeBoundingSphere();const finalRay=rayOf(g),after=measurements.map(m=>{const x=Math.cos(m.angle),z=Math.sin(m.angle),h=finalRay.ray([180*x,m.y,180*z],[-x,0,-z]);return{...m,finalGapMm:h?180-h.distance-m.skinRadius:null};});
 g.userData.seating={...source.userData.seating,finalWallContact:{samples:after.length,coreSamples:after.filter(m=>Math.sin(m.angle)>=.92).length,detectedOldProtrusions:measurements.filter(m=>Math.sin(m.angle)>=.92&&m.gapMm<0).length,remainingSampledProtrusions:after.filter(m=>Math.sin(m.angle)>=.92&&m.finalGapMm!==null&&m.finalGapMm<-.005).length,maxMoveMm:maxMove,maxAllowedMoveMm:.8,minSampledJacobian:minDet,targetRadialClearanceMm:.18,measurements:after,affineSubdivision:g.userData.affineSubdivision,scope:'Forefoot core z/r>=0.92, smooth transition 0.82..0.92; finite radial samples near cup lip. Other angles unchanged. Not adhesive or whole-shell collision proof'}};return g;
}
