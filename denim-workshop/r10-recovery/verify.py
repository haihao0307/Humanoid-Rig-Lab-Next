"""Read-only recovery verification; no material/physics modification, fallback,
page injection, retry-to-pass or disabled GPU watchdog. Tests the immutable R10
that finished after the user's previous conversation was interrupted.
"""
from pathlib import Path
from datetime import datetime,timezone
import argparse,base64,hashlib,io,json,os,urllib.request
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright
P=Path(__file__).resolve().parent;OUT=P/'evidence';OUT.mkdir(exist_ok=True)
a=argparse.ArgumentParser();a.add_argument('--mode',choices=['file','public'],required=True);args=a.parse_args()
BUILD='3daabc3436ecf6e5297d56869712449ca145ab5e'
SHA='a6d9dbac361aaf9017c42095e1d8ab63f1d9bc3d55c8e47c9c85af7ebb469c87'
RAW=f'https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/{BUILD}/denim-workshop/r10/index.html';URL='https://htmlpreview.github.io/?'+RAW
ENTRY=P.parent/'r10/index.html'
r={'passed':False,'mode':args.mode,'recoverySource':os.getenv('GITHUB_SHA'),'buildCommit':BUILD,'publicUrl':URL,'runtimeChangedThisRecovery':False,'startedAt':datetime.now(timezone.utc).isoformat(),'states':[],'pageErrors':[],'consoleErrors':[],'httpErrors':[],'requests':[],'watchdogDisabled':False,'actualPhone':False,'hardwareFPSVerified':False}
def capture(p,name):
 data=base64.b64decode(p.evaluate("document.querySelector('#view').toDataURL().split(',')[1]"));im=np.asarray(Image.open(io.BytesIO(data)).convert('RGB'))
 q=p.evaluate('({version:__DENIM_WORKBENCH__.version,frame:__DENIM_WORKBENCH__.lastFrame,gl:__DENIM_WORKBENCH__.getGLError(),lost:!!__DENIM_WORKBENCH__.contextLost})');q.update(name=name,sha256=hashlib.sha256(data).hexdigest(),pixelStd=float(im.std()));r['states'].append(q)
 (OUT/(args.mode+'-'+name+'.png')).write_bytes(data)
 assert q['version']=='R10.0' and q['gl']==0 and not q['lost'] and im.std()>2,(name,q)
 assert not r['pageErrors'],r['pageErrors']
 assert not q['frame']['distanceLOD']['detail']['error'],q['frame']['distanceLOD']
 print(name,'frame',q['frame']['frame'],'far',q['frame']['farWeight'],'resident',q['frame']['distanceLOD']['detail']['resident'],flush=True);return data,q

def change(p,name,patch=None,button=None):
 f=p.evaluate('__DENIM_WORKBENCH__.lastFrame.frame')
 if button:p.locator('#'+button).click()
 else:p.evaluate('(s)=>__DENIM_WORKBENCH__.setState(s)',patch)
 p.wait_for_function('(n)=>__DENIM_WORKBENCH__.lastFrame.frame>n||__DENIM_WORKBENCH__.contextLost',arg=f)
 return capture(p,name)
