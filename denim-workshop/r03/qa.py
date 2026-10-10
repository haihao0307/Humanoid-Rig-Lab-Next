"""Real browser regressions. --content is only a local authored-document test;
without it the runner opens the actual file:// and then the fixed public URL."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,hashlib,time,os,argparse
ap=argparse.ArgumentParser();ap.add_argument('--content',action='store_true');ap.add_argument('--public');args=ap.parse_args()
root=Path(__file__).parent;out=Path(os.environ.get('QA_DIR',str(root/'evidence')));out.mkdir(exist_ok=True)
records=[]
with sync_playwright() as pw:
 launch={'headless':False,'args':['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']}
 if os.environ.get('CHROMIUM_PATH'): launch['executable_path']=os.environ['CHROMIUM_PATH']
 browser=pw.chromium.launch(**launch)
 sources=[('content' if args.content else 'file',None if args.content else (root/'index.html').as_uri())]
 if args.public:sources.append(('public',args.public))
 for mode,url in sources:
  context=browser.new_context(viewport={'width':1440,'height':1000},device_scale_factor=1)
  page=context.new_page();errs=[];requests=[]
  page.on('pageerror',lambda e:errs.append(str(e)))
  page.on('request',lambda req:requests.append(req.url))
  hook='''(()=>{const p=WebGL2RenderingContext.prototype;window.__drawLog=[];for(const name of ['drawElementsInstanced','drawElements']){const old=p[name];p[name]=function(...a){window.__drawLog.push({name,count:a[1],instances:a[4]||0});return old.apply(this,a)}}})();'''
  if mode=='content':page.set_content((root/'index.html').read_text().replace('<script>', '<script>'+hook,1),wait_until='domcontentloaded',timeout=90000)
  else:page.add_init_script(hook);page.goto(url,wait_until='domcontentloaded',timeout=90000)
  page.wait_for_function('window.__DENIM_WORKBENCH__?.lastFrame?.frame>0',timeout=150000)
  def snapshot(name,shot=False):
   page.evaluate('()=>{__DENIM_WORKBENCH__.renderNow();const gl=document.querySelector("canvas").getContext("webgl2");gl.finish()}')
   info=page.evaluate('()=>({version:__DENIM_WORKBENCH__.version,frame:__DENIM_WORKBENCH__.lastFrame,glError:__DENIM_WORKBENCH__.getGLError(),profile:__DENIM_WORKBENCH__.profile().finish})')
   assert info['glError']==0 and info['version']=='R03.1'
   canvas=page.locator('#view').screenshot(timeout=90000)
   info['canvasSHA256']=hashlib.sha256(canvas).hexdigest();info['name']=name
   if shot:(out/(mode+'-'+name+'.png')).write_bytes(canvas)
   return info
  def set_(patch):
   previous=page.evaluate('__DENIM_WORKBENCH__.lastFrame.frame');page.evaluate('(p)=>__DENIM_WORKBENCH__.setState(p)',patch);page.wait_for_function('(f)=>__DENIM_WORKBENCH__.lastFrame.frame>f',arg=previous,timeout=120000)
  result={'mode':mode,'url':url,'actualPhone':False,'cases':[]}
  s=snapshot('default',True);assert s['frame']['geometryOnly'] and s['frame']['projection']=='perspective';result['cases'].append(s)
  # Reproduce the user's grazing/cropped edge view. Actual instanced draw call,
  # not simply a UI label, must remain present on the near and mid path.
  for zoom in [2.2,1,.6,.32]:
   set_({'yaw':-.65,'pitch':.46,'zoom':zoom,'panY':-12})
   page.evaluate('__drawLog.length=0');s=snapshot('edge-'+str(zoom),zoom in [1,.6]);calls=page.evaluate('__drawLog');assert any(c['name']=='drawElementsInstanced' for c in calls);assert s['frame']['geometryOnly'] and not s['frame']['solidEdgeDrawn'];result['cases'].append(s)
  set_({'yaw':0,'pitch':0,'zoom':1,'panX':0,'panY':0,'shape':0,'seam':False,'fuzz':0})
  info=page.evaluate('__DENIM_WORKBENCH__.auditGPU()');assert info['checked']>20000 and info['wrong']==0;result['gpuCrossingCenters']=info
  for damage in [0,1,2,3,4]:
   set_({'damage':damage,'fuzz':.55});s=snapshot('damage-'+str(damage),damage in [2,3,4]);assert s['frame']['geometryOnly'];result['cases'].append(s)
  # Read a rendered aperture: the center of the hole must show clear background.
  set_({'damage':3,'fuzz':0,'shape':0,'yaw':0,'pitch':0})
  patch=page.evaluate('''()=>{__DENIM_WORKBENCH__.renderNow();const gl=document.querySelector('canvas').getContext('webgl2');gl.finish();let p=__DENIM_WORKBENCH__.projectPoint([4,-1,0]),b=new Uint8Array(4);gl.readPixels(Math.round(p[0]),Math.round(p[1]),1,1,gl.RGBA,gl.UNSIGNED_BYTE,b);return [...b]}''')
  assert max(patch[:3])-min(patch[:3])<8 and max(patch[:3])<32;result['holeCenterRGBA']=patch
  set_({'damage':0,'fuzz':.55,'shape':1,'yaw':-.23,'pitch':.34})
  hashes=[]
  for k in ['raw','rinse','vintage','bleach','slubby','black','grey','ecru','indigoBlack','doubleIndigo','enzyme','acid']:
   page.locator('[data-preset="'+k+'"]').click(timeout=90000);page.wait_for_timeout(100);s=snapshot('finish-'+k,k in ['vintage','slubby']);hashes.append(s['canvasSHA256']);result['cases'].append(s)
  assert len(set(hashes))==12
  for light in range(4):
   set_({'light':light});s=snapshot('light-'+str(light),light==2);result['cases'].append(s)
  assert len(set(c['canvasSHA256'] for c in result['cases'] if c['name'].startswith('light-')))==4
  set_({'light':0,'preset':'rinse','wash':.23,'abrasion':.24,'zoom':.12,'shape':0})
  s=snapshot('far',True);assert not s['frame']['geometryOnly'];result['cases'].append(s)
  # A damaged cloth cannot silently become an opaque far-distance quad.
  set_({'damage':3});s=snapshot('far-hole');assert s['frame']['geometryOnly'];result['cases'].append(s)
  set_({'damage':0,'zoom':1,'shape':2,'yaw':-.45,'pitch':.50});result['cases'].append(snapshot('rolled-edge',True))
  set_({'thickness':.90,'fray':1.8});s=snapshot('thicker-frayed');assert page.evaluate('__DENIM_WORKBENCH__.profile().graph.thickness')==.9;result['cases'].append(s)
  with page.expect_download() as d:page.locator('#save').click()
  f=out/(mode+'-export.json');d.value.save_as(f);profile=json.loads(f.read_text());assert profile['schema']=='kaopu.denim_material_profile@2.1' and profile['damage']['cuts'];result['export']='pass'
  before=page.evaluate('__DENIM_WORKBENCH__.lastFrame.frame');page.wait_for_timeout(500);after=page.evaluate('__DENIM_WORKBENCH__.lastFrame.frame');assert before==after;result['idleFrames']=[before,after]
  assert not errs;result['pageErrors']=errs;result['webgl']='pass';result['requests']=requests
  if mode in ['file','content']:assert not any(u.startswith('http') for u in requests)
  (out/(mode+'.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2));records.append({'mode':mode,'passed':True,'caseCount':len(result['cases'])});print('PASS',mode,len(result['cases']),flush=True)
  context.close()
 # Fresh mobile viewport initial canvas must be visible, not above scroll origin.
 context=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True);page=context.new_page();mobileErr=[];page.on('pageerror',lambda e:mobileErr.append(str(e)))
 if args.content and not args.public:page.set_content((root/'index.html').read_text(),wait_until='domcontentloaded')
 else:page.goto(args.public or (root/'index.html').as_uri(),wait_until='domcontentloaded',timeout=90000)
 page.wait_for_function('window.__DENIM_WORKBENCH__?.lastFrame?.frame>0',timeout=120000)
 box=page.locator('#view').bounding_box();assert box['y']>=0 and box['y']+box['height']<=844 and box['width']>=380
 frame=page.evaluate('__DENIM_WORKBENCH__.lastFrame');assert frame['geometryOnly'];page.screenshot(path=str(out/'mobile-first.png'),timeout=90000)
 page.locator('#damage').select_option('2');page.locator('#stage').scroll_into_view_if_needed();page.screenshot(path=str(out/'mobile-damage.png'),timeout=90000);assert not mobileErr
 (out/'mobile.json').write_text(json.dumps({'passed':True,'viewport':[390,844],'actualPhone':False,'canvas':box,'initialFrame':frame,'errors':mobileErr},ensure_ascii=False,indent=2))
 browser.close()
(out/'summary.json').write_text(json.dumps({'passed':True,'records':records,'mobileViewport':'pass; not hardware'},indent=2));print('ALL_BROWSER_QA_PASSED',flush=True)
