from pathlib import Path
import os,json,time,hashlib,traceback,io
from playwright.sync_api import sync_playwright
from PIL import Image,ImageStat
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(os.environ.get('RF31_QA',str(ROOT/'qa/file')));OUT.mkdir(parents=True,exist_ok=True)
URL=os.environ.get('RF31_URL',(ROOT/'preview.html').as_uri())
M=json.loads((ROOT/'BUILD_MANIFEST.json').read_text())
report={'version':'REALITY-HC-S3.1-A','url':URL,'sourceCommit':M['sourceCommit'],'passed':False,'checks':[],'pageErrors':[],'consoleErrors':[],'requestFailures':[],'publicBrowserVerified':False,'physicalDeviceTested':False,'producerVisualReviewIsNotUserAcceptance':True}
requests=[]
def save():(OUT/'BROWSER_REPORT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
def check(name,ok=True,detail=None):
 if not ok:raise AssertionError(name+': '+str(detail))
 report['checks'].append({'name':name,'passed':True,'detail':detail});print('PASS',name,flush=True);save()
def snapshot(page,name):
 p=OUT/(name+'.png');page.screenshot(path=str(p),timeout=60000);return {'file':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
 ctx=browser.new_context(viewport={'width':1440,'height':1060},device_scale_factor=1,accept_downloads=True)
 page=ctx.new_page();page.set_default_timeout(60000)
 page.on('pageerror',lambda e:report['pageErrors'].append(str(e)))
 page.on('console',lambda e:report['consoleErrors'].append(e.text) if e.type=='error' else None)
 page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http://','https://')) else None)
 page.on('requestfailed',lambda r:report['requestFailures'].append({'url':r.url,'failure':r.failure}))
 def state():return page.evaluate('__REALITY_S31__.report()')
 try:
  page.goto(URL,wait_until='domcontentloaded',timeout=90000);page.wait_for_function('!!window.__REALITY_S31__');page.wait_for_timeout(300)
  check('fresh source commit',state()['sourceCommit']==M['sourceCommit'])
  check('seven historical materials use common protocol',state()['historicalCount']==7 and all(o['schema']=='kaopu/reality-object@0.2' for o in state()['history']))
  check('no native engine at initial load',state()['iframeCount']==0)
  check('historical reports not labelled live',all(o['sourceMode']=='fixed_snapshot' for o in state()['history']))
  network_before=len(requests);started=time.monotonic();page.locator('#load').click();page.wait_for_function('__REALITY_S31__.report().nativeReady && __REALITY_S31__.report().native!==null')
  s=state();report['nativeStartupMS']=(time.monotonic()-started)*1000;report['firstNativeExport']=s['native']
  check('real original denim runtime ready',page.frame_locator('#native').locator('body').evaluate('()=>!!window.DENIM_R17.state.ready'))
  check('candidate original version is R17.2',page.frame_locator('#native').locator('body').evaluate('()=>window.DENIM_R17.version.includes("R17.2")'))
  check('one live native canvas',s['iframeCount']==1)
  check('live export has original source lineage',s['native']['source']['commit']==M['native']['source']['commit'] and s['native']['source']['sha256']==M['native']['source']['sha256'])
  check('actual common object marked native live',s['common']['sourceMode']=='live_read_only')
  check('original shader values read not nominal arithmetic only',abs(s['native']['shaderInputs']['stitchPitch']-.00273)<1e-9,s['native']['comparison'])
  check('unknown physical thickness retained',s['native']['measurements'][5]['value'] is None)
  check('no inherited R15 physics merged into R17.2',all(m['value'] is None for m in s['native']['measurements'][5:]))
  check('read-only interface exposes no setter',page.frame_locator('#native').locator('body').evaluate('()=>Object.keys(window.KAOPU_REALITY).sort().join(",")==="exportJSON,read,source,version"'))
  check('snapshot nested values are frozen',page.frame_locator('#native').locator('body').evaluate('()=>{const x=window.KAOPU_REALITY.read();return Object.isFrozen(x)&&Object.isFrozen(x.measurements)&&Object.isFrozen(x.measurements[0]);}'))
  check('frame protection matches',s['native']['preservation']['passed'] and s['native']['preservation']['before']==s['native']['preservation']['after'])
  canvas=page.frame_locator('#native').locator('#gl');dim=canvas.evaluate('(c)=>({w:c.clientWidth,h:c.clientHeight})');check('usable real canvas size',dim['w']>240 and dim['h']>240,dim)
  image=canvas.screenshot();rgb=Image.open(io.BytesIO(image)).convert('RGB');check('visible original geometry not empty canvas',max(ImageStat.Stat(rgb).stddev)>5)
  page.evaluate('__REALITY_S31__.read()');after=canvas.screenshot();check('read causes no pixel change',hashlib.sha256(image).hexdigest()==hashlib.sha256(after).hexdigest())
  (OUT/'native-canvas.png').write_bytes(after);report['screenshots']=[snapshot(page,'01-live-native')]
  before=state()['native'];slider=page.frame_locator('#native').locator('#weaveScale');maximum=float(slider.get_attribute('max'))
  slider.focus();slider.press('End')
  page.wait_for_function('(v)=>{const s=__REALITY_S31__.report();return s.native?.shaderInputs.weaveScale===v;}',arg=maximum)
  changed=state()['native'];check('real native control updates exported GPU value',changed['capture']['sequence']>before['capture']['sequence'] and changed['shaderInputs']['weaveScale']==maximum)
  check('actual weave spacing follows native scale',abs(changed['measurements'][0]['value']-.0254/60*maximum)<1e-12)
  check('delta is shown','material.warp_spacing_m' in page.locator('#changes').inner_text())
  stitch=page.frame_locator('#native').locator('#stitchPitch');maximum_pitch=float(stitch.get_attribute('max'))
  stitch.focus();stitch.press('End');page.wait_for_function('(v)=>Math.abs(__REALITY_S31__.report().native.shaderInputs.stitchPitch-v*.001)<1e-8',arg=maximum_pitch)
  check('actual stitch control updates independent measure',abs(state()['native']['measurements'][3]['value']-maximum_pitch*.001)<1e-8)
  report['changedNativeExport']=state()['native'];report['screenshots'].append(snapshot(page,'02-changed-standards'))
  check('no network needed to activate native copy',len(requests)==network_before,requests[network_before:])
  with page.expect_download() as event:page.locator('#export-native').click()
  exported=OUT/'NATIVE_EXPORT.json';event.value.save_as(exported);original=json.loads(exported.read_text());check('native file exports current inputs',original['shaderInputs']==state()['native']['shaderInputs'])
  with page.expect_download() as event:page.locator('#export-common').click()
  commonpath=OUT/'COMMON_EXPORT.json';event.value.save_as(commonpath);common=json.loads(commonpath.read_text());check('existing S2.1 envelope exported',common['schema']=='kaopu/reality-foundation-bundle@0.2')
  with page.expect_download() as event:page.locator('#export-defects').click()
  defectpath=OUT/'DEFECTS.json';event.value.save_as(defectpath);d=json.loads(defectpath.read_text());check('defects cannot authorize source repair',d['defects'] and all(not x['repairAuthorized'] and x['verificationRequired'] for x in d['defects']))
  before_valid=state()['common'];bad=json.loads(json.dumps(original));bad['measurements'][0]['unit']='tex'
  page.locator('#file').set_input_files({'name':'bad.json','mimeType':'application/json','buffer':json.dumps(bad).encode()});page.wait_for_function('document.querySelector("#status").textContent.includes("SEMANTICS")')
  check('invalid import atomically preserves current object',state()['common']==before_valid)
  bad=json.loads(json.dumps(original));bad['source']['commit']='0'*40
  error=page.evaluate('(x)=>{try{__REALITY_S31__.importPacket(x);return null;}catch(e){return e.message;}}',bad)
  check('stale source pin rejected',error=='SOURCE_REVISION_MISMATCH')
  page.locator('#file').set_input_files(str(exported));page.wait_for_function('__REALITY_S31__.report().common.sourceMode==="imported_unverified"')
  check('import cannot pretend live capture','导入报告' in page.locator('#mode').inner_text())
  check('imported raw snapshot preserved',state()['common']['extensions']['originalExport']==original)
  page.locator('#restore-live').click();check('explicit refresh restores live mode',state()['common']['sourceMode']=='live_read_only')
  for o in state()['history']:
   page.locator('[data-history="'+o['objectId']+'"]').click();check(o['family']+' original history not rebranded',state()['common']['sourceMode']=='fixed_snapshot' and state()['common']['extensions']['originalS3Object']['id']==o['objectId'])
  page.locator('#read').click();check('live read remains available after history review',state()['common']['sourceMode']=='live_read_only')
  page.locator('#close').click();check('native disposed and retained result not live',state()['iframeCount']==0 and not state()['nativeReady'] and state()['common']['sourceMode']!='live_read_only')
  page.set_viewport_size({'width':390,'height':844});page.evaluate('scrollTo(0,0)');page.wait_for_timeout(200)
  check('390px viewport without horizontal page overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+2'))
  report['screenshots'].append(snapshot(page,'03-mobile-core'))
  if URL.startswith('file:'):check('self-contained file has no HTTP dependencies',not requests,requests)
  check('zero unhandled page errors',not report['pageErrors'],report['pageErrors'])
  check('zero console errors',not report['consoleErrors'],report['consoleErrors'])
  check('zero failed requests',not report['requestFailures'],report['requestFailures'])
  report['publicBrowserVerified']=URL.startswith('https://');report['fileBrowserVerified']=URL.startswith('file:');report['passed']=True
 except Exception as e:
  report['failure']=str(e);report['trace']=traceback.format_exc();print(report['trace'],flush=True)
  try:report['lastState']=state();snapshot(page,'FAILURE')
  except Exception as e2:report['captureFailure']=str(e2)
 finally:
  save();ctx.close();browser.close()
if not report['passed']:raise SystemExit(1)
print('BROWSER_PASSED',len(report['checks']),flush=True)