try:
 data=ENTRY.read_bytes();assert len(data)==74969 and hashlib.sha256(data).hexdigest()==SHA;r['localBytesMatch']=True
 if args.mode=='public':
  with urllib.request.urlopen(RAW,timeout=90) as response:
   public=response.read();assert response.status==200
  assert public==data;r['publicBytesMatch']=True
 with sync_playwright() as pw:
  b=pw.chromium.launch(headless=False,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']);r['browserVersion']=b.version
  p=b.new_page(viewport={'width':1000,'height':780},device_scale_factor=1);p.set_default_timeout(180000)
  p.on('pageerror',lambda e:r['pageErrors'].append(str(e)));p.on('console',lambda m:r['consoleErrors'].append({'text':m.text,'url':m.location.get('url','')}) if m.type=='error' else None)
  p.on('request',lambda q:r['requests'].append(q.url));p.on('response',lambda q:r['httpErrors'].append({'url':q.url,'status':q.status}) if q.status>=400 else None)
  p.goto(URL if args.mode=='public' else ENTRY.as_uri(),wait_until='domcontentloaded',timeout=120000);p.wait_for_function('window.__DENIM_WORKBENCH__?.lastFrame||window.__DENIM_WORKBENCH__?.contextLost')
  _,cold=capture(p,'cold-middle');assert not cold['frame']['distanceLOD']['detail']['resident']
  change(p,'near-request',{'zoom':5.2,'panX':3,'panY':-4,'seam':False});p.wait_for_function('__DENIM_WORKBENCH__.lastFrame.distanceLOD.microGain>=.999')
  near_raw,near=change(p,'near-loaded',{})
  # Exact previous UI failure location; same fidelity quality and resolution.
  _,boundary=change(p,'former-failure-zoom-1p8',{'zoom':1.8,'panX':0,'panY':0});assert boundary['frame']['performance']['quality']=='fidelity' and 0<boundary['frame']['farWeight']<1
  change(p,'middle-1p0',{'zoom':1.0});change(p,'far-0p4',{'zoom':.4})
  p.wait_for_function('__DENIM_WORKBENCH__.lastFrame.distanceLOD.detail.releases>=1&&!__DENIM_WORKBENCH__.lastFrame.distanceLOD.detail.resident')
  _,far=change(p,'far-unloaded',{});released=near['frame']['performance']['trackedGpuBytes']-far['frame']['performance']['trackedGpuBytes'];assert released>25*1048576;r['nearToFarReleasedTrackedBytes']=released
  change(p,'near-return-request',{'zoom':5.2,'panX':3,'panY':-4});p.wait_for_function('__DENIM_WORKBENCH__.lastFrame.distanceLOD.microGain>=.999')
  reload_raw,_=change(p,'near-return-loaded',{});assert near_raw==reload_raw,'Near state changed after unload/reload';r['reloadPixelIdentical']=True
  change(p,'wind-view',{'zoom':.85,'panX':0,'panY':0,'seam':True});_,windy=change(p,'wind-start',button='wind');initial=windy['frame']['physics'].get('steps',0)
  p.wait_for_function('(n)=>(__DENIM_WORKBENCH__.physicsReport()?.steps||0)>n',arg=initial)
  _,moving=change(p,'wind-distance-change',{'zoom':.45});assert moving['frame']['physics']['active']
  _,efficient=change(p,'wind-efficient',{'quality':'efficient'});assert efficient['frame']['physics']['active']
  _,driven=change(p,'wind-anchors',button='drive');assert driven['frame']['physics']['active'];r['livePhysicsSteps']=[initial,driven['frame']['physics']['steps']];assert r['livePhysicsSteps'][1]>initial
  change(p,'wind-paused',button='wind');change(p,'physics-reset',button='physicsReset')
  _,damage=change(p,'damaged-middle',{'damage':4,'zoom':.85,'quality':'fidelity','seam':False});assert damage['frame']['natural']['bridges']>0 and damage['frame']['farWeight']==1
  p.screenshot(path=str(OUT/(args.mode+'-layout.png')))
  icon='https://htmlpreview.github.io/favicon.ico'
  assert not [x for x in r['httpErrors'] if not(x['url']==icon and x['status']==404)],r['httpErrors']
  assert not [x for x in r['consoleErrors'] if not(x['url']==icon and '404' in x['text'])],r['consoleErrors']
  if args.mode=='file':assert not [x for x in r['requests'] if x.startswith('http')]
  b.close()
 r['passed']=True
finally:
 r['finishedAt']=datetime.now(timezone.utc).isoformat();(OUT/(args.mode+'-recovery-qa.json')).write_text(json.dumps(r,ensure_ascii=False,indent=2))
