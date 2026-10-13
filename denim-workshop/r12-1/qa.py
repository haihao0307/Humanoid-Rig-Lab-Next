"""Actual file/public checks. A separate context delays one real worker reply.
Normal rendering and controls are untouched. Software browser, not hardware FPS.
"""
from pathlib import Path
from datetime import datetime,timezone
import argparse,base64,hashlib,io,json,os,traceback
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright
P=Path(__file__).resolve().parent;O=P/'evidence';O.mkdir(exist_ok=True)
ap=argparse.ArgumentParser();ap.add_argument('--public');args=ap.parse_args();mode='public' if args.public else 'file'
r={'passed':False,'mode':mode,'version':'R12.1','startedAt':datetime.now(timezone.utc).isoformat(),'sourceHead':os.getenv('GITHUB_SHA'),'states':[],'network':{},'mobileIsViewportOnly':True,'consumerGPUPerformance':False}
HOLD=r'''(() => {const Native=window.Worker;window.__heldSamples=[];window.__holdNextSample=0;window.Worker=class extends Native {set onmessage(fn){super.onmessage=e=>{if(e.data.type==='sample'&&window.__holdNextSample>0){window.__holdNextSample--;window.__heldSamples.push({data:e.data,deliver:()=>fn.call(this,e)});return;}fn.call(this,e);};}get onmessage(){return super.onmessage;}};})();'''
def boot(b,name,url=None,mobile=False,hold=False):
 c=b.new_context(viewport={'width':390,'height':844} if mobile else {'width':1000,'height':780},device_scale_factor=1,is_mobile=mobile,has_touch=mobile)
 if hold:c.add_init_script(HOLD)
 p=c.new_page();p.set_default_timeout(180000);net={'errors':[],'consoleErrors':[],'httpErrors':[],'requests':[]};r['network'][name]=net
 p.on('pageerror',lambda e:net['errors'].append(str(e)))
 p.on('console',lambda m:net['consoleErrors'].append({'url':m.location.get('url'),'text':m.text}) if m.type=='error' else None)
 p.on('request',lambda q:net['requests'].append(q.url))
 p.on('response',lambda q:net['httpErrors'].append({'url':q.url,'status':q.status}) if q.status>=400 else None)
 p.goto(url or args.public or (P/'index.html').as_uri(),wait_until='domcontentloaded',timeout=180000)
 p.wait_for_function('window.__DENIM_WORKBENCH__?.lastFrame||window.__DENIM_WORKBENCH__?.contextLost')
 p.wait_for_function('__DENIM_WORKBENCH__.physicsReady()')
 return c,p

def settled(p):p.wait_for_function('(()=>{const a=window.__DENIM_WORKBENCH__;return a.contextLost||(!a.state.animate&&(!a.renderIdle||a.renderIdle()));})()')
def capture(p,name,settle=True):
 if settle:settled(p)
 raw=base64.b64decode(p.evaluate("document.getElementById('view').toDataURL().split(',')[1]"));im=np.asarray(Image.open(io.BytesIO(raw)).convert('RGB'))
 a=p.evaluate('({version:__DENIM_WORKBENCH__.version,frame:__DENIM_WORKBENCH__.lastFrame,physics:__DENIM_WORKBENCH__.physicsReport(),generation:__DENIM_WORKBENCH__.physicsGeneration(),gl:__DENIM_WORKBENCH__.getGLError(),lost:!!__DENIM_WORKBENCH__.contextLost})')
 a.update(name=name,imageSha256=hashlib.sha256(raw).hexdigest(),pixelStd=float(im.std()));r['states'].append(a);(O/(mode+'-'+name+'.png')).write_bytes(raw)
 assert not a['lost'] and a['gl']==0 and im.std()>2,(name,a)
 print(name,a['version'],'frame',a['frame']['frame'],'steps',a['physics']['steps'],flush=True)
 return im,a

def change(p,patch):
 old=p.evaluate('__DENIM_WORKBENCH__.lastFrame.frame');p.evaluate('(x)=>__DENIM_WORKBENCH__.setState(x)',patch)
 p.wait_for_function('(n)=>__DENIM_WORKBENCH__.contextLost||__DENIM_WORKBENCH__.lastFrame.frame>n',arg=old)

def test_network():
 icon='https://htmlpreview.github.io/favicon.ico'
 for name,n in r['network'].items():
  assert not n['errors'],(name,n)
  assert not [x for x in n['httpErrors'] if not(x['url']==icon and x['status']==404)],(name,n)
  assert not [x for x in n['consoleErrors'] if not(x['url']==icon and '404' in x['text'])],(name,n)
  if mode=='file':assert not [u for u in n['requests'] if u.startswith('http')],(name,n)

