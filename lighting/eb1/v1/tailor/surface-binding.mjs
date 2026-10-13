import * as THREE from 'three';
import {mapPanelUV} from './panel-grain.mjs';
import {prepareChart} from './geometry-core.mjs';
const WIDTH=256;
function texture(data,w,h){const t=new THREE.DataTexture(data,w,h,THREE.RGBAFormat,THREE.FloatType);t.minFilter=t.magFilter=THREE.NearestFilter;t.generateMipmaps=false;t.needsUpdate=true;return t;}
export function panelRecords(native,packet){let offset=0,faceOffset=0;return packet.spec.panels.map(p=>{const n=p.uvMm.length,q={id:p.id,offset,uv:p.uvMm.map(([x,y])=>mapPanelUV(p.id,x,y).map(v=>v*1000)),pos:native.geometry.attributes.position.array.slice(offset*3,(offset+n)*3),norm:native.geometry.attributes.normal.array.slice(offset*3,(offset+n)*3),tris:Array.from(native.geometry.index.array.slice(faceOffset,faceOffset+p.triangles.length*3),v=>v-offset),boundary:p.boundary};faceOffset+=p.triangles.length*3;offset+=n;return q;});}
export function createDeformer(native,panels){const count=native.geometry.attributes.position.count,h=Math.ceil(count/WIDTH),p=new Float32Array(WIDTH*h*4),n=new Float32Array(p.length),uv=new Float32Array(p.length),position=texture(p,WIDTH,h),normal=texture(n,WIDTH,h),coords=texture(uv,WIDTH,h);for(const panel of panels)for(let i=0;i<panel.uv.length;i++)uv.set([...panel.uv[i],0,1],(panel.offset+i)*4);
 const update=(positions,normals)=>{for(let i=0;i<count;i++){p[i*4]=positions[i*3];p[i*4+1]=positions[i*3+1];p[i*4+2]=positions[i*3+2];p[i*4+3]=1;n[i*4]=normals[i*3];n[i*4+1]=normals[i*3+1];n[i*4+2]=normals[i*3+2];n[i*4+3]=1;}position.needsUpdate=normal.needsUpdate=true;};update(native.geometry.attributes.position.array,native.geometry.attributes.normal.array);
 return{uniforms:{uControlPos:{value:position},uControlNorm:{value:normal},uControlUV:{value:coords}},update,bytes:p.byteLength+n.byteLength+uv.byteLength,dispose(){position.dispose();normal.dispose();coords.dispose();}};
}
/** Static triangle IDs, rather than rebuilding millions of yarn vertices per frame. */
export function bindChart(panel,step=2){const c=prepareChart(panel,step),ids=new Float32Array(c.w*c.h*4),valid=new Uint8Array(c.w*c.h),tris=panel.tris,uv=panel.uv;
 for(let f=0;f<tris.length;f+=3){const ia=tris[f],ib=tris[f+1],ic=tris[f+2],a=uv[ia],b=uv[ib],d=uv[ic],den=(b[1]-d[1])*(a[0]-d[0])+(d[0]-b[0])*(a[1]-d[1]);if(Math.abs(den)<1e-9)continue;
  const x0=Math.max(0,Math.ceil((Math.min(a[0],b[0],d[0])-c.origin[0])/step)),x1=Math.min(c.w-1,Math.floor((Math.max(a[0],b[0],d[0])-c.origin[0])/step)),y0=Math.max(0,Math.ceil((Math.min(a[1],b[1],d[1])-c.origin[1])/step)),y1=Math.min(c.h-1,Math.floor((Math.max(a[1],b[1],d[1])-c.origin[1])/step));
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const xx=c.origin[0]+x*step,yy=c.origin[1]+y*step,u=((b[1]-d[1])*(xx-d[0])+(d[0]-b[0])*(yy-d[1]))/den,v=((d[1]-a[1])*(xx-d[0])+(a[0]-d[0])*(yy-d[1]))/den;if(u<-.000001||v<-.000001||1-u-v<-.000001)continue;const k=y*c.w+x;valid[k]=1;ids.set([panel.offset+ia,panel.offset+ib,panel.offset+ic,1],k*4);}
 }
 const queue=new Int32Array(valid.length);let head=0,tail=0;for(let k=0;k<valid.length;k++)if(valid[k])queue[tail++]=k;if(!tail)throw Error('EMPTY_TRIANGLE_BINDING '+panel.id);
 while(head<tail){const k=queue[head++],x=k%c.w;for(const j of [x?k-1:-1,x<c.w-1?k+1:-1,k>=c.w?k-c.w:-1,k<c.w*(c.h-1)?k+c.w:-1])if(j>=0&&!valid[j]){valid[j]=2;queue[tail++]=j;ids.set(ids.subarray(k*4,k*4+4),j*4);}}
 const grid=texture(ids,c.w,c.h);return{chart:c,uniforms:{uBinding:{value:grid},uGrid:{value:new THREE.Vector2(c.w,c.h)},uOrigin:{value:new THREE.Vector2(...c.origin)},uGridStep:{value:step}},dispose(){grid.dispose();},bytes:ids.byteLength};
}
export const bindingGLSL=`
uniform sampler2D uControlPos,uControlNorm,uControlUV,uBinding;
uniform vec2 uGrid,uOrigin;uniform float uGridStep;
vec3 control(sampler2D data,float index){int i=int(index+.5);return texelFetch(data,ivec2(i%256,i/256),0).xyz;}
vec3 weightsAt(vec2 xy,vec3 ids,out vec2 a,out vec2 b,out vec2 c){a=control(uControlUV,ids.x).xy;b=control(uControlUV,ids.y).xy;c=control(uControlUV,ids.z).xy;float den=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);float u=((b.y-c.y)*(xy.x-c.x)+(c.x-b.x)*(xy.y-c.y))/den;float v=((c.y-a.y)*(xy.x-c.x)+(a.x-c.x)*(xy.y-c.y))/den;return vec3(u,v,1.-u-v);}
void surfaceFrame(vec2 xy,out vec3 P,out vec3 N,out vec3 U,out vec3 V){
 ivec2 cell=ivec2(clamp(floor((xy-uOrigin)/uGridStep),vec2(0.),uGrid-2.));vec3 ids=texelFetch(uBinding,cell,0).xyz;vec2 a,b,c;vec3 w=weightsAt(xy,ids,a,b,c);
 float quality=min(w.x,min(w.y,w.z));if(quality<-.0001){for(int k=1;k<4;k++){ivec2 delta=ivec2(k==2?0:1,k==1?0:1);vec3 candidate=texelFetch(uBinding,cell+delta,0).xyz;vec2 aa,bb,cc;vec3 q=weightsAt(xy,candidate,aa,bb,cc);float qq=min(q.x,min(q.y,q.z));if(qq>quality){quality=qq;ids=candidate;w=q;a=aa;b=bb;c=cc;}if(quality>=-.0001)break;}}
 vec3 p0=control(uControlPos,ids.x),p1=control(uControlPos,ids.y),p2=control(uControlPos,ids.z);
 P=p0*w.x+p1*w.y+p2*w.z;N=normalize(control(uControlNorm,ids.x)*w.x+control(uControlNorm,ids.y)*w.y+control(uControlNorm,ids.z)*w.z);
 vec2 e=b-a,f=c-a;float den=e.x*f.y-e.y*f.x;U=((p1-p0)*f.y-(p2-p0)*e.y)/den;V=((p2-p0)*e.x-(p1-p0)*f.x)/den;
}
`;
