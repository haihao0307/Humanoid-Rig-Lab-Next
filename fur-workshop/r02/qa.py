from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image,ImageChops,ImageStat
import json,sys,base64,io,time,traceback
P=Path(__file__).resolve().parent;Q=P/'qa';Q.mkdir(exist_ok=True)
public=len(sys.argv)>1;url=sys.argv[1] if public else 'http://127.0.0.1:8874/preview.html';prefix='public-' if public else ''
R={'url':url,'public':public,'checks':[],'screenshots':[],'pageErrors':[],'consoleErrors':[],'realPhoneTest':False,'hardwarePerformanceCertified':False,'imageGenerationUsed':False}
report=Q/('PUBLIC_REPORT.json' if public else 'BROWSER_REPORT.json')
def save():report.write_text(json.dumps(R,ensure_ascii=False,indent=2)+'\n')
def ck(name,value,detail=None):
 R['checks'].append({'name':name,'pass':bool(value),'detail':detail});save();print(name,bool(value),detail or '',flush=True)
 if not value:raise AssertionError(name)
def shot(page,name,ui=False):
 t=time.monotonic();data=page.evaluate('FUR.captureFrame()');raw=base64.b64decode(data.split(',',1)[1]);path=Q/(prefix+name+'.png');path.write_bytes(raw);im=Image.open(io.BytesIO(raw)).convert('RGB')
 R['screenshots'].append({'file':path.name,'kind':'actual-completed-WebGL-frame','seconds':time.monotonic()-t,'audit':page.evaluate('FUR.audit()')});save()
 if ui:
  try:page.screenshot(path=str(Q/(prefix+name+'-ui.png')),timeout=15000)
  except Exception as e:R.setdefault('viewportWarnings',[]).append(str(e).splitlines()[0])
 return im
def change(page,js):page.evaluate(js)
def difference(a,b):return sum(ImageStat.Stat(ImageChops.difference(a,b)).mean)/3
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
  page=browser.new_page(viewport={'width':1360,'height':960},device_scale_factor=1);page.set_default_timeout(90000)
  page.on('pageerror',lambda e:R['pageErrors'].append(str(e)));page.on('console',lambda e:R['consoleErrors'].append(e.text) if e.type=='error' else None)
  page.goto(url,wait_until='domcontentloaded',timeout=120000);page.wait_for_function('window.FUR?.audit().ready',timeout=120000)
  R['initial']=a=page.evaluate('FUR.audit()');R['build']=page.evaluate('FUR_BUILD')
  ck('R02 is live',a['version']=='FUR-ATELIER-R02' and a['view']=='collar' and a['preset']=='fox')
  ck('Collar-only root domain',a['activeRootZones']==[1],a['activeRootZones'])
  ck('260000 actual collar fibers',a['instances']==260000)
  ck('Original EB1 1.1 and recipe',a['lighting']['version']=='EB1-1.1.0' and a['lighting']['profile']['exposure']==.7 and a['lighting']['profile']['key']==1.6)
  ck('Depth-resolving fibers with MSAA',a['depthResolving'] and a['samples']>0,a['samples'])
  h=a['rootHash'];hero=shot(page,'01-collar',True);ck('Rendered nonblank',max(ImageStat.Stat(hero).stddev)>10)
  change(page,"FUR.setLayer('base')");bare=shot(page,'02-base');delta=difference(hero,bare);ck('Fur materially changes collar image',delta>1,delta)
  change(page,"FUR.setLayer('all');FUR.cameraPreset('macro')");macro=shot(page,'03-macro')
  page.locator('[data-param="length"]').evaluate("e=>{e.value='40';e.dispatchEvent(new Event('input',{bubbles:true}));}")
  short=shot(page,'04-length-change');ck('Length changes real pixels',difference(macro,short)>.5,difference(macro,short));ck('Length keeps root identity',page.evaluate('FUR.audit().rootHash')==h)
  for k in ['sable','silver','ivory','fox','shearling','suede']:
   page.locator('[data-preset="'+k+'"]').click();ck('Preset '+k+' keeps roots',page.evaluate('FUR.audit().preset')==k and page.evaluate('FUR.audit().rootHash')==h)
  change(page,"FUR.setPreset('fox');FUR.cameraPreset('collar')")
  for k in ['under','guard','all']:
   page.locator('[data-layer="'+k+'"]').click();ck('Layer '+k,page.evaluate('FUR.audit().layer')==k)
  change(page,"FUR.cameraPreset('back')");shot(page,'05-back')
  for k in ['hat','swatch','coat','collar']:
   page.locator('[data-view="'+k+'"]').click();ck('View '+k,page.evaluate('FUR.audit().view')==k)
   if k=='hat':shot(page,'06-hat')
  ck('Deterministic rebuild',page.evaluate('FUR.audit().rootHash')==h)
  change(page,"FUR.cameraPreset('collar')");before=shot(page,'07-light-before')
  page.locator('#light').click();page.locator('[data-key="exposure"]').evaluate("e=>{e.value='1.1';e.dispatchEvent(new Event('input',{bubbles:true}));}")
  after=shot(page,'08-light-after');ck('EB1 changes actual pixels',difference(before,after)>1)
  change(page,"FUR.setView('hat')");ck('Rebuild preserves EB1',page.evaluate('FUR.audit().lighting.profile.exposure')==1.1)
  shot(page,'09-before-reload');page.reload(wait_until='domcontentloaded',timeout=120000);page.wait_for_function('window.FUR?.audit().ready',timeout=120000)
  ck('Refresh preserves EB1',page.evaluate('FUR.audit().lighting.profile.exposure')==1.1)
  page.locator('#reset').click();ck('Reset uses approved EB1',page.evaluate('FUR.audit().lighting.profile.exposure')==.7)
  start=page.evaluate('FUR.audit().simSteps');change(page,'FUR.setSimulating(true);FUR.resumeFrames()');page.wait_for_function('(n)=>FUR.audit().simSteps>n',arg=start,timeout=90000);change(page,'FUR.setSimulating(false)');shot(page,'10-response')
  ck('Bounded guide response',page.evaluate('FUR.audit().guideTipMax')<.036)
  page.locator('#export').click();ck('Editable recipe',json.loads(page.locator('#recipe').input_value())['version']=='FUR-ATELIER-R02')
  old=page.evaluate('FUR.camera.position.toArray()');r=page.locator('#scene').bounding_box();page.mouse.move(r['x']+r['width']*.5,r['y']+r['height']*.5);page.mouse.down();page.mouse.move(r['x']+r['width']*.59,r['y']+r['height']*.5,steps=3);page.mouse.up();ck('Real pointer orbit',old!=page.evaluate('FUR.camera.position.toArray()'))
  page.set_viewport_size({'width':390,'height':844});change(page,"FUR.cameraPreset('collar')");shot(page,'11-mobile',True)
  ck('Mobile viewport without overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
  ck('Context valid',not page.evaluate('FUR.audit().contextLost'));ck('No JS errors',not R['pageErrors'],R['pageErrors'])
  se=[x for x in R['consoleErrors'] if any(k in x for k in ['WebGLProgram','VALIDATE_STATUS','ERROR: 0:','Error creating WebGL'])];ck('No shader errors',not se,se)
  R['final']=page.evaluate('FUR.audit()');R['passed']=True;save();browser.close()
except Exception:
 R['passed']=False;R['failure']=traceback.format_exc();save();print(R['failure'],flush=True)
if not R.get('passed'):sys.exit(1)
