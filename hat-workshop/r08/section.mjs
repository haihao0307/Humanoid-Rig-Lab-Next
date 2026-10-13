/* x=0 cross sections of the actual outer/inner triangle prisms, not a painted line.
 * This is a visual inspection mesh only; it does not thicken or change the hat. */
export function materialSection(T,mesh,outer,inner,meta){
 const points=[],indices=[],N=outer.length/3,edges=[[0,1],[1,2],[2,0],[3,4],[4,5],[5,3],[0,3],[1,4],[2,5]];
 for(let j=0;j<mesh.index.length;j+=3){const ids=Array.from(mesh.index.slice(j,j+3));if(meta.id==='sherpa'){const y=ids.reduce((n,i)=>n+mesh.position[i*3+1]/3,0)-meta.origin[1];if(y<-.145||y>.113)continue;}
  const p=[...ids.map(i=>Array.from(outer.slice(i*3,i*3+3))),...ids.map(i=>Array.from(inner.slice((N+i)*3,(N+i)*3+3)))];if(Math.min(...p.map(v=>v[0]))>0||Math.max(...p.map(v=>v[0]))<0)continue;
  const cut=[];for(const [a,b] of edges){const d=p[b][0]-p[a][0];if(Math.abs(d)<1e-12)continue;const t=-p[a][0]/d;if(t>=0&&t<=1){const q=[0,p[a][1]+t*(p[b][1]-p[a][1]),p[a][2]+t*(p[b][2]-p[a][2])];if(!cut.some(v=>Math.hypot(v[1]-q[1],v[2]-q[2])<1e-8))cut.push(q);}}
  if(cut.length<3)continue;const cy=cut.reduce((s,p)=>s+p[1]/cut.length,0),cz=cut.reduce((s,p)=>s+p[2]/cut.length,0);cut.sort((a,b)=>Math.atan2(a[2]-cz,a[1]-cy)-Math.atan2(b[2]-cz,b[1]-cy));const base=points.length/3;for(const p of cut)points.push(...p);for(let k=1;k<cut.length-1;k++)indices.push(base,base+k,base+k+1);
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points,3));g.setIndex(indices);g.computeVertexNormals();const mat=new T.MeshStandardMaterial({color:0xc1a979,roughness:.96,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});const m=new T.Mesh(g,mat);m.name='Inspection: actual finite material at cut plane';m.visible=false;return m;
}
