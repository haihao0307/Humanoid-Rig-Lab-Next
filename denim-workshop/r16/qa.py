"""Unmodified file/public runtime. Reference switch is an explicit shader A/B.
Readback occurs only for paused screenshots, not during the 30-second benchmark.
"""
from pathlib import Path
import argparse,base64,io,json,time,traceback
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright
P=Path(__file__).resolve().parent; O=P/'evidence';O.mkdir(exist_ok=True)
a=argparse.ArgumentParser();a.add_argument('--public');args=a.parse_args();mode='public' if args.public else 'file'
r={'passed':False,'mode':mode,'hardwareFPSVerified':False,'sixtyFPSAccepted':False,'states':[],'comparisons':[],'benchmarks':{},'network':{}}
def save():(O/(mode+'-qa.json')).write_text(json.dumps(r,ensure_ascii=False,indent=2))
def boot(b,label,parent=False,mobile=False):
 c=b.new_context(viewport={'width':390,'height':844} if mobile else {'width':1000,'height':780},device_scale_factor=1,is_mobile=mobile,has_touch=mobile);p=c.new_page();p.set_default_timeout(180000)
 n={'errors':[],'console':[],'http':[]};r['network'][label]=n
 p.on('pageerror',lambda e:n['errors'].append(str(e)));p.on('console',lambda m:n['console'].append({'text':m.text,'url':m.location.get('url')}) if m.type=='error' else None);p.on('response',lambda q:n['http'].append({'url':q.url,'status':q.status}) if q.status>=400 else None)
 url=(P.parent/'r15/index.html').as_uri() if parent else args.public or (P/'index.html').as_uri()
 p.goto(url,wait_until='domcontentloaded');p.wait_for_function('window.__DENIM_WORKBENCH__?.lastFrame||document.querySelector("#error")?.textContent?.trim()');assert not p.locator('#error').inner_text().strip(),p.locator('#error').inner_text();p.evaluate('window.A=__DENIM_WORKBENCH__');p.wait_for_function('A.physicsReady()&&A.renderIdle()');return c,p

def idle(p):p.wait_for_function('!A.state.animate&&A.renderIdle()')
def capture(p,name):
 idle(p);raw=base64.b64decode(p.evaluate('document.querySelector("#view").toDataURL().split(",")[1]'));im=np.asarray(Image.open(io.BytesIO(raw)).convert('RGB'));d=p.evaluate('({version:A.version,frame:A.lastFrame,physics:A.physicsReport(),generation:A.physicsGeneration(),cache:A.renderCacheReport?.(),gl:A.getGLError(),error:document.querySelector("#error").textContent})');d['name']=name;r['states'].append(d);(O/(mode+'-'+name+'.png')).write_bytes(raw);save();assert d['gl']==0 and not d['error'] and im.std()>2,(name,d);print('STATE',name,d['frame']['frame'],d['physics']['steps'],flush=True);return im,d

def change(p,patch):
 f=p.evaluate('A.lastFrame.frame');p.evaluate('(x)=>A.setState(x)',patch);p.wait_for_function('(f)=>A.lastFrame.frame>f&&A.renderIdle()',arg=f)
def fold(p,t=3):
 p.evaluate('A.enterExperiment("fold",false)');p.wait_for_function('A.physicsReady()&&A.renderIdle()&&A.lastFrame.physics?.model==="continuous-curvature-sheet@1"&&A.lastFrame.physics.steps===0');p.evaluate('(s)=>A.advanceExperiment(s)',t);p.wait_for_function('(n)=>A.lastFrame.physics.steps===n&&A.renderIdle()',arg=round(240*t))
def comparison(name,x,y):
 d=np.abs(x.astype(int)-y.astype(int));v={'name':name,'maxChannel':int(d.max()),'meanChannel':float(d.mean()),'fractionOver3':float((d.max(axis=2)>3).mean())};r['comparisons'].append(v);save();assert v['meanChannel']<.2 and v['fractionOver3']<.003,v

