from pathlib import Path
import os,json,hashlib,threading,http.server,functools,time,traceback,subprocess
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parent;H=Path(os.environ['GARMENT_HOST']).resolve();Q=R/'qa/native';Q.mkdir(parents=True,exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
a=json.loads((R/'TASK_ANCHOR.json').read_text());source={k:a['source'][k] for k in ['repository','commit']};source.update(path=a['source']['directory']+'/index.html',sha256=sha((H/'index.html').read_bytes()))
files={p.relative_to(H).as_posix():sha(p.read_bytes()) for p in H.rglob('*') if p.is_file()};(Q/'SOURCE_FILES.json').write_text(json.dumps(files,indent=2))
reader=(R/'capture.js').read_text();original=(H/'app.mjs').read_text()
assert sha((H/'app.mjs').read_bytes())=='958ce88eaec470c472204dd4b348d67d94230820b084f668f21799fcbb30f63b','AUDITED_APP_DIGEST_MISMATCH'
point='  newPhysics=new ClothController('
assert original.count(point)==1
prefix="import * as __RF33_GRAIN from './panel-grain.mjs';\nconst __RF33_READER="+reader+';\n'
hook='''  try{const __n={items:next,model,viewer,actor,look:id,request};window.__RF33_PREPARED__=__RF33_READER(__n,__RF33_GRAIN,__RF33_CONTEXT);window.__RF33_REPEAT__=__RF33_READER(__n,__RF33_GRAIN,__RF33_CONTEXT);}catch(__e){window.__RF33_OBSERVER_ERROR__=String(__e.message||__e);}\n'''
augmented=prefix+original.replace(point,hook+point)
assert augmented[len(prefix):].replace(hook,'')==original
contextline='const __RF33_CONTEXT='+json.dumps({'source':source})+';\n'
augmented=contextline+augmented
assert augmented[len(contextline)+len(prefix):].replace(hook,'')==original
report={'source':source,'passed':False,'checks':[],'pageErrors':[],'consoleErrors':[],'failedRequests':[],'userVisualAccepted':False,'physicalDeviceTested':False,'observerHookAddedInMemory':True,'originalFilesChanged':False,'renderingPhysicsCodeChanged':False,'captureCode':{'commit':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'readerSHA256':sha((R/'capture.js').read_bytes()),'runnerSHA256':sha((R/'capture.py').read_bytes())},'hook':{'originalAppSHA256':sha((H/'app.mjs').read_bytes()),'observedAppSHA256':sha(augmented.encode()),'removalRestoresOriginal':True},'setup':'Observer sees original prepared packets before unchanged physics init. Native failure or success is recorded separately; no success stamp or source physics change is introduced.'}
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',8765),functools.partial(Quiet,directory=str(H)));threading.Thread(target=server.serve_forever,daemon=True).start()
def save():(Q/'CAPTURE_REPORT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
def check(name,passed,detail=None):
 if not passed:raise AssertionError(name+': '+str(detail))
 report['checks'].append({'name':name,'passed':True,'detail':detail});print('PASS',name,flush=True);save()
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 context=browser.new_context(viewport={'width':1280,'height':960},device_scale_factor=1)
 page=context.new_page();page.set_default_timeout(90000)
 page.on('pageerror',lambda e:report['pageErrors'].append(str(e)));page.on('console',lambda e:report['consoleErrors'].append(e.text) if e.type=='error' else None)
 page.on('requestfailed',lambda r:report['failedRequests'].append({'url':r.url,'failure':r.failure}))
 page.route('http://127.0.0.1:8765/app.mjs',lambda route:route.fulfill(status=200,content_type='text/javascript',body=augmented))
 try:
  start=time.monotonic();page.goto('http://127.0.0.1:8765/index.html?look=D03',wait_until='domcontentloaded',timeout=120000)
  page.wait_for_function('!!window.__RF33_PREPARED__ || !!window.__RF33_OBSERVER_ERROR__ || document.getElementById("status").classList.contains("error")',timeout=240000)
  reason=page.evaluate('window.__RF33_OBSERVER_ERROR__||null');check('observer completed on actual native prepared rows',page.evaluate('!!window.__RF33_PREPARED__'),reason or page.locator('#status').inner_text())
  report['preparedSeconds']=time.monotonic()-start
  page.wait_for_function('document.getElementById("status").classList.contains("error") || !!document.getElementById("provenance").textContent',timeout=240000)
  outcome=page.evaluate('''()=>({statusText:document.getElementById('status').textContent,error:document.getElementById('status').classList.contains('error'),nativeProvenancePresent:!!document.getElementById('provenance').textContent,committedGarmentCount:__MP05__.debug().items.length,physicsLastError:__MP05__.debug().physics?.lastError||null,observedAt:new Date().toISOString()})''')
  report['sourceOutcome']=outcome;check('original terminal outcome is explicitly retained',bool(outcome['statusText']) and (outcome['error'] or outcome['nativeProvenancePresent']),outcome)
  if not outcome['error']:
   await_pause='async()=>{__MP05__.pause();await __MP05__.debug().physics.idle();return !__MP05__.debug().physics.running;}'
   check('normal native pause used only after successful setup',page.evaluate(await_pause))
  for forbidden in ['.audit(','.render(','.getError(','.step(','.pause(','.postMessage(','.updateMatrix']:
   check('reader excludes '+forbidden,forbidden not in reader)
  value=page.evaluate('''async()=>{const core=await import('./source-contract.mjs'),o=window.__RF33_PREPARED__,r=window.__RF33_REPEAT__;const snapshot=JSON.parse(JSON.stringify(o));for(const p of snapshot.pieces){p.computedMaterialMeshSHA256=await core.materialHash(p.materialMeshHashPayload);delete p.materialMeshHashPayload;p.effectiveMaterialSHA256=await core.sha(core.stable(p.material));}return {snapshot,frozen:Object.isFrozen(o)&&Object.isFrozen(o.pieces[0].panels[0].boundaryMm),repeatProtected:r.preservation.before===r.preservation.after&&r.preservation.before===o.preservation.after};}''')
  observation=value['snapshot'];observation['sourceOutcome']=outcome
  check('output deeply frozen without freezing source',value['frozen']);check('same-task read preservation',observation['preservation']['before']==observation['preservation']['after']);check('repeat read leaves source arrays and freeze flags unchanged',value['repeatProtected'])
  check('actual prepared D03 garment pair',[(p['role'],p['presetId']) for p in observation['pieces']]==[('top','T03'),('bottom','P02')])
  check('actual selected material',all(p['materialID']=='denim-bleach' for p in observation['pieces']))
  check('native material-domain mesh identity verified',all(p['computedMaterialMeshSHA256']==p['binding']['materialSHA256'] for p in observation['pieces']))
  check('actual prepared mesh UV agrees with original map',all(p['maxUVErrorM']<2e-7 for g in observation['pieces'] for p in g['panels']))
  check('captured stage never claims displayed success',observation['capture']['mode']=='native_prephysics_binding_capture' and observation['capture']['frame'] is None)
  (R/'runtime-observation.json').write_text(json.dumps(observation,ensure_ascii=False,indent=2));(Q/'SOURCE_OUTCOME.json').write_text(json.dumps(outcome,ensure_ascii=False,indent=2))
  page.screenshot(path=str(Q/'01-original-D03-outcome.png'),timeout=120000)
  check('no unhandled source page errors',not report['pageErrors'],report['pageErrors']);check('no console errors',not report['consoleErrors'],report['consoleErrors']);check('no failed runtime requests',not report['failedRequests'],report['failedRequests'])
  check('all checked-out source files unchanged',files=={p.relative_to(H).as_posix():sha(p.read_bytes()) for p in H.rglob('*') if p.is_file()})
  report['capturedObject']='D03:T03+P02 prepared bindings, not completed try-on';report['runtimeObservationSHA256']=sha((R/'runtime-observation.json').read_bytes());report['passed']=True
 except Exception as e:
  report['failure']=str(e);report['trace']=traceback.format_exc();print(report['trace'],flush=True)
  try:report['statusText']=page.locator('#status').inner_text();page.screenshot(path=str(Q/'FAILURE.png'),timeout=20000)
  except Exception as x:report['captureFailure']=str(x)
 finally:save();context.close();browser.close();server.shutdown()
if not report['passed']:raise SystemExit(1)
