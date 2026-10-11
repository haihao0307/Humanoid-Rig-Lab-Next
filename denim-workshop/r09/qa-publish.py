"""Real file/public browser delivery gates. --content is development only."""
from pathlib import Path
import argparse,base64,hashlib,json,io,os,time
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright
P=Path(__file__).resolve().parent;OUT=P/'evidence';OUT.mkdir(exist_ok=True)
a=argparse.ArgumentParser();a.add_argument('--url');a.add_argument('--content',action='store_true');a.add_argument('--compare',action='store_true');args=a.parse_args()
r={'passed':False,'mode':'public' if args.url else 'authored' if args.content else 'file','sourceSha':os.getenv('GITHUB_SHA'),'states':[],'pageErrors':[],'consoleErrors':[],'httpErrors':[],'actualPhone':False,'hardwareFPS':False,'requests':[]}
with sync_playwright() as w:
 kw={'headless':False,'args':['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']}
 if os.getenv('CHROMIUM_PATH'):kw['executable_path']=os.environ['CHROMIUM_PATH']
 b=w.chromium.launch(**kw);r['browserVersion']=b.version;p=b.new_page(viewport={'width':1000,'height':780},device_scale_factor=1);p.set_default_timeout(180000)
 p.on('pageerror',lambda e:r['pageErrors'].append(str(e)));p.on('console',lambda m:r['consoleErrors'].append({'text':m.text,'url':m.location.get('url')}) if m.type=='error' else None);p.on('request',lambda q:r['requests'].append(q.url));p.on('response',lambda q:r['httpErrors'].append({'url':q.url,'status':q.status}) if q.status>=400 else None)
 def snap(name,patch=None,action=None,save=False):
  if patch is not None or action:
   f=p.evaluate('__DENIM_WORKBENCH__.lastFrame.frame')
   if action:action()
   else:p.evaluate('(s)=>__DENIM_WORKBENCH__.setState(s)',patch)
   p.wait_for_function('(f)=>__DENIM_WORKBENCH__.lastFrame.frame>f||__DENIM_WORKBENCH__.contextLost',arg=f)
  raw=base64.b64decode(p.evaluate("document.querySelector('#view').toDataURL().split(',')[1]"));im=np.asarray(Image.open(io.BytesIO(raw)).convert('RGB'))
  q=p.evaluate('({version:__DENIM_WORKBENCH__.version,frame:__DENIM_WORKBENCH__.lastFrame,gl:__DENIM_WORKBENCH__.getGLError(),lost:!!__DENIM_WORKBENCH__.contextLost})');q.update(name=name,pixelStd=float(im.std()),sha256=hashlib.sha256(raw).hexdigest());r['states'].append(q)
  if save or q['lost'] or q['gl'] or im.std()<2:(OUT/(r['mode']+'-'+name+'.png')).write_bytes(raw)
  assert q['version']=='R09.1' and not q['lost'] and q['gl']==0 and im.std()>2,(name,q)
  assert not r['pageErrors'],r['pageErrors'];print(name,q['frame']['frame'],flush=True);return im,q
 def sample():
  p.evaluate('__DENIM_WORKBENCH__.physicsSnapshot()');p.wait_for_timeout(80);return p.evaluate('__DENIM_WORKBENCH__.physicsReport()')
 try:
  if args.content:p.set_content((P/'index.html').read_text())
  else:p.goto(args.url or (P/'index.html').as_uri(),wait_until='domcontentloaded',timeout=120000)
  p.wait_for_function('window.__DENIM_WORKBENCH__?.lastFrame||window.__DENIM_WORKBENCH__?.contextLost');snap('default',save=True)
  near={'seam':False,'zoom':5.2,'panX':3,'panY':-4};base,_=snap('near-preserved',near,save=True)
  if args.compare:
   old=b.new_page(viewport={'width':1000,'height':780});old.set_default_timeout(180000)
   if args.content:old.set_content((P.parent/'r08/index.html').read_text())
   else:old.goto((P.parent/'r08/index.html').as_uri())
   old.wait_for_function('window.__DENIM_WORKBENCH__?.lastFrame');f=old.evaluate('__DENIM_WORKBENCH__.lastFrame.frame');old.evaluate('(s)=>__DENIM_WORKBENCH__.setState(s)',near);old.wait_for_function('(f)=>__DENIM_WORKBENCH__.lastFrame.frame>f',arg=f)
   data=base64.b64decode(old.evaluate("document.querySelector('#view').toDataURL().split(',')[1]"));image=np.asarray(Image.open(io.BytesIO(data)).convert('RGB'));diff=np.abs(image.astype(float)-base);r['acceptedNearComparison']={'meanAbsoluteDifference':float(diff.mean()),'maximumDifference':float(diff.max()),'pixelsAbove8':int((diff.max(2)>8).sum())};assert diff.mean()<.15 and (diff.max(2)>8).mean()<.001,r['acceptedNearComparison'];(OUT/'accepted-r08-near.png').write_bytes(data);old.close()
  snap('stitch-front',action=lambda:p.locator('#stitchReview').click(),save=True);snap('stitch-back',{'yaw':3.14159},save=True)
  snap('physics-start-position',{'shape':1,'yaw':-.23,'pitch':.34,'zoom':1,'panX':0,'panY':0,'seam':True})
  for i in range(3):
   before=(sample() or {}).get('steps',0);p.evaluate('__DENIM_WORKBENCH__.physicsStep(.1)');p.wait_for_function('(n)=>(__DENIM_WORKBENCH__.physicsReport()?.steps||0)>n',arg=before)
  p.wait_for_function('__DENIM_WORKBENCH__.lastFrame.physics.active');im0,q=snap('physical-wind-pose',save=True);assert q['frame']['physics']['steps']>0
  snap('physical-impulse',action=lambda:p.locator('#impulse').click())
  p.wait_for_timeout(600);f=p.evaluate('__DENIM_WORKBENCH__.lastFrame.frame');p.wait_for_function('(f)=>__DENIM_WORKBENCH__.lastFrame.frame>f',arg=f)
  im1,q=snap('physical-next',save=True);assert np.abs(im1.astype(float)-im0).max()>0
  before=sample()['steps'];snap('efficient-physics-retained',{'quality':'efficient'});after=sample()['steps'];assert after>before and p.evaluate('__DENIM_WORKBENCH__.lastFrame.physics.active');r['qualityDoesNotDisablePhysics']=True
  snap('physical-anchors',action=lambda:p.locator('#drive').click(),save=True);assert p.evaluate('__DENIM_WORKBENCH__.state.drive')
  snap('physical-pause',action=lambda:p.locator('#wind').click());time.sleep(.15);s0=sample();time.sleep(.4);s1=sample();assert s1['steps']==s0['steps'];r['pausedPhysicsRetainsPose']=True
  snap('restore-static',action=lambda:p.locator('#physicsReset').click());snap('fidelity-restored',{'quality':'fidelity'});assert not p.evaluate('__DENIM_WORKBENCH__.lastFrame.physics.active')
  snap('damage',{'damage':4,'seam':False},save=True);assert p.evaluate('__DENIM_WORKBENCH__.lastFrame.natural.bridges')>0;snap('far-damage',{'zoom':.12,'panX':0,'panY':0},save=True)
  recipe=p.evaluate('__DENIM_WORKBENCH__.recipe()');r['recipeBytes']=len(json.dumps(recipe,ensure_ascii=False,separators=(',',':')).encode());r['recipe']=recipe
  with p.expect_download() as dl:p.locator('#save').click()
  dl.value.save_as(str(OUT/(r['mode']+'-recipe.json')));assert json.loads((OUT/(r['mode']+'-recipe.json')).read_text())==recipe
  snap('import-recipe',action=lambda:p.evaluate('(x)=>__DENIM_WORKBENCH__.loadRecipe(x)',recipe));r['exportImportVerified']=True
  p.set_viewport_size({'width':390,'height':844});snap('mobile-default',{'damage':0,'zoom':1,'panX':0,'panY':0},save=True);h=p.locator('#heading').bounding_box();t=p.locator('#tools').bounding_box();assert h['y']+h['height']<=t['y'];p.screenshot(path=str(OUT/(r['mode']+'-mobile-layout.png')))
  p.wait_for_timeout(600);f=p.evaluate('__DENIM_WORKBENCH__.lastFrame.frame');p.wait_for_timeout(600);assert f==p.evaluate('__DENIM_WORKBENCH__.lastFrame.frame');r['idleStops']=True
  assert not [e for e in r['httpErrors'] if not(e['url']=='https://htmlpreview.github.io/favicon.ico' and e['status']==404)],r['httpErrors']
  assert not [e for e in r['consoleErrors'] if not(e['url']=='https://htmlpreview.github.io/favicon.ico' and '404' in e['text'])],r['consoleErrors']
  if not args.url:assert not [u for u in r['requests'] if u.startswith('http')],r['requests']
  r['passed']=True
 finally:
  (OUT/(r['mode']+'-live-qa.json')).write_text(json.dumps(r,ensure_ascii=False,indent=2));b.close()
