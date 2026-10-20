from pathlib import Path
from urllib.parse import urlsplit
import os,json,hashlib,gzip,http.server,functools,threading,time,traceback,subprocess
from playwright.sync_api import sync_playwright
from instrument import make_responses,CASES
R=Path(__file__).resolve().parent;H=Path(os.environ['GARMENT_HOST']).resolve();CASE=os.environ['RF35_CASE'];assert CASE in CASES
Q=R/'qa'/CASE;Q.mkdir(parents=True,exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
source=json.loads((R/'TASK_ANCHOR.json').read_text())['source'];inventory={p.relative_to(H).as_posix():sha(p.read_bytes()) for p in H.rglob('*') if p.is_file()}
assert inventory['cloth-kernel.wasm']=='772ffe81b9c49b17e81c99dc0f5323ff2006cf3d46e5532de8bf2ebe631d9416'
responses,proof=make_responses(H,R,CASE)
report={'schema':'kaopu/metric-contact-case@1','case':CASE,'source':source,'checks':[],'passed':False,'initializationAccepted':False,'dynamicFitCertified':False,'productionChanged':False,'patches':proof,'errors':[],'consoleErrors':[],'failedRequests':[],'code':{'commit':subprocess.check_output(['git','-C',str(R),'rev-parse','HEAD'],text=True).strip(),'sha256':{n:sha((R/n).read_bytes()) for n in ['probe.mjs','instrument.py','run_case.py']}}}
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):
  name=urlsplit(self.path).path.lstrip('/')
  if name in responses:
   b=responses[name];self.send_response(200);self.send_header('Content-Type','text/javascript');self.send_header('Content-Length',str(len(b)));self.end_headers();self.wfile.write(b)
  else:super().do_GET()
server=http.server.ThreadingHTTPServer(('127.0.0.1',8765),functools.partial(Handler,directory=str(H)));threading.Thread(target=server.serve_forever,daemon=True).start()
def save():(Q/'REPORT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
def check(name,ok,detail=None):
 if not ok:raise AssertionError(name+': '+str(detail))
 report['checks'].append({'name':name,'passed':True,'detail':detail});print('PASS',name,flush=True);save()
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 context=browser.new_context(viewport={'width':1280,'height':960},device_scale_factor=1);page=context.new_page();page.set_default_timeout(90000)
 page.on('pageerror',lambda e:report['errors'].append(str(e)));page.on('console',lambda e:report['consoleErrors'].append(e.text) if e.type=='error' else None);page.on('requestfailed',lambda r:report['failedRequests'].append({'url':r.url,'reason':r.failure}))
 try:
  started=time.monotonic();page.goto('http://127.0.0.1:8765/index.html?look=D03',wait_until='domcontentloaded',timeout=120000)
  page.wait_for_function('document.getElementById("status").classList.contains("error") || !!document.getElementById("provenance").textContent',polling=1000,timeout=600000)
  data=page.evaluate('()=>({probe:window.__RF35_CAPTURE__||null,base:window.__RF34_CAPTURE__||{},status:document.getElementById("status").textContent,error:document.getElementById("status").classList.contains("error"),committed:__MP05__.debug().items.length})')
  report['runtimeSeconds']=time.monotonic()-started;report['outcome']={k:data[k] for k in ['status','error','committed']};report['probe']=data['probe'];report['initializationAccepted']=not data['error'] and data['committed']==2
  (Q/'raw.json.gz').write_bytes(gzip.compress(json.dumps(data,ensure_ascii=False,separators=(',',':')).encode(),mtime=0));report['rawSHA256']=sha((Q/'raw.json.gz').read_bytes())
  check('native probe returned',data['probe'] is not None);probe=data['probe'];check('no diagnostic errors',not probe['errors'] and not data['base'].get('observerError'),probe['errors'])
  check('guard preserved in native trace',data['base']['trace']['gate']['originalPredicate']=='!Number.isFinite(r.maxEdgeStretch)||r.maxEdgeStretch>1.45')
  check('both source and graded denominators reported',len(probe['metrics'])==2 and probe['initial']['focus']['sourceRestM']>0 and probe['initial']['focus']['targetRestM']>0)
  check('actual mass matches graded area definition',all(abs(m['particleMassKg']-m['densityKgM2']*m['area']['gradedM2'])<1e-10 for m in probe['metrics']))
  check('prediction samples carry finite residuals',probe['predictions'] and all(isinstance(p['maxResidualM'],(int,float)) and p['maxResidualM']<1e100 for p in probe['predictions']))
  report['maximumPredictionEquationResidualM']=max(p['maxResidualM'] for p in probe['predictions'])
  if data['error']:
   check('original rejection and rollback retained','物理应变超出工程安全范围' in data['status'] and probe.get('failure') is not None,data['status'])
   report['rollbackExact']=data['base'].get('entryState')==data['base'].get('rollbackState');check('failure restored checked state',report['rollbackExact'])
  else:
   check('all 48 original fitting steps reached',probe['completedFitting'] and len(probe['gates'])==48)
   page.evaluate('async()=>{__MP05__.pause();await __MP05__.debug().physics.idle();}')
  if CASE=='baseline':
   old=json.loads(gzip.decompress((R.parent/'hc-s3-4/qa/diagnostic/baseline-raw.json.gz').read_bytes()))
   for k in ['initialState','entryState','gateState','rollbackState']:check('baseline matches S3.4 '+k,data['base'][k]==old['capture'][k])
   check('same terminal edge and step',probe['failure']['fitStep']==10 and probe['gates'][-1]['scan'][0]['worstEdge']==3289)
  if CASE in ['previous-only','combined']:
   check('previous-body origin is continuous',max(s['body']['maxPreviousMismatchM'] for s in probe['steps'])<1e-6)
  page.screenshot(path=str(Q/'native-outcome.png'),timeout=120000)
  if report['initializationAccepted']:
   # Only a four-frame smoke check, not a dynamic fit certificate. Preserve real residual/contact outcomes.
   smoke=page.evaluate('''async()=>{const p=__MP05__.debug().physics;try{await p.testSteps(4,'walk');await p.command('audit');return {completed:p.testProgress?.completed||0,lastError:p.lastError,audit:p.frame.audit};}catch(e){return {completed:p.testProgress?.completed||0,error:e.message,lastError:p.lastError,audit:p.frame?.audit||null};}}''');report['walkSmoke']=smoke
   page.screenshot(path=str(Q/'walk-smoke.png'),timeout=120000)
  check('no unhandled errors or failed requests',not report['errors'] and not report['consoleErrors'] and not report['failedRequests'],{'page':report['errors'],'console':report['consoleErrors'],'network':report['failedRequests']})
  check('checked-out source is unchanged',inventory=={p.relative_to(H).as_posix():sha(p.read_bytes()) for p in H.rglob('*') if p.is_file()})
  report['passed']=True
 except Exception as e:
  report['failure']=str(e);report['traceback']=traceback.format_exc();print(report['traceback'],flush=True)
  try:report['lastStatus']=page.locator('#status').inner_text();page.screenshot(path=str(Q/'FAILURE.png'),timeout=30000)
  except Exception as x:report['screenshotFailure']=str(x)
 finally:save();context.close();browser.close();server.shutdown()
if not report['passed']:raise SystemExit(1)
print('CASE_COMPLETE',CASE,'initializationAccepted',report['initializationAccepted'],flush=True)
