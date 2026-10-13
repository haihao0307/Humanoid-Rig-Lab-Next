from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
import threading,argparse,json,time,base64,io
from PIL import Image,ImageStat,ImageChops
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parent
P=argparse.ArgumentParser();P.add_argument('--source',required=True);P.add_argument('--url');A=P.parse_args()
Q=R/'qa'/('public' if A.url else 'local');Q.mkdir(parents=True,exist_ok=True)
report={'version':'HAT-SURFACE-S1','source':A.source,'url':A.url,'checks':[],'hats':[],'errors':[],'shaderErrors':[],'passed':False,'filmReady':False,'equivalentToSource':False,'environment':'GitHub Actions Ubuntu Chromium SwiftShader; not user hardware'}
def save():(Q/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
def check(n,ok,detail=None):
 report['checks'].append({'name':n,'passed':bool(ok),'detail':detail});save()
 if not ok:raise AssertionError(n+': '+str(detail))
def capture(p,n):
 raw=base64.b64decode(p.evaluate('hatSurface.render()').split(',')[1]);(Q/(n+'.png')).write_bytes(raw);im=Image.open(io.BytesIO(raw)).convert('RGB');check('pixels '+n,min(im.size)>200 and sum(ImageStat.Stat(im).var)>35);return im
def diff(a,b):return sum(ImageStat.Stat(ImageChops.difference(a,b)).mean)/3
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(R.parent)));threading.Thread(target=server.serve_forever,daemon=True).start()
url=A.url or f'http://127.0.0.1:{server.server_port}/surface-s1/index.html#hat=cable'
page=None
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'])
  ctx=b.new_context(viewport={'width':1440,'height':1000},device_scale_factor=1)
  page=ctx.new_page();page.on('pageerror',lambda e:report['errors'].append(str(e)))
  page.on('console',lambda m:report['shaderErrors'].append(m.text) if m.type=='error' and ('Shader' in m.text or 'VALIDATE_STATUS' in m.text or 'GL_INVALID' in m.text) else None)
  requests=[];page.on('request',lambda req:requests.append(req.url))
  start=time.perf_counter();page.goto(url,wait_until='domcontentloaded',timeout=150000);page.wait_for_function('window.hatSurface&&hatSurface.ready()',timeout=120000)
  report['initialReadyMS']=(time.perf_counter()-start)*1000
  check('source identity',page.evaluate('hatSurface.snapshot().sourceSha')==A.source)
  check('all eleven cards',page.locator('.hat-card').count()==11)
  check('default is owned',page.evaluate('hatSurface.snapshot().mode')=='owned')
  check('original HD normals not requested by owned mode',not any('/details/' in s or 'cdn.jsdelivr.net/gh' in s for s in requests),requests)
  rows=page.evaluate('Object.keys(hatSurface.specs())')
  for id in rows:
   t=time.perf_counter();page.locator('.hat-card[data-id="'+id+'"]').click();page.wait_for_function('(id)=>hatSurface.ready()&&hatSurface.snapshot().hat===id',arg=id,timeout=45000)
   readyMS=(time.perf_counter()-t)*1000;page.evaluate("hatSurface.mode('owned');hatLab.frame('three')")
   snap=page.evaluate('hatSurface.snapshot()');full=capture(page,id+'-owned')
   check('no original texture sampling '+id,not any(snap['surfaceMaps'].values()) and snap['surfaceTextures']==0)
   check('rest binding length '+id,snap['restBinding']==page.evaluate('hatLab.metrics().vertices'))
   check('EB1 active '+id,snap['lighting'] and snap['lighting']['version']=='EB1-1.1.0' and snap['lighting']['legacyLightsDisabled'])
   check('EB1 exact default '+id,snap['lighting']['profile']==page.evaluate('KAOPU_EB1.DEFAULT'))
   page.evaluate("hatSurface.mode('shape')");shape=capture(page,id+'-shape')
   check('field has visible contribution '+id,diff(full,shape)>.05,diff(full,shape))
   check('shape mode does not change vertices '+id,page.evaluate('hatLab.geometryHash()')==snap['geometryHash'])
   page.evaluate("hatSurface.mode('owned');hatSurface.set({density:1.35,irregularity:.55,seed:29})")
   changed=capture(page,id+'-changed');check('parameters change surface pixels '+id,diff(full,changed)>.001,diff(full,changed))
   check('parameters preserve geometry/camera '+id,page.evaluate('hatLab.geometryHash()')==snap['geometryHash'] and page.evaluate('hatLab.cameraPose()')==snap['camera'])
   page.evaluate('(v)=>hatSurface.set(v)',snap['parameters']);restored=capture(page,id+'-restored')
   check('deterministic restoration '+id,diff(full,restored)<.1,diff(full,restored))
   page.evaluate("hatSurface.mode('reference')")
   if page.evaluate('Boolean(hatLab.debugParts().asset.meta.normalSource)'):
    page.wait_for_function('hatSurface.snapshot().referenceNormalReady',timeout=100000)
   reference=capture(page,id+'-reference-eb1')
   check('reference same geometry/camera '+id,page.evaluate('hatLab.geometryHash()')==snap['geometryHash'] and page.evaluate('hatLab.cameraPose()')==snap['camera'])
   page.evaluate("hatSurface.mode('owned')");again=capture(page,id+'-after-reference')
   check('loaded reference normals cannot contaminate owned '+id,diff(full,again)<.1,diff(full,again))
   report['hats'].append({'id':id,'readyMS':readyMS,'geometryHash':snap['geometryHash'],'vertices':snap['restBinding'],'triangles':snap['triangles'],'referenceDifferenceNotAnEquivalenceGate':diff(full,reference),'components':snap['components']});save()
   check('no shader failure '+id,not report['shaderErrors'],report['shaderErrors'])
  page.evaluate("hatSurface.select('cable')");page.wait_for_function('hatSurface.ready()',timeout=30000)
  source=page.evaluate('hatSurface.snapshot()');page.evaluate("hatSurface.space('fitted')");fit=page.evaluate('hatSurface.snapshot()')
  check('existing fit actually changes carrier',source['geometryHash']!=fit['geometryHash'])
  check('binding survives fit',fit['restBinding']==source['restBinding'] and fit['parameters']==source['parameters'])
  check('fitted positions finite',page.evaluate('hatLab.currentPositions().every(Number.isFinite)'))
  capture(page,'cable-fit-binding');page.evaluate("hatSurface.space('source')");check('return to exact source shape',page.evaluate('hatLab.geometryHash()')==source['geometryHash'])
  for mode in ['color','height','roughness','normal']:
   page.locator('#surface-mode').select_option(mode);capture(page,'cable-field-'+mode)
  page.locator('#surface-mode').select_option('owned');page.evaluate("hatLab.frame('detail')");capture(page,'cable-detail')
  # UI events, durable recipe, and EB1 state must survive normal native rebuilds.
  page.locator('#ps-density').evaluate("e=>{e.value=1.25;e.dispatchEvent(new Event('input',{bubbles:true}));}")
  check('real input event reaches uniform',page.evaluate('hatSurface.snapshot().parameters.density')==1.25)
  wanted=page.evaluate('hatSurface.recipe()');page.reload(wait_until='domcontentloaded',timeout=150000);page.wait_for_function('window.hatSurface&&hatSurface.ready()',timeout=120000)
  check('surface recipe survives reload',page.evaluate('hatSurface.recipe()')==wanted)
  page.evaluate('hatSurface.set({density:1})');page.evaluate('KAOPU_EB1 && __EB1__.store.patch({exposure:.95})');page.evaluate("hatSurface.space('fitted')")
  check('rebuild cannot reset EB1',page.evaluate('hatSurface.snapshot().lighting.profile.exposure')==.95)
  page.evaluate("__EB1__.store.preset('custom');hatSurface.space('source');hatLab.frame('three')")
  page.screenshot(path=str(Q/'desktop.png'),timeout=45000)
  page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(250);check('mobile viewport usable',page.evaluate('hatSurface.ready()'));page.screenshot(path=str(Q/'mobile-viewport.png'),timeout=45000)
  report['mobileScope']='390x844 viewport only, not physical phone'
  check('no script or surface exceptions',not report['errors'] and not page.evaluate('hatSurface.snapshot().errors'),report['errors'])
  check('no shader exceptions',not report['shaderErrors'],report['shaderErrors'])
  report['passed']=True;save();print(json.dumps({'passed':True,'checks':len(report['checks']),'hats':len(report['hats'])}),flush=True);ctx.close();b.close()
except Exception as e:
 report['failure']=str(e);save()
 if page:
  try:page.screenshot(path=str(Q/'failure.png'),timeout=15000)
  except Exception:pass
 raise
finally:server.shutdown()
