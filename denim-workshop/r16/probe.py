"""Instrumented diagnostic only. Never shipped as the application runtime."""
from pathlib import Path
import shutil,subprocess,sys,json,time
from playwright.sync_api import sync_playwright
P=Path(__file__).resolve().parent;R=P.parent/'r15';T=P/'probe-runtime';T.mkdir(exist_ok=True)
for f in R.iterdir():
 if f.is_file() and (f.suffix in ['.js','.html','.py','.md'] or f.name=='LICENSE'):shutil.copy2(f,T/f.name)
s=(T/'app.js').read_text().replace('const gpuTimer=Budget.timer(gl);','const gpuTimer={start(){},end(){},supported:false};')
a=s.index('function uniforms(')
s=s[:a]+r'''
const pq=[],pl=new Map();let profileProgram=null;window.__drawProfile={pq,pl,enabled:false};
const originalUse=gl.useProgram.bind(gl);gl.useProgram=p=>{profileProgram=p;return originalUse(p);};
const profileExtension=gl.getExtension('EXT_disjoint_timer_query_webgl2');
for(const fn of ['drawElements','drawArrays','drawElementsInstanced']){const original=gl[fn].bind(gl);gl[fn]=(...args)=>{if(!window.__drawProfile.enabled||!profileExtension)return original(...args);const q=gl.createQuery();gl.beginQuery(profileExtension.TIME_ELAPSED_EXT,q);original(...args);gl.endQuery(profileExtension.TIME_ELAPSED_EXT);pq.push({q,label:pl.get(profileProgram)||'unknown',fn,count:args[1]});};}
window.__drawProfile.result=()=>{if(!profileExtension)return {supported:false};const out=[];for(const x of pq)if(gl.getQueryParameter(x.q,gl.QUERY_RESULT_AVAILABLE))out.push({label:x.label,fn:x.fn,count:x.count,ms:gl.getQueryParameter(x.q,gl.QUERY_RESULT)/1e6});return {supported:true,disjoint:gl.getParameter(profileExtension.GPU_DISJOINT_EXT),draws:out};};
''' + s[a:]
s=s.replace('window.__DENIM_WORKBENCH__={','for(const [name,p] of Object.entries({yarnProg,surfProg,seamProg,hairProg,looseProg,maskProg,macroShadowProg,studioProg,blit}))pl.set(p,name);\nwindow.__DENIM_WORKBENCH__={')
(T/'app.js').write_text(s);subprocess.run([sys.executable,str(T/'build.py')],check=True,stdout=subprocess.DEVNULL)
report={'instrumented':True,'softwareRenderer':True,'sixtyFPSAccepted':False,'stages':[],'errors':[],'source':'R15@895bf144e2a8e70b86f7f15cfeaedba2b4415170','note':'Per-draw asynchronous GPU query, not whole-page or consumer GPU FPS. First draw includes possible compilation.'}
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=False,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
 p=b.new_page(viewport={'width':1000,'height':780});p.set_default_timeout(240000);report['browser']=b.version
 p.on('pageerror',lambda e:report['errors'].append(str(e)))
 try:
  p.goto((T/'index.html').as_uri());p.wait_for_function('window.__DENIM_WORKBENCH__?.lastFrame||document.querySelector("#error")?.textContent?.trim()');assert not p.locator('#error').inner_text().strip();p.evaluate('window.A=__DENIM_WORKBENCH__');p.wait_for_function('A.physicsReady()&&A.renderIdle()');print('BASELINE READY',flush=True)
  p.evaluate('A.enterExperiment("fold",false)');p.wait_for_function('A.physicsReady()&&A.renderIdle()&&A.lastFrame.physics?.model==="continuous-curvature-sheet@1"');p.evaluate('A.advanceExperiment(3)');p.wait_for_function('A.lastFrame.physics.steps===720&&A.renderIdle()')
  for label,patch in [('normal-warm',{'zoom':.94}),('normal',{'zoom':.95}),('side-warm',{'zoom':1.45,'pitch':1.25}),('side',{'zoom':1.46})]:
   p.evaluate('__drawProfile.enabled=true;__drawProfile.pq.length=0');old=p.evaluate('A.lastFrame.frame');start=time.perf_counter();p.evaluate('(x)=>A.setState(x)',patch);p.wait_for_function('(n)=>A.lastFrame.frame>n&&A.renderIdle()',arg=old)
   result=p.evaluate('__drawProfile.result()');result.update(label=label,wallMs=(time.perf_counter()-start)*1000,frame=p.evaluate('A.lastFrame'));report['stages'].append(result);p.evaluate('__drawProfile.enabled=false')
   sums={}
   for x in result.get('draws',[]):sums[x['label']]=sums.get(x['label'],0)+x['ms']
   print(label,json.dumps(sums),flush=True)
  report['passed']=not report['errors'] and all(not s.get('disjoint',True) for s in report['stages'])
 finally:
  (P/'BASELINE_PROFILE.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));b.close()
assert report.get('passed'),report
