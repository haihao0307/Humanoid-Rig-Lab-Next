import earcut from './vendor/earcut.js';
export function compileField(f){
 const {channels:k,unit}=f;
 const layers=f.layers.map(l=>{const a=new Map();for(let i=0;i<l.ids.length;i++)a.set(l.ids[i],l.c.slice(i*k,(i+1)*k));return {n:l.n,a};});
 return (u,v)=>{const out=f.mean.slice();for(const {n,a} of layers){const x=Math.max(0,Math.min(n-1e-8,u*n)),y=Math.max(0,Math.min(n-1e-8,v*n)),i=Math.floor(x),j=Math.floor(y),s=x-i,t=y-j;const ids=[i*(n+1)+j,(i+1)*(n+1)+j,i*(n+1)+j+1,(i+1)*(n+1)+j+1],b=[(1-s)*(1-t),s*(1-t),(1-s)*t,s*t];for(let q=0;q<4;q++){const c=a.get(ids[q]);if(c)for(let ch=0;ch<k;ch++)out[ch]+=c[ch]*unit*b[q];}}if(f.knots)for(const [a,b,r,c] of f.knots){const t=Math.hypot((u-a)*f.metric[0],(v-b)*f.metric[1])/r;if(t<1)out[0]+=c*unit*(1-t)**4*(4*t+1);}return out;};
}
export function chartFunctions(c){
 const height=compileField(c.height),weights=compileField(c.weights),appearance=compileField(c.appearance),normals=c.normals?compileField(c.normals):null;
 const point=([u,v])=>{const p=[0,0,0];p[c.plane[0]]=c.lo[0]+c.extent[0]*u;p[c.plane[1]]=c.lo[1]+c.extent[1]*v;p[c.axis]=c.linear[0]+c.linear[1]*u+c.linear[2]*v+height(u,v)[0];return p;};
 return {c,point,weights,appearance,normals};
}
const area=uv=>uv.reduce((s,p,i)=>{const q=uv[(i+1)%uv.length];return s+p[0]*q[1]-p[1]*q[0]},0)/2;
const inside=(p,loop)=>{let yes=false;for(let i=0,j=loop.length-1;i<loop.length;j=i++){const a=loop[i],b=loop[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
export function generateSurface(data,{edgeMetres=.012,muscle=0}={}){
 const funcs=data.charts.map(chartFunctions),owners=new Map(),seamEdges=new Map();
 for(const f of funcs)for(const loop of f.c.trim){const uv=loop.seams.map((_,i)=>[loop.uv[i*2]/1e6,loop.uv[i*2+1]/1e6]);for(let i=0;i<uv.length;i++){const id=loop.seams[i];if(!owners.has(id))owners.set(id,[]);owners.get(id).push({f,uv:uv[i]});const j=(i+1)%uv.length,a=id,b=loop.seams[j],key=a<b?`${a}:${b}`:`${b}:${a}`;if(!seamEdges.has(key))seamEdges.set(key,[]);seamEdges.get(key).push({f,a,b,uv0:uv[i],uv1:uv[j]});}}
 function evaluate(f,uv,seam){
  let sources=[{f,uv}];if(seam?.id!==undefined)sources=owners.get(seam.id)||sources;
  else if(seam?.a!==undefined){const key=seam.a<seam.b?`${seam.a}:${seam.b}`:`${seam.b}:${seam.a}`;sources=(seamEdges.get(key)||[]).map(s=>{const t=s.a===seam.a?seam.t:1-seam.t;return {f:s.f,uv:s.uv0.map((v,k)=>v+(s.uv1[k]-v)*t)}});if(!sources.length)sources=[{f,uv}];}
  const p=[0,0,0],w=new Float64Array(data.boneOrder.length);for(const s of sources){const q=s.f.point(s.uv),bw=s.f.weights(...s.uv);for(let k=0;k<3;k++)p[k]+=q[k]/sources.length;for(let k=0;k<bw.length;k++)w[s.f.c.bones[k]]+=Math.max(0,bw[k])/sources.length;}
  const weights=Array.from(w,(v,i)=>[v,i]).filter(x=>x[0]>1e-6).sort((a,b)=>b[0]-a[0]),sum=weights.slice(0,8).reduce((a,b)=>a+b[0],0)||1,ids=Array(8).fill(0),ws=Array(8).fill(0);for(let k=0;k<Math.min(8,weights.length);k++){ids[k]=weights[k][1];ws[k]=weights[k][0]/sum;}
  const color=f.appearance(...uv);if(muscle){const boost=1+muscle*.03;const group=f.c.anatomy;if(group==='torso'||group.startsWith('upperarm')||group.startsWith('thigh')){p[0]*=boost;p[2]*=boost;}}
  return {p,ids,ws,color,normal:f.normals?.(...uv)};
 }
 const pos=[],parameters=[],colors=[],normalValues=[],materialValues=[],indices=[],boneIds=[],boneWeights=[],chartIds=[],emptyDomainIds=[];let triangles=0,trimLoops=0,unclosed=0;
 for(const f of funcs){
  const loops=f.c.trim.map(loop=>({uv:loop.seams.map((_,i)=>[loop.uv[i*2]/1e6,loop.uv[i*2+1]/1e6]),seams:loop.seams})).filter(l=>l.uv.length>=3);trimLoops+=loops.length;
  const nests=loops.map((l,i)=>{let parent=-1,best=Infinity;const size=Math.abs(area(l.uv));for(let j=0;j<loops.length;j++)if(i!==j&&Math.abs(area(loops[j].uv))>size+1e-12&&inside(l.uv[0],loops[j].uv)){const a=Math.abs(area(loops[j].uv));if(a<best){best=a;parent=j;}}return parent;});
  function depth(i){let n=0;for(let j=nests[i],guard=0;j>=0&&guard<loops.length;j=nests[j],guard++)n++;return n;}
  for(let outer=0;outer<loops.length;outer++){
   if(depth(outer)%2)continue;
   const selected=[outer,...loops.map((_,i)=>i).filter(i=>nests[i]===outer&&depth(i)%2)];let vertices=[],holes=[],uvData=[],boundaryMap=new Map();
   for(const loopId of selected){const loop=loops[loopId];if(loopId!==outer)holes.push(vertices.length);let first=vertices.length;
    // Canonical seam edge sampling is identical for every owner, so chart
    // borders join after regeneration even when display density changes.
    for(let i=0;i<loop.uv.length;i++){const j=(i+1)%loop.uv.length,a=loop.seams[i],b=loop.seams[j],key=a<b?`${a}:${b}`:`${b}:${a}`,sources=seamEdges.get(key)||[],len=Math.max(...sources.map(s=>{const p=s.f.point(s.uv0),q=s.f.point(s.uv1);return Math.hypot(...p.map((v,k)=>v-q[k]))}),0),steps=Math.max(1,Math.ceil(len/edgeMetres));
     for(let step=0;step<steps;step++){const t=step/steps,uv=loop.uv[i].map((v,k)=>v+(loop.uv[j][k]-v)*t),seam=step?{a,b,t}:{id:a};vertices.push({uv,seam});uvData.push(...uv);}
    }
    const end=vertices.length;for(let i=first;i<end;i++){const j=i+1===end?first:i+1;boundaryMap.set(i<j?`${i}:${j}`:`${j}:${i}`,true);}
   }
   let faces=earcut(uvData,holes,2);if(!faces.length){unclosed++;emptyDomainIds.push(f.c.id);continue;}
   // Conforming edge refinement: every incident face consumes the same split.
   for(let pass=0;pass<12;pass++){
    const splits=new Map();
    for(let i=0;i<faces.length;i+=3){const corner=faces.slice(i,i+3),points=corner.map(id=>vertices[id].point||(vertices[id].point=f.point(vertices[id].uv))),centerUV=[0,0].map((_,k)=>corner.reduce((s,id)=>s+vertices[id].uv[k],0)/3),center=f.point(centerUV),linearCenter=[0,0,0].map((_,k)=>points.reduce((s,p)=>s+p[k],0)/3),centerError=Math.hypot(...center.map((v,k)=>v-linearCenter[k]));let longest=-1,longestLength=-1;for(let e=0;e<3;e++){const len=Math.hypot(...points[e].map((v,k)=>v-points[(e+1)%3][k]));if(len>longestLength){longest=e;longestLength=len;}}
     for(let e=0;e<3;e++){const a=corner[e],b=corner[(e+1)%3],key=a<b?`${a}:${b}`:`${b}:${a}`;if(splits.has(key)||boundaryMap.has(key))continue;const p=points[e],q=points[(e+1)%3],uv=vertices[a].uv.map((v,k)=>(v+vertices[b].uv[k])/2),mid=f.point(uv),curveError=Math.hypot(...mid.map((v,k)=>v-(p[k]+q[k])/2));if(Math.hypot(...p.map((v,k)=>v-q[k]))>edgeMetres||curveError>.0005||(e===longest&&centerError>.0005)){splits.set(key,vertices.length);vertices.push({uv,point:mid});}}
    }
    if(!splits.size)break;const next=[];const mid=(a,b)=>splits.get(a<b?`${a}:${b}`:`${b}:${a}`);
    for(let i=0;i<faces.length;i+=3){const a=faces[i],b=faces[i+1],c=faces[i+2],ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);const n=[ab,bc,ca].filter(x=>x!==undefined).length;
     if(n===0)next.push(a,b,c);else if(n===3)next.push(a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca);
     else if(n===1){if(ab!==undefined)next.push(a,ab,c,ab,b,c);else if(bc!==undefined)next.push(b,bc,a,bc,c,a);else next.push(c,ca,b,ca,a,b);}
     else if(ab===undefined)next.push(c,ca,bc,ca,a,b,ca,b,bc);else if(bc===undefined)next.push(a,ab,ca,ab,b,c,ab,c,ca);else next.push(b,bc,ab,bc,c,a,bc,a,ab);
    }faces=next;if(vertices.length>30000)break;
   }
   const base=pos.length/3;for(const vertex of vertices){const v=evaluate(f,vertex.uv,vertex.seam);pos.push(...v.p);parameters.push(...vertex.uv);boneIds.push(...v.ids);boneWeights.push(...v.ws);if(v.normal){const len=Math.hypot(...v.normal)||1;normalValues.push(...v.normal.map(x=>x/len));}materialValues.push(Math.max(.05,Math.min(1,v.color[3])),Math.max(0,Math.min(1,v.color[4])));colors.push(...v.color.slice(0,3).map(x=>{x=Math.max(0,Math.min(1,x));return x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4)}));chartIds.push(f.c.id);}
   for(let i=0;i<faces.length;i+=3){const a=faces[i],b=faces[i+1],c=faces[i+2],qa=vertices[a].uv,qb=vertices[b].uv,qc=vertices[c].uv,orientation=(qb[0]-qa[0])*(qc[1]-qa[1])-(qb[1]-qa[1])*(qc[0]-qa[0]);const correct=orientation*(f.c.axis===1?-1:1)*f.c.sign>0;indices.push(base+a,base+(correct?b:c),base+(correct?c:b));triangles++;}
  }
 }
 return {positions:new Float32Array(pos),parameters:new Float32Array(parameters),colors:new Float32Array(colors),normals:new Float32Array(normalValues),material:new Float32Array(materialValues),indices:new Uint32Array(indices),skinIndex:new Uint16Array(boneIds),skinWeight:new Float32Array(boneWeights),influences:8,chartIds,functions:funcs,report:{vertices:pos.length/3,triangles,charts:funcs.length,trimLoops,emptyDomains:unclosed,emptyDomainIds}};
}
