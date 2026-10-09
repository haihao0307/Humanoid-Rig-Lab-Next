from pathlib import Path
R=Path(__file__).resolve().parents[1]
def change(path,old,new):
 p=R/path;s=p.read_text()
 if old in s:
  assert s.count(old)==1,(path,'ambiguous replacement');p.write_text(s.replace(old,new))
 else: assert new in s,(path,'source drift: stop')
change('site/runtime.js',"function render(t=0){if(!ready||mode==='baseline')return;const w=", "function render(t=0){if(!ready||mode==='baseline')return;allDirty=true;const w=")
change('site/runtime.js','${r.residualN.toExponential(1)}','${Number.isFinite(r.residualN)?r.residualN.toExponential(1):\'尚未求解\'}')
change('site/runtime.js','if(f.epoch===workerEpoch&&f.positions)receivePhysics(f);p?.resolve(f);','try{if(f.epoch===workerEpoch&&f.positions)receivePhysics(f);p?.resolve(f);}catch(error){p?.reject(error);fail(error);}')
change('site/runtime.js','renderer.shadowMap.type=T.PCFSoftShadowMap;','renderer.shadowMap.type=T.VSMShadowMap;')
change('site/runtime.js','key.shadow.radius=3;','key.shadow.radius=8;key.shadow.blurSamples=12;')
change('site/products.js',"// Keeper wraps completely around the leather thickness and both edges.\n const keeperFrame=frame(.028),keeper=[];for(const p of roundShape(13,39,3).getPoints(12))keeper.push(keeperFrame.p.clone().addScaledVector(keeperFrame.tan,p.x).add(V(0,p.y,0)).addScaledVector(keeperFrame.rad,2.7));tube(keeper,.8,m.edge,root,true,140);", "// A leather keeper encloses the full cross section, rather than floating on the face.\n const keeperFrame=frame(.028),keeperPath=new T.CatmullRomCurve3(roundShape(s.t+3,s.w+3,1.6).getPoints(16).map(p=>V(p.x,p.y,0)),true,'centripetal');\n const keeperSurface=(u,v)=>{const p=keeperPath.getPointAt(u);return keeperFrame.p.clone().addScaledVector(keeperFrame.rad,p.x).add(V(0,p.y,0)).addScaledVector(keeperFrame.tan,(v-.5)*10);};surface(shell(keeperSurface,84,6,1,keeperPath.getLength(),10,false),m.shell,root,'closed-leather-keeper');")
change('qa.py',"  check('product viewport has non-uniform rendered content',max(ImageStat.Stat(im).stddev)>8)","  check('product viewport has non-uniform rendered content',max(ImageStat.Stat(im).stddev)>8)\n  for selector in ['[data-material=heritage] .thumb','[data-product=wallet] .thumb']:\n   b=page.locator(selector).bounding_box();crop=Image.open(OUT/'01-wallet-studio.png').convert('RGB').crop((b['x']+4,b['y']+4,b['x']+b['width']-4,b['y']+b['height']-4))\n   check(selector+' contains rendered 3D pixels',max(ImageStat.Stat(crop).stddev)>5)")
print('R06 review fixes applied idempotently; protected sources untouched.')
