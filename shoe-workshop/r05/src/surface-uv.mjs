// Appearance-only least-squares conformal coordinates on the inherited coarse last chart.
// Does not replace the manufacturing pattern or change its recorded distortion.
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export function metricStats(vertices,triangles,uv){const ratios=[];let pos=0,neg=0;for(const t of triangles){const [a,b,c]=t.map(i=>uv[i]),area=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);if(area>1e-8)pos++;if(area< -1e-8)neg++;for(let k=0;k<3;k++){const i=t[k],j=t[(k+1)%3],d=Math.hypot(...sub(vertices[i],vertices[j]));if(d>.1)ratios.push(Math.hypot(...sub(uv[i],uv[j]))/d);}}ratios.sort((a,b)=>a-b);return {p05:ratios[Math.floor(ratios.length*.05)],median:ratios[Math.floor(ratios.length*.5)],p95:ratios[Math.floor(ratios.length*.95)],min:ratios[0],max:ratios.at(-1),flipped:Math.min(pos,neg),edges:ratios.length};}
export function conformalUV(atlas){
 const mesh=atlas.targetMesh,xyz=mesh.vertices.map(q=>atlas.rayPoint(q).p),n=xyz.length,rows=[],diag=new Float64Array(n*2);let first=0,second=1,max=0;
 for(let i=1;i<n;i++){const d=Math.hypot(...sub(xyz[i],xyz[first]));if(d>max){max=d;second=i;}}first=second;max=0;for(let i=0;i<n;i++){const d=Math.hypot(...sub(xyz[i],xyz[first]));if(d>max){max=d;second=i;}}
 for(const tri of mesh.triangles){const [a,b,c]=tri.map(i=>xyz[i]),ab=sub(b,a),ac=sub(c,a),length=Math.hypot(...ab),normal=cross(ab,ac),doubleArea=Math.hypot(...normal);if(length<1e-7||doubleArea<1e-10)continue;const x=dot(ac,ab)/length,y=doubleArea/length,scale=1/Math.sqrt(doubleArea),gx=[-y,y,0].map(v=>v*scale),gy=[x-length,-x,length].map(v=>v*scale);
  const ids=[...tri,...tri.map(i=>i+n)],r1=[...gx,...gy.map(v=>-v)],r2=[...gy,...gx];rows.push({ids,r1,r2});for(let k=0;k<6;k++)diag[ids[k]]+=r1[k]*r1[k]+r2[k]*r2[k];
 }
 const fixed=new Uint8Array(n*2);for(const i of [first,second,first+n,second+n])fixed[i]=1;for(let i=0;i<n*2;i++)if(diag[i]<1e-10)fixed[i]=1;
 const pins=new Float64Array(n*2);pins[second]=max;
 function mul(x,out){out.fill(0);for(const row of rows){let a=0,b=0;for(let k=0;k<6;k++){a+=row.r1[k]*x[row.ids[k]];b+=row.r2[k]*x[row.ids[k]];}for(let k=0;k<6;k++)out[row.ids[k]]+=row.r1[k]*a+row.r2[k]*b;}}
 const ap=new Float64Array(n*2),r=new Float64Array(n*2),p=new Float64Array(n*2),x=new Float64Array(n*2),z=new Float64Array(n*2);mul(pins,ap);let rz=0;for(let i=0;i<n*2;i++)if(!fixed[i]){r[i]=-ap[i];z[i]=r[i]/diag[i];p[i]=z[i];rz+=r[i]*z[i];}const initial=rz;let iterations=0;
 for(;iterations<16000&&rz>Math.max(1e-18,initial*1e-18);iterations++){mul(p,ap);let pap=0;for(let i=0;i<n*2;i++)if(!fixed[i])pap+=p[i]*ap[i];if(pap<1e-25)break;const alpha=rz/pap;let next=0;for(let i=0;i<n*2;i++)if(!fixed[i]){x[i]+=alpha*p[i];r[i]-=alpha*ap[i];z[i]=r[i]/diag[i];next+=r[i]*z[i];}const beta=next/rz;for(let i=0;i<n*2;i++)p[i]=fixed[i]?0:z[i]+beta*p[i];rz=next;}
 let uv=Array.from({length:n},(_,i)=>[x[i]+pins[i],x[i+n]+pins[i+n]]),stats=metricStats(xyz,mesh.triangles,uv),blend=0;
 // Free-boundary LSCM may fold one concave corner. Align the known positive chart,
 // then perform an explicit orientation-preserving line search (never hide the fold).
 const c=[0,0],d=[0,0];for(let i=0;i<n;i++)for(let k=0;k<2;k++){c[k]+=mesh.vertices[i][k]/n;d[k]+=uv[i][k]/n;}let aa=0,bb=0,den=0;
 for(let i=0;i<n;i++){const q=sub(mesh.vertices[i],c),v=sub(uv[i],d);aa+=q[0]*v[0]+q[1]*v[1];bb+=q[0]*v[1]-q[1]*v[0];den+=dot(q,q);}aa/=den;bb/=den;
 const safe=mesh.vertices.map(p=>{const q=sub(p,c);return [aa*q[0]-bb*q[1]+d[0],bb*q[0]+aa*q[1]+d[1]];});const raw=uv;
 if(stats.flipped)for(const t of [.005,.01,.02,.04,.08,.16,.32,.64,1]){const trial=raw.map((q,i)=>q.map((v,k)=>v*(1-t)+safe[i][k]*t)),probe=metricStats(xyz,mesh.triangles,trial);if(!probe.flipped){uv=trial;blend=t;break;}}
 stats=metricStats(xyz,mesh.triangles,uv);const scale=1/stats.median;uv=uv.map(q=>q.map(v=>v*scale));stats=metricStats(xyz,mesh.triangles,uv);
 if(!Number.isFinite(stats.p95)||stats.flipped)throw Error('R05 appearance chart folded or nonfinite '+JSON.stringify(stats));
 return {uv,report:{...stats,positiveChartBlend:blend,iterations,relativeResidual:Math.sqrt(rz/Math.max(initial,1e-30)),role:'APPEARANCE_ONLY_NOT_MANUFACTURING_PATTERN',method:'LSCM + explicit positive-chart line search; median metric normalized to millimetres'}};
}
