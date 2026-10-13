"""Unmodified application in actual file:// and immutable public URL.
--content is development-only and is explicitly not file/public acceptance.
Software Chromium results are not consumer-GPU or universal 60 FPS proof.
"""
from pathlib import Path
import argparse,base64,hashlib,io,json,os,time,traceback
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright
P=Path(__file__).resolve().parent;O=P/'evidence';O.mkdir(exist_ok=True)
ap=argparse.ArgumentParser();ap.add_argument('--public');ap.add_argument('--content',action='store_true');ap.add_argument('--skip-parent',action='store_true');args=ap.parse_args();mode='public' if args.public else 'content-development' if args.content else 'file'
r={'passed':False,'mode':mode,'hardwareFPSVerified':False,'sixtyFPSAccepted':False,'states':[],'network':{},'comparisons':{},'measurements':[],'realPhone':False}
def save():(O/(mode+'-qa.json')).write_text(json.dumps(r,ensure_ascii=False,indent=2))
def boot(b,label,parent=False,mobile=False):
 c=b.new_context(viewport={'width':390,'height':844} if mobile else {'width':1000,'height':780},device_scale_factor=1,is_mobile=mobile,has_touch=mobile);p=c.new_page();p.set_default_timeout(240000);net={'errors':[],'console':[],'http':[],'requests':[]};r['network'][label]=net
 p.on('pageerror',lambda e:net['errors'].append(str(e)));p.on('console',lambda m:net['console'].append({'url':m.location.get('url'),'text':m.text}) if m.type=='error' else None);p.on('response',lambda q:net['http'].append({'url':q.url,'status':q.status}) if q.status>=400 else None);p.on('request',lambda q:net['requests'].append(q.url))
 local=(P.parent/'r14/index.html') if parent else P/'index.html'
 if args.content:p.set_content(local.read_text(),wait_until='domcontentloaded')
 else:p.goto(local.as_uri() if parent else (args.public or local.as_uri()),wait_until='domcontentloaded')
 p.wait_for_function('window.__DENIM_WORKBENCH__?.lastFrame||document.querySelector("#error")?.textContent?.trim()');assert not p.locator('#error').inner_text().strip(),p.locator('#error').inner_text();p.evaluate('window.A=__DENIM_WORKBENCH__');p.wait_for_function('A.physicsReady()');return c,p

def idle(p):p.wait_for_function('!A.state.animate&&A.renderIdle()')
def capture(p,label):
 idle(p);raw=base64.b64decode(p.evaluate('document.querySelector("#view").toDataURL().split(",")[1]'));im=np.asarray(Image.open(io.BytesIO(raw)).convert('RGB'));d=p.evaluate('({version:A.version,frame:A.lastFrame,report:A.physicsReport(),gen:A.physicsGeneration(),gl:A.getGLError(),error:document.querySelector("#error").textContent})');d['name']=label;d['imageSha256']=hashlib.sha256(raw).hexdigest();(O/(mode+'-'+label+'.png')).write_bytes(raw);r['states'].append(d);save();assert d['gl']==0 and not d['error'] and im.std()>2,(label,d);print('STATE',label,d['version'],'steps',d['report']['steps'],flush=True);return im,d

def enter(p):
 p.evaluate('A.enterExperiment("fold",false)');p.wait_for_function('A.physicsReady()&&A.lastFrame.physics?.model==="continuous-curvature-sheet@1"&&A.lastFrame.physics.steps===0');idle(p)
def step(p,sec):
 n=p.evaluate('A.physicsReport().steps')+round(sec*240);p.evaluate('(s)=>A.advanceExperiment(s)',sec);p.wait_for_function('(s)=>A.lastFrame.physics.steps===s',arg=n);idle(p)
def view(p,patch):
 n=p.evaluate('A.lastFrame.frame');p.evaluate('(x)=>A.setState(x)',patch);p.wait_for_function('(n)=>A.lastFrame.frame>n',arg=n);idle(p)
def compare(label,a,b):
 d=np.abs(a.astype(int)-b.astype(int));q={'meanChannel':float(d.mean()),'maxChannel':int(d.max()),'pixelsOver8':float((d.max(axis=2)>8).mean())};r['comparisons'][label]=q;assert q['meanChannel']<.25 and q['pixelsOver8']<.01,(label,q)
