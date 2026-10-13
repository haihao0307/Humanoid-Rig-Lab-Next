import * as T from 'three';
import {add,sub,mul,mix,unit,cross,dist,clamp} from '../../r07/src/geometry.mjs';
/** Static 301-style needle/bobbin topology, not a calibrated sewing simulation.
 * One visible needle row; the bobbin stays on the inner side between holes.
 */
export function lockstitch301(stations,frame,diameter=.38){
 if(stations.length<2)return [];
 const make=kind=>({kind,points:[],normals:[],diameter,radiusMm:diameter/2,stitchType:'301',rows:1,physics:false,lockDepthFraction:.52}),needle=make('needle'),bobbin=make('bobbin'),lane=diameter*.075,relief=diameter*.27;
 const point=(u,fraction,normalOffset=0,side=0,tang=0)=>{const h=frame(u),N=unit(sub(h.outer,h.inner)),B=unit(cross(N,h.tangent));return {p:add(add(add(mix(h.inner,h.outer,fraction),mul(N,normalOffset)),mul(B,side)),mul(h.tangent,tang)),n:N};};
 const push=(path,v)=>{if(!path.points.length||dist(path.points.at(-1),v.p)>1e-6){path.points.push(v.p);path.normals.push(v.n);}};
 for(let i=0;i<stations.length;i++){
  const h=frame(i),stack=dist(h.outer,h.inner),lock=.52,fillet=lane/Math.max(stack,.3);
  for(let j=0;j<=8;j++){const t=j/8;push(needle,point(i,(1-.10/stack)*(1-t)+(lock+fillet)*t,0,-lane));}
  for(let j=1;j<=12;j++){const a=Math.PI*j/12;push(needle,point(i,lock+fillet-Math.sin(a)*fillet,0,-Math.cos(a)*lane));}
  for(let j=1;j<=8;j++){const t=j/8;push(needle,point(i,(lock+fillet)*(1-t)+(1-.10/stack)*t,0,lane));}
  for(let j=0;j<=8;j++){const t=j/8;push(bobbin,point(i,(.10/stack)*(1-t)+(lock+fillet*.45)*t,0,0,-lane*(1-t)));}
  for(let j=1;j<=8;j++){const t=j/8;push(bobbin,point(i,(lock+fillet*.45)*(1-t)+(.10/stack)*t,0,0,lane*t));}
  if(i===stations.length-1)break;
  const samples=Math.max(12,Math.ceil(dist(stations[i].outer,stations[i+1].outer)/.22));
  for(let j=1;j<=samples;j++){const t=j/samples,u=i+t,turn=clamp(Math.min(t,1-t)/.11),rise=Math.sin(turn*Math.PI/2),top=-.10+(.10+relief)*rise,bottom=.10-(.10+relief)*rise;
   push(needle,point(u,1,top,lane*(1-2*t)));push(bobbin,point(u,0,bottom,0,lane*(1-2*t)));
  }
 }
 return [needle,bobbin];
}
/** An explicitly skin-aligned flattened cross section prevents hidden U-turns
 * from rolling the next exposed stitch onto its wide axis and burying it.
 */
export function yarnGeometry(path){
 const points=path.points,normals=path.normals,p=[],ns=[],uv=[],indices=[],sides=8,d=path.diameter||.38;let travelled=0;
 for(let i=0;i<points.length;i++){
  const q=new T.Vector3(...points[i]),t=new T.Vector3(...points[Math.min(i+1,points.length-1)]).sub(new T.Vector3(...points[Math.max(0,i-1)])).normalize();
  let N=new T.Vector3(...(normals?.[i]||path.normalHint||[0,1,0]));N.addScaledVector(t,-N.dot(t));
  if(N.lengthSq()<1e-7){N.set(1,0,0).addScaledVector(t,-t.x);if(N.lengthSq()<1e-7)N.set(0,0,1).addScaledVector(t,-t.z);}N.normalize();const B=new T.Vector3().crossVectors(t,N).normalize();
  if(i)travelled+=q.distanceTo(new T.Vector3(...points[i-1]));
  for(let j=0;j<=sides;j++){const a=j/sides*Math.PI*2,ripple=1+.024*Math.sin(a*3-travelled/d*2.3);p.push(...q.clone().addScaledVector(N,Math.cos(a)*d*.215*ripple).addScaledVector(B,Math.sin(a)*d*.50*ripple));ns.push(...N.clone().multiplyScalar(Math.cos(a)/.215).addScaledVector(B,Math.sin(a)/.50).normalize());uv.push(travelled/(d*2.7),j/sides);if(i&&j<sides){const k=(i-1)*(sides+1)+j;indices.push(k,k+1,k+sides+1,k+1,k+sides+2,k+sides+1);}}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('normal',new T.Float32BufferAttribute(ns,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.userData={continuous:true,threadRole:path.kind,stitchType:301,rows:1,inputPoints:points.length,source:'R09 independently implemented explicit needle/bobbin centreline; R10 flattened spun cross-section proportions retained'};return g;
}
