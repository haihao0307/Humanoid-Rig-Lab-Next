import * as T from 'three';
import {mix,dist,sub,dot,cross} from './geometry.mjs';
/** Subdivide only original CAD triangles that cannot represent the prescribed deformation.
 * Every added point is an exact affine midpoint on an original face, never a new sole design.
 * Shared indexed edges are split once; parent IDs account for every original triangle.
 */
export function refineForDeformation(source,warp){
 const attrs=Object.fromEntries(Object.entries(source.attributes).filter(([,a])=>a.itemSize<=4).map(([k,a])=>[k,{size:a.itemSize,values:Array.from({length:a.count},(_,i)=>Array.from(a.array.slice(i*a.itemSize,(i+1)*a.itemSize)))}]));
 const vertices=attrs.position.values,nativeVertices=vertices.length,nativeIndices=Array.from(source.index.array),count=nativeIndices.length/3;
 let tris=Array.from({length:count},(_,i)=>({t:nativeIndices.slice(i*3,i*3+3),parent:i})),passes=0;const key=(a,b)=>a<b?a+','+b:b+','+a;
 for(let pass=0;pass<9;pass++){
  const mids=new Map(),checked=new Set();for(const {t}of tris)for(let k=0;k<3;k++){const i=t[k],j=t[(k+1)%3],K=key(i,j);if(checked.has(K))continue;checked.add(K);const a=vertices[i],b=vertices[j],m=mix(a,b,.5),wa=warp(a),wb=warp(b),wm=warp(m),error=dist(wm,mix(wa,wb,.5)),active=Math.max(dist(wa,a),dist(wb,b),dist(wm,m))>.02;
   if(error>.025||(active&&dist(a,b)>2.5)){mids.set(K,vertices.length);for(const v of Object.values(attrs))v.values.push(mix(v.values[i],v.values[j],.5));}
  }
  if(!mids.size)break;passes++;const next=[];
  for(const {t,parent}of tris){const[a,b,c]=t,m=[mids.get(key(a,b)),mids.get(key(b,c)),mids.get(key(c,a))],n=m.filter(x=>x!==undefined).length,push=(...rows)=>rows.forEach(t=>next.push({t,parent}));if(!n)push(t);else if(n===3)push([a,m[0],m[2]],[m[0],b,m[1]],[m[2],m[1],c],[m[0],m[1],m[2]]);else if(n===1){const j=m.findIndex(x=>x!==undefined),u=t[j],v=t[(j+1)%3],w=t[(j+2)%3],z=m[j];push([u,z,w],[z,v,w]);}else{const j=m.findIndex(x=>x===undefined),u=t[j],v=t[(j+1)%3],w=t[(j+2)%3],vw=m[(j+1)%3],wu=m[(j+2)%3];push([w,wu,vw],[u,v,vw],[u,vw,wu]);}}
  tris=next;if(vertices.length>170000)throw Error('Sole affine subdivision exceeds budget');
 }
 const g=new T.BufferGeometry();for(const[k,a]of Object.entries(attrs))g.setAttribute(k,new T.Float32BufferAttribute(a.values.flat(),a.size));g.setIndex(tris.flatMap(x=>x.t));g.normalizeNormals();
 const areas=new Float64Array(count);let reversed=0,maxRelativeAreaError=0;for(const {t,parent}of tris){const [a,b,c]=t.map(i=>vertices[i]),n=cross(sub(b,a),sub(c,a)),[A,B,C]=nativeIndices.slice(parent*3,parent*3+3).map(i=>vertices[i]),N=cross(sub(B,A),sub(C,A));areas[parent]+=Math.hypot(...n);if(dot(n,N)<-1e-12)reversed++;}
 for(let i=0;i<count;i++){const[A,B,C]=nativeIndices.slice(i*3,i*3+3).map(i=>vertices[i]),a=Math.hypot(...cross(sub(B,A),sub(C,A)));if(a>1e-10)maxRelativeAreaError=Math.max(maxRelativeAreaError,Math.abs(areas[i]-a)/a);}
 const edges=new Set();let maxMidpointError=0,edgesOverTolerance=0;for(const{t}of tris)for(let k=0;k<3;k++){const i=t[k],j=t[(k+1)%3],K=key(i,j);if(edges.has(K))continue;edges.add(K);const a=vertices[i],b=vertices[j],e=dist(warp(mix(a,b,.5)),mix(warp(a),warp(b),.5));maxMidpointError=Math.max(maxMidpointError,e);if(e>.03)edgesOverTolerance++;}
 if(reversed||maxRelativeAreaError>1e-6)throw Error('Sole source-triangle coverage changed');
 g.userData.affineSubdivision={nativeVertices,nativeTriangles:count,vertices:vertices.length,triangles:tris.length,passes,targetMidpointErrorMm:.025,allEdgesAtTarget:edgesOverTolerance===0,maxMidpointErrorMm:maxMidpointError,edgesOverTolerance,reversedSourceChildren:reversed,maxSourceAreaRelativeError:maxRelativeAreaError,sourceUnchanged:true,indexBufferUnchanged:false,method:'Conforming affine subdivision of the same native CAD triangle surfaces; no new silhouette or cover mesh; smooth warp evaluated on every generated vertex'};
 return g;
}