MEASURE=r'''async(seconds)=>{const rows=[];let live=true,lastFrame=A.lastFrame.frame;const initialSim=A.lastFrame.physics.simulationSeconds??A.lastFrame.physics.steps/240;const start=performance.now();function raf(t){const f=A.lastFrame;if(f.frame!==lastFrame){rows.push({timeMs:performance.now()-start,frame:f.frame,steps:f.physics.steps,simulationSeconds:f.physics.simulationSeconds??f.physics.steps/240,cpuMs:f.cpuSubmitMs,triangles:f.triangles});lastFrame=f.frame;}if(live)requestAnimationFrame(raf);}requestAnimationFrame(raf);A.resetFrameMetrics?.();A.setState({animate:true});let phase=-1;const timer=setInterval(()=>{const s=(performance.now()-start)/1000,n=Math.floor(s/2.7)%2;if(n!==phase){phase=n;A.mechanicsControls({fold:n?0:1});}},150);await new Promise(r=>setTimeout(r,seconds*1000));clearInterval(timer);live=false;A.setState({animate:false});const dt=rows.slice(1).map((x,i)=>x.timeMs-rows[i].timeMs).sort((a,b)=>a-b),span=rows.length>1?(rows.at(-1).timeMs-rows[0].timeMs)/1000:0;let gl=document.querySelector('#view').getContext('webgl2'),ex=gl.getExtension('WEBGL_debug_renderer_info');return {seconds,elapsedMs:performance.now()-start,distinctSubmittedFrames:rows.length,observedDistinctFPS:rows.length/((performance.now()-start)/1000),activeSpanFPS:span?(rows.length-1)/span:0,p95IntervalMs:dt.length?dt[Math.floor((dt.length-1)*.95)]:null,physicsSpeed:rows.length?(rows.at(-1).simulationSeconds-initialSim)/((performance.now()-start)/1000):0,renderer:ex?gl.getParameter(ex.UNMASKED_RENDERER_WEBGL):'unknown',completionMetrics:A.frameMetrics?.(),rows,note:'rAF samples distinct complete-image submissions, not all callbacks; GPU fence observations separate; software renderer not actual device FPS'};}'''
with sync_playwright() as pw:
 opts={'headless':False,'args':['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']}
 if os.getenv('CHROMIUM_PATH'):opts['executable_path']=os.environ['CHROMIUM_PATH']
 b=pw.chromium.launch(**opts);r['browserVersion']=b.version;contexts=[]
 try:
  c,p=boot(b,'candidate');contexts.append(c);initial,d=capture(p,'original-material');assert d['version']=='R15.0'
  if not args.public and not args.skip_parent:
   pc,pp=boot(b,'reference-R14',parent=True);contexts.append(pc);old,_=capture(pp,'reference-material');compare('original-material',initial,old);enter(pp);step(pp,3);refold,_=capture(pp,'reference-fold');enter(pp);q=pp.evaluate(MEASURE,12);q['label']='R14 reference';r['measurements'].append(q);pc.close();contexts.remove(pc)
  enter(p);step(p,3);fold,d=capture(p,'fold-closed');x=d['report'];assert x['solverBackend']=='wasm-f64-r15' and x['steps']==720 and x['selfCollision'] and x['curvedSegments']>=6 and x['upperOpeningDegrees']<5 and x['maxTensileStrain']<.03
  if 'refold' in locals():compare('same-720-step-fold',fold,refold)
  gen=d['gen'];view(p,{'yaw':-.1,'pitch':1.25,'zoom':1.45,'panX':-15});capture(p,'fold-side');view(p,{'zoom':.45});capture(p,'fold-far');assert p.evaluate('A.physicsGeneration()')==gen and p.evaluate('A.physicsReport().steps')==720
  p.locator('#r14-grip').click();step(p,.1);_,d=capture(p,'edge-released');assert not d['report']['gripEnabled'] and d['report']['steps']==744
  enter(p);r['measurements'].append({'label':'R15 candidate',**p.evaluate(MEASURE,12)});capture(p,'after-real-motion');assert r['measurements'][-1]['rows'][-1]['steps']>r['measurements'][-1]['rows'][0]['steps'];assert p.evaluate('A.physicsReport().selfCollision')
  p.locator('#r13-restart').click();p.wait_for_function('A.lastFrame.physics.steps===0');capture(p,'reset');
  # Exercise the new visible user benchmark; stop without resetting physics.
  p.locator('#r15-benchmark').click();p.wait_for_timeout(2000);p.locator('#r15-benchmark').click();idle(p);r['benchmarkButtonWorks']=True
  p.locator('#r15-benchmark').click();p.wait_for_function('document.querySelector("#r15-result").textContent.startsWith("已完成：")',timeout=90000);idle(p);r['automaticThirtySecondBenchmark']=True
  with p.expect_download() as perfinfo:p.locator('#r15-save').click()
  perffile=O/(mode+'-local-performance.json');perfinfo.value.save_as(str(perffile));pr=json.loads(perffile.read_text());assert pr['schema']=='kaopu.denim-performance@1' and pr['conditions']['physicalState']['selfCollision'];assert pr['benchmark']['completedFullDuration'] and pr['benchmark']['statistics']['includesStartupAndStalledTail'];r['performanceExport']=True;r['userBenchmarkReport']=pr
  with p.expect_download() as info:p.locator('#r13-save').click()
  info.value.save_as(str(O/(mode+'-experiment.json')));r['reportExport']=True
  p.locator('#r13-original').click();p.wait_for_function('!A.state.experiment&&A.physicsReady()');capture(p,'returned-material');c.close();contexts.remove(c)
  mc,mp=boot(b,'mobile-layout',mobile=True);contexts.append(mc);enter(mp);step(mp,.1);capture(mp,'mobile-fold');mp.screenshot(path=str(O/(mode+'-mobile-layout.png')));mc.close();contexts.remove(mc)
  icon='https://htmlpreview.github.io/favicon.ico'
  for name,n in r['network'].items():
   assert not n['errors'],(name,n)
   assert not [v for v in n['http'] if not(v['url']==icon and v['status']==404)],(name,n)
   assert not [v for v in n['console'] if not(v['url']==icon and '404' in v['text'])],(name,n)
   if mode in ['file','content-development']:assert not [u for u in n['requests'] if u.startswith('http')],(name,n)
  r['passed']=True
 except Exception:r['failure']=traceback.format_exc();raise
 finally:save();b.close()
