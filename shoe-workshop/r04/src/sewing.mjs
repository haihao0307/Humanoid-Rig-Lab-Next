import * as T from 'three';
import {buildSeam,continuousRoutes,auditSeam} from '../vendor/r05/site/seam-extended.mjs';
const mix=(a,b,t)=>a.map((v,k)=>v+(b[k]-v)*t),sub=(a,b)=>a.map((v,k)=>v-b[k]),norm=a=>{const d=Math.hypot(...a)||1;return a.map(v=>v/d);};
/** R10 uses these same R05 saddle routes. The original source is stored unchanged; prepare applies exactly the same two
 * validator-range extensions as the user-designated R10 builder. */
export function transferredSaddle(stations,diameter=.32){
 const paths=[];if(stations.length<5)return paths;
 for(let start=0;start<stations.length-1;){let count=stations.length-start;if(count<5){start=Math.max(0,stations.length-5);count=5;}const ss=stations.slice(start,start+count);const thickness=ss.map(h=>Math.hypot(...sub(h.outer,h.inner))),half=Math.min(8,Math.max(.2,thickness.reduce((a,b)=>a+b)/thickness.length/2));
  const model=buildSeam({count,pitch:3.8,diameter,layerThickness:half,tightness:1,holeAngle:48,groove:.026}),offset=(count-1)*3.8/2;
  const frame=(u,z)=>{const i=Math.max(0,Math.min(count-2,Math.floor(u))),t=Math.max(0,Math.min(1,u-i)),a=ss[i],b=ss[i+1],outer=mix(a.outer,b.outer,t),inner=mix(a.inner,b.inner,t),normal=norm(mix(a.n,b.n,t)),tangent=norm(sub(b.outer,a.outer));const side=new T.Vector3(...normal).cross(new T.Vector3(...tangent)).normalize().toArray();return {outer,inner,normal,side};};
  // Densify in virtual coordinates BEFORE mapping so curved seams follow the host, not long chords.
  const raw=continuousRoutes(model)[0].points,pts=[];for(let j=0;j<raw.length;j++){if(j&&Math.hypot(...sub(raw[j],raw[j-1]))<.025)continue;const p=raw[j],u=Math.max(0,Math.min(count-1,(p[0]+offset)/3.8)),fr=frame(u,p[2]+5),t=.5+p[1]/(2*half);const q=mix(fr.inner,fr.outer,t).map((v,k)=>v+fr.side[k]*(p[2]+5));pts.push(q);}
  paths.push({points:pts,diameter,radiusMm:diameter/2,sourceAudit:auditSeam(model),sourceHoleStart:start,sourceHoleCount:count,normalHint:ss[0].n});if(start+count>=stations.length)break;start+=count-1;
 }return paths;
}
/** Flattened waxed cross section transferred from R10's makeSewnYarn (.215 / .52).
 * No disjoint cylinders. Source topology and mapping are separately tested. */
export function simplifyPath(points,tolerance=.006){
 if(!Number.isFinite(tolerance)||tolerance<=0)throw Error('Invalid yarn tolerance');
 if(points.length<3)return points.slice();
 const keep=new Uint8Array(points.length),stack=[[0,points.length-1]];keep[0]=keep[points.length-1]=1;
 while(stack.length){const [a,b]=stack.pop(),A=points[a],B=points[b],v=sub(B,A),ll=v.reduce((s,x)=>s+x*x,0);let max=tolerance*tolerance,index=-1;for(let i=a+1;i<b;i++){const d=sub(points[i],A),t=ll?Math.max(0,Math.min(1,d.reduce((s,x,k)=>s+x*v[k],0)/ll)):0,q=d.reduce((s,x,k)=>s+(x-v[k]*t)**2,0);if(q>max){max=q;index=i;}}if(index>=0){keep[index]=1;stack.push([a,index],[index,b]);}}
 return points.filter((_,i)=>keep[i]);
}
export function yarnGeometry(path){const raw=simplifyPath(path.points.filter((p,i,a)=>!i||Math.hypot(...sub(p,a[i-1]))>1e-6)),p=[],n=[],uv=[],ix=[],sides=8,d=path.diameter||.32;let previous=new T.Vector3(...(path.normalHint||[0,1,0])),length=0;
 for(let i=0;i<raw.length;i++){const q=new T.Vector3(...raw[i]),t=new T.Vector3(...raw[Math.min(i+1,raw.length-1)]).sub(new T.Vector3(...raw[Math.max(0,i-1)])).normalize();let N=previous.clone().addScaledVector(t,-previous.dot(t));if(N.lengthSq()<1e-8){N.set(1,0,0).addScaledVector(t,-t.x);if(N.lengthSq()<1e-8)N.set(0,0,1).addScaledVector(t,-t.z);}N.normalize();previous=N;const B=new T.Vector3().crossVectors(t,N).normalize();if(i)length+=q.distanceTo(new T.Vector3(...raw[i-1]));for(let j=0;j<=sides;j++){const a=j/sides*Math.PI*2,twist=1+.025*Math.cos(3*a-length/d*2.4);p.push(...q.clone().addScaledVector(N,Math.cos(a)*d*.215*twist).addScaledVector(B,Math.sin(a)*d*.52*twist));n.push(...N.clone().multiplyScalar(Math.cos(a)/.215).addScaledVector(B,Math.sin(a)/.52).normalize());uv.push(length/(d*2.7),j/sides);if(i&&j<sides){const k=(i-1)*(sides+1)+j;ix.push(k,k+1,k+sides+1,k+1,k+sides+2,k+sides+1);}}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('normal',new T.Float32BufferAttribute(n,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);g.userData={source:'R10 / R05 saddle topology and R08 flattened waxed yarn cross-section',continuous:true,inputPoints:path.points.length,renderPoints:raw.length,maxCenterlineToleranceMm:.006};return g;}
