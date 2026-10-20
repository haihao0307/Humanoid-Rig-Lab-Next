from pathlib import Path
from urllib.parse import urlsplit
import os,json,hashlib,gzip,base64,threading,http.server,functools,time,subprocess,traceback
from playwright.sync_api import sync_playwright
from instrument import make_responses
R=Path(__file__).resolve().parent;H=Path(os.environ['GARMENT_HOST']).resolve();Q=R/'qa/diagnostic';Q.mkdir(parents=True,exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest();anchor=json.loads((R/'TASK_ANCHOR.json').read_text())
inventory={p.relative_to(H).as_posix():sha(p.read_bytes()) for p in H.rglob('*') if p.is_file()}
source={**anchor['source'],'files':{n:inventory[n] for n in ['app.mjs','wasm-cloth.mjs','live-cloth-worker.mjs','live-cloth-controller.mjs','cloth-kernel.wasm','material-physics.mjs','coupled-cloth.mjs']}}
active={};proofs={};results={}
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):
  name=urlsplit(self.path).path.lstrip('/')
  if name in active:
   b=active[name];self.send_response(200);self.send_header('Content-Type','text/javascript');self.send_header('Content-Length',str(len(b)));self.end_headers();self.wfile.write(b)
  else:super().do_GET()
server=http.server.ThreadingHTTPServer(('127.0.0.1',8765),functools.partial(Handler,directory=str(H)));threading.Thread(target=server.serve_forever,daemon=True).start()
report={'schema':'kaopu/first-fault-evidence@1','source':source,'passed':False,'checks':[],'runs':{},'physicalDeviceTested':False,'repairApplied':False,'sourceFitAccepted':False}
def save():(Q/'REPORT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
def check(name,ok,detail=None):
 if not ok:raise AssertionError(name+': '+str(detail))
 report['checks'].append({'name':name,'passed':True,'detail':detail});print('PASS',name,flush=True);save()
def compact_state(x,path='root',rows=None):
 rows={} if rows is None else rows
 if isinstance(x,dict) and 'base64' in x:
  b=base64.b64decode(x['base64'],validate=True);assert len(b)==x['bytes'];rows[path]={'type':x['type'],'length':x['length'],'bytes':len(b),'sha256':sha(b)}
 elif isinstance(x,dict):
  for k,v in x.items():compact_state(v,path+'.'+k,rows)
 elif isinstance(x,list):
  for i,v in enumerate(x):compact_state(v,path+'.'+str(i),rows)
 else:rows[path]=x
 return rows
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 try:
  for label,verbose in [('baseline',False),('traced',True)]:
   active,proofs[label]=make_responses(H,R,verbose)
   context=browser.new_context(viewport={'width':1280,'height':960},device_scale_factor=1)
   page=context.new_page();page.set_default_timeout(120000);errors=[];console=[];failed=[]
   page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda e:console.append(e.text) if e.type=='error' else None);page.on('requestfailed',lambda r:failed.append({'url':r.url,'reason':r.failure}))
   start=time.monotonic();page.goto('http://127.0.0.1:8765/index.html?look=D03',wait_until='domcontentloaded',timeout=120000)
   page.wait_for_function('document.getElementById("status").classList.contains("error") || !!document.getElementById("provenance").textContent',polling=1000,timeout=480000)
   observation=page.evaluate('()=>({capture:window.__RF34_CAPTURE__||{},status:document.getElementById("status").textContent,error:document.getElementById("status").classList.contains("error"),committed:window.__MP05__?.debug().items.length??null})')
   results[label]=observation
   (Q/(label+'-raw.json.gz')).write_bytes(gzip.compress(json.dumps(observation,ensure_ascii=False,separators=(',',':')).encode(),mtime=0))
   page.screenshot(path=str(Q/(label+'-outcome.png')),timeout=120000)
   report['runs'][label]={'seconds':time.monotonic()-start,'status':observation['status'],'error':observation['error'],'committed':observation['committed'],'pageErrors':errors,'consoleErrors':console,'failedRequests':failed,'observerError':observation['capture'].get('observerError'),'patches':proofs[label]};save()
   check(label+' observer started without error',not observation['capture'].get('observerError'),observation['capture'].get('observerError'))
   check(label+' original strain failure reproduced',observation['error'] and '物理应变超出工程安全范围' in observation['status'],observation['status'])
   trace=observation['capture'].get('trace');check(label+' diagnostic trace received',bool(trace))
   check(label+' no diagnostic errors',not trace['errors'],trace['errors']);check(label+' no trace truncation',not trace['truncated'])
   check(label+' original safety predicate preserved',trace['gate']['originalPredicate']=='!Number.isFinite(r.maxEdgeStretch)||r.maxEdgeStretch>1.45')
   check(label+' actual audit maximum equals diagnostic scan',all(abs(v['maxEdgeStretch']-trace['gate']['event']['states'][next(i for i,s in enumerate(trace['gate']['event']['states']) if s['role']==v['role'])]['maxRatio'])<1e-12 for v in trace['gate']['originalAudits']))
   check(label+' no unhandled errors',not errors and not console and not failed,{'errors':errors,'console':console,'network':failed})
   context.close()
  a,b=results['baseline'],results['traced'];check('same native failure text and displayed garment count',a['status']==b['status'] and a['committed']==b['committed']==0)
  comparisons={}
  for key in ['initialState','entryState','gateState','rollbackState']:
   x,y=a['capture'][key],b['capture'][key];check('byte-identical baseline versus traced '+key,x==y)
   comparisons[key]={'identical':True,'bufferHashesAndScalars':compact_state(x)}
  trace=b['capture']['trace'];rollback=b['capture']['entryState']==b['capture']['rollbackState']
  report['rollbackExact']=rollback
  # Rollback fidelity is an observed outcome, not a gate to hide a newly found source defect.
  report['rollbackDifferences']=[k for k,v in compact_state(b['capture']['entryState']).items() if compact_state(b['capture']['rollbackState']).get(k)!=v]
  check('original source files unchanged',inventory=={p.relative_to(H).as_posix():sha(p.read_bytes()) for p in H.rglob('*') if p.is_file()})
  check('first crossing exists with original panel identity',trace['firstCrossing'] is not None and bool(trace['firstCrossing']['worstEdge']['panelId']))
  report['comparisons']=comparisons;report['trace']=trace;report['captureCode']={'commit':subprocess.check_output(['git','-C',str(R),'rev-parse','HEAD'],text=True).strip(),'files':{n:sha((R/n).read_bytes()) for n in ['observer.mjs','instrument.py','capture.py']}};report['passed']=True
  (R/'diagnosis.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));(Q/'SOURCE_INVENTORY.json').write_text(json.dumps(inventory,indent=2));save()
 except Exception as e:
  report['failure']=str(e);report['stack']=traceback.format_exc();print(report['stack'],flush=True);save()
 finally:browser.close();server.shutdown()
if not report['passed']:raise SystemExit(1)
print('DIAGNOSIS_PASSED',len(report['checks']),flush=True)
