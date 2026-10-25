/* Identical Float64 accumulation and Float32 writes from R26 fastRegion.
 * Only independent z slabs are scheduled separately. This does not improve
 * source-surface fidelity or turn the existing field into an accepted mother. */
(()=>{'use strict';
function create(input){
 const {positions,ns,baseline,support,inverseSkins,globalFit,localFit}=input,gridCell=.04;
 const key=(x,y,z)=>x+','+y+','+z,point=(a,i)=>[a[i*3],a[i*3+1],a[i*3+2]];
 const count=positions.length/3;if(!Number.isSafeInteger(count)||count<1||ns.length!==positions.length||baseline.length!==positions.length||support.length!==count||inverseSkins.length!==count||globalFit.values.length!==count||localFit.values.length!==count)throw Error('Field sampler input dimensions differ');
 const map=new Map,cells=new Map;for(let i=0;i<count;i++){const k=key(...point(positions,i).map(x=>Math.floor(x/gridCell)));if(!map.has(k))map.set(k,[]);map.get(k).push(i);}
 function candidates(x,y,z){const k=key(x,y,z);if(cells.has(k))return cells.get(k);const ids=[];for(let dz=-1;dz<=1;dz++)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const v=map.get(key(x+dx,y+dy,z+dz));if(v)ids.push(...v);}cells.set(k,ids);return ids;}
 function region(box,spacing,maximum,isLocal,first=0,last=null){
  const size=box.map(b=>b[1]-b[0]),dimensions=size.map(x=>Math.min(maximum,Math.max(12,Math.ceil(x/spacing)))),field=new Float32Array(dimensions[0]*dimensions[1]*((last??dimensions[2])-first)*4),normalField=isLocal?null:new Float32Array(field.length),nearestSamples=null,nx=dimensions[0],ny=dimensions[1],nz=dimensions[2],xs=Float64Array.from({length:nx},(_,i)=>box[0][0]+(i+.5)*size[0]/nx),ys=Float64Array.from({length:ny},(_,i)=>box[1][0]+(i+.5)*size[1]/ny),zs=Float64Array.from({length:nz},(_,i)=>box[2][0]+(i+.5)*size[2]/nz);let tested=0;
  for(let z=first;z<(last??nz);z++){const pz=zs[z],cz=Math.floor(pz/gridCell);for(let y=0;y<ny;y++){const py=ys[y],cy=Math.floor(py/gridCell);let cachedX=Infinity,ids;
   for(let x=0;x<nx;x++){const px=xs[x],cx=Math.floor(px/gridCell);if(cx!==cachedX){ids=candidates(cx,cy,cz);cachedX=cx;}let nearest=-1,min=Infinity;
    for(let j=0;j<ids.length;j++){const i=ids[j]*3,dx=px-positions[i],dy=py-positions[i+1],dz=pz-positions[i+2],d=dx*dx+dy*dy+dz*dz;if(d<min){nearest=ids[j];min=d;}}
    let distance=.035,mx=px,my=py,mz=pz,normalX=0,normalY=0,normalZ=0;
    if(nearest>=0&&min<.0036*1*1){const nk=nearest*3,nnx=ns[nk],nny=ns[nk+1],nnz=ns[nk+2],h=isLocal?support[nearest]:.035*1,variance=isLocal?h*h*.6:.0004;let sum=0,value=0,rx=0,ry=0,rz=0;
     for(let j=0;j<ids.length;j++){const i=ids[j],k=i*3,dx=px-positions[k],dy=py-positions[k+1],dz=pz-positions[k+2],d=dx*dx+dy*dy+dz*dz;if(d>min+variance*6)continue;const snx=ns[k],sny=ns[k+1],snz=ns[k+2];if(snx*nnx+sny*nny+snz*nnz<.35)continue;const weight=Math.exp(-d/variance),inv=inverseSkins[i];sum+=weight;normalX+=weight*snx;normalY+=weight*sny;normalZ+=weight*snz;value+=weight*(snx*dx+sny*dy+snz*dz+(isLocal?localFit.values[i]:globalFit.values[i]));rx+=weight*(baseline[k]+inv[0]*dx+inv[2]*dy-inv[1]*dz);ry+=weight*(baseline[k+2]+inv[8]*dx+inv[10]*dy-inv[9]*dz);rz+=weight*(-baseline[k+1]-inv[4]*dx-inv[6]*dy+inv[5]*dz);}
     if(sum>1e-20){distance=Math.max(value/sum,Math.sqrt(min)-h);mx=rx/sum;my=ry/sum;mz=rz/sum;const length=Math.hypot(normalX,normalY,normalZ)||1;normalX/=length;normalY/=length;normalZ/=length;}tested++;
    }
    const at=(x+nx*(y+ny*(z-first)))*4;if(nearestSamples)nearestSamples[at/4]=nearest<0?65535:nearest;field[at]=distance;field[at+1]=mx;field[at+2]=my;field[at+3]=mz;if(normalField){normalField[at]=normalX;normalField[at+1]=normalY;normalField[at+2]=normalZ;normalField[at+3]=1;}
   }
  }}return{field,normalField,bounds:box,dimensions,tested,first,last:last??nz};
 }
return{region};}
globalThis.BodyFieldSamplerR27={create};
})();
