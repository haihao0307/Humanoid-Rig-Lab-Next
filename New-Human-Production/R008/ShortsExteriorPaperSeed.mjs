import * as THREE from 'three';
import {compilePaperSurfaceModel,evaluatePaperSurface} from './ShortsPaperSurfaceModel.mjs';
// Nine independent proper planar embeddings outside the current skin bounds.
// No premature source seam averaging or already-folded closed tube.
export function createShortsExteriorPaperSeed(draft,tapes,measuredBody,bare){
 if(draft.pieces.length!==9||draft.sourceUV.length!==1106||tapes.bodyToken!==draft.receipt.measurementsAuthority.bodyToken)throw Error('Exterior source/body authority mismatch');
 const p=new THREE.Vector3(),inverse=tapes.inverseFrame,native=measuredBody.positions,worldBare=bare.queryAPI.positions,min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];let examined=0;
 const include=(a,offset)=>{p.fromArray(a,offset).applyMatrix4(inverse);for(let k=0;k<3;k++){const v=p.getComponent(k);if(!Number.isFinite(v))throw Error('Nonfinite current skin bounds');min[k]=Math.min(min[k],v);max[k]=Math.max(max[k],v);}examined++;};
 for(const id of measuredBody.activeVertexIds)include(native,3*id);for(let i=0;i<worldBare.length;i+=3)include(worldBare,i);
 if(!examined||!min.every(Number.isFinite)||!max.every(Number.isFinite))throw Error('Current skin exterior bounds missing');
 const positions=new Float64Array(draft.positions.length),range=new Map(draft.ranges.map(r=>[r.pieceId,r])),pieces=new Map(draft.pieces.map(p=>[p.id,p])),cx=tapes.waist.lower.centerX,pad=.02,front=max[2]+pad,back=min[2]-pad;
 for(const piece of draft.pieces){const offset=range.get(piece.id).offset;let z=front,x0=cx,y0=draft.receipt.lowerY,uSign=1,uv0=[0,0];
  if(piece.kind==='leg-panel')z=piece.bodySide==='front'?front:back;
  else if(piece.kind==='waistband'){const main=pieces.get(piece.parentPanel),start=main.materialCoordinates[main.boundaries.waist[0]],end=main.materialCoordinates[main.boundaries.waist.at(-1)];z=main.bodySide==='front'?front:back;x0+=start[0];y0-=start[1];uSign=Math.sign(end[0]-start[0]);uv0=piece.materialCoordinates[piece.boundaries.lower[0]];if(!uSign)throw Error('Degenerate source waistband holding frame');}
  else if(piece.id==='G'){y0=draft.receipt.initialG.center[1];}
  else throw Error('Unknown independent paper piece');
  piece.materialCoordinates.forEach((uv,i)=>positions.set([x0+uSign*(uv[0]-uv0[0]),y0-(uv[1]-uv0[1]),z],3*(offset+i)));
 }
 const map=Array.from({length:positions.length/3},(_,i)=>i),xyz=map.map(i=>Array.from(positions.slice(i*3,i*3+3))),metric=evaluatePaperSurface(compilePaperSurfaceModel(draft),xyz,map);
 if(!metric.finite||metric.maximumPrincipalStrain>1e-9||metric.degenerateSurfaceTriangles!==0)throw Error('Independent exterior planes are not source isometries');
 return{draft:{...draft,positions,activeSeamIDs:[],quotientMap:Uint32Array.from(map)},positions:xyz,sourceToDof:map,receipt:{currentBodyToken:tapes.bodyToken,currentActorLocalBounds:{min,max,examined,scope:'all current native and bare skin vertices; no fixed adult height band'},frontPlaneZ:front,backPlaneZ:back,holdingPadM:pad,sourcePrincipalStrain:metric.maximumPrincipalStrain,sourceMassUVRestUnchanged:true,activeSeams:0,allSeamsPending:19,properSourcePlaneEmbeddings:true,allTriangleContactNotYetCertified:true,wearingAccepted:false}};
}
