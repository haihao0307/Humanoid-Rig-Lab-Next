from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image,ImageChops,ImageStat
import sys,json,time,io,base64,traceback,signal,hashlib,os
P=Path(__file__).resolve().parent;Q=P/'qa';Q.mkdir(exist_ok=True)
public=len(sys.argv)>1;url=sys.argv[1] if public else 'http://127.0.0.1:8872/preview.html'
name='PUBLIC_REPORT' if public else 'BROWSER_REPORT';prefix='public-' if public else ''
report={'version':'FUR-ATELIER-R01-RECOVERY-V3','url':url,'public':public,'checks':[],'pageErrors':[],'consoleErrors':[],'screenshots':[],'realPhoneTest':False,'hardwarePerformanceCertified':False,'referenceVideoVerified':False,'stages':[]}
started=time.monotonic()
def save():
 report['elapsedSeconds']=time.monotonic()-started
 (Q/(name+'.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
def check(label,condition,detail=None):
 report['checks'].append({'name':label,'pass':bool(condition),'detail':detail});print(label,condition,detail or '',flush=True);save()
 if not condition:raise AssertionError(label)
def stage(label):
 report['stages'].append({'name':label,'seconds':time.monotonic()-started});print('STAGE',label,flush=True);save()
def capture(page,label=None,ui=False,resume=True):
 t=time.monotonic();data=page.evaluate('FUR.captureFrame()');raw=base64.b64decode(data.split(',',1)[1]);im=Image.open(io.BytesIO(raw)).convert('RGB')
 if label:
  file=prefix+label+'.png';(Q/file).write_bytes(raw);report['screenshots'].append({'file':file,'kind':'actual-completed-WebGL-frame','sha256':hashlib.sha256(raw).hexdigest(),'seconds':time.monotonic()-t,'dimensions':im.size,'audit':page.evaluate('FUR.audit()')})
 if ui:
  try:
   f=prefix+label+'-ui.png';page.screenshot(path=str(Q/f),timeout=15000);report['screenshots'].append({'file':f,'kind':'actual-browser-viewport'})
  except Exception as e:report.setdefault('compositorWarnings',[]).append(str(e).splitlines()[0])
 if resume:page.evaluate('FUR.resumeFrames()')
 save();return im

def difference(a,b):return sum(ImageStat.Stat(ImageChops.difference(a,b)).mean)/3

def slider(page,selector,value):
 page.locator(selector).evaluate('(e,v)=>{e.value=String(v);e.dispatchEvent(new Event("input",{bubbles:true}));}',value)
def timeout(signum,frame):raise TimeoutError('Recovery QA exceeded 720-second budget')
signal.signal(signal.SIGALRM,timeout);signal.alarm(720)
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
  context=browser.new_context(viewport={'width':1360,'height':960},device_scale_factor=1)
  page=context.new_page();page.set_default_timeout(45000)
  page.on('pageerror',lambda e:report['pageErrors'].append(str(e)))
  page.on('console',lambda e:report['consoleErrors'].append(e.text) if e.type=='error' else None)
  stage('startup and actual render')
  page.goto(url,wait_until='domcontentloaded',timeout=120000);page.wait_for_function('window.FUR?.audit().ready',timeout=120000)
  initial=page.evaluate('FUR.audit()');report['initial']=initial;report['build']=page.evaluate('window.FUR_BUILD')
  check('Runtime ready and correct version',initial['ready'] and initial['version']=='FUR-ATELIER-R01' and not initial['contextLost'])
  check('Full 280000 fiber instances',initial['instances']==280000)
  check('Original EB1 core',initial['lighting']['version']=='EB1-1.1.0' and report['build']['eb1SHA256']=='39f747e36f905eaf9e760236315ae649bcab4ffd4feb62290017c7c5da650572')
  check('User EB1 default',initial['lighting']['profile']['exposure']==.7 and initial['lighting']['profile']['key']==1.6 and initial['lighting']['profile']['rim']==3.5)
  first=capture(page,'01-coat',ui=True)
  check('Nonblank rendered canvas',max(ImageStat.Stat(first).stddev)>12,ImageStat.Stat(first).stddev)
  check('Actual high-detail geometry draw',page.evaluate('FUR.audit().triangles')>3000000)
  report['gpu']=page.evaluate('(()=>{const g=FUR.renderer.getContext(),e=g.getExtension("WEBGL_debug_renderer_info");return {renderer:e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER),samples:g.getParameter(g.SAMPLES)}})()')
  stage('physics and pause')
  step=page.evaluate('FUR.audit().simSteps');page.wait_for_function('(s)=>FUR.audit().simSteps>s',arg=step,timeout=45000)
  check('Physics clock advances',page.evaluate('FUR.audit().simSteps')>step)
  check('Guide responses remain bounded',0<page.evaluate('FUR.audit().guideTipMax')<=.03501)
  page.locator('#pause').click();n=page.evaluate('FUR.audit().simSteps');page.wait_for_timeout(250)
  check('Pause control holds simulation',not page.evaluate('FUR.audit().simulating') and page.evaluate('FUR.audit().simSteps')==n)
  root=page.evaluate('FUR.audit().rootHash')
  stage('presets and visible layers')
  for key in ['sable','silver','ivory','fox','shearling','suede']:
   page.locator('[data-preset="'+key+'"]').click();a=page.evaluate('FUR.audit()')
   check('Preset '+key+' keeps roots',a['preset']==key and a['rootHash']==root)
   if not public and key in ['sable','silver']:capture(page,'preset-'+key)
  page.locator('[data-preset="ivory"]').click();full=capture(page)
  page.locator('[data-layer="base"]').click();bare=capture(page,'02-base' if not public else None)
  d=difference(full,bare);check('Fur changes actual rendered pixels',d>.15,d)
  for key in ['under','guard','all']:
   page.locator('[data-layer="'+key+'"]').click();check('Layer control '+key,page.evaluate('FUR.audit().layer')==key)
  slider(page,'#density',.7);check('Density adjusts display instances',page.evaluate('FUR.audit().instances')==196000);slider(page,'#density',1)
  page.locator('[data-camera="macro"]').click();short=capture(page,'03-macro')
  slider(page,'[data-param="length"]',115);long=capture(page)
  check('Length changes actual macro image',difference(short,long)>.05,difference(short,long))
  check('Length does not rebuild roots',page.evaluate('FUR.audit().rootHash')==root)
  page.locator('[data-preset="ivory"]').click()
  stage('garment collar hat and swatch')
  for key in ['collar','hat','swatch','coat']:
   page.locator('[data-view="'+key+'"]').click();a=page.evaluate('FUR.audit()')
   check('Application view '+key,a['view']==key and a['ready'] and not a['contextLost'])
   if key in ['collar','hat'] or (key=='swatch' and not public):capture(page,'view-'+key)
  check('Deterministic coat rebuild',page.evaluate('FUR.audit().rootHash')==root)
  page.locator('[data-camera="back"]').click()
  if not public:capture(page,'04-back')
  page.locator('[data-camera="full"]').click()
  stage('EB1 pixels rebuild and refresh persistence')
  a=capture(page);page.locator('#light').click();slider(page,'[data-key="exposure"]',1.1);b=capture(page)
  check('Exposure changes actual image',difference(a,b)>.3,difference(a,b))
  check('EB1 control updates profile',page.evaluate('FUR.audit().lighting.profile.exposure')==1.1)
  page.locator('#light').click();page.locator('[data-view="hat"]').click()
  check('View rebuild preserves EB1',page.evaluate('FUR.audit().lighting.profile.exposure')==1.1)
  capture(page,resume=False)
  page.reload(wait_until='domcontentloaded',timeout=120000);page.wait_for_function('window.FUR?.audit().ready',timeout=120000)
  check('Reload preserves EB1',page.evaluate('FUR.audit().lighting.profile.exposure')==1.1)
  page.locator('#reset').click();page.evaluate('FUR.setSimulating(false)');capture(page)
  check('Reset returns original EB1 recipe',page.evaluate('FUR.audit().lighting.profile.exposure')==.7)
  stage('pointer controls editable export and mobile viewport')
  box=page.locator('#scene').bounding_box();old=page.evaluate('FUR.camera.position.toArray()')
  page.mouse.move(box['x']+box['width']*.54,box['y']+box['height']*.50);page.mouse.down();page.mouse.move(box['x']+box['width']*.62,box['y']+box['height']*.52,steps=4);page.mouse.up()
  check('Actual pointer orbit changes camera',page.evaluate('FUR.camera.position.toArray()')!=old)
  page.locator('#brush').click();check('Brush mode accepts UI input',page.locator('#brush').evaluate('e=>e.classList.contains("selected")'));page.locator('#brush').click()
  page.locator('#export').click();recipe=json.loads(page.locator('#recipe').input_value());check('Editable JSON export',recipe['schema']=='kaopu.fur/1' and recipe['lighting']['schema']=='kaopu.eb1/1')
  report['desktopFinal']=page.evaluate('FUR.audit()')
  capture(page,resume=False);page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(100);page.evaluate("FUR.cameraPreset('full')");mobile=capture(page,'mobile',ui=True,resume=False)
  check('Mobile viewport real canvas',mobile.size[0]==390 and mobile.size[1]>350,mobile.size)
  check('Mobile page has no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
  check('WebGL context still valid',not page.evaluate('FUR.audit().contextLost'))
  check('No JavaScript errors',not report['pageErrors'],report['pageErrors'])
  shader=[x for x in report['consoleErrors'] if any(y in x for y in ['WebGLProgram','VALIDATE_STATUS','ERROR: 0:','Error creating WebGL'])]
  check('No shader errors',not shader,shader)
  report['final']=page.evaluate('FUR.audit()');browser.close();report['passed']=True;stage('complete')
except Exception:
 report['passed']=False;report['failure']=traceback.format_exc();print(report['failure'],flush=True)
finally:
 signal.alarm(0);save();print(json.dumps({'passed':report.get('passed'),'checks':len(report['checks']),'seconds':report['elapsedSeconds']}),flush=True)
if not report.get('passed'):sys.exit(1)
