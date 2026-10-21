from pathlib import Path
import os,json,hashlib,traceback
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1];Q=Path(os.environ.get('RF37_QA',str(R/'qa/file')));Q.mkdir(parents=True,exist_ok=True)
URL=os.environ.get('RF37_URL',(R/'preview.html').as_uri());M=json.loads((R/'BUILD_MANIFEST.json').read_text());E=json.loads((R/'EVIDENCE.json').read_text());requests=[]
report={'passed':False,'url':URL,'sourceCommit':M['sourceCommit'],'checks':[],'errors':[],'consoleErrors':[],'failedRequests':[],'physicalDeviceTested':False}
def save():(Q/'BROWSER.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
def check(name,ok=True,detail=None):
 if not ok:raise AssertionError(name+': '+str(detail))
 report['checks'].append({'name':name,'passed':True,'detail':detail});print('PASS',name,flush=True);save()
def shot(page,name):
 p=Q/(name+'.png');page.screenshot(path=str(p),timeout=60000);report.setdefault('screenshots',[]).append({'file':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']);ctx=b.new_context(viewport={'width':1440,'height':1100},accept_downloads=True);p=ctx.new_page();p.set_default_timeout(60000)
 p.on('pageerror',lambda e:report['errors'].append(str(e)));p.on('console',lambda e:report['consoleErrors'].append(e.text) if e.type=='error' else None);p.on('requestfailed',lambda r:report['failedRequests'].append(r.url));p.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
 state=lambda:p.evaluate('__RF37VIEW__.report()')
 try:
  p.goto(URL,wait_until='domcontentloaded',timeout=120000);p.wait_for_function('!!window.__RF37VIEW__');network0=len(requests)
  check('current build',state()['sourceCommit']==M['sourceCommit']);check('explicit nonlive label','非实时' in p.locator('#mode').inner_text());check('same-state and repeat validations',state()['validation']['repeatWalkIdentical'] and state()['validation']['samePostFitState'])
  for c in ['static','walk','walk-repeat']:
   p.locator('#case').select_option(c)
   check(c+' starts at exact fit commit',state()['record']['stage']=='fit-committed' and state()['record']['stateSHA256']==E['cases'][c]['records'][0]['stateSHA256'])
   for k in ['top','bottom','pair']:
    p.locator('#channel').select_option(k);p.locator('#first').click();rows=E['cases'][c]['records'];get=lambda r:r['pair'] if k=='pair' else r['body'][0 if k=='top' else 1];i=next((i for i,r in enumerate(rows) if get(r)['beyondMargin']>0),0)
    check(c+':'+k+' first anomaly correctly selected',state()['frame']==i)
  p.locator('#case').select_option('static');p.locator('#channel').select_option('bottom');p.locator('#first').click()
  check('stationary body failure remains visible',state()['record']['step']==8 and state()['record']['body'][1]['witness']['localIntersection'] is not None)
  check('actual local-crossing claim distinct from sign','严格局部交叉' in p.locator('#proof').inner_text())
  p.evaluate('scrollTo(0,0)');shot(p,'01-static-onset')
  p.locator('#witness').scroll_into_view_if_needed();cv=p.locator('#witness');before=cv.evaluate('(c)=>c.toDataURL()');old=state();box=cv.bounding_box();p.mouse.move(box['x']+box['width']*.5,box['y']+150);p.mouse.down();p.mouse.move(box['x']+box['width']*.5+90,box['y']+190,steps=10);p.mouse.up();after=cv.evaluate('(c)=>c.toDataURL()')
  check('actual 3D camera responds',state()['yaw']!=old['yaw'] and before!=after)
  old=state()['zoom'];p.mouse.wheel(0,-200);p.wait_for_timeout(150);check('3D zoom responds',state()['zoom']!=old)
  p.locator('#camera').click();check('camera resets',state()['yaw']==.5 and state()['pitch']==-.3 and state()['zoom']==1)
  shot(p,'02-original-triangle-witness')
  p.locator('#case').select_option('walk');p.locator('#channel').select_option('pair');p.locator('#first').click();check('pair onset is step4',state()['record']['step']==4)
  check('unproven local crossing not falsely claimed','未证实' in p.locator('#proof').inner_text())
  p.locator('#frame').fill('14');p.locator('#frame').dispatch_event('input');check('last fixed step selectable',state()['record']['step']==12)
  p.locator('#initial').click();check('initial sample restores positive values',state()['frame']==0 and state()['record']['pair']['minimumM']>0)
  original=p.evaluate('__RF37VIEW__.raw()')
  with p.expect_download() as ev:p.locator('#export').click()
  path=Q/'EXPORTED.json';ev.value.save_as(path);check('export matches actual selected native record',json.loads(path.read_text())==original)
  invalid=json.loads(json.dumps(original));invalid['sourceCommit']='0'*40;p.locator('#file').set_input_files({'name':'wrong.json','mimeType':'application/json','buffer':json.dumps(invalid).encode()});p.wait_for_function('document.getElementById("status").textContent.includes("SOURCE_OR_SCHEMA")')
  check('bad import atomic',p.evaluate('__RF37VIEW__.raw()')==original and not state()['imported'])
  p.locator('#file').set_input_files(str(path));p.wait_for_function('__RF37VIEW__.report().imported');check('valid import is unverified','未复验' in p.locator('#mode').inner_text())
  p.locator('#restore').click();check('restore frozen trusted evidence',not state()['imported'])
  check('interactions require no new network',len(requests)==network0)
  if URL.startswith('file:'):check('standalone core zero HTTP',not requests,requests)
  p.set_viewport_size({'width':390,'height':844});p.evaluate('scrollTo(0,0)');p.wait_for_timeout(200);check('390px no horizontal overflow',p.evaluate('document.documentElement.scrollWidth<=innerWidth+2'));shot(p,'03-mobile-core')
  check('no uncaught errors',not report['errors'],report['errors']);check('no console errors',not report['consoleErrors'],report['consoleErrors']);check('no failed requests',not report['failedRequests'],report['failedRequests'])
  report['passed']=True;report['fileVerified']=URL.startswith('file:');report['publicVerified']=URL.startswith('https:')
 except Exception as e:
  report['failure']=str(e);report['trace']=traceback.format_exc();print(report['trace'],flush=True)
  try:shot(p,'FAILURE');report['state']=state()
  except Exception:pass
 finally:save();ctx.close();b.close()
if not report['passed']:raise SystemExit(1)
