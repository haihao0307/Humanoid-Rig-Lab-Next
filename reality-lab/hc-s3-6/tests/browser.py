from pathlib import Path
import os,json,hashlib,traceback
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1];Q=Path(os.environ.get('RF36_QA',str(R/'qa/file')));Q.mkdir(parents=True,exist_ok=True)
URL=os.environ.get('RF36_URL',(R/'preview.html').as_uri());M=json.loads((R/'BUILD_MANIFEST.json').read_text())
report={'version':'REALITY-HC-S3.6','url':URL,'sourceCommit':M['sourceCommit'],'passed':False,'checks':[],'errors':[],'consoleErrors':[],'failedRequests':[],'physicalDeviceTested':False};requests=[]
def save():(Q/'BROWSER.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
def check(name,ok=True,detail=None):
 if not ok:raise AssertionError(name+': '+str(detail))
 report['checks'].append({'name':name,'passed':True,'detail':detail});print('PASS',name,flush=True);save()
def shot(page,name):
 p=Q/(name+'.png');page.screenshot(path=str(p),timeout=60000);report.setdefault('screenshots',[]).append({'path':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage']);ctx=b.new_context(viewport={'width':1440,'height':1080},device_scale_factor=1,accept_downloads=True);page=ctx.new_page();page.set_default_timeout(60000)
 page.on('pageerror',lambda e:report['errors'].append(str(e)));page.on('console',lambda e:report['consoleErrors'].append(e.text) if e.type=='error' else None);page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None);page.on('requestfailed',lambda r:report['failedRequests'].append(r.url))
 state=lambda:page.evaluate('__REALITY_S36__.report()')
 try:
  page.goto(URL,wait_until='domcontentloaded',timeout=90000);page.wait_for_function('!!window.__REALITY_S36__')
  check('correct source build',state()['sourceCommit']==M['sourceCommit'])
  check('frozen evidence explicitly labelled','非实时' in page.locator('#mode').inner_text())
  check('four native conditions visible',page.locator('#cases tr').count()==4)
  check('full progressive fitting recorded',state()['record']['result']['status']=='COMMITTED' and len(state()['record']['result']['steps'])==48)
  check('no live native engine hidden in the viewer',page.locator('iframe,canvas').count()==0 and not state()['live'])
  check('retained contact failure is not certified',state()['common']['checks'][-2]['status']=='UNKNOWN' and not state()['fitCertified'])
  shot(page,'01-transaction-commit')
  requests_before=len(requests)
  for case in ['baseline','cancel','fault','progressive']:
   page.locator('[data-case="'+case+'"]').click();check(case+' source selection',state()['selected']==case)
   page.locator('#step').focus();page.locator('#step').press('End');check(case+' timeline shows final observed step',state()['index']==len(state()['record']['result']['steps'])-1)
   check(case+' chart has actual paths',page.locator('#timeline path').count()>=3)
   if case in ['cancel','fault']:
    check(case+' whole-session restoration shown','逐字节一致' in page.locator('#metrics').inner_text() and state()['record']['result']['committedRuntimeRevision']==0)
  page.locator('[data-case="cancel"]').click();shot(page,'02-cancel-restore')
  with page.expect_download() as e:page.locator('#export-case').click()
  p=Q/'EXPORTED_CASE.json';e.value.save_as(p);data=json.loads(p.read_text());check('actual cancellation export preserved',data['record']['result']['status']=='CANCELLED' and data['live'] is False)
  with page.expect_download() as e:page.locator('#export-common').click()
  p2=Q/'COMMON.json';e.value.save_as(p2);check('existing shared protocol envelope exported',json.loads(p2.read_text())['schema']=='kaopu/reality-foundation-bundle@0.2')
  with page.expect_download() as e:page.locator('#export-defects').click()
  p3=Q/'DEFECTS.json';e.value.save_as(p3);check('source repair remains unauthorized',all(not d['repairAuthorized'] and d['verificationRequired'] for d in json.loads(p3.read_text())['defects']))
  before=state()['record'];bad=json.loads(json.dumps(data));bad['record']['source']['commit']='0'*40
  page.locator('#import').set_input_files({'name':'wrong-source.json','mimeType':'application/json','buffer':json.dumps(bad).encode()});page.wait_for_function('document.getElementById("status").textContent.includes("SOURCE_PIN_MISMATCH")');check('bad import atomic',state()['record']==before)
  page.locator('#import').set_input_files(str(p));page.wait_for_function('__REALITY_S36__.report().imported');check('import remains unverified',state()['common']['sourceMode']=='imported_unverified' and '未复验' in page.locator('#mode').inner_text())
  check('external rollback assertion not treated as native rerun',next(c for c in state()['common']['checks'] if c['id']=='transaction:restore')['status']=='UNKNOWN')
  page.locator('#restore').click();check('restore returns frozen original evidence',not state()['imported'] and state()['record']==before)
  page.locator('[data-case="progressive"]').click();page.locator('#step').focus();page.locator('#step').press('Home');check('first step is gradual not full target',state()['record']['result']['steps'][state()['index']]['fraction']==1/32)
  check('interaction requires no new HTTP',len(requests)==requests_before)
  if URL.startswith('file:'):check('standalone viewer no HTTP dependencies',not requests)
  page.set_viewport_size({'width':390,'height':844});page.evaluate('scrollTo(0,0)');page.wait_for_timeout(150);check('390px viewport without overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+2'));shot(page,'03-mobile-transaction')
  check('zero unhandled page errors',not report['errors'],report['errors']);check('zero console errors',not report['consoleErrors'],report['consoleErrors']);check('zero failed requests',not report['failedRequests'],report['failedRequests']);report['passed']=True;report['publicVerified']=URL.startswith('https:');report['fileVerified']=URL.startswith('file:')
 except Exception as e:
  report['failure']=str(e);report['trace']=traceback.format_exc();print(report['trace'],flush=True)
  try:report['lastState']=state();shot(page,'FAILURE')
  except Exception as e2:report['captureFailure']=str(e2)
 finally:save();ctx.close();b.close()
if not report['passed']:raise SystemExit(1)
