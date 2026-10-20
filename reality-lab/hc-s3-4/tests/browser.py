from pathlib import Path
import os,json,hashlib,traceback
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1];Q=Path(os.environ.get('RF34_QA',str(R/'qa/file')));Q.mkdir(parents=True,exist_ok=True)
URL=os.environ.get('RF34_URL',(R/'preview.html').as_uri());M=json.loads((R/'BUILD_MANIFEST.json').read_text());D=json.loads((R/'diagnosis.json').read_text())
report={'version':'REALITY-HC-S3.4','sourceCommit':M['sourceCommit'],'url':URL,'passed':False,'checks':[],'errors':[],'consoleErrors':[],'failedRequests':[],'fitCertified':False,'physicalDeviceTested':False};requests=[]
def save():(Q/'BROWSER.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
def check(name,ok=True,detail=None):
 if not ok:raise AssertionError(name+': '+str(detail))
 report['checks'].append({'name':name,'passed':True,'detail':detail});print('PASS',name,flush=True);save()
def shot(page,name):
 p=Q/(name+'.png');page.screenshot(path=str(p),timeout=60000);report.setdefault('screenshots',[]).append({'path':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage']);c=b.new_context(viewport={'width':1440,'height':1050},device_scale_factor=1,accept_downloads=True);page=c.new_page();page.set_default_timeout(60000)
 page.on('pageerror',lambda e:report['errors'].append(str(e)));page.on('console',lambda e:report['consoleErrors'].append(e.text) if e.type=='error' else None);page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None);page.on('requestfailed',lambda r:report['failedRequests'].append(r.url))
 state=lambda:page.evaluate('__REALITY_S34__.report()')
 try:
  page.goto(URL,wait_until='domcontentloaded',timeout=90000);page.wait_for_function('!!window.__REALITY_S34__')
  check('fixed source build',state()['sourceCommit']==M['sourceCommit'])
  check('all actual checkpoint events retained',state()['eventCount']==len(D['trace']['events']))
  check('real original failure visible',D['runs']['traced']['status'] in page.locator('#outcome').inner_text())
  check('not described as live or successful fit',state()['live'] is False and state()['sourceFitAccepted'] is False and '不是成功试穿' in page.locator('header').inner_text())
  check('no invented repaired source',state()['repairApplied'] is False)
  check('first crossing selection exact',state()['selectedEvent']==D['trace']['firstCrossing']['event']['sequence']-1)
  check('actual panel identity visible',D['trace']['firstCrossing']['worstEdge']['panelId'] in page.locator('#edge-values').inner_text())
  check('actual red edge drawn',bool(page.locator('#panel path.edge').get_attribute('d')))
  check('actual reference boundary available',page.locator('#panel path.boundary').count()==1)
  check('two native role traces drawn',page.locator('#timeline path').count()==2)
  check('no heavyweight native engines on diagnostic load',page.locator('iframe,canvas').count()==0)
  shot(page,'01-first-fault')
  page.locator('#jump-initial').click();check('initial snapshot can be reviewed',state()['selectedEvent']==0)
  page.locator('#jump-gate').click();check('original gate snapshot selectable',state()['selectedEvent']==D['trace']['gate']['event']['sequence']-1)
  page.locator('#cursor').focus();page.locator('#cursor').press('Home');check('timeline keyboard control works',state()['selectedEvent']==0)
  page.locator('#cursor').press('End');check('last checkpoint selectable',state()['selectedEvent']==len(D['trace']['events'])-1)
  page.locator('#jump-first').click();check('first crossing can be restored',state()['selectedEvent']==D['trace']['firstCrossing']['event']['sequence']-1)
  count=page.locator('#edge-select option').count();check('gate maxima and first-edge options present',count==state()['edgeCount'] and count>=3)
  page.locator('#edge-select').select_option(str(count-1));edge=D['trace']['gate']['edges'][-1]['top'][-1];check('selected actual gate edge values shown',edge['panelId'] in page.locator('#edge-values').inner_text() and str(edge['edgeIndex']) in page.locator('#members').inner_text())
  shot(page,'02-gate-edge')
  page.locator('#edge-select').select_option('0');check('baseline parity disclosed','字节一致' in page.locator('#verification').inner_text())
  for button,name in [('#export','summary.json'),('#export-common','common.json'),('#export-defects','defects.json')]:
   with page.expect_download() as ev:page.locator(button).click()
   file=Q/name;ev.value.save_as(file);x=json.loads(file.read_text());check(name+' export parses',isinstance(x,dict))
  summary=json.loads((Q/'summary.json').read_text());check('summary cannot claim complete cause or repair',summary['rootCauseProven'] is False and summary['repairApplied'] is False)
  common=json.loads((Q/'common.json').read_text());check('unmodified shared bundle protocol',common['schema']=='kaopu/reality-foundation-bundle@0.2')
  check('original fit failure remains FAIL',any(x['id']=='fit:original_guard' and x['status']=='FAIL' for x in common['objects'][0]['checks']))
  defects=json.loads((Q/'defects.json').read_text());check('defects do not authorize source changes',all(not x['repairAuthorized'] and x['verificationRequired'] for x in defects['defects']))
  check('previous fixed platform remains reachable by link','42bc334213b133d59ba0cb70e50074de9a04e25d' in page.locator('a').first.get_attribute('href'))
  page.set_viewport_size({'width':390,'height':844});page.evaluate('scrollTo(0,0)');page.wait_for_timeout(150);check('390px layout fits without page overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+2'));shot(page,'03-mobile')
  if URL.startswith('file:'):check('file core needs no HTTP',not requests)
  check('zero unhandled errors',not report['errors'],report['errors']);check('zero console errors',not report['consoleErrors'],report['consoleErrors']);check('zero failed requests',not report['failedRequests'],report['failedRequests'])
  report['passed']=True;report['fileVerified']=URL.startswith('file:');report['publicVerified']=URL.startswith('https:')
 except Exception as e:
  report['failure']=str(e);report['stack']=traceback.format_exc();print(report['stack'],flush=True)
  try:shot(page,'FAILURE')
  except Exception:pass
 finally:save();c.close();b.close()
if not report['passed']:raise SystemExit(1)
