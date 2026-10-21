from pathlib import Path
import os,json,hashlib,traceback,base64
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1];Q=Path(os.environ.get('RF311_QA',str(R/'qa/file')));Q.mkdir(parents=True,exist_ok=True)
URL=os.environ.get('RF311_URL',(R/'preview.html').as_uri());M=json.loads((R/'BUILD_MANIFEST.json').read_text());D=json.loads((R/'review-data.json').read_text())
report={'version':'REALITY-HC-S3.11','url':URL,'sourceCommit':M['sourceCommit'],'passed':False,'checks':[],'pageErrors':[],'consoleErrors':[],'failedRequests':[],'physicalDeviceTested':False,'fitCertified':False};requests=[]
def save():(Q/'BROWSER.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
def check(name,ok,detail=None):
 if not ok:raise AssertionError(name+': '+str(detail))
 report['checks'].append({'name':name,'passed':True,'detail':detail});print('PASS',name,flush=True);save()
def shot(page,name):
 p=Q/(name+'.png');page.screenshot(path=str(p),timeout=60000);report.setdefault('screenshots',[]).append({'file':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 ctx=browser.new_context(viewport={'width':1440,'height':1100},device_scale_factor=1,accept_downloads=True);page=ctx.new_page();page.set_default_timeout(60000)
 page.on('pageerror',lambda e:report['pageErrors'].append(str(e)));page.on('console',lambda e:report['consoleErrors'].append(e.text) if e.type=='error' else None);page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None);page.on('requestfailed',lambda r:report['failedRequests'].append({'url':r.url,'failure':r.failure}))
 state=lambda:page.evaluate('__REALITY_S311__.report()')
 pixels=lambda:page.locator('#view').evaluate('(c)=>c.toDataURL("image/png")')
 try:
  page.goto(URL,wait_until='domcontentloaded',timeout=120000);page.wait_for_function('!!window.__REALITY_S311__')
  check('current immutable source build',state()['sourceCommit']==M['sourceCommit']);check('four actual cases retained',state()['data']==D)
  check('not live or fit certified',not state()['live'] and not state()['fitCertified'] and '非实时' in page.locator('#trust').inner_text())
  check('scope and unresolved constraint warning visible','最后一轮' in page.locator('.notice').first.inner_text() and '未解约束' in page.locator('body').inner_text())
  check('no hidden heavy native host',page.locator('iframe').count()==0)
  initial_network=len(requests);shot(page,'01-trajectory-overview')
  for motion in ['static','walk']:
   page.locator('#motion').select_option(motion);check(motion+' real cases selected',state()['motion']==motion)
   for channel in ['bottom','top','pair']:
    page.locator('#channel').select_option(channel);check(motion+'/'+channel+' channel retained',state()['channel']==channel and page.locator('#curve path').count()>=4)
   slider=page.locator('#step');slider.focus();slider.press('End');check(motion+' final step selectable',state()['step']==180);slider.press('Home');check(motion+' first measured step selectable',state()['step']==1)
  page.locator('#channel').select_option('bottom');page.locator('#jump30').click();check('known step30 shortcut works',state()['step']==30)
  original=state()['data'];page.locator('[data-patch="before"]').click();before=pixels();check('original target is positive before operation',state()['summary']['regression']['before448MM']>0)
  page.locator('[data-patch="guide"]').click();after=pixels();check('actual bad guide rejected and geometry differs',before!=after and '拒绝' in page.locator('#reg-status').inner_text() and state()['summary']['regression']['guide448MM']<0)
  page.locator('[data-patch="normal"]').click();check('native normal proposal independently selectable',state()['patch']=='normal')
  page.locator('[data-patch="before"]').click();view=page.locator('#view');view.scroll_into_view_if_needed();box=view.bounding_box();previous=pixels();angles=(state()['yaw'],state()['pitch'])
  page.mouse.move(box['x']+box['width']*.45,box['y']+box['height']*.45);page.mouse.down();page.mouse.move(box['x']+box['width']*.65,box['y']+box['height']*.6,steps=10);page.mouse.up()
  check('real3D rotation changes rendered pixels',pixels()!=previous and (state()['yaw'],state()['pitch'])!=angles)
  z=state()['zoom'];page.mouse.wheel(0,-180);page.wait_for_timeout(100);check('wheel changes actual view scale',state()['zoom']!=z)
  page.locator('#reset-camera').click();check('camera reset is exact',state()['yaw']==.55 and state()['pitch']==-.25 and state()['zoom']==1)
  old=pixels();page.locator('#show-body').uncheck();check('body layer changes actual pixels',pixels()!=old);page.locator('#show-body').check();old=pixels();page.locator('#show-cloth').uncheck();check('cloth layer changes actual pixels',pixels()!=old);page.locator('#show-cloth').check()
  shot(page,'02-joint-geometry')
  check('unresolved three channels are all shown',all(k in page.locator('#all-channels').inner_text() for k in ['上衣','下装','上下装']))
  check('cost and blocked counters shown','联合检查累计时间' in page.locator('#costs').inner_text() and '两个提案均被阻塞' in page.locator('#costs').inner_text())
  with page.expect_download() as ev:page.locator('#export').click()
  exported=Q/'EXPORTED.json';ev.value.save_as(exported);packet=json.loads(exported.read_text());check('export equals exact underlying native-derived data',packet['data']==D and packet['fitCertified'] is False)
  bad=json.loads(json.dumps(packet));bad['data']['source']['guardSHA256']='0'*64
  page.locator('#file').set_input_files({'name':'bad-source.json','mimeType':'application/json','buffer':json.dumps(bad).encode()});page.wait_for_function('document.getElementById("status").textContent.includes("SOURCE_PIN_MISMATCH")')
  check('wrong source import atomically rejected',state()['data']==original and state()['trust']=='built-in')
  bad=json.loads(json.dumps(packet));bad['data']['fitCertified']=True
  page.locator('#file').set_input_files({'name':'bad-certification.json','mimeType':'application/json','buffer':json.dumps(bad).encode()});page.wait_for_function('document.getElementById("status").textContent.includes("CERTIFICATION_ESCALATION")');check('fake certification rejected',state()['data']==original)
  page.locator('#file').set_input_files(str(exported));page.wait_for_function('__REALITY_S311__.report().trust==="imported"');check('valid imported file remains unverified','未复验' in page.locator('#trust').inner_text())
  page.locator('#restore').click();check('restore exact verified build data',state()['data']==original and state()['trust']=='built-in')
  check('core interactions require no network',len(requests)==initial_network)
  if URL.startswith('file:'):check('standalone zero HTTP requests',not requests)
  page.set_viewport_size({'width':390,'height':844});page.evaluate('scrollTo(0,0)');page.wait_for_timeout(100);check('390px no horizontal page overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+2'));shot(page,'03-mobile')
  check('no page errors',not report['pageErrors'],report['pageErrors']);check('no console errors',not report['consoleErrors'],report['consoleErrors']);check('no failed requests',not report['failedRequests'],report['failedRequests'])
  report['passed']=True;report['fileVerified']=URL.startswith('file:');report['publicVerified']=URL.startswith('https:');report['summary']=state()['summary']
 except Exception as e:
  report['failure']=str(e);report['trace']=traceback.format_exc();print(report['trace'],flush=True)
  try:report['lastState']=state();shot(page,'FAILURE')
  except Exception as e2:report['captureFailure']=str(e2)
 finally:save();ctx.close();browser.close()
if not report['passed']:raise SystemExit(1)
