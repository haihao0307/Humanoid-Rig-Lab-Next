"""Actual file/public rendering, demand residency and paired motion regression.
--content is local authored-document development only, never public/file verification.
"""
from pathlib import Path
import argparse,base64,hashlib,json,io,os,math,time
from datetime import datetime,timezone
import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates
from playwright.sync_api import sync_playwright
P=Path(__file__).resolve().parent;OUT=P/'evidence';OUT.mkdir(exist_ok=True)
a=argparse.ArgumentParser();a.add_argument('--scope',choices=['ui','motion'],default='ui');a.add_argument('--public');a.add_argument('--content',action='store_true');args=a.parse_args()
r={'passed':False,'scope':args.scope,'mode':'public' if args.public else 'authored' if args.content else 'file','sourceHead':os.getenv('GITHUB_SHA'),'startedAt':datetime.now(timezone.utc).isoformat(),'states':[],'pageErrors':[],'consoleErrors':[],'httpErrors':[],'requests':[],'realDevice':False}
def raw(p):
 d=base64.b64decode(p.evaluate("document.querySelector('#view').toDataURL().split(',')[1]"));return d,np.asarray(Image.open(io.BytesIO(d)).convert('RGB'))
def boot(b,version='r10',mobile=False):
 p=b.new_page(viewport={'width':390,'height':844} if mobile else {'width':1000,'height':780},device_scale_factor=1);p.set_default_timeout(240000)
 p.on('pageerror',lambda e:r['pageErrors'].append(str(e)));p.on('console',lambda m:r['consoleErrors'].append({'text':m.text,'url':m.location.get('url')}) if m.type=='error' else None)
 p.on('request',lambda q:r['requests'].append(q.url));p.on('response',lambda q:r['httpErrors'].append({'url':q.url,'status':q.status}) if q.status>=400 else None)
 file=P.parent/version/'index.html'
 if args.content and not args.public:p.set_content(file.read_text(),wait_until='domcontentloaded')
 else:p.goto(args.public or file.as_uri(),wait_until='domcontentloaded',timeout=120000)
 p.wait_for_function('window.__DENIM_WORKBENCH__?.lastFrame||window.__DENIM_WORKBENCH__?.contextLost');return p

def frame(p,name,patch=None,action=None,save=False):
 if patch is not None or action:
  f=p.evaluate('__DENIM_WORKBENCH__.lastFrame.frame')
  if action:action()
  else:p.evaluate('(s)=>__DENIM_WORKBENCH__.setState(s)',patch)
  p.wait_for_function('(f)=>__DENIM_WORKBENCH__.lastFrame.frame>f||__DENIM_WORKBENCH__.contextLost',arg=f)
 data,im=raw(p);q=p.evaluate('({version:__DENIM_WORKBENCH__.version,frame:__DENIM_WORKBENCH__.lastFrame,gl:__DENIM_WORKBENCH__.getGLError(),lost:!!__DENIM_WORKBENCH__.contextLost})');q.update(name=name,sha256=hashlib.sha256(data).hexdigest(),pixelStd=float(im.std()));r['states'].append(q)
 if save or q['lost'] or q['gl'] or im.std()<2:(OUT/(r['mode']+'-'+name+'.png')).write_bytes(data)
 assert not q['lost'] and q['gl']==0 and im.std()>2,(name,q)
 assert not r['pageErrors'],r['pageErrors']
 print(name,q['frame']['frame'],q['frame']['farWeight'],flush=True);return im,q

def settle_detail(p):
 p.wait_for_function('__DENIM_WORKBENCH__.lastFrame.distanceLOD?.detail.resident&&!__DENIM_WORKBENCH__.lastFrame.distanceLOD.detail.pending&&__DENIM_WORKBENCH__.lastFrame.distanceLOD.microGain>=.999')
 return frame(p,'near-settled',{},save=True)

def physics_step(p,dt=.1):
 before=p.evaluate('__DENIM_WORKBENCH__.physicsReport()?.steps||0');p.evaluate('(dt)=>__DENIM_WORKBENCH__.physicsStep(dt)',dt)
 p.wait_for_function('(s)=>(__DENIM_WORKBENCH__.lastFrame.physics.steps||0)>s',arg=before)

