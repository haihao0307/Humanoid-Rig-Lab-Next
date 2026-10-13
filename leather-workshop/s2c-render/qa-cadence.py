"""Diagnostic copies only. GPU query results are not monitor presentation times.
Primary APIs: https://developer.mozilla.org/en-US/docs/Web/API/EXT_disjoint_timer_query
https://threejs.org/manual/en/rendering-on-demand.html
Never change managed browser policy; CI uses its normally permitted browser.
"""
from pathlib import Path
import argparse,json,os,time,hashlib,traceback
from playwright.sync_api import sync_playwright
ap=argparse.ArgumentParser();ap.add_argument('--page',type=Path,required=True);ap.add_argument('--out',type=Path,required=True);a=ap.parse_args();a.out.mkdir(parents=True,exist_ok=True)
HOOK=r'''
const __cad={enabled:false,force:false,skip:false,frames:[],draws:[],ticks:[],tasks:[],gpu:[],pending:[],phase:''};window.__cad=__cad;
const __oldLoop=loop;loop=function(t){if(__cad.enabled)__cad.frames.push({t,now:performance.now(),hidden:document.hidden,focus:document.hasFocus(),dirty,allDirty,pending:!!productSolver?.pendingPose,step:productSolver?.report().steps});if(__cad.force)dirty=true;return __oldLoop(t);};
const __oldRender=render;let __ext=null,__gl=null;
render=function(t){if(__cad.skip)return;const start=performance.now();let q=null;
 if(__cad.enabled){__gl=renderer.getContext();__ext=__gl.getExtension('EXT_disjoint_timer_query_webgl2');if(__ext&&__cad.pending.length<4){q=__gl.createQuery();__gl.beginQuery(__ext.TIME_ELAPSED_EXT,q);}}
 try{return __oldRender(t);}finally{if(q){__gl.endQuery(__ext.TIME_ELAPSED_EXT);__cad.pending.push(q);}if(__cad.enabled)__cad.draws.push({start,end:performance.now(),step:productSolver?.report().steps,applied:productSolver?.appliedPoses,received:productSolver?.receivedPoses,triangles:renderer.info.render.triangles,calls:renderer.info.render.calls});}
};
setInterval(()=>{if(!__cad.enabled)return;__cad.ticks.push(performance.now());if(__ext&&__gl){const disjoint=__gl.getParameter(__ext.GPU_DISJOINT_EXT);__cad.pending=__cad.pending.filter(q=>{if(!__gl.getQueryParameter(q,__gl.QUERY_RESULT_AVAILABLE))return true;if(!disjoint)__cad.gpu.push(__gl.getQueryParameter(q,__gl.QUERY_RESULT)/1e6);__gl.deleteQuery(q);return false;});}},50);
try{new PerformanceObserver(list=>{if(__cad.enabled)for(const e of list.getEntries())__cad.tasks.push({start:e.startTime,duration:e.duration});}).observe({type:'longtask',buffered:false});}catch(e){__cad.longTasksUnavailable=String(e);}
__cad.start=(phase,force=false,skip=false)=>{Object.assign(__cad,{phase,force,skip,frames:[],draws:[],ticks:[],tasks:[],gpu:[],enabled:true});};
__cad.stop=()=>{__cad.enabled=false;__cad.force=false;__cad.skip=false;const g=renderer.getContext(),ext=g.getExtension('WEBGL_debug_renderer_info');return{phase:__cad.phase,frames:__cad.frames,draws:__cad.draws,ticks:__cad.ticks,tasks:__cad.tasks,gpu:__cad.gpu,gpuQuerySupported:!!g.getExtension('EXT_disjoint_timer_query_webgl2'),renderer:ext?g.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unavailable',visibility:document.visibilityState,focus:document.hasFocus(),documentURL:location.protocol,viewport:[innerWidth,innerHeight,devicePixelRatio],glAttributes:g.getContextAttributes(),nativePhysics:productSolver?.report(),geometries:renderer.info.memory.geometries,canvasRect:renderer.domElement.getBoundingClientRect().toJSON()};};
'''
def stats(v):
 s=sorted(v);return {'n':len(s),'p50MS':s[(len(s)-1)//2] if s else None,'p95MS':s[min(len(s)-1,int(len(s)*.95))] if s else None,'maxMS':max(s) if s else None}
def intervals(rows,key=None):
 v=[x[key] if key else x for x in rows];return [b-c for c,b in zip(v,v[1:])]
data=a.page.read_text();assert data.count('boot().catch(fail);')==1
copy=a.out/'diagnostic.html';copy.write_text(data.replace('boot().catch(fail);',HOOK+'\nboot().catch(fail);'))
result={'sourceHTMLSHA256':hashlib.sha256(a.page.read_bytes()).hexdigest(),'pass':False,'rows':[],'errors':[],'scope':'Diagnostic copy, native browser requestAnimationFrame intervals and asynchronous GPU queries; no physical monitor latency claim'}
def save():(a.out/'cadence.json').write_text(json.dumps(result,indent=2)+'\n')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('KAOPU_CHROMIUM_EXECUTABLE','/usr/bin/google-chrome'),headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'])
 page=b.new_page(viewport={'width':1440,'height':1000});page.on('pageerror',lambda e:result['errors'].append(str(e)))
 try:
  page.goto(copy.resolve().as_uri(),wait_until='domcontentloaded',timeout=120000);page.wait_for_function('window.LEATHER_ATELIER?.ready',timeout=240000);result['browser']=b.version
  page.evaluate("LEATHER_ATELIER.selectProduct('wallet');LEATHER_ATELIER.configure({craft:'plain'});LEATHER_ATELIER.setView('home');LEATHER_ATELIER.render();")
  page.wait_for_timeout(700)
  for phase,force,skip in [('idle',False,False),('continuous-static',True,False),('callbacks-without-draw',True,True)]:
   page.evaluate('(v)=>__cad.start(...v)',[phase,force,skip]);page.evaluate('()=>new Promise(r=>setTimeout(r,4500))');row=page.evaluate('__cad.stop()');row['metrics']={'rAF':stats(intervals(row['frames'],'t')),'drawInterval':stats(intervals(row['draws'],'start')),'renderCPU':stats([q['end']-q['start'] for q in row['draws']]),'timer':stats(intervals(row['ticks'])),'gpuDuration':stats(row['gpu'])};result['rows'].append(row);save();print(phase,row['metrics'],row['visibility'],row['renderer'],flush=True)
  page.locator('#grabTool').click();box=page.locator('#stage').bounding_box();x=box['x']+box['width']/2;y=box['y']+box['height']/2;page.mouse.move(x,y);page.mouse.down();page.wait_for_function('LEATHER_ATELIER.productPhysics.held');page.evaluate("__cad.start('grab',false,false)");page.mouse.move(x+15,y-40,steps=8);page.evaluate('()=>new Promise(r=>setTimeout(r,5000))');row=page.evaluate('__cad.stop()');page.mouse.up();row['metrics']={'rAF':stats(intervals(row['frames'],'t')),'drawInterval':stats(intervals(row['draws'],'start')),'renderCPU':stats([q['end']-q['start'] for q in row['draws']]),'timer':stats(intervals(row['ticks'])),'gpuDuration':stats(row['gpu'])};result['rows'].append(row);print('grab',row['metrics'],flush=True)
  assert not result['errors'],result['errors'];assert all(len(q['frames'])>0 for q in result['rows']);result['pass']=True
 except Exception as e:result['error']=str(e);result['trace']=traceback.format_exc();raise
 finally:save();b.close()
