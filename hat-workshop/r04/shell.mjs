/* Real finite-thickness inner faces and boundary walls. No normal-map substitute.
 * Source topology seams are welded by original group ids for boundary classification. */
export function buildInnerShell(T,mesh,position,normal,thickness){
 const N=position.length/3,vertices=new Float32Array(N*6),normals=new Float32Array(N*6),uv=new Float32Array(N*4);
 for(let i=0;i<N;i++)for(let k=0;k<3;k++){vertices[i*3+k]=position[i*3+k];vertices[(N+i)*3+k]=position[i*3+k]-thickness*normal[i*3+k];normals[i*3+k]=normal[i*3+k];normals[(N+i)*3+k]=-normal[i*3+k];}
 uv.set(mesh.uv);uv.set(mesh.uv,N*2);
 const edges=new Map(),indices=[];for(let j=0;j<mesh.index.length;j+=3){const a=mesh.index[j],b=mesh.index[j+1],c=mesh.index[j+2];indices.push(N+c,N+b,N+a);for(const [u,v] of [[a,b],[b,c],[c,a]]){const x=mesh.groups[u],y=mesh.groups[v],key=x<y?x+':'+y:y+':'+x;const e=edges.get(key);if(e)e.count++;else edges.set(key,{u,v,count:1});}}
 let rimEdges=0;for(const {u,v,count} of edges.values())if(count===1){indices.push(u,v,N+v,u,N+v,N+u);rimEdges++;}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(vertices,3));g.setAttribute('normal',new T.BufferAttribute(normals,3));g.setAttribute('uv',new T.BufferAttribute(uv,2));g.setIndex(indices);g.computeBoundingBox();g.computeBoundingSphere();
 return {geometry:g,report:{materialThicknessMM:thickness*1000,innerVertices:N,innerTriangles:mesh.index.length/3,rimEdges,rimTriangles:rimEdges*2,offsetMethod:'actual inner points = outer points - normal × declared thickness',physicalMaterialCalibrated:false}};
}
