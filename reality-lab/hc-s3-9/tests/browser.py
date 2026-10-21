from pathlib import Path
import json,os,hashlib,traceback
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1];Q=Path(os.environ.get('RF39_QA',str(R/'qa/file')));Q.mkdir(parents=True,exist_ok=True)
URL=os.environ.get('RF39_URL',(R/'preview.html').as_uri());M=json.loads((R/'BUILD_MANIFEST.json').read_text())
report={'sourceCommit':M['sourceCommit'],'url':URL,'passed':False,'checks':[],'pageErrors':[],'consoleErrors':[],'failedRequests':[],'physicalDeviceTested':False};requests=[]
sha=lambda b:hashlib.sha256(b).hexdigest()
def save():(Q/'BROWSER.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
def check(name,ok=True,detail=None):
 if not ok:raise AssertionError(name+': '+str(detail))
 report['checks'].append({'name':name,'passed':True,'detail':detail});print('PASS',name,flush=True);save()
def shot(page,name):
 p=Q/(name+'.png');page.screenshot(path=str(p),timeout=60000);report.setdefault('screenshots',[]).append({'file':p.name,'sha256':sha(p.read_bytes())})
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']);ctx=b.new_context(viewport={'width':1440,'height':1080},device_scale_factor=1,accept_downloads=True);p=ctx.new_page();p.set_default_timeout(60000)
 p.on('pageerror',lambda e:report['pageErrors'].append(str(e)));p.on('console',lambda e:report['consoleErrors'].append(e.text) if e.type=='error' else None);p.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None);p.on('requestfailed',lambda r:report['failedRequests'].append({'url':r.url,'failure':r.failure}))
 state=lambda:p.evaluate('__RF39VIEW__.report()')
 try:
  p.goto(URL,wait_until='domcontentloaded',timeout=120000);p.wait_for_function('!!window.__RF39VIEW__');check('current exact source build',state()['sourceCommit']==M['sourceCommit']);check('nonlive native evidence label visible','非实时' in p.locator('#mode').inner_text())
  check('four actual cases visible',p.locator('#summary tr').count()==4);check('time horizon from native clip visible','两个周期' in p.locator('#horizon').inner_text());check('timing limitations visible','同一CI主机' in p.locator('body').inner_text());check('no hidden full runtime iframe',p.locator('iframe').count()==0)
  baseline_requests=len(requests);raw=p.evaluate('__RF39VIEW__.raw()');report['caseTerminals']={k:{'plannedSteps':v['plannedSteps'],'completedSteps':v['completedSteps'],'failure':v['failure']} for k,v in raw['cases'].items()}
  for motion in ['static','walk']:
   p.locator('#motion').select_option(motion)
   for variant in ['baseline','coverage']:
    p.locator('#variant').select_option(variant);check(motion+' '+variant+' selection',state()['motion']==motion and state()['variant']==variant);p.locator('#initial').click();check(motion+' '+variant+' source initial state accessible',state()['record']['stage']=='fit-committed');p.locator('#last').click();check(motion+' '+variant+' final evidence accessible',state()['record']['step']>=12)
  check('old initial boundary exact equivalence retained',state()['compare']['samePostFit'] and state()['compare']['samePostRegional'])
  for channel in ['top','pair','bottom']:
   p.locator('#channel').select_option(channel);p.locator('#first').click();s=state();check(channel+' first-observed action never claims unseen times',s['key']==channel and ('检查点' in p.locator('#status').inner_text()))
  p.locator('#last').click();p.locator('#slider').focus();p.locator('#slider').press('Home');check('range navigation reaches real initial record',state()['index']==0);p.locator('#slider').press('End');check('range navigation reaches terminal record',state()['record']['step']>=12)
  check('actual original local witness is drawn',state()['viewer']['drawCount']>0 and state()['record']['body'][1]['witness']['targetTriangle'])
  canvas=p.locator('#witness');canvas.scroll_into_view_if_needed();before=state()['viewer'];box=canvas.bounding_box();p.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2);p.mouse.down();p.mouse.move(box['x']+box['width']/2+50,box['y']+box['height']/2+20,steps=6);p.mouse.up();check('3D drag changes camera and redraws',state()['viewer']['yaw']!=before['yaw'] and state()['viewer']['drawCount']>before['drawCount']);before=state()['viewer']['zoom'];canvas.hover();p.mouse.wheel(0,-100);p.wait_for_timeout(150);check('3D wheel zoom operates',state()['viewer']['zoom']!=before);p.locator('#camera').click();check('camera reset operates',state()['viewer']['yaw']==.5 and state()['viewer']['zoom']==1)
  p.evaluate('scrollTo(0,0)');shot(p,'01-endurance-summary');canvas.scroll_into_view_if_needed();shot(p,'02-real-witness-and-cost')
  check('controls do not mutate evidence',p.evaluate('__RF39VIEW__.raw()')==raw)
  with p.expect_download() as ev:p.locator('#export').click()
  export=Q/'EXPORTED.json';ev.value.save_as(export);check('export preserves exact data object',json.loads(export.read_text())==raw)
  bad=json.loads(json.dumps(raw));bad['hostCommit']='0'*40;p.locator('#file').set_input_files({'name':'bad-source.json','mimeType':'application/json','buffer':json.dumps(bad).encode()});p.wait_for_function('document.getElementById("status").textContent.includes("SOURCE_OR_SCHEMA")');check('bad import rejected atomically',p.evaluate('__RF39VIEW__.raw()')==raw and not state()['imported'])
  bad=json.loads(json.dumps(raw));bad['continuousCollisionCertified']=True;err=p.evaluate('(x)=>{try{__RF39VIEW__.load(x);return null;}catch(e){return e.message}}',bad);check('false continuous-contact certification rejected',err=='AUTHORITY_ESCALATION')
  p.locator('#file').set_input_files(str(export));p.wait_for_function('__RF39VIEW__.report().imported');check('valid external report stays unverified','未复验' in p.locator('#mode').inner_text() and state()['imported']);p.locator('#restore').click();check('restore removes imported state',not state()['imported'] and p.evaluate('__RF39VIEW__.raw()')==raw)
  check('inspection interactions require no additional network',len(requests)==baseline_requests)
  p.set_viewport_size({'width':390,'height':844});p.evaluate('scrollTo(0,0)');p.wait_for_timeout(150);check('390px layout no horizontal overflow',p.evaluate('document.documentElement.scrollWidth<=innerWidth+2'));shot(p,'03-mobile')
  if URL.startswith('file:'):check('standalone core uses zero HTTP',not requests,requests)
  check('zero unhandled page errors',not report['pageErrors'],report['pageErrors']);check('zero console errors',not report['consoleErrors'],report['consoleErrors']);check('zero failed requests',not report['failedRequests'],report['failedRequests']);report['passed']=True;report['publicVerified']=URL.startswith('https:');report['fileVerified']=URL.startswith('file:')
 except Exception as e:
  report['failure']=str(e);report['trace']=traceback.format_exc();print(report['trace'],flush=True)
  try:report['lastState']=state();shot(p,'FAILURE')
  except Exception:pass
 finally:save();ctx.close();b.close()
if not report['passed']:raise SystemExit(1)
