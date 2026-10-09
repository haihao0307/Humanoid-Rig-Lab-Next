from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image,ImageChops,ImageStat
import json,sys,io
r=Path(__file__).resolve().parent;q=r/'qa';q.mkdir(exist_ok=True)
url=sys.argv[1] if len(sys.argv)>1 else (r/'preview.html').as_uri();public=url.startswith('https:');prefix='public' if public else 'local'
report={'version':'R05.0','url':url,'public':public,'realMobileDevice':False,'tests':[],'visualAcceptance':'PENDING_USER'};errors=[];requests=[]
def ck(name,ok,**kw):
 report['tests'].append({'name':name,'pass':bool(ok),**kw})
 if not ok:raise AssertionError(name)
def delta(a,b):return sum(ImageStat.Stat(ImageChops.difference(Image.open(io.BytesIO(a)).convert('RGB'),Image.open(io.BytesIO(b)).convert('RGB'))).mean)/3
try:
 with sync_playwright() as p:
  b=p.chromium.launch(headless=True,args=['--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-dev-shm-usage'])
  page=b.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
  page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None);page.on('request',lambda r:requests.append(r.url))
  page.goto(url,wait_until='domcontentloaded',timeout=60000);page.wait_for_function('window.LEATHER_SEWING?.ready',timeout=90000);page.wait_for_timeout(350)
  ck('actual R05 rendering initialized',page.evaluate('LEATHER_SEWING.version')=='R05.0' and not errors)
  canvas=page.locator('#view');initial=canvas.screenshot();ck('nonblank canvas',max(ImageStat.Stat(Image.open(io.BytesIO(initial))).stddev)>8)
  page.screenshot(path=str(q/f'{prefix}-overall.png'))
  for v in ['macro','back','section','route']:
   page.click('[data-view="'+v+'"]');page.wait_for_timeout(180);s=canvas.screenshot();ck('actual camera and material view '+v,delta(initial,s)>.2);page.screenshot(path=str(q/f'{prefix}-{v}.png'))
  page.click('#hideThread');page.wait_for_timeout(120);page.screenshot(path=str(q/f'{prefix}-holes.png'));ck('thread removal leaves physical hole view',not page.evaluate('LEATHER_SEWING.threads.some(x=>x.parent.visible)'));page.click('#hideThread')
  page.click('#watch');page.click('#pause')
  for phase in [.20,.40,.55,.75,1]:
   page.evaluate('(p)=>LEATHER_SEWING.setProcess(p,6)',phase);page.wait_for_timeout(150);a=page.evaluate('LEATHER_SEWING.audit()');ck('two-ended needle phase '+str(phase),a['finite'] and a['pointsOutsideHole']==0);page.screenshot(path=str(q/f'{prefix}-phase-{int(phase*100)}.png'))
  page.click('#finish');page.select_option('#type','running');page.wait_for_timeout(100);a=page.evaluate('LEATHER_SEWING.audit()');ck('running stitch alternates front and back',a['frontSpans']==6 and a['backSpans']==6 and a['passages']==12);page.screenshot(path=str(q/f'{prefix}-running.png'))
  page.select_option('#type','saddle');page.select_option('#rows','2');page.click('[data-view="home"]');page.wait_for_timeout(100);ck('two rows generated with independent threads',page.evaluate('LEATHER_SEWING.model.topology.threadCount')==2);page.screenshot(path=str(q/f'{prefix}-two-rows.png'));page.select_option('#rows','1')
  page.evaluate('LEATHER_SEWING.setParam("tightness",0)');page.click('[data-view="macro"]');page.wait_for_timeout(100);length=page.evaluate('LEATHER_SEWING.audit().totalThreadMM');page.screenshot(path=str(q/f'{prefix}-loose.png'));page.evaluate('LEATHER_SEWING.setParam("tightness",1)');ck('tighten changes thread length and route',page.evaluate('LEATHER_SEWING.audit().totalThreadMM')<length)
  if not public:
   page.click('#save');page.select_option('#preset','black');page.click('#restore');ck('recipe save and restore',page.evaluate('LEATHER_SEWING.recipe().material.preset')=='tan')
   with page.expect_download() as dl:page.click('#exportRoute')
   export=q/'exported-seam.json';dl.value.save_as(str(export));j=json.loads(export.read_text());ck('export includes actual continuous front/back and through routes',j['route']['topology']['throughBothLayers'] and len(j['route']['routes'])==3 and j['audit']['pointsOutsideHole']==0)
   ck('core offline zero HTTP',not any(u.startswith('http') for u in requests))
  page.click('#tabLegacy');frame=page.frame_locator('#legacy');page.wait_for_function('document.querySelector("#legacy").contentWindow.LEATHER_LAB?.ready',timeout=90000);ck('original R02 retained and runnable',page.evaluate('document.querySelector("#legacy").contentWindow.LEATHER_LAB.version')=='R02.0')
  frame.locator('[data-preset="black"]').click();page.wait_for_function('document.querySelector("#legacy").contentWindow.LEATHER_LAB.params.preset==="black"');page.click('#useLegacy');ck('live R02 recipe used by actual new seam',page.evaluate('LEATHER_SEWING.recipe().material.preset')=='black');page.screenshot(path=str(q/f'{prefix}-black-transfer.png'))
  frozen=page.locator('#frozenLink').get_attribute('href');ck('R04 points to exact accepted immutable build','160054f707c24e1713b3cbe2e3edbac512d8d2e6' in frozen and 'r04/preview.html' in frozen)
  page.click('#tabSource');ck('source and no-false-physics boundaries visible',page.locator('#sources').is_visible());page.click('#tabSeam')
  if not public:
   mobile=b.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=1);mobile.on('pageerror',lambda e:errors.append('mobile '+str(e)));mobile.goto(url,wait_until='domcontentloaded');mobile.wait_for_function('window.LEATHER_SEWING?.ready',timeout=90000);ck('mobile viewport fits width',mobile.evaluate('document.documentElement.scrollWidth<=390'));mobile.screenshot(path=str(q/'mobile-390x844.png'));mobile.click('[data-view="section"]');mobile.wait_for_timeout(150);mobile.screenshot(path=str(q/'mobile-section.png'));mobile.close()
  ck('zero console errors throughout new and retained views',not errors,errors=errors);report['pass']=True;report['errors']=errors;report['requests']=requests;b.close()
except Exception as e:
 report.update({'pass':False,'failure':str(e),'errors':errors})
 try:page.screenshot(path=str(q/f'{prefix}-failure.png'))
 except:pass
 raise
finally:
 (q/f'{prefix}-browser.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False))
