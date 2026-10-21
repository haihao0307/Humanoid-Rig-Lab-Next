from pathlib import Path
import os,json,hashlib,traceback,time
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1];Q=Path(os.environ.get('RF312_QA',str(R/'qa/candidate-file')));Q.mkdir(parents=True,exist_ok=True)
URL=os.environ.get('RF312_URL',(R/'candidate-preview.html').as_uri());M=json.loads((R/'CANDIDATE_BUILD_MANIFEST.json').read_text());D=json.loads((R/'candidate-data.json').read_text())
report={'version':'RF01-S3.12-LOCAL','sourceCommit':M['sourceCommit'],'url':URL,'passed':False,'checks':[],'pageErrors':[],'consoleErrors':[],'failedRequests':[],'physicalDeviceTested':False,'fitCertified':False};requests=[]
def save():(Q/'BROWSER.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
def check(name,ok=True,detail=None):
 if not ok:raise AssertionError(name+': '+str(detail))
 report['checks'].append({'name':name,'passed':True,'detail':detail});print('PASS',name,flush=True);save()
def shot(page,name):
 p=Q/(name+'.png');page.screenshot(path=str(p),timeout=60000);report.setdefault('screenshots',[]).append({'file':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 ctx=browser.new_context(viewport={'width':1440,'height':1100},device_scale_factor=1,accept_downloads=True);page=ctx.new_page();page.set_default_timeout(60000)
 page.on('pageerror',lambda e:report['pageErrors'].append(str(e)));page.on('console',lambda e:report['consoleErrors'].append(e.text) if e.type=='error' else None)
 page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('https:','http:')) else None);page.on('requestfailed',lambda r:report['failedRequests'].append({'url':r.url,'failure':r.failure}))
 state=lambda:page.evaluate('__REALITY_S312_LOCAL__.report()')
 try:
  start=time.monotonic();page.goto(URL,wait_until='domcontentloaded',timeout=120000);page.wait_for_function('!!window.__REALITY_S312_LOCAL__');page.wait_for_function('!!document.getElementById("boundary-obstruction")');report['readyMS']=(time.monotonic()-start)*1000
  check('fresh exact implementation identity',state()['sourceCommit']==M['sourceCommit'])
  check('page uses exact native evidence',state()['data']==D)
  check('initial actual failure step30 selected',state()['step']==30 and state()['motion']=='walk')
  check('failure to find a move not labelled success',state()['summary']['exact']['accepted'] is False and '未通过' in page.locator('#reg-status').inner_text())
  check('residual channel failures visible',state()['summary']['cases']['walk:local']['channels']['top']['violatingCheckpoints']==28 and state()['summary']['cases']['walk:local']['channels']['pair']['violatingCheckpoints']==37)
  check('extra solve has zero accepted native writes',state()['summary']['cases']['walk:local']['totals']['localAccepted']==0 and '0 / 9' in page.locator('#metrics').inner_text())
  check('real3second scope not5secondABBA',state()['data']['fiveSecondABBAExecuted'] is False)
  check('fixed boundary obstruction is visible','48—49' in page.locator('#boundary-obstruction').inner_text())
  check('scope closure does not claim a solution','必要条件' in page.locator('#boundary-obstruction').inner_text())
  check('no heavyweight native workbench autostart',page.locator('iframe').count()==0)
  network=len(requests);shot(page,'01-native-comparison')
  for motion in ['static','walk']:
   page.locator('#motion').select_option(motion);check(motion+' actual sequence selectable',state()['motion']==motion)
   for channel in ['bottom','top','pair']:
    page.locator('#channel').select_option(channel);check(motion+':'+channel+' channel inspected',state()['channel']==channel)
  page.locator('#channel').select_option('bottom');page.locator('#jump102').click();check('step102 actual residual selected',state()['step']==102)
  slider=page.locator('#step');slider.focus();slider.press('End');check('last actual step selected',state()['step']==180);slider.press('Home');check('first actual step selected',state()['step']==1);page.locator('#jump30').click()
  check('six bounded local starting conditions available',page.locator('#scope option').count()==6)
  for i in range(6):
   page.locator('#scope').select_option(str(i));check('actual search scope '+str(i)+' shows refusal',state()['scopeIndex']==i and 'NO_DESCENT_WITHIN_BUDGET' in page.locator('#decision').inner_text())
  page.locator('#scope').select_option('0');canvas=page.locator('#view');canvas.scroll_into_view_if_needed();before=canvas.screenshot(timeout=60000)
  page.locator('[data-patch="after"]').click();after=canvas.screenshot(timeout=60000);check('last rejected scratch geometry really changes pixels',hashlib.sha256(before).hexdigest()!=hashlib.sha256(after).hexdigest())
  check('rejected trial not represented as committed','试算不写回' in page.locator('#reg-status').inner_text())
  page.locator('[data-patch="before"]').click();box=canvas.bounding_box();old=state()['yaw'];page.mouse.move(box['x']+box['width']*.45,box['y']+box['height']*.45);page.mouse.down();page.mouse.move(box['x']+box['width']*.65,box['y']+box['height']*.60,steps=8);page.mouse.up();rotated=canvas.screenshot();check('actual3D rotation changes camera and pixels',state()['yaw']!=old and hashlib.sha256(rotated).hexdigest()!=hashlib.sha256(before).hexdigest())
  z=state()['zoom'];page.mouse.wheel(0,-120);page.wait_for_timeout(100);check('wheel changes3D scale',state()['zoom']!=z)
  page.locator('#show-body').uncheck();hidden=canvas.screenshot();check('body layer toggles actual pixels',hashlib.sha256(hidden).hexdigest()!=hashlib.sha256(rotated).hexdigest());page.locator('#show-body').check()
  page.locator('#show-cloth').uncheck();check('cloth layer actually unchecked',not page.locator('#show-cloth').is_checked());page.locator('#show-cloth').check();page.locator('#reset-camera').click();check('camera reset restores exact controls',state()['yaw']==.55 and state()['pitch']==-.25 and state()['zoom']==1)
  shot(page,'02-local-geometry')
  with page.expect_download() as ev:page.locator('#export').click()
  f=Q/'EXPORTED.json';ev.value.save_as(f);packet=json.loads(f.read_text());check('full native report exported unchanged',packet['data']==D and packet['live'] is False and packet['fitCertified'] is False)
  old=state()['data'];bad=json.loads(json.dumps(packet));bad['data']['source']['nativeCommit']='0'*40
  page.locator('#file').set_input_files({'name':'bad-source.json','mimeType':'application/json','buffer':json.dumps(bad).encode()});page.wait_for_function('document.getElementById("status").textContent.includes("SOURCE_MISMATCH")');check('wrong source atomically preserves valid data',state()['data']==old)
  bad=json.loads(json.dumps(packet));bad['data']['boundaryAudit']['cases'][0]['stages'][0]['hits'][0]['point'][0]+=.001
  page.locator('#file').set_input_files({'name':'bad-edge.json','mimeType':'application/json','buffer':json.dumps(bad).encode()});page.wait_for_function('document.getElementById("status").textContent.includes("BOUNDARY_WITNESS_RECONSTRUCTION")');check('fabricated fixed-edge witness rejected',state()['data']==old)
  page.locator('#file').set_input_files(str(f));page.wait_for_function('__REALITY_S312_LOCAL__.report().trust==="imported"');check('external import never becomes fresh native evidence','未复验' in page.locator('#trust').inner_text() and '外部文件声明' in page.locator('#boundary-obstruction').inner_text())
  page.locator('#restore').click();page.wait_for_function('__REALITY_S312_LOCAL__.report().trust==="built-in"');check('restore returns exact source evidence',state()['data']==D and state()['step']==30)
  check('interactions need no further HTTP',len(requests)==network)
  if URL.startswith('file:'):check('standalone core has zero HTTP requests',not requests,requests)
  page.set_viewport_size({'width':390,'height':844});page.evaluate('scrollTo(0,0)');page.wait_for_timeout(150);check('390px page without overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+2'));shot(page,'03-mobile')
  check('no unhandled page errors',not report['pageErrors'],report['pageErrors']);check('no console errors',not report['consoleErrors'],report['consoleErrors']);check('no failed requests',not report['failedRequests'],report['failedRequests'])
  report['passed']=True;report['fileVerified']=URL.startswith('file:');report['publicVerified']=URL.startswith('https:');report['summary']=state()['summary']
 except Exception as e:
  report['failure']=str(e);report['trace']=traceback.format_exc();print(report['trace'],flush=True)
  try:report['lastState']=state();shot(page,'FAILURE')
  except Exception as x:report['captureFailure']=str(x)
 finally:save();ctx.close();browser.close()
if not report['passed']:raise SystemExit(1)
