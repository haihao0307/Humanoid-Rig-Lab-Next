from pathlib import Path
import os,json,hashlib,traceback
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1];Q=Path(os.environ.get('RF310_QA',str(R/'qa/file')));Q.mkdir(parents=True,exist_ok=True)
URL=os.environ.get('RF310_URL',(R/'preview.html').as_uri());M=json.loads((R/'BUILD_MANIFEST.json').read_text());DATA=json.loads((R/'review-data.json').read_text())
report={'version':'RF01-S3.10','url':URL,'sourceCommit':M['sourceCommit'],'passed':False,'checks':[],'pageErrors':[],'consoleErrors':[],'failedRequests':[],'physicalDeviceTested':False,'fitCertified':False};requests=[]
def save():(Q/'BROWSER.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
def check(name,ok=True,detail=None):
 if not ok:raise AssertionError(name+': '+str(detail))
 report['checks'].append({'name':name,'passed':True,'detail':detail});print('PASS',name,flush=True);save()
def shot(page,name):
 p=Q/(name+'.png');page.screenshot(path=str(p),timeout=60000);report.setdefault('screenshots',[]).append({'file':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']);ctx=browser.new_context(viewport={'width':1440,'height':1100},device_scale_factor=1,accept_downloads=True);page=ctx.new_page();page.set_default_timeout(60000)
 page.on('pageerror',lambda e:report['pageErrors'].append(str(e)));page.on('console',lambda e:report['consoleErrors'].append(e.text) if e.type=='error' else None);page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None);page.on('requestfailed',lambda r:report['failedRequests'].append({'url':r.url,'failure':r.failure}))
 state=lambda:page.evaluate('__RF310_REVIEW__.report()')
 try:
  page.goto(URL,wait_until='domcontentloaded',timeout=120000);page.wait_for_function('window.__RF310_REVIEW__?.report().ready')
  check('fresh build identity',state()['sourceCommit']==M['sourceCommit'])
  check('exact original row count',state()['rows']==len(DATA['trace']['rows']))
  check('source replay not complete live tryon','不是完整实时试衣' in page.locator('.notice').first.inner_text() and state()['fitCertified'] is False)
  check('six original step controls',page.locator('[data-step]').count()==6)
  for s in DATA['trace']['steps']:
   page.locator('[data-step="'+str(s['step'])+'"]').click();check('step '+str(s['step'])+' actual final geometry',state()['row']==DATA['trace']['rows'][s['lastRow']])
  page.locator('#entry').click();check('entry geometry actual',state()['row']['stage']=='fine-entry')
  page.locator('#vertex').click();check('final vertex stage distinct',state()['row']['stage']=='vertices-done' and state()['row']['pass']==31)
  page.locator('#centroid').click();check('final centroid stage distinct',state()['row']['stage']=='centroids-done' and state()['row']['pass']==31)
  page.locator('#worst').click();expected=min((r for r in DATA['trace']['rows'] if r['step']==30),key=lambda r:r['snapshot']['full']['distanceM']);check('worst selector uses real measured minimum',state()['row']['snapshot']['full']['distanceM']==expected['snapshot']['full']['distanceM'])
  page.locator('#scrub').focus();page.locator('#scrub').press('Home');check('real timeline returns entry',state()['row']['stage']=='fine-entry');page.locator('#scrub').press('End');check('real timeline returns exit',state()['row']['stage']=='fine-exit')
  check('actual residual visible not replaced by zero',float(page.locator('#full-distance').inner_text().split()[0])<0)
  check('six-row derived summary',page.locator('#summary tr').count()==6)
  check('real curve drawn',page.locator('#curve path').count()>=3)
  canvas=page.locator('#view');canvas.scroll_into_view_if_needed();before=state()['camera'];pixels1=canvas.evaluate('(c)=>c.toDataURL()');box=canvas.bounding_box();x=box['x']+box['width']*.5;y=box['y']+box['height']*.5
  page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+70,y+25,steps=5);page.mouse.up();check('3D drag changes camera',state()['camera']!=before);pixels2=canvas.evaluate('(c)=>c.toDataURL()');check('3D rotation changes rendered pixels',pixels1!=pixels2)
  z=state()['camera']['zoom'];page.mouse.wheel(0,160);page.wait_for_timeout(150);check('wheel changes zoom',state()['camera']['zoom']!=z)
  page.locator('#reset-camera').click();check('camera reset works',state()['camera']=={'yaw':.35,'pitch':-.2,'zoom':1})
  d=state()['draws'];page.locator('#body').uncheck();check('body layer visibility redraws',state()['draws']>d);page.locator('#body').check();shot(page,'01-stage-and-3D')
  with page.expect_download() as ev:page.locator('#export').click()
  out=Q/'EXPORTED.json';ev.value.save_as(out);exported=json.loads(out.read_text());check('export preserves exact native trace',exported['trace']==DATA['trace'])
  old=state();page.locator('#bad-source').click();check('source rejection atomic',state()['row']==old['row'] and 'SOURCE_IDENTITY_MISMATCH' in page.locator('#status').inner_text())
  bad=json.loads(json.dumps(exported));bad['trace']['node']=191;page.locator('#file').set_input_files({'name':'wrong-node.json','mimeType':'application/json','buffer':json.dumps(bad).encode()});page.wait_for_function('document.getElementById("status").textContent.includes("TRACE_SCOPE_INVALID")');check('wrong target import cannot overwrite current data',state()['row']==old['row'])
  page.locator('#file').set_input_files(str(out));page.wait_for_function('__RF310_REVIEW__.report().mode==="imported-unverified"');check('external import cannot inherit verified identity','未复验' in page.locator('#trust').inner_text())
  page.locator('#restore').click();check('restore exact built-in observation',state()['mode']=='built-in' and state()['row']==DATA['trace']['rows'][DATA['trace']['steps'][-1]['lastRow']])
  page.evaluate('scrollTo(0,0)');shot(page,'02-overview');page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(150);check('390px viewport no page overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+2'));shot(page,'03-mobile')
  if URL.startswith('file:'):check('standalone core makes no HTTP requests',not requests,requests)
  check('no unhandled page errors',not report['pageErrors'],report['pageErrors']);check('no console errors',not report['consoleErrors'],report['consoleErrors']);check('no failed requests',not report['failedRequests'],report['failedRequests'])
  report['passed']=True;report['fileVerified']=URL.startswith('file:');report['publicVerified']=URL.startswith('https:')
 except Exception as e:
  report['failure']=str(e);report['stack']=traceback.format_exc();print(report['stack'],flush=True)
  try:report['lastState']=state();shot(page,'FAILURE')
  except Exception as e2:report['captureFailure']=str(e2)
 finally:save();ctx.close();browser.close()
if not report['passed']:raise SystemExit(1)