def benchmark(p,label):
 fold(p);p.locator('#r15-benchmark').click();p.wait_for_function('document.querySelector("#r15-result").textContent.startsWith("已完成：")',timeout=90000);idle(p)
 with p.expect_download() as x:p.locator('#r15-save').click()
 out=O/(mode+'-'+label+'-performance.json');x.value.save_as(str(out));data=json.loads(out.read_text());assert data['benchmark']['completedFullDuration'] and data['conditions']['physicalState']['selfCollision'];r['benchmarks'][label]=data;save();print('BENCHMARK',label,json.dumps(data['benchmark']['statistics']),flush=True)

with sync_playwright() as pw:
 b=pw.chromium.launch(headless=False,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']);r['browserVersion']=b.version
 try:
  if not args.public:
   pc,pp=boot(b,'parent',parent=True);ref,_=capture(pp,'R15-material');fold(pp);refFold,_=capture(pp,'R15-fold');benchmark(pp,'R15');pc.close()
  c,p=boot(b,'candidate');im,_=capture(p,'material');
  if not args.public:comparison('R15 original material',im,ref)
  fold(p);im,d=capture(p,'fold');assert d['cache']['valid'] and d['cache']['captures']>0 and d['physics']['selfCollision'] and d['physics']['maxTensileStrain']<.03 and d['physics']['upperOpeningDegrees']<5
  if not args.public:comparison('R15 exact 720-step fold',im,refFold)
  for label,view in [('native',{'zoom':.95,'pitch':.34}),('transition-side',{'zoom':1.45,'pitch':1.25,'panX':-15})]:
   change(p,{**view,'r16Reference':False});cached,cd=capture(p,label+'-cached');gen=cd['generation'];steps=cd['physics']['steps'];count=cd['cache']['captures']
   change(p,{'yaw':-.105});assert p.evaluate('A.renderCacheReport().captures')==count
   change(p,{'yaw':-.10});cached,cd=capture(p,label+'-cached-matched')
   change(p,{'r16Reference':True});old,od=capture(p,label+'-reference');comparison(label,cached,old);assert od['generation']==gen and od['physics']['steps']==steps
  change(p,{'r16Reference':False});p.locator('#r14-grip').click();p.evaluate('A.advanceExperiment(.1)');p.wait_for_function('A.lastFrame.physics.steps===744&&A.renderIdle()');_,d=capture(p,'released');assert not d['physics']['gripEnabled'] and d['physics']['selfCollision']
  for thick in [.45,1.05]:
   p.locator('[data-thickness="'+str(thick)+'"]').click();p.wait_for_function('A.physicsReady()&&A.renderIdle()&&A.physicsReport().steps===0');p.evaluate('A.advanceExperiment(3)');p.wait_for_function('A.lastFrame.physics.steps===720&&A.renderIdle()');_,d=capture(p,'thickness-'+str(thick));assert abs(d['physics']['contactThicknessMm']-thick)<1e-6 and d['physics']['maxTensileStrain']<.03
  change(p,{'thickness':.7,'r16Reference':False});p.wait_for_function('A.physicsReady()&&A.renderIdle()');benchmark(p,'R16');capture(p,'after-motion')
  p.locator('#r13-restart').click();p.wait_for_function('A.lastFrame.physics.steps===0&&A.renderIdle()');capture(p,'reset');p.locator('#r13-original').click();p.wait_for_function('!A.state.experiment&&A.physicsReady()&&A.renderIdle()');capture(p,'returned-material');c.close()
  mc,mp=boot(b,'mobile-viewport',mobile=True);fold(mp,.1);capture(mp,'mobile-fold');mp.screenshot(path=str(O/(mode+'-mobile-layout.png')));mc.close()
  icon='https://htmlpreview.github.io/favicon.ico'
  for name,n in r['network'].items():
   assert not n['errors'],(name,n)
   assert not [x for x in n['http'] if not(x['url']==icon and x['status']==404)],(name,n)
   assert not [x for x in n['console'] if not(x['url']==icon and '404' in x['text'])],(name,n)
  r['passed']=True
 except Exception:r['failure']=traceback.format_exc();raise
 finally:save();b.close()
