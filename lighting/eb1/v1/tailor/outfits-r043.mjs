import{smoothSewnNormals}from'./sewn-normals-r0433.mjs';
/** Outfit identities resolve to two native material/solver records, never proxy shells. */
import{requirePerson,materialHash,facesOf,stable}from'./source-contract.mjs';
export function buildOutfits(rows){const tops=rows.filter(r=>r.category==='上装'),bottoms=rows.filter(r=>['裤装','半裙'].includes(r.category));return tops.flatMap(a=>bottoms.map(b=>({id:a.id+'-'+b.id,name:a.name+' ＋ '+b.name,members:[a.id,b.id],category:'上下装套系',jointClothCollisionCertified:false})));}
export async function verifyOutfitMembers(packets,person){
 if(packets.length!==2)throw Error('套系须有两件独立原生服装。');
 for(const p of packets){requirePerson(p.binding.person,person);if(await materialHash(p.spec)!==p.binding.materialSHA256)throw Error('套系成员材料身份不符。');if(p.record.positionsMm.length!==p.spec.panels.reduce((n,p)=>n+p.uvMm.length,0))throw Error('套系成员顶点数量不符。');if(!p.record.positionsMm.every(p=>p.length===3&&p.every(Number.isFinite)))throw Error('套系含无效求解坐标。');}
 return{members:packets.map(p=>({presetId:p.binding.presetId,recipeHash:p.binding.recipeHash,paperSHA256:p.binding.paperSHA256,materialSHA256:p.binding.materialSHA256,variantRequest:p.binding.parameterRequestSHA256||null,staticGatePassed:!!p.record.staticGate?.passed,complete:p.complete!==false})),sameOriginalPerson:true,originalCoordinates:true,jointClothCollisionCertified:false};
}
export function nativeGarmentMesh(THREE,packet,groundShiftM,{panelColors=false,wire=false}={}){
 const{spec,record}=packet,indices=facesOf(spec),p=new Float32Array(record.positionsMm.length*3);
 record.positionsMm.forEach((v,i)=>p.set([Math.fround(v[0]/1000),Math.fround(Math.fround(v[1]/1000)-groundShiftM),Math.fround(v[2]/1000)],i*3));
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingSphere();
 const mats=spec.panels.map((p,i)=>new THREE.MeshStandardMaterial({color:panelColors?[0xbbab8b,0x9ab5ac,0xc4a4a4,0xa1a8c6][i%4]:0xc6b591,roughness:.82,side:THREE.DoubleSide,wireframe:wire}));let offset=0;
 spec.panels.forEach((p,i)=>{g.addGroup(offset,p.triangles.length*3,i);offset+=p.triangles.length*3});const mesh=new THREE.Mesh(g,mats);mesh.name='native-outfit-member-'+packet.binding.presetId;
 mesh.userData={sewnNormalAudit:smoothSewnNormals(g,spec,record.activeSeams),binding:structuredClone(packet.binding),coordinateOffsetOnlyM:groundShiftM,sourceIndexSequenceUnchanged:stable(Array.from(g.index.array))===stable(indices),jointClothCollisionCertified:false};return mesh;
}
export function disposeGarment(mesh){mesh.geometry.dispose();for(const m of(Array.isArray(mesh.material)?mesh.material:[mesh.material]))m.dispose();}
