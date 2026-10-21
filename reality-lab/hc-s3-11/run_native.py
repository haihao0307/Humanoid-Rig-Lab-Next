from pathlib import Path
from urllib.parse import urlsplit
import os,json,hashlib,http.server,threading,functools,time,subprocess,traceback,platform
from playwright.sync_api import sync_playwright
from instrument import assemble
R=Path(__file__).resolve().parent;H=Path(os.environ['GARMENT_HOST']).resolve();motion=os.environ['RF311_MOTION'];assert motion in ['static','walk']
Q=R/'qa/native'/motion;Q.mkdir(parents=True,exist_ok=True);responses={};sha=lambda b:hashlib.sha256(b).hexdigest()
class Server(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
 def do_GET(self):
  name=urlsplit(self.path).path.lstrip('/')
  if name in responses:
   b=responses[name];self.send_response(200);self.send_header('Content-Type','text/javascript');self.send_header('Content-Length',str(len(b)));self.end_headers();self.wfile.write(b)
  else:super().do_GET()
server=http.server.ThreadingHTTPServer(('127.0.0.1',8765),functools.partial(Server,directory=str(H)));threading.Thread(target=server.serve_forever,daemon=True).start()
CODE=subprocess.check_output(['git','-C',str(R),'rev-parse','HEAD'],text=True).strip()
script="""(()=>{const W=Worker;window.__RF311={result:null,fit:null,errors:[],progress:[]};window.Worker=class extends W{constructor(...a){super(...a);this.addEventListener('message',e=>{const d=e.data;if(d?.rf39&&d.kind==='complete')__RF311.result=d.result;if(d?.rf39&&d.kind==='progress')__RF311.progress.push(d);if(d?.rf36&&d.kind==='report')__RF311.fit=d.report;if(d?.error)__RF311.errors.push(d);});}};})()"""
old=json.loads((R.parent/'hc-s3-9/qa/native'/('coverage-'+motion)/'ENDURANCE.json').read_text());reports=[]
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  for ordinal,mode in enumerate(['baseline','guarded']):
   out=Q/mode;out.mkdir(exist_ok=True);responses,assembly=assemble(H,mode,motion)
   protected=['app.mjs','lower-body-contact.mjs','mesh-contact.mjs','reduced-cloth.mjs','live-cloth-worker.mjs'];before={n:sha((H/n).read_bytes()) for n in protected}
   r={'mode':mode,'motion':motion,'ordinal':ordinal,'codeCommit':CODE,'assembly':assembly,'passed':False,'checks':[],'pageErrors':[],'consoleErrors':[],'failedRequests':[],'environment':{'platform':platform.platform(),'cpuCount':os.cpu_count(),'browser':browser.version,'runID':os.environ.get('GITHUB_RUN_ID'),'sameRunnerPair':True,'pairOrder':['baseline','guarded'],'renderer':'SwiftShader; worker CPU wall timings, not GPU frame or multi-run benchmark'},'fitCertified':False,'productionChanged':False}
   def save():(out/'REPORT.json').write_text(json.dumps(r,ensure_ascii=False,indent=2))
   def check(name,ok,detail=None):
    if not ok:raise AssertionError(name+': '+str(detail))
    r['checks'].append({'name':name,'passed':True,'detail':detail});print(motion,mode,'PASS',name,flush=True);save()
   ctx=browser.new_context(viewport={'width':1280,'height':960});ctx.add_init_script(script);page=ctx.new_page()
   page.on('pageerror',lambda e:r['pageErrors'].append(str(e)));page.on('console',lambda e:r['consoleErrors'].append(e.text) if e.type=='error' else None);page.on('requestfailed',lambda e:r['failedRequests'].append({'url':e.url,'failure':e.failure}))
   try:
    start=time.monotonic();page.goto('http://127.0.0.1:8765/index.html?look=D03',wait_until='domcontentloaded',timeout=120000)
    page.wait_for_function('window.__RF311?.result || window.__RF311?.errors.length',polling=1000,timeout=900000)
    data=page.evaluate('__RF311');check('native terminal evidence returned',data['result'] is not None,data['errors']);x=data['result'];r['fit']=data['fit'];r['elapsedSeconds']=time.monotonic()-start
    # Persist true result before validation; an invalid gate is not an excuse to lose evidence.
    (out/'ENDURANCE.json').write_text(json.dumps(x,ensure_ascii=False,indent=2));r['dataSHA256']=sha((out/'ENDURANCE.json').read_bytes());save()
    check('same progressive48 initialization committed',data['fit']['status']=='COMMITTED' and data['fit']['committedSteps']==48)
    check('same fixed timestep, gait and planned180 horizon',x['dtSeconds']==old['dtSeconds'] and x['walkingClip']==old['walkingClip'] and x['plannedSteps']==old['plannedSteps']==180)
    check('original failure or complete horizon explicitly recorded',x['completedSteps']==180 or x['failure'] is not None)
    check('all three starting states exactly match reference',all(all(a[k]==b[k] for k in ['stage','step','stateSHA256','body','pair']) for a,b in zip(x['checkpoints'][:3],old['checkpoints'][:3])))
    check('same original fit threshold and no coarse writes',x['originalFitGate']==1.45 and all(c['coarseStateUnchanged'] for f in x['frames'] for c in f['fineCalls']))
    check('all three contact channels retained',all(len(c['body'])==2 and 'pair' in c for c in x['checkpoints']))
    check('per-step guard accounting complete',len(x['jointGuard']['frames'])==len(x['frames']) and all(f['jointGuard']['step']==f['step'] for f in x['frames']))
    check('guard distinguishes blocks from solves',all(f['calls']==f['guideAccepted']+f['normalAccepted']+f['blocked'] for f in x['jointGuard']['frames']))
    check('guard numerical comparison not a physical certificate',x['jointGuard']['continuousCollision'] is False and x['jointGuard']['fitCertified'] is False)
    check('source and all declared limits preserved',assembly['reversible'] and not assembly['limitsChanged'] and not assembly['marginScheduleChanged'] and before=={n:sha((H/n).read_bytes()) for n in protected})
    if mode=='baseline':
     checks=[{'step':a['step'],'stage':a['stage'],'identical':all(a[k]==b[k] for k in ['stage','step','stateSHA256','body','pair'])} for a,b in zip(x['checkpoints'],old['checkpoints'])]
     check('reference all43 endpoint states unchanged',len(checks)==len(old['checkpoints'])==len(x['checkpoints'])==43 and all(c['identical'] for c in checks))
     check('reference final state unchanged',x['finalState']==old['finalState'])
     if motion=='walk':
      regression=x['jointGuard']['exactRegression'];check('known real guided translation sampled',regression is not None and regression['ids']==[427,448,449])
      a=next(p for p in regression['before']['samples'] if p['id']=='v448');b=next(p for p in regression['choices'][0]['after']['samples'] if p['id']=='v448')
      check('same known positive-to-negative move reproduced',abs(a['distanceM']-.0021700219815)<1e-10 and abs(b['distanceM']+.0006738472227)<1e-10,{'beforeM':a['distanceM'],'afterM':b['distanceM']})
      check('joint gate rejects that move',not regression['choices'][0]['decision']['allowed'])
    else:
     check('accepted trials satisfy joint tests in recorded examples',all(any(c['kind']==e['selected'] and c['decision']['allowed'] for c in e['choices']) for e in x['jointGuard']['events'] if e['selected']!='blocked'))
     check('joint cost is included, observation cost separate',all(f['jointGuard']['guardWallMS']>=0 and f['jointGuard']['observerMS']==0 for f in x['frames']))
    check('zero page errors',not r['pageErrors'],r['pageErrors']);check('zero console errors',not r['consoleErrors'],r['consoleErrors']);check('zero failed requests',not r['failedRequests'],r['failedRequests'])
    r['completedSteps']=x['completedSteps'];r['failure']=x['failure'];r['passed']=True
   except Exception as e:
    r['validationFailure']=str(e);r['trace']=traceback.format_exc();print(r['trace'],flush=True)
    try:r['lastState']=page.evaluate('({fit:__RF311.fit,errors:__RF311.errors,progress:__RF311.progress})');r['sourceStatus']=page.locator('#status').inner_text()
    except Exception:pass
   finally:save();ctx.close()
   reports.append(r)
   if not r['passed']:raise RuntimeError('EVIDENCE_INVALID:'+mode)
  browser.close()
finally:
 server.shutdown();(Q/'RUN.json').write_text(json.dumps({'codeCommit':CODE,'motion':motion,'passed':len(reports)==2 and all(r['passed'] for r in reports),'sameRunnerPair':True,'order':['baseline','guarded'],'cases':[{k:r.get(k) for k in ['mode','passed','dataSHA256','completedSteps','failure','validationFailure']} for r in reports]},ensure_ascii=False,indent=2))
