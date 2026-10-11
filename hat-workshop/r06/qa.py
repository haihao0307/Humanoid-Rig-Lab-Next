"""Actual browser checks; memory review never substitutes for file/public release."""
from pathlib import Path
import argparse,base64,hashlib,json,os,time
from playwright.sync_api import sync_playwright
from PIL import Image,ImageDraw
R=Path(__file__).resolve().parent
p=argparse.ArgumentParser();p.add_argument('--url');p.add_argument('--memory',action='store_true');a=p.parse_args();mode='public' if a.url else 'memory' if a.memory else 'local';Q=R/'qa'/mode;Q.mkdir(parents=True,exist_ok=True)
M=json.loads((R/'BUILD_MANIFEST.json').read_text());N=json.loads((R/'qa/numeric/report.json').read_text());expected={(x['hat'],x['head']):x for x in N['records'] if x['fixture']=='original'}
checks=[];errors=[];console=[];http=[];requests=[];cases=[];start=time.monotonic()
report={'mode':mode,'url':a.url or (R/'standalone.html').as_uri(),'sourceSha':M['sourceSha'],'htmlSHA256':M['htmlSHA256'],'standaloneSHA256':M['standaloneSHA256'],'checks':checks,'cases':cases,'pageErrors':errors,'consoleErrors':console,'failedHTTP':http,'requests':requests,'userVisualAccepted':False,'physicalPhoneTested':False,'hairSimulationImplemented':False,'continuousDonningVerified':False}
def check(name,ok,detail=None):
 checks.append({'name':name,'passed':bool(ok),'detail':detail});print('CHECK',name,bool(ok),flush=True)
 if not ok:raise AssertionError(name)
