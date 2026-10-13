"""Browser acceptance of the new source-built HAT10 runtime; never substitute old pages."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
import argparse,threading,time,json,statistics,base64,io
from PIL import Image,ImageStat
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parent
arg=argparse.ArgumentParser();arg.add_argument('--url');arg.add_argument('--source',required=True);arg.add_argument('--executable');A=arg.parse_args()
Q=R/'qa'/('public' if A.url else 'browser');Q.mkdir(parents=True,exist_ok=True)
report={'environment':'GitHub Actions Ubuntu Chromium SwiftShader; not user hardware','url':A.url,'source':A.source,'checks':[],'clicks':[],'captures':[],'errors':[],'requests':[],'passed':False}
def save(): (Q/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
def check(name,ok,detail=None):
 report['checks'].append({'name':name,'passed':bool(ok),'detail':detail});save()
 if not ok:raise AssertionError(name+': '+str(detail))
server=None
if not A.url:
 server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(R)));threading.Thread(target=server.serve_forever,daemon=True).start()
 url=f'http://127.0.0.1:{server.server_port}/index.html#hat=pinch'
else:url=A.url

def capture(page,name,whole=False):
 if whole:data=page.screenshot(timeout=20000,animations='disabled')
 else:data=base64.b64decode(page.evaluate('ownedHat.render()').split(',')[1])
 im=Image.open(io.BytesIO(data)).convert('RGB');var=sum(ImageStat.Stat(im).var)
 check('nonblank capture '+name,min(im.size)>100 and var>50,{'size':im.size,'variance':var})
 (Q/(name+'.png')).write_bytes(data);report['captures'].append({'name':name,'width':im.width,'height':im.height,'variance':var});save();return im

def click(page,id,cycle):
 t=time.perf_counter();page.locator(f'.hat-card[data-id="{id}"]').click();page.wait_for_function('(id)=>ownedHat.ready()&&ownedHat.recipe().id===id',arg=id,timeout=20000)
 r={'cycle':cycle,'id':id,'clickThroughReadyMS':1000*(time.perf_counter()-t),'internal':page.evaluate('ownedHat.stats().clicks.at(-1)')};report['clicks'].append(r);save();return r
try:
 with sync_playwright() as pw:
  launch={'headless':True,'args':['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']}
  if A.executable:launch['executable_path']=A.executable
  b=pw.chromium.launch(**launch);context=b.new_context(viewport={'width':1440,'height':1000},device_scale_factor=1)
  page=context.new_page();page.on('console',lambda msg:report['errors'].append(msg.text) if msg.type=='error' and ('shader' in msg.text.lower() or 'webglprogram' in msg.text.lower()) else None);page.on('pageerror',lambda e:report['errors'].append(str(e)));page.on('request',lambda r:report['requests'].append(r.url))
  t=time.perf_counter();page.goto(url,wait_until='domcontentloaded',timeout=120000);page.wait_for_function('window.ownedHat&&ownedHat.ready()',timeout=45000)
  report['bootToReadyMS']=1000*(time.perf_counter()-t)
  check('runtime version',page.evaluate('ownedHat.version')=='HAT-R10.1');check('frozen source identity',page.evaluate('ownedHat.source')==A.source)
  page.wait_for_function('ownedHat.stats().thumbs===11',timeout=90000);check('11 real rendered thumbnails',page.locator('.hat-card img[src^="data:image/"]').count()==11)
  report['renderer']=page.evaluate('ownedHat.diagnostics()');check('supported WebGL2 renderer',bool(report['renderer']['renderer']));capture(page,'desktop',True)
  ids=page.evaluate('HAT10.categories.map(c=>c.id)');baselineHashes={}
  for id in ids:
   click(page,id,0);baselineHashes[id]=page.evaluate('ownedHat.hash()');capture(page,id+'-three')
   if id in ['pinch','news','braid','pleat','bell']:
    page.evaluate("ownedHat.frame('inside')");capture(page,id+'-inside');page.evaluate("ownedHat.frame('three')")
  headBuilds=page.evaluate('ownedHat.stats().metrics.headBuilds')
  for cycle in [1,2,3]:
   for id in ids:
    r=click(page,id,cycle);check(f'cached geometry reused {cycle}/{id}',r['internal']['cacheHit']);check(f'geometry stable {cycle}/{id}',page.evaluate('ownedHat.hash()')==baselineHashes[id])
  check('unchanged test head reused',page.evaluate('ownedHat.stats().metrics.headBuilds')==headBuilds)
  check('bounded cache',page.evaluate('ownedHat.stats().cacheSize')<=11 and page.evaluate('ownedHat.stats().cacheBytes')<=32*1024*1024)
  for h in ['oval','long','broad']:
   page.locator('#head').select_option(h);page.wait_for_function('(h)=>ownedHat.ready()&&ownedHat.recipe().head===h',arg=h,timeout=15000)
   page.locator('#view-mode').select_option('fit');check('head category selected '+h,page.evaluate('ownedHat.recipe().head')==h);capture(page,'fit-'+h)
  click(page,'news',4);page.locator('#view-mode').select_option('fit');capture(page,'news-fit')
  page.locator('#view-mode').select_option('product');page.evaluate("ownedHat.frame('inside')");capture(page,'news-interior')
  oldhash=page.evaluate('ownedHat.hash()');page.locator('#p-height').evaluate("e=>e.value='1.18'");page.locator('#p-height').dispatch_event('change');page.wait_for_function('ownedHat.ready()&&ownedHat.recipe().height===1.18',timeout=15000);check('crown parameter changes geometry',page.evaluate('ownedHat.hash()')!=oldhash)
  oldhash=page.evaluate('ownedHat.hash()');page.locator('#p-thickness').evaluate("e=>e.value='1.4'");page.locator('#p-thickness').dispatch_event('change');page.wait_for_function('ownedHat.ready()&&ownedHat.recipe().thickness===1.4',timeout=15000);check('thickness changes actual geometry',page.evaluate('ownedHat.hash()')!=oldhash)
  oldhash=page.evaluate('ownedHat.hash()');page.locator('#color').evaluate("e=>e.value='#806047'");page.locator('#color').dispatch_event('input');check('color does not rebuild geometry',page.evaluate('ownedHat.hash()')==oldhash)
  page.locator('#save').click();recipe=page.evaluate('ownedHat.recipe()');page.locator('#reset').click();page.wait_for_function('ownedHat.ready()&&ownedHat.recipe().height===1');page.locator('#load').click();page.wait_for_function('ownedHat.ready()&&ownedHat.recipe().height===1.18');check('recipe round trip',page.evaluate('ownedHat.recipe()')==recipe)
  page.locator('#section').click();capture(page,'section');page.locator('#section').click()
  page.evaluate("ownedHat.frame('three')");page.locator('#light').select_option('raking');capture(page,'raking-light');page.locator('#light').select_option('studio')
  prev=page.evaluate('ownedHat.hash()');page.evaluate("()=>{void ownedHat.set({circumference:59.7});ownedHat.cancel();}");page.wait_for_function('ownedHat.ready()');check('cancel preserves prior object',page.evaluate('ownedHat.hash()')==prev)
  page.evaluate("()=>{void ownedHat.set({id:'bucket',circumference:58.4});void ownedHat.set({id:'high',circumference:58.6});void ownedHat.set({id:'pinch',circumference:58.8});}")
  page.wait_for_function("ownedHat.ready()&&ownedHat.recipe().id==='pinch'&&ownedHat.recipe().circumference===58.8",timeout=15000);check('latest selection wins',True)
  page.locator('#clear').click();check('cache clear preserves active',page.evaluate('ownedHat.ready()&&ownedHat.stats().cacheSize===1'))
  context.set_offline(True)
  for id in ids:click(page,id,5)
  check('all categories work offline after initial document',True)
  context.set_offline(False)
  page.evaluate("ownedHat.frame('three')");page.set_viewport_size({'width':390,'height':844});click(page,'pinch',6);page.evaluate('scrollTo(0,0)');capture(page,'mobile-viewport',True)
  check('mobile page no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
  report['mobileScope']='390x844 viewport, not a physical phone';report['finalStats']=page.evaluate('ownedHat.stats()')
  check('no application exceptions',not report['errors'],report['errors']);check('no runtime-reported errors',not report['finalStats']['errors'],report['finalStats']['errors'])
  forbidden=[u for u in report['requests'] if any(k in u.lower() for k in ['makehuman','/r03/','/r04/','/r08/','/r09/','.webp','.glb','.obj'])]
  check('zero old hat asset network requests',not forbidden,forbidden)
  warm=[r['clickThroughReadyMS'] for r in report['clicks'] if r['cycle'] in [1,2,3]]
  report['performance']={'warmMedianMS':statistics.median(warm),'warmP95MS':sorted(warm)[int(.95*(len(warm)-1))],'warmMaxMS':max(warm),'scope':'real click through application readiness; not physical display timing','allClickCount':len(report['clicks'])}
  report['passed']=True;save();b.close();print(json.dumps({'passed':True,'checks':len(report['checks']),'performance':report['performance']}))
except Exception as e:report['failure']=str(e);save();raise
finally:
 if server:server.shutdown()
