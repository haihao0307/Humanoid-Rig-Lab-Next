import {edgeTable,triTable} from './vendor/marching-cubes-tables.mjs';
// Regenerate geometry from fitted cosine-function coefficients. Source mesh
// vertices and triangle connectivity are never stored in the runtime package.
export function evaluateBoneField(bone, coefficients, requestedGrid=bone.grid){
 const [nx,ny,nz]=bone.modes,[gx,gy,gz]=requestedGrid;
 if(![nx,ny,nz,gx,gy,gz].every(v=>Number.isInteger(v)&&v>=2&&v<=256))throw Error('Invalid anatomical field dimensions');
 const offset=bone.coefficientOffset||0,count=nx*ny*nz;
 if(offset+count>coefficients.length||!(bone.quantScaleMm>0))throw Error('Invalid anatomical coefficients');
 if(gx<=nx&&gy<=ny&&gz<=nz&&[gx,gy,gz].every(n=>(n&(n-1))===0))return fastField(bone,coefficients,requestedGrid);
 const table=(g,n)=>{const a=new Float64Array(g*n);for(let i=0;i<g;i++)for(let k=0;k<n;k++)a[i*n+k]=Math.cos(Math.PI*k*(i+.5)/g);return a;};
 const cx=table(gx,nx),cy=table(gy,ny),cz=table(gz,nz);
 const xpass=new Float64Array(gx*ny*nz),ypass=new Float64Array(gx*gy*nz),values=new Float64Array(gx*gy*gz);
 for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<gx;x++){let sum=0;const at=offset+(z*ny+y)*nx;for(let k=0;k<nx;k++)sum+=coefficients[at+k]*cx[x*nx+k];xpass[(z*ny+y)*gx+x]=sum*bone.quantScaleMm;}
 for(let z=0;z<nz;z++)for(let y=0;y<gy;y++)for(let x=0;x<gx;x++){let sum=0;for(let k=0;k<ny;k++)sum+=xpass[(z*ny+k)*gx+x]*cy[y*ny+k];ypass[(z*gy+y)*gx+x]=sum;}
 for(let z=0;z<gz;z++)for(let y=0;y<gy;y++)for(let x=0;x<gx;x++){let sum=0;for(let k=0;k<nz;k++)sum+=ypass[(k*gy+y)*gx+x]*cz[z*nz+k];values[(z*gy+y)*gx+x]=sum-(bone.isoMm||0);}
 return {values,grid:[gx,gy,gz],min:bone.domainMinMm,max:bone.domainMaxMm};
}

function inverseCosine(line,n,real,imag){
 const size=n*2;real.fill(0,0,size);imag.fill(0,0,size);real[0]=line[0]*2;
 for(let k=1;k<n;k++){const a=Math.PI*k/size,r=line[k]*Math.cos(a),v=line[k]*Math.sin(a);real[k]=r;imag[k]=v;real[size-k]=r;imag[size-k]=-v;}
 for(let i=1,j=0;i<size;i++){let bit=size>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){[real[i],real[j]]=[real[j],real[i]];[imag[i],imag[j]]=[imag[j],imag[i]];}}
 for(let len=2;len<=size;len*=2){const a=2*Math.PI/len,ur=Math.cos(a),ui=Math.sin(a);for(let i=0;i<size;i+=len){let wr=1,wi=0;for(let j=0;j<len/2;j++){const p=i+j,q=p+len/2,tr=wr*real[q]-wi*imag[q],ti=wr*imag[q]+wi*real[q],ar=real[p],ai=imag[p];real[p]=ar+tr;imag[p]=ai+ti;real[q]=ar-tr;imag[q]=ai-ti;const next=wr*ur-wi*ui;wi=wr*ui+wi*ur;wr=next;}}}
 for(let i=0;i<n;i++)line[i]=real[i]*.5;
}
function fastField(bone,coefficients,grid=bone.grid){
 const [nx,ny,nz]=grid,total=nx*ny*nz,values=new Float64Array(total),line=new Float64Array(Math.max(nx,ny,nz)),real=new Float64Array(line.length*2),imag=new Float64Array(real.length),start=bone.coefficientOffset||0;
 for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++)values[(z*ny+y)*nx+x]=coefficients[start+(z*bone.modes[1]+y)*bone.modes[0]+x]*bone.quantScaleMm;
 for(let z=0;z<nz;z++)for(let y=0;y<ny;y++){const offset=(z*ny+y)*nx;for(let x=0;x<nx;x++)line[x]=values[offset+x];inverseCosine(line,nx,real,imag);for(let x=0;x<nx;x++)values[offset+x]=line[x];}
 for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){for(let y=0;y<ny;y++)line[y]=values[(z*ny+y)*nx+x];inverseCosine(line,ny,real,imag);for(let y=0;y<ny;y++)values[(z*ny+y)*nx+x]=line[y];}
 for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){for(let z=0;z<nz;z++)line[z]=values[(z*ny+y)*nx+x];inverseCosine(line,nz,real,imag);for(let z=0;z<nz;z++)values[(z*ny+y)*nx+x]=line[z]-(bone.isoMm||0);}
 return {values,grid:[nx,ny,nz],min:bone.domainMinMm,max:bone.domainMaxMm};
}