with sync_playwright() as pw:
 kwargs={'headless':not bool(os.environ.get('HAT_HEADED')),'args':['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}
 if os.environ.get('HAT_CHROMIUM'):kwargs['executable_path']=os.environ['HAT_CHROMIUM']
 b=pw.chromium.launch(**kwargs);page=b.new_page(viewport={'width':1440,'height':1000});page.set_default_timeout(180000);page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:console.append(m.text) if m.type=='error' else None);page.on('response',lambda r:http.append({'url':r.url,'status':r.status}) if r.status>=400 else None);page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http://','https://')) else None)
 def capture(name):
  page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');page.locator('#canvas').screenshot(path=str(Q/(name+'.png')))
 try:
  if a.memory:page.set_content((R/'standalone.html').read_text(),wait_until='domcontentloaded')
  else:page.goto(a.url or (R/'standalone.html').as_uri(),wait_until='load',timeout=240000)
  page.wait_for_function('window.hatLab&&hatLab.ready()&&hatLab.firstFrameMS()!==null',timeout=240000);report['firstReadySeconds']=time.monotonic()-start
  check('R06 runtime and actual source identity',page.evaluate('hatLab.version')=='HAT-R06.0' and page.evaluate('hatLab.sourceCommit')==M['sourceSha'])
  check('eleven fixed categories',len(page.evaluate('hatLab.catalogue()'))==11)
  if mode=='local':check('standalone core network requests zero',not requests,requests)
  elif mode=='public':check('fixed public source packages loaded',any('/r03/assets/' in u for u in requests))
  for item in page.evaluate('hatLab.catalogue()'):
   id=item['id'];t=time.monotonic();page.evaluate('(id)=>hatLab.select(id)',id);page.wait_for_function('hatLab.ready()');hashA=None
   for i,hid in enumerate(['native-default','long_narrow','short_broad']):
    page.evaluate('(head)=>hatLab.set({head})',i);actual=page.evaluate('({geometry:hatLab.geometryHash(),head:hatLab.headGeometryHash(),band:hatLab.bandGeometryHash(),metrics:hatLab.metrics(),contract:hatLab.contract()})');e=expected[(id,hid)]
    check('exact module/browser fitted geometry '+id+'/'+hid,actual['geometry']==e['outputHash'],{'browser':actual['geometry'],'module':e['outputHash']})
    check('immutable source head '+id+'/'+hid,actual['head']==e['headHash'])
    check('actual inner bearing geometry '+id+'/'+hid,actual['band']==e['bandHash'])
    check('fixed category record '+id+'/'+hid,actual['contract']['archetype']==id and actual['contract']['fitStartsFromSourceEveryTime'] and not actual['contract']['headShapeModified'])
    cases.append({'hat':id,'head':hid,**actual})
    if i==0:hashA=actual['geometry'];page.evaluate('hatLab.frame("side")');capture(id+'-side');page.evaluate('hatLab.frame("three")');capture(id+'-three')
   page.evaluate('hatLab.set({head:0})');check('A-B-C-A no accumulated deformation '+id,page.evaluate('hatLab.geometryHash()')==hashA)
   old=page.evaluate('hatLab.geometryHash()');refused=page.evaluate('async()=>{try{await hatLab.set({width:1.03});return false}catch(e){return true}}');check('cannot drift locked dimensions '+id,refused and old==page.evaluate('hatLab.geometryHash()'))
   check('visible structural controls locked '+id,page.locator('#wearBandMM').is_disabled() and page.locator('#crownMM').is_disabled() and page.locator('#autoFit').is_disabled())
   check('hair coupling remains deferred '+id,page.evaluate('hatLab.hairPlan().state')=='DEFERRED_NO_HAIR_SOLVER');print('CASE_SECONDS',id,time.monotonic()-t,flush=True)
  page.evaluate('hatLab.select("cable")');page.evaluate('hatLab.set({head:0})');page.evaluate('hatLab.frame("three")');page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');before=page.evaluate('hatLab.capture()');gh=page.evaluate('hatLab.geometryHash()');page.evaluate('hatLab.set({dye:"wine"})');page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');after=page.evaluate('hatLab.capture()');check('material changes pixels, not sizing',before!=after and gh==page.evaluate('hatLab.geometryHash()'));page.evaluate('hatLab.set({dye:"original"})')
  page.evaluate('hatLab.set({cutaway:true})');capture('cable-cutaway');check('cutaway keeps real head',page.evaluate('hatLab.metrics().headVisible'));page.evaluate('hatLab.set({cutaway:false})');page.evaluate('hatLab.frame("inside")');capture('cable-inside');page.evaluate('hatLab.frame("three")')
  save=page.evaluate('hatLab.recipe()');bad=json.loads(json.dumps(save));bad['headMeshSHA256']='0'*64;check('wrong person recipe is rejected',page.evaluate('async r=>{try{await hatLab.restore(r);return false}catch{return true}}',bad));check('rejected recipe preserves current fit',gh==page.evaluate('hatLab.geometryHash()'))
  with page.expect_download() as ev:page.locator('#export').click()
  ev.value.save_as(str(Q/'recipe.json'));page.locator('#file').set_input_files(str(Q/'recipe.json'));page.wait_for_function('hatLab.ready()');check('file recipe import restores same geometry',gh==page.evaluate('hatLab.geometryHash()'))
  with page.expect_download() as ev:page.locator('#seating-export').click()
  ev.value.save_as(str(Q/'seating.json'));check('seating export distinguishes donning',json.loads((Q/'seating.json').read_text())['physicalDonningVerified'] is False)
  page.get_by_text('头发受压：后续接入方向',exact=True).click()
  with page.expect_download() as ev:page.locator('#hair-plan-export').click()
  ev.value.save_as(str(Q/'hair-interface.json'));check('hair plan export includes current head hash',json.loads((Q/'hair-interface.json').read_text())['identity']['headHash']==page.evaluate('hatLab.headGeometryHash()'))
  fake=page.evaluate('hatLab.headInput()');fake['id']='rejected-unknown-units';fake['units']='cm';check('unresolved target units refused',page.evaluate('async h=>{try{await hatLab.importHead(h);return false}catch{return true}}',fake));check('failed target import preserves original',gh==page.evaluate('hatLab.geometryHash()'))
  page.evaluate('async()=>{await Promise.all([hatLab.select("fishing"),hatLab.select("patrol"),hatLab.select("visor")])}');check('rapid switches retain last complete selection',page.evaluate('hatLab.ready()&&hatLab.metrics().hat==="visor"'))
  page.evaluate('hatLab.select("cable")');page.evaluate('hatLab.frame("three")');page.locator('#viewport').scroll_into_view_if_needed();page.screenshot(path=str(Q/'desktop.png'));page.set_viewport_size({'width':390,'height':844});page.evaluate('hatLab.frame("three")');page.locator('#viewport').scroll_into_view_if_needed();page.wait_for_timeout(250);check('mobile viewport no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'));page.screenshot(path=str(Q/'mobile.png'));page.locator('.hat-card[data-id="chef"]').click();page.wait_for_function('hatLab.ready()&&hatLab.metrics().hat==="chef"');check('mobile category selection works',page.evaluate('hatLab.metrics().hat')=='chef')
  check('no page errors',not errors,errors);check('no console or shader errors',not console,console);check('no failed HTTP',not http,http);report['passed']=True
  # Internal evidence montage, not a replacement for the interactive website.
  im=Image.new('RGB',(1200,1100),(233,230,222));draw=ImageDraw.Draw(im)
  for j,item in enumerate(page.evaluate('hatLab.catalogue()')):
   x=Image.open(Q/(item['id']+'-three.png')).convert('RGB');x.thumbnail((392,250));im.paste(x,((j%3)*400+(400-x.width)//2,(j//3)*275));draw.text(((j%3)*400+8,(j//3)*275+252),item['id'],fill=(25,30,30))
  im.save(Q/'all-categories.jpg',quality=90)
 except Exception as e:
  report['passed']=False;report['failure']=str(e)
  try:page.screenshot(path=str(Q/'failure.png'))
  except Exception:pass
  print('FAILURE',str(e),flush=True)
 finally:
  report['seconds']=time.monotonic()-start;(Q/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));b.close()
print('QA',mode,len(checks),report['passed'],flush=True)
if not report['passed']:raise SystemExit(1)
