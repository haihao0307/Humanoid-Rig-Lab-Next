"""R08 actual standalone/public browser acceptance. No screenshots replace the deliverable."""
from pathlib import Path
import argparse,os,json,hashlib,time,traceback
from playwright.sync_api import sync_playwright
from PIL import Image,ImageChops,ImageStat
R=Path(__file__).resolve().parent
parser=argparse.ArgumentParser();parser.add_argument('--url');parser.add_argument('--public',action='store_true');args=parser.parse_args()
O=R/'qa'/('release-public' if args.public else 'release-local');O.mkdir(parents=True,exist_ok=True)
report={'checks':[],'errors':[],'requests':[],'hostWarnings':[],'images':[],'scope':'Actual Chrome/SwiftShader. Desktop 1440x1000 and 390x844 mobile viewport, not physical phone. Paired stage pixels exclude text counters.'}
def check(name,passed,data=None):
 report['checks'].append({'name':name,'pass':bool(passed),'data':data});(O/'browser.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 if not passed:raise AssertionError(name)
def photo(page,name):
 page.evaluate('LEATHER_ATELIER.render(performance.now())');page.wait_for_timeout(120);p=O/(name+'.png');page.screenshot(path=str(p));report['images'].append(p.name)
 box=page.locator('#stage').bounding_box();im=Image.open(p).convert('RGB');return im.crop((round(box['x']+10),round(box['y']+26),round(box['x']+box['width']-10),round(box['y']+box['height']-55)))
def changed(a,b,threshold=.08):return sum(ImageStat.Stat(ImageChops.difference(a,b)).mean)/3>threshold
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('KAOPU_CHROMIUM_EXECUTABLE'),headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'])
 page=b.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1);page.set_default_timeout(180000);report['browserVersion']=b.version
 def console(m):
  if m.type!='error':return
  item={'text':m.text,'location':m.location}
  if m.location.get('url')=='https://htmlpreview.github.io/favicon.ico' and '404' in m.text:report['hostWarnings'].append(item)
  else:report['errors'].append(item)
 page.on('console',console);page.on('pageerror',lambda e:report['errors'].append(str(e)));page.on('request',lambda r:report['requests'].append(r.url) if r.url.startswith(('https:','http:')) else None)
 try:
  report['url']=args.url or (R/'public-lite.html').as_uri();page.goto(report['url'],wait_until='domcontentloaded',timeout=180000)
  page.wait_for_function("window.LEATHER_ATELIER?.ready || Boolean(document.getElementById('error') && !document.getElementById('error').hidden)",timeout=240000)
  check('R08 runtime, not an error overlay',page.evaluate('window.LEATHER_ATELIER?.version')=='R08.0',page.locator('#error').inner_text());check('application starts without shader exceptions',not report['errors'],report['errors'])
  snap=page.evaluate('LEATHER_ATELIER.snapshot()');report['initial']=snap
  expected_source=os.environ.get('R08_EXPECTED_SOURCE_SHA')
  if expected_source:check('rendered runtime source matches the immutable candidate',snap['sourceCommit']==expected_source,{'expected':expected_source,'actual':snap['sourceCommit']})
  check('all 13 surface choices and seven actual 3D product thumbnails',snap['thumbs']=={'materials':13,'products':7})
  ids=['wallet','belt','bag','cowboy','pirate','jacket','swatch']
  for id in ids:
   page.evaluate('(id)=>LEATHER_ATELIER.selectProduct(id)',id);page.wait_for_timeout(150)
   a=page.evaluate('LEATHER_ATELIER.audit()');ts=page.evaluate('LEATHER_ATELIER.measureShell()')
   check(id+' has continuous yarn and positive generated thickness on every panel',a['finite'] and a['detachedSticks']==0 and a['continuousThreadMeshes']>0 and all(x['minMM']>.15 for x in ts),{'audit':a,'thickness':ts})
   photo(page,id+'-whole')
   page.evaluate("LEATHER_ATELIER.setView('back')");photo(page,id+'-back')
   page.evaluate('LEATHER_ATELIER.inspectCut()');photo(page,id+'-actual-cut-edge')
   page.evaluate('LEATHER_ATELIER.thicknessView(true)');photo(page,id+'-thickness-colors');page.evaluate('LEATHER_ATELIER.thicknessView(false)')
   page.evaluate("LEATHER_ATELIER.setView('macro');LEATHER_ATELIER.setLight('rake')");photo(page,id+'-seam');page.evaluate("LEATHER_ATELIER.setLight('studio');LEATHER_ATELIER.setView('home')")
   check(id+' inspection has no rendering errors',not report['errors'],report['errors'])
  page.evaluate("LEATHER_ATELIER.selectProduct('wallet');LEATHER_ATELIER.resetGrab()")
  rect=page.locator('#stage').bounding_box();x=rect['x']+rect['width']*.5;y=rect['y']+rect['height']*.5
  page.locator('#grabTool').click();check('grab cursor is a hand',page.locator('#stage').evaluate('(e)=>getComputedStyle(e).cursor')=='grab')
  page.mouse.move(x,y);page.mouse.down();page.wait_for_function('LEATHER_ATELIER.productPhysics.held')
  before=page.evaluate('LEATHER_ATELIER.productPhysics');page.mouse.move(x+45,y-100,steps=20);page.wait_for_function('(t)=>LEATHER_ATELIER.productPhysics.timeS>t+.14',arg=before['timeS'],timeout=60000)
  held=page.evaluate('LEATHER_ATELIER.productPhysics');photo(page,'pointer-lift')
  check('real pointer drives worker force and lifts mass centre',held['finite'] and not held['failed'] and held['grabForceN']>0 and held['centerMM'][1]>before['centerMM'][1]+2,{'before':before,'held':held})
  page.mouse.up();page.wait_for_function('(t)=>LEATHER_ATELIER.productPhysics.timeS>t+.1',arg=held['timeS'],timeout=60000);released=page.evaluate('LEATHER_ATELIER.productPhysics');photo(page,'pointer-release')
  check('release keeps inertia and subsequent physical time',not released['held'] and released['finite'] and released['timeS']>held['timeS'] and released['centerMM']!=held['centerMM'],released)
  page.locator('#grabTool').click();page.evaluate('LEATHER_ATELIER.resetGrab()')
  for id in ids:
   page.evaluate('(id)=>LEATHER_ATELIER.selectProduct(id)',id)
   page.evaluate("window.stressDone=false;window.stressError=null;window.ticks=0;window.tickHandle=setInterval(()=>window.ticks++,20);LEATHER_ATELIER.grabTest(true).then(r=>{window.stressResult=r;window.stressDone=true;clearInterval(window.tickHandle)}).catch(e=>{window.stressError=String(e);window.stressDone=true;clearInterval(window.tickHandle)});void 0")
   page.wait_for_function('window.stressDone',timeout=240000);q=page.evaluate('({r:window.stressResult,e:window.stressError,ticks:window.ticks})')
   check(id+' force integration stays off the UI thread',not q['e'] and q['ticks']>3,q['ticks']);res=q['r'];check(id+' lift, swing and release finite within test input envelope',res['positionsChanged'] and res['held']['finite'] and res['released']['finite'] and not res['released']['failed'] and res['released']['peakStretch']<1.25 and res['released']['maxSeamGapErrorMM']<2,res)
   photo(page,id+'-after-swing');page.evaluate('LEATHER_ATELIER.resetGrab()')
  page.locator('details.craftParameters').evaluate_all('(es)=>es.forEach(e=>e.open=true)')
  page.evaluate("LEATHER_ATELIER.selectProduct('swatch')")
  for craft in ['plain','diamond','grid','channels','perforated','woven']:
   page.locator('#craftChoice').select_option(craft);a=page.evaluate('LEATHER_ATELIER.audit()');photo(page,'craft-'+craft)
   check(craft+' control generates finite geometry',a['finite'] and a['continuousThreadMeshes']>0,a)
  page.locator('#craftChoice').select_option('diamond');page.locator('#loftMM').evaluate("e=>{e.value=1;e.dispatchEvent(new Event('change'))}");low=page.evaluate('LEATHER_ATELIER.audit().boundsMM');a=photo(page,'loft-low')
  page.locator('#loftMM').evaluate("e=>{e.value=6;e.dispatchEvent(new Event('change'))}");high=page.evaluate('LEATHER_ATELIER.audit().boundsMM');c=photo(page,'loft-high');check('padding height changes generated surface, not just shading',high[1]>low[1]+2 and changed(a,c),{'low':low,'high':high})
  page.locator('#craftChoice').select_option('plain')
  for style in ['running','double','zigzag','cross','saddle']:
   page.locator('#stitchStyle').select_option(style);a=page.evaluate('LEATHER_ATELIER.audit()');photo(page,'stitch-'+style);check(style+' actual yarn control',a['finite'] and a['continuousThreadMeshes']>0)
  page.locator('#edgeFinish').select_option('bound');photo(page,'folded-edge-binding');page.locator('#edgeFinish').select_option('burnished')
  page.locator('#craftChoice').select_option('perforated')
  for shape in ['slot','zone','round']:page.locator('#holeShape').select_option(shape);photo(page,'punch-'+shape)
  page.locator('#craftChoice').select_option('plain')
  masses=[]
  for thick in ['0.65','1','1.65']:
   page.locator('#thicknessChoice').select_option(thick);page.wait_for_timeout(160);masses.append(page.evaluate('LEATHER_ATELIER.productPhysics.massG'));rows=page.evaluate('LEATHER_ATELIER.measureShell()');check('generated thickness '+thick+' is positive',all(r['minMM']>.15 for r in rows),rows);photo(page,'thickness-'+thick)
  check('nodal mass changes in proportion to the displayed thickness',abs(masses[0]/masses[1]-.65)<.01 and abs(masses[2]/masses[1]-1.65)<.01,masses);page.locator('#thicknessChoice').select_option('1')
  a=photo(page,'new-surface');page.locator('#ageChoice').select_option('1');c=photo(page,'weathered-surface');check('weathering changes stage pixels',changed(a,c));page.locator('#ageChoice').select_option('0')
  page.evaluate("LEATHER_ATELIER.selectProduct('wallet');LEATHER_ATELIER.setView('macro');LEATHER_ATELIER.setLight('rake')")
  a=photo(page,'seam-with-response');page.locator('#responseCompare').dispatch_event('pointerdown');c=photo(page,'seam-without-response');page.locator('#responseCompare').dispatch_event('pointerup');check('R05 contact response changes same-view surface pixels',changed(a,c,.015))
  for name in ['grainRelief','grainScale','surfaceRoughness','surfaceCoat']:
   values={'grainRelief':1.8,'grainScale':1.7,'surfaceRoughness':.2,'surfaceCoat':.3}
   before=photo(page,name+'-before');page.locator('#'+name).evaluate('(e,v)=>{e.value=v;e.dispatchEvent(new Event("change"))}',values[name]);after=photo(page,name+'-after');check(name+' affects real rendered material',changed(before,after,.02));page.locator('#restoreSurface').click()
  for mat in page.locator('[data-material]').evaluate_all('(es)=>es.map(e=>e.dataset.material)'):
   page.evaluate('(id)=>LEATHER_ATELIER.selectMaterial(id)',mat);photo(page,'material-'+mat);check(mat+' retained material renders',not report['errors'])
  page.evaluate("LEATHER_ATELIER.selectMaterial('heritage');LEATHER_ATELIER.setView('home')")
  page.locator('#legacyCraft').click();page.wait_for_function("document.querySelector('#craftArchiveFrame').srcdoc.length>10000")
  text=page.locator('#craftArchiveFrame').get_attribute('srcdoc');check('complete frozen R02 archive retained byte-for-byte',hashlib.sha256(text.encode()).hexdigest()=='deca836e87ce17a1c85c6be2de4b03570864ba9bbee8736564460e9d387a2b0e')
  page.wait_for_function("document.querySelector('#craftArchiveFrame').contentWindow.LEATHER_LAB?.ready");check('original R02 controls still drive live geometry',page.evaluate("(()=>{const lab=document.querySelector('#craftArchiveFrame').contentWindow.LEATHER_LAB;lab.setParam('loft',5);return lab.errors.length===0})()"));page.screenshot(path=str(O/'original-r02-controls.png'));page.locator('#closeCraftArchive').click()
  page.evaluate("LEATHER_ATELIER.switchMode('baseline')");page.wait_for_function("document.querySelector('#baselineFrame').contentWindow.LEATHER_SEWING?.ready")
  text=page.locator('#baselineFrame').get_attribute('srcdoc');check('R05 bytes and live sewing runtime intact',hashlib.sha256(text.encode()).hexdigest()=='46f44dd298eb33b23d41ec05cfe5b550f343fe5ca37cec424ae92b309012f26a');page.screenshot(path=str(O/'original-r05.png'))
  page.evaluate("LEATHER_ATELIER.switchMode('physics')");page.wait_for_function('LEATHER_ATELIER.physics!==null');page.evaluate('LEATHER_ATELIER.pausePhysics()')
  empty=page.evaluate('LEATHER_ATELIER.advancePhysics(240)');page.evaluate("LEATHER_ATELIER.physicsCommand('drop')");load=page.evaluate('LEATHER_ATELIER.advancePhysics(300)');photo(page,'legacy-physical-load');page.evaluate("LEATHER_ATELIER.physicsCommand('remove')");recover=page.evaluate('LEATHER_ATELIER.advancePhysics(300)');check('legacy R04 physical loading and recovery remain functional',load['finite'] and load['contactForceN']>.25 and load['centerSagMM']>empty['centerSagMM'] and abs(recover['centerSagMM']-empty['centerSagMM'])<.15,{'empty':empty,'loaded':load,'recovered':recover})
  page.evaluate("LEATHER_ATELIER.switchMode('products');LEATHER_ATELIER.selectProduct('wallet')")
  page.locator('#showPattern').click()
  with page.expect_download() as d:page.locator('#downloadPattern').click()
  f=O/d.value.suggested_filename;d.value.save_as(str(f));check('real metric pattern export contains open bores and calibration','100 mm calibration' in f.read_text() and 'ellipse' in f.read_text());page.locator('#closePattern').click()
  page.locator('#showRecipe').click()
  with page.expect_download() as d:page.locator('#downloadRecipe').click()
  f=O/d.value.suggested_filename;d.value.save_as(str(f));check('JSON export matches the actual R08 runtime',json.loads(f.read_text())['version']=='R08.0');page.locator('#closeRecipe').click()
  page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(200)
  for id in ids:
   page.evaluate('(id)=>LEATHER_ATELIER.selectProduct(id)',id);photo(page,'mobile-'+id);q=page.evaluate('LEATHER_ATELIER.frameAudit()');check(id+' actual generated bounds fit mobile viewport',q['maxAbsX']<.99 and q['maxAbsY']<.99 and q['inDepth'],q)
  check('mobile page has no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
  page.locator('[data-material="cross"]').scroll_into_view_if_needed();page.locator('[data-material="cross"]').click();check('mobile material thumbnail click works',page.evaluate('LEATHER_ATELIER.material')=='cross')
  check('application console and runtime tracker empty',not report['errors'] and not page.evaluate('LEATHER_ATELIER.errors'),report['errors'])
  if not args.public:check('single-file core makes zero remote requests',not report['requests'],report['requests'])
  report['pass']=True
 except Exception as e:
  report['pass']=False;report['failure']=str(e);report['traceback']=traceback.format_exc()
  try:page.screenshot(path=str(O/'FAILURE.png'));report['overlay']=page.locator('#error').inner_text()
  except:pass
 finally:
  (O/'browser.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps({'pass':report.get('pass'),'checks':len(report['checks']),'failure':report.get('failure'),'errors':report['errors']},ensure_ascii=False));b.close()
raise SystemExit(0 if report.get('pass') else 1)
