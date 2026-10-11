/* One rest-space record per curve point, no duplicated ribbon sides or indices.
   XYZ/radius remain float32; octahedral tangents and life are explicitly bounded
   16-bit encodings. R08 curve identities, counts and ordering are retained. */
(function(root){'use strict';
const WIDTH=1024,CHUNK=4096;
function oct(v){let l=Math.abs(v[0])+Math.abs(v[1])+Math.abs(v[2]);let x=v[0]/l,y=v[1]/l;if(v[2]<0){const xx=x;x=(1-Math.abs(y))*(xx<0?-1:1);y=(1-Math.abs(xx))*(y<0?-1:1);}return [Math.round((x*.5+.5)*65535),Math.round((y*.5+.5)*65535)];}
function decode(a,b){let x=a/65535*2-1,y=b/65535*2-1,z=1-Math.abs(x)-Math.abs(y);if(z<0){const xx=x;x=(1-Math.abs(y))*(xx<0?-1:1);y=(1-Math.abs(xx))*(y<0?-1:1);}let l=Math.hypot(x,y,z);return [x/l,y/l,z/l];}
class Builder{
 constructor(){this.chunks=[];this.count=0;this.curves=0;this.records=[];this.segments=0;this.maxTangentError=0;this.maxLifeError=0;}
 push(P,T,life,radius,meta){let o=this.count%CHUNK;if(o===0)this.chunks.push({p:new Float32Array(CHUNK*4),m:new Uint16Array(CHUNK*4)});const c=this.chunks.at(-1),j=o*4,e=oct(T);c.p.set([P[0],P[1],P[2],radius],j);c.m.set([e[0],e[1],Math.round(life*65535),meta],j);this.count++;if(this.count%137===0){let d=decode(...e);this.maxTangentError=Math.max(this.maxTangentError,Math.hypot(...d.map((v,i)=>v-T[i])));this.maxLifeError=Math.max(this.maxLifeError,Math.abs(c.m[j+2]/65535-life));}}
 add(c){const ps=c.points,n=ps.length,meta=(c.parentId??23)*4+((c.role==='sheath'||c.role==='surface')?2:0)+c.kind;this.curves++;this.segments+=n-1;const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const P of ps)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],P[k]);hi[k]=Math.max(hi[k],P[k]);}this.records.push(this.count,n+2,...lo,...hi);
  for(let i=0;i<n;i++){let a=ps[Math.max(0,i-1)],b=ps[Math.min(n-1,i+1)],v=b.map((x,k)=>x-a[k]),l=Math.hypot(...v)||1,T=v.map(x=>x/l),t=i/(n-1);if(i===0)this.push(ps[i],T,t,-c.radius,meta);this.push(ps[i],T,t,c.radius,meta);if(i===n-1)this.push(ps[i],T,t,-c.radius,meta);}
 }
 upload(gl){const height=Math.ceil(this.count/WIDTH),textures=[];
  for(let i=0;i<2;i++){const t=gl.createTexture();textures.push(t);gl.bindTexture(gl.TEXTURE_2D,t);gl.texStorage2D(gl.TEXTURE_2D,1,i?gl.RGBA16UI:gl.RGBA32F,WIDTH,height);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);for(let k=0;k<this.chunks.length;k++){const rows=Math.min(4,height-k*4),data=i?this.chunks[k].m:this.chunks[k].p;gl.texSubImage2D(gl.TEXTURE_2D,0,0,k*4,WIDTH,rows,i?gl.RGBA_INTEGER:gl.RGBA,i?gl.UNSIGNED_SHORT:gl.FLOAT,data.subarray(0,WIDTH*rows*4));}}
  const m={textures,vao:gl.createVertexArray(),drawVertices:this.count*2,count:this.segments*6,bufferBytes:0,textureBytes:WIDTH*height*24,curves:this.curves,storedPoints:this.count,maxTangentError:this.maxTangentError,maxLifeError:this.maxLifeError,peakTypedStagingBytes:this.chunks.length*CHUNK*24,records:new Float32Array(this.records),worldBounds:null,boundsKey:'',visibleCurves:this.curves,visibleSegments:this.segments,indexBuffer:null,indexBytes:0,indexCount:0};this.chunks.length=0;this.records=[];return m;
 }
}
function selectVisible(gl,m,g,state,vp,Budget){const key=[state.shape,state.structure].join('|'),rows=m.records;
 if(m.boundsKey!==key){const b=new Float32Array(rows.length/2);for(let i=0,j=0;i<rows.length;i+=8,j+=4){const center=Budget.carrier([(rows[i+2]+rows[i+5])*.5,(rows[i+3]+rows[i+6])*.5],state,[g.p.width,g.p.height]);b.set([...center,1.5*Math.hypot(rows[i+5]-rows[i+2],rows[i+6]-rows[i+3])+Math.max(Math.abs(rows[i+4]),Math.abs(rows[i+7]))+2.5],j);}m.worldBounds=b;m.boundsKey=key;}
 const selected=[],b=m.worldBounds;let points=0,segments=0;for(let i=0,j=0;i<rows.length;i+=8,j+=4){if(state.qaNoCull||Budget.sphereVisible(vp,b.subarray(j,j+3),b[j+3])){selected.push(i);points+=rows[i+1]*2+1;segments+=rows[i+1]-3;}}
 m.visibleCurves=selected.length;m.visibleSegments=segments;
 if(selected.length===m.curves){if(m.indexBuffer)gl.deleteBuffer(m.indexBuffer);m.indexBuffer=null;m.indexBytes=0;m.indexCount=0;return;}
 const ix=new Uint32Array(points);let at=0;for(const i of selected){const start=rows[i]*2,end=start+rows[i+1]*2;for(let k=start;k<end;k++)ix[at++]=k;ix[at++]=0xffffffff;}
 if(!m.indexBuffer)m.indexBuffer=gl.createBuffer();gl.bindVertexArray(m.vao);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,m.indexBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,ix,gl.DYNAMIC_DRAW);m.indexCount=ix.length;m.indexBytes=ix.byteLength;gl.bindVertexArray(null);
}
const vertexPrelude=`uniform highp sampler2D uFiberPosition;uniform highp usampler2D uFiberMeta;
vec3 decodeOct(vec2 e){vec3 n=vec3(e*2.-1.,0.);n.z=1.-abs(n.x)-abs(n.y);if(n.z<0.)n.xy=(1.-abs(n.yx))*mix(vec2(-1),vec2(1),step(vec2(0),n.xy));return normalize(n);}
`;
const vertexRead=`int point=gl_VertexID/2;ivec2 address=ivec2(point%1024,point/1024);vec4 pr=texelFetch(uFiberPosition,address,0);uvec4 me=texelFetch(uFiberMeta,address,0);uint code=me.w;bool collapsed=pr.w<0.;vec4 aP=vec4(pr.xyz,float(gl_VertexID%2)*2.-1.);vec4 aMeta=vec4(float(code&1u),float(me.z)/65535.,abs(pr.w),float(code>>2u));vec4 aTangent=vec4(decodeOct(vec2(me.xy)/65535.),float((code>>1u)&1u));`;
root.KAOPUCompactFibers={Builder,selectVisible,oct,decode,vertexPrelude,vertexRead};if(typeof module!=='undefined')module.exports=root.KAOPUCompactFibers;
})(globalThis);
