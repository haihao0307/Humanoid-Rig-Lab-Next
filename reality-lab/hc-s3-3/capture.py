from pathlib import Path
from urllib.parse import urlsplit
import os,json,hashlib,threading,http.server,functools,time,traceback,subprocess
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parent;H=Path(os.environ['GARMENT_HOST']).resolve();Q=R/'qa/native';Q.mkdir(parents=True,exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
a=json.loads((R/'TASK_ANCHOR.json').read_text());source={k:a['source'][k] for k in ['repository','commit']};source.update(path=a['source']['directory']+'/index.html',sha256=sha((H/'index.html').read_bytes()))
files={p.relative_to(H).as_posix():sha(p.read_bytes()) for p in H.rglob('*') if p.is_file()};(Q/'SOURCE_FILES.json').write_text(json.dumps(files,indent=2))
reader=(R/'capture.js').read_text();original=(H/'app.mjs').read_bytes().decode('utf-8');assert sha(original.encode())=='958ce88eaec470c472204dd4b348d67d94230820b084f668f21799fcbb30f63b'
prefix="import * as __RF33_GRAIN from './panel-grain.mjs';\nconst __RF33_CONTEXT="+json.dumps({'source':source})+";\nconst __RF33_READER="+reader+';\n'
patches=[(" try{const templates=", "window.__RF33_PHASE__='loading-original-templates';"),("const sourceProof=", "window.__RF33_PHASE__='grading-original-templates';"),("  for(let i=0;i<2;i++){const mesh=", "window.__RF33_PHASE__='constructing-original-carriers';"),("  newPhysics=new ClothController(", "window.__RF33_PHASE__='observing-prepared-bindings';try{const __n={items:next,model,viewer,actor,look:id,request};window.__RF33_PREPARED__=__RF33_READER(__n,__RF33_GRAIN,__RF33_CONTEXT);window.__RF33_REPEAT__=__RF33_READER(__n,__RF33_GRAIN,__RF33_CONTEXT);}catch(__e){window.__RF33_OBSERVER_ERROR__=String(__e.stack||__e);}window.__RF33_PHASE__='original-physics-init';")]
modified=original
for needle,addition in patches:
 assert modified.count(needle)==1,needle
 if needle.startswith(' try{'):modified=modified.replace(needle,' try{'+addition+'const templates=')
 else:modified=modified.replace(needle,addition+needle)
restored=modified
for needle,addition in reversed(patches):
 if needle.startswith(' try{'):restored=restored.replace(' try{'+addition+'const templates=',needle)
 else:restored=restored.replace(addition+needle,needle)
assert restored.encode()==(H/'app.mjs').read_bytes()
augmented=(prefix+modified).encode()
report={'source':source,'passed':False,'checks':[],'pageErrors':[],'consoleErrors':[],'failedRequests':[],'phaseLog':[],'physicalDeviceTested':False,'userVisualAccepted':False,'observerHookAddedInMemory':True,'originalFilesChanged':False,'renderingPhysicsCodeChanged':False,'captureCode':{'commit':subprocess.check_output(['git','-C',str(R),'rev-parse','HEAD'],text=True).strip(),'readerSHA256':sha((R/'capture.js').read_bytes()),'runnerSHA256':sha((R/'capture.py').read_bytes())},'hook':{'originalAppSHA256':sha(original.encode()),'observedAppSHA256':sha(augmented),'removalRestoresOriginal':True,'servedDiagnosticResponseOnly':True},'setup':'Read original prepared carriers before original physics. Cache policy and all original functions unchanged. Native terminal failure is separate from observation success.'}
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):
  if urlsplit(self.path).path=='/app.mjs':
   self.send_response(200);self.send_header('Content-Type','text/javascript');self.send_header('Content-Length',str(len(augmented)));self.end_headers();self.wfile.write(augmented)
  else:super().do_GET()