with sync_playwright() as pw:
 opts={'headless':False,'args':['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']}
 if os.getenv('CHROMIUM_PATH'):opts['executable_path']=os.environ['CHROMIUM_PATH']
 b=pw.chromium.launch(**opts);r['browserVersion']=b.version
 try:
  c,p=boot(b,'unmodified-desktop');normal,a=capture(p,'default');assert a['version']=='R12.1'
  if mode=='file':
   pc,pp=boot(b,'parent-r12',url=(P.parent/'r12/index.html').as_uri());old,_=capture(pp,'parent-default')
   delta=np.abs(normal.astype(int)-old.astype(int));r['restPixelParity']={'maximum':int(delta.max()),'mean':float(delta.mean())};assert delta.max()==0;pc.close()
  p.evaluate('__DENIM_WORKBENCH__.physicsStep(.1)');p.wait_for_function('__DENIM_WORKBENCH__.lastFrame.physics.steps>=24');capture(p,'real-step')
  recipe=p.evaluate('__DENIM_WORKBENCH__.recipe()');legacy={**recipe,'generator':'R12.0'};p.evaluate('(x)=>__DENIM_WORKBENCH__.loadRecipe(x)',legacy)
  p.wait_for_function('__DENIM_WORKBENCH__.physicsReady()');assert p.evaluate('__DENIM_WORKBENCH__.recipe()')==recipe;r['r12RecipeCompatible']=True
  p.locator('#physicsReset').click();p.wait_for_function('__DENIM_WORKBENCH__.physicsReport().steps===0');settled(p)
  change(p,{'damage':4,'zoom':.4,'panX':0,'panY':0,'quality':'efficient'})
  p.wait_for_function('__DENIM_WORKBENCH__.physicsReady()&&__DENIM_WORKBENCH__.physicsReport().topology.inactiveHoleNodes===87');capture(p,'damaged-rest')
  generation=p.evaluate('__DENIM_WORKBENCH__.physicsGeneration()');before=p.evaluate('__DENIM_WORKBENCH__.physicsReport().steps')
  p.locator('#wind').click();p.wait_for_function('(n)=>__DENIM_WORKBENCH__.lastFrame.physics.steps>n',arg=before);_,a=capture(p,'damaged-wind',settle=False)
  change(p,{'zoom':.65});p.locator('#drive').click();p.wait_for_function('(n)=>__DENIM_WORKBENCH__.lastFrame.physics.steps>n',arg=a['frame']['physics']['steps']);_,a2=capture(p,'wind-camera-anchor',settle=False)
  assert p.evaluate('__DENIM_WORKBENCH__.physicsGeneration()')==generation
  r['windAcrossCamera']={'before':before,'after':a2['frame']['physics']['steps'],'generationUnchanged':True}
  p.locator('#wind').click();p.locator('#physicsReset').click();p.wait_for_function('__DENIM_WORKBENCH__.physicsReport().steps===0');capture(p,'reset-after-wind');c.close()
  rc,rp=boot(b,'controlled-response-race',hold=True)
  rp.evaluate('__DENIM_WORKBENCH__.physicsStep(.1)');rp.wait_for_function('__DENIM_WORKBENCH__.lastFrame.physics.steps>=24');settled(rp)
  rp.evaluate('window.__holdNextSample=1;__DENIM_WORKBENCH__.physicsSnapshot()');rp.wait_for_function('window.__heldSamples.length===1')
  held=rp.evaluate('window.__heldSamples[0].data.report.steps');assert held>=24
  rp.locator('#physicsReset').click();rp.evaluate('window.__heldSamples.shift().deliver()')
  rp.wait_for_function('__DENIM_WORKBENCH__.physicsReport().steps===0');_,ra=capture(rp,'pending-reset-race')
  r['resetRace']={'realWorker':True,'oneReplyIntentionallyDelayed':True,'heldSteps':held,'freshSteps':ra['physics']['steps'],'passed':True};rc.close()
  mc,mp=boot(b,'unmodified-mobile-viewport',mobile=True);capture(mp,'mobile-default');bounds=mp.locator('#view').bounding_box();assert bounds['height']>200 and bounds['y']+bounds['height']<=844
  mp.screenshot(path=str(O/(mode+'-mobile-layout.png')));r['mobileCanvas']=bounds;mc.close()
  test_network();r['passed']=True
 except Exception:r['failure']=traceback.format_exc();raise
 finally:r['finishedAt']=datetime.now(timezone.utc).isoformat();(O/(mode+'-qa.json')).write_text(json.dumps(r,ensure_ascii=False,indent=2));b.close()
