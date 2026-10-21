from pathlib import Path
from urllib.parse import urlsplit
import os,json,hashlib,threading,http.server,functools,subprocess,time,traceback
from playwright.sync_api import sync_playwright
from instrument import assemble,DIGESTS
R=Path(__file__).resolve().parent;H=Path(os.environ['GARMENT_HOST']).resolve();MODE=os.environ.get('FIT_CASE','progressive');Q=R/'qa'/MODE;Q.mkdir(parents=True,exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
responses,assembly=assemble(H,MODE,(R/'fitting-transaction.mjs').read_bytes());(Q/'ASSEMBLY.json').write_text(json.dumps(assembly,indent=2))
report={'version':'REALITY-HC-S3.6','case':MODE,'passed':False,'checks':[],'errors':[],'consoleErrors':[],'failedRequests':[],'codeCommit':subprocess.check_output(['git','-C',str(R),'rev-parse','HEAD'],text=True).strip(),'assembly':assembly,'productionChanged':False,'fitCertified':False,'physicalDeviceTested':False}
class Server(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
 def do_GET(self):
  name=urlsplit(self.path).path.lstrip('/')
  if name in responses:
   b=responses[name];self.send_response(200);self.send_header('Content-Type','text/javascript');self.send_header('Content-Length',str(len(b)));self.end_headers();self.wfile.write(b)
  else:super().do_GET()
server=http.server.ThreadingHTTPServer(('127.0.0.1',8765),functools.partial(Server,directory=str(H)));threading.Thread(target=server.serve_forever,daemon=True).start()
def save():(Q/'REPORT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
def check(name,ok=True,detail=None):
 if not ok:raise AssertionError(name+': '+str(detail))
 report['checks'].append({'name':name,'passed':True,'detail':detail});print('PASS',name,flush=True);save()
script="""(()=>{const Base=Worker;window.__RF36={messages:[],reports:[],workerCount:0};window.Worker=class extends Base{constructor(...args){super(...args);__RF36.workerCount++;this.addEventListener('message',e=>{const d=e.data;if(!d?.rf36)return;__RF36.messages.push(d);if(d.kind==='report')__RF36.reports.push(d.report);if(d.kind==='step'&&CASE==='cancel'){if(d.step.step===2)this.postMessage({command:'cancel-fit',requestId:d.requestId,generation:d.generation+100});if(d.step.step===3)this.postMessage({command:'cancel-fit',requestId:d.requestId,generation:d.generation});}});}};})()""".replace('CASE',json.dumps(MODE))
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 ctx=browser.new_context(viewport={'width':1280,'height':960},device_scale_factor=1);ctx.add_init_script(script);page=ctx.new_page();page.set_default_timeout(60000)
 page.on('pageerror',lambda e:report['errors'].append(str(e)));page.on('console',lambda e:report['consoleErrors'].append(e.text) if e.type=='error' else None);page.on('requestfailed',lambda r:report['failedRequests'].append({'url':r.url,'failure':r.failure}))
 try:
  start=time.monotonic();page.goto('http://127.0.0.1:8765/index.html?look=D03',wait_until='domcontentloaded',timeout=120000)
  page.wait_for_function('window.__RF36?.reports.length>0',polling=500,timeout=420000)
  result=page.evaluate('__RF36.reports[0]');report['result']=result;report['messages']=page.evaluate('__RF36.messages');report['elapsedSeconds']=time.monotonic()-start
  check('native transaction outcome received',result['status'] in ['COMMITTED','FAILED_ROLLED_BACK','CANCELLED','NATIVE_FAILED'])
  check('only reviewed worker and additive module served',assembly['reverseExact'] and not assembly['protectedKernelChanged'])
  if MODE=='baseline':
   check('same unmodified original failure step',result['status']=='NATIVE_FAILED' and result['failedStep']==11,result)
   check('original protection still rejects', '物理应变超出工程安全范围' in result['failure']['message'])
  else:
   check('original 1.45 gate and timestep retained',result['originalGate']==1.45 and result['dt']==1/60)
   check('actual body previous consistently advanced',all(s['bodyPreviousErrorM']==0 for s in result['steps']))
   check('JS and WASM rest arrays agree',all(s['jsWasmMetricErrorM']==0 for s in result['steps']))
   check('gradual schedule follows original GPU intention',all(s['fraction']==min(s['step']/32,1) for s in result['steps']))
   check('only original accepted steps retained',all(max(s['maxActiveRatios'])<=1.45 for s in result['steps']))
   if result['status']=='COMMITTED':
    check('complete 48 steps before single revision commit',len(result['steps'])==48 and result['committedRuntimeRevision']==1)
    check('final actual metrics and body reached target',result['independentChecks']['finalMetricsMatchTarget'] and result['independentChecks']['bodyFinalErrorM']==0)
    page.wait_for_function('window.__MP05__?.debug().items.length===2 && !!__MP05__.debug().physics.frame',polling=500,timeout=150000)
    page.evaluate('async()=>{__MP05__.pause();await __MP05__.debug().physics.idle();}')
    report['presentedGarments']=page.evaluate('__MP05__.debug().items.length')
    check('original page submits actual top and bottom',report['presentedGarments']==2)
   else:
    check('all declared arrays and scalars restored',result['rollback']['exact'] and result['rollback']['changedPaths']==[])
    check('independent SHA256 state restoration',result['independentRollback']['equal'])
    check('no new revision after abort',result['committedRuntimeRevision']==0 and result['rollback']['stateRevisionRestored'])
   if MODE=='cancel':
    acks=[x for x in report['messages'] if x['kind']=='cancel-ack'];check('stale generation cancellation rejected',any(not a['accepted'] for a in acks));check('matching cancellation accepted',any(a['accepted'] for a in acks));check('real message abort rolls back',result['status']=='CANCELLED')
   if MODE=='fault':check('injected error after real step rolls back',result['status']=='FAILED_ROLLED_BACK' and result['failure']['code']=='INJECTED_TEST_FAILURE' and result['attemptedStep']==3)
  report['sourceStatus']=page.locator('#status').inner_text();page.screenshot(path=str(Q/'native-outcome.png'),timeout=90000)
  check('no unhandled page errors',not report['errors'],report['errors']);check('no console errors',not report['consoleErrors'],report['consoleErrors']);check('no failed resource requests',not report['failedRequests'],report['failedRequests'])
  check('all protected checked-out source files unchanged',all(sha((H/n).read_bytes())==h for n,h in DIGESTS.items()))
  report['passed']=True
 except Exception as e:
  report['failure']=str(e);report['trace']=traceback.format_exc();print(report['trace'],flush=True)
  try:report['sourceStatus']=page.locator('#status').inner_text();page.screenshot(path=str(Q/'FAILURE.png'),timeout=30000)
  except Exception as x:report['captureFailure']=str(x)
 finally:save();ctx.close();browser.close();server.shutdown()
if not report['passed']:raise SystemExit(1)
