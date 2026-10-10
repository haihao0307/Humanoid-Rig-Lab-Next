"""One-time visual source corrections. Ordinary resulting sources are committed after QA."""
from pathlib import Path
import json,hashlib
root=Path(__file__).resolve().parents[1]
stamp=root/'R01_2_SOURCE_UPGRADE.json'
if stamp.exists():raise SystemExit(0)
p=root/'src/design-envelope.mjs';s=p.read_text()
s=s.replace('(style.collar+.008)*scale','((style.boot?.074:style.collar)+.008)*scale').replace('alpha=t=>.24+(style.boot?.85:.25)*','alpha=t=>.24+.25*')
s=s.replace('return(style.collar+.014*(1-front)+(style.boot?0:.010*front))*scale+instep;','return((style.boot?.078:style.collar)+.014*(1-front)+.010*front)*scale+instep;')
if 'function heightAt' not in s:
 s=s.replace(' function surf(t,v){',' function heightAt(t,f){const base=sample(rh,t)*Math.pow(f,alpha(t));if(!style.boot)return bottom+base;const u=clamp((f-.82)/.18,0,1),blend=u*u*(3-2*u);return bottom+lerp(base,.18*scale+instep,blend);}\n function surf(t,v){').replace('bottom+sample(rh,t)*Math.pow(f,alpha(t))','heightAt(t,f)')
p.write_text(s)
p=root/'src/geometry.mjs';s=p.read_text()
helper='''
function weldAngularNormals(g,nu,nv,layers=1){
 const pos=g.attributes.position,n=g.attributes.normal,N=(nu+1)*(nv+1);
 for(let layer=0;layer<layers;layer++)for(let j=0;j<=nv;j++){
  const a=layer*N+j*(nu+1),b=a+nu,pa=V().fromBufferAttribute(pos,a),pb=V().fromBufferAttribute(pos,b);
  if(pa.distanceTo(pb)<1e-7){const v=V().fromBufferAttribute(n,a).add(V().fromBufferAttribute(n,b)).normalize();n.setXYZ(a,v.x,v.y,v.z);n.setXYZ(b,v.x,v.y,v.z);}
 }
 return g;
}
function cappedLast(S,material){
 const nu=120,nv=36,g=paramGeometry((u,v)=>S.surf(u*TAU,v),nu,nv,[.7,.15]);
 const p=Array.from(g.attributes.position.array),uv=Array.from(g.attributes.uv.array),idx=Array.from(g.index.array);
 for(const ring of [0,nv]){const points=Array.from({length:nu+1},(_,i)=>S.surf(i/nu*TAU,ring/nv)),c=points.slice(0,nu).reduce((a,b)=>a.add(b),V()).multiplyScalar(1/nu),base=p.length/3;p.push(...c.toArray());uv.push(.5,.5);for(const v of points){p.push(...v.toArray());uv.push(v.x/S.W+.5,v.z/S.L);}for(let i=0;i<nu;i++){if(ring===0)idx.push(base,base+i+2,base+i+1);else idx.push(base,base+i+1,base+i+2);}}
 g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.deleteAttribute('normal');g.computeVertexNormals();weldAngularNormals(g,nu,nv);return makeMesh(g,material,'封口的视觉设计鞋楦');
}
'''
s=s.replace('function interp(',helper+'\nfunction interp(',1)
s=s.replace('g.computeVertexNormals();return g;','g.computeVertexNormals();weldAngularNormals(g,nu,nv);return g;',1)
s=s.replace('out.computeVertexNormals();g.dispose();return out;','out.computeVertexNormals();weldAngularNormals(out,nu,nv,2);g.dispose();return out;',1)
s=s.replace('[[L*.69,.040*scale],[L*.39,.038*scale]]','[[L*.73,.040*scale],[L*.49,.038*scale]]')
a=s.index('   const buckle=');b=s.index('\n  }',a)
s=s[:a]+'''   const on=(u,v)=>strap(u,v).add(V(0,.0023*scale,0));
   const pts=[on(.68,.2),on(.84,.2),on(.84,.8),on(.68,.8)];hardware.add(tube(pts,.0010*scale,pal.metal,'贴合鞋带的闭合金属扣',true));hardware.add(tube([on(.76,.2),on(.76,.8)],.0006*scale,pal.metal,'带扣针'));'''+s[b:]
