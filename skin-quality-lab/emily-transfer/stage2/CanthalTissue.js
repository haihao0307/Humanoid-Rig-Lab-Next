import * as THREE from 'three';
import {smooth} from './SectionField.js';
const lerp=THREE.MathUtils.lerp;
/** One indexed sheet with embedded caruncle, curved plica and recessed lake. */
function patch(name,U,V,reverse=false){
 const p=new Float32Array((U+1)*(V+1)*3),region=new Float32Array((U+1)*(V+1)),index=[];
 for(let i=0;i<U;i++)for(let j=0;j<V;j++){const k=i*(V+1)+j;index.push(k,k+1,k+V+1,k+1,k+V+2,k+V+1);}
 if(reverse)for(let i=0;i<index.length;i+=3)[index[i+1],index[i+2]]=[index[i+2],index[i+1]];
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setAttribute('tissueRegion',new THREE.BufferAttribute(region,1));g.setIndex(index);
 const mat=new THREE.MeshStandardMaterial({color:0xb0b0b0,roughness:1,metalness:0,envMapIntensity:0,side:THREE.DoubleSide});mat.userData.stage2=true;
 const mesh=new THREE.Mesh(g,mat);mesh.name=name;mesh.frustumCulled=false;return {mesh,U,V};
}
export function createCanthalTissue(rig,e){
 const medial=patch('ET09-shared-medial-lake-caruncle-plica-'+e.c.name,24,24,e.c.sign<0),lateral=patch('ET09-rounded-temporal-commissure-'+e.c.name,9,12,e.c.sign>0);
 rig.group.add(medial.mesh,lateral.mesh);return {medial,lateral};
}
export function updateCanthalTissue(rig,e,closure){
 const {section,lid,c}=e,I=lid.inside.geometry.attributes.position,A=lid.A,open=1-smooth(closure);
 let seams=0,minGap=Infinity,penetrations=0,nonfinite=0,caruncleRelief=0,plicaRelief=0,caruncleActual=0,plicaActual=0,lakeActual=0;rig._fittingEye=e;
 for(const [kind,patch] of [['medial',section.medial],['lateral',section.lateral]]){
  const {mesh,U,V}=patch,P=mesh.geometry.attributes.position,regions=mesh.geometry.attributes.tissueRegion;
  for(let i=0;i<=U;i++){
   const u=i/U,medial=kind==='medial',fromNasal=medial?i:A/2-i,topIndex=c.sign<0?fromNasal:A/2-fromNasal,bottomIndex=A-topIndex;
   const top=new THREE.Vector3(I.getX(topIndex),I.getY(topIndex),I.getZ(topIndex)),bottom=new THREE.Vector3(I.getX(bottomIndex),I.getY(bottomIndex),I.getZ(bottomIndex));
   for(let j=0;j<=V;j++){
    const v=j/V,k=i*(V+1)+j,edge=Math.pow(Math.sin(Math.PI*v),1.4);let x=lerp(top.x,bottom.x,v),y=lerp(top.y,bottom.y,v),z=lerp(top.z,bottom.z,v),zone=0;
    const attachmentZ=z;
    if(medial){
     // Use physical projected distance, not angular row number: the angular
     // grid compresses near the canthus and would squash both relief features.
     const q=(1-Math.cos(i/A*Math.PI*2))/(1-Math.cos(U/A*Math.PI*2));
     x-=c.sign*.00033*smooth(q)*Math.pow(Math.sin(Math.PI*v),1.25)*open;
     const front=rig.eyeFront(c,x,y),bank=smooth((q-.80)/.20)*Math.pow(Math.sin(Math.PI*v),.65)*open;
     if(front!==null)z=lerp(z,front+.000085,bank);
     const support=Math.pow(Math.sin(Math.PI*q),2)*edge*open;
     const recess=.00018*Math.exp(-Math.pow((q-.49)/.18,2))*support;
     const car=.00085*Math.exp(-Math.pow((q-.24)/.19,2)-Math.pow((v-.56)/.27,2))*support;
     const foldCentre=.64+.040*Math.sin(Math.PI*v),fold=.00065*Math.exp(-Math.pow((q-foldCentre)/.08,2))*support;
     z+=-recess+car+fold;zone=fold>car&&fold>.00003?3:car>.000025?2:1;
     caruncleRelief=Math.max(caruncleRelief,car);plicaRelief=Math.max(plicaRelief,fold);
    }else{z+=.000065*Math.sin(Math.PI*u)*edge*open;zone=4;}
    const front=rig.eyeFront(c,x,y);
    if(front!==null&&j>0&&j<V)z=Math.max(z,front+.000085);
    if(j===0){x=top.x;y=top.y;z=top.z;}if(j===V){x=bottom.x;y=bottom.y;z=bottom.z;}P.setXYZ(k,x,y,z);regions.setX(k,zone);
    if(medial&&v>.30&&v<.75){const q=(1-Math.cos(i/A*Math.PI*2))/(1-Math.cos(U/A*Math.PI*2)),offset=P.getZ(k)-attachmentZ;if(q>.10&&q<.42)caruncleActual=Math.max(caruncleActual,offset);if(q>.58&&q<.76)plicaActual=Math.max(plicaActual,offset);if(q>.43&&q<.56)lakeActual=Math.min(lakeActual,offset);}
    if(j===0||j===V){const target=j===0?top:bottom;seams=Math.max(seams,Math.hypot(P.getX(k)-target.x,P.getY(k)-target.y,P.getZ(k)-target.z));}
    if(![x,y,z].every(Number.isFinite))nonfinite++;if(front!==null){minGap=Math.min(minGap,z-front);if(z<front-1e-7)penetrations++;}
   }
  }
  P.needsUpdate=true;regions.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.visible=closure<.9999;
 }
 e.canthus.mesh.visible=false;
 section.canthalReport={maxAttachmentErrorMM:seams*1000,minimumGlobeGapMM:minGap*1000,penetratingVertices:penetrations,nonfiniteVertices:nonfinite,caruncleReliefMM:caruncleRelief*1000,plicaReliefMM:plicaRelief*1000,caruncleVsAttachmentPlaneMM:caruncleActual*1000,plicaVsAttachmentPlaneMM:plicaActual*1000,lakeRecessBelowAttachmentPlaneMM:lakeActual*1000,oneMedialIndexedSurface:true,independentCaruncleObject:false,temporalCommissure:true,medialTriangles:section.medial.mesh.geometry.index.count/3,lateralTriangles:section.lateral.mesh.geometry.index.count/3};rig._fittingEye=null;
}