server=http.server.ThreadingHTTPServer(('127.0.0.1',8765),functools.partial(Quiet,directory=str(H)));threading.Thread(target=server.serve_forever,daemon=True).start()
def save():(Q/'CAPTURE_REPORT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
def check(name,ok,detail=None):
 if not ok:raise AssertionError(name+': '+str(detail))
 report['checks'].append({'name':name,'passed':True,'detail':detail});print('PASS',name,flush=True);save()
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 context=browser.new_context(viewport={'width':1280,'height':960},device_scale_factor=1);page=context.new_page();page.set_default_timeout(90000)
 page.on('pageerror',lambda e:report['pageErrors'].append(str(e)));page.on('console',lambda e:report['consoleErrors'].append(e.text) if e.type=='error' else None);page.on('requestfailed',lambda r:report['failedRequests'].append({'url':r.url,'failure':r.failure}))
 try:
  start=time.monotonic();page.goto('http://127.0.0.1:8765/index.html?look=D03',wait_until='domcontentloaded',timeout=120000)
  last=None
  for i in range(240):
   state=page.evaluate('()=>({phase:window.__RF33_PHASE__||null,prepared:!!window.__RF33_PREPARED__,observerError:window.__RF33_OBSERVER_ERROR__||null,status:document.getElementById("status").textContent,error:document.getElementById("status").classList.contains("error")})')
   if state!=last:report['phaseLog'].append({'elapsed':time.monotonic()-start,**state});print('PHASE',json.dumps(state,ensure_ascii=False),flush=True);save();last=state
   if state['prepared'] or state['observerError'] or state['error']:break
   page.wait_for_timeout(2000)
  check('original prepared carriers captured',state['prepared'],state)
  report['preparedSeconds']=time.monotonic()-start
  page.wait_for_function('document.getElementById("status").classList.contains("error") || !!document.getElementById("provenance").textContent',polling=250,timeout=240000)
  outcome=page.evaluate('()=>({statusText:document.getElementById("status").textContent,error:document.getElementById("status").classList.contains("error"),nativeProvenancePresent:!!document.getElementById("provenance").textContent,committedGarmentCount:__MP05__.debug().items.length,physicsLastError:__MP05__.debug().physics?.lastError||null,observedAt:new Date().toISOString()})');report['sourceOutcome']=outcome
  check('source terminal result retained',bool(outcome['statusText']),outcome)
  if not outcome['error']:page.evaluate('async()=>{__MP05__.pause();await __MP05__.debug().physics.idle();}')
  for forbidden in ['.audit(','.render(','.getError(','.step(','.pause(','.postMessage(','.updateMatrix']:check('reader excludes '+forbidden,forbidden not in reader)
  result=page.evaluate('''async()=>{const core=await import('./source-contract.mjs'),o=window.__RF33_PREPARED__,r=window.__RF33_REPEAT__;const snapshot=JSON.parse(JSON.stringify(o));for(const p of snapshot.pieces){p.computedMaterialMeshSHA256=await core.materialHash(p.materialMeshHashPayload);delete p.materialMeshHashPayload;p.effectiveMaterialSHA256=await core.sha(core.stable(p.material));}return {snapshot,frozen:Object.isFrozen(o)&&Object.isFrozen(o.pieces[0].panels[0].boundaryMm),repeatProtected:r.preservation.before===r.preservation.after&&r.preservation.before===o.preservation.after};}''')
  x=result['snapshot'];x['sourceOutcome']=outcome
  check('deeply frozen copied output',result['frozen']);check('read preserved source',x['preservation']['before']==x['preservation']['after']);check('repeat read preserved arrays and freeze flags',result['repeatProtected'])
  check('original D03 pair',[(p['role'],p['presetId']) for p in x['pieces']]==[('top','T03'),('bottom','P02')]);check('original selected fabric',all(p['materialID']=='denim-bleach' for p in x['pieces']))
  check('material-domain mesh identities',all(p['computedMaterialMeshSHA256']==p['binding']['materialSHA256'] for p in x['pieces']));check('all prepared panel UV values',all(p['maxUVErrorM']<2e-7 for g in x['pieces'] for p in g['panels']))
  check('pre-physics stage not fake displayed frame',x['capture']['mode']=='native_prephysics_binding_capture' and x['capture']['frame'] is None)
  (R/'runtime-observation.json').write_text(json.dumps(x,ensure_ascii=False,indent=2));(Q/'SOURCE_OUTCOME.json').write_text(json.dumps(outcome,ensure_ascii=False,indent=2));page.screenshot(path=str(Q/'01-original-D03-outcome.png'),timeout=120000)
  check('no unhandled page errors',not report['pageErrors'],report['pageErrors']);check('no console errors',not report['consoleErrors'],report['consoleErrors']);check('no failed requests',not report['failedRequests'],report['failedRequests']);check('source files unchanged',files=={p.relative_to(H).as_posix():sha(p.read_bytes()) for p in H.rglob('*') if p.is_file()})
  report['runtimeObservationSHA256']=sha((R/'runtime-observation.json').read_bytes());report['passed']=True
 except Exception as e:
  report['failure']=str(e);report['trace']=traceback.format_exc();print(report['trace'],flush=True)
  try:report['statusText']=page.locator('#status').inner_text();page.screenshot(path=str(Q/'FAILURE.png'),timeout=20000)
  except Exception as e2:report['captureFailure']=str(e2)
 finally:save();context.close();browser.close();server.shutdown()
if not report['passed']:raise SystemExit(1)
