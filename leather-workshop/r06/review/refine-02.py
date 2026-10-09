from pathlib import Path
R=Path(__file__).resolve().parents[1]
def change(path,old,new):
 p=R/path;s=p.read_text()
 if old in s:
  assert s.count(old)==1,(path,'ambiguous replacement');p.write_text(s.replace(old,new))
 else: assert new in s,(path,'source drift: stop')
change('site/runtime.js',"window.addEventListener('resize',()=>{allDirty=dirty=true;});","window.addEventListener('resize',()=>{if(ready&&mode!=='baseline')setView(view);allDirty=dirty=true;});")
change('site/runtime.js','function recipe(){return{',"function frameAudit(){hero.updateMatrixWorld(true);camera.updateMatrixWorld(true);const b=new T.Box3().setFromObject(hero),points=[];for(const x of[b.min.x,b.max.x])for(const y of[b.min.y,b.max.y])for(const z of[b.min.z,b.max.z])points.push(V(x,y,z).project(camera).toArray());return{maxAbsX:Math.max(...points.map(p=>Math.abs(p[0]))),maxAbsY:Math.max(...points.map(p=>Math.abs(p[1]))),inDepth:points.every(p=>p[2]>-1&&p[2]<1),points};}\nfunction recipe(){return{")
change('site/runtime.js','switchMode,render,recipe,patternSVG,audit:', 'switchMode,render,recipe,frameAudit,patternSVG,audit:')
change('qa.py',"  check('mobile viewport has no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))", "  check('mobile viewport has no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))\n  bounds=page.evaluate('LEATHER_ATELIER.frameAudit()');check('resize automatically refits the visible product',bounds['maxAbsX']<.99 and bounds['maxAbsY']<.99 and bounds['inDepth'],bounds)\n  for product_id in ['wallet','belt','bag','hat','swatch']:\n   page.evaluate('(id)=>LEATHER_ATELIER.selectProduct(id)',product_id);photo(page,'mobile-fitted-'+product_id)\n   bounds=page.evaluate('LEATHER_ATELIER.frameAudit()');check(product_id+' full mobile product bounds stay in frame',bounds['maxAbsX']<.99 and bounds['maxAbsY']<.99 and bounds['inDepth'],bounds)")
print('R06 resize-to-fit correction and projected-bounds regression applied; protected sources unchanged.')
