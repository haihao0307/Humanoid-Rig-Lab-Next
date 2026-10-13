"""Real browser regression, both offline standalone and immutable public URL."""
from pathlib import Path
import json,os,argparse,time,traceback
from playwright.sync_api import sync_playwright
from PIL import Image,ImageChops,ImageStat
R=Path(__file__).resolve().parent
ap=argparse.ArgumentParser();ap.add_argument('--url');ap.add_argument('--public',action='store_true');a=ap.parse_args()
O=R/'qa'/('public' if a.public else 'browser');O.mkdir(parents=True,exist_ok=True)
report={'version':'R10.0','checks':[],'errors':[],'scope':'Actual Chrome; 1440x1000 desktop and 390x844 viewport simulation, not a physical phone','url':a.url or (R/'public-lite.html').as_uri()}
def save(): (O/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
def check(name,passed,data=None):
 report['checks'].append({'name':name,'pass':bool(passed),'data':data});save();print(name, bool(passed),flush=True)
 if not passed:raise AssertionError(name)
def shot(page,name):
 page.evaluate('LEATHER_ATELIER.render()');page.wait_for_timeout(130);p=O/(name+'.png');page.locator('#stage').screenshot(path=str(p));return Image.open(p).convert('RGB')
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=os.environ.get('KAOPU_CHROMIUM_EXECUTABLE'),headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'])
 page=browser.new_page(viewport={'width':1440,'height':1000});page.set_default_timeout(180000);report['browser']=browser.version
 requests=[]
 page.on('request',lambda q:requests.append(q.url) if q.url.startswith(('http://','https://')) else None)
 page.on('pageerror',lambda e:report['errors'].append(str(e)))
 def onconsole(m):
  if m.type=='error' and not ('favicon.ico' in m.location.get('url','')):report['errors'].append(m.text)
 page.on('console',onconsole)
 try:
  page.goto(report['url'],wait_until='domcontentloaded');page.wait_for_function('window.LEATHER_ATELIER?.ready || (document.querySelector("#error") && !document.querySelector("#error").hidden)',timeout=240000)
  check('R10.0 renders rather than an error page',page.evaluate('window.LEATHER_ATELIER?.version')=='R10.0',page.locator('#error').inner_text())
  expected=os.environ.get('R09_EXPECTED_SOURCE_SHA')
  if expected:check('Immutable runtime source handshake',page.evaluate('LEATHER_ATELIER.snapshot().sourceCommit')==expected)
  check('Preserved thirteen material and six product previews',page.evaluate('JSON.stringify(LEATHER_ATELIER.snapshot().thumbs)')=='{"materials":13,"products":6}')
  check('Rejected jacket removed',page.locator('[data-product="jacket"]').count()==0)
  check('Six directly accessible integrated craft buttons',page.locator('#craftRibbon button').count()==6)
  before=shot(page,'diamond');page.locator('[data-craft="grid"]').click();after=shot(page,'grid')
  pixel=sum(ImageStat.Stat(ImageChops.difference(before,after)).mean)/3
  check('Grid button changes rendered leather, not a label alone',page.evaluate('LEATHER_ATELIER.config.craft')=='grid' and pixel>.5,{'meanPixelDifference':pixel})
  if not a.public:
   for craft in ['plain','channels','perforated','woven']:
    page.locator('[data-craft="'+craft+'"]').click();q=page.evaluate('LEATHER_ATELIER.audit()');shot(page,craft);check(craft+' finite actual surface and closed cut thickness',q['finite'] and q['continuousThreadMeshes']>0 and all(x['minMM']>.1 for x in page.evaluate('LEATHER_ATELIER.measureShell()')))
   page.locator('[data-craft="plain"]').click()
   for product in ['wallet','belt','bag','cowboy','pirate','swatch']:
    page.evaluate('(id)=>LEATHER_ATELIER.selectProduct(id)',product);q=page.evaluate('LEATHER_ATELIER.audit()');t=page.evaluate('LEATHER_ATELIER.measureShell()');check(product+' geometry, continuous yarn, live positive thickness',q['finite'] and q['detachedSticks']==0 and all(x['minMM']>.1 for x in t),{'panels':len(t),'minimumMM':min(x['minMM'] for x in t)})
    if product in ['wallet','swatch']:
     page.evaluate('LEATHER_ATELIER.inspectCut();LEATHER_ATELIER.thicknessView(true)');shot(page,product+'-cut');page.evaluate('LEATHER_ATELIER.thicknessView(false)')
    else:shot(page,product+'-overview')
  page.evaluate("LEATHER_ATELIER.selectProduct('wallet');LEATHER_ATELIER.configure({craft:'plain',thicknessScale:.65});")
  thin=page.evaluate('LEATHER_ATELIER.measureShell()');page.evaluate('LEATHER_ATELIER.configure({thicknessScale:1.8})');thick=page.evaluate('LEATHER_ATELIER.measureShell()')
  check('Thickness control changes actual inner/outer separation',all(b['maxMM']>x['maxMM']*2 for x,b in zip(thin,thick)),{'thin':thin,'thick':thick})
  page.evaluate('LEATHER_ATELIER.configure({thicknessScale:1});LEATHER_ATELIER.setView("home")');page.wait_for_function('LEATHER_ATELIER.productPhysics.version.startsWith("R09")')
  box=page.locator('#stage').bounding_box();x=box['x']+box['width']*.5;y=box['y']+box['height']*.5
  page.locator('#grabTool').click();page.mouse.move(x,y);page.mouse.down();page.wait_for_function('LEATHER_ATELIER.productPhysics.held')
  start=page.evaluate('LEATHER_ATELIER.productPhysics');page.mouse.move(x+25,y-60,steps=12);page.wait_for_function('(t)=>LEATHER_ATELIER.productPhysics.timeS>t+.08',arg=start['timeS'],timeout=90000)
  held=page.evaluate('LEATHER_ATELIER.productPhysics');shot(page,'live-lift');check('Actual pointer produces force and lifts the sewn product',not held['failed'] and held['finite'] and held['grabForceN']>0 and held['centerMM'][1]>start['centerMM'][1]+1,{'start':start,'held':held})
  page.mouse.up();page.wait_for_function('(t)=>LEATHER_ATELIER.productPhysics.timeS>t+.05',arg=held['timeS'],timeout=90000);released=page.evaluate('LEATHER_ATELIER.productPhysics');contact=page.evaluate('LEATHER_ATELIER.auditContact()')
  check('Release advances actual dynamics without simulation-face penetration',released['finite'] and not released['failed'] and not released['held'] and contact['penetrating']==0,{'released':released,'contact':contact})
  page.evaluate('LEATHER_ATELIER.resetGrab()');page.locator('#grabTool').click()
  # Camera gesture belongs to stage only; capturing outside must not select text.
  page.evaluate('LEATHER_ATELIER.setView("home")');page.wait_for_timeout(100)
  box=page.locator('#stage').bounding_box();page.mouse.move(box['x']+35,box['y']+15);page.mouse.down();page.mouse.move(box['x']-100,box['y']-60,steps=12);page.mouse.up()
  check('Orbit crossing viewport boundary never selects page text',page.evaluate('getSelection().toString()')=='')
  check('Pointer capture releases the selection guard',page.evaluate("!document.body.classList.contains('leather-dragging')"))
  # Copying text in an ordinary details panel remains possible.
  selectable=page.evaluate("getComputedStyle(document.querySelector('.details p')).userSelect")
  check('Selection is not disabled globally outside gestures',selectable!='none')
  page.evaluate('LEATHER_ATELIER.setView("home")');page.wait_for_timeout(100);box=page.locator('#stage').bounding_box();x=box['x']+box['width']/2;y=box['y']+box['height']/2
  page.locator('#grabTool').click();page.mouse.move(x,y);page.mouse.down();page.wait_for_function('LEATHER_ATELIER.productPhysics.held');page.mouse.move(x+15,y-15,steps=5)
  page.evaluate('window.r10BeforeBlock=LEATHER_ATELIER.productPhysics.steps;const until=performance.now()+600;while(performance.now()<until){}')
  page.wait_for_timeout(100);q=page.evaluate('LEATHER_ATELIER.productPhysics');old=page.evaluate('r10BeforeBlock')
  check('Physics advances independently while the render thread is blocked',q['steps']>old+5,{'before':old,'after':q['steps'],'blockedMainMS':600})
  check('No per-frame step request backlog',q['pendingRequests']<=2,q['pendingRequests'])
  page.keyboard.press('Escape');page.wait_for_timeout(100)
  check('Escape releases grab and selection guard',page.evaluate("!LEATHER_ATELIER.productPhysics.held&&!document.body.classList.contains('leather-dragging')"))
  page.mouse.up();page.evaluate('LEATHER_ATELIER.resetGrab()');page.locator('#grabTool').click()
  page.evaluate("LEATHER_ATELIER.selectProduct('swatch');LEATHER_ATELIER.configure({craft:'diamond'});");page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(300)
  check('Mobile viewport remains usable, not a physical-device claim',page.locator('#stage').bounding_box()['width']>200 and page.evaluate('document.documentElement.scrollWidth<=innerWidth+2'))
  shot(page,'mobile');report['networkRequests']=requests
  if not a.public:check('Standalone has no external network dependency',not requests,requests)
  check('No application or shader errors',not report['errors'],report['errors']);report['pass']=True
 except Exception as e:report['pass']=False;report['exception']=str(e);report['traceback']=traceback.format_exc();raise
 finally:save();browser.close()
print(json.dumps({'pass':True,'checks':len(report['checks'])}))
