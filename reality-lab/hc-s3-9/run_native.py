from pathlib import Path
from urllib.parse import urlsplit
import os,json,hashlib,http.server,threading,functools,time,subprocess,traceback,platform
from playwright.sync_api import sync_playwright
from instrument import assemble
R=Path(__file__).resolve().parent;H=Path(os.environ['GARMENT_HOST']).resolve();Q=R/'qa/native';Q.mkdir(parents=True,exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest();responses={}
class Server(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
 def do_GET(self):
  name=urlsplit(self.path).path.lstrip('/')
  if name in responses:
   b=responses[name];self.send_response(200);self.send_header('Content-Type','text/javascript');self.send_header('Content-Length',str(len(b)));self.end_headers();self.wfile.write(b)
  else:super().do_GET()
server=http.server.ThreadingHTTPServer(('127.0.0.1',8765),functools.partial(Server,directory=str(H)));threading.Thread(target=server.serve_forever,daemon=True).start()
CODE=subprocess.check_output(['git','-C',str(R),'rev-parse','HEAD'],text=True).strip()
ORDER=[('baseline','static'),('coverage','static'),('coverage','walk'),('baseline','walk')]
script="""(()=>{const W=Worker;window.__RF39={result:null,fit:null,workerErrors:[],progress:[]};window.Worker=class extends W{constructor(...a){super(...a);this.addEventListener('message',e=>{const d=e.data;if(d?.rf39&&d.kind==='complete')__RF39.result=d.result;if(d?.rf39&&d.kind==='progress')__RF39.progress.push(d);if(d?.rf36&&d.kind==='report')__RF39.fit=d.report;if(d?.error)__RF39.workerErrors.push(d);});}};})()"""
all_reports=[]
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  for ordinal,(variant,motion) in enumerate(ORDER):
   key=variant+'-'+motion;out=Q/key;out.mkdir(exist_ok=True)
   responses,assembly=assemble(H,variant,motion);before={n:sha((H/n).read_bytes()) for n in assembly['sourceFiles']}
   report={'case':key,'ordinal':ordinal,'codeCommit':CODE,'assembly':assembly,'passed':False,'checks':[],'errors':[],'consoleErrors':[],'failedRequests':[],'environment':{'platform':platform.platform(),'cpuCount':os.cpu_count(),'browser':browser.version,'renderer':'Chromium SwiftShader; native worker CPU timings','sameJobSequential':True,'runID':os.environ.get('GITHUB_RUN_ID')},'fitCertified':False}
   def save():(out/'REPORT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
   def check(name,ok,detail=None):
    if not ok:raise AssertionError(name+': '+str(detail))
    report['checks'].append({'name':name,'passed':True,'detail':detail});print(key,'PASS',name,flush=True);save()
   ctx=browser.new_context(viewport={'width':1280,'height':960});ctx.add_init_script(script);page=ctx.new_page()
   page.on('pageerror',lambda e:report['errors'].append(str(e)));page.on('console',lambda e:report['consoleErrors'].append(e.text) if e.type=='error' else None);page.on('requestfailed',lambda r:report['failedRequests'].append({'url':r.url,'failure':r.failure}))
   try:
    start=time.monotonic();page.goto('http://127.0.0.1:8765/index.html?look=D03',wait_until='domcontentloaded',timeout=120000)
    page.wait_for_function('window.__RF39?.result || window.__RF39?.workerErrors.length',polling=500,timeout=720000)
    data=page.evaluate('__RF39');check('actual native sequence returned',data['result'] is not None,data['workerErrors']);x=data['result'];report['fit']=data['fit'];report['elapsedSeconds']=time.monotonic()-start
    check('same S3.6 fitting transaction committed 48 steps',data['fit']['status']=='COMMITTED' and data['fit']['committedSteps']==48)
    check('source protection gate unchanged',x['originalFitGate']==1.45 and not x['productionChanged'])
    check('actual gait duration defines horizon',x['walkingClip']['continuous'] and x['plannedSeconds']>=.65+2*x['walkingClip']['durationSeconds'] and x['plannedSteps']<=600)
    check('no automatic app motion before measurements',x['automaticAppFramesBeforeMeasurement']==0 and x['checkpoints'][0]['frame']==48)
    check('terminal completion or original failure explicitly recorded',x['completedSteps']==x['plannedSteps'] or x['failure'] is not None)
    check('checkpoints preserve checked original state',all(r['readOnlyVerified'] for r in x['checkpoints']))
    check('fine observations do not alter coarse state',all(c['coarseStateUnchanged'] for r in x['frames'] for c in r['fineCalls']))
    check('per-step observations cover accepted and rejected attempts',len(x['frames'])==x['completedSteps']+(1 if x['failure'] else 0))
    check('fixed times are explicit',all(abs(r['motionTime']-(0 if motion=='static' else r['step']/60))<1e-9 for r in x['frames'] if r['accepted']))
    oldpath=R.parent/('hc-s3-7' if variant=='baseline' else 'hc-s3-8')/'qa'/(motion if variant=='baseline' else 'coverage-'+motion)/'CONTACT.json'
    old=json.loads(oldpath.read_text());matches=[]
    for oldrow,newrow in zip(old['records'],x['checkpoints'][:15]):
     same=all(oldrow[k]==newrow[k] for k in ['stage','step','stateSHA256','body','pair']);matches.append({'stage':oldrow['stage'],'step':oldrow['step'],'identical':same})
    check('all inherited 15 endpoints match exact original trajectories',len(matches)==15 and all(r['identical'] for r in matches),matches)
    check('native stage timing and probe timing are separate',all(r['stepWallMS']>=0 and r['observerMS']>=0 and r['adjustedStepMS']>=0 for r in x['frames']))
    check('source files unchanged',before=={n:sha((H/n).read_bytes()) for n in before})
    check('no unhandled page errors',not report['errors'],report['errors']);check('no console errors',not report['consoleErrors'],report['consoleErrors']);check('no failed network requests',not report['failedRequests'],report['failedRequests'])
    (out/'ENDURANCE.json').write_text(json.dumps(x,ensure_ascii=False,indent=2));report['dataSHA256']=sha((out/'ENDURANCE.json').read_bytes());report['terminal']={'completedSteps':x['completedSteps'],'plannedSteps':x['plannedSteps'],'failure':x['failure']};report['passed']=True
   except Exception as e:
    report['failure']=str(e);report['trace']=traceback.format_exc();print(report['trace'],flush=True)
    try:report['lastState']=page.evaluate('__RF39');report['sourceStatus']=page.locator('#status').inner_text()
    except Exception:pass
   finally:save();ctx.close()
   all_reports.append(report)
   if not report['passed']:raise RuntimeError('NATIVE_EVIDENCE_INVALID:'+key)
  browser.close()
finally:
 server.shutdown();(Q/'RUN.json').write_text(json.dumps({'codeCommit':CODE,'order':[v+'-'+m for v,m in ORDER],'sameRunnerSequential':True,'passed':len(all_reports)==4 and all(r['passed'] for r in all_reports),'cases':[{k:r.get(k) for k in ['case','passed','dataSHA256','terminal','failure']} for r in all_reports]},ensure_ascii=False,indent=2))
