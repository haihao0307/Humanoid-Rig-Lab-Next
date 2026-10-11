/* Source-control-net procedural mothers. Third-party controls/UVs retain attribution.
 * No baked render geometry is an input. Lengths are metres; diagnostics are sampled,
 * not pressure, continuous collision, textile calibration or manufacturing certification.
 */
export const MOTHER_VERSION='kaopu.hat.mother/3';
const TAU=2*Math.PI,clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),mix=(a,b,t)=>a+(b-a)*t;
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
export const FIT_SPECS={
 cable:{mode:'stretch-cap',band:-.057,crown:.1017,clearance:.003,negativeEase:.09,label:'针织：帽口负松量、帽冠包裹'},
 sherpa:{mode:'stretch-cap',band:-.049,crown:.108,clearance:.003,negativeEase:.07,label:'护耳针织：帽冠包裹，耳片与系带保留'},
 fishing:{mode:'woven-crown',band:.019,crown:.1008,clearance:.002,negativeEase:0,label:'渔夫帽：佩戴圈贴合，帽冠与帽檐保形'},
 flatcap:{mode:'woven-crown',band:-.017,crown:.1042,clearance:.002,negativeEase:0,label:'鸭舌帽：内圈定位，保留前冠容积'},
 trilby:{mode:'blocked-crown',band:.026,crown:.1306,clearance:.002,negativeEase:0,label:'礼帽：汗带圈定位，不把帽冠压成头形'},
 bowler:{mode:'blocked-crown',band:.022,crown:.1308,clearance:.002,negativeEase:0,label:'圆顶帽：内圈贴合，圆冠保持'},
 top:{mode:'blocked-crown',band:.014,crown:.1806,clearance:.002,negativeEase:0,label:'高顶帽：内圈承托，顶腔是设计留量'},
 patrol:{mode:'woven-crown',band:.018,crown:.0979,clearance:.002,negativeEase:0,label:'便帽：帽圈匹配，平顶和前檐分区'},
 visor:{mode:'open-band',band:.037,crown:.0667,clearance:.002,negativeEase:0,label:'空顶帽：仅帽带与前檐，不生成帽冠'},
 cloche:{mode:'blocked-crown',band:-.013,crown:.1168,clearance:.002,negativeEase:0,label:'钟形帽：内圈匹配，低垂帽檐保留'},
 chef:{mode:'gathered-crown',band:.029,crown:.182,clearance:.002,negativeEase:0,label:'厨师帽：底圈承托，上部褶量保留'}
};
export const PARAM_DEFAULTS={autoFit:true,wearBandMM:12,hairMM:0,clearanceMM:2,crownMM:0,brimFactor:1,brimCurve:0,bandFactor:1,crownFullness:1,backLeanMM:0,negativeEase:.09,textureMode:'source',weaveMM:1.5,grainStrength:.35,customColor:'#a97970',useCustomColor:false,showMeasurements:false,showClearance:false};
export function subtypeDefaults(id){const s=FIT_SPECS[id];return {...PARAM_DEFAULTS,clearanceMM:s.clearance*1000,negativeEase:s.negativeEase};}
export function validateMother(s){
 for(const [k,lo,hi] of [['wearBandMM',4,25],['hairMM',0,12],['clearanceMM',1,6],['crownMM',-20,40],['brimFactor',.7,1.35],['brimCurve',-15,15],['bandFactor',.8,1.3],['crownFullness',.85,1.2],['backLeanMM',-15,25],['negativeEase',0,.18],['weaveMM',.6,4],['grainStrength',0,1]])if(!Number.isFinite(s[k])||s[k]<lo||s[k]>hi)throw Error('母体参数超界：'+k);
 if(FIT_SPECS[s.id]?.mode==='stretch-cap'&&s.crownMM<0)throw Error('贴头针织帽冠不能向头皮内部缩短');
 for(const k of ['autoFit','useCustomColor','showMeasurements','showClearance'])if(typeof s[k]!=='boolean')throw Error('无效开关：'+k);
 if(!['source','wool','twill','knit'].includes(s.textureMode)||!/^#[0-9a-fA-F]{6}$/.test(s.customColor))throw Error('无效材质配方');return s;
}
function subdivision(vertices,faces,cornerUV){
 const fp=faces.map(f=>{const p=[0,0,0];for(const i of f)for(let k=0;k<3;k++)p[k]+=vertices[i][k]/f.length;return p;});
 const vf=vertices.map(()=>[]),ve=vertices.map(()=>[]),edges=new Map();
 for(let fi=0;fi<faces.length;fi++){const f=faces[fi];for(let j=0;j<f.length;j++){const a=f[j],b=f[(j+1)%f.length],key=a<b?a+':'+b:b+':'+a;vf[a].push(fi);if(!edges.has(key)){edges.set(key,{a:Math.min(a,b),b:Math.max(a,b),f:[]});ve[a].push(key);ve[b].push(key);}edges.get(key).f.push(fi);}}
 const out=vertices.map((p,i)=>{const boundary=ve[i].filter(k=>edges.get(k).f.length===1).map(k=>{const e=edges.get(k);return e.a===i?e.b:e.a;});if(boundary.length===2)return p.map((v,k)=>(6*v+vertices[boundary[0]][k]+vertices[boundary[1]][k])/8);if(!boundary.length&&vf[i].length){const n=vf[i].length;return p.map((v,k)=>{const F=vf[i].reduce((s,fi)=>s+fp[fi][k],0)/n,R=ve[i].reduce((s,key)=>{const e=edges.get(key);return s+(vertices[e.a][k]+vertices[e.b][k])/2;},0)/ve[i].length;return(F+2*R+(n-3)*v)/n;});}return [...p];});
 for(const e of edges.values()){e.index=out.length;out.push(vertices[e.a].map((a,k)=>e.f.length===2?(a+vertices[e.b][k]+fp[e.f[0]][k]+fp[e.f[1]][k])/4:(a+vertices[e.b][k])/2));}
 const off=out.length;out.push(...fp);const nextFaces=[],nextUV=[];
 for(let fi=0;fi<faces.length;fi++){const f=faces[fi],u=cornerUV?.[fi],avg=u?[u.reduce((s,q)=>s+q[0],0)/u.length,u.reduce((s,q)=>s+q[1],0)/u.length]:null;for(let j=0;j<f.length;j++){const a=f[j],b=f[(j+1)%f.length],c=f[(j+f.length-1)%f.length];const edge=(a,b)=>edges.get(a<b?a+':'+b:b+':'+a).index;nextFaces.push([a,edge(a,b),off+fi,edge(a,c)]);if(u)nextUV.push([u[j],u[j].map((v,k)=>(v+u[(j+1)%f.length][k])/2),avg,u[j].map((v,k)=>(v+u[(j+f.length-1)%f.length][k])/2)]);}}
 return {vertices:out,faces:nextFaces,cornerUV:nextUV};
}
export function regenerate(recipe){
 if(recipe.schema!==MOTHER_VERSION)throw Error('母体版本不匹配');
 let vertices=recipe.controls.map(p=>[...p]),faces=recipe.faces.map(f=>[...f]),cornerUV=recipe.cornerUV;
 let uvVertices=[],uvFaces=[],uvLookup=new Map();
 if(recipe.smoothUV)for(let fi=0;fi<faces.length;fi++){const row=[];for(let j=0;j<faces[fi].length;j++){const v=faces[fi][j],u=cornerUV[fi][j],key=v+':'+u.map(x=>x.toFixed(7)).join(':');if(!uvLookup.has(key)){uvLookup.set(key,uvVertices.length);uvVertices.push([u[0],u[1],0]);}row.push(uvLookup.get(key));}uvFaces.push(row);}
 for(let l=0;l<recipe.subdivision;l++){
  ({vertices,faces,cornerUV}=subdivision(vertices,faces,cornerUV));
  if(recipe.smoothUV){const d=subdivision(uvVertices,uvFaces);uvVertices=d.vertices;uvFaces=d.faces;cornerUV=uvFaces.map(f=>f.map(i=>uvVertices[i].slice(0,2)));}
 }
 const lookup=new Map(),position=[],uv=[],index=[],groups=[];
 for(let fi=0;fi<faces.length;fi++){const f=faces[fi],u=cornerUV[fi];for(let j=1;j<f.length-1;j++)for(const c of [0,j,j+1]){const i=f[c],key=i+':'+u[c].map(x=>x.toFixed(7)).join(':');if(!lookup.has(key)){lookup.set(key,position.length/3);position.push(...vertices[i]);uv.push(...u[c]);groups.push(i);}index.push(lookup.get(key));}}
 const mesh={position:new Float32Array(position),uv:new Float32Array(uv),index:new Uint32Array(index),groups:new Uint32Array(groups),groupCount:vertices.length,generatedBy:MOTHER_VERSION,controlCount:recipe.controls.length};mesh.normal=normals(mesh,mesh.position);return mesh;
}
export function normals(mesh,p){const sums=new Float64Array(mesh.groupCount*3),ix=mesh.index,group=mesh.groups;
 for(let t=0;t<ix.length;t+=3){const a=ix[t]*3,b=ix[t+1]*3,c=ix[t+2]*3,ux=p[b]-p[a],uy=p[b+1]-p[a+1],uz=p[b+2]-p[a+2],vx=p[c]-p[a],vy=p[c+1]-p[a+1],vz=p[c+2]-p[a+2],nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;for(const i of [ix[t],ix[t+1],ix[t+2]]){const j=group[i]*3;sums[j]+=nx;sums[j+1]+=ny;sums[j+2]+=nz;}}
 const out=new Float32Array(p.length);for(let i=0;i<group.length;i++){const j=group[i]*3,n=Math.hypot(sums[j],sums[j+1],sums[j+2])||1;out[i*3]=sums[j]/n;out[i*3+1]=sums[j+1]/n;out[i*3+2]=sums[j+2]/n;}return out;}
/* A horizontal cut intersects actual triangles. Separate inside/outside intersections
 * are retained, rather than treating bounding-box width as a tape circumference. */
export function sectionProfile(p,index,{ymin=-.085,ymax=.1,rows=112,angles=144,inner=false}={}){
 const layers=[],step=(ymax-ymin)/(rows-1);let previousCenter=[0,0];
 for(let row=0;row<rows;row++){const y=ymin+row*step,segments=[];let minx=Infinity,maxx=-Infinity,minz=Infinity,maxz=-Infinity;
  for(let t=0;t<index.length;t+=3){const ids=[index[t]*3,index[t+1]*3,index[t+2]*3],a=p[ids[0]+1],b=p[ids[1]+1],c=p[ids[2]+1];if(y<Math.min(a,b,c)||y>Math.max(a,b,c))continue;const hits=[];
   for(let j=0;j<3;j++){const i=ids[j],k=ids[(j+1)%3],dy=p[k+1]-p[i+1];if(Math.abs(dy)<1e-12)continue;const q=(y-p[i+1])/dy;if(q>=0&&q<1){const x=mix(p[i],p[k],q),z=mix(p[i+2],p[k+2],q);hits.push([x,z]);minx=Math.min(minx,x);maxx=Math.max(maxx,x);minz=Math.min(minz,z);maxz=Math.max(maxz,z);}}
   if(hits.length===2)segments.push(hits);
  }
  const center=segments.length?[(minx+maxx)/2,(minz+maxz)/2]:previousCenter;previousCenter=center;const r=new Float64Array(angles),valid=new Uint8Array(angles);
  for(let j=0;j<angles;j++){const th=j*TAU/angles,dx=Math.cos(th),dz=Math.sin(th);let best=inner?Infinity:0;
   for(const [aa,bb]of segments){const ax=aa[0]-center[0],az=aa[1]-center[1],ex=bb[0]-aa[0],ez=bb[1]-aa[1],den=dx*ez-dz*ex;if(Math.abs(den)<1e-12)continue;const rr=(ax*ez-az*ex)/den,tt=(ax*dz-az*dx)/den;if(rr>1e-7&&tt>=-1e-7&&tt<=1+1e-7){best=inner?Math.min(best,rr):Math.max(best,rr);valid[j]=1;}}
   r[j]=Number.isFinite(best)?best:0;
  }
  layers.push({y,center,r,valid});
 }
 return {ymin,ymax,rows,angles,step,layers};
}
export function sample(profile,y,theta){const yf=clamp((y-profile.ymin)/profile.step,0,profile.rows-1.000001),i=Math.floor(yf),f=yf-i,tf=((theta%TAU+TAU)%TAU)*profile.angles/TAU,j=Math.floor(tf),a=tf-j,k=(j+1)%profile.angles,L=profile.layers[i],U=profile.layers[Math.min(i+1,profile.rows-1)];return {r:mix(mix(L.r[j],L.r[k],a),mix(U.r[j],U.r[k],a),f),center:L.center.map((v,k)=>mix(v,U.center[k],f)),valid:Boolean(L.valid[j]||U.valid[j])};}
function hull(points){const p=points.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]),cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]),half=[];for(const q of p){while(half.length>=2&&cross(half.at(-2),half.at(-1),q)<=0)half.pop();half.push(q);}const lower=half.length;for(let i=p.length-2;i>=0;i--){const q=p[i];while(half.length>lower&&cross(half.at(-2),half.at(-1),q)<=0)half.pop();half.push(q);}half.pop();return half;}
const perimeter=p=>p.reduce((s,q,i)=>s+Math.hypot(q[0]-p[(i+1)%p.length][0],q[1]-p[(i+1)%p.length][1]),0);
export function measurements(profile,bandY){const ring=[];for(let j=0;j<profile.angles;j++){const a=j*TAU/profile.angles,s=sample(profile,bandY,a);ring.push([s.center[0]+s.r*Math.cos(a),s.center[1]+s.r*Math.sin(a)]);}const tape=hull(ring),arc=(a)=>{let len=0,last=null;for(let i=0;i<128;i++){const y=mix(bandY,profile.ymax-.0002,i/127),s=sample(profile,y,a),p=[s.center[0]+s.r*Math.cos(a),y,s.center[1]+s.r*Math.sin(a)];if(last)len+=Math.hypot(...p.map((x,k)=>x-last[k]));last=p;}return len;};
 return {definition:'actual-triangle horizontal section; convex tape envelope; selected wear plane is an engineering anchor, not automatic anatomical landmark detection',bandY,ring,headCircumferenceMM:perimeter(tape)*1000,surfaceLoopMM:perimeter(ring)*1000,widthMM:(Math.max(...ring.map(p=>p[0]))-Math.min(...ring.map(p=>p[0])))*1000,depthMM:(Math.max(...ring.map(p=>p[1]))-Math.min(...ring.map(p=>p[1])))*1000,frontBackArcMM:(arc(Math.PI/2)+arc(3*Math.PI/2))*1000,sideToSideArcMM:(arc(0)+arc(Math.PI))*1000,crownRiseMM:(profile.ymax-bandY)*1000,anatomicalLandmarksVerified:false};}
export {sourceFitProfile,deform} from './fit/field.mjs';
export function categoryPresets(id){const d=subtypeDefaults(id),wrap=FIT_SPECS[id].mode==='stretch-cap';return [{id:'standard',title:wrap?'贴头标准款':'量头标准款',values:{...d}},{id:'compact',title:wrap?'短冠细针织':'短冠窄檐',values:{...d,crownMM:wrap?0:-12,brimFactor:.82,crownFullness:.96,textureMode:wrap?'knit':'wool',weaveMM:1.05,grainStrength:.28,useCustomColor:true,customColor:'#5c6870'}},{id:'relaxed',title:wrap?'留量松冠款':'宽檐丰冠',values:{...d,crownMM:wrap?24:14,crownFullness:wrap?1.03:1.08,brimFactor:1.22,backLeanMM:wrap?12:0,textureMode:wrap?'knit':'twill',weaveMM:2.2,useCustomColor:true,customColor:'#937052'}}];}
