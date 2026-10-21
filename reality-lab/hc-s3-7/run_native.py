from pathlib import Path
from urllib.parse import urlsplit
import os,json,hashlib,http.server,threading,functools,time,subprocess,traceback
from playwright.sync_api import sync_playwright
from instrument import assemble
R=Path(__file__).resolve().parent;H=Path(os.environ['GARMENT_HOST']).resolve();CASE=os.environ.get('CONTACT_CASE','walk');Q=R/'qa'/CASE;Q.mkdir(parents=True,exist_ok=True)
responses,assembly=assemble(H,CASE);sha=lambda b:hashlib.sha256(b).hexdigest();sourceBefore={n:sha((H/n).read_bytes()) for n in assembly['sourceContactFiles']}
report={'case':CASE,'passed':False,'checks':[],'errors':[],'consoleErrors':[],'failedRequests':[],'codeCommit':subprocess.check_output(['git','-C',str(R),'rev-parse','HEAD'],text=True).strip(),'assembly':assembly,'fitCertified':False,'physicalDeviceTested':False}
class Server(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):
  name=urlsplit(self.path).path.lstrip('/')
  if name in responses:
   b=responses[name];self.send_response(200);self.send_header('Content-Type','text/javascript');self.send_header('Content-Length',str(len(b)));self.end_headers();self.wfile.write(b)
  else:super().do_GET()
server=http.server.ThreadingHTTPServer(('127.0.0.1',8765),functools.partial(Server,directory=str(H)));threading.Thread(target=server.serve_forever,daemon=True).start()
def save():(Q/'REPORT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
def check(name,ok,detail=None):
 if not ok:raise AssertionError(name+': '+str(detail))
 report['checks'].append({'name':name,'passed':True,'detail':detail});print('PASS',name,flush=True);save()
script="""(()=>{const W=Worker;window.__RF37={result:null,progress:[],fit:null,workerErrors:[]};window.Worker=class extends W{constructor(...a){super(...a);this.addEventListener('message',e=>{const d=e.data;if(d?.rf37&&d.kind==='complete')__RF37.result=d.result;if(d?.rf37&&d.kind==='progress')__RF37.progress.push(d);if(d?.rf36&&d.kind==='report')__RF37.fit=d.report;if(d?.error)__RF37.workerErrors.push(d);});}};})()"""
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']);ctx=browser.new_context(viewport={'width':1280,'height':960});ctx.add_init_script(script);page=ctx.new_page()
 page.on('pageerror',lambda e:report['errors'].append(str(e)));page.on('console',lambda e:report['consoleErrors'].append(e.text) if e.type=='error' else None);page.on('requestfailed',lambda r:report['failedRequests'].append({'url':r.url,'failure':r.failure}))
 try:
  start=time.monotonic();page.goto('http://127.0.0.1:8765/index.html?look=D03',wait_until='domcontentloaded',timeout=120000)
  page.wait_for_function('window.__RF37?.result || window.__RF37?.workerErrors.length',polling=500,timeout=600000)
  data=page.evaluate('__RF37');check('native contact sequence returned',data['result'] is not None,data['workerErrors']);r=data['result'];report['result']=r;report['fit']=data['fit'];report['elapsedSeconds']=time.monotonic()-start
  check('unchanged S3.6 transaction completed',data['fit']['status']=='COMMITTED' and data['fit']['committedSteps']==48)
  check('three pre-motion boundaries recorded',[x['stage'] for x in r['records'][:3]]==['fit-committed','regional-created','motion-selected'])
  check('no unknown automatic frames',r['records'][0]['frame']==48 and r['automaticAppFramesBeforeMeasurement']==0)
  check('all probes preserve checked state',all(x['readOnlyVerified'] for x in r['records']))
  check('fixed steps have explicit times',all(abs(x['simulationSeconds']-(.8+x['step']/60))<1e-10 for x in r['records'] if x['stage']=='fixed-step'))
  check('motion time controlled',all(abs(x['motionTime']-(0 if CASE=='static' else x['step']/60))<1e-10 for x in r['records'] if x['stage']=='fixed-step'))
  check('terminal scope explicit',r['completedSteps']==12 or r['motionFailure'] is not None)
  check('actual surfaces sampled',all(all(b['count']>0 and b['witness'] for b in x['body']) for x in r['records']))
  check('finite raw distance measurements',all(b['minimumM'] is not None and abs(b['minimumM'])<10 for x in r['records'] for b in x['body']))
  check('source contact code untouched',sourceBefore=={n:sha((H/n).read_bytes()) for n in sourceBefore})
  check('no unhandled page errors',not report['errors'],report['errors']);check('no console errors',not report['consoleErrors'],report['consoleErrors']);check('no failed requests',not report['failedRequests'],report['failedRequests'])
  (Q/'CONTACT.json').write_text(json.dumps(r,ensure_ascii=False,indent=2));report['contactSHA256']=sha((Q/'CONTACT.json').read_bytes());report['passed']=True
 except Exception as e:
  report['failure']=str(e);report['trace']=traceback.format_exc();print(report['trace'],flush=True)
  try:report['lastState']=page.evaluate('__RF37');report['sourceStatus']=page.locator('#status').inner_text()
  except Exception:pass
 finally:save();ctx.close();browser.close();server.shutdown()
if not report['passed']:raise SystemExit(1)
