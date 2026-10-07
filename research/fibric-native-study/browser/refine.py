"""Audited R1 visual corrections, applied to recovered readable source."""
from pathlib import Path
import sys
src=Path(sys.argv[1]) if len(sys.argv)>1 else Path('out/source')
a=(src/'app.js').read_text();h=(src/'index.html').read_text()
def patch(old,new):
    global a
    assert a.count(old)==1,(old,a.count(old))
    a=a.replace(old,new,1)
patch("warp:'#a5987c',weft:'#655c4c'", "warp:'#b7a888',weft:'#9b8a6b'")
patch('b0=.055-C.flatten*.025','b0=.070-C.flatten*.025')
patch('const fiberCount=8,step=2,','const fiberCount=24,step=4,')
patch('variance=.90+.21*hash(f+c.index*11)','variance=.72+.40*hash(f+c.index*11)')
patch('const start=bu.v,col=tint(c,s,variance),r=.0022;','const start=bu.v,col=tint(c,s,variance),r=.0042;')
patch('p2.map((a,i)=>a-p[i])','p2.map((a,i)=>(a-p[i])*(s0+ds>=npts-1?-1:1))')
patch('seed=765821;const fuzzN=1000','seed=765821;const fuzzN=3200')
patch('r=.0015*(1-.85*t)','r=.0025*(1-.85*t)')
patch('roughness:detail?.57:.64','roughness:detail?.58:.79')
patch('normalScale:new T.Vector2(.30,.18)','normalScale:new T.Vector2(.82,.36)')
patch('return {g,bulkG,fiberG,minZ:box.min.z};','return {g,bulkG,fiberG,minZ:box.min.z,box};')
patch('camera.bokehSize=0;camera.fStop=10;','camera.fStop=10;camera.bokehSize=0;')
patch('camera.bokehSize=C.dof?.07:0','camera.bokehSize=C.dof?90:0')
patch('pt.filterGlossyFactor=.7','pt.filteredGlossyFactor=.7')
patch('pt.lowResScale=.22','pt.lowResScale=.15')
patch('pt.renderScale=C.quality;pt.reset();','pt.renderScale=C.quality;pt.pausePathTracing=false;pt.reset();')
patch('if(pt){pt.updateMaterials();pt.reset();}','if(pt){pt.pausePathTracing=false;pt.updateMaterials();pt.reset();}')
begin=a.index('function setView(name)');end=a.index('function saveFile(',begin)
a=a[:begin]+'''function setView(name){
 C.view=name;const W=geoData?geoData.W:20;
 let target=v3(0,0,.2),pos=name==='macro'?v3(1.5,-4.8,6.0):name==='edge'?v3(W*.81,-W*.63,W*.22):v3(W*.66,-W*.87,W*.87);
 camera.fov=name==='macro'?40:38;
 if(name==='hero'&&model){
  target=model.box.getCenter(v3());const outward=v3(.66,-.87,.87).normalize(),right=v3().crossVectors(camera.up,outward).normalize(),up=v3().crossVectors(outward,right).normalize();
  const tv=Math.tan(camera.fov*PI/360),th=tv*camera.aspect;let dist=0;
  for(const x of [model.box.min.x,model.box.max.x])for(const y of [model.box.min.y,model.box.max.y])for(const z of [model.box.min.z,model.box.max.z]){const q=v3(x,y,z).sub(target),depth=q.dot(outward);dist=Math.max(dist,depth+Math.abs(q.dot(right))/th,depth+Math.abs(q.dot(up))/tv);}
  pos=target.clone().addScaledVector(outward,dist*1.16);
 }
 controls.target.copy(target);camera.position.copy(pos);camera.lookAt(target);camera.near=.01;camera.far=300;camera.focusDistance=camera.position.distanceTo(target);camera.updateProjectionMatrix();controls.update();dirty=true;
 if(pt){pt.pausePathTracing=false;pt.updateCamera();pt.reset();}
 document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
}
''' +a[end:]
patch('camera.aspect=w/h;camera.updateProjectionMatrix();if(pt)',"camera.aspect=w/h;camera.updateProjectionMatrix();if(C.view==='hero')setView('hero');if(pt)")
patch('window.__YARN_TEST__={setView,lighting,rebuild,toggleTrace,renderer,scene,camera,controls,config:C};','window.__YARN_TEST__={setView,lighting,rebuild,toggleTrace,renderer,scene,camera,controls,config:C,finishFrame(){renderer.render(scene,camera);renderer.getContext().finish();dirty=false;},pauseTrace(){if(pt)pt.pausePathTracing=true;},isBusy(){return busy;}};')
patch("'精看已收敛'","'已累计 '+Math.floor(s)+' spp'")
patch('openFraction:data.openFraction,generatedGeometry','openFraction:data.openFraction,exactFlatOpenFraction:data.exactFlatOpenFraction,generatedGeometry')
patch('async function rebuild(){if(busy)return;','let pendingRebuild=false;async function rebuild(){if(busy){pendingRebuild=true;return;}')
patch("finally{busy=false;$('loading').classList.add('hidden');}}", "finally{busy=false;$('loading').classList.add('hidden');if(pendingRebuild){pendingRebuild=false;await rebuild();}}}")
h=h.replace('#a5987c','#b7a888').replace('#655c4c','#9b8a6b').replace('羊毛式人字纹','双面人字纹').replace('接触压扁','截面压扁').replace('压扁与接触为几何约束','压扁参数控制包络截面；接触仅为采样几何约束')
(src/'app.js').write_text(a);(src/'index.html').write_text(h)
print('Applied fiber density, color separation, camera fit, optical aperture and queued updates.')
