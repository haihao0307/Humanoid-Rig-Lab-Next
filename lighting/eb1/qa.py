"""Actual Chromium surface tests; no generated render evidence or private asset export."""
import os,json,hashlib,time,pathlib,io,sys,traceback
from PIL import Image,ImageChops,ImageStat
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parent;DEST=ROOT/'qa';DEST.mkdir(exist_ok=True)
BASE=os.environ.get('EB1_BASE_URL','http://127.0.0.1:8791/')
NAMES=os.environ.get('EB1_CASES','lab,leather,hat,denim,shoe,tailor').split(',')
ready={'lab':'window.EB1_LAB?.audit().serial>0','leather':'window.LEATHER_ATELIER?.ready','hat':'window.hatLab?.ready()','denim':'window.__DENIM_WORKBENCH__?.ready&&window.__DENIM_WORKBENCH__?.lastFrame?.frame>0','shoe':'window.SHOE_R08?.ready&&window.SHOE_R08?.report().active','tailor':'window.__MP04__?.audit().ready&&!window.__MP04__?.audit().pending&&window.__MP04__?.audit().rows.length===2'}
audit={'lab':'EB1_LAB.audit()','leather':'LEATHER_ATELIER.snapshot()','hat':'hatLab.metrics()','denim':'__DENIM_WORKBENCH__.lastFrame','shoe':'SHOE_R08.report()','tailor':'__MP04__.audit()'}
reselect={'leather':"LEATHER_ATELIER.selectMaterial(LEATHER_ATELIER.material)",'hat':"hatLab.set({light:'studio'})",'denim':"__DENIM_WORKBENCH__.loadRecipe(__DENIM_WORKBENCH__.recipe())",'shoe':"SHOE_R08.importState(SHOE_R08.exportState())",'tailor':"__MP04__.studioLight()"}
report={'version':'EB1-1.0.0','baseURL':BASE,'sourceCommit':os.environ.get('EB1_SOURCE_SHA',os.environ.get('GITHUB_SHA')),'scope':'Chromium SwiftShader software renderer; viewport testing, not physical mobile or consumer GPU FPS certification','cases':{},'publicBrowserVerified':BASE.startswith('https://')}
def save():
 (DEST/'REPORT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2,default=str))
def screenshot(page,name,suffix):
 path=DEST/(name+'-'+suffix+'.png');page.screenshot(path=str(path),timeout=120000,animations='disabled');return path
# Compare only the center portion of the real canvas, not UI labels.
def surface(page):
 return page.evaluate('''()=>{const a=[...document.querySelectorAll('canvas')].filter(c=>{const r=c.getBoundingClientRect();return r.width>100&&r.height>100&&r.bottom>0&&r.top<innerHeight});a.sort((a,b)=>b.clientWidth*b.clientHeight-a.clientWidth*a.clientHeight);const r=a[0].getBoundingClientRect();return {x:Math.max(0,r.x+r.width*.3),y:Math.max(0,r.y+r.height*.3),width:Math.min(r.width*.4,innerWidth-r.x-r.width*.3),height:Math.min(r.height*.4,innerHeight-r.y-r.height*.3)}}''')
def canvas_image(page):
 return Image.open(io.BytesIO(page.screenshot(clip=surface(page),timeout=120000,animations='disabled'))).convert('RGB')
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
 for name in NAMES:
  if not name:continue
  ctx=browser.new_context(viewport={'width':1360,'height':900},device_scale_factor=1,ignore_https_errors=False);page=ctx.new_page();errors=[];shader=[];failed=[]
  page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda e:shader.append(e.text) if e.type=='error' and any(x in e.text for x in ['VALIDATE_STATUS','Shader Error','shader error','Error:']) else None)
  page.on('requestfailed',lambda r:failed.append({'url':r.url,'failure':r.failure}))
  row={'passed':False,'errors':errors,'shaderErrors':shader,'failedRequests':failed};report['cases'][name]=row;t=time.time();save()
  try:
   url=BASE+('index.html' if name=='lab' else name+'/index.html')
   response=page.goto(url,wait_until='domcontentloaded',timeout=120000);row['httpStatus']=response.status if response else None
   page.wait_for_function(ready[name],timeout=180000);page.wait_for_function('window.__EB1__&&document.querySelector("#eb1-panel")',timeout=15000);page.wait_for_timeout(1200)
   if name in ['leather','denim']:page.evaluate('window.LEATHER_ATELIER?.pausePhysics();window.__DENIM_WORKBENCH__?.set?.({animate:false});')
   row['initialLighting']=page.evaluate('__EB1__.audit()');row['native']=page.evaluate(audit[name]);assert row['initialLighting']['profile']['exposure']==1,'unexpected persisted default in fresh browser'
   row['defaultScreenshot']=screenshot(page,name,'default').name;initial=canvas_image(page);assert sum(ImageStat.Stat(initial).stddev)>3,'blank/uniform canvas'
   geometry=page.evaluate('window.hatLab?hatLab.geometryHash():null')
   # Real DOM slider events prove UI-to-render integration.
   page.locator('#eb1-panel summary').click();el=page.locator('#eb1-panel [data-key="exposure"]');el.focus();el.press('Home');[el.press('ArrowRight') for _ in range(7)];page.wait_for_timeout(2200)
   page.locator('#eb1-panel summary').click();changed=canvas_image(page);delta=ImageStat.Stat(ImageChops.difference(initial,changed)).mean;row['exposurePixelMAD']=sum(delta)/3;assert row['exposurePixelMAD']>.8,'exposure has no visible effect on actual canvas'
   assert abs(page.evaluate('__EB1__.store.get().exposure')-.45)<1e-6
   page.evaluate('__EB1__.store.patch({keyAzimuth:-65,environment:.3,rim:.8,exposure:.8})');page.wait_for_timeout(1800);row['changedScreenshot']=screenshot(page,name,'adjusted').name
   if geometry:assert geometry==page.evaluate('hatLab.geometryHash()'),'light changed native hat geometry'
   # Original UI reset/model restore must not replace EB1.
   if name in reselect:
    expression=reselect[name]
    if name=='denim':
     keys=page.evaluate('Object.keys(__DENIM_WORKBENCH__)');row['nativeAPI']=keys
     expression="(()=>{const a=__DENIM_WORKBENCH__;if(a.recipe&&a.loadRecipe)return a.loadRecipe(a.recipe());if(a.set)return a.set({shape:0});})()"
    page.evaluate(expression);page.wait_for_function(ready[name],timeout=120000);page.wait_for_timeout(500)
   assert page.evaluate('__EB1__.store.get().keyAzimuth')==-65,'native rebuild overwrote EB1'
   assert page.evaluate('__EB1__.store.get().exposure')==.8,'native rebuild overwrote exposure'
   row['survivesNativeRebuild']=True
   page.reload(wait_until='domcontentloaded',timeout=120000);page.wait_for_function(ready[name],timeout=180000);assert page.evaluate('__EB1__.store.get().keyAzimuth')==-65;assert page.evaluate('__EB1__.store.get().exposure')==.8;row['survivesReload']=True
   row['finalLighting']=page.evaluate('__EB1__.audit()');assert not errors,'page errors: '+str(errors);assert not shader,'shader errors: '+str(shader)
   row['passed']=True
  except Exception as e:
   row['error']=str(e);row['trace']=traceback.format_exc()
   try:row['failureScreenshot']=screenshot(page,name,'failure').name;row['bodyText']=page.locator('body').inner_text(timeout=5000)[-6000:]
   except Exception:pass
  finally:
   row['elapsedSeconds']=round(time.time()-t,2);save();print('CASE',name,json.dumps({k:v for k,v in row.items() if k in ['passed','error','elapsedSeconds','exposurePixelMAD','errors','shaderErrors']},ensure_ascii=False),flush=True);ctx.close()
 # A mobile viewport check is not physical mobile validation.
 ctx=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1);page=ctx.new_page()
 try:
  page.goto(BASE+'index.html',wait_until='domcontentloaded',timeout=120000);page.wait_for_function(ready['lab'],timeout=90000);row={'rendered':True,'screenshot':screenshot(page,'lab','mobile-viewport').name,'physicalDevice':False};report['mobileViewport']=row
 except Exception as e:report['mobileViewport']={'rendered':False,'error':str(e),'physicalDevice':False}
 ctx.close();browser.close()
report['passed']=all(r['passed'] for r in report['cases'].values());report['imageSHA256']={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in DEST.glob('*.png')};save()
print('FINAL',json.dumps({'passed':report['passed'],'cases':{n:r['passed'] for n,r in report['cases'].items()}}),flush=True)
sys.exit(0 if report['passed'] else 1)
