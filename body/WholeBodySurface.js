/* Shared deformation of generated skin and its inset layers. */
function wholeBodySmoothPositions(input,cache,passes,amount=.5){
 let a=new Float32Array(input),b=new Float32Array(a.length);
 const {offsets,neighbors}=cache;
 for(let step=0;step<passes;step++){
  for(let v=0;v<offsets.length-1;v++){
   let x=0,y=0,z=0;const start=offsets[v],end=offsets[v+1],k=v*3;
   for(let e=start;e<end;e++){const q=neighbors[e]*3;x+=a[q];y+=a[q+1];z+=a[q+2];}
   const n=end-start||1;b[k]=a[k]+amount*(x/n-a[k]);b[k+1]=a[k+1]+amount*(y/n-a[k+1]);b[k+2]=a[k+2]+amount*(z/n-a[k+2]);
  }
  const swap=a;a=b;b=swap;
 }
 return a;
}
function prepareWholeBodySurface(tissue,g){
 const count=g.p.length/3,ids=Uint32Array.from({length:count},(_,i)=>i),map=Int32Array.from(ids);
 const adjacent=Array.from({length:count},()=>new Set());
 for(let e=0;e<g.i.length;e+=3){const [a,b,c]=g.i.subarray(e,e+3);adjacent[a].add(b).add(c);adjacent[b].add(a).add(c);adjacent[c].add(a).add(b);}
 const offsets=new Uint32Array(count+1);for(let v=0;v<count;v++)offsets[v+1]=offsets[v]+adjacent[v].size;
 const neighbors=new Uint32Array(offsets[count]);for(let v=0;v<count;v++)neighbors.set([...adjacent[v]],offsets[v]);
 const adjacency={offsets,neighbors};let clean=g.p.slice();
 for(let step=0;step<4;step++){clean=wholeBodySmoothPositions(clean,adjacency,1,.42);clean=wholeBodySmoothPositions(clean,adjacency,1,-.44);}
 for(let v=0;v<count;v++){const k=v*3,distance=Math.hypot(clean[k]-g.p[k],clean[k+1]-g.p[k+1],clean[k+2]-g.p[k+2]),ratio=Math.min(1,g.skinLayerField.fairing[v]/Math.max(distance,1e-9));for(let c=0;c<3;c++)g.p[k+c]+=(clean[k+c]-g.p[k+c])*ratio;}
 g.n=wholeBodyNormals(g.p,g.i);
 const cache={ids,map,faces:g.i,palette:null,revision:0,rest:g.p.slice(),posed:new Float32Array(g.p.length),support:g.structureData.slice(),time:null};
 g.renderP=g.p.slice();g.renderN=g.n.slice();g.surfaceRest=g.p;g.surfaceCache=cache;
 for(let v=0;v<count;v++)g.structureData[v*4+3]=-1;
 tissue.surfaceCorrectionReport={method:'generated rest surface, shared CPU dual quaternion deformation and inward skin boundaries',externalMeshes:0};
 return cache;
}
function updateWholeBodySurface(tissue){
 const g=tissue?.skin?.g,cache=g?.surfaceCache;if(!cache)return false;
 const palette=tissue.jointPalette;
 if(cache.palette&&cache.time===tissue.time&&palette.every((v,i)=>Math.abs(v-cache.palette[i])<1e-7)&&cache.muscles.every((v,i)=>v===tissue.musclePalette[i]))return false;
 cache.time=tissue.time;cache.muscles=tissue.musclePalette.slice();
 const started=performance.now();cache.palette=palette.slice();const {ids,rest,posed}=cache;
 for(let v=0;v<ids.length;v++){
  const source=ids[v]*4,first=g.skinJoints[source]*8;let x=0,y=0,z=0,w=0,dx=0,dy=0,dz=0,dw=0;
  for(let n=0;n<4;n++){const id=g.skinJoints[source+n]*8;let weight=g.skinWeights[source+n];if(palette[first]*palette[id]+palette[first+1]*palette[id+1]+palette[first+2]*palette[id+2]+palette[first+3]*palette[id+3]<0)weight=-weight;
   x+=palette[id]*weight;y+=palette[id+1]*weight;z+=palette[id+2]*weight;w+=palette[id+3]*weight;dx+=palette[id+4]*weight;dy+=palette[id+5]*weight;dz+=palette[id+6]*weight;dw+=palette[id+7]*weight;
  }
  const length=Math.hypot(x,y,z,w)||1;x/=length;y/=length;z/=length;w/=length;dx/=length;dy/=length;dz/=length;dw/=length;
  const dot=x*dx+y*dy+z*dz+w*dw;dx-=x*dot;dy-=y*dot;dz-=z*dot;dw-=w*dot;
  const k=v*3,offset=proceduralSkinOffset(tissue,g,v),px=rest[k]+offset[0],py=rest[k+1]+offset[1],pz=rest[k+2]+offset[2],tx=2*(y*pz-z*py),ty=2*(z*px-x*pz),tz=2*(x*py-y*px);
  posed[k]=px+w*tx+y*tz-z*ty+2*(w*dx-dw*x+y*dz-z*dy);
  posed[k+1]=py+w*ty+z*tx-x*tz+2*(w*dy-dw*y+z*dx-x*dz);
  posed[k+2]=pz+w*tz+x*ty-y*tx+2*(w*dz-dw*z+x*dy-y*dx);
 }
 const final=posed.slice();
 const transforms=new Map(),transform=id=>{if(!transforms.has(id))transforms.set(id,{q:Array.from(palette.subarray(id*8,id*8+4)),d:Array.from(palette.subarray(id*8+4,id*8+8))});return transforms.get(id);};
 for(let v=0;v<ids.length;v++){const k=v*3,s=v*4,sample={p:Array.from(rest.subarray(k,k+3)),joints:Array.from(g.skinJoints.subarray(s,s+4)),weights:Array.from(g.skinWeights.subarray(s,s+4)),structureAnchor:Array.from(g.structureAnchor.subarray(s,s+4)),structureData:Array.from(cache.support.subarray(s,s+4))};final.set(shoulderSupportSample(tissue,sample,Array.from(final.subarray(k,k+3)),transform),k);}
 const normal=wholeBodyNormals(final,cache.faces);
 for(let v=0;v<cache.map.length;v++){const id=cache.map[v];if(id<0)continue;const from=id*3,to=v*3;for(let c=0;c<3;c++){g.renderP[to+c]=final[from+c];g.renderN[to+c]=normal[from+c];}}
 cache.revision++;cache.lastMilliseconds=performance.now()-started;
 return true;
}
function uploadWholeBodySurface(renderer){
 const gl=renderer.gl;let offset=0;
 for(const item of renderer.lastItems){const g=item.g;refreshWholeBodySlice(g);if(g.renderP){gl.bindBuffer(gl.ARRAY_BUFFER,renderer.buffers[0]);gl.bufferSubData(gl.ARRAY_BUFFER,offset*12,g.renderP);gl.bindBuffer(gl.ARRAY_BUFFER,renderer.buffers[1]);gl.bufferSubData(gl.ARRAY_BUFFER,offset*12,g.renderN);}offset+=g.p.length/3;}
}
function attachWholeBodySlice(g,source,ids){
 if(!source.surfaceCache)return;
 g.surfaceSource=source;g.surfaceVertexIds=ids;g.surfaceRest=g.p;
 g.renderP=g.p.slice();g.renderN=g.n.slice();
 g.structureData=g.structureData||new Float32Array(ids.length*4);
 for(let v=0;v<ids.length;v++)g.structureData[v*4+3]=-1;
 refreshWholeBodySlice(g);
}
function refreshWholeBodySlice(g){
 refreshSkinLayerGeometry(g);
 const source=g.surfaceSource;if(!source)return;
 for(let v=0;v<g.surfaceVertexIds.length;v++){const k=g.surfaceVertexIds[v]*3;for(let c=0;c<3;c++){g.renderP[v*3+c]=source.renderP[k+c];g.renderN[v*3+c]=source.renderN[k+c];}}
}

function proceduralSkinOffset(tissue,g,v){
 let displacement=0;const palette=tissue.musclePalette;
 for(let n=0;n<2;n++){const o=Math.round(g.tissueIds[v*2+n])*24,t=g.tissueData[v*4+n+2],weight=g.tissueData[v*4+n],st=Math.max(.0001,Math.sin(Math.PI*t));displacement+=palette[o+3]*(palette[o+11]*(.1+.9*Math.pow(st,palette[o+15]))-(.1+.9*st))*weight*.42;}
 const k=v*3,d=clamp(displacement,-.002,.003),chest=Math.exp(-(((g.p[k+1]-1.31)/.15)**2))*Math.exp(-((g.p[k]/.18)**4));
 return [g.n[k]*d,g.n[k+1]*d,g.n[k+2]*d+Math.sin(tissue.time*1.45)*.0016*chest];
}
