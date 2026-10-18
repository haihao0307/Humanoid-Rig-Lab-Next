from pathlib import Path
import os,json,hashlib,io,time,traceback
from PIL import Image,ImageStat
from playwright.sync_api import sync_playwright
from jsonschema import Draft202012Validator
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(os.environ.get('REALITY_QA',str(ROOT/'qa/local')));OUT.mkdir(parents=True,exist_ok=True)
URL=os.environ.get('REALITY_URL','http://127.0.0.1:8765/preview.html')
manifest=json.loads((ROOT/'BUILD_MANIFEST.json').read_text())
validator=Draft202012Validator(json.loads((ROOT/'reality-observation.schema.json').read_text()))
report={'version':'REALITY-HC-S1','url':URL,'sourceCommit':manifest['sourceCommit'],'passed':False,'checks':[],'pageErrors':[],'consoleErrors':[],'requestsFailed':[],'nativeObservations':{},'scope':['human','garment','pattern','fabric','footwear'],'consumerGPUCertified':False,'physicalPhoneTested':False,'visualAcceptance':False}
sha=lambda b:hashlib.sha256(b).hexdigest()
def save():(OUT/'BROWSER_REPORT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
def check(name,value=True,detail=None):
 if not value:raise AssertionError(name+': '+str(detail))
 report['checks'].append({'name':name,'passed':True,'detail':detail});print('PASS',name,flush=True);save()
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
 context=browser.new_context(viewport={'width':1500,'height':1050},device_scale_factor=1,accept_downloads=True)
 page=context.new_page();page.set_default_timeout(60000)
 page.on('pageerror',lambda e:report['pageErrors'].append(str(e)))
 page.on('console',lambda e:report['consoleErrors'].append(e.text) if e.type=='error' and 'favicon' not in e.text else None)
 page.on('requestfailed',lambda r:report['requestsFailed'].append({'url':r.url[:240],'failure':r.failure}) if 'favicon' not in r.url and not r.url.startswith('blob:') else None)
 def state():return page.evaluate('__REALITY_LAB__.report()')
 def screenshot(name):
  path=OUT/(name+'.png');page.screenshot(path=str(path),timeout=90000);return {'path':path.name,'sha256':sha(path.read_bytes()),'bytes':path.stat().st_size}
 try:
  started=time.monotonic();page.goto(URL,wait_until='domcontentloaded',timeout=90000);page.wait_for_function('!!window.__REALITY_LAB__',timeout=90000)
  initial=state();report['initialReadyMs']=(time.monotonic()-started)*1000
  check('fresh source identity',initial['sourceCommit']==manifest['sourceCommit'])
  check('five permitted categories',page.locator('[data-entry]').count()==5)
  check('no native heavyweight load at startup',initial['iframeCount']==0)
  check('actual metric WebGL calibrator',initial['calibration']['webgl'] and initial['calibration']['cubeSizeM']==[1,1,1] and initial['calibration']['glError']==0)
  image=page.locator('#calibration').screenshot();stat=ImageStat.Stat(Image.open(io.BytesIO(image)).convert('RGB'))
  check('calibrator has rendered pixels',max(stat.stddev)>4,stat.stddev)
  bounds=page.locator('#calibration').bounding_box();page.mouse.move(bounds['x']+bounds['width']*.6,bounds['y']+bounds['height']*.5);page.mouse.down();page.mouse.move(bounds['x']+bounds['width']*.7,bounds['y']+bounds['height']*.55,steps=5);page.mouse.up()
  image2=page.locator('#calibration').screenshot();check('actual pointer rotates calibration geometry',sha(image)!=sha(image2))
  check('250 millimeters is 0.25 meters','0.25 m' in page.locator('#unit-result').inner_text())
  page.locator('#unit-from').select_option('in');page.locator('#unit-value').fill('1');check('unit UI applies inch conversion','0.0254 m' in page.locator('#unit-result').inner_text())
  page.locator('#distance').focus();page.locator('#distance').press('End');check('camera footprint input responds','8.0 m' in page.locator('#distance-value').inner_text())
  report['calibrationScreenshot']=screenshot('01-calibration')
  for identity in ['pattern-short','fabric-r03','garment-review']:
   page.locator('[data-entry="'+identity+'"]').click();check(identity+' not falsely integrated',page.locator('#load-native').is_disabled() and state()['iframeCount']==0 and state()['document']['dimensions'] is None)
  for identity in ['human-r07','shoe-r12']:
   page.locator('[data-entry="'+identity+'"]').click();page.locator('#load-native').click()
   page.wait_for_function('(id)=>window.__REALITY_LAB__?.report().loadedId===id||document.querySelector("#native-state").classList.contains("error")',arg=identity,timeout=270000)
   s=state();check(identity+' actual original ready',s['nativeReady'] and s['loadedId']==identity,page.locator('#native-state').inner_text())
   check(identity+' only one native iframe',s['iframeCount']==1)
   page.wait_for_timeout(1000);page.locator('#observe').click()
   page.wait_for_function('window.__REALITY_LAB__.report().document.dimensions!==null',timeout=20000)
   s=state();d=s['document'];validator.validate(d);report['nativeObservations'][identity]=d
   check(identity+' actual finite positive geometry bounds',all(isinstance(x,(int,float)) and 0<x<10 for x in d['dimensions']['xyz']),d['dimensions']['xyz'])
   check(identity+' no mutation of checked native channels',d['preservation']=={'geometry':True,'camera':True,'settings':True},d['preservation'])
   check(identity+' no false all-green reality claim',s['validation']['status']=='partial' and s['validation']['counts']['fail']==0 and not s['validation']['physicalCertification'],s['validation']['counts'])
   check(identity+' digest verified before execution',any(e['type']=='source-verified' and e['detail']['id']==identity and e['detail']['sha256']==d['source']['sha256'] for e in s['events']))
   page.locator('#native-frame').scroll_into_view_if_needed()
   canvases=page.frame_locator('#native-frame').locator('canvas');sizes=[]
   for i in range(canvases.count()):
    v=canvases.nth(i).evaluate('(c)=>({w:c.clientWidth,h:c.clientHeight})');sizes.append((v['w']*v['h'],i,v))
   _,idx,dim=max(sizes);check(identity+' real native viewport dimensions',dim['w']>=240 and dim['h']>=240,dim)
   rendered=canvases.nth(idx).screenshot(timeout=120000);rgb=ImageStat.Stat(Image.open(io.BytesIO(rendered)).convert('RGB'));check(identity+' nonempty native rendering',max(rgb.stddev)>4,rgb.stddev)
   (OUT/(identity+'-canvas.png')).write_bytes(rendered);screenshot(identity+'-workbench')
   if identity=='shoe-r12':
    check('shoe source mm and scene m explicitly separated',d['units']['geometry']=='mm' and d['units']['scene']=='m' and d['units']['geometryToScene']==.001)
    base_x=d['dimensions']['xyz'][0]
    width=page.frame_locator('#native-frame').locator('#width');width.focus();width.press('End');page.wait_for_timeout(1200);page.locator('#observe').click()
    changed=state()['document'];check('new native user input is observed rather than stale cached numbers',changed['dimensions']['xyz'][0]>base_x,{'before':base_x,'after':changed['dimensions']['xyz'][0]})
    with page.expect_download() as event:page.frame_locator('#native-frame').locator('#export').click()
    native_file=OUT/'R12_NATIVE_DESIGN.json';event.value.save_as(native_file)
    page.locator('#import').set_input_files(str(native_file));page.wait_for_function('__REALITY_LAB__.report().document.assetId==="shoe-r12:import"')
    check('actual R12 export imported with original mm not fake physical dimensions',state()['document']['dimensions']['unit']=='mm' and state()['document']['dimensions']['basis']=='source_declared')
    page.locator('#restore-observation').click()
   page.locator('#fault-unit').click();check(identity+' wrong unit mapping rejected without host write',state()['validation']['status']=='rejected' and state()['nativeReady'])
   page.locator('#restore-observation').click();check(identity+' local undo restores original observation',state()['validation']['status']=='partial')
  good=state()['document'];bad=json.loads(json.dumps(good));bad['domain']='aircraft';page.locator('#json-editor').fill(json.dumps(bad));page.locator('#validate-json').click();check('out-of-scope aircraft document rejected',state()['validation']['status']=='rejected')
  page.locator('#restore-observation').click();page.locator('#save-draft').click();check('separate lab draft storage',page.evaluate('!!localStorage.getItem("kaopu:reality-hc-s1:draft")'))
  with page.expect_download() as event:page.locator('#export').click()
  exported=OUT/'EXPORTED_LAB_REPORT.json';event.value.save_as(exported);bundle=json.loads(exported.read_text());check('report includes source and incomplete-coverage verdict',bundle['schema']=='kaopu/reality-bundle@1' and bundle['document']['source']['commit']==good['source']['commit'] and bundle['validation']['status']=='partial')
  page.locator('#import').set_input_files(str(exported));page.wait_for_timeout(300);check('lab report roundtrip',state()['document']['source']['commit']==good['source']['commit'])
  page.locator('#unload').click();check('unload removes native document',state()['iframeCount']==0 and not state()['nativeReady'])
  page.reload(wait_until='domcontentloaded',timeout=90000);page.wait_for_function('!!window.__REALITY_LAB__',timeout=90000);page.locator('#restore-draft').click();check('draft survives reload without pretending live native connection',state()['document']['source']['commit']==good['source']['commit'] and not state()['nativeReady'])
  page.set_viewport_size({'width':390,'height':844});page.evaluate('scrollTo(0,0)');page.wait_for_timeout(300);check('390px lab viewport no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+2'))
  report['mobileScreenshot']=screenshot('mobile-lab-viewport');report['mobileScope']='390x844 CSS viewport only, not a physical phone'
  check('no page errors',not report['pageErrors'],report['pageErrors']);check('no console errors',not report['consoleErrors'],report['consoleErrors'])
  report['publicBrowserVerified']=URL.startswith('https://');report['passed']=True
 except Exception as e:
  report['failure']=str(e);report['trace']=traceback.format_exc();print(report['trace'],flush=True)
  try:report['lastState']=state();screenshot('FAILURE')
  except Exception as second:report['captureFailure']=str(second)
 finally:
  save();context.close();browser.close()
if not report['passed']:raise SystemExit(1)
print('BROWSER_PASSED',len(report['checks']),flush=True)
