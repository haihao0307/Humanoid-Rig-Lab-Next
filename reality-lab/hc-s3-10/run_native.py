from pathlib import Path
from urllib.parse import urlsplit
import os,json,hashlib,http.server,threading,functools,time,subprocess,traceback
from playwright.sync_api import sync_playwright
from instrument import assemble
R=Path(__file__).resolve().parent;H=Path(os.environ['GARMENT_HOST']).resolve();Q=R/'qa/native';Q.mkdir(parents=True,exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest();responses,assembly=assemble(H)
before={n:sha((H/n).read_bytes()) for n in assembly['sourceFiles']}
class Server(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
 def do_GET(self):
  n=urlsplit(self.path).path.lstrip('/')
  if n in responses:
   b=responses[n];self.send_response(200);self.send_header('Content-Type','text/javascript');self.send_header('Content-Length',str(len(b)));self.end_headers();self.wfile.write(b)
  else:super().do_GET()
server=http.server.ThreadingHTTPServer(('127.0.0.1',8765),functools.partial(Server,directory=str(H)));threading.Thread(target=server.serve_forever,daemon=True).start()
CODE=subprocess.check_output(['git','-C',str(R),'rev-parse','HEAD'],text=True).strip()
report={'codeCommit':CODE,'assembly':assembly,'passed':False,'checks':[],'pageErrors':[],'consoleErrors':[],'failedRequests':[],'workflowRun':os.environ.get('GITHUB_RUN_ID'),'sourceArithmeticChanged':False,'performanceComparison':False,'productionChanged':False,'fitCertified':False}
def save():(Q/'REPORT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
def check(n,ok,d=None):
 if not ok:raise AssertionError(n+': '+str(d))
 report['checks'].append({'name':n,'passed':True,'detail':d});print('PASS',n,flush=True);save()
script="(()=>{const W=Worker;window.__RF310_RUN={result:null,fit:null,errors:[]};window.Worker=class extends W{constructor(...a){super(...a);this.addEventListener('message',e=>{const d=e.data;if(d?.rf39&&d.kind==='complete')__RF310_RUN.result=d.result;if(d?.rf36&&d.kind==='report')__RF310_RUN.fit=d.report;if(d?.error)__RF310_RUN.errors.push(d);});}};})()"
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']);ctx=browser.new_context(viewport={'width':1280,'height':960});ctx.add_init_script(script);page=ctx.new_page()
  page.on('pageerror',lambda e:report['pageErrors'].append(str(e)));page.on('console',lambda e:report['consoleErrors'].append(e.text) if e.type=='error' else None);page.on('requestfailed',lambda r:report['failedRequests'].append({'url':r.url,'failure':r.failure}))
  try:
   started=time.monotonic();page.goto('http://127.0.0.1:8765/index.html?look=D03',wait_until='domcontentloaded',timeout=120000);page.wait_for_function('__RF310_RUN.result || __RF310_RUN.errors.length',polling=500,timeout=720000)
   raw=page.evaluate('__RF310_RUN');check('native traced run returned',raw['result'] is not None,raw['errors']);x=raw['result'];trace=x.pop('contactTrace');old=json.loads((R.parent/'hc-s3-9/qa/native/coverage-walk/ENDURANCE.json').read_text())
   report['elapsedSeconds']=time.monotonic()-started
   check('original progressive48 fitting committed',raw['fit']['status']=='COMMITTED' and raw['fit']['committedSteps']==48)
   check('all original180 steps completed',x['completedSteps']==old['completedSteps']==180 and x['failure'] is None)
   check('same actual gait duration',x['walkingClip']==old['walkingClip'])
   checks=[]
   for a,b in zip(old['checkpoints'],x['checkpoints']):checks.append({'stage':a['stage'],'step':a['step'],'identical':all(a[k]==b[k] for k in ['stage','step','stateSHA256','body','pair'])})
   check('all40 original checkpoints exactly preserved',len(checks)==len(old['checkpoints'])==len(x['checkpoints'])==40 and all(c['identical'] for c in checks),checks)
   check('original final state identical',x['finalState']==old['finalState'])
   stable=['accepted','motionTime','frame'];check('every step and fine contact count preserved',all(all(a[k]==b[k] for k in stable) and all(a['lower'][k]==b['lower'][k] for k in ['passes','queries','contacts','guidedCrotchContacts','maxCorrectionMM','maxFineOffsetMM']) for a,b in zip(old['frames'],x['frames'])))
   check('all six target steps traced',[s['step'] for s in trace['steps']]==list(range(25,31)))
   check('target covered, not the previous omission',all(trace['rows'][s['firstRow']]['vertexCovered'] and len(trace['rows'][s['firstRow']]['incidentFaces'])==len(trace['rows'][s['firstRow']]['incidentCovered']) for s in trace['steps']))
   check('native iteration cap retained',all(s['passes']<=32 for s in trace['steps']) and trace['steps'][-1]['passes']==32)
   check('trace uses independent copies and exact undo',assembly['candidateRemovalExact'] and assembly['enduranceRemovalExact'])
   check('prior source files unchanged',before=={n:sha((H/n).read_bytes()) for n in before})
   check('no unhandled page errors',not report['pageErrors'],report['pageErrors']);check('no console errors',not report['consoleErrors'],report['consoleErrors']);check('no failed requests',not report['failedRequests'],report['failedRequests'])
   (Q/'ENDURANCE.json').write_text(json.dumps(x,ensure_ascii=False,indent=2));(Q/'TRACE.json').write_text(json.dumps(trace,ensure_ascii=False,indent=2));report['traceSHA256']=sha((Q/'TRACE.json').read_bytes());report['enduranceSHA256']=sha((Q/'ENDURANCE.json').read_bytes());report['traceRows']=len(trace['rows']);report['passed']=True
  except Exception as e:
   report['failure']=str(e);report['stack']=traceback.format_exc();print(report['stack'],flush=True)
   try:report['lastState']=page.evaluate('__RF310_RUN');report['status']=page.locator('#status').inner_text()
   except Exception:pass
  finally:save();ctx.close();browser.close()
finally:server.shutdown()
if not report['passed']:raise SystemExit(1)
