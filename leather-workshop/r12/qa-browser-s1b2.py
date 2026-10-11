"""Real-browser R10/S1B2 differential and standalone/public delivery gates.
Run where normal Chrome navigation is permitted. Never alter managed browser policy.
"""
from __future__ import annotations
import argparse, hashlib, io, json, os, platform, time, traceback
from pathlib import Path
from PIL import Image, ImageChops, ImageStat
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent
ap=argparse.ArgumentParser();ap.add_argument('--url');ap.add_argument('--public',action='store_true');args=ap.parse_args()
OUT=ROOT/'qa'/'s1b2'/('public' if args.public else 'browser');OUT.mkdir(parents=True,exist_ok=True)
report={'phase':'S1B2','version':'R12.0-S1B2','sourceCommit':os.environ.get('LEATHER_SOURCE_COMMIT','UNCOMMITTED-S1B2'),'pass':False,'checks':[],'errors':[], 'scope':'Actual Chrome WebGL; desktop 1440x1000, mobile 390x844 viewport simulation only; not a physical-device or real-time performance certification.'}
def save(): (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
def check(name,passed,data=None):
 report['checks'].append({'name':name,'pass':bool(passed),'data':data});save();print(name,bool(passed),flush=True)
 if not passed:raise AssertionError(name)
def ready(page,version):
 page.wait_for_function("window.LEATHER_ATELIER?.ready || (document.querySelector('#error') && !document.querySelector('#error').hidden)",timeout=240000)
 check(version+' actual runtime ready',page.evaluate('window.LEATHER_ATELIER?.version')==version,page.locator('#error').inner_text())
def layout(page):
 return page.evaluate("()=>({scroll:[scrollX,scrollY],size:[innerWidth,innerHeight,devicePixelRatio],compatMode:document.compatMode,rectangles:Object.fromEntries(['stage','sceneCanvas','craftRibbon','collection'].map(id=>{const e=document.getElementById(id);return[id,{rect:e.getBoundingClientRect().toJSON(),client:[e.clientWidth,e.clientHeight],scroll:[e.scrollLeft,e.scrollTop]}]})),frame:LEATHER_ATELIER.frameAudit(),gauge:LEATHER_ATELIER.measureShell(),audit:LEATHER_ATELIER.audit(),physics:LEATHER_ATELIER.productPhysics})")
def shot(page,name):
 page.evaluate('LEATHER_ATELIER.render()');page.wait_for_timeout(120)
 before=layout(page)
 data=page.locator('#stage').screenshot();(OUT/(name+'.png')).write_bytes(data)
 report.setdefault('captureDiagnostics',{})[name]={'before':before,'after':layout(page)};save()
 return Image.open(io.BytesIO(data)).convert('RGB')
def canonical(v):
 if isinstance(v,dict):return {k:canonical(x) for k,x in v.items() if k not in {'tessellationMS','sourceCommit','version'}}
 if isinstance(v,list):return [canonical(x) for x in v]
 return v
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=os.environ.get('KAOPU_CHROMIUM_EXECUTABLE','/usr/bin/google-chrome'),headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'])
 report['browser']=browser.version;report['platform']=platform.platform()
 contexts=[];requests=[]
 def new_page(label,url,offline=False):
  ctx=browser.new_context(viewport={'width':1440,'height':1000});contexts.append(ctx)
  if offline:ctx.set_offline(True)
  p=ctx.new_page();p.set_default_timeout(180000)
  p.on('pageerror',lambda e:report['errors'].append({'page':label,'error':str(e)}))
  p.on('console',lambda m:report['errors'].append({'page':label,'error':m.text}) if m.type=='error' and 'favicon' not in m.location.get('url','') else None)
  p.on('request',lambda q:requests.append({'page':label,'url':q.url}) if q.url.startswith(('http://','https://')) else None)
  p.goto(url,wait_until='domcontentloaded',timeout=90000)
  ready(p,'R10.0' if label=='reference' else 'R12.0-S1B2')
  return p
 try:
  url=args.url or (ROOT/'out/candidate-r12-s1b.html').as_uri();report['url']=url
  page=new_page('candidate',url,not args.public)
  check('Source identity matches tested source commit',page.evaluate('LEATHER_ATELIER.snapshot().sourceCommit')==report['sourceCommit'])
  required=['inspectGrip','measureShell','thicknessView','recipe','auditContact','stepProduct','performance']
  check('Complete public API exists at first boot',page.evaluate('(names)=>names.every(k=>typeof LEATHER_ATELIER[k]==="function")',required))
  await_script='async()=>{await LEATHER_ATELIER.resetGrab();const a=LEATHER_ATELIER.productPhysics.steps;await LEATHER_ATELIER.stepProduct(3);return {before:a,after:LEATHER_ATELIER.productPhysics.steps};}'
  q=page.evaluate(await_script);check('First-boot manual step delegates to actual worker exactly three times',q['after']-q['before']==3,q)
  page.evaluate('LEATHER_ATELIER.resetGrab()')
  check('Six retained products, thirteen material previews, no jacket',page.evaluate('JSON.stringify(LEATHER_ATELIER.snapshot().thumbs)')=='{"materials":13,"products":6}' and page.locator('[data-product="jacket"]').count()==0)
  check('Six visible craft controls',page.locator('#craftRibbon button').count()==6)
  if not args.public:
   reference=new_page('reference',(ROOT.parent/'r10/public-lite.html').as_uri(),True)
   for p in [reference,page]:p.add_style_tag(content='#stageLabel{visibility:hidden !important}')
   def compare_view(name,script):
    for p in [reference,page]:p.evaluate(script)
    a=shot(reference,'reference-'+name);b=shot(page,'candidate-'+name)
    check(name+' image dimensions unchanged',a.size==b.size)
    x=reference.evaluate('({frame:LEATHER_ATELIER.frameAudit(),gauge:LEATHER_ATELIER.measureShell(),audit:LEATHER_ATELIER.audit()})')
    y=page.evaluate('({frame:LEATHER_ATELIER.frameAudit(),gauge:LEATHER_ATELIER.measureShell(),audit:LEATHER_ATELIER.audit()})')
    check(name+' camera, live gauge and geometry audit unchanged',canonical(x)==canonical(y),{'reference':x,'candidate':y})
    diff=ImageChops.difference(a,b);mean=sum(ImageStat.Stat(diff).mean)/3
    hist=diff.convert('L').histogram();changed=sum(hist[3:])/(a.width*a.height)
    if mean>.02 or changed>.0005:diff.save(OUT/(name+'-difference.png'))
    check(name+' material/lighting/geometry pixel equivalence',mean<=.02 and changed<=.0005,{'meanRGBDifference':mean,'fractionDifferentAbove2':changed,'allowedMean':.02,'allowedFraction':.0005})
   for ident in ['wallet','belt','bag','cowboy','pirate','swatch']:
    compare_view('product-'+ident,f"()=>{{LEATHER_ATELIER.selectProduct('{ident}');LEATHER_ATELIER.configure({{craft:'{'diamond' if ident=='swatch' else 'plain'}'}});LEATHER_ATELIER.setView('home');}}")
   for craft in ['plain','diamond','grid','channels','perforated','woven']:
    compare_view('craft-'+craft,f"()=>{{LEATHER_ATELIER.selectProduct('swatch');LEATHER_ATELIER.configure({{craft:'{craft}'}});LEATHER_ATELIER.setView('home');}}")
   material_ids=page.locator('[data-material]').evaluate_all('(xs)=>xs.map(x=>x.dataset.material)')
   check('Full material comparison uses thirteen distinct IDs',len(set(material_ids))==13,material_ids)
   for ident in material_ids:
    compare_view('material-'+ident,f"()=>{{LEATHER_ATELIER.selectProduct('swatch');LEATHER_ATELIER.configure({{craft:'plain'}});LEATHER_ATELIER.selectMaterial('{ident}');LEATHER_ATELIER.setView('home');}}")
   for view in ['front','back','macro']:
    compare_view('wallet-'+view,f"()=>{{LEATHER_ATELIER.selectProduct('wallet');LEATHER_ATELIER.configure({{craft:'plain'}});LEATHER_ATELIER.setView('{view}');}}")
   compare_view('wallet-cut',"()=>{LEATHER_ATELIER.selectProduct('wallet');LEATHER_ATELIER.configure({craft:'plain'});LEATHER_ATELIER.inspectCut();LEATHER_ATELIER.thicknessView(true);}")
   for p in [reference,page]:p.evaluate("()=>{document.querySelector('#grainRelief').value='1.35';document.querySelector('#grainRelief').dispatchEvent(new Event('change'));}")
   compare_view('artist-surface',"()=>{LEATHER_ATELIER.selectProduct('swatch');LEATHER_ATELIER.configure({craft:'plain'});LEATHER_ATELIER.setView('home');}")
   reference.close()
  page.evaluate("()=>{document.querySelector('#restoreSurface').click();LEATHER_ATELIER.selectProduct('wallet');LEATHER_ATELIER.configure({craft:'plain',thicknessScale:1});LEATHER_ATELIER.setView('home');LEATHER_ATELIER.render();}")
  page.wait_for_function('LEATHER_ATELIER.productPhysics.version.startsWith("R09")')
  check('API remains complete after product rebuild',page.evaluate('(names)=>names.every(k=>typeof LEATHER_ATELIER[k]==="function")',required))
  page.evaluate('window.savedPerformance=LEATHER_ATELIER.performance;LEATHER_ATELIER.selectProduct("bag")')
  page.wait_for_function('LEATHER_ATELIER.productPhysics.version.startsWith("R09")')
  check('Previously obtained delegate reads current product not disposed solver',page.evaluate('savedPerformance().nodeCount===LEATHER_ATELIER.productPhysics.nodeCount'))
  page.evaluate("LEATHER_ATELIER.selectProduct('wallet');LEATHER_ATELIER.setView('home');LEATHER_ATELIER.render()")
  page.wait_for_function('LEATHER_ATELIER.productPhysics.version.startsWith("R09")')
  box=page.locator('#stage').bounding_box();x=box['x']+box['width']/2;y=box['y']+box['height']/2
  page.locator('#grabTool').click();page.mouse.move(x,y);page.mouse.down();page.wait_for_function('LEATHER_ATELIER.productPhysics.held')
  start=page.evaluate('LEATHER_ATELIER.productPhysics');page.mouse.move(x+25,y-60,steps=12)
  page.wait_for_function('(a)=>LEATHER_ATELIER.productPhysics.timeS>a.timeS+.08 && LEATHER_ATELIER.productPhysics.centerMM[1]>a.centerMM[1]+1',arg=start,timeout=120000)
  held=page.evaluate('LEATHER_ATELIER.productPhysics');check('Real pointer reaches actual coupled physical lift',held['finite'] and not held['failed'] and held['grabForceN']>0,{'start':start,'held':held})
  shot(page,'live-lift');page.mouse.up();page.wait_for_function('(t)=>!LEATHER_ATELIER.productPhysics.held && LEATHER_ATELIER.productPhysics.timeS>t+.05',arg=held['timeS'],timeout=120000)
  q=page.evaluate('LEATHER_ATELIER.auditContact()');check('Release continues finite-thickness dynamics without contact penetration',q['penetrating']==0,q)
  page.evaluate('LEATHER_ATELIER.resetGrab()');page.locator('#grabTool').click();page.evaluate('LEATHER_ATELIER.setView("home");LEATHER_ATELIER.render()')
  box=page.locator('#stage').bounding_box();page.mouse.move(box['x']+35,box['y']+15);page.mouse.down();page.mouse.move(box['x']-100,box['y']-60,steps=12);page.mouse.up()
  check('Orbit crossing viewport boundary cannot select text',page.evaluate('getSelection().toString()')=='')
  check('Pointer up releases selection guard',page.evaluate("!document.body.classList.contains('leather-dragging')"))
  check('Ordinary sidebar text stays selectable',page.evaluate("getComputedStyle(document.querySelector('.details p')).userSelect")!='none')
  page.evaluate('LEATHER_ATELIER.setView("home");LEATHER_ATELIER.render()');box=page.locator('#stage').bounding_box();page.locator('#grabTool').click();page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2);page.mouse.down();page.wait_for_function('LEATHER_ATELIER.productPhysics.held');page.keyboard.press('Escape');page.wait_for_timeout(100)
  check('Escape releases grab and guard',page.evaluate("!LEATHER_ATELIER.productPhysics.held&&!document.body.classList.contains('leather-dragging')"));page.mouse.up();page.evaluate('LEATHER_ATELIER.resetGrab()');page.locator('#grabTool').click()
  page.evaluate("LEATHER_ATELIER.selectProduct('swatch');LEATHER_ATELIER.configure({craft:'diamond'});LEATHER_ATELIER.setView('home')")
  page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(150)
  check('Mobile viewport fits without horizontal overflow',page.locator('#stage').bounding_box()['width']>200 and page.evaluate('document.documentElement.scrollWidth<=innerWidth+2'))
  shot(page,'mobile');report['requests']=requests
  if not args.public:check('Offline standalone makes no HTTP requests',not requests)
  check('No application or shader errors',not report['errors'],report['errors'])
  report['pass']=True;report['checkCount']=len(report['checks']);report['completedAt']=time.time()
 except Exception as e:report['error']=str(e);report['traceback']=traceback.format_exc();raise
 finally:
  save()
  for c in contexts:c.close()
  browser.close()
print(json.dumps({'pass':report['pass'],'checkCount':len(report['checks'])}))
