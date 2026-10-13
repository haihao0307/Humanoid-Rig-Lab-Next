"""Finish one-time R16 registration before canonical source is committed/tested.
Normal build never imports this script. Preserve all specimen solver commands.
"""
from pathlib import Path
import json,hashlib,shutil
H=Path(__file__).resolve().parent;R=H.parent/'r16';p=R/'src/app/runtime.js';s=p.read_text()
a="$('pausePhysics').textContent=physicsPlaying?'暂停计算':'继续计算';};$('resetPhysics')"
b="$('pausePhysics').textContent=physicsPlaying?'暂停计算':'继续计算';requestViewFrame();};$('resetPhysics')"
assert s.count(a)==1;s=s.replace(a,b)
a="await askWorker('drop');physicsPlaying=true;";assert s.count(a)==1;s=s.replace(a,a+'requestViewFrame();')
a="await askWorker('remove');physicsPlaying=true;";assert s.count(a)==1;s=s.replace(a,a+'requestViewFrame();');p.write_text(s)
shutil.copy2(H/'README.md',R/'README.md')
p=R/'build.py';s=p.read_text().replace('version="R13.0-S1C",architecture="R16-RENDER"','version="R16.0-RENDER",architecture="R16-RENDER"');p.write_text(s)
p=R/'qa-render-batch.py';s=p.read_text();a="   refctx,ref=new('reference',(R.parent/'r15/public-lite.html').resolve().as_uri())"
b="""   p.evaluate('LEATHER_ATELIER.switchMode("physics")');p.wait_for_function('LEATHER_ATELIER.physics?.steps>0');p.evaluate('LEATHER_ATELIER.pausePhysics()');p.wait_for_timeout(300);t=p.evaluate('LEATHER_ATELIER.physics.timeS');p.locator('#pausePhysics').click();p.wait_for_function('(t)=>LEATHER_ATELIER.physics.timeS>t',arg=t);check('Paused specimen resumes from an idle display clock',p.evaluate('LEATHER_ATELIER.physicsPlaying'));p.evaluate('LEATHER_ATELIER.switchMode("products")');p.wait_for_timeout(300)
   refctx,ref=new('reference',(R.parent/'r15/public-lite.html').resolve().as_uri())"""
assert s.count(a)==1;p.write_text(s.replace(a,b))
p=R/'canonical.lock.json';lock=json.loads(p.read_text())
for name,q in lock['files'].items():
 f=R/name
 if f.exists():q['sha256']=hashlib.sha256(f.read_bytes()).hexdigest();q['bytes']=f.stat().st_size
p.write_text(json.dumps(lock,indent=2)+'\n')
print('All display wakeup paths registered; final canonical sources ready for tests')
