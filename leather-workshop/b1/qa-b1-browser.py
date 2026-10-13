"""B1 uninstrumented functionality/endurance, plus explicitly separate GPU readback QA."""
from pathlib import Path
import os,json,time,traceback,argparse,hashlib,io
from playwright.sync_api import sync_playwright
from PIL import Image,ImageChops,ImageStat
R=Path(__file__).resolve().parent
ap=argparse.ArgumentParser();ap.add_argument('--mode',choices=['smoke','extended','soak'],default='extended');a=ap.parse_args();O=R/'qa/b1'/a.mode;O.mkdir(parents=True,exist_ok=True)
result={'version':'R17.0-B1','mode':a.mode,'pass':False,'checks':[],'errors':[],'scope':'Actual Chrome software WebGL, not a physical GPU or phone. Ten-minute soak is a timed single session, not all-device certification.'}
def save():(O/'report.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
def check(n,p,d=None):
 result['checks'].append({'name':n,'pass':bool(p),'data':d});save();print(n,bool(p),flush=True)
 if not p:raise AssertionError(n)
READBACK=r'''
window.__b1CacheRead=()=>{hero.updateMatrixWorld(true);const c=hero.userData.rig.poseCache;c.prepare();const g=renderer.getContext();let max=0,n=0,minLength=Infinity,maxLength=0;const out=new Float32Array(3);for(const e of c.entries){const mesh=hero.userData.rig.meshes.find(m=>m.geometry===e.geometry);for(let i=0;i<e.count;i+=Math.max(1,Math.floor(e.count/8))){g.bindBuffer(g.COPY_READ_BUFFER,e.outputs[0]);g.getBufferSubData(g.COPY_READ_BUFFER,i*12,out);const p=new T.Vector3().fromArray(out).applyMatrix4(mesh.matrixWorld),q=evaluateBoundVertex(mesh,hero.userData.rig,i);max=Math.max(max,p.distanceTo(q));g.bindBuffer(g.COPY_READ_BUFFER,e.outputs[1]);g.getBufferSubData(g.COPY_READ_BUFFER,i*12,out);const len=Math.hypot(...out);minLength=Math.min(minLength,len);maxLength=Math.max(maxLength,len);n++;}}g.bindBuffer(g.COPY_READ_BUFFER,null);renderer.resetState();return {maxPositionDifferenceMM:max,samples:n,minNormalLength:minLength,maxNormalLength:maxLength,glError:g.getError()};};
'''
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ.get('KAOPU_CHROMIUM_EXECUTABLE','/usr/bin/google-chrome'),headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']);result['browser']=b.version
 def page_for(url):
  ctx=b.new_context(viewport={'width':1440,'height':1000},offline=True);p=ctx.new_page();p.set_default_timeout(180000);p.on('pageerror',lambda e:result['errors'].append(str(e)));p.on('console',lambda e:result['errors'].append(e.text) if e.type=='error' else None);p.goto(url,wait_until='domcontentloaded',timeout=120000);p.wait_for_function('window.LEATHER_ATELIER?.ready || !document.getElementById("error").hidden',timeout=240000);check('Runtime opens '+a.mode,p.evaluate('window.LEATHER_ATELIER?.ready') is True,p.locator('#error').inner_text());return ctx,p
 try:
  ctx,p=page_for((R/'out/candidate-r17.html').as_uri());check('Source identity',p.evaluate('LEATHER_ATELIER.snapshot().sourceCommit')==os.environ['LEATHER_SOURCE_COMMIT']);check('Cache present and computed before first frame',p.evaluate('LEATHER_ATELIER.b1Report().resources.poseCache.updates>0'))
  if a.mode=='smoke':
   p.evaluate('async()=>{LEATHER_ATELIER.selectProduct("wallet");LEATHER_ATELIER.configure({craft:"plain"});await LEATHER_ATELIER.stepProduct(3);LEATHER_ATELIER.render();}');check('Wallet GPU cache and real worker render',p.evaluate('LEATHER_ATELIER.audit().finite && LEATHER_ATELIER.b1Report().resources.poseCache.updates>0'))
  elif a.mode=='extended':
   check('Default presentation keeps raw diagnostics out of the way',not p.locator('#b1Details').is_visible());p.locator('#b1Diagnostics').click();check('Diagnostic mode reveals truthful solver status',p.locator('#b1Details').is_visible() and '未实物标定' in p.locator('#b1Details').inner_text());p.locator('#b1Diagnostics').click()
   for ident in ['wallet','swatch','bag']:
    p.evaluate('async id=>{LEATHER_ATELIER.selectProduct(id);LEATHER_ATELIER.configure({craft:"plain"});await LEATHER_ATELIER.resetGrab();LEATHER_ATELIER.render();}',ident);before=p.evaluate('LEATHER_ATELIER.b1Report().resources.poseCache');p.evaluate('()=>{LEATHER_ATELIER.render();LEATHER_ATELIER.render();LEATHER_ATELIER.render();}');after=p.evaluate('LEATHER_ATELIER.b1Report().resources.poseCache');check('Repeated camera draws reuse '+ident,after['updates']==before['updates'] and after['reusedDraws']>=before['reusedDraws']+3,{'before':before,'after':after});p.evaluate('LEATHER_ATELIER.stepProduct(1)');p.evaluate('LEATHER_ATELIER.render()');check('Actual new pose invalidates '+ident,p.evaluate('LEATHER_ATELIER.b1Report().resources.poseCache.updates')>after['updates'])
   p.evaluate('LEATHER_ATELIER.selectProduct("wallet")');p.locator('#resetProduct').click();p.wait_for_function('LEATHER_ATELIER.productPhysics.steps===0');p.locator('#b1Recover').click();check('Explicit current-test rebuild has exactly one live cache',p.evaluate('LEATHER_ATELIER.b1Report().resources.allPoseCaches.live')==1)
   refctx,ref=page_for((R.parent/'r16/public-lite.html').as_uri())
   for ident in ['wallet','swatch','bag']:
    for page in [ref,p]:page.add_style_tag(content='#stageLabel{visibility:hidden!important}');page.evaluate('async id=>{LEATHER_ATELIER.selectProduct(id);LEATHER_ATELIER.configure({craft:"plain"});LEATHER_ATELIER.selectMaterial("heritage");await LEATHER_ATELIER.resetGrab();await LEATHER_ATELIER.stepProduct(8);LEATHER_ATELIER.setView("home");LEATHER_ATELIER.render();}',ident)
    im=[]
    for label,page in [('reference',ref),('candidate',p)]:
     data=page.locator('#stage').screenshot();(O/(label+'-deformed-'+ident+'.png')).write_bytes(data);im.append(Image.open(io.BytesIO(data)).convert('RGB'))
    d=ImageChops.difference(*im);mean=sum(ImageStat.Stat(d).mean)/3;fraction=sum(d.convert('L').histogram()[3:])/(d.width*d.height);check('Deformed pixels '+ident,mean<=.02 and fraction<=.0005,{'meanRGB':mean,'changedFraction':fraction,'maxChannel':max(v[1] for v in d.getextrema())})
   refctx.close();ctx.close()
   s=(R/'out/candidate-r17.html').read_text();copy=O/'readback-only.html';copy.write_text(s.replace('boot().catch(fail);',READBACK+'\nboot().catch(fail);'));ctx,p=page_for(copy.as_uri());result['readbackScope']='Separate diagnostic copy only; not used for performance or uninstrumented release checks.'
   for ident in ['wallet','belt','bag','cowboy','pirate','swatch']:
    p.evaluate('async id=>{LEATHER_ATELIER.selectProduct(id);LEATHER_ATELIER.configure({craft:"plain"});await LEATHER_ATELIER.stepProduct(8);LEATHER_ATELIER.render();}',ident);q=p.evaluate('__b1CacheRead()');check('GPU coordinates agree with live CPU evaluator '+ident,q['samples']>0 and q['maxPositionDifferenceMM']<.003 and q['minNormalLength']>.9999 and q['maxNormalLength']<1.0001 and q['glError']==0,q)
  else:
   started=time.perf_counter();cdp=ctx.new_cdp_session(p);resources=[]
   for cycle in range(4):
    for ident in ['wallet','belt','bag','cowboy','pirate','swatch']:
     p.evaluate('async id=>{LEATHER_ATELIER.selectProduct(id);LEATHER_ATELIER.configure({craft:"plain"});await LEATHER_ATELIER.stepProduct(1);LEATHER_ATELIER.render();}',ident)
    p.evaluate('LEATHER_ATELIER.selectProduct("wallet");LEATHER_ATELIER.configure({craft:"plain"});LEATHER_ATELIER.render()');cdp.send('HeapProfiler.collectGarbage');q=p.evaluate('LEATHER_ATELIER.b1Report()');q['heap']=cdp.send('Runtime.getHeapUsage');resources.append(q);check('Six-product rebuild cycle '+str(cycle),q['resources']['allPoseCaches']['live']==1 and not q['physics']['failed'],q['resources'])
   result['productSelectionCommands']=28;result['configureRebuildCommands']=28;result['actualCacheCreationsAtEnd']=resources[-1]['resources']['allPoseCaches']['created'];result['resourceSeries']=resources
   check('Post-warm-up geometry and texture counts remain bounded',resources[-1]['resources']['geometries']<=resources[1]['resources']['geometries']+2 and resources[-1]['resources']['textures']<=resources[1]['resources']['textures']+2)
   check('Retained heap does not grow by more than 32 MiB after warm-up',resources[-1]['heap']['usedSize']<=resources[1]['heap']['usedSize']+32*1048576,{'first':resources[1]['heap'],'last':resources[-1]['heap']})
   for _ in range(4):p.evaluate('LEATHER_ATELIER.switchMode("physics")');p.wait_for_function('LEATHER_ATELIER.physics?.steps>0');p.evaluate('LEATHER_ATELIER.pausePhysics()');p.locator('#resetPhysics').click();p.wait_for_function('LEATHER_ATELIER.physics?.steps>0');p.evaluate('LEATHER_ATELIER.switchMode("products")')
   p.evaluate('async()=>{LEATHER_ATELIER.selectProduct("wallet");LEATHER_ATELIER.configure({craft:"plain"});await LEATHER_ATELIER.resetGrab();LEATHER_ATELIER.setView("home");LEATHER_ATELIER.render();}');p.mouse.move(0,0);p.locator('#grabTool').click();box=p.locator('#stage').bounding_box();x=box['x']+box['width']/2;y=box['y']+box['height']/2;p.mouse.move(x,y);p.mouse.down();p.wait_for_function('LEATHER_ATELIER.productPhysics.held');heldStart=time.perf_counter();count=0;beats=[]
   while time.perf_counter()-heldStart<600:
    count+=1;p.mouse.move(x+(count%5-2)*2,y-25-(count%3)*2,steps=2);p.wait_for_timeout(700)
    if count%20==0:
     q=p.evaluate('LEATHER_ATELIER.b1Report()');check('Continuous grab heartbeat '+str(count),q['physics']['finite'] and not q['physics']['failed'] and q['resources']['allPoseCaches']['live']==1,{'seconds':time.perf_counter()-heldStart,'physicsSeconds':q['physics']['timeS'],'resources':q['resources']});beats.append(q)
   result.update(continuousHeldSeconds=time.perf_counter()-heldStart,pointerMoves=count*2,sessionSeconds=time.perf_counter()-started,heartbeats=beats);p.mouse.up();p.keyboard.press('Escape');p.evaluate('LEATHER_ATELIER.resetGrab()');q=p.evaluate('LEATHER_ATELIER.b1Report()');check('Release/reset after ten-minute continuous grab',not q['physics']['held'] and not q['physics']['failed'] and q['physics']['steps']==0);check('Completed measured ten-minute grab',result['continuousHeldSeconds']>=600)
  check('No application or WebGL errors',not result['errors'],result['errors']);result['pass']=True
 except Exception as e:result['error']=str(e);result['trace']=traceback.format_exc();raise
 finally:save();b.close()
