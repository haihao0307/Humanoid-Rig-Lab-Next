from pathlib import Path
import argparse,os,json,hashlib,time,traceback
from playwright.sync_api import sync_playwright
from PIL import Image,ImageStat,ImageChops
R=Path(__file__).resolve().parent
parser=argparse.ArgumentParser();parser.add_argument('--url');parser.add_argument('--public',action='store_true');args=parser.parse_args()
O=R/'qa'/('public' if args.public else 'local');O.mkdir(parents=True,exist_ok=True)
report={'checks':[],'errors':[],'console':[],'requests':[],'screenshots':[],'scope':'Chrome/SwiftShader; 390x844 is viewport simulation, not phone hardware'}
def check(name,result,detail=None):
 report['checks'].append({'name':name,'pass':bool(result),'detail':detail})
 (O/'browser.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 if not result:raise AssertionError(name)
def shot(page,name):
 page.evaluate('LEATHER_ATELIER.render(performance.now())');page.wait_for_timeout(180)
 file=O/(name+'.png');page.screenshot(path=str(file));report['screenshots'].append(file.name);return file
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('KAOPU_CHROMIUM_EXECUTABLE'),headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'])
 page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1);page.set_default_timeout(180000)
 report['browserVersion']=browser.version
 def console(m):
  if m.type!='error':return
  item={'text':m.text,'location':m.location};report['console'].append(item)
  if m.location.get('url')=='https://htmlpreview.github.io/favicon.ico' and '404' in m.text:report.setdefault('hostWarnings',[]).append(item)
  else:report['errors'].append(item)
 page.on('console',console);page.on('pageerror',lambda e:report['errors'].append(str(e)))
 page.on('request',lambda r:report['requests'].append(r.url) if r.url.startswith(('http:','https:')) else None)
 try:
  url=args.url or (R/'public-lite.html').as_uri();report['url']=url
  page.goto(url,wait_until='domcontentloaded',timeout=180000)
  page.wait_for_function('window.LEATHER_ATELIER?.ready',timeout=240000)
  report['initial']=page.evaluate('LEATHER_ATELIER.snapshot()')
  check('R07 ready without shader or runtime errors',not report['errors'],report['errors']);shot(page,'01-wallet')
  check('13 material and six product live views',report['initial']['thumbs']=={'materials':13,'products':6})
  for id in ['wallet','belt','bag','cowboy','pirate','swatch']:
   page.evaluate('(id)=>LEATHER_ATELIER.selectProduct(id)',id);audit=page.evaluate('LEATHER_ATELIER.audit()')
   check(id+' actual punched continuous-sewn geometry',audit['finite'] and audit['holes']>0 and audit['continuousThreadMeshes']>0 and audit['detachedSticks']==0,audit)
   shot(page,id+'-whole');page.evaluate("LEATHER_ATELIER.setView('macro');LEATHER_ATELIER.setLight('rake')");shot(page,id+'-seam-macro')
   page.evaluate("LEATHER_ATELIER.setView('back');LEATHER_ATELIER.setLight('neutral')");shot(page,id+'-back')
   page.evaluate("LEATHER_ATELIER.setView('home');LEATHER_ATELIER.setLight('studio')")
   check(id+' shaders remain error free',not report['errors'],report['errors'])
  page.evaluate("LEATHER_ATELIER.selectProduct('wallet')");stage=page.locator('#stage').bounding_box()
  page.locator('#grabTool').click();x=stage['x']+stage['width']*.5;y=stage['y']+stage['height']*.5
  page.mouse.move(x,y);page.mouse.down();page.wait_for_timeout(250)
  check('real pointer grabs a physical triangle',page.evaluate('LEATHER_ATELIER.productPhysics.held'))
  before=page.evaluate('LEATHER_ATELIER.productPhysics');page.mouse.move(x+50,y-90,steps=30);page.wait_for_timeout(1500);held=page.evaluate('LEATHER_ATELIER.productPhysics');shot(page,'wallet-pointer-held')
  check('grip propagates force and moves mass centre',held['finite'] and not held['failed'] and held['timeS']>before['timeS'] and held['grabForceN']>0,held)
  page.mouse.up();page.wait_for_timeout(1000);released=page.evaluate('LEATHER_ATELIER.productPhysics');shot(page,'wallet-pointer-released');check('release retains dynamic evolution',not released['held'] and released['timeS']>held['timeS'] and released['finite'],released)
  page.locator('#grabTool').click();page.evaluate('LEATHER_ATELIER.resetGrab()')
  page.evaluate("LEATHER_ATELIER.selectProduct('swatch')")
  for craft in ['diamond','grid','channels','perforated','woven']:
   page.evaluate('(craft)=>LEATHER_ATELIER.configure({craft})',craft);a=page.evaluate('LEATHER_ATELIER.audit()');check(craft+' craft stays finite and sewn',a['finite'] and a['continuousThreadMeshes']>0,a);shot(page,'craft-'+craft)
  page.evaluate("LEATHER_ATELIER.configure({craft:'plain'});LEATHER_ATELIER.setView('macro')")
  images=[]
  for age in [0,.55,1]:
   page.evaluate('(age)=>LEATHER_ATELIER.configure({age})',age);page.evaluate("LEATHER_ATELIER.setView('macro')");images.append(shot(page,'patina-'+str(age)))
  check('patina is a changing rendered surface',len({hashlib.sha256(f.read_bytes()).hexdigest() for f in images})==3)
  masses=[]
  for thickness in [.65,1,1.65]:
   page.evaluate('(thicknessScale)=>LEATHER_ATELIER.configure({thicknessScale,age:0})',thickness);masses.append(page.evaluate('LEATHER_ATELIER.productPhysics.massG'));shot(page,'thickness-'+str(thickness))
  check('actual nodal mass follows actual thickness',abs(masses[0]/masses[1]-.65)<.01 and abs(masses[2]/masses[1]-1.65)<.01,masses)
  page.evaluate("LEATHER_ATELIER.configure({thicknessScale:1});LEATHER_ATELIER.selectProduct('wallet')")
  page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(300);shot(page,'mobile-wallet')
  check('mobile has no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
  bounds=page.evaluate('LEATHER_ATELIER.frameAudit()');check('mobile product remains inside frame',bounds['maxAbsX']<.99 and bounds['maxAbsY']<.99,bounds)
  page.set_viewport_size({'width':1440,'height':1000});page.evaluate("LEATHER_ATELIER.selectProduct('cowboy')");shot(page,'final-cowboy')
  check('application error tracker and console empty',not report['errors'] and not page.evaluate('LEATHER_ATELIER.errors'),report['errors'])
  if not args.public:check('standalone core needs zero remote resources',not report['requests'],report['requests'])
  report['pass']=True
 except Exception as e:
  report['pass']=False;report['failure']=str(e);report['traceback']=traceback.format_exc()
  try:page.screenshot(path=str(O/'FAILURE.png'));report['visibleError']=page.locator('#error').inner_text()
  except:pass
 finally:
  (O/'browser.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps({'pass':report.get('pass'),'failure':report.get('failure'),'checks':len(report['checks']),'errors':report['errors']},ensure_ascii=False));browser.close()
raise SystemExit(0 if report.get('pass') else 1)
