"""Actual unmodified file/public WebGL pages; exact-step batches are diagnostics,
not prerecorded motion or a real-time performance benchmark. No watchdog bypass.
"""
from pathlib import Path
from datetime import datetime,timezone
import argparse,base64,hashlib,io,json,os,traceback,time
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright
P=Path(__file__).resolve().parent;O=P/'evidence';O.mkdir(exist_ok=True)
ap=argparse.ArgumentParser();ap.add_argument('--public');a=ap.parse_args();mode='public' if a.public else 'file'
r={'passed':False,'mode':mode,'startedAt':datetime.now(timezone.utc).isoformat(),'states':[],'network':{},'realPhone':False,'hardwareFPSVerified':False,'instrumentedRuntime':False,'deterministicAdvanceIsDiagnostic':True}
def save(): (O/(mode+'-qa.json')).write_text(json.dumps(r,ensure_ascii=False,indent=2))
def boot(b,name,url=None,mobile=False):
 c=b.new_context(viewport={'width':390,'height':844} if mobile else {'width':1000,'height':780},device_scale_factor=1,is_mobile=mobile,has_touch=mobile);p=c.new_page();p.set_default_timeout(240000)
 n={'pageErrors':[],'consoleErrors':[],'httpErrors':[],'requests':[]};r['network'][name]=n
 p.on('pageerror',lambda e:n['pageErrors'].append(str(e)))
 p.on('console',lambda m:n['consoleErrors'].append({'url':m.location.get('url'),'text':m.text}) if m.type=='error' else None)
 p.on('request',lambda q:n['requests'].append(q.url))
 p.on('response',lambda q:n['httpErrors'].append({'url':q.url,'status':q.status}) if q.status>=400 else None)
 p.goto(url or a.public or (P/'index.html').as_uri(),wait_until='domcontentloaded',timeout=180000)
 p.wait_for_function('window.__DENIM_WORKBENCH__?.lastFrame||document.querySelector("#error")?.textContent?.trim()')
 error=p.locator('#error').inner_text();assert not error.strip(),error
 p.wait_for_function('__DENIM_WORKBENCH__.physicsReady()');return c,p

def wait(p,condition):p.wait_for_function('(()=>{const A=window.__DENIM_WORKBENCH__;return A.contextLost||('+condition+');})()')
def idle(p):wait(p,'!A.state.animate&&A.renderIdle()')
def capture(p,name,settle=True):
 if settle:idle(p)
 raw=base64.b64decode(p.evaluate('document.querySelector("#view").toDataURL().split(",")[1]'));im=np.asarray(Image.open(io.BytesIO(raw)).convert('RGB'))
 q=p.evaluate('({version:__DENIM_WORKBENCH__.version,frame:__DENIM_WORKBENCH__.lastFrame,latest:__DENIM_WORKBENCH__.physicsReport(),generation:__DENIM_WORKBENCH__.physicsGeneration(),state:{...__DENIM_WORKBENCH__.state},gl:__DENIM_WORKBENCH__.getGLError(),lost:!!__DENIM_WORKBENCH__.contextLost})')
 q.update(name=name,pixelStd=float(im.std()),imageSha256=hashlib.sha256(raw).hexdigest());r['states'].append(q);(O/(mode+'-'+name+'.png')).write_bytes(raw);save()
 assert not q['lost'] and q['gl']==0 and im.std()>2,(name,q['gl'],q['lost'])
 print('STATE',name,q['version'],'frame',q['frame']['frame'],'sim',q['frame']['physics'].get('steps'),flush=True);return im,q

def enter(p,which):
 p.evaluate('(x)=>__DENIM_WORKBENCH__.enterExperiment(x,false)',which)
 wait(p,'A.physicsReady()&&A.physicsReport()?.experiment==='+json.dumps(which))
 wait(p,'A.lastFrame.physics?.experiment==='+json.dumps(which)+'&&A.lastFrame.physics.steps===0');idle(p)
def advance(p,seconds):
 old=p.evaluate('__DENIM_WORKBENCH__.physicsReport().steps');target=old+round(seconds*240)
 p.evaluate('(s)=>__DENIM_WORKBENCH__.advanceExperiment(s)',seconds);wait(p,f'A.lastFrame.physics.steps>={target}');idle(p)
 assert p.evaluate('__DENIM_WORKBENCH__.lastFrame.physics.steps')==target

def view(p,patch):
 old=p.evaluate('__DENIM_WORKBENCH__.lastFrame.frame');p.evaluate('(v)=>__DENIM_WORKBENCH__.setState(v)',patch);wait(p,f'A.lastFrame.frame>{old}');idle(p)
def networks():
 icon='https://htmlpreview.github.io/favicon.ico'
 for name,n in r['network'].items():
  assert not n['pageErrors'],(name,n)
  assert not [q for q in n['httpErrors'] if not(q['url']==icon and q['status']==404)],(name,n)
  assert not [q for q in n['consoleErrors'] if not(q['url']==icon and '404' in q['text'])],(name,n)
  if mode=='file':assert not [u for u in n['requests'] if u.startswith('http')],(name,n)