s=s.replace("makeMesh(volumize(paramGeometry((u,v)=>surf(u*TAU,v),120,26,[.7,.13]),120,26,.0018*scale),pal.wood,'参数化鞋楦包络')",'cappedLast(S,pal.wood)')
p.write_text(s)
p=root/'src/app.mjs';s=p.read_text().replace('R01.1','R01.2').replace('const wide=bodyMode?1.24:1;','const wide=bodyMode?1.58:currentStyle().boot?1.2:1;')
s=s.replace('let target=V(0,exploded?.087:.052,bodyMode?.08:L*.49),pos;','let target=V(0,exploded?.087:currentStyle().boot?.108:.052,bodyMode?.08:L*.49),pos;')
s=s.replace('for(const style of STYLES){const p=palette', 'for(const style of STYLES){if(style.boot){c.position.set(.46,.29,.48);c.lookAt(0,.102,.14);}else{c.position.set(.39,.22,.42);c.lookAt(0,.052,.14);}const p=palette')
s=s.replace('window.SHOE_QA={ready:false,stats,config,', "window.SHOE_QA={ready:false,stats,config,async sourceBodyCheck(){if(!bodyMesh)return {available:false};const a=bodyMesh.geometry.attributes.position.array,buf=await crypto.subtle.digest('SHA-256',a),hash=Array.from(new Uint8Array(buf),b=>b.toString(16).padStart(2,'0')).join('');return {available:true,matches:hash===currentBody().positionsSha256,hash};},")
p.write_text(s)
p=root/'tools/test.mjs';s=p.read_text()
s=s.replace(' const settle=async()=>', " const image=async()=>Buffer.from(await page.evaluate(()=>document.querySelector('#viewport canvas').toDataURL('image/png').split(',')[1]),'base64');\n const settle=async()=>")
s=s.replace('await page.screenshot({timeout:90000})','await image()')
s=s.replace('const s=await page.evaluate(()=>SHOE_QA.stats());check(`wear-', 'const bodyCheck=await page.evaluate(()=>SHOE_QA.sourceBodyCheck());check(`unaltered-body-${person}-${style}`,bodyCheck.matches,bodyCheck);const s=await page.evaluate(()=>SHOE_QA.stats());check(`wear-')
s=s.replace(" check('no-javascript-or-shader-errors'", " const offline=await browser.newPage({viewport:{width:1200,height:900}});let external=0;await offline.route('**/*',r=>{if(/^https?:/.test(r.request().url())){external++;return r.abort();}return r.continue();});await offline.goto('file://'+path.join(root,'preview.html'));await offline.waitForFunction(()=>window.SHOE_QA?.ready&&SHOE_QA.stats().thumbReady,{},{timeout:90000});await offline.evaluate(()=>SHOE_QA.setStyle('loafer'));check('standalone-file-without-network',external===0&&(await offline.evaluate(()=>SHOE_QA.stats().style))==='loafer',{external});await offline.close();\n check('no-javascript-or-shader-errors'")
p.write_text(s)
p=root/'index.html';s=p.read_text().replace('R01.0','R01.2').replace('class="version">R01<','class="version">R01.2<');p.write_text(s)
stamp.write_text(json.dumps({'schema':'kaopu-shoe-source-upgrade/1','version':'R01.2','changes':['separate low vamp and boot shaft','weld periodic normals before and after thickness','close visual last','move sandal straps forward','fit wear and boot cameras','verify actual body buffer','offline regression'],'files':{p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in ['src/app.mjs','src/design-envelope.mjs','src/geometry.mjs','tools/test.mjs']}},indent=2))
