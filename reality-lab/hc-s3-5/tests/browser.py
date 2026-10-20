from pathlib import Path
import os,json,hashlib,traceback
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1];Q=Path(os.environ.get('RF35_QA',str(R/'qa/file')));Q.mkdir(parents=True,exist_ok=True)
URL=os.environ.get('RF35_URL',(R/'preview.html').as_uri());M=json.loads((R/'BUILD_MANIFEST.json').read_text());report={'version':'REALITY-HC-S3.5','sourceCommit':M['sourceCommit'],'url':URL,'passed':False,'checks':[],'pageErrors':[],'consoleErrors':[],'failedRequests':[],'physicalDeviceTested':False,'fitCertified':False};requests=[]
def save():(Q/'BROWSER.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
def check(name,value=True,detail=None):
 if not value:raise AssertionError(name+': '+str(detail))
 report['checks'].append({'name':name,'passed':True,'detail':detail});print('PASS',name,flush=True);save()
def shot(page,name):
 p=Q/(name+'.png');page.screenshot(path=str(p),timeout=60000);report.setdefault('screenshots',[]).append({'file':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 context=browser.new_context(viewport={'width':1440,'height':1100},device_scale_factor=1,accept_downloads=True)
 page=context.new_page();page.set_default_timeout(60000)
 page.on('pageerror',lambda e:report['pageErrors'].append(str(e)));page.on('console',lambda e:report['consoleErrors'].append(e.text) if e.type=='error' else None)
 page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None);page.on('requestfailed',lambda r:report['failedRequests'].append({'url':r.url,'reason':r.failure}))
 state=lambda:page.evaluate('__REALITY_S35__.report()')
 try:
  page.goto(URL,wait_until='domcontentloaded',timeout=120000);page.wait_for_function('!!window.__REALITY_S35__')
  check('fresh fixed source',state()['sourceCommit']==M['sourceCommit'])
  check('embedded evidence digest checked',page.evaluate('__REALITY_S35__.evidenceHash')==M['embeddedEvidence']['sha256'])
  check('four native comparison conditions visible',page.locator('#comparison tr').count()==4)
  check('no automatic heavyweight engine',page.locator('iframe,canvas').count()==0 and state()['live'] is False)
  check('frozen evidence mode visible','非实时' in page.locator('#mode').inner_text())
  original=state()['review'];network=len(requests)
  for case in ['baseline','previous-only','metric-only','combined']:
   page.locator('[data-case="'+case+'"]').click();check(case+' selected',state()['selected']==case)
   page.locator('#last-step').click();expected=len(next(c for c in original['cases'] if c['case']==case)['probe']['gates'])-1
   check(case+' actual last step reached',state()['step']==expected)
   check(case+' curve drawn from data',bool(page.locator('#case-line').get_attribute('points')))
  check('combined init pass and contact failure both retained','完成原生初始化' in page.locator('#checks').inner_text() and '负值说明采样穿插仍在' in page.locator('#checks').inner_text())
  c=next(o for o in state()['common']['objects'] if o['objectId']=='rf01-s35-combined');check('body and pair samples remain FAIL',all(next(q for q in c['checks'] if q['id']==id)['status']=='FAIL' for id in ['fit:body_contact','fit:garment_contact']))
  before=state()['review'];points=[]
  for name in ['activeRatio','sourceRatio','targetRatio']:
   page.locator('#denominator').select_option(name);points.append(page.locator('#case-line').get_attribute('points'));check(name+' changes view not input evidence',state()['review']==before)
  check('source denominator produces distinct graph',points[0]!=points[1])
  page.locator('#denominator').select_option('activeRatio');shot(page,'01-combined-outcomes')
  page.locator('[data-case="baseline"]').click();page.locator('#last-step').click();check('original focused contact details available','11.411359' in page.locator('#contacts').inner_text())
  check('prediction increments visible','预测方程最大残差' in page.locator('#prediction').inner_text());shot(page,'02-original-edge')
  slider=page.locator('#step-slider');slider.fill('1');slider.dispatch_event('input');check('stage slider selects original step',state()['step']==0)
  with page.expect_download() as ev:page.locator('#export-review').click()
  p=Q/'REVIEW.json';ev.value.save_as(p);actual=json.loads(p.read_text());check('full review export preserves all cases',actual==original)
  with page.expect_download() as ev:page.locator('#export-common').click()
  q=Q/'COMMON.json';ev.value.save_as(q);obj=json.loads(q.read_text());check('shared common protocol exported',obj['schema']=='kaopu/reality-foundation-bundle@0.2' and len(obj['objects'])==4)
  with page.expect_download() as ev:page.locator('#export-defects').click()
  q=Q/'DEFECTS.json';ev.value.save_as(q);defs=json.loads(q.read_text());check('all defects prohibit automatic source repair',defs['defects'] and all(not x['repairAuthorized'] and x['verificationRequired'] for x in defs['defects']))
  page.locator('#bad-source').click();check('wrong source rejected atomically',state()['review']==original and 'SOURCE_PIN_MISMATCH' in page.locator('#status').inner_text())
  bad=json.loads(json.dumps(actual));bad['cases'][0]['probe']['initial']['focus']['activeRatio']=1
  page.locator('#file').set_input_files({'name':'wrong-ratio.json','mimeType':'application/json','buffer':json.dumps(bad).encode()});page.wait_for_function('document.getElementById("status").textContent.includes("RATIO_FORMULA")');check('bad math import leaves valid report intact',state()['review']==original)
  page.locator('#file').set_input_files(str(p));page.wait_for_function('__REALITY_S35__.report().mode==="imported"');check('valid import remains unverified',all(o['sourceMode']=='imported_unverified' for o in state()['common']['objects']) and '未重新运行' in page.locator('#mode').inner_text())
  check('import cannot certify current source run',all(next(c for c in o['checks'] if c['id']=='fitting:init')['status']=='UNKNOWN' for o in state()['common']['objects']))
  page.locator('#restore').click();check('restore returns exact frozen native data',state()['mode']=='captured' and state()['review']==original)
  check('interactions add no HTTP requests',len(requests)==network)
  if URL.startswith('file:'):check('standalone evidence page works without HTTP',not requests)
  page.set_viewport_size({'width':390,'height':844});page.evaluate('scrollTo(0,0)');page.wait_for_timeout(150);check('390px layout has no page-level overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+2'));shot(page,'03-mobile')
  check('no unhandled page errors',not report['pageErrors'],report['pageErrors']);check('no console errors',not report['consoleErrors'],report['consoleErrors']);check('no failed requests',not report['failedRequests'],report['failedRequests'])
  report['passed']=True;report['fileVerified']=URL.startswith('file:');report['publicVerified']=URL.startswith('https:')
 except Exception as e:
  report['failure']=str(e);report['trace']=traceback.format_exc();print(report['trace'],flush=True)
  try:report['lastState']=state();shot(page,'FAILURE')
  except Exception as e2:report['captureFailure']=str(e2)
 finally:save();context.close();browser.close()
if not report['passed']:raise SystemExit(1)
