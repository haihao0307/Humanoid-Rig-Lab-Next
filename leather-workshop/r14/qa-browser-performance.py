"""Browser-only timings: probe does not change the delivered runtime.
Primary reference: MDN performance.timeOrigin (window and Worker clocks differ).
"""
from pathlib import Path
import json,os,time,platform,statistics
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parent;O=R/'qa/s2';O.mkdir(parents=True,exist_ok=True)
PROBE=r'''(()=>{
const data=window.__s2Timing={latencies:[],handleDelays:[],returnDelays:[],solve:[],raf:[],instrumented:0};
const OriginalBlob=window.Blob,OriginalWorker=window.Worker;
const addition=`
const __s2OriginalMessage=self.onmessage;let __s2Sent=0,__s2Handled=0;
self.onmessage=e=>{if(e.data.__s2Sent){__s2Sent=e.data.__s2Sent;__s2Handled=performance.timeOrigin+performance.now();}return __s2OriginalMessage(e);};
const __s2Post=self.postMessage.bind(self);
self.postMessage=(m,t)=>{if(m.positions){m.__s2Times={sent:__s2Sent,handled:__s2Handled,returned:performance.timeOrigin+performance.now()};}return __s2Post(m,t);};
`;
window.Blob=class extends OriginalBlob{constructor(parts,options){if(parts.length===1&&typeof parts[0]==='string'&&parts[0].includes('let shell=null,timer=null')){const x=parts[0],i=x.lastIndexOf('})();');if(i<0)throw Error('Unexpected worker envelope');parts=[x.slice(0,i)+addition+x.slice(i)];data.instrumented++;}super(parts,options);}};
window.Worker=class extends OriginalWorker{constructor(...a){super(...a);const sent=new Map();this.__s2Sent=sent;this.addEventListener('message',e=>{const m=e.data,t=performance.timeOrigin+performance.now();if(m.positions){if(m.report?.workerSolveMS>0)data.solve.push(m.report.workerSolveMS);if(sent.has(m.inputSequence)){data.latencies.push(t-sent.get(m.inputSequence));sent.delete(m.inputSequence);}if(m.__s2Times?.sent){data.handleDelays.push(m.__s2Times.handled-m.__s2Times.sent);data.returnDelays.push(t-m.__s2Times.returned);}}});}postMessage(m,...a){if(m.op==='move'||m.op==='pick'){m={...m,__s2Sent:performance.timeOrigin+performance.now()};this.__s2Sent.set(m.inputSequence,m.__s2Sent);if(this.__s2Sent.size>100)this.__s2Sent.delete(this.__s2Sent.keys().next().value);}return super.postMessage(m,...a);}};
let last;function frame(t){if(last)data.raf.push(t-last);last=t;if(data.raf.length<3000)requestAnimationFrame(frame);}requestAnimationFrame(frame);
})();'''
def pct(v,p):
 v=sorted(x for x in v if x>=0);return {'samples':len(v),'p50MS':v[(len(v)-1)//2] if v else None,'p95MS':v[min(len(v)-1,int(len(v)*.95))] if v else None}
rows=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=os.environ.get('KAOPU_CHROMIUM_EXECUTABLE','/usr/bin/google-chrome'),headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'])
 for label,file in [('reference',R.parent/'r13/public-lite.html'),('candidate',R/'out/candidate-r14.html')]:
  ctx=browser.new_context(viewport={'width':1440,'height':1000});ctx.add_init_script(PROBE);p=ctx.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.goto(file.as_uri(),wait_until='domcontentloaded');p.wait_for_function('LEATHER_ATELIER?.ready',timeout=180000)
  p.evaluate("LEATHER_ATELIER.selectProduct('wallet');LEATHER_ATELIER.configure({craft:'plain'});LEATHER_ATELIER.setView('home');LEATHER_ATELIER.render()")
  p.wait_for_function('LEATHER_ATELIER.productPhysics.version.startsWith("R09")');p.wait_for_timeout(150)
  box=p.locator('#stage').bounding_box();x=box['x']+box['width']/2;y=box['y']+box['height']/2
  p.locator('#grabTool').click();p.mouse.move(x,y);p.mouse.down();p.wait_for_function('LEATHER_ATELIER.productPhysics.held')
  p.evaluate('for(const k of ["latencies","handleDelays","returnDelays","solve","raf"])__s2Timing[k]=[]')
  for i in range(16):
   n=p.evaluate('__s2Timing.latencies.length');p.mouse.move(x+(i%4-1.5)*4,y-12-i)
   p.wait_for_function('(n)=>__s2Timing.latencies.length>n',arg=n,timeout=30000)
  p.mouse.up();p.evaluate('LEATHER_ATELIER.resetGrab()');p.wait_for_timeout(150)
  q=p.evaluate('__s2Timing');assert q['instrumented']>0 and len(q['latencies'])>=16 and not errors
  render=p.evaluate('()=>{const a=[];for(let i=0;i<24;i++){const t=performance.now();LEATHER_ATELIER.render();a.push(performance.now()-t);}return a;}')
  rows.append({'version':label,'timings':{k:pct(v,.95) for k,v in q.items() if isinstance(v,list)},'raw':q,'renderSubmissionCPU':pct(render,.95),'errors':errors});ctx.close()
 result={'pass':True,'sourceCommit':os.environ.get('LEATHER_SOURCE_COMMIT'),'browser':browser.version,'platform':platform.platform(),'viewport':[1440,1000],'rendering':'Chrome SwiftShader software rendering; not a user GPU or phone','rows':rows,'method':'16 sequential real pointer moves; instrumented worker timestamps are synchronized with timeOrigin. Ordinary uninstrumented release/visual checks run separately.','limitations':['handleDelays combines message transport and time until worker handler, not pure queue length','returnDelays combines worker return delivery and main-thread wait','renderSubmissionCPU is synchronous API submission, not GPU completion','raf intervals include the probe session, not a fixed-FPS guarantee','browser GC and GPU duration unavailable; Node GC/skin/native profiles recorded separately']}
 (O/'browser-performance.json').write_text(json.dumps(result,indent=2)+'\n');browser.close();print(json.dumps({'pass':True,'rows':[{'version':r['version'],'timings':r['timings']} for r in rows]}))
