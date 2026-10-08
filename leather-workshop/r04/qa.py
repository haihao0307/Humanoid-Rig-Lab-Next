from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image,ImageChops,ImageStat
import io,json,sys,os,time
root=Path(__file__).resolve().parent;q=root/'qa';q.mkdir(exist_ok=True)
url=sys.argv[1] if len(sys.argv)>1 else (root/'preview.html').as_uri();public=url.startswith('https://');prefix='public' if public else 'local';checks=[];errors=[];requests=[]
report={'url':url,'version':'R04.0','public':public,'realMobileDevice':False,'experimentalCalibration':False,'tests':checks}
def ck(name,yes,**details):
 checks.append({'name':name,'pass':bool(yes),**details})
 if not yes:raise AssertionError(name)
def diff(a,b):return sum(ImageStat.Stat(ImageChops.difference(Image.open(io.BytesIO(a)).convert('RGB'),Image.open(io.BytesIO(b)).convert('RGB'))).mean)/3
try:
 with sync_playwright() as p:
  kw={'headless':True,'args':['--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-dev-shm-usage']}
  if os.environ.get('CHROMIUM_EXECUTABLE'):kw['executable_path']=os.environ['CHROMIUM_EXECUTABLE']
  b=p.chromium.launch(**kw);page=b.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1);page.set_default_timeout(90000)
  page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None);page.on('request',lambda r:requests.append(r.url))
  page.goto(url,wait_until='domcontentloaded',timeout=90000);page.wait_for_function('window.LEATHER_DYNAMICS?.ready');page.wait_for_timeout(250)
  ck('R04 worker and 3D startup',page.evaluate('LEATHER_DYNAMICS.version')=='R04.0' and not errors)
  canvas=page.locator('#view');before=canvas.screenshot();ck('canvas not blank',max(ImageStat.Stat(Image.open(io.BytesIO(before))).stddev)>10);page.screenshot(path=str(q/(prefix+'-initial.png')))
  page.evaluate('LEATHER_DYNAMICS.advance(.75)');empty=page.evaluate('LEATHER_DYNAMICS.state.report');page.wait_for_timeout(80);page.screenshot(path=str(q/(prefix+'-gravity.png')))
  ck('gravity settles without fabric runaway',0<empty['centerSagMM']<10 and empty['maxStretch']<1.02,report=empty)
  page.click('#drop');page.wait_for_function('LEATHER_DYNAMICS.state.report.stoneActive');page.evaluate('LEATHER_DYNAMICS.pause()');page.evaluate('LEATHER_DYNAMICS.advance(.18)');impact=page.evaluate('LEATHER_DYNAMICS.state.report');page.wait_for_timeout(80);page.screenshot(path=str(q/(prefix+'-impact.png')))
  ck('stone and sheet coupled, no tunneling in impact',impact['stoneActive'] and impact['penetrationMM']<.03 and not impact['failed'],report=impact)
  page.evaluate('LEATHER_DYNAMICS.advance(1.6)');loaded=page.evaluate('LEATHER_DYNAMICS.state.report');page.wait_for_timeout(80);page.screenshot(path=str(q/(prefix+'-loaded.png')))
  ck('stone carries weight rather than disappearing or freezing',loaded['timeS']>2 and loaded['stoneActive'] and loaded['centerSagMM']>empty['centerSagMM']+.5 and loaded['maxStretch']<1.05,report=loaded)
  ck('physical surface changes actual pixels',diff(before,canvas.screenshot())>.05)
  page.click('#side');page.wait_for_timeout(120);page.screenshot(path=str(q/(prefix+'-side-contact.png')))
  page.click('#remove');page.wait_for_function('!LEATHER_DYNAMICS.state.report.stoneVisible');page.evaluate('LEATHER_DYNAMICS.pause()');page.evaluate('LEATHER_DYNAMICS.advance(1.25)');restored=page.evaluate('LEATHER_DYNAMICS.state.report');page.wait_for_timeout(80);page.screenshot(path=str(q/(prefix+'-removed-recovered.png')))
  ck('after removal continues to recover, not a frozen end frame',not restored['stoneVisible'] and abs(restored['centerSagMM']-empty['centerSagMM'])<.5 and restored['timeS']>loaded['timeS']+1,report=restored)
  page.click('#modeClamp');page.wait_for_function('LEATHER_DYNAMICS.state?.mode==="clamp"');page.evaluate('LEATHER_DYNAMICS.pull(.08)');pull=page.evaluate('LEATHER_DYNAMICS.state.report');page.wait_for_timeout(120);page.screenshot(path=str(q/(prefix+'-clamps-loaded.png')))
  ck('visible clamps driven by converged nonlinear membrane',pull['converged'] and pull['forceN']>100 and abs(pull['clampPullMM']-19.2)<1e-8,report=pull)
  page.click('#release');page.wait_for_function('LEATHER_DYNAMICS.state.report.nominalStrain===0 && LEATHER_DYNAMICS.state.report.converged');unload=page.evaluate('LEATHER_DYNAMICS.state.report');ck('clamp unload restores elastic state',abs(unload['forceN'])<.001 and unload['energyNmm']<1e-6,report=unload)
  before=page.evaluate('JSON.stringify(LEATHER_DYNAMICS.state.report)');page.select_option('#look','black');page.wait_for_timeout(200);ck('appearance change does not change mechanics',page.evaluate('JSON.stringify(LEATHER_DYNAMICS.state.report)')==before)
  with page.expect_download() as dl:page.click('#export')
  dl.value.save_as(str(q/(prefix+'-export.json')));export=json.loads((q/(prefix+'-export.json')).read_text());ck('real export carries solved state and history',bool(export.get('positionsM')) and bool(export.get('history')) and export.get('physicalTime') is False)
  page.click('#tabLegacy');page.wait_for_function('document.querySelector("#legacy").contentWindow.LEATHER_PHYSICS?.ready');ck('original R03.1 retained byte-preserved',page.evaluate('document.querySelector("#legacy").contentWindow.LEATHER_PHYSICS.version')=='R03.1');page.click('#useLegacy');page.wait_for_timeout(150);ck('legacy material bridge returns to live pane',page.locator('#live').is_visible())
  page.click('#tabSource');ck('source and limitations visible',page.locator('#source').is_visible());page.click('#tabLive');ck('no error through full lifecycle',not errors,errors=errors)
  if not public:
   ck('offline core performs zero HTTP requests',not any(u.startswith(('http:','https:')) for u in requests))
   mobile=b.new_page(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True);mobile.on('pageerror',lambda e:errors.append('mobile '+str(e)));mobile.goto(url);mobile.wait_for_function('window.LEATHER_DYNAMICS?.ready',timeout=90000);mobile.wait_for_timeout(200);mobile.screenshot(path=str(q/'mobile-390x844.png'));ck('mobile viewport width fits',mobile.evaluate('document.documentElement.scrollWidth')<=390);mobile.click('#modeClamp');mobile.wait_for_function('LEATHER_DYNAMICS.state?.mode==="clamp"');mobile.screenshot(path=str(q/'mobile-clamp.png'));mobile.close()
  ck('all tested contexts error-free',not errors);report.update({'pass':True,'errors':errors,'requests':requests});b.close()
except Exception as e:
 report.update({'pass':False,'failure':str(e),'errors':errors})
 try:page.screenshot(path=str(q/(prefix+'-failure.png')))
 except Exception:pass
 raise
finally:
 (q/(prefix+'-browser.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False))
