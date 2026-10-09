"""Real Chromium QA for local standalone and public commit-pinned candidate."""
from pathlib import Path
import argparse, hashlib, json, time, traceback
from playwright.sync_api import sync_playwright
from PIL import Image, ImageChops, ImageStat
R=Path(__file__).resolve().parent
ap=argparse.ArgumentParser();ap.add_argument('--url');ap.add_argument('--public',action='store_true');args=ap.parse_args()
OUT=R/'qa'/('public' if args.public else 'local');OUT.mkdir(parents=True,exist_ok=True)
url=args.url or (R/'public-lite.html').as_uri()
report={'url':url,'scope':'real Chromium/SwiftShader; mobile viewport simulation, NOT a phone','checks':[],'errors':[],'requests':[],'screenshots':[]}
def check(name,yes,data=None):
 report['checks'].append({'name':name,'pass':bool(yes),'data':data})
 if not yes: raise AssertionError(name)
def photo(page,name):
 page.evaluate('window.LEATHER_ATELIER?.render(performance.now())');page.wait_for_timeout(120)
 p=OUT/(name+'.png');page.screenshot(path=str(p),full_page=False);report['screenshots'].append(p.name);return p
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'])
 page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
 page.on('pageerror',lambda e:report['errors'].append(str(e)))
 page.on('console',lambda m:report['errors'].append(m.text) if m.type=='error' else None)
 page.on('request',lambda q:report['requests'].append(q.url) if q.url.startswith(('http://','https://')) else None)
 try:
  page.goto(url,wait_until='domcontentloaded',timeout=120000)
  page.wait_for_function('window.LEATHER_ATELIER?.ready',timeout=120000)
  state=page.evaluate('LEATHER_ATELIER.snapshot()');report['initial']=state
  check('R06.1 runtime ready',state['sourceCommit']!='LOCAL-CANDIDATE',state)
  check('13 three-dimensional material previews and 5 object views',state['thumbs']=={'materials':13,'products':5})
  photo(page,'01-wallet-studio')
  box=page.locator('#stage').bounding_box();im=Image.open(OUT/'01-wallet-studio.png').convert('RGB').crop((box['x']+30,box['y']+30,box['x']+box['width']-30,box['y']+box['height']-40))
  check('product viewport has non-uniform rendered content',max(ImageStat.Stat(im).stddev)>8)
  for selector in ['[data-material=heritage] .thumb','[data-product=wallet] .thumb']:
   b=page.locator(selector).bounding_box();crop=Image.open(OUT/'01-wallet-studio.png').convert('RGB').crop((b['x']+4,b['y']+4,b['x']+b['width']-4,b['y']+b['height']-4))
   check(selector+' contains rendered 3D pixels',max(ImageStat.Stat(crop).stddev)>5)
  for selector in ['[data-material=heritage] .thumb','[data-product=wallet] .thumb']:
   b=page.locator(selector).bounding_box();crop=Image.open(OUT/'01-wallet-studio.png').convert('RGB').crop((b['x']+4,b['y']+4,b['x']+b['width']-4,b['y']+b['height']-4))
   check(selector+' contains rendered 3D pixels',max(ImageStat.Stat(crop).stddev)>5)
  ids=['wallet','belt','bag','hat','swatch']
  for id in ids:
   page.evaluate('(id)=>LEATHER_ATELIER.selectProduct(id)',id)
   audit=page.evaluate('LEATHER_ATELIER.audit()');check(id+' finite live geometry',audit['finite'] and audit['leatherMeshes']>0,audit)
   photo(page,'product-'+id)
   page.evaluate("LEATHER_ATELIER.setView('macro')");photo(page,'macro-'+id)
   page.evaluate("LEATHER_ATELIER.setView('back')");photo(page,'back-'+id)
  page.evaluate("LEATHER_ATELIER.selectProduct('swatch')")
  mats=page.locator('[data-material]').evaluate_all('(els)=>els.map(e=>e.dataset.material)')
  for id in mats:
   page.evaluate('(id)=>LEATHER_ATELIER.selectMaterial(id)',id);photo(page,'material-'+id)
   check(id+' selected and rendered',page.evaluate('LEATHER_ATELIER.material')==id and not report['errors'])
  page.evaluate("LEATHER_ATELIER.selectMaterial('heritage');LEATHER_ATELIER.selectProduct('wallet');LEATHER_ATELIER.setView('macro')")
  shots=[]
  for lighting in ['studio','neutral','rake']:
   page.evaluate('(s)=>LEATHER_ATELIER.setLight(s)',lighting);shots.append(photo(page,'light-'+lighting))
  check('lighting presets produce different pixels',len({hashlib.sha256(q.read_bytes()).hexdigest() for q in shots})==3)
  page.evaluate("LEATHER_ATELIER.setLight('studio');LEATHER_ATELIER.setView('home')")
  a=photo(page,'before-orbit');box=page.locator('#stage').bounding_box();x=box['x']+box['width']/2;y=box['y']+box['height']/2
  page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+110,y+32,steps=8);page.mouse.up();b=photo(page,'after-orbit')
  check('real pointer orbit changes product pixels',a.read_bytes()!=b.read_bytes())
  page.locator('#showPattern').click();check('wallet metric pattern visible',page.locator('#patternPreview svg').get_attribute('width')=='385mm')
  with page.expect_download() as d:page.locator('#downloadPattern').click()
  target=OUT/d.value.suggested_filename;d.value.save_as(str(target));check('SVG export has calibration and punch centres','100 mm calibration' in target.read_text() and '<circle' in target.read_text());page.locator('#closePattern').click()
  page.locator('#showRecipe').click()
  with page.expect_download() as d:page.locator('#downloadRecipe').click()
  target=OUT/d.value.suggested_filename;d.value.save_as(str(target));rec=json.loads(target.read_text());check('JSON recipe matches displayed product and baseline',rec['product']['w']==108 and rec['baseline']=='e86c36c8c34b1f2b57cc5462459ee2f490e556af');page.locator('#closeRecipe').click()
  page.evaluate("LEATHER_ATELIER.switchMode('baseline')")
  page.wait_for_function("document.getElementById('baselineFrame').contentWindow.LEATHER_SEWING?.ready",timeout=120000)
  decoded=page.locator('#baselineFrame').get_attribute('srcdoc');check('embedded R05 entry is byte-identical to frozen file',hashlib.sha256(decoded.encode()).hexdigest()=='46f44dd298eb33b23d41ec05cfe5b550f343fe5ca37cec424ae92b309012f26a')
  page.screenshot(path=str(OUT/'baseline-unmodified.png'));report['screenshots'].append('baseline-unmodified.png')
  page.evaluate("LEATHER_ATELIER.switchMode('physics')")
  page.wait_for_function('LEATHER_ATELIER.physics!==null',timeout=60000)
  page.evaluate('LEATHER_ATELIER.pausePhysics()')
  empty=page.evaluate('LEATHER_ATELIER.advancePhysics(360)');photo(page,'physics-unloaded')
  check('inherited SI-unit mass retained',abs(empty['massKg']-.0560448)<1e-9,empty)
  page.evaluate("LEATHER_ATELIER.physicsCommand('drop')")
  loaded=page.evaluate('LEATHER_ATELIER.advancePhysics(360)');photo(page,'physics-loaded')
  check('stone establishes finite two-way loading',loaded['finite'] and loaded['contactForceN']>.25 and loaded['centerSagMM']>empty['centerSagMM'],loaded)
  page.evaluate("LEATHER_ATELIER.physicsCommand('remove')")
  recovered=page.evaluate('LEATHER_ATELIER.advancePhysics(360)');photo(page,'physics-recovered')
  check('unloaded leather recovers toward empty equilibrium',recovered['finite'] and abs(recovered['centerSagMM']-empty['centerSagMM'])<abs(loaded['centerSagMM']-empty['centerSagMM']),recovered)
  before=page.evaluate('LEATHER_ATELIER.physics');page.evaluate("LEATHER_ATELIER.selectMaterial('black')");after=page.evaluate('LEATHER_ATELIER.physics')
  check('changing appearance does not change physical state',before==after)
  page.evaluate("LEATHER_ATELIER.switchMode('products');LEATHER_ATELIER.selectProduct('wallet')")
  page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(500);photo(page,'mobile-390x844')
  check('mobile viewport has no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
  bounds=page.evaluate('LEATHER_ATELIER.frameAudit()');check('resize automatically refits the visible product',bounds['maxAbsX']<.99 and bounds['maxAbsY']<.99 and bounds['inDepth'],bounds)
  for product_id in ['wallet','belt','bag','hat','swatch']:
   page.evaluate('(id)=>LEATHER_ATELIER.selectProduct(id)',product_id);photo(page,'mobile-fitted-'+product_id)
   bounds=page.evaluate('LEATHER_ATELIER.frameAudit()');check(product_id+' full mobile product bounds stay in frame',bounds['maxAbsX']<.99 and bounds['maxAbsY']<.99 and bounds['inDepth'],bounds)
  page.locator('[data-material="cross"]').scroll_into_view_if_needed();page.locator('[data-material="cross"]').click();check('mobile material selection works',page.evaluate('LEATHER_ATELIER.material')=='cross');photo(page,'mobile-materials')
  page.evaluate('window.scrollTo(0,0)');page.set_viewport_size({'width':1440,'height':1000});page.evaluate("LEATHER_ATELIER.selectMaterial('heritage');LEATHER_ATELIER.selectProduct('wallet');LEATHER_ATELIER.setView('home')");photo(page,'final-desktop')
  check('console and page errors are empty',not report['errors'],report['errors'])
  if not args.public:check('standalone core has zero remote requests',not report['requests'],report['requests'])
  report['pass']=True;report['final']=page.evaluate('LEATHER_ATELIER.snapshot()')
 except Exception as e:
  report['pass']=False;report['failure']=str(e);report['traceback']=traceback.format_exc()
  try:page.screenshot(path=str(OUT/'FAILURE.png'));report['visibleError']=page.locator('#error').inner_text()
  except Exception:pass
 finally:
  (OUT/'browser.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps({'pass':report.get('pass'),'checks':len(report['checks']),'failure':report.get('failure'),'errors':report['errors'],'output':str(OUT)},ensure_ascii=False));browser.close()
raise SystemExit(0 if report.get('pass') else 1)
