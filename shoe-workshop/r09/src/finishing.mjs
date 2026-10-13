import * as T from 'three';
import {add,sub,mul,unit,cross,dist,resample,SeamField,clamp} from '../../r07/src/geometry.mjs';
import {MeshRay} from '../../r07/src/ray.mjs';
/** Edge coating belongs to the actual existing cut walls and their adjoining
 * grain, not a floating tube. The mask excludes sewing punctures. */
export function applyEdgeFinish(model,part,state){
 const g=part.geometry;if(g.userData.craftEdgeFinish)return;
 const D=model.domains[part.id],field=new SeamField(),piece=model.pieces.get(part.id),loop=D?.loop||piece.footprints[0].outer,holes=D?.sourceHoles||piece.footprints[0].holes;
 const at=D?(q=>D.at(q).p):(q=>model.maps[part.id](...q).p);
 for(const source of [loop,...holes]){const curve=resample(source,at,.7,true);for(let i=0;i<curve.length;i++)field.put(at(curve[i]),at(curve[(i+1)%curve.length]));}
 const n=g.userData.vertexPairs,logical=g.userData.logicalIndices,mask=new Float32Array(g.attributes.position.count),values=new Float32Array(n);
 for(let i=0;i<n;i++){
  let q=g.userData.template.vertices[i];if(state.view==='flat'&&D)q=D.fromRest(q);
  const d=field.sample(at(q)).distance;values[i]=Math.max(0,1-d/.85);
 }
 for(let i=0;i<mask.length;i++)mask[i]=values[logical[i]%n];
 g.setAttribute('craftEdge',new T.Float32BufferAttribute(mask,1));
 g.userData.craftEdgeFinish={allCutWalls:true,sourceEyeletWalls:true,stitchedAperturesCoated:false,process:'R10 cut/flesh/grain roles retained; R09 burnished wax edge and narrow rolled-look grain lip',widthMm:.85,geometryCover:false};
}
function geometry(positions,indices){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;}
/** A formed double-flange grommet surrounds each existing real cut-out. The bore
 * remains hollow; outer flange, sleeve and inner rolled return are connected. */
export function createHardware(model,state){
 if(state.view==='flat')return [];
 const out=[];
 for(const id of [22,23])for(const [index,source]of model.domains[id].sourceHoles.entries()){
  const D=model.domains[id],ring=resample(source,q=>D.at(q).p,.40,true),center=[0,1].map(k=>source.reduce((a,q)=>a+q[k],0)/source.length);
  const profile=[[.97,'outer',.10],[1.00,'outer',.42],[1.25,'outer',.46],[1.45,'outer',.14],[1.42,'outer',.025],[1.02,'outer',.015],[1.02,'inner',-.015],[1.38,'inner',-.07],[1.35,'inner',-.29],[.97,'inner',-.25]],p=[],idx=[],count=ring.length;
  for(const [factor,side,height]of profile)for(const q of ring){
   const f=Math.max(1.0005,factor),v=q.map((x,k)=>center[k]+(x-center[k])*f),h=model.sample(id,v,state);let point=h[side];
   if(factor<1){const d=sub(D.at(q).p,D.at(center).p),radial=sub(d,mul(h.n,d.reduce((v,x,k)=>v+x*h.n[k],0)));point=add(point,mul(radial,factor-f));}
   p.push(...add(point,mul(h.n,height)));
  }
  for(let j=0;j<profile.length;j++)for(let i=0;i<count;i++){const a=j*count+i,b=j*count+(i+1)%count,c=((j+1)%profile.length)*count+i,d=((j+1)%profile.length)*count+(i+1)%count;idx.push(a,b,c,b,d,c);}
  const g=geometry(p,idx);g.userData={construction:'connected outer flange / hollow sleeve / rolled inner flange',existingHole:true,closedBore:false,sourcePanel:id,sourceHole:index};out.push({id,index,kind:'eyelet',geometry:g});
 }
 return out;
}
/** Procedural low rubber grip ribs, individually seated to the native underside.
 * The original solid is retained, no borrowed outsole or displaced wallpaper. */
export function createSoleTread(sole){
 const ray=new MeshRay({positions:Array.from(sole.attributes.position.array),indices:Array.from(sole.index.array)}),positions=[],indices=[],ribs=[];
 const addRib=(A,B,width)=>{
  const tangent=unit([B[0]-A[0],0,B[1]-A[1]]),side=[-tangent[2],0,tangent[0]],outline=[];
  for(let i=0;i<=8;i++){const a=-Math.PI/2+i*Math.PI/8;outline.push([B[0]+width*.5*(tangent[0]*Math.cos(a)+side[0]*Math.sin(a)),B[1]+width*.5*(tangent[2]*Math.cos(a)+side[2]*Math.sin(a))]);}
  for(let i=0;i<=8;i++){const a=Math.PI/2+i*Math.PI/8;outline.push([A[0]+width*.5*(tangent[0]*Math.cos(a)+side[0]*Math.sin(a)),A[1]+width*.5*(tangent[2]*Math.cos(a)+side[2]*Math.sin(a))]);}
  const center=[(A[0]+B[0])/2,(A[1]+B[1])/2],rings=[],n=outline.length;
  for(const [scale,depth]of [[1,0],[1,.28],[.85,.65]]){
   const ring=[];for(const q of outline){const x=center[0]+(q[0]-center[0])*scale,z=center[1]+(q[1]-center[1])*scale,h=ray.ray([x,-100,z],[0,1,0]);if(!h||Math.abs(h.n[1])<.72)return;ring.push([x,h.p[1]-depth,z]);}rings.push(ring);
  }
  const base=positions.length/3;rings.flat().forEach(p=>positions.push(...p));for(let j=0;j<2;j++)for(let i=0;i<n;i++){const a=base+j*n+i,b=base+j*n+(i+1)%n,c=a+n,d=b+n;indices.push(a,c,b,b,c,d);}for(let i=1;i<n-1;i++){indices.push(base,base+i+1,base+i);indices.push(base+2*n,base+2*n+i,base+2*n+i+1);}ribs.push({A,B,heightMm:.65,allFootprintSamplesOnNativeSole:true});
 };
 for(const z of [23,34,45,56,67,78,89,100])for(const sign of [-1,1])addRib([sign*2.5,z],[sign*(z>88?20:29),z+6],2.5);
 for(const z of [-113,-103,-93,-83])for(const sign of [-1,1])addRib([sign*2.5,z],[sign*18,z+4],2.8);
 const g=geometry(positions,indices);g.userData={ribs,gripRibCount:ribs.length,heightMm:.65,sourceUndersideSampled:true,tractionTested:false};return g;
}
