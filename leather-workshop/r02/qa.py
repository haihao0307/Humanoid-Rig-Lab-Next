from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image,ImageChops,ImageStat
import json,sys,io,zipfile,struct,hashlib
r=Path(__file__).resolve().parent;q=r/'qa';q.mkdir(exist_ok=True)
url=sys.argv[1] if len(sys.argv)>1 else (r/'preview.html').as_uri();public=url.startswith('https:');name='public' if public else 'local';errors=[];requests=[];report={'url':url,'version':'R02.0','public':public,'realMobileDevice':False,'visualAcceptance':'PENDING_USER','tests':[]}
def check(ok,label):
 report['tests'].append({'name':label,'pass':bool(ok)})
 if not ok:raise AssertionError(label)
def delta(a,b):return sum(ImageStat.Stat(ImageChops.difference(Image.open(io.BytesIO(a)).convert('RGB'),Image.open(io.BytesIO(b)).convert('RGB'))).mean)/3
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-dev-shm-usage']);page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
 page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None);page.on('request',lambda r:requests.append(r.url))
 def wait_bake(g):page.wait_for_function('(g)=>LEATHER_LAB.generation>g&&document.querySelector("#busy").hidden',arg=g,timeout=60000);page.wait_for_timeout(100)
 def shot(n):page.screenshot(path=str(q/(name+'-'+n+'.png')))
 try:
  page.goto(url,wait_until='domcontentloaded',timeout=60000);page.wait_for_function('window.LEATHER_LAB?.ready',timeout=60000);page.wait_for_timeout(300)
  check(page.evaluate('LEATHER_LAB.version')=='R02.0','runtime is R02');check(not errors,'zero boot errors');canvas=page.locator('#viewport');before=canvas.screenshot();shot('desktop');page.click('#macro');page.wait_for_timeout(200);check(delta(before,canvas.screenshot())>1,'macro changes pixels');shot('macro')
  if not public:
   for key in ['tan','wax','black','nubuck','cross','croco','ostrich','suede']:
    g=page.evaluate('LEATHER_LAB.generation');page.click('[data-preset="'+key+'"]');wait_bake(g);check(page.evaluate('LEATHER_LAB.params.preset')==key,'material '+key);shot('material-'+key)
   page.click('#reset');page.wait_for_timeout(200);page.click('#macro');page.wait_for_timeout(200);before=canvas.screenshot();page.locator('#legacy').dispatch_event('pointerdown');page.wait_for_timeout(200);check(delta(before,canvas.screenshot())>.2,'R01 vs R02 changes real grain');shot('r01-comparison');page.dispatch_event('body','pointerup');page.wait_for_timeout(100)
   for key in ['aniline','pigmented','wax','matte','patent','metallic','pearl']:
    g=page.evaluate('LEATHER_LAB.generation');page.select_option('#finish',key);wait_bake(g);check(page.evaluate('LEATHER_LAB.params.finish')==key,'finish '+key)
   for key in ['natural','seat','vent','braid','aged']:
    page.click('[data-combo="'+key+'"]');page.wait_for_timeout(200);shot('craft-'+key);check(page.evaluate('LEATHER_LAB.stats().geometry')>10000,'geometry '+key)
    if key=='vent':check(page.evaluate('LEATHER_LAB.craftInfo().holes')>100,'perforations generated');page.click('#macro');page.wait_for_timeout(150);shot('perforation-macro')
    if key=='seat':page.click('#macro');page.wait_for_timeout(150);shot('quilt-macro')
   for key in ['single','double','cross','zigzag','none']:
    page.select_option('#stitch',key);check(page.evaluate('LEATHER_LAB.params.stitch')==key,'stitch '+key)
   for key in ['baseColor','normal','roughness','ao','beauty']:
    page.select_option('#channel',key);page.wait_for_timeout(80);check(page.evaluate('LEATHER_LAB.params.channel')==key,'diagnostic '+key)
   page.click('#save');recipe=page.evaluate('LEATHER_LAB.recipe()');page.click('#reset');page.click('#restore');check(page.evaluate('LEATHER_LAB.params.damage')==recipe['parameters']['damage'],'save restore material and craft')
   legacy={'schema':'kaopu/leather_material@1','parameters':{'preset':'tan','color':'#a7784f','grain':1.12,'depth':.14,'roughness':.48,'coat':.12,'wear':.1,'seed':27,'resolution':1024,'fold':1,'stitches':True,'object':'roll','light':'studio','exposure':1.1}}
   page.evaluate('(d)=>LEATHER_LAB.loadRecipe(d)',legacy);check(page.evaluate('LEATHER_LAB.recipe().schema')=='kaopu/leather_material@2','R01 recipe migrates');check(page.evaluate('LEATHER_LAB.params.grain')==1.12,'migration preserves existing grain setting')
   rejected=page.evaluate('()=>{let d=LEATHER_LAB.recipe();d.parameters.grain=-3;try{LEATHER_LAB.loadRecipe(d);return false;}catch(e){return true;}}');check(rejected,'invalid recipe rejected')
   with page.expect_download(timeout=60000) as download:page.click('#exportKit')
   dest=q/'sample-material.zip';download.value.save_as(str(dest));z=zipfile.ZipFile(dest);check(z.testzip() is None,'material ZIP CRC valid');check(set(z.namelist())=={'baseColor.png','normal.png','roughness.png','ao.png','height16.png','recipe.json','README.txt'},'complete material package files');height=z.read('height16.png');check(height[24]==16 and height[25]==0,'height PNG is 16-bit grayscale');im=Image.open(io.BytesIO(height));check(im.size==(1024,1024) and im.getextrema()[1]>im.getextrema()[0],'height16 has real values');report['height16Range']=im.getextrema()
   check(len([u for u in requests if u.startswith(('http:','https:'))])==0,'standalone core zero HTTP requests');page.click('#reset');page.wait_for_timeout(200);shot('final')
   mobile=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True);mobile.on('pageerror',lambda e:errors.append('mobile '+str(e)));mobile.goto(url,wait_until='load',timeout=60000);mobile.wait_for_function('window.LEATHER_LAB?.ready',timeout=60000);mobile.screenshot(path=str(q/'mobile-390x844.png'));check(mobile.evaluate('LEATHER_LAB.params.resolution')==1024,'mobile texture tier');mobile.click('#macro');mobile.wait_for_timeout(150);mobile.screenshot(path=str(q/'mobile-macro.png'));mobile.close()
  else:
   g=page.evaluate('LEATHER_LAB.generation');page.click('[data-preset="black"]');wait_bake(g);check(page.evaluate('LEATHER_LAB.params.preset')=='black','public preset switch');page.click('[data-combo="seat"]');page.wait_for_timeout(200);check(page.evaluate('LEATHER_LAB.craftInfo().craft')=='diamond','public geometric quilting');shot('quilt');page.click('[data-combo="vent"]');page.wait_for_timeout(200);check(page.evaluate('LEATHER_LAB.craftInfo().holes')>100,'public perforations');shot('perforated')
  check(not errors,'zero errors through tested controls');report['pass']=True;report['stats']=page.evaluate('LEATHER_LAB.stats()')
 except Exception as e:
  report.update({'pass':False,'failure':str(e),'errors':errors})
  try:shot('failure');report['body']=page.locator('body').inner_text()[-10000:]
  except Exception:pass
  raise
 finally:
  report['errors']=errors;report['requests']=requests;(q/('qa-'+name+'.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False));browser.close()
