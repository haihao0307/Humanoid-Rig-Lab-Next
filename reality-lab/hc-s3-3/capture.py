from pathlib import Path
import os,json,hashlib,threading,http.server,functools,time,traceback
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parent
H=Path(os.environ['GARMENT_HOST']).resolve()
Q=R/'qa/native';Q.mkdir(parents=True,exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
a=json.loads((R/'TASK_ANCHOR.json').read_text());source={k:a['source'][k] for k in ['repository','commit']};source.update(path=a['source']['directory']+'/index.html',sha256=sha((H/'index.html').read_bytes()))
files={p.relative_to(H).as_posix():sha(p.read_bytes()) for p in H.rglob('*') if p.is_file()}
(Q/'SOURCE_FILES.json').write_text(json.dumps(files,indent=2))
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',8765),functools.partial(Quiet,directory=str(H)))
threading.Thread(target=server.serve_forever,daemon=True).start()
report={'source':source,'passed':False,'checks':[],'pageErrors':[],'consoleErrors':[],'failedRequests':[],'userVisualAccepted':False,'physicalDeviceTested':False,'setup':'Original D03 loads unchanged; test then uses native pause before synchronous observation. Reader itself never pauses or steps.'}
def save():(Q/'CAPTURE_REPORT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
def check(name,passed,detail=None):
 if not passed:raise AssertionError(name+': '+str(detail))
 report['checks'].append({'name':name,'passed':True,'detail':detail});print('PASS',name,flush=True);save()
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 context=browser.new_context(viewport={'width':1280,'height':960},device_scale_factor=1)
 page=context.new_page();page.set_default_timeout(90000)
 page.on('pageerror',lambda e:report['pageErrors'].append(str(e)))
 page.on('console',lambda e:report['consoleErrors'].append(e.text) if e.type=='error' else None)
 page.on('requestfailed',lambda r:report['failedRequests'].append({'url':r.url,'failure':r.failure}))
 try:
  start=time.monotonic();page.goto('http://127.0.0.1:8765/index.html?look=D03',wait_until='domcontentloaded',timeout=120000)
  page.wait_for_function('window.__MP05__?.debug().items.length===2 && !!__MP05__.debug().physics?.frame && !!document.getElementById("provenance").textContent',timeout=600000)
  report['startupSeconds']=time.monotonic()-start
  check('original D03 loaded',page.locator('#look-id').inner_text()=='D03')
  await_pause='async()=>{__MP05__.pause();await __MP05__.debug().physics.idle();return !__MP05__.debug().physics.running;}'
  check('native pause setup complete',page.evaluate(await_pause))
  reader=(R/'capture.js').read_text()
  for forbidden in ['.audit(','.render(','.getError(','.step(','.pause(','.postMessage(','.updateMatrix']:
   check('reader excludes '+forbidden,forbidden not in reader)
  value=page.evaluate('''async args=>{const grain=await import('./panel-grain.mjs'),core=await import('./source-contract.mjs');const read=(0,eval)(args.reader);const native=__MP05__.debug();const capture=read(native,grain,args.context);const frozen=Object.isFrozen(capture)&&Object.isFrozen(capture.pieces[0].panels);const snapshot=JSON.parse(JSON.stringify(capture));for(const p of snapshot.pieces){p.computedMaterialMeshSHA256=await core.materialHash(p.materialMeshHashPayload);delete p.materialMeshHashPayload;p.effectiveMaterialSHA256=await core.sha(core.stable(p.material));}return {snapshot,frozen,provenance:JSON.parse(document.getElementById('provenance').textContent)};}''',{'reader':reader,'context':{'source':source}})
  observation=value['snapshot'];check('frozen read-only result',value['frozen']);check('same-task preservation',observation['preservation']['before']==observation['preservation']['after'])
  check('actual garment pair',[(p['role'],p['presetId']) for p in observation['pieces']]==[('top','T03'),('bottom','P02')])
  check('actual material selected',all(p['materialID']=='denim-bleach' for p in observation['pieces']))
  check('native source material-mesh identities verified',all(p['computedMaterialMeshSHA256']==p['binding']['materialSHA256'] for p in observation['pieces']))
  check('actual UV agrees with source mapPanelUV',all(p['maxUVErrorM']<2e-7 for g in observation['pieces'] for p in g['panels']))
  check('native provenance person equals observation',value['provenance']['person']==observation['person']['identity'])
  (R/'runtime-observation.json').write_text(json.dumps(observation,ensure_ascii=False,indent=2));(Q/'NATIVE_PROVENANCE.json').write_text(json.dumps(value['provenance'],ensure_ascii=False,indent=2))
  page.screenshot(path=str(Q/'01-original-D03.png'),timeout=120000)
  # Repeated read must not alter the existing rendered buffers or original geometry.
  first=page.locator('#canvas').screenshot(timeout=120000)
  second=page.evaluate('''args=>{const read=(0,eval)(args.reader);return import('./panel-grain.mjs').then(grain=>{const x=read(__MP05__.debug(),grain,args.context);return x.preservation;});}''',{'reader':reader,'context':{'source':source}})
  last=page.locator('#canvas').screenshot(timeout=120000)
  check('repeat reader preserves actual canvas',sha(first)==sha(last),{'before':sha(first),'after':sha(last)})
  (Q/'native-canvas.png').write_bytes(last)
  check('repeat reader preserves checked state',second['before']==second['after'])
  check('no unhandled source page errors',not report['pageErrors'],report['pageErrors'])
  check('no failed runtime requests',not report['failedRequests'],report['failedRequests'])
  check('source files unchanged',files=={p.relative_to(H).as_posix():sha(p.read_bytes()) for p in H.rglob('*') if p.is_file()})
  report['capturedObject']='D03:T03+P02';report['runtimeObservationSHA256']=sha((R/'runtime-observation.json').read_bytes());report['passed']=True
 except Exception as e:
  report['failure']=str(e);report['trace']=traceback.format_exc();print(report['trace'],flush=True)
  try:report['statusText']=page.locator('#status').inner_text();page.screenshot(path=str(Q/'FAILURE.png'),timeout=20000)
  except Exception as x:report['captureFailure']=str(x)
 finally:save();context.close();browser.close();server.shutdown()
if not report['passed']:raise SystemExit(1)
