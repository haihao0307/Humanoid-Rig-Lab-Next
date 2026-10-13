"""R12 actual file/public structure-and-physics browser gate.
--content is development-only document injection, never claimed as file/public.
Software-rendered browser; no inference about consumer GPU FPS or film approval.
"""
from pathlib import Path
from datetime import datetime, timezone
import argparse, base64, hashlib, io, json, os
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright
P=Path(__file__).resolve().parent;O=P/'evidence';O.mkdir(exist_ok=True)
a=argparse.ArgumentParser();a.add_argument('--content',action='store_true');a.add_argument('--public');args=a.parse_args()
mode='public' if args.public else 'authored' if args.content else 'file'
r={'passed':False,'mode':mode,'version':'R12.0','sourceHead':os.getenv('GITHUB_SHA'),'startedAt':datetime.now(timezone.utc).isoformat(),'states':[],'network':{},'actualPhone':False,'consumerGPU':False}

def boot(browser,name,version='r12',mobile=False):
 ctx=browser.new_context(viewport={'width':390,'height':844} if mobile else {'width':1000,'height':780},device_scale_factor=1,is_mobile=mobile,has_touch=mobile)
 p=ctx.new_page();p.set_default_timeout(240000);net={'errors':[],'consoleErrors':[],'httpErrors':[],'requests':[]};r['network'][name]=net
 p.on('pageerror',lambda e:net['errors'].append(str(e)))
 p.on('request',lambda q:net['requests'].append(q.url))
 p.on('response',lambda q:net['httpErrors'].append({'url':q.url,'status':q.status}) if q.status>=400 else None)
 p.on('console',lambda m:net['consoleErrors'].append({'url':m.location.get('url'),'text':m.text}) if m.type=='error' else None)
 file=P.parent/version/'index.html'
 if args.content and not args.public:p.set_content(file.read_text(),wait_until='domcontentloaded')
 else:p.goto(args.public or file.as_uri(),wait_until='domcontentloaded',timeout=120000)
 p.wait_for_function('window.__DENIM_WORKBENCH__?.lastFrame||window.__DENIM_WORKBENCH__?.contextLost')
 return ctx,p

def capture(p,name,patch=None,action=None,save=False):
 if patch is not None or action:
  old=p.evaluate('__DENIM_WORKBENCH__.lastFrame.frame')
  if action:action()
  else:p.evaluate('(s)=>__DENIM_WORKBENCH__.setState(s)',patch)
  p.wait_for_function('(n)=>__DENIM_WORKBENCH__.lastFrame.frame>n||__DENIM_WORKBENCH__.contextLost',arg=old)
 raw=base64.b64decode(p.evaluate("document.querySelector('#view').toDataURL().split(',')[1]"));im=np.asarray(Image.open(io.BytesIO(raw)).convert('RGB'))
 q=p.evaluate('({version:__DENIM_WORKBENCH__.version,frame:__DENIM_WORKBENCH__.lastFrame,state:{...__DENIM_WORKBENCH__ .state},gl:__DENIM_WORKBENCH__.getGLError(),lost:!!__DENIM_WORKBENCH__.contextLost})')
 q.update(name=name,sha256=hashlib.sha256(raw).hexdigest(),pixelStd=float(im.std()));r['states'].append(q)
 failed=q['gl']!=0 or q['lost'] or im.std()<2
 if save or failed:(O/(mode+'-'+name+'.png')).write_bytes(raw)
 assert not failed,(name,q)
 assert q['frame']['projection']=='perspective' and not q['frame']['solidEdgeDrawn']
 print(name,q['frame']['frame'],'steps',q['frame'].get('physics',{}).get('steps'),'bytes',q['frame']['performance']['trackedGpuBytes'],flush=True)
 return im,q

def ready(p,expr='true'):
 p.wait_for_function('__DENIM_WORKBENCH__.physicsReady()&&!!__DENIM_WORKBENCH__.lastFrame.physics.topology&&('+expr+')')

def detail(p):
 p.wait_for_function('__DENIM_WORKBENCH__.lastFrame.distanceLOD?.detail.resident&&__DENIM_WORKBENCH__.lastFrame.distanceLOD.microGain>.999')

