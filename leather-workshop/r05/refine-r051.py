"""R05-only inspection fixes. No writes to any accepted physics file."""
from pathlib import Path
r=Path(__file__).resolve().parent
p=r/'site/seam.mjs';s=p.read_text()
start=s.index('function roundRoute(');end=s.index('export function buildSeam(',start)
rounded='''function roundRoute(points,radius){
 const distanceToSegment=(p,a,b)=>{const v=b.map((x,i)=>x-a[i]),l=v.reduce((s,x)=>s+x*x,0),t=Math.max(0,Math.min(1,p.reduce((s,x,i)=>s+(x-a[i])*v[i],0)/Math.max(l,1e-20)));return Math.hypot(...p.map((x,i)=>x-a[i]-t*v[i]));};
 function simplify(p){if(p.length<3)return p;let max=0,index=0;for(let i=1;i<p.length-1;i++){const d=distanceToSegment(p[i],p[0],p.at(-1));if(d>max){max=d;index=i;}}if(max<radius*.024)return [p[0],p.at(-1)];return [...simplify(p.slice(0,index+1)).slice(0,-1),...simplify(p.slice(index))];}
 const raw=points.filter((p,i)=>i===0||dist(points[i-1],p)>1e-8),a=simplify(raw);if(a.length<3)return a;
 const out=[a[0]];
 for(let i=1;i<a.length-1;i++){
  const x=a[i-1],p=a[i],y=a[i+1],l=dist(x,p),m=dist(p,y),rr=Math.min(radius,l*.40,m*.40);
  const u=p.map((q,k)=>mix(q,x[k],rr/l)),v=p.map((q,k)=>mix(q,y[k],rr/m));out.push(u);
  for(let j=1;j<=20;j++){const f=j/20;out.push(p.map((q,k)=>(1-f)*(1-f)*u[k]+2*(1-f)*f*q+f*f*v[k]));}
 }
 out.push(a.at(-1));return out;
}
'''
s=s[:start]+rounded+s[end:];s=s.replace('roundRoute(r.points,p.diameter*.46)','roundRoute(r.points,p.diameter*.85)')
continuous='''export function continuousRoutes(model){
 if(model.process||model.params.type!=='saddle')return model.routes;
 const raw=r=>{const a=[r.points[0]];for(const s of r.parts)join(a,s.points);return a;};
 const routes=[];
 for(let row=0;row<model.params.rows;row++){
  const a=model.routes.find(r=>r.id===`r${row}-A`),b=model.routes.find(r=>r.id===`r${row}-B`),seed=model.routes.find(r=>r.id===`r${row}-seed`);
  const points=raw(a).reverse().concat(raw(seed).slice(1),raw(b).slice(1));
  routes.push({id:`r${row}-continuous`,threadId:`thread-${row}`,half:'whole',points:roundRoute(points,model.params.diameter*.85),hasArtificialFirstHoleCaps:false});
 }
 return routes;
}
'''
if 'export function continuousRoutes(' not in s:s=s.replace('export function routeLength(',continuous+'\nexport function routeLength(')
p.write_text(s)
p=r/'site/geometry.js';s=p.read_text()
start=s.index(' const capMask=') if ' const capMask=' in s else s.index(' for(const [ringIndex,reverse]of [[0,true],[n-1,false]])')
end=s.index(' const g=new T.BufferGeometry();',start)
cap=''' const capMask=new Array(pos.length/3).fill(0);
 for(const [ringIndex,reverse]of [[0,true],[n-1,false]]){
  const start=pos.length/3;
  for(let j=0;j<=sides;j++){const k=ringIndex*(sides+1)+j,a=j/sides*Math.PI*2;pos.push(pos[k*3],pos[k*3+1],pos[k*3+2]);uv.push(.5+.5*Math.cos(a),.5+.5*Math.sin(a));color.push(1,1,1);capMask.push(1);}
  const cidx=pos.length/3;pos.push(...out[ringIndex]);uv.push(.5,.5);color.push(1,1,1);capMask.push(1);
  for(let j=0;j<sides;j++){const a=start+j,b=a+1;if(reverse)idx.push(cidx,b,a);else idx.push(cidx,a,b);}
 }
'''
s=s[:start]+cap+s[end:]
needle="g.setAttribute('color',new T.Float32BufferAttribute(color,3));g.setIndex(idx);g.computeVertexNormals();"
if "g.setAttribute('capMask'" not in s:
 assert s.count(needle)==1;s=s.replace(needle,"g.setAttribute('color',new T.Float32BufferAttribute(color,3));g.setAttribute('capMask',new T.Float32BufferAttribute(capMask,1));g.setIndex(idx);g.computeVertexNormals();")