with sync_playwright() as pw:
 kw={'headless':False,'args':['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']}
 if os.getenv('CHROMIUM_PATH'):kw['executable_path']=os.environ['CHROMIUM_PATH']
 b=pw.chromium.launch(**kw);r['browserVersion']=b.version
 try:
  if args.scope=='ui':
   p=boot(b);im,q=frame(p,'default',save=True);assert q['version']=='R10.0';assert not q['frame']['distanceLOD']['detail']['resident'];r['coldResources']=q['frame']['performance']
   frame(p,'near-request',{'zoom':5.2,'panX':3,'panY':-4,'seam':False});near,q=settle_detail(p);r['nearResources']=q['frame']['performance']
   if not args.public:
    old=boot(b,'r09');frame(old,'r09-near',{'zoom':5.2,'panX':3,'panY':-4,'seam':False});_,orig=raw(old);delta=np.abs(near.astype(float)-orig);r['nearComparison']={'mae':float(delta.mean()),'max':float(delta.max()),'fractionAbove8':float((delta.max(2)>8).mean()),'contrastRatio':float(near.std()/orig.std())};assert delta.mean()<1.0 and (delta.max(2)>8).mean()<.03,r['nearComparison'];old.close()
   # Smooth logarithmic zoom trajectory, crossing local-mask and whole-surface thresholds.
   trajectory=[]
   for z in [3.8,3.0,2.6,2.2,1.8,1.4,1.15,1.05,.9,.7,.45]:
    im,q=frame(p,'zoom-'+str(z),{'zoom':z,'panX':0,'panY':0},save=z in [2.2,1.15,.7]);trajectory.append({'zoom':z,'weight':q['frame']['farWeight'],'pixelMean':float(im.mean()),'triangles':q['frame']['triangles']})
   r['zoomTrajectory']=trajectory
   p.wait_for_function('__DENIM_WORKBENCH__.lastFrame.distanceLOD.detail.releases>=1&&!__DENIM_WORKBENCH__.lastFrame.distanceLOD.detail.resident')
   im,q=frame(p,'far-released',{},save=True);r['releasedResources']=q['frame']['performance'];assert r['releasedResources']['trackedGpuBytes']<r['nearResources']['trackedGpuBytes']-25*1048576
   # Reconstruct exactly the same micro-layer after release, without changing material or solver.
   frame(p,'near-reload',{'zoom':5.2,'panX':3,'panY':-4});near2,q=settle_detail(p);r['reloadDifference']=int(np.abs(near.astype(int)-near2).max());assert r['reloadDifference']==0,r['reloadDifference']
   frame(p,'stitch-front',action=lambda:p.locator('#stitchReview').click(),save=True)
   frame(p,'stitch-mid',{'zoom':.85,'panX':0,'panY':0},save=True)
   frame(p,'damage-mid',{'damage':4,'seam':False,'zoom':.85},save=True);assert p.evaluate('__DENIM_WORKBENCH__.lastFrame.natural.bridges')>0
   frame(p,'damage-far',{'zoom':.4},save=True)
   # Use live wind, then cross the distance/quality boundary without changing the physical clock.
   frame(p,'physics-position',{'damage':0,'zoom':1,'seam':True})
   frame(p,'wind-on',action=lambda:p.locator('#wind').click());before=p.evaluate('__DENIM_WORKBENCH__.physicsReport()?.steps||0')
   frame(p,'wind-far',{'zoom':.4},save=True);p.wait_for_function('(n)=>(__DENIM_WORKBENCH__.physicsReport()?.steps||0)>n',arg=before);after=p.evaluate('__DENIM_WORKBENCH__.physicsReport().steps');assert p.evaluate('__DENIM_WORKBENCH__.lastFrame.physics.active')
   frame(p,'wind-efficient',{'quality':'efficient'},save=True);assert p.evaluate('__DENIM_WORKBENCH__.lastFrame.physics.active')
   frame(p,'wind-anchors',action=lambda:p.locator('#drive').click(),save=True);r['physicsAcrossDistance']={'before':before,'after':after,'continues':after>before}
   frame(p,'pause',action=lambda:p.locator('#wind').click());frame(p,'reset-physics',action=lambda:p.locator('#physicsReset').click());frame(p,'restore-quality',{'quality':'fidelity'})
   # A frozen intermediate physical pose remains filtered and is not a static screenshot.
   for _ in range(3):physics_step(p)
   frame(p,'physical-middle',{'zoom':1.2,'yaw':-.65,'pitch':.5},save=True);assert p.evaluate('__DENIM_WORKBENCH__.lastFrame.physics.active')
   frame(p,'physical-far',{'zoom':.5},save=True)
   frame(p,'reset-again',action=lambda:p.locator('#physicsReset').click())
   recipe=p.evaluate('__DENIM_WORKBENCH__.recipe()');frame(p,'recipe-roundtrip',action=lambda:p.evaluate('(r)=>__DENIM_WORKBENCH__.loadRecipe(r)',recipe));r['recipeBytes']=len(json.dumps(recipe,separators=(',',':')).encode())
   p.close();mobile=boot(b,mobile=True);frame(mobile,'mobile-default',save=True);frame(mobile,'mobile-near',{'zoom':5.2});frame(mobile,'mobile-mid',{'zoom':1.0},save=True);frame(mobile,'mobile-far',{'zoom':.4},save=True)
   h=mobile.locator('#heading').bounding_box();t=mobile.locator('#tools').bounding_box();assert h['y']+h['height']<=t['y'];mobile.screenshot(path=str(OUT/(r['mode']+'-mobile-layout.png')));mobile.close()
  else:
   results={}
   scenarios=[('early-middle',2.0,0,0,0,False),('middle',1.0,0,0,0,False),('far',.45,0,0,0,False),('physical-damaged',.85,4,-.65,.5,True)]
   for version in ['r09','r10']:
    p=boot(b,version);results[version]={}
    for name,z,damage,yaw,pitch,physical in scenarios:
     frame(p,version+'-'+name+'-start',{'shape':1 if physical else 0,'zoom':z,'panX':0,'panY':0,'yaw':yaw,'pitch':pitch,'damage':damage,'seam':False})
     if version=='r10':
      p.wait_for_function('(()=>{const d=__DENIM_WORKBENCH__.lastFrame.distanceLOD;return !d.detail.pending&&(!d.request||(d.detail.resident&&Math.abs(d.microGain-d.micro)<.00001));})()')
     if physical:
      for _ in range(3):physics_step(p)
     patches=[[],[],[]]
     q=p.evaluate('__DENIM_WORKBENCH__.lastFrame');height=p.evaluate("document.querySelector('#view').height");mpp=2*q['distanceMm']*math.tan(math.pi/10)/height
     for i in range(6):
      im,q=frame(p,version+'-'+name+'-'+str(i),{'panX':i*.25*mpp},save=i in [0,5])
      for k,world in enumerate([[-25,20,0],[0,22,0],[28,20,0]]):
       xy=p.evaluate('(p)=>__DENIM_WORKBENCH__.projectPoint(p)',world);cx,cy=xy[0],im.shape[0]-xy[1];yy,xx=np.meshgrid(cy+np.arange(-6,7),cx+np.arange(-25,26),indexing='ij');patches[k].append(map_coordinates(im.astype(float).mean(2),[yy,xx],order=3,mode='nearest'))
     values=[float(np.sqrt(np.mean(np.var(np.stack(v),axis=0)))) for v in patches];results[version][name]={'residual':float(np.mean(values)),'patches':values,'frames':6,'pixelsPerYarn':q['frame']['pixelsPerYarn']}
    p.close()
   r['motion']=results;r['ratios']={k:results['r10'][k]['residual']/max(.001,results['r09'][k]['residual']) for k in results['r09']}
   # Load-bearing acceptance, declared before the experiment. Not adjusted to measured values.
   assert r['ratios']['middle']<.70 and r['ratios']['far']<.70 and r['ratios']['physical-damaged']<.80,r['ratios']
   assert r['ratios']['early-middle']<1.05,r['ratios']
   r['method']='Six quarter-pixel horizontal camera offsets; mean of three cubic-reprojected 13x51 brightness patches. Physical case uses a fixed 0.3s simulated pose; live wind is tested separately. Not full-image flicker, perceptual scoring, or arbitrary device proof.'
  assert not r['pageErrors'],r['pageErrors']
  icon='https://htmlpreview.github.io/favicon.ico'
  assert not [e for e in r['httpErrors'] if not(e['url']==icon and e['status']==404)],r['httpErrors']
  assert not [e for e in r['consoleErrors'] if not(e['url']==icon and '404' in e['text'])],r['consoleErrors']
  if not args.public:assert not [u for u in r['requests'] if u.startswith('http')],r['requests']
  r['passed']=True
 finally:
  r['finishedAt']=datetime.now(timezone.utc).isoformat();(OUT/(r['mode']+'-'+args.scope+'-qa.json')).write_text(json.dumps(r,ensure_ascii=False,indent=2));b.close()