with sync_playwright() as pw:
 b=pw.chromium.launch(headless=False,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']);r['browserVersion']=b.version;p=None
 try:
  c,p=boot(b,'desktop');initial,q=capture(p,'original-material');assert q['version']=='R14.0'
  if mode=='file':
   pc,pp=boot(b,'frozen-R13',url=(P.parent/'r13/index.html').as_uri());old,_=capture(pp,'parent-original');d=np.abs(old.astype(int)-initial.astype(int));r['originalAppearance']={'mean':float(d.mean()),'max':int(d.max()),'gate':'exact fixed original default canvas'};assert d.max()==0;pc.close()
  recipe=p.evaluate('__DENIM_WORKBENCH__.recipe()');legacy={**recipe,'generator':'R13.0'};p.evaluate('(x)=>__DENIM_WORKBENCH__.loadRecipe(x)',legacy);wait(p,'A.physicsReady()');r['legacyRecipeAccepted']=True
  enter(p,'fold');flat,_=capture(p,'continuous-rest');assert p.locator('#damage').is_disabled()
  advance(p,1);capture(p,'continuous-part-fold');advance(p,2);closed,q=capture(p,'continuous-closed');d=q['frame']['physics'];r['standardFold']=d
  assert d['model']=='continuous-curvature-sheet@1' and d['steps']==720 and d['brokenBonds']==0 and d['curvedSegments']>=6 and d['maxNeighbourTurnDegrees']<80 and d['maxTensileStrain']<.03 and d['upperOpeningDegrees']<5, json.dumps(d,ensure_ascii=False)
  assert d['contacts']>0
  r['foldPixelsChanged']=float(np.abs(closed.astype(int)-flat.astype(int)).mean());assert r['foldPixelsChanged']>.5
  gen=q['generation'];p.locator('#r14-side').click();wait(p,'A.state.pitch===1.25');capture(p,'continuous-side')
  assert p.evaluate('__DENIM_WORKBENCH__.cameraView().verticalFovDegrees')==24
  view(p,{'zoom':.45});capture(p,'continuous-far');view(p,{'zoom':1.45});capture(p,'continuous-return');assert p.evaluate('__DENIM_WORKBENCH__.physicsGeneration()')==gen and p.evaluate('__DENIM_WORKBENCH__.physicsReport().steps')==720;r['cameraPreservesPhysics']=True
  # Test actual controls rather than uploading a desired fold geometry.
  p.locator('#r14-grip').click();advance(p,.3);_,q=capture(p,'released-edge');assert q['generation']==gen and q['frame']['physics']['gripEnabled']==False and q['frame']['physics']['steps']==792
  p.locator('#r13-restart').click();wait(p,'A.lastFrame.physics.steps===0');capture(p,'reset-flat')
  r['thicknessCases']=[]
  for t in [.45,1.05]:
   p.locator('#r14-grip').click() if p.evaluate('__DENIM_WORKBENCH__.state.gripEnabled')==False else None
   oldgen=p.evaluate('__DENIM_WORKBENCH__.physicsGeneration()');p.locator('[data-thickness="'+format(t,'.2f').lstrip('0')+'"]' if t<1 else '[data-thickness="1.05"]').click()
   wait(p,'A.physicsReady()&&A.physicsGeneration()>'+str(oldgen)+'&&A.lastFrame.physics.steps===0');advance(p,3)
   _,q=capture(p,'thickness-'+str(t));d=q['frame']['physics'];assert abs(d['contactThicknessMm']-t)<1e-6 and d['maxTensileStrain']<.03 and d['curvedSegments']>=6 and d['upperOpeningDegrees']<5, json.dumps(d,ensure_ascii=False);r['thicknessCases'].append(d)
  # Independent normal autonomous playback. Software timing is not real-device FPS.
  enter(p,'fold');p.locator('#r13-run').click();wait(p,'A.lastFrame.physics.steps>=24');p.locator('#r13-run').click();idle(p);_,live=capture(p,'live-play-pause');r['autonomousSteps']=live['frame']['physics']['steps'];assert r['autonomousSteps']>=24
  with p.expect_download() as info:p.locator('#r13-save').click()
  dl=info.value;dl.save_as(str(O/(mode+'-experiment.json')));export=json.loads((O/(mode+'-experiment.json')).read_text());assert export['generator']=='R14.0';r['reportExport']=True
  p.locator('#r13-original').click();wait(p,'A.physicsReady()&&!A.physicsReport()?.experiment');capture(p,'return-original');assert p.locator('#damage').is_enabled();c.close()
  # Exercise the actual fragment entry, including automatic first-frame initialization.
  url=(a.public or (P/'index.html').as_uri())+'#fold';mc,p=boot(b,'mobile-fragment-entry',url=url,mobile=True)
  wait(p,'A.lastFrame.physics?.model==="continuous-curvature-sheet@1"&&A.state.animate');p.evaluate('__DENIM_WORKBENCH__.setState({animate:false})');idle(p);capture(p,'mobile-fold-entry');p.screenshot(path=str(O/(mode+'-mobile-layout.png')))
  r['mobileCanvas']=p.locator('#view').bounding_box();assert r['mobileCanvas']['width']>250 and r['mobileCanvas']['height']>200;mc.close()
  networks();r['passed']=True
 except Exception:
  r['failure']=traceback.format_exc()
  if p:
   try:p.screenshot(path=str(O/(mode+'-FAILURE.png')));r['errorPanel']=p.locator('#error').inner_text();r['lastAvailable']=p.evaluate('window.__DENIM_WORKBENCH__?.lastFrame')
   except Exception:pass
  save();raise
 finally:r['finishedAt']=datetime.now(timezone.utc).isoformat();save();b.close()
