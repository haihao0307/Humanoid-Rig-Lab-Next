"""Actual interactive render acceptance. Technical pass does NOT mean film-quality approval."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
import threading,argparse,time,json,base64,io,statistics,math
from PIL import Image,ImageStat,ImageChops
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parent
P=argparse.ArgumentParser();P.add_argument('--source',required=True);P.add_argument('--url');A=P.parse_args()
Q=R/'qa'/('public' if A.url else 'browser');Q.mkdir(parents=True,exist_ok=True)
report={'version':'HAT-R11.0','source':A.source,'url':A.url,'environment':'GitHub Actions Ubuntu Chromium SwiftShader; not user device','checks':[],'clicks':[],'captures':[],'pageErrors':[],'consoleErrors':[],'passed':False,'userVisualAccepted':False,'filmReady':False}
def save(): (Q/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
def check(name,ok,detail=None):
 report['checks'].append({'name':name,'passed':bool(ok),'detail':detail});save()
 if not ok:raise AssertionError(name+': '+str(detail))
server=None
if A.url:url=A.url
else:
 server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(R)))
 threading.Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/index.html#hat=field'
def capture(page,name):
 t=time.perf_counter();text=page.evaluate('ownedHat.render()');data=base64.b64decode(text.split(',')[1]);im=Image.open(io.BytesIO(data)).convert('RGB')
 check('nonempty actual canvas '+name,min(im.size)>100 and sum(ImageStat.Stat(im).var)>40)
 (Q/(name+'.png')).write_bytes(data);report['captures'].append({'name':name,'width':im.width,'height':im.height,'hat':page.evaluate('ownedHat.recipe().id'),'readbackWallMS':(time.perf_counter()-t)*1000});save();return im

def click(page,id,cycle=None,label='catalogue'):
 t=time.perf_counter();page.locator(f'.hat-card[data-id="{id}"]').click()
 page.wait_for_function('(id)=>ownedHat.ready()&&ownedHat.recipe().id===id',arg=id,timeout=20000)
 elapsed=(time.perf_counter()-t)*1000;row={'id':id,'cycle':cycle,'label':label,'wallMS':elapsed,'hash':page.evaluate('ownedHat.hash()'),'programTiming':page.evaluate('ownedHat.stats().clicks.slice(-1)[0]')}
 report['clicks'].append(row);save();return row
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'])
  ctx=b.new_context(viewport={'width':1440,'height':1000},device_scale_factor=1)
  page=ctx.new_page();page.on('pageerror',lambda e:report['pageErrors'].append(str(e)))
  page.on('console',lambda msg:report['consoleErrors'].append(msg.text) if msg.type=='error' else None)
  requests=[];page.on('request',lambda req:requests.append(req.url))
  t=time.perf_counter();page.goto(url,wait_until='domcontentloaded',timeout=150000)
  page.wait_for_function('window.ownedHat&&ownedHat.ready()',timeout=90000);report['bootToReadyMS']=(time.perf_counter()-t)*1000
  check('actual source and version',page.evaluate('ownedHat.source')==A.source and page.evaluate('ownedHat.version')=='HAT-R11.0')
  page.wait_for_function('ownedHat.stats().thumbs===11',timeout=150000);report['bootToFullCatalogueMS']=(time.perf_counter()-t)*1000
  check('eleven real rendered thumbnails',page.locator('.hat-card img').evaluate_all('(images)=>images.length===11&&images.every(i=>i.complete&&i.naturalWidth>100)'))
  check('lighting adapter identity',page.evaluate('ownedHat.diagnostics().lighting')=='EB1-HAT-local-adapter-R01')
  ids=page.evaluate('HAT10.categories.map(c=>c.id)');hashes={}
  for cycle in range(4):
   for id in ids:
    row=click(page,id,cycle)
    if cycle==0:
     hashes[id]=row['hash'];page.evaluate("ownedHat.frame('three')");capture(page,id+'-three')
    else:check('deterministic return '+str(cycle)+'/'+id,row['hash']==hashes[id])
   stats=page.evaluate('ownedHat.stats()');check('bounded geometry cache cycle '+str(cycle),stats['cacheSize']<=11 and stats['cacheBytes']<=32*1024*1024,{'count':stats['cacheSize'],'bytes':stats['cacheBytes']})
  click(page,'field',label='field-construction')
  for pose in ['front','side','back','top','inside','macro']:
   page.locator('[data-view="'+pose+'"]').click();capture(page,'field-'+pose)
  page.locator('#light').select_option('neutral');page.locator('[data-view="three"]').click();capture(page,'field-neutral')
  page.locator('[data-view="macro"]').click();capture(page,'field-neutral-macro')
  page.locator('#light').select_option('studio');page.locator('[data-view="three"]').click()
  page.locator('#view-mode').select_option('fit')
  for head in ['oval','long','broad']:
   page.locator('#head').select_option(head);page.wait_for_function('(head)=>ownedHat.ready()&&ownedHat.recipe().head===head',arg=head,timeout=20000);capture(page,'field-fit-'+head)
  page.locator('#view-mode').select_option('product');page.evaluate("ownedHat.restore(HAT10.defaults('field'))");page.wait_for_function('ownedHat.ready()')
  original=page.evaluate('ownedHat.hash()');generated=page.evaluate('ownedHat.stats().metrics.generated')
  page.evaluate('ownedHat.set({detail:0})');smooth=capture(page,'field-surface-zero')
  page.evaluate('ownedHat.set({detail:1.2})');textured=capture(page,'field-surface-detail')
  delta=sum(ImageStat.Stat(ImageChops.difference(smooth,textured)).mean)/3
  check('generated fabric affects actual pixels',delta>.03,delta)
  page.locator('#color').evaluate("e=>{e.value='#6f5945';e.dispatchEvent(new Event('input',{bubbles:true}));}")
  coloured=capture(page,'field-colour');delta=sum(ImageStat.Stat(ImageChops.difference(textured,coloured)).mean)/3
  check('colour affects actual pixels',delta>.3,delta)
  check('surface edits do not rebuild shape',page.evaluate('ownedHat.hash()')==original and page.evaluate('ownedHat.stats().metrics.generated')==generated)
  page.locator('#save').click();saved=page.evaluate('ownedHat.recipe()');click(page,'bucket',label='recipe-test');page.locator('#load').click();page.wait_for_function('ownedHat.ready()&&ownedHat.recipe().id==="field"')
  check('recipe restored',page.evaluate('ownedHat.recipe()')==saved)
  old=page.evaluate('ownedHat.hash()');page.locator('#section').click();capture(page,'field-section');page.locator('#section').click();check('inspection leaves shape unchanged',page.evaluate('ownedHat.hash()')==old)
  start=page.evaluate('ownedHat.stats().metrics')
  page.evaluate("()=>{for(let i=0;i<16;i++)void ownedHat.set({id:'field',circumference:60.3});}");page.wait_for_function('ownedHat.ready()&&ownedHat.recipe().circumference===60.3',timeout=20000)
  end=page.evaluate('ownedHat.stats().metrics');check('deduplicated in-flight choices',end['ignoredDuplicates']-start['ignoredDuplicates']==15 and end['generated']-start['generated']==1)
  page.evaluate("()=>{void ownedHat.set({id:'field',circumference:61.2});ownedHat.cancel();}");page.wait_for_function('ownedHat.ready()',timeout=5000)
  check('cancel preserves current cap',page.evaluate('ownedHat.recipe().circumference')==60.3)
  page.evaluate("()=>{void ownedHat.set({id:'field',circumference:62.1});void ownedHat.set({id:'bucket'});void ownedHat.restore(HAT10.defaults('field'));}")
  page.wait_for_function('ownedHat.ready()&&ownedHat.recipe().id==="field"&&ownedHat.recipe().circumference===57.5',timeout=20000)
  check('last selection wins',True)
  check('no downloaded hat assets',not any('/assets/' in r or '/details/' in r or r.lower().endswith(('.glb','.gltf','.jpg','.webp')) for r in requests),requests)
  ctx.set_offline(True);page.locator('#clear').click()
  for id in ids:click(page,id,label='offline-after-load')
  check('all categories work after page-loaded offline',True)
  click(page,'field',label='mobile-viewport');page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(150);capture(page,'mobile-canvas')
  page.screenshot(path=str(Q/'mobile-viewport.png'),timeout=30000)
  report['mobileScope']='390x844 viewport only, not physical phone';page.set_viewport_size({'width':1440,'height':1000});page.locator('[data-view="three"]').click();page.wait_for_timeout(100)
  page.screenshot(path=str(Q/'desktop.png'),timeout=30000);capture(page,'field-final-three')
  box=page.locator('#canvas').bounding_box();before=page.evaluate('ownedHat.stats().metrics.draws');t=time.perf_counter()
  page.mouse.move(box['x']+box['width']*.4,box['y']+box['height']*.5);page.mouse.down();page.mouse.move(box['x']+box['width']*.55,box['y']+box['height']*.48,steps=15);page.mouse.up();page.wait_for_timeout(100)
  after=page.evaluate('ownedHat.stats().metrics.draws');check('orbit draws without regeneration',after>before)
  report['orbit']={'drawsObserved':after-before,'wallMS':(time.perf_counter()-t)*1000,'scope':'automation pointer path, not steady-state frame-rate guarantee'}
  report['diagnostics']=page.evaluate('ownedHat.diagnostics()');report['finalStats']=page.evaluate('ownedHat.stats()')
  check('bounded generated material families',report['diagnostics']['materialTiles']['families']<=16 and report['diagnostics']['materialTiles']['tileBytes']<=40*1024*1024,report['diagnostics']['materialTiles'])
  check('no application or shader errors',not report['pageErrors'] and not report['finalStats']['errors'],{'page':report['pageErrors'],'runtime':report['finalStats']['errors'],'console':report['consoleErrors']})
  warm=sorted(r['wallMS'] for r in report['clicks'] if r['cycle'] is not None and r['cycle']>0)
  report['performance']={'warmMedianMS':statistics.median(warm),'warmP95MS':warm[math.ceil(len(warm)*.95)-1],'warmMaxMS':max(warm),'allMaxMS':max(r['wallMS'] for r in report['clicks']),'warmCount':len(warm),'allClickCount':len(report['clicks']),'scope':'actual click through application readiness; not final physical display latency'}
  report['passed']=True;save();ctx.close();b.close();print(json.dumps({'passed':True,'checks':len(report['checks']),'performance':report['performance']}),flush=True)
except Exception as e:report['failure']=str(e);save();raise
finally:
 if server:server.shutdown()
