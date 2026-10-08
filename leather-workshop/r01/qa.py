from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image,ImageChops,ImageStat
import sys,json,time,hashlib,base64,io
ROOT=Path(__file__).parent;Q=ROOT/'qa';Q.mkdir(exist_ok=True)
url=sys.argv[1] if len(sys.argv)>1 else (ROOT/'preview.html').as_uri()
public=url.startswith('https://');report={'url':url,'public':public,'visualAcceptance':'PENDING_USER','adobeOneToOne':'NOT_VERIFIED','realMobileDevice':False,'tests':[]};errors=[];requests=[]
name='public' if public else 'local'
def check(x,msg):
 report['tests'].append({'name':msg,'pass':bool(x)})
 if not x:raise AssertionError(msg)
def png(canvas):return Image.open(io.BytesIO(canvas)).convert('RGB')
def delta(a,b):return sum(ImageStat.Stat(ImageChops.difference(png(a),png(b))).mean)/3
try:
 with sync_playwright() as p:
  b=p.chromium.launch(headless=True,args=['--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-dev-shm-usage'])
  page=b.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
  page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None);page.on('request',lambda r:requests.append(r.url))
  t=time.time();page.goto(url,wait_until='load',timeout=60000);page.wait_for_function('window.LEATHER_LAB?.ready',timeout=60000);page.wait_for_timeout(500)
  check(page.evaluate('LEATHER_LAB.version')=='R01.0','correct runtime version');check(not errors,'no startup console errors');check(page.evaluate('LEATHER_LAB.stats().geometry')>10000,'real triangle geometry rendered')
  report['startupSeconds']=time.time()-t;report['stats']=page.evaluate('LEATHER_LAB.stats()')
  canvas=page.locator('#viewport');initial=canvas.screenshot();check(max(ImageStat.Stat(png(initial)).stddev)>12,'nonblank canvas');page.screenshot(path=str(Q/(name+'-desktop.png')))
  page.click('#macro');page.wait_for_timeout(300);page.screenshot(path=str(Q/(name+'-macro.png')));check(delta(initial,canvas.screenshot())>1,'macro changes rendered camera')
  if not public:
   page.click('#home');page.wait_for_timeout(100);before=canvas.screenshot();page.locator('#compare').dispatch_event('pointerdown');page.wait_for_timeout(200);ab=canvas.screenshot();check(delta(before,ab)>.2,'A/B changes canvas not only labels');page.screenshot(path=str(Q/'local-ab.png'));page.evaluate('LEATHER_LAB.baseline(false)')
   hashes={}
   for key in ['tan','wax','black','nubuck','cross']:
    gen=page.evaluate('LEATHER_LAB.generation');page.click('[data-preset="'+key+'"]');page.wait_for_function('(g)=>LEATHER_LAB.generation>g',arg=gen,timeout=60000);page.wait_for_timeout(100);check(page.evaluate('LEATHER_LAB.params.preset')==key,'preset '+key)
    page.screenshot(path=str(Q/('preset-'+key+'.png')));data=page.evaluate('LEATHER_LAB.exportMap("normal")');raw=base64.b64decode(data.split(',')[1]);im=Image.open(io.BytesIO(raw));check(im.size==(2048,2048),'normal map dimensions '+key);hashes[key]=hashlib.sha256(raw).hexdigest()
    page.click('#macro');page.wait_for_timeout(100);page.screenshot(path=str(Q/('macro-'+key+'.png')));page.click('#home')
   check(len({hashes[k] for k in ['tan','black','nubuck','cross']})==4,'four different grain structures, not recolors');report['normalMapHashes']=hashes
   page.click('[data-preset="tan"]');page.wait_for_function('LEATHER_LAB.params.preset==="tan" && document.querySelector("#busy").hidden',timeout=60000)
   before=canvas.screenshot();gen=page.evaluate('LEATHER_LAB.generation');page.evaluate('LEATHER_LAB.setParam("roughness",.8)');page.wait_for_function('(g)=>LEATHER_LAB.generation>g',arg=gen,timeout=60000);check(delta(before,canvas.screenshot())>.2,'roughness slider changes rendered pixels')
   recipe=page.evaluate('LEATHER_LAB.recipe()');page.click('#save');gen=page.evaluate('LEATHER_LAB.generation');page.click('[data-preset="wax"]');page.wait_for_function('(g)=>LEATHER_LAB.generation>g',arg=gen,timeout=60000);page.click('#restore');check(page.evaluate('LEATHER_LAB.params.preset')==recipe['parameters']['preset'],'local save/restore')
   for obj in ['flat','sphere','roll']:
    page.select_option('#object',obj);page.wait_for_timeout(200);check(page.evaluate('LEATHER_LAB.params.object')==obj,'surface transfer '+obj);page.screenshot(path=str(Q/('object-'+obj+'.png')))
   before=canvas.screenshot();page.select_option('#light','raking');page.wait_for_timeout(200);check(delta(before,canvas.screenshot())>.2,'raking-light inspection');page.screenshot(path=str(Q/'raking.png'));page.select_option('#light','studio')
   page.evaluate('LEATHER_LAB.loadRecipe('+json.dumps({'schema':'kaopu/leather_material@1','parameters':{**recipe['parameters'],'preset':'tan','kind':0,'roughness':.48,'resolution':2048}})+')');page.screenshot(path=str(Q/'final-desktop.png'))
   check(len([u for u in requests if u.startswith(('http:','https:'))])==0,'standalone core has zero network requests')
   mobile=b.new_page(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True);mobile.on('pageerror',lambda e:errors.append('mobile '+str(e)));mobile.on('console',lambda m:errors.append('mobile '+m.text) if m.type=='error' else None);mobile.goto(url,wait_until='load',timeout=60000);mobile.wait_for_function('window.LEATHER_LAB?.ready',timeout=60000);check(mobile.evaluate('LEATHER_LAB.params.resolution')==1024,'mobile viewport uses 1024 texture tier');mobile.screenshot(path=str(Q/'mobile-390x844.png'));check(mobile.locator('#viewport').bounding_box()['height']>=390,'mobile usable viewport');mobile.click('#macro');mobile.wait_for_timeout(200);mobile.screenshot(path=str(Q/'mobile-macro.png'));mobile.close()
  else:
   page.click('#home');before=canvas.screenshot();page.click('#back');page.wait_for_timeout(200);check(delta(before,canvas.screenshot())>.2,'public camera interaction');gen=page.evaluate('LEATHER_LAB.generation');page.click('[data-preset="black"]');page.wait_for_function('(g)=>LEATHER_LAB.generation>g',arg=gen,timeout=60000);check(page.evaluate('LEATHER_LAB.params.preset')=='black','public preset interaction')
  check(not errors,'zero errors through all tested interactions');report['errors']=errors;report['pass']=True;report['httpRequests']=requests;report['statsFinal']=page.evaluate('LEATHER_LAB.stats()');b.close()
except Exception as e:
 report.update({'pass':False,'failure':str(e),'errors':errors})
 try:page.screenshot(path=str(Q/(name+'-failure.png')))
 except Exception:pass
 raise
finally:
 (Q/('qa-'+name+'.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False))
