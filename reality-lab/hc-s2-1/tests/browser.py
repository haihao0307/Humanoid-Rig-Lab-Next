from pathlib import Path
import os,json,hashlib,traceback,time
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(os.environ.get('REALITY_QA',str(ROOT/'qa/local')));OUT.mkdir(parents=True,exist_ok=True)
URL=os.environ.get('REALITY_URL','http://127.0.0.1:8765/preview.html')
BUILD=json.loads((ROOT/'BUILD_MANIFEST.json').read_text())
R={'version':'REALITY-HC-S2.1','url':URL,'sourceCommit':BUILD['sourceCommit'],'passed':False,'checks':[],'pageErrors':[],'consoleErrors':[],'failedRequests':[],'screenshots':[],'publicBrowserVerified':False,'patternPrivateVerified':False,'physicalDeviceTested':False,'userVisualAcceptance':False}
sha=lambda b:hashlib.sha256(b).hexdigest()
def save():(OUT/'BROWSER_REPORT.json').write_text(json.dumps(R,ensure_ascii=False,indent=2))
def check(name,truth=True,detail=None):
 if not truth:raise AssertionError(name+': '+str(detail))
 R['checks'].append({'name':name,'passed':True,'detail':detail});print('PASS',name,flush=True);save()
def shot(page,name):
 f=OUT/(name+'.png');page.screenshot(path=str(f),timeout=120000);R['screenshots'].append({'file':f.name,'sha256':sha(f.read_bytes()),'bytes':f.stat().st_size});return f
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
 context=browser.new_context(viewport={'width':1500,'height':980},device_scale_factor=1,accept_downloads=True)
 page=context.new_page();page.set_default_timeout(90000)
 page.on('pageerror',lambda e:R['pageErrors'].append(str(e)))
 page.on('console',lambda e:R['consoleErrors'].append(e.text) if e.type=='error' and 'favicon' not in e.text else None)
 page.on('requestfailed',lambda r:R['failedRequests'].append({'url':r.url[:240],'failure':r.failure}) if 'favicon' not in r.url and not r.url.startswith('blob:') else None)
 state=lambda:page.evaluate('__REALITY_FOUNDATION__.report()')
 try:
  page.goto(URL,wait_until='domcontentloaded',timeout=90000);page.wait_for_function('!!window.__REALITY_FOUNDATION__')
  s=state();check('fresh foundation source identity',s['sourceCommit']==BUILD['sourceCommit'])
  check('five scoped object entries',page.locator('[data-object]').count()==5)
  check('separate five-state counters',all(page.locator('#count-'+x).count()==1 for x in ['pass','fail','warning','unknown','na']))
  check('nothing heavyweight loaded at startup',s['iframeCount']==0 and not s['results'])
  check('public source has no access fragment', '#key=' not in page.content() and 'PRIVATE_ACCESS' not in page.content())
  page.locator('[data-object="fabric-s3"]').click();check('fabric registered only without fake adapter',page.locator('#load').is_disabled() and state()['selected']=='fabric-s3' and 'fabric-s3' not in state()['results'])
  page.locator('[data-object="garment-s5"]').click();check('garment registered only without fake adapter',page.locator('#load').is_disabled() and 'garment-s5' not in state()['results'])
  page.locator('[data-object="human-r07"]').click();started=time.monotonic();page.locator('#load').click();page.wait_for_function('window.__REALITY_FOUNDATION__.report().results["human-r07"]',timeout=300000);R['humanLoadMs']=(time.monotonic()-started)*1000
  s=state();human=s['results']['human-r07'];check('human normalized through common object schema',human['schema']=='kaopu/reality-object@0.2' and human['domain']=='human' and human['sourceMode']=='live_read_only')
  check('human body height remains unknown',next(x for x in human['measurements'] if x['definitionId']=='human.body_height')['value'] is None)
  check('human visible bounds remain numeric geometry only',all(next(x for x in human['measurements'] if x['definitionId']=='human.visible_bounds_'+axis)['value']>0 for axis in ['x','y','z']))
  check('human source is read-only and preserved',human['hostModified']==False and human['preservation']['geometry'] and human['preservation']['camera'] and human['preservation']['settings'])
  check('one original iframe after human load',s['iframeCount']==1 and s['frameGroup']=='s1')
  shot(page,'01-human-common-contract')
  page.locator('[data-object="shoe-r12"]').click();started=time.monotonic();page.locator('#load').click();page.wait_for_function('window.__REALITY_FOUNDATION__.report().results["shoe-r12"]',timeout=300000);R['shoeLoadMs']=(time.monotonic()-started)*1000
  s=state();shoe=s['results']['shoe-r12'];check('shoe reuses one S1 shell',s['iframeCount']==1 and s['frameGroup']=='s1')
  check('shoe millimeters converted once into meters',.1<next(x for x in shoe['measurements'] if x['definitionId']=='footwear.visible_bounds_z')['value']<.5)
  check('shoe last and size not guessed',next(x for x in shoe['measurements'] if x['definitionId']=='footwear.last_length')['value'] is None)
  check('warning and unknown counts are not merged',shoe['counts']['UNKNOWN']>0 and all(k in shoe['counts'] for k in ['PASS','FAIL','WARNING','UNKNOWN','NOT_APPLICABLE']))
  shot(page,'02-shoe-common-contract')
  with page.expect_download() as event:page.locator('#export-report').click()
  report_path=OUT/'FOUNDATION_REPORT.json';event.value.save_as(report_path);bundle=json.loads(report_path.read_text())
  check('unified report includes both loaded objects',set(x['objectId'] for x in bundle['objects'])=={'human-r07','shoe-r12'})
  check('unified report grants no physical or production approval',bundle['physicalCertification']==False and bundle['productionReady']==False and bundle['automaticRepair']==False)
  with page.expect_download() as event:page.locator('#export-defects').click()
  defects_path=OUT/'DEFECT_BUNDLE.json';event.value.save_as(defects_path);defects=json.loads(defects_path.read_text())
  check('all exported defects require source-owner repair and recheck',defects['defects'] and all(x['repairAuthorized']==False and x['verificationRequired'] for x in defects['defects']))
  page.locator('[data-tab="defects"]').click();check('defect panel visibly separates open tasks',page.locator('#defect-list .defect').count()>0)
  page.locator('[data-tab="measurements"]').click();check('semantic table shows definition and instance ids',page.locator('#measurement-rows tr').count()==len(shoe['measurements']))
  page.locator('[data-object="pattern-shorts-s2"]').click();page.locator('#load').click();page.wait_for_function('document.querySelector("#status").classList.contains("error")',timeout=120000)
  check('private pattern remains locked without fragment', 'pattern-shorts-s2' not in state()['results'] and '访问参数' in page.locator('#status').inner_text())
  check('failed private read does not invent pattern report',page.locator('#measurement-rows tr').count()==0)
  page.locator('#unload').click();check('unload releases source frame but retains normalized reports',state()['iframeCount']==0 and set(state()['results'])=={'human-r07','shoe-r12'})
  page.set_viewport_size({'width':390,'height':844});page.evaluate('scrollTo(0,0)');page.wait_for_timeout(300)
  check('390px viewport no document horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+2'))
  shot(page,'mobile-common-foundation')
  check('no unhandled page errors',not R['pageErrors'],R['pageErrors']);check('no console errors',not R['consoleErrors'],R['consoleErrors']);check('no failed requests',not R['failedRequests'],R['failedRequests'])
  R['publicBrowserVerified']=URL.startswith('https://');R['passed']=True
 except Exception as e:
  R['failure']=str(e);R['trace']=traceback.format_exc();print(R['trace'],flush=True)
  try:R['lastState']=state();shot(page,'FAILURE')
  except Exception as second:R['captureFailure']=str(second)
 finally:save();context.close();browser.close()
if not R['passed']:raise SystemExit(1)
print('BROWSER_PASSED',len(R['checks']),flush=True)
