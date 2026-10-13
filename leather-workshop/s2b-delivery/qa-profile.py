"""S2B diagnostic copy only. Never ship injected timing hooks.
Clock reference: https://developer.mozilla.org/en-US/docs/Web/API/Performance/timeOrigin
Submission times are not GPU completion times. Transport and event-loop wait
remain grouped; no claim that JavaScript can time browser-internal arrival.
"""
from pathlib import Path
import argparse,json,os,platform,hashlib,time,traceback
from playwright.sync_api import sync_playwright
P=Path(__file__).resolve().parent
ap=argparse.ArgumentParser();ap.add_argument('--reference',type=Path,required=True);ap.add_argument('--candidate',type=Path);ap.add_argument('--out',type=Path,required=True);a=ap.parse_args();a.out.mkdir(parents=True,exist_ok=True)
HOOK=r'''
const __m={phase:{},messages:[],applied:[],sends:[],renders:[],enabled:false};window.__s2b=__m;
function __record(k,f){return function(...a){const t=performance.now();try{return f.apply(this,a);}finally{if(__m.enabled){const v=__m.phase[k]||(__m.phase[k]=[]);v.push(performance.now()-t);}}};}
render=__record('renderSubmission',render);updateSkin=__record('skinCPU',updateSkin);refreshLiveMeasurements=__record('measurementsCPU',refreshLiveMeasurements);updateGrabUI=__record('diagnosticsCPU',updateGrabUI);
const __flush=ProductWorkerShell.prototype.flushPose;ProductWorkerShell.prototype.flushPose=function(){const pending=this.pendingPose,t=performance.timeOrigin+performance.now();const r=__flush.call(this);if(pending&&__m.enabled)__m.applied.push({at:t,step:this.report().steps,received:this.receivedPoses});return r;};
const __render=render;render=function(...a){const t=performance.timeOrigin+performance.now();const r=__render(...a);if(__m.enabled)__m.renders.push({begin:t,end:performance.timeOrigin+performance.now(),step:productSolver?.report().steps,applied:productSolver?.appliedPoses});return r;};
__m.reset=()=>{__m.phase={};__m.messages=[];__m.applied=[];__m.sends=[];__m.renders=[];__m.enabled=true;};
__m.state=()=>({version:VERSION,product,physics:productSolver?.report(),triangles:renderer.info.render.triangles,calls:renderer.info.render.calls,geometry:renderer.info.memory.geometries});
'''
INIT=r'''(()=>{const OB=window.Blob,OW=window.Worker;
const tail=`const __old=self.onmessage;let __send=0,__handled=0;self.onmessage=e=>{if(e.data.__sent){__send=e.data.__sent;__handled=performance.timeOrigin+performance.now();}return __old(e);};const __post=self.postMessage.bind(self);self.postMessage=(m,t)=>{if(m.positions)m.__stamp={sent:__send,handled:__handled,emitted:performance.timeOrigin+performance.now()};return __post(m,t);};`;
window.Blob=class extends OB{constructor(parts,o){if(parts.length===1&&typeof parts[0]==='string'&&parts[0].includes('let shell=null,timer=null')){let s=parts[0],i=s.lastIndexOf('})();');if(i<0)throw Error('worker envelope');parts=[s.slice(0,i)+tail+s.slice(i)];}super(parts,o);}};
window.Worker=class extends OW{constructor(...a){super(...a);this.addEventListener('message',e=>{const m=e.data,d=window.__s2b;if(m.positions&&d?.enabled)d.messages.push({received:performance.timeOrigin+performance.now(),step:m.report.steps,input:m.inputSequence,solve:m.report.workerSolveMS,stamp:m.__stamp});});}postMessage(m,...a){if(m.op==='move'||m.op==='pick'){m={...m,__sent:performance.timeOrigin+performance.now()};if(window.__s2b?.enabled)window.__s2b.sends.push({at:m.__sent,seq:m.inputSequence,op:m.op});}return super.postMessage(m,...a);}};})();'''
def stats(v):
 v=sorted(x for x in v if x is not None and x>=0);return {'samples':len(v),'p50MS':v[(len(v)-1)//2] if v else None,'p95MS':v[min(len(v)-1,int(len(v)*.95))] if v else None,'maxMS':max(v) if v else None}
report={'pass':False,'method':'Unchanged HTML copied with explicit timing hooks; sequential actual pointer moves; CPU submission not GPU completion; message transfer+event-loop wait not browser-internal queue measurement','rows':[],'limits':['Software rendering only','8 input samples per repetition; exploratory, not universal latency certification','No pure GPU duration or separate GC attribution']}
def save(): (a.out/'profile.json').write_text(json.dumps(report,indent=2)+'\n')
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(executable_path=os.environ.get('KAOPU_CHROMIUM_EXECUTABLE','/usr/bin/google-chrome'),headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']);report.update(browser=b.version,platform=platform.platform())
  cases=[('reference',a.reference)]
  if a.candidate:cases += [('candidate',a.candidate),('candidate',a.candidate),('reference',a.reference)]
  for label,file in cases:
   src=file.read_text();assert src.count('boot().catch(fail);')==1
   f=a.out/(label+'-diagnostic.html');f.write_text(src.replace('boot().catch(fail);',HOOK+'\nboot().catch(fail);'))
   ctx=b.new_context(viewport={'width':1440,'height':1000});ctx.add_init_script(INIT);page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(f.as_uri(),wait_until='domcontentloaded');page.wait_for_function('window.LEATHER_ATELIER?.ready',timeout=180000)
   page.evaluate("LEATHER_ATELIER.selectProduct('wallet');LEATHER_ATELIER.configure({craft:'plain'});LEATHER_ATELIER.setView('home');LEATHER_ATELIER.render()")
   page.wait_for_function('LEATHER_ATELIER.productPhysics.version.startsWith("R09")',timeout=180000);page.wait_for_timeout(200)
   box=page.locator('#stage').bounding_box();x=box['x']+box['width']/2;y=box['y']+box['height']/2
   page.locator('#grabTool').click();page.mouse.move(x,y);page.mouse.down();page.wait_for_function('LEATHER_ATELIER.productPhysics.held');page.evaluate('__s2b.reset()')
   for i in range(8):
    seq=page.evaluate('LEATHER_ATELIER.productPhysics.inputSequence');page.mouse.move(x+(i%4-1.5)*4,y-12-i)
    page.wait_for_function('(seq)=>__s2b.messages.some(m=>m.input>seq)&&__s2b.applied.length>0',arg=seq,timeout=45000)
   page.mouse.up();page.evaluate('LEATHER_ATELIER.resetGrab()');page.wait_for_timeout(100)
   raw=page.evaluate('()=>{__s2b.enabled=false;return{...__s2b,state:__s2b.state(),reset:null};}')
   bystep={m['step']:m for m in raw['messages']};byseq={s['seq']:s['at'] for s in raw['sends']};first={}
   for m in raw['messages']:
    if m['input'] in byseq and m['input'] not in first:first[m['input']]=m['received']-byseq[m['input']]
   times={k:stats(v) for k,v in raw['phase'].items()}
   times['inputToReceive']=stats(list(first.values()));times['workerReturnToHandler']=stats([m['received']-m['stamp']['emitted'] for m in raw['messages'] if m.get('stamp')]);times['receiveToApply']=stats([p['at']-bystep[p['step']]['received'] for p in raw['applied'] if p['step'] in bystep]);times['workerSolve']=stats([m['solve'] for m in raw['messages']]);times['frameInterval']=stats([raw['renders'][i]['begin']-raw['renders'][i-1]['begin'] for i in range(1,len(raw['renders']))])
   row={'label':label,'inputSHA256':hashlib.sha256(file.read_bytes()).hexdigest(),'messages':len(raw['messages']),'applied':len(raw['applied']),'timings':times,'raw':raw,'errors':errors};report['rows'].append(row);save();assert not errors and len(first)>=8
   print(json.dumps({k:row[k] for k in ['label','messages','applied','timings']}),flush=True);ctx.close()
  b.close();report['pass']=True;save()
except Exception as e:report['failure']=str(e);report['traceback']=traceback.format_exc();save();raise
