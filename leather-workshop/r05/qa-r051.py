from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image,ImageChops,ImageStat
import json,sys,io
r=Path(__file__).resolve().parent;q=r/'qa-r051';q.mkdir(exist_ok=True)
url=sys.argv[1] if len(sys.argv)>1 else (r/'preview.html').as_uri();public=url.startswith('https:');prefix='public' if public else 'local';errors=[];requests=[]
report={'version':'R05.1','url':url,'public':public,'realMobileDevice':False,'tests':[],'visualAcceptance':'PENDING_USER'}
def ck(name,ok,**kw):
 report['tests'].append({'name':name,'pass':bool(ok),**kw})
 if not ok:raise AssertionError(name)
def delta(a,b):return sum(ImageStat.Stat(ImageChops.difference(Image.open(io.BytesIO(a)).convert('RGB'),Image.open(io.BytesIO(b)).convert('RGB'))).mean)/3
try:
 with sync_playwright() as p:
  b=p.chromium.launch(headless=True,args=['--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-dev-shm-usage'])
  page=b.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1);page.set_default_timeout(90000)
  page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None);page.on('request',lambda r:requests.append(r.url))
  page.goto(url,wait_until='domcontentloaded',timeout=90000);page.wait_for_function('window.LEATHER_SEWING?.ready',timeout=120000);page.wait_for_timeout(300)
  ck('R05.1 starts as real 3D, not blank',page.evaluate('LEATHER_SEWING.version')=='R05.1' and not errors)
  c=page.locator('#view');initial=c.screenshot();ck('nonblank rendered canvas',max(ImageStat.Stat(Image.open(io.BytesIO(initial))).stddev)>8);page.screenshot(path=str(q/f'{prefix}-overall.png'))
  ck('thread materials are FrontSide, no DoubleSide masking',page.evaluate('LEATHER_SEWING.threads.every(x=>x.material.side===0)'))
  ck('outer grain material explicitly assigned to exterior face',page.evaluate('LEATHER_SEWING.surfaces.some(x=>x.geometry.userData.layer===0&&x.geometry.userData.side===1&&x.material.userData.surfaceRole==="outer-grain")'))
  for view in ['macro','back','section','route']:
   page.click('[data-view="'+view+'"]');page.wait_for_timeout(200);page.screenshot(path=str(q/f'{prefix}-{view}.png'));ck('view renders '+view,delta(initial,c.screenshot())>.2)
  page.click('[data-view="macro"]');page.click('#raking');page.wait_for_timeout(200);normal=c.screenshot();page.screenshot(path=str(q/f'{prefix}-normal-tension-raking.png'))
  stat=page.evaluate('LEATHER_SEWING.contact');ck('normal tension yields bounded solved micro-indentation',-.12<stat['minDisplacementMM']<-.005 and stat['relativeResidual']<1e-5,contact=stat)
  page.evaluate('LEATHER_SEWING.setResponse(false)');page.wait_for_timeout(200);flat=c.screenshot();ck('A/B removes actual load-dependent skin deformation',page.evaluate('LEATHER_SEWING.contact.minDisplacementMM')==0 and delta(normal,flat)>.015);page.screenshot(path=str(q/f'{prefix}-contact-off.png'));page.evaluate('LEATHER_SEWING.setResponse(true)')
  page.click('[data-tension="2.4"]');page.wait_for_timeout(200);high=page.evaluate('LEATHER_SEWING.contact');ck('tighter thread changes surface response rather than color only',high['minDisplacementMM']<stat['minDisplacementMM']*2.5);page.screenshot(path=str(q/f'{prefix}-high-tension.png'))
  page.click('[data-tension="0"]');page.wait_for_timeout(200);ck('slack thread unloads local surface response',page.evaluate('LEATHER_SEWING.contact.minDisplacementMM')==0);page.screenshot(path=str(q/f'{prefix}-slack.png'));page.click('[data-tension="0.8"]')
  # Additional low-angle viewpoint reproduces the previously missed hollow-thread failure.
  box=c.bounding_box();page.mouse.move(box['x']+box['width']*.55,box['y']+box['height']*.50);page.mouse.down();page.mouse.move(box['x']+box['width']*.55-160,box['y']+box['height']*.50-68,steps=10);page.mouse.up();page.wait_for_timeout(200);page.screenshot(path=str(q/f'{prefix}-grazing.png'))
  page.click('#hideThread');page.wait_for_timeout(100);page.screenshot(path=str(q/f'{prefix}-holes.png'));page.click('#hideThread')
  page.click('#watch');page.click('#pause');page.evaluate('LEATHER_SEWING.setProcess(.75,6)');page.wait_for_timeout(200);page.screenshot(path=str(q/f'{prefix}-needle.png'));page.click('#finish')
  page.select_option('#type','running');page.wait_for_timeout(200);ck('single needle pattern retained',page.evaluate('LEATHER_SEWING.model.topology.needleEndsPerThread')==1);page.select_option('#type','saddle');page.select_option('#rows','2');page.click('[data-view="home"]');page.wait_for_timeout(200);page.screenshot(path=str(q/f'{prefix}-two-rows.png'));page.select_option('#rows','1')
  with page.expect_download() as dl:page.click('#exportRoute')
  f=q/f'{prefix}-export.json';dl.value.save_as(str(f));j=json.loads(f.read_text());ck('export includes new tension parameter',j['seam']['tensionN']==.8)
  page.select_option('#materialSource','original');page.wait_for_timeout(200);page.screenshot(path=str(q/f'{prefix}-old-material-compare.png'));page.select_option('#materialSource','grain')
  ck('R04 immutable accepted link retained','160054f707c24e1713b3cbe2e3edbac512d8d2e6' in page.locator('#frozenLink').get_attribute('href'))
  if not public:
   ck('offline has zero HTTP requests',not any(x.startswith('http') for x in requests))
   m=b.new_page(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True);m.on('pageerror',lambda e:errors.append('mobile '+str(e)));m.goto(url,wait_until='domcontentloaded');m.wait_for_function('window.LEATHER_SEWING?.ready',timeout=120000);ck('mobile viewport width fits',m.evaluate('document.documentElement.scrollWidth<=390'));m.screenshot(path=str(q/'mobile-390x844.png'));m.click('[data-view="macro"]');m.wait_for_timeout(200);m.screenshot(path=str(q/'mobile-macro.png'));m.close()
  ck('zero console errors across requested modes',not errors,errors=errors);report['pass']=True;report['requests']=requests;b.close()
except Exception as e:
 report.update({'pass':False,'failure':str(e),'errors':errors})
 try:page.screenshot(path=str(q/f'{prefix}-failure.png'))
 except:pass
 raise
finally:
 (q/f'{prefix}-browser.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False))
