"""ABBA on the same machine; diagnostic copies only. No physical-screen claim."""
from pathlib import Path
import os,json,time,hashlib,traceback
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parent;O=R/'qa/b1/performance';O.mkdir(parents=True,exist_ok=True)
HOOK=r'''
let __manual=false,__blocked=false;const __original=render;
render=function(...a){if(__blocked&&!__manual)return;return __original(...a);};
window.__b1Perf={lock(){__blocked=true;},async sample(shadow){const g=renderer.getContext(),ext=g.getExtension('EXT_disjoint_timer_query_webgl2');if(!ext)return{supported:false};const q=g.createQuery();if(shadow)renderer.shadowMap.needsUpdate=true;const start=performance.now();g.beginQuery(ext.TIME_ELAPSED_EXT,q);__manual=true;try{render();}finally{__manual=false;g.endQuery(ext.TIME_ELAPSED_EXT);}const cpu=performance.now()-start;for(let i=0;i<1200;i++){if(g.getQueryParameter(q,g.QUERY_RESULT_AVAILABLE)){const disjoint=g.getParameter(ext.GPU_DISJOINT_EXT),ms=g.getQueryParameter(q,g.QUERY_RESULT)/1e6;g.deleteQuery(q);const e=g.getExtension('WEBGL_debug_renderer_info');return{supported:true,disjoint,gpuMS:ms,cpuMS:cpu,renderer:e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):'unknown',triangles:renderer.info.render.triangles,cache:hero?.userData.rig?.poseCache?.report()||null};}await new Promise(r=>setTimeout(r,10));}g.deleteQuery(q);throw Error('GPU measurement did not complete');}};
'''
report={'pass':False,'order':['reference','candidate','candidate','reference'],'samplesPerState':8,'rows':[],'errors':[],'scope':'Asynchronous WebGL GPU timer queries on the reported backend, including cache preparation. Not screen latency. State: cached camera redraw or changed pose plus shadow. Two warm-ups, all eight samples retained.','gate':{'cachedMedianRatioMax':.85,'changedPoseMedianRatioMax':1.10}}
def save():(O/'report.json').write_text(json.dumps(report,indent=2)+'\n')
def med(v):return sorted(v)[(len(v)-1)//2]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('KAOPU_CHROMIUM_EXECUTABLE','/usr/bin/google-chrome'),headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']);report['browser']=b.version
 try:
  for repetition,label in enumerate(report['order']):
   path=R.parent/'r16/public-lite.html' if label=='reference' else R/'out/candidate-r17.html';s=path.read_text();assert s.count('boot().catch(fail);')==1;copy=O/(label+'.html');copy.write_text(s.replace('boot().catch(fail);',HOOK+'\nboot().catch(fail);'))
   ctx=b.new_context(viewport={'width':1440,'height':1000});page=ctx.new_page();page.set_default_timeout(180000);page.on('pageerror',lambda e:report['errors'].append(str(e)));page.goto(copy.resolve().as_uri(),wait_until='domcontentloaded');page.wait_for_function('window.LEATHER_ATELIER?.ready',timeout=240000);page.evaluate('__b1Perf.lock()')
   for ident in ['wallet','swatch','bag']:
    page.evaluate('async id=>{LEATHER_ATELIER.selectProduct(id);LEATHER_ATELIER.configure({craft:"plain"});LEATHER_ATELIER.selectMaterial("heritage");await LEATHER_ATELIER.resetGrab();LEATHER_ATELIER.setView("home");}',ident)
    for state in ['cached-camera','changed-pose-shadow']:
     values=[]
     for k in range(10):
      if state=='changed-pose-shadow':page.evaluate('LEATHER_ATELIER.stepProduct(1)')
      q=page.evaluate('(s)=>__b1Perf.sample(s)',state=='changed-pose-shadow');assert q['supported'] and not q['disjoint'],q
      if k>=2:values.append(q)
     row={'label':label,'repetition':repetition,'product':ident,'state':state,'samples':values,'medianGPUMS':med([q['gpuMS'] for q in values])};report['rows'].append(row);save();print(label,ident,state,row['medianGPUMS'],flush=True)
   ctx.close()
  comparisons=[]
  for product in ['wallet','swatch','bag']:
   for state in ['cached-camera','changed-pose-shadow']:
    data={l:[s['gpuMS'] for r in report['rows'] if r['product']==product and r['state']==state and r['label']==l for s in r['samples']] for l in ['reference','candidate']};a,c=med(data['reference']),med(data['candidate']);limit=.85 if state=='cached-camera' else 1.1;comparisons.append({'product':product,'state':state,'referenceMedianMS':a,'candidateMedianMS':c,'ratio':c/a,'pass':c/a<=limit})
  report['comparisons']=comparisons;assert not report['errors'],report['errors'];report['performanceGatesPass']=all(q['pass'] for q in comparisons);report['pass']=report['performanceGatesPass'];save()
  if not report['pass']:raise AssertionError('Predeclared B1 performance gates not met')
 except Exception as e:report['error']=str(e);report['trace']=traceback.format_exc();raise
 finally:save();b.close()
