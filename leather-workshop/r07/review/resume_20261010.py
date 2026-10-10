"""Apply bounded R07 repairs to existing source; never write r01-r06.
Idempotent. Expanded JavaScript, not this patch, is the browser input.
"""
from pathlib import Path
R=Path(__file__).resolve().parents[1]
def change(file,old,new):
 p=R/file;s=p.read_text()
 if new in s:return
 assert s.count(old)==1,(file,'source drift',s.count(old),old[:80])
 p.write_text(s.replace(old,new))
# A nearest node on a different grid is not the same material point.
change('site/panels.js','this.positions=[];this.triangles=[];this.links=[];this.extraMass=[];','this.positions=[];this.triangles=[];this.links=[];this.surfaceLinks=[];this.extraMass=[];')
change('site/panels.js',"connect(a,uvA,b,uvB){const ai=this.idsAt(a,...uvA),bi=this.idsAt(b,...uvB),A=ai.ids[ai.weights.indexOf(Math.max(...ai.weights))],B=bi.ids[bi.weights.indexOf(Math.max(...bi.weights))];if(A!==B&&!this.links.some(q=>q[0]===A&&q[1]===B))this.links.push([A,B,100000]);}","""connect(a,uvA,b,uvB){
  const A=this.idsAt(a,...uvA),B=this.idsAt(b,...uvB),weights=new Map();
  for(let i=0;i<4;i++){weights.set(A.ids[i],(weights.get(A.ids[i])||0)+A.weights[i]);weights.set(B.ids[i],(weights.get(B.ids[i])||0)-B.weights[i]);}
  const entries=[...weights].filter(([,w])=>Math.abs(w)>1e-10);if(!entries.length)return;
  const delta=V();for(const[id,w]of entries)delta.addScaledVector(V(...this.positions.slice(id*3,id*3+3)),w);
  this.surfaceLinks.push({ids:entries.map(e=>e[0]),weights:entries.map(e=>e[1]),length:delta.length()*.001,stiffness:100000});
 }""")
change('site/panels.js','const data={positions:this.positions,triangles:this.triangles,links:this.links,extraMass:this.extraMass};','const data={positions:this.positions,triangles:this.triangles,links:this.links,surfaceLinks:this.surfaceLinks,extraMass:this.extraMass};')
# Dense joins down the sides and across the bottom; preserve the open pocket mouths.
change('site/products.js','for(const[x,y]of seamWorld)for(let k=1;k<3;k++)b.connect(ps[0],[x,y],ps[k],[x,y-[0,-8.5,-17][k]]);','for(const hole of ps[0].paths[0].holes){const x=hole.uv.x,y=hole.uv.y;for(let k=1;k<3;k++)b.connect(ps[0],[x,y],ps[k],[x,y-[0,-8.5,-17][k]]);}')
change('site/products.js','formed:false,simStep:18});ps.push(part);','formed:false,simStep:12});ps.push(part);')
# Correct the normal of the flattened waxed yarn and seat it against the groove.
change('site/sewing.js','(-.35*(a-half)-.019)','(-.35*(a-half)-.035)')
change('site/sewing.js','n=N.clone().multiplyScalar(Math.cos(a)).addScaledVector(B,Math.sin(a)),','n=N.clone().multiplyScalar(Math.cos(a)/.215).addScaledVector(B,Math.sin(a)/.52).normalize(),')
change('site/grip.mjs','this.tri=[];this.bends=[];this.links=[];','this.tri=[];this.bends=[];this.links=[];this.surfaceLinks=(data.surfaceLinks||[]).map(q=>({...q,lambda:0}));')
change('site/grip.mjs','for(const [id,m]of data.extraMass||[])this.mass[id]+=m;','''for(const q of this.surfaceLinks)for(const a of q.ids)for(const b of q.ids)if(a!==b)this.adj[a].add(b);
  for(const [id,m]of data.extraMass||[])this.mass[id]+=m;''')
change('site/grip.mjs',' grip(dt){if(!this.grab)return;',''' surfaceJoin(q,dt){
  let dx=0,dy=0,dz=0,den=0;for(let i=0;i<q.ids.length;i++){const id=q.ids[i],w=q.weights[i];dx+=w*this.x[3*id];dy+=w*this.x[3*id+1];dz+=w*this.x[3*id+2];den+=w*w*this.inv[id];}
  const len=Math.hypot(dx,dy,dz);if(len<1e-12)return;const alpha=1/(q.stiffness*dt*dt),dl=(-(len-q.length)-alpha*q.lambda)/(den+alpha);q.lambda+=dl;
  for(let i=0;i<q.ids.length;i++){const id=q.ids[i],f=q.weights[i]*this.inv[id]*dl/len;this.x[3*id]+=dx*f;this.x[3*id+1]+=dy*f;this.x[3*id+2]+=dz*f;}
 }
 grip(dt){if(!this.grab)return;''')