def step(p,seconds=.1):
 ready(p);before=p.evaluate('__DENIM_WORKBENCH__.physicsReport().steps')
 p.evaluate('(s)=>__DENIM_WORKBENCH__.physicsStep(s)',seconds)
 p.wait_for_function('(n)=>__DENIM_WORKBENCH__.lastFrame.physics.steps>n',arg=before)

with sync_playwright() as pw:
 opts={'headless':False,'args':['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']}
 if os.getenv('CHROMIUM_PATH'):opts['executable_path']=os.environ['CHROMIUM_PATH']
 b=pw.chromium.launch(**opts);r['browserVersion']=b.version
 try:
  ctx,p=boot(b,'candidate');ready(p)
  im,q=capture(p,'default',save=True);assert q['version']=='R12.0';assert q['frame']['physics']['topology']['inactiveHoleNodes']==0
  r['coldBudget']=q['frame']['performance']
  capture(p,'near-load',{'zoom':5.2,'panX':3,'panY':-4,'seam':False});detail(p)
  near,q=capture(p,'near-settled',{},save=True);r['nearBudget']=q['frame']['performance']
  if not args.public:
   oldctx,old=boot(b,'baseline','r11');capture(old,'baseline-near-load',{'zoom':5.2,'panX':3,'panY':-4,'seam':False});detail(old)
   baseline,q0=capture(old,'baseline-near',{},save=True)
   delta=np.abs(near.astype(float)-baseline);r['restAppearance']={'meanAbsoluteChannelDifference':float(delta.mean()),'max':float(delta.max()),'fractionOver8':float((delta.max(2)>8).mean())}
   assert delta.mean()<1 and (delta.max(2)>8).mean()<.03,r['restAppearance']
   oldctx.close()
  gen=p.evaluate('__DENIM_WORKBENCH__.physicsGeneration()')
  capture(p,'far-release',{'zoom':.35,'panX':0,'panY':0},save=True)
  p.wait_for_function('__DENIM_WORKBENCH__.lastFrame.distanceLOD.detail.releases>0&&!__DENIM_WORKBENCH__.lastFrame.distanceLOD.detail.resident')
  capture(p,'far-released',{});assert p.evaluate('__DENIM_WORKBENCH__.physicsGeneration()')==gen
  capture(p,'near-reload',{'zoom':5.2,'panX':3,'panY':-4});detail(p)
  near2,_=capture(p,'near-reloaded',{});r['reloadMaxPixelDifference']=int(np.abs(near.astype(int)-near2).max());assert r['reloadMaxPixelDifference']==0
  capture(p,'thin-material',action=lambda:p.locator('#materialThin').click());ready(p,'__DENIM_WORKBENCH__.lastFrame.physics.topology.material.thicknessMm===.45')
  thin=p.evaluate('__DENIM_WORKBENCH__.physicsReport().topology');capture(p,'thick-material',action=lambda:p.locator('#materialThick').click());ready(p,'__DENIM_WORKBENCH__.lastFrame.physics.topology.material.thicknessMm===1.05')
  thick=p.evaluate('__DENIM_WORKBENCH__.physicsReport().topology');assert thin['totalMassKg']<thick['totalMassKg'];assert thin['material']['bendCompliance']>thick['material']['bendCompliance'];r['materialResponse']={'thin':thin,'thick':thick}
  capture(p,'damage-rest',{'thickness':.7,'damage':4,'zoom':1.5,'panX':4,'panY':-1,'seam':False},save=True)
  ready(p,'__DENIM_WORKBENCH__.lastFrame.physics.topology.retainedBridgeCount===26')
  top=p.evaluate('__DENIM_WORKBENCH__.physicsReport().topology');assert top['inactiveHoleNodes']==87 and top['removedSheetConstraints']==638
  for i in range(3):step(p)
  im,q=capture(p,'damage-simulated',{},save=True);r['damagedPhysics']=q['frame']['physics'];assert q['frame']['physics']['maxDisplacementMm']>.1;assert q['frame']['physics']['maxAttachmentErrorMm']<1e-5
  assert q['frame']['physics']['maxTensileStrain']<.15 and q['frame']['physics']['maxYarnStretch']<.18
  # Identical uploaded physical pose, scene samples and primitive order. Only
  # command scheduling changes. The unbatched path is QA-only, never auto fallback.
  capture(p,'batch-parity-position',{'zoom':.6,'panX':0,'panY':0})
  batched,_=capture(p,'batch-parity-bounded',{'qaSingleBatch':False})
  single,_=capture(p,'batch-parity-single',{'qaSingleBatch':True})
  delta=np.abs(batched.astype(int)-single.astype(int));r['batchPixelParity']={'max':int(delta.max()),'mean':float(delta.mean()),'sameFrozenPhysics':True}
  assert delta.max()<=1 and delta.mean()<.001,r['batchPixelParity']
  capture(p,'batch-parity-restored',{'qaSingleBatch':False,'zoom':1.5,'panX':4,'panY':-1})
  gen=p.evaluate('__DENIM_WORKBENCH__.physicsGeneration()');before=p.evaluate('__DENIM_WORKBENCH__.physicsReport().steps')
  capture(p,'wind-start',action=lambda:p.locator('#wind').click())
  capture(p,'wind-far',{'zoom':.4,'panX':0,'panY':0},save=True)
  p.wait_for_function('(n)=>__DENIM_WORKBENCH__.physicsReport().steps>n',arg=before)
  capture(p,'wind-efficient',{'quality':'efficient'},save=True)
  capture(p,'wind-anchor',action=lambda:p.locator('#drive').click(),save=True)
  assert p.evaluate('__DENIM_WORKBENCH__.physicsGeneration()')==gen
  after=p.evaluate('__DENIM_WORKBENCH__.physicsReport().steps');r['windAcrossLOD']={'generation':gen,'before':before,'after':after,'continues':after>before};assert after>before
  capture(p,'pause',action=lambda:p.locator('#wind').click());capture(p,'reset',action=lambda:p.locator('#physicsReset').click())
  p.wait_for_function('__DENIM_WORKBENCH__.physicsReport().steps===0')
  capture(p,'restore',{'quality':'fidelity','damage':0,'thickness':.7,'zoom':1,'panX':0,'panY':0,'seam':True});ready(p,'__DENIM_WORKBENCH__.lastFrame.physics.topology.inactiveHoleNodes===0')
  capture(p,'stitch-near',action=lambda:p.locator('#stitchReview').click(),save=True)
  recipe=p.evaluate('__DENIM_WORKBENCH__.recipe()');assert recipe['mechanics']['model']=='damage-xpbd@1'
  capture(p,'recipe-roundtrip',action=lambda:p.evaluate('(x)=>__DENIM_WORKBENCH__.loadRecipe(x)',recipe));ready(p)
  assert p.evaluate('__DENIM_WORKBENCH__.recipe()')==recipe
  with p.expect_download() as dl:p.locator('#save').click()
  dl.value.save_as(str(O/(mode+'-recipe.json')));assert json.loads((O/(mode+'-recipe.json')).read_text())==recipe
  r['recipeBytes']=len(json.dumps(recipe,separators=(',',':')).encode())
  ctx.close()
  mc,mp=boot(b,'mobile',mobile=True);ready(mp);capture(mp,'mobile-default',save=True);capture(mp,'mobile-damage',{'damage':4,'zoom':.6},save=True);ready(mp,'__DENIM_WORKBENCH__.lastFrame.physics.topology.inactiveHoleNodes>0')
  bounds=mp.locator('#view').bounding_box();assert bounds['height']>200 and bounds['y']+bounds['height']<=844
  mp.screenshot(path=str(O/(mode+'-mobile-layout.png')));mc.close()
  for name,net in r['network'].items():
   assert not net['errors'],(name,net)
   icon='https://htmlpreview.github.io/favicon.ico'
   assert not [q for q in net['httpErrors'] if not(q['url']==icon and q['status']==404)],(name,net)
   assert not [q for q in net['consoleErrors'] if not(q['url']==icon and '404' in q['text'])],(name,net)
   if not args.public:assert not [u for u in net['requests'] if u.startswith('http')],(name,net)
  r['passed']=True
 finally:
  r['finishedAt']=datetime.now(timezone.utc).isoformat();(O/(mode+'-structure-qa.json')).write_text(json.dumps(r,ensure_ascii=False,indent=2));b.close()
