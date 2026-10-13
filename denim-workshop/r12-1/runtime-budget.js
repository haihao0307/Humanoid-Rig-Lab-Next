/* Float32-preserving fiber storage and conservative view culling.
 * One record per control point, not two duplicated ribbon vertices.
 * No point decimation, curve reordering, texture appearance substitution or random visibility. */
(function(root){'use strict';
function packFibers(curves){
 let points=0,segments=0;for(const c of curves){points+=c.points.length;segments+=c.points.length-1;}
 const width=1024,rows=Math.max(1,Math.ceil(points*2/width));
 const data=new Float32Array(width*rows*4),meta=new Float32Array(width*Math.max(1,Math.ceil(curves.length/width))*4),bounds=new Float32Array(curves.length*8);
 let n=0;for(let i=0;i<curves.length;i++){
  const c=curves[i],ps=c.points,base=i*8;let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity,z=0;
  bounds[base+5]=n;bounds[base+6]=ps.length;
  meta.set([c.radius,c.kind,(c.parentId??23)+(c.physicalIndex||0)*1024,c.physicalIndex?2+(c.bindingScale??1):(c.role==='sheath'||c.role==='surface'?1:0)],i*4);
  for(let j=0;j<ps.length;j++,n++){
   const p=ps[j],a=ps[Math.max(0,j-1)],b=ps[Math.min(j+1,ps.length-1)],tx=b[0]-a[0],ty=b[1]-a[1],tz=b[2]-a[2],q=1/Math.max(1e-8,Math.hypot(tx,ty,tz));
   data.set([p[0],p[1],p[2],i,tx*q,ty*q,tz*q,j/(ps.length-1)],n*8);
   x0=Math.min(x0,p[0]);y0=Math.min(y0,p[1]);x1=Math.max(x1,p[0]);y1=Math.max(y1,p[1]);z=Math.max(z,Math.abs(p[2]));
  }
  bounds.set([x0,y0,x1,y1,z],base);
 }
 return {width,rows,data,meta,bounds,points,segments,indexCapacity:points*2+curves.length};
}
function makeFiberStore(gl,curves){
 const p=Array.isArray(curves)?packFibers(curves):curves,curveCount=p.bounds.length/8,limit=gl.getParameter(gl.MAX_TEXTURE_SIZE);
 if(p.rows>limit)throw Error('Fiber point texture exceeds the device limit; not silently truncating geometry');
 function tex(a){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA32F,p.width,a.length/(p.width*4));gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,p.width,a.length/(p.width*4),gl.RGBA,gl.FLOAT,a);for(const [key,v] of [[gl.TEXTURE_MIN_FILTER,gl.NEAREST],[gl.TEXTURE_MAG_FILTER,gl.NEAREST],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,key,v);return t;}
 const pointTex=tex(p.data),metaTex=tex(p.meta),vao=gl.createVertexArray(),ib=gl.createBuffer(),scratch=new Uint32Array(p.indexCapacity);
 gl.bindVertexArray(vao);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,scratch.byteLength,gl.DYNAMIC_DRAW);gl.bindVertexArray(null);
 const out={vao,ib,pointTex,metaTex,bounds:p.bounds,points:p.points,curveCount:curveCount,count:p.segments*6,indexCount:0,visibleCurves:0,visibleTriangles:0,bufferBytes:scratch.byteLength,textureBytes:p.data.byteLength+p.meta.byteLength,cpuBytes:scratch.byteLength+p.bounds.byteLength+curveCount*8,updates:0,visibilityChecks:0};
 const selected=new Uint32Array(curveCount),previous=new Uint32Array(curveCount);let previousCount=-1;
 out.update=(visible)=>{let cc=0,same=true;const b=out.bounds;out.visibilityChecks++;
  for(let i=0;i<b.length;i+=8){if(visible&&!visible(b[i],b[i+1],b[i+2],b[i+3],b[i+4]))continue;const id=i/8;selected[cc]=id;if(previous[cc]!==id)same=false;cc++;}
  // Camera matrices can move while the visible curve set stays identical.
  // Do not rewrite/upload an unchanged multi-megabyte strip index buffer.
  if(same&&cc===previousCount)return false;
  let n=0,tri=0,rangeStart=0,rangeTriangles=0;out.drawRanges=[];for(let k=0;k<cc;k++){const i=selected[k]*8,first=b[i+5],len=b[i+6];for(let j=0;j<len;j++){scratch[n++]=(first+j)*2;scratch[n++]=(first+j)*2+1;}scratch[n++]=0xffffffff;tri+=(len-1)*2;rangeTriangles+=(len-1)*2;if(n-rangeStart>=65536){out.drawRanges.push({start:rangeStart,count:n-rangeStart,triangles:rangeTriangles});rangeStart=n;rangeTriangles=0;}}if(n>rangeStart)out.drawRanges.push({start:rangeStart,count:n-rangeStart,triangles:rangeTriangles});
  previous.set(selected.subarray(0,cc));previousCount=cc;
  gl.bindVertexArray(vao);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER,0,scratch.subarray(0,n));gl.bindVertexArray(null);out.indexCount=n;out.visibleTriangles=tri;out.visibleCurves=cc;out.updates++;return true;};
 p.data=null;p.meta=null; // GPU upload completed; do not retain staging arrays through closures.
 out.update(null);out.destroy=()=>{gl.deleteVertexArray(vao);gl.deleteBuffer(ib);gl.deleteTexture(pointTex);gl.deleteTexture(metaTex);};return out;
}
// An enclosing world-space box: includes the material warp, all carrier shapes,
// local z offsets, full swing range and camera-facing Gaussian ribbon width.
// This deliberately rejects fewer objects rather than popping visible fibers.
function visibility(vp,state,height,pixel=0){
 const planes=[];for(let r=0;r<3;r++)for(const s of [-1,1])planes.push([vp[3]+s*vp[r],vp[7]+s*vp[r+4],vp[11]+s*vp[r+8],vp[15]+s*vp[r+12]]);
 const sx=.38*Math.abs(state.structure)+.002,sy=.315*Math.abs(state.structure)+.002;
 return (x0,y0,x1,y1,z)=>{
  x0-=sx;y0-=sy;x1+=sx;y1+=sy;
  const q=Math.max(Math.abs(.5-y0/height),Math.abs(.5-y1/height));let lo=-.21,hi=.21;
  if(state.shape===1){lo+=.014*y0-.5;hi+=12+.014*y1+.5;}
  else if(state.shape===2){if(y0<-height/2+10){y0=Math.min(y0,-height/2+6.68);y1=Math.max(y1,-height/2+10);}hi+=2*10/3.02+.8;}
  else if(state.shape===3){const e=3*(.55+.45*q)+1.1*q;lo-=e;hi+=e;}
  const pad=z+.04+pixel*4;lo-=pad+.55*q;hi+=pad+.55*q;x0-=pad;x1+=pad;y0-=pad;y1+=pad;
  const phys=state.physicsPad;if(phys){x0-=phys[0]+.1;x1+=phys[0]+.1;y0-=phys[1]+.1;y1+=phys[1]+.1;lo-=phys[2]+.1;hi+=phys[2]+.1;}for(const p of planes)if(p[0]*(p[0]>0?x1:x0)+p[1]*(p[1]>0?y1:y0)+p[2]*(p[2]>0?hi:lo)+p[3]<-.0001)return false;return true;
 };
}
function timer(gl){
 const ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');let pending=null,active=null,frame=0;const out={supported:!!ext,lastMs:null,samples:0,invalid:0};
 out.start=()=>{if(!ext)return;if(pending&&gl.getQueryParameter(pending,gl.QUERY_RESULT_AVAILABLE)){if(!gl.getParameter(ext.GPU_DISJOINT_EXT)){out.lastMs=gl.getQueryParameter(pending,gl.QUERY_RESULT)/1e6;out.samples++;}else{out.invalid++;out.lastMs=null;}gl.deleteQuery(pending);pending=null;}
  if(!pending&&frame++%15===0){active=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,active);}};
 out.end=()=>{if(active){gl.endQuery(ext.TIME_ELAPSED_EXT);pending=active;active=null;}};return out;
}
root.KAOPURuntimeBudget={packFibers,makeFiberStore,visibility,timer};if(typeof module!=='undefined')module.exports=root.KAOPURuntimeBudget;
})(globalThis);
