import {MeshRay} from './ray.mjs';
import {clamp,smooth,stats,cross,add,mul,dot,unit,sub} from './geometry.mjs';
const rayOf=(g,outer=false)=>new MeshRay({positions:Array.from(g.attributes.position.array),indices:Array.from(g.index.array).slice(0,outer?g.groups[0].count:g.index.count)});
/** The teacher outsole is a shaped/cupped solid, NOT a completed Goodyear welt.
 * Re-seat only its upper peripheral lip against the actual assembled upper. No added cover,
 * fake outsole stitch, replacement sole, or force/adhesive certification.
 */
export function fitSoleRim(source,parts,state){
 const g=source.clone(),ray=rayOf(source),upper=parts.filter(p=>![19,29,20].includes(p.id)).map(p=>rayOf(p.geometry,true)),N=240,profiles=[];
 for(let i=0;i<N;i++){
  const a=i/N*Math.PI*2,x=Math.cos(a),z=Math.sin(a);let lo=0,hi=170;
  for(let k=0;k<17;k++){const r=(lo+hi)/2;if(ray.ray([x*r,180,z*r],[0,-1,0]))lo=r;else hi=r;}
  const r=lo;let lip=-Infinity;
  for(const inset of [.15,.45,.8,1.3,2,3,4]){const h=ray.ray([x*(r-inset),180,z*(r-inset)],[0,-1,0]);if(h)lip=Math.max(lip,h.p[1]);}
  let match=null;for(const yoff of [.20,.7,1.5,3]){for(const u of upper){const h=u.ray([x*180,lip+yoff,z*180],[-x,0,-z]);if(h&&(!match||h.distance<match.distance))match=h;}if(match)break;}
  const raw=match?(180-match.distance+.65)-r:0,delta=clamp(raw,-Math.min(8.5,r*.28),Math.min(8.5,r*.28));
  profiles.push({angle:a,nativeRadius:r,nativeLipY:lip,upperRadius:match?180-match.distance:null,rawDeltaMm:raw,deltaMm:delta,matched:!!match,bounded:Math.abs(raw)>Math.min(8.5,r*.28)});
 }
 // Smooth only the radial correction, never the original heel/bottom geometry.
 let ds=profiles.map(p=>p.deltaMm);for(let k=0;k<3;k++)ds=ds.map((v,i)=>v*.5+ds[(i+N-1)%N]*.25+ds[(i+1)%N]*.25);
 ds=ds.map((v,i)=>clamp(v,-Math.min(8.5,.28*profiles[i].nativeRadius),Math.min(8.5,.28*profiles[i].nativeRadius)));
 const p=g.attributes.position.array,before=source.attributes.position.array,normal=g.attributes.normal.array,oldNormals=source.attributes.normal.array;let changed=0,maxMove=0,unchangedBottom=0,unchangedCount=0,minJacobian=Infinity,maxFixedNormalDelta=0;
 const warp=q=>{const [x,y,z]=q,r=Math.hypot(x,z);if(r<1)return q.slice();const a=((Math.atan2(z,x)+Math.PI*2)%(Math.PI*2))/(Math.PI*2)*N,j=Math.floor(a),k=(j+1)%N,t=a-j,mix=(a,b)=>a+(b-a)*t,R=mix(profiles[j].nativeRadius,profiles[k].nativeRadius),Y=mix(profiles[j].nativeLipY,profiles[k].nativeLipY),dr=mix(ds[j],ds[k])*smooth((r/R-.50)/.50)*smooth((y-(Y-4.0))/3.3);return [x+x/r*dr,y,z+z/r*dr];};
 for(let i=0;i<p.length;i+=3){const q=Array.from(before.slice(i,i+3)),v=warp(q),move=Math.hypot(v[0]-q[0],v[2]-q[2]);p.set(v,i);if(move>1e-6){changed++;maxMove=Math.max(maxMove,move);}else {unchangedCount++;const a=((Math.atan2(q[2],q[0])+Math.PI*2)%(Math.PI*2))/(Math.PI*2)*N,j=Math.floor(a),k=(j+1)%N,t=a-j,Y=profiles[j].nativeLipY+(profiles[k].nativeLipY-profiles[j].nativeLipY)*t;if(q[1]<Y-4)unchangedBottom++;}
  // Inverse-transpose transport of the native smooth surface normal through the SAME
  // continuous deformation. Averaging long deformed CAD triangles caused false facets.
  const h=.02,J=[0,1,2].map(k=>{const a=q.slice(),b=q.slice();a[k]+=h;b[k]-=h;return mul(sub(warp(a),warp(b)),1/(2*h));}),C=[cross(J[1],J[2]),cross(J[2],J[0]),cross(J[0],J[1])],det=dot(J[0],C[0]),n=Array.from(oldNormals.slice(i,i+3));minJacobian=Math.min(minJacobian,det);if(!(det>0)||!Number.isFinite(det))throw Error('Nonpositive cupsole deformation Jacobian');const nn=unit(add(add(mul(C[0],n[0]),mul(C[1],n[1])),mul(C[2],n[2])));normal.set(nn,i);if(move<1e-7&&Math.max(...J.flat().map((x,j)=>Math.abs(x-([0,4,8].includes(j)?1:0))))<1e-5)maxFixedNormalDelta=Math.max(maxFixedNormalDelta,Math.hypot(...sub(nn,n)));
 }
 g.attributes.position.needsUpdate=true;g.attributes.normal.needsUpdate=true;g.computeBoundingBox();g.computeBoundingSphere();
 g.userData.seating={method:'Native cup-outsole upper-lip radial re-registration to actual assembled upper; 4mm vertical fade, 8.5mm / 28%-radius displacement bound, monotone radial map; no added welt',profileSamples:N,matched:profiles.filter(p=>p.matched).length,boundedSamples:profiles.filter(p=>p.bounded).length,changedVertices:changed,maxMoveMm:maxMove,unchangedVertices:unchangedCount,unchangedBottomVertices:unchangedBottom,indexBufferUnchanged:true,normalTransport:{method:"Native normals inverse-transpose transported through the same continuous lip deformation; no coarse-triangle re-averaging",finiteDifferenceMm:.02,minSampledJacobian:minJacobian,maxUnchangedRegionNormalDelta:maxFixedNormalDelta},targetOuterLipOverhangMm:.65,radialJacobianLowerBound:.16,maxAllowedMoveMm:8.5,profiles,forceSolved:false,adhesiveBondVerified:false,manufacturing:false};
 return g;
}