s=s.replace('g.userData={routeLengthMM:total,plies:', 'g.userData={ringCount:n,ringStride:sides+1,barrelIndexCount:(n-1)*sides*6,routeLengthMM:total,plies:')
p.write_text(s)
p=r/'site/runtime.js';s=p.read_text()
s=s.replace('buildSeam,validateSeam,auditSeam}', 'buildSeam,validateSeam,auditSeam,continuousRoutes}')
if 'function displayRoutes()' not in s:s=s.replace('function rebuildThreads()', "function displayRoutes(){return view==='route'?model.routes:continuousRoutes(model);}\nfunction rebuildThreads()")
s=s.replace('for(const r of model.routes){','for(const r of displayRoutes()){')
if 'mat.onBeforeCompile=s=>' not in s:
 start=s.index('function threadMat(');end=s.index('function needle(',start)
 old=s[start:end];old=old.replace('return new T.MeshPhysicalMaterial(', 'const mat=new T.MeshPhysicalMaterial(')
 old=old.replace('vertexColors:true});}',r'''vertexColors:true});
 mat.onBeforeCompile=s=>{
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute float capMask;varying float vCap;');
  s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCap=capMask;');
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying float vCap;');
  s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>','if(vCap<.5){\n#include <map_fragment>\n}');
  s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>','if(vCap<.5){\n#include <normal_fragment_maps>\n}');
 };mat.customProgramCacheKey=()=> 'thread-outside-r051';return mat;}
'''.replace('\\n','\n'))
 # Keep literal JS escaped newlines, not multiline single quoted strings.
 old=old.replace("'#include <common>\n", "'#include <common>\\n").replace("'#include <begin_vertex>\n", "'#include <begin_vertex>\\n")
 s=s[:start]+old+s[end:]
s=s.replace("view=k;\n const h=model.holes", "const routeChanged=(view==='route')!==(k==='route');view=k;if(routeChanged)rebuildThreads();\n const h=model.holes")
start=s.index('function setProcess(');end=s.index('function watch()',start)
s=s[:start]+'''function setProcess(phase,hole=null){
 const j=hole??process?.hole??Math.floor(params.count/2);process={hole:Math.min(params.count-1,Math.max(1,j)),phase:Math.max(0,Math.min(1,phase))};
 const key=process.hole+':'+Math.floor(Math.max(0,process.phase-.75)*20);
 if(model.contactKey!==key){rebuild();model.contactKey=key;}else{const f=model.contact;model=buildSeam(params,process);model.contact=f;model.contactKey=key;rebuildThreads();sync();revision++;}
}
'''+s[end:]
s=s.replace("route:buildSeam(params),audit:auditSeam(buildSeam(params))}","route:buildSeam(params),audit:auditSeam(buildSeam(params)),surfaceResponse:model.contact.stats,renderedRoutes:displayRoutes().map(r=>({...r,points:r.points.map(p=>mapSurfacePoint(model,p))})),educationalProcess:process}")
p.write_text(s)
p=r/'build.py';s=p.read_text().replace('auditSeam,insideHole\'','auditSeam,insideHole,continuousRoutes\'');p.write_text(s)
p=r/'test-r051.mjs';s=p.read_text().replace('i<pa.count-35','i<g.userData.ringCount*g.userData.ringStride-33');p.write_text(s)
print('R05-only: robust bend radius, true single continuous thread, outward isolated end caps, sewing-stage skin loads.')
