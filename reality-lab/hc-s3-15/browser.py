from pathlib import Path
import os,json,hashlib,traceback
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parent;Q=Path(os.environ.get('RF315_QA',str(R/'qa/file')));Q.mkdir(parents=True,exist_ok=True)
M=json.loads((R/'BUILD_MANIFEST.json').read_text());D=json.loads((R/'AUDIT.json').read_text());URL=os.environ.get('RF315_URL',(R/'preview.html').as_uri())
report={'passed':False,'url':URL,'sourceCommit':M['sourceCommit'],'checks':[],'pageErrors':[],'consoleErrors':[],'requestFailures':[],'solverExecuted':False,'newMotionExecuted':False,'fitCertified':False,'physicalDeviceTested':False};requests=[]
def save():(Q/'BROWSER.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
def check(name,ok=True,detail=None):
 if not ok:raise AssertionError(name+': '+str(detail))
 report['checks'].append({'name':name,'passed':True,'detail':detail});print('PASS',name,flush=True);save()
def shot(page,name):
 p=Q/(name+'.png');page.screenshot(path=str(p),timeout=60000);report.setdefault('screenshots',[]).append({'file':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 context=browser.new_context(viewport={'width':1440,'height':1100},device_scale_factor=1,accept_downloads=True);page=context.new_page();page.set_default_timeout(60000)
 page.on('pageerror',lambda e:report['pageErrors'].append(str(e)));page.on('console',lambda e:report['consoleErrors'].append(e.text) if e.type=='error' else None);page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None);page.on('requestfailed',lambda r:report['requestFailures'].append({'url':r.url,'reason':r.failure}))
 state=lambda:page.evaluate('__RF315__.report()')
 try:
  page.goto(URL,wait_until='domcontentloaded',timeout=120000);page.wait_for_function('!!window.__RF315__')
  check('exact source build',state()['sourceCommit']==M['sourceCommit'])
  check('payload verified before rendering',state()['payloadSHA256']==M['dataSHA256'])
  check('default exact102 conflicting row',state()['fixture']=='guarded-step102.json' and state()['rowId']=='x324:55038:0')
  check('default positive local distance still inside main winding',abs(state()['probe']['distanceM']-.0001)<1e-12 and abs(state()['probe']['mainWinding']-1)<1e-10 and state()['probe']['positiveLocalInside'])
  check('problem visible without treating closed mesh as clean','自交' in page.locator('#gate').inner_text() and '不能' in page.locator('#interpretation').inner_text())
  check('selected local6 exact body pairs',len(state()['case']['selfIntersections'])==6 and all(p['exactVerified'] for p in state()['case']['selfIntersections']))
  check('full-body query provenance kept',state()['case']['bodyTriangles']==50624 and state()['case']['topology'][0]['triangles']==40120)
  check('no fake native runtime or fit success',page.locator('iframe').count()==0 and not any(state()[k] for k in ['live','sourceWritten','solverExecuted','fitCertified']))
  shot(page,'01-positive-local-still-inside')
  page.locator('#probe-in').click();check('minus100micron shows double layer',state()['offset']==2 and abs(state()['probe']['mainWinding']-2)<1e-10)
  page.locator('#probe-zero').click();check('on-surface winding not assigned',state()['probe']['mainWinding'] is None and '不强行分类' in page.locator('#probe-table').inner_text())
  page.locator('#probe-out').click();check('plus100micron restores original positive-but-inside observation',state()['probe']['positiveLocalInside'])
  page.locator('#offset').focus();page.locator('#offset').press('End');check('probe slider actual record selected',state()['offset']==8)
  page.locator('#verify').click();check('browser exact fractions independently verify selected original pair',state()['verified'] and '精确重算' in page.locator('#proof').inner_text())
  page.locator('#pair').select_option('1');check('pair selection invalidates old verification label',not state()['verified'] and '尚未' in page.locator('#proof').inner_text())
  page.locator('#verify').click();check('second actual pair verifies independently',state()['verified'])
  for c in D['cases']:
   page.locator('#fixture').select_option(c['fixture']);check(c['fixture']+' source rows available',page.locator('#row option').count()==len(c['rows']))
   for r in c['rows']:
    page.locator('#row').select_option(r['id']);check(c['fixture']+':'+r['id']+' exact source identity',state()['row']==r and r['id'] in page.locator('#source-title').inner_text())
   passed=page.evaluate('(pairs)=>pairs.every(p=>__RF315__.verifyPair(p))',c['selfIntersections']);check(c['fixture']+' all strict proofs independently recomputed in browser',passed)
  changed=json.loads(json.dumps(D['cases'][-1]['selfIntersections'][0]));changed['bTriangle']=[[x+1 for x in p] for p in changed['bTriangle']]
  check('tampered body witness refused by exact computation',page.evaluate('(p)=>!__RF315__.verifyPair(p)',changed))
  page.locator('#reset').click();check('restore critical source case',state()['fixture']=='guarded-step102.json' and state()['offset']==6 and not state()['verified'])
  canvas=page.locator('#canvas');canvas.scroll_into_view_if_needed();box=canvas.bounding_box();check('real WebGL canvas size',box['width']>300 and box['height']>300 and state()['draws']>0)
  old=state()['camera'];before=canvas.screenshot();page.mouse.move(box['x']+box['width']*.5,box['y']+box['height']*.5);page.mouse.down();page.mouse.move(box['x']+box['width']*.65,box['y']+box['height']*.6,steps=8);page.mouse.up();check('orbit changes actual geometry pixels and camera',state()['camera']!=old and hashlib.sha256(before).hexdigest()!=hashlib.sha256(canvas.screenshot()).hexdigest())
  old=state()['camera']['zoom'];page.mouse.wheel(0,-120);page.wait_for_timeout(100);check('wheel zoom works',state()['camera']['zoom']!=old)
  before=canvas.screenshot();page.locator('#cloth').check();check('original cloth overlay changes rendered pixels',hashlib.sha256(before).hexdigest()!=hashlib.sha256(canvas.screenshot()).hexdigest());page.locator('#cloth').uncheck()
  before=canvas.screenshot();page.locator('#neighbors').uncheck();check('isolate two original body faces',hashlib.sha256(before).hexdigest()!=hashlib.sha256(canvas.screenshot()).hexdigest())
  page.locator('#camera-reset').click();check('view reset only affects camera',state()['camera']=={'yaw':.65,'pitch':.2,'zoom':1} and not state()['sourceWritten'])
  page.locator('#verify').click();page.evaluate('scrollTo(0,0)');shot(page,'02-body-self-intersection')
  with page.expect_download() as event:page.locator('#export').click()
  export=Q/'EXPORTED_REVIEW.json';event.value.save_as(export);out=json.loads(export.read_text());check('export preserves full original audit not repaired data',out['audit']==D and out['browserExactVerified'] and not out['fitCertified'] and not out['sourceWritten'])
  check('source geometry immutable across all UI interactions',state()['case']==D['cases'][-1])
  page.set_viewport_size({'width':390,'height':844});page.evaluate('scrollTo(0,0)');page.wait_for_timeout(150);check('390px layout fits',page.evaluate('document.documentElement.scrollWidth<=innerWidth+2'));shot(page,'03-mobile')
  if URL.startswith('file:'):check('self-contained file no HTTP requests',not requests,requests)
  check('zero page errors',not report['pageErrors'],report['pageErrors']);check('zero console errors',not report['consoleErrors'],report['consoleErrors']);check('zero failed requests',not report['requestFailures'],report['requestFailures'])
  report['passed']=True;report['publicVerified']=URL.startswith('https:');report['fileVerified']=URL.startswith('file:')
 except Exception as e:
  report['failure']=str(e);report['trace']=traceback.format_exc();print(report['trace'],flush=True)
  try:report['lastState']=state();shot(page,'FAILURE')
  except Exception as e2:report['captureFailure']=str(e2)
 finally:save();context.close();browser.close()
if not report['passed']:raise SystemExit(1)