change('site/grip.mjs','for(const q of this.bends)q.lambda=0;for(const q of this.links)q.lambda=0;this.lambdaGrab.fill(0);','for(const q of this.bends)q.lambda=0;for(const q of this.links)q.lambda=0;for(const q of this.surfaceLinks)q.lambda=0;this.lambdaGrab.fill(0);')
p=R/'site/grip.mjs';s=p.read_text()
a='for(const q of this.links)this.distance(q,dt);for(const q of this.bends)this.bending(q,dt);'
b='for(const q of this.links)this.distance(q,dt);for(const q of this.surfaceLinks)this.surfaceJoin(q,dt);for(const q of this.bends)this.bending(q,dt);'
if b not in s:
 assert s.count(a)==3,('constraint batch drift',s.count(a))
 p.write_text(s.replace(a,b))
change('site/grip.mjs','return{version:GRIP_VERSION,timeS:this.time,steps:this.steps,extraConvergenceIterations:','''let seamError=0;for(const q of this.surfaceLinks){const d=[0,0,0];for(let i=0;i<q.ids.length;i++)for(let j=0;j<3;j++)d[j]+=q.weights[i]*this.x[3*q.ids[i]+j];seamError=Math.max(seamError,Math.abs(Math.hypot(...d)-q.length)*1000);}
  return{seamConstraintCount:this.surfaceLinks.length,maxSeamGapErrorMM:seamError,version:GRIP_VERSION,timeS:this.time,steps:this.steps,extraConvergenceIterations:''')
change('site/runtime.js',"const VERSION='R07.1'","const VERSION='R07.2'")
change('site/template.html','<title>KAOPU ATELIER — 数字皮匠 R07.1</title>','<title>KAOPU ATELIER — 数字皮匠 R07.2</title>')
p=R/'site/template.html';s=p.read_text();s=s.replace('R07.1 · PRESERVED / EVOLVED','R07.2 · SEWN / GRABBABLE');p.write_text(s)
change('build.py',"'version':'R07.1'","'version':'R07.2'")
# Check explicit current identity and actual application startup.
change('qa.py',"page.wait_for_function('window.LEATHER_ATELIER?.ready',timeout=240000)",'''page.wait_for_function("window.LEATHER_ATELIER?.ready || (document.getElementById('error') && !document.getElementById('error').hidden)",timeout=240000)
  check('R07.2 current runtime starts without an error overlay',page.evaluate("window.LEATHER_ATELIER?.version==='R07.2'"),page.locator('#error').inner_text())''')
change('qa.py',"check('grip propagates force and moves mass centre',held['finite'] and not held['failed'] and held['timeS']>before['timeS'] and held['grabForceN']>0,held)","check('grip propagates force and moves mass centre',held['finite'] and not held['failed'] and held['timeS']>before['timeS'] and held['grabForceN']>0,held)\n  check('wallet seam remains joined while the pointer lifts it',held['seamConstraintCount']>=90 and held['maxSeamGapErrorMM']<1.5,held)")
change('qa.py',"page.locator('#grabTool').click();page.evaluate('LEATHER_ATELIER.resetGrab()')","""page.locator('#grabTool').click();page.evaluate('LEATHER_ATELIER.resetGrab()')
  for object_id in ['belt','bag','cowboy','pirate','swatch']:
   page.evaluate('(id)=>LEATHER_ATELIER.selectProduct(id)',object_id)
   result=page.evaluate('LEATHER_ATELIER.grabTest(true)')
   check(object_id+' real nodal grip, swing and release',result['positionsChanged'] and result['held']['held'] and not result['released']['held'] and result['released']['finite'] and not result['released']['failed'] and result['held']['maxStretch']<1.25,result)
   shot(page,object_id+'-after-swing');page.evaluate('LEATHER_ATELIER.resetGrab()')""")
# Compare only product pixels, not changed labels or selected controls.
change('qa.py',"page.evaluate(\"LEATHER_ATELIER.configure({craft:'plain'});LEATHER_ATELIER.setView('macro')\")","""page.evaluate("LEATHER_ATELIER.configure({craft:'plain'});LEATHER_ATELIER.setView('macro')")
  page.locator('#responseCompare').dispatch_event('pointerdown')
  off_image=shot(page,'seam-response-disabled')
  page.locator('#responseCompare').dispatch_event('pointerup')
  on_image=shot(page,'seam-response-enabled')
  region=page.locator('#stage').bounding_box();box=(int(region['x']),int(region['y']),int(region['x']+region['width']),int(region['y']+region['height']))
  difference=ImageChops.difference(Image.open(off_image).convert('RGB').crop(box),Image.open(on_image).convert('RGB').crop(box))
  check('inherited local surface response changes actual three-dimensional rendering',difference.getbbox() is not None,{'differenceMean':ImageStat.Stat(difference).mean})""")
print('Expanded R07.2 repairs and browser regressions; previous versions untouched.')
