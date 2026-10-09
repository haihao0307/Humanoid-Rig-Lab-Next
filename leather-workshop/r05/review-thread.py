"""Idempotent review patch; only R05 files. Expanded site source remains authoritative."""
from pathlib import Path
r=Path(__file__).resolve().parent
s=r/'site/seam.mjs';t=s.read_text()
add='''
/** Bounded fillets at entry/exit remove artificial 90-degree tube joints.
 * Topological segment endpoints remain in parts; points is the final rendered/exported route.
 */
function roundRoute(points,radius){
 const a=[];
 for(const p of points){
  if(a.length&&dist(a.at(-1),p)<1e-8)continue;
  while(a.length>1){const x=a.at(-2),y=a.at(-1),u=y.map((v,i)=>v-x[i]),v=p.map((q,i)=>q-y[i]),lu=Math.hypot(...u),lv=Math.hypot(...v);if(u.reduce((s,q,i)=>s+q*v[i],0)/(lu*lv)<.99995)break;a.pop();}
  a.push(p);
 }
 if(a.length<3)return a;
 const out=[a[0]];
 for(let i=1;i<a.length-1;i++){
  const x=a[i-1],p=a[i],y=a[i+1],l=dist(x,p),m=dist(p,y),rr=Math.min(radius,l*.36,m*.36);
  const u=p.map((q,k)=>mix(q,x[k],rr/l)),v=p.map((q,k)=>mix(q,y[k],rr/m));
  out.push(u);
  for(let j=1;j<=12;j++){const f=j/12;out.push(p.map((q,k)=>(1-f)*(1-f)*u[k]+2*(1-f)*f*q+f*f*v[k]));}
 }
 out.push(a.at(-1));return out;
}
'''
if 'function roundRoute(points,radius)' not in t:
 a='export function buildSeam(input={},process=null){';assert t.count(a)==1;t=t.replace(a,add+'\n'+a)
 a=" return {schema:'kaopu/leather_sewing@1'";assert t.count(a)==1;t=t.replace(a," for(const r of routes)r.points=roundRoute(r.points,p.diameter*.7);\n"+a)
s.write_text(t)
s=r/'site/geometry.js';t=s.read_text()
new='''export function makeThreadGeometry(points,diameter,detail=true){
 const {out,lengths,total}=resample(points,diameter*.16),n=out.length;
 if(n<2)return new T.BufferGeometry();
 const normals=[],bins=[];let N=new T.Vector3(0,0,1),prev;
 for(let i=0;i<n;i++){
  const t=out[Math.min(n-1,i+1)].clone().sub(out[Math.max(0,i-1)]).normalize();if(t.lengthSq()<.1)t.set(0,1,0);
  if(i===0){N.addScaledVector(t,-N.dot(t));if(N.lengthSq()<.01)N.set(0,1,0).addScaledVector(t,-t.y);N.normalize();}
  else N.applyQuaternion(new T.Quaternion().setFromUnitVectors(prev,t)).normalize();
  const B=new T.Vector3().crossVectors(t,N).normalize();N=new T.Vector3().crossVectors(B,t).normalize();normals.push(N.clone());bins.push(B);prev=t;
 }
 const pos=[],uv=[],idx=[],color=[],sides=detail?14:8;
 // A compact waxed thread has a continuous core, not three separated rope tubes.
 // Three-ply twist is shallow radial relief; high-frequency fibres stay in the normal map.
 for(let i=0;i<n;i++){
  const phase=lengths[i]/(diameter*2.7)*Math.PI*2;
  for(let j=0;j<=sides;j++){
   const a=j/sides*Math.PI*2,rr=diameter*.48*(detail?1+.025*Math.cos(3*a-phase):1);
   const q=out[i].clone().addScaledVector(normals[i],Math.cos(a)*rr).addScaledVector(bins[i],Math.sin(a)*rr);
   pos.push(...q);uv.push(lengths[i]/(diameter*2.7),j/sides);
   const tone=detail?.985+.015*Math.cos(3*a-phase):1;color.push(tone,tone,tone);
   if(i<n-1&&j<sides){const k=i*(sides+1)+j;idx.push(k,k+sides+1,k+1,k+1,k+sides+1,k+sides+2);}
  }
 }
 for(const [ringIndex,reverse]of [[0,true],[n-1,false]]){
  const cidx=pos.length/3;pos.push(...out[ringIndex]);uv.push(0,0);color.push(1,1,1);
  for(let j=0;j<sides;j++){const a=ringIndex*(sides+1)+j,b=a+1;if(reverse)idx.push(cidx,b,a);else idx.push(cidx,a,b);}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('color',new T.Float32BufferAttribute(color,3));g.setIndex(idx);g.computeVertexNormals();
 const nn=g.attributes.normal;for(let i=0;i<n;i++){const a=i*(sides+1),b=a+sides,v=new T.Vector3(nn.getX(a)+nn.getX(b),nn.getY(a)+nn.getY(b),nn.getZ(a)+nn.getZ(b)).normalize();nn.setXYZ(a,...v);nn.setXYZ(b,...v);}
 g.userData={routeLengthMM:total,plies:detail?3:1,structure:'continuous core with shallow twist relief',hasEndCaps:true};return g;
}
'''
if "structure:'continuous core with shallow twist relief'" not in t:
 start=t.index('export function makeThreadGeometry(');end=t.index('export function fibreNormalTexture()',start);t=t[:start]+new+t[end:]
s.write_text(t)
s=r/'site/runtime.js';t=s.read_text()
for old,new in [
 ('roughness:.68,metalness:0,sheen:.35','roughness:.84,metalness:0,sheen:.23'),
 ('normalScale:new T.Vector2(.28,.28)','normalScale:new T.Vector2(.10,.10)'),
 ('mesh.castShadow=mesh.receiveShadow=true;mesh.userData.routeId','mesh.castShadow=true;mesh.receiveShadow=false;mesh.userData.routeId'),
 ('obj.receiveShadow=obj.castShadow=true','obj.receiveShadow=true;obj.castShadow=false'),
 ('obj.castShadow=obj.receiveShadow=true','obj.castShadow=false;obj.receiveShadow=true'),
 ("mesh.castShadow=view==='home'||view==='macro';","mesh.castShadow=false;"),
 ('light.shadow.bias=-.00001;light.shadow.normalBias=.015','light.shadow.bias=-.00010;light.shadow.normalBias=.05')]:
 if old in t:t=t.replace(old,new)
 else:assert new in t,old
s.write_text(t)
print('R05 reviewed: bounded entry fillets, compact thread core and shadow-acne correction. R04 untouched.')
