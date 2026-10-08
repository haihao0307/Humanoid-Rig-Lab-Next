from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image,ImageChops,ImageStat
import json,sys,io,time
r=Path(__file__).resolve().parent;q=r/'qa';q.mkdir(exist_ok=True)
url=sys.argv[1] if len(sys.argv)>1 else (r/'preview.html').as_uri();public=url.startswith('https:');name='public' if public else 'local';report={'url':url,'public':public,'version':'R03.1','realMobileDevice':False,'experimentalCalibration':False,'tests':[]};errors=[];requests=[]
def check(name,yes,**kw):
 report['tests'].append({'name':name,'pass':bool(yes),**kw})
 if not yes:raise AssertionError(name)
def delta(a,b):
 return sum(ImageStat.Stat(ImageChops.difference(Image.open(io.BytesIO(a)).convert('RGB'),Image.open(io.BytesIO(b)).convert('RGB'))).mean)/3
def settle(page):page.wait_for_function('LEATHER_PHYSICS.solver.report().converged',timeout=60000)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-dev-shm-usage'])
 page=b.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1,accept_downloads=True)
 page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None);page.on('request',lambda x:requests.append(x.url))
 try:
  page.goto(url,wait_until='load',timeout=60000);page.wait_for_function('window.LEATHER_PHYSICS?.ready',timeout=60000);settle(page)
  check('current graphics and version',page.evaluate('LEATHER_PHYSICS.graphicsReady && LEATHER_PHYSICS.version==="R03.1"'))
  canvas=page.locator('#view');before=canvas.screenshot();check('nonblank rendered frame',max(ImageStat.Stat(Image.open(io.BytesIO(before))).stddev)>8);page.screenshot(path=str(q/(name+'-desktop.png')))
  page.click('#near');page.wait_for_timeout(150);check('macro changes rendered pixels',delta(before,canvas.screenshot())>1);page.screenshot(path=str(q/(name+'-macro.png')));page.click('#home')
  before=canvas.screenshot();f0=page.evaluate('LEATHER_PHYSICS.solver.report().forceN');page.click('#increment');settle(page);f1=page.evaluate('LEATHER_PHYSICS.solver.report().forceN');check('stretch increases solved force',f1>f0,initialN=f0,stretchedN=f1);check('solver changes visible surface',delta(before,canvas.screenshot())>.1)
  page.select_option('#specimen','hole');settle(page);check('actual perforated FE mesh',page.evaluate('LEATHER_PHYSICS.result().mesh.hole'));page.click('#stress');page.click('#wire');page.wait_for_timeout(150);page.screenshot(path=str(q/(name+'-hole-stress.png')));page.click('#wire');page.click('#stress');page.screenshot(path=str(q/(name+'-hole-leather.png')))
  page.click('#release');settle(page);check('unloaded elastic equilibrium',abs(page.evaluate('LEATHER_PHYSICS.solver.report().forceN'))<.0001)
  if not public:
   page.select_option('#specimen','strip');page.select_option('#profile','AL');page.evaluate('LEATHER_PHYSICS.setStrain(.20)');settle(page);a=page.evaluate('LEATHER_PHYSICS.solver.report().forceN');page.click('[data-angle="90"]');settle(page);c=page.evaluate('LEATHER_PHYSICS.solver.report().forceN');check('different leather cutting direction affects force',a>c*1.2,N0=a,N90=c)
   page.select_option('#profile','NL');page.click('[data-angle="0"]');settle(page)
   page.click('[data-mode="hold"]');s0=page.evaluate('LEATHER_PHYSICS.probe.stress');page.evaluate('LEATHER_PHYSICS.tickTime(120,.5)');s1=page.evaluate('LEATHER_PHYSICS.probe.stress');check('history gives stress relaxation at fixed strain',s1<s0,initialMPa=s0,at60sMPa=s1);page.screenshot(path=str(q/'local-relaxation.png'))
   page.click('#resetTime');t0=page.evaluate('LEATHER_PHYSICS.probe.time');page.click('#runTime');page.wait_for_timeout(1300);page.click('#runTime');elapsed=page.evaluate('LEATHER_PHYSICS.probe.time')-t0;check('one-times simulation clock is bounded',.4<elapsed<2.2,simulationElapsedS=elapsed)
   page.click('[data-mode="creep"]');e0=page.evaluate('LEATHER_PHYSICS.probe.strain');page.evaluate('LEATHER_PHYSICS.tickTime(40,.5)');e1=page.evaluate('LEATHER_PHYSICS.probe.strain');check('constant load gives creep',e1>e0);page.click('#unload');page.click('#runTime');page.evaluate('LEATHER_PHYSICS.tickTime(60,.5)');e2=page.evaluate('LEATHER_PHYSICS.probe.strain');check('unload gives time-dependent recovery',e2<e1);page.screenshot(path=str(q/'local-recovery.png'))
   with page.expect_download() as dl:page.click('#exportResult')
   out=q/'exported-result.json';dl.value.save_as(out);obj=json.loads(out.read_text());check('actual history and limitations in exported results',len(obj['trace'])>30 and obj['experimentalValidation'] is False)
  page.click('[data-mode="fem"]');settle(page);force=page.evaluate('LEATHER_PHYSICS.solver.report().forceN');rev=page.evaluate('LEATHER_PHYSICS.lookRevision');page.click('#tabLegacy');page.wait_for_function('document.querySelector("#legacy").contentWindow.LEATHER_LAB?.ready',timeout=60000);check('R02 original runtime retained',page.evaluate('document.querySelector("#legacy").contentWindow.LEATHER_LAB.version')=='R02.0')
  gen=page.evaluate('document.querySelector("#legacy").contentWindow.LEATHER_LAB.generation');page.evaluate('document.querySelector("#legacy").contentWindow.LEATHER_LAB.setPreset("black")');page.wait_for_function('(g)=>document.querySelector("#legacy").contentWindow.LEATHER_LAB.generation>g',arg=gen,timeout=60000);page.screenshot(path=str(q/(name+'-preserved-r02.png')));page.click('#useLook');page.wait_for_timeout(250);check('live R02 material transferred to physics',page.evaluate('LEATHER_PHYSICS.result().visualMaterial.preset')=='black' and page.evaluate('LEATHER_PHYSICS.lookRevision')>rev);check('appearance transfer preserves mechanics',abs(page.evaluate('LEATHER_PHYSICS.solver.report().forceN')-force)<1e-8);page.screenshot(path=str(q/(name+'-r02-material-bridge.png')))
  page.click('#tabSource');check('source limitations visible',page.locator('#sourcePane').is_visible());check('no tested console errors',not errors,errors=errors)
  if not public:
   check('offline core zero network',not any(u.startswith(('http:','https:')) for u in requests))
   mobile=b.new_page(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True);mobile.on('pageerror',lambda e:errors.append('mobile '+str(e)));mobile.goto(url,wait_until='load');mobile.wait_for_function('window.LEATHER_PHYSICS?.graphicsReady',timeout=60000);settle(mobile);mobile.screenshot(path=str(q/'mobile-390x844.png'));check('mobile viewport width fits',mobile.evaluate('document.documentElement.scrollWidth<=innerWidth+2'));check('mobile errors zero',not errors);mobile.close()
  report.update({'pass':True,'errors':errors,'requests':requests})
 except Exception as e:
  report.update({'pass':False,'errors':errors,'failure':str(e)});page.screenshot(path=str(q/(name+'-failure.png')));raise
 finally:
  (q/('browser-'+name+'.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False));b.close()