const EDGES=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
const CORNERS=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
// Isosurface extraction preserves disconnected structures and holes that a
// single radial bone profile cannot represent. Topology is tested separately.
export function contourBoneField(bone,field){
 const {values,grid:[nx,ny,nz],min,max}=field,step=min.map((_,i)=>(max[i]-min[i])/field.grid[i]);
 const gradients=new Float32Array(values.length*3),at=(x,y,z)=>(z*ny+y)*nx+x;
 for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
  const k=at(x,y,z)*3;gradients[k]=(values[at(Math.min(x+1,nx-1),y,z)]-values[at(Math.max(0,x-1),y,z)])/((x===0||x===nx-1?1:2)*step[0]);
  gradients[k+1]=(values[at(x,Math.min(y+1,ny-1),z)]-values[at(x,Math.max(0,y-1),z)])/((y===0||y===ny-1?1:2)*step[1]);
  gradients[k+2]=(values[at(x,y,Math.min(z+1,nz-1))]-values[at(x,y,Math.max(0,z-1))])/((z===0||z===nz-1?1:2)*step[2]);
 }
 const positions=[],normals=[],indices=[],edgeCache=new Map(),basis=bone.basisAxes,origin=bone.originMm;
 function edge(a,b){const key=Math.min(a.id,b.id)*values.length+Math.max(a.id,b.id);if(edgeCache.has(key))return edgeCache.get(key);const t=a.d/(a.d-b.d),p=a.p.map((v,k)=>v+t*(b.p[k]-v)),n=a.n.map((v,k)=>v+t*(b.n[k]-v)),point={p,n,index:positions.length/3};const world=origin.map((o,k)=>o+p.reduce((s,q,j)=>s+q*basis[j][k],0)),normal=[0,1,2].map(k=>n.reduce((s,q,j)=>s+q*basis[j][k],0)),len=Math.hypot(...normal)||1;positions.push(world[0]*.001,world[2]*.001,-world[1]*.001);normals.push(normal[0]/len,normal[2]/len,-normal[1]/len);edgeCache.set(key,point);return point;}
 function triangle(a,b,c){const u=b.p.map((v,k)=>v-a.p[k]),v=c.p.map((q,k)=>q-a.p[k]),cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],ng=a.n.map((q,k)=>q+b.n[k]+c.n[k]);
  if(cross.reduce((s,q,k)=>s+q*ng[k],0)<0)[b,c]=[c,b];
  indices.push(a.index,b.index,c.index);
 }
 for(let z=0;z<nz-1;z++)for(let y=0;y<ny-1;y++)for(let x=0;x<nx-1;x++){
  const ids=CORNERS.map(c=>at(x+c[0],y+c[1],z+c[2]));let negative=0;for(const i of ids)if(values[i]<0)negative++;if(negative===0||negative===8)continue;
  const points=CORNERS.map((c,i)=>({id:ids[i],d:values[ids[i]],p:c.map((v,k)=>min[k]+([x,y,z][k]+v+.5)*step[k]),n:Array.from(gradients.subarray(ids[i]*3,ids[i]*3+3))}));
  let mask=0;for(let i=0;i<8;i++)if(points[i].d<0)mask|=1<<i;// Match the positive-corner convention used by the offline VTK verifier.
  mask=255-mask;const flags=edgeTable[mask],edges=new Array(12);for(let i=0;i<12;i++)if(flags&(1<<i))edges[i]=edge(points[EDGES[i][0]],points[EDGES[i][1]]);
  const row=mask*16;for(let i=0;triTable[row+i]!==-1;i+=3)triangle(edges[triTable[row+i]],edges[triTable[row+i+1]],edges[triTable[row+i+2]]);

 }
 if(!positions.length||positions.some(v=>!Number.isFinite(v)))throw Error('Empty or non-finite bone field: '+bone.id);
 return {positions:new Float32Array(positions),normals:new Float32Array(normals),indices:new Uint32Array(indices),triangles:indices.length/3};
}

export function generateAnatomicalBone(bone,coefficients,grid){return contourBoneField(bone,evaluateBoneField(bone,coefficients,grid));}

export function selectAnatomicalLOD(bone){
 const source=bone.sourceTopology,allowed=(bone.lods||[]).filter(l=>!l.empty&&l.topology.components===source.components&&l.topology.euler===source.euler&&l.topology.boundaryEdges===0&&l.topology.nonManifoldEdges===0&&l.metrics.sourceAreaToContour.p95<=.65&&l.metrics.sourceVerticesToContour.p95<=1.5&&l.metrics.sourceAreaWithin2MmFraction>=.995&&l.metrics.volumeRatio>=.9&&l.metrics.volumeRatio<=1.1);
 return allowed.sort((a,b)=>a.topology.triangles-b.topology.triangles)[0]||{grid:bone.grid,metrics:bone.metrics,topology:bone.contourTopology,full:true};
}
