from pathlib import Path
import os,json,hashlib,traceback
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(os.environ.get('REALITY_QA',str(ROOT/'qa/local')));OUT.mkdir(parents=True,exist_ok=True)
URL=os.environ.get('REALITY_URL','http://127.0.0.1:8765/preview.html')
manifest=json.loads((ROOT/'BUILD_MANIFEST.json').read_text())
report={'version':'REALITY-HC-S3','url':URL,'sourceCommit':manifest['sourceCommit'],'passed':False,'checks':[],'pageErrors':[],'consoleErrors':[],'failedRequests':[],'publicBrowserVerified':False,'physicalDeviceTested':False,'visualAcceptance':False}
def save():(OUT/'BROWSER_REPORT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
def check(name,value=True,detail=None):
 if not value:raise AssertionError(name+': '+str(detail))
 report['checks'].append({'name':name,'passed':True,'detail':detail});print('PASS',name,flush=True);save()
def shot(page,name):
 p=OUT/(name+'.png');page.screenshot(path=str(p),full_page=True,timeout=90000);return {'path':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 context=browser.new_context(viewport={'width':1480,'height':980},device_scale_factor=1,accept_downloads=True)
 page=context.new_page();page.set_default_timeout(60000)
 page.on('pageerror',lambda e:report['pageErrors'].append(str(e)))
 page.on('console',lambda e:report['consoleErrors'].append(e.text) if e.type=='error' else None)
 page.on('requestfailed',lambda r:report['failedRequests'].append({'url':r.url[:240],'failure':r.failure}) if not r.url.startswith('blob:') and 'favicon' not in r.url else None)
 try:
  page.goto(URL,wait_until='domcontentloaded',timeout=90000);page.wait_for_function('!!window.__REALITY_S3__')
  state=lambda:page.evaluate('__REALITY_S3__.report()')
  s=state();check('source identity',s['sourceCommit']==manifest['sourceCommit'],s['sourceCommit'])
  check('exact seven material objects',len(s['objects'])==7)
  check('garment is registered only',len(s['registeredOnly'])==1 and s['registeredOnly'][0]['id']=='garment-s5')
  check('seven live navigation buttons',page.locator('#object-list button:not([disabled])').count()==7)
  check('no source write or auto repair',not s['sourceWriteAPI'] and not s['automaticRepair'])
  check('no shader lighting geometry physics changes',not any([s['shadersChanged'],s['lightingChanged'],s['geometryChanged'],s['physicsChanged']]))
  check('no physical manufacturing fit or production claims',not any([s['physicalCertification'],s['manufacturingCertification'],s['garmentFitVerified'],s['productionReady']]))
  check('denim millimetre scale is visible','0.4233 mm' in page.locator('#measurement-body').inner_text())
  check('denim cross-version warning is visible','DENIM_VISUAL_PHYSICS_VERSION_SPLIT' in page.locator('#checks').inner_text())
  check('denim Tex remains missing','Tex' in page.locator('#coverage-body').inner_text() and '未确认' in page.locator('#coverage-body').inner_text())
  report['screenshots']=[shot(page,'01-denim-standards')]
  expectations={
   'fabric-knit-r15':('2.970 mm','gauge'),
   'fabric-leather-r17':('未确认','thicknessScale'),
   'fabric-silk-r15':('0.2400 mm','Denier'),
   'fabric-cotton-r03':('未确认','appearance-only'),
   'fabric-acrylic-r03':('未确认','appearance-only'),
   'fabric-linen-r03':('未确认','appearance-only')
  }
  for identity,(measurement_text,semantic_text) in expectations.items():
   page.locator(f'[data-object="{identity}"]').click();page.wait_for_function('(id)=>__REALITY_S3__.report().selected===id',arg=identity)
   check(identity+' selected',state()['selected']==identity)
   combined=page.locator('main').inner_text()
   check(identity+' bounded measurement shown',measurement_text in combined,measurement_text)
   check(identity+' semantic boundary shown',semantic_text.lower() in combined.lower(),semantic_text)
  page.locator('[data-object="fabric-denim-r17-2"]').click()
  page.locator('#feature-mm').fill('1');page.locator('#distance').fill('1');page.locator('#fov').fill('90');page.locator('#height-px').fill('1000')
  page.wait_for_function('document.querySelector("#footprint-result").textContent.includes("0.500")')
  check('pixel footprint calculator uses declared camera conditions','0.500 px' in page.locator('#footprint-result').inner_text())
  with page.expect_download() as ev:page.locator('#export-object').click()
  p1=OUT/'EXPORTED_OBJECT.json';ev.value.save_as(p1);obj=json.loads(p1.read_text());check('object export preserves identity',obj['object']['id']=='fabric-denim-r17-2')
  with page.expect_download() as ev:page.locator('#export-defects').click()
  p2=OUT/'EXPORTED_DEFECTS.json';ev.value.save_as(p2);defs=json.loads(p2.read_text());check('defect export cannot authorize repair',defs['repairAuthorized'] is False and defs['verificationRequired'] is True and len(defs['items'])>=7)
  with page.expect_download() as ev:page.locator('#export-all').click()
  p3=OUT/'EXPORTED_ALL.json';ev.value.save_as(p3);all_data=json.loads(p3.read_text());check('full report contains seven objects and no certifications',len(all_data['objects'])==7 and not any(all_data['certifications'].values()))
  check('previous foundation link remains available','553eb76103068ae76cb39995eba227b5d7497c10' in page.locator('#previous-foundation').get_attribute('href'))
  page.set_viewport_size({'width':390,'height':844});page.evaluate('scrollTo(0,0)');page.wait_for_timeout(300)
  check('390px viewport has no horizontal page overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+2'))
  report['screenshots'].append(shot(page,'02-mobile-material-map'))
  check('no page errors',not report['pageErrors'],report['pageErrors'])
  check('no console errors',not report['consoleErrors'],report['consoleErrors'])
  check('no failed network requests',not report['failedRequests'],report['failedRequests'])
  report['publicBrowserVerified']=URL.startswith('https://');report['passed']=True
 except Exception as e:
  report['failure']=str(e);report['trace']=traceback.format_exc();print(report['trace'],flush=True)
  try:report['lastState']=state();shot(page,'FAILURE')
  except Exception as second:report['captureFailure']=str(second)
 finally:
  save();context.close();browser.close()
if not report['passed']:raise SystemExit(1)
print('BROWSER_PASSED',len(report['checks']),flush=True)
