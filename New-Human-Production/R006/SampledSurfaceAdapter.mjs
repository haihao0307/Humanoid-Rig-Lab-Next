import * as THREE from 'three';
import {buildCompactBinding,bindCompactArrays,collectCompactSupport,COMPACT_INFLUENCES,COMPACT_WEIGHT_SCALE} from '../../reconstruction/binding.mjs';
import {partMembership} from './SurfaceMembership.mjs';

export function canonicalSource(root,heightM=1.8){
  root.updateMatrixWorld(true);const inverse=root.matrixWorld.clone().invert(),rotation=new THREE.Matrix4().makeRotationX(-Math.PI/2),box=new THREE.Box3(),rows=[];
  root.traverse(o=>{if(!o.isMesh||!o.geometry?.attributes.position)return;const geometry=o.geometry.clone().applyMatrix4(rotation.clone().multiply(inverse.clone().multiply(o.matrixWorld)));geometry.computeBoundingBox();box.union(geometry.boundingBox);rows.push({name:o.name,geometry,material:o.material});});
  if(rows.length!==31)throw Error('Source surface part identity changed');
  const sourceHeight=box.max.y-box.min.y,scale=heightM/sourceHeight,centreX=(box.max.x+box.min.x)/2,centreZ=(box.max.z+box.min.z)/2;
  const align=new THREE.Matrix4().makeScale(scale,scale,scale).multiply(new THREE.Matrix4().makeTranslation(-centreX,-box.min.y,-centreZ));
  for(const row of rows)row.geometry.applyMatrix4(align);
  return {rows,sourceHeight,heightM,scale,coordinates:'source +Z -> up, -Y -> anterior; renderer X reflected into rig only'};
}

export async function bindSampledSurface(canonical,core,human,progress=()=>{}){
  const rig=core.compactSourceRig(human),roots=[],rootByPosition=new Map(),meshes=[];
  // Exact shared positions share a root and a single encoded row. UV/normals
  // remain on their original draw vertices; no arbitrary proximity welding.
  for(let rowIndex=0;rowIndex<canonical.rows.length;rowIndex++){
    const row=canonical.rows[rowIndex],p=row.geometry.attributes.position,count=p.count,membership=partMembership(row.name);
    const positions=new Float32Array(count*3),vertexIds=new Uint32Array(count),masks=new Uint16Array(count).fill(membership.mask);
    for(let i=0;i<count;i++){
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i),key=x+','+y+','+z;
      let id=rootByPosition.get(key);if(id===undefined){id=roots.length;rootByPosition.set(key,id);roots.push(id);}
      vertexIds[i]=id;positions.set([x,y,z],i*3);
    }
    const indices=row.geometry.index?Uint32Array.from(row.geometry.index.array):Uint32Array.from({length:count},(_,i)=>i);
    meshes.push({name:'skin',sourceName:row.name,positions,indices,vertexIds,regionMasks:masks,vertices:count});
    progress({phase:'roots',part:rowIndex+1,total:canonical.rows.length});await new Promise(r=>setTimeout(r,0));
  }
  const data={meshes,bindingRoots:Uint32Array.from(roots)};rootByPosition.clear();
  const field=buildCompactBinding(data,rig,progress),bindings=meshes.map(m=>bindCompactArrays(m,rig,field));
  let rigidHandVertices=0,crossSideInfluences=0;
  // The source fingers are partly fused material islands and bent at rest.
  // Keep the exact source hand shape rigid to its anatomical wrist until each
  // individual finger chain is separately fitted. No guessed phalange weights.
  for(let k=0;k<meshes.length;k++)if(meshes[k].regionMasks[0]&(256|512)){
    const side=meshes[k].regionMasks[0]&256?'left':'right',id=rig.jointIds.get(side+'_hand'),b=bindings[k];
    for(let i=0;i<meshes[k].vertices;i++){const at=i*COMPACT_INFLUENCES;b.ids.fill(id,at,at+8);b.weights.fill(0,at,at+8);b.weights[at]=COMPACT_WEIGHT_SCALE;rigidHandVertices++;}
  }
  const candidates=new Map();for(let i=0;i<meshes.length;i++)collectCompactSupport(meshes[i],bindings[i],rig,candidates);
  for(let k=0;k<meshes.length;k++){
    const mask=meshes[k].regionMasks[0],b=bindings[k],side=mask&(16|64|256|1024)?'left':mask&(32|128|512|2048)?'right':null;
    if(!side)continue;for(let i=0;i<b.ids.length;i++)if(b.weights[i]&&rig.jointNames[b.ids[i]].startsWith((side==='left'?'right':'left')+'_'))crossSideInfluences++;
  }
  if(crossSideInfluences)throw Error('Cross-side binding ownership failed: '+crossSideInfluences);
  return {rig,data,field,bindings,supportProbes:[...candidates.values()].map(x=>x.probe),report:{...field.report,vertices:meshes.reduce((n,m)=>n+m.vertices,0),crossSideInfluences,rigidHandVertices,handPolicy:'rigid wrist; finger articulation pending',surfaceOwnership:'reviewed source parts + inherited anatomical constraints',graphWelding:'exact-position shared roots',visualAcceptance:false}};
}
