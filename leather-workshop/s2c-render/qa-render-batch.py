"""Uninstrumented lifecycle/sustained-operation checks; separate GPU copies."""
from pathlib import Path
import argparse,json,os,time,traceback,hashlib,io
from playwright.sync_api import sync_playwright
from PIL import Image,ImageChops,ImageStat
R=Path(__file__).resolve().parent
ap=argparse.ArgumentParser();ap.add_argument('--url');ap.add_argument('--gpu',action='store_true');a=ap.parse_args();O=R/'qa/render-batch'/('gpu' if a.gpu else 'extended');O.mkdir(parents=True,exist_ok=True)
report={'pass':False,'checks':[],'errors':[],'scope':'Actual browser with separate GPU diagnostic; not physical monitor or physical phone certification'}
def save():(O/'report.json').write_text(json.dumps(report,indent=2)+'\n')
def check(n,p,data=None):
 report['checks'].append({'name':n,'pass':bool(p),'data':data});save();print(n,bool(p),flush=True)
 if not p:raise AssertionError(n)
def stats(v):
 s=sorted(v);return {'n':len(v),'p50MS':s[(len(s)-1)//2] if s else None,'p95MS':s[min(len(s)-1,int(len(s)*.95))] if s else None}
GPUHOOK=r'''
window.__gpuRun=async()=>{
 const gl=renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2'),di=gl.getExtension('WEBGL_debug_renderer_info');
 const info={renderer:di?gl.getParameter(di.UNMASKED_RENDERER_WEBGL):'unavailable',supported:!!ext,measurements:[],visibility:document.visibilityState,focus:document.hasFocus(),viewport:[innerWidth,innerHeight,devicePixelRatio]};
 if(!ext)return info;
 for(let i=0;i<8;i++){
  const q=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,q);const start=performance.now();render();const cpu=performance.now()-start;gl.endQuery(ext.TIME_ELAPSED_EXT);const submitted=performance.now();
  while(!gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE)){if(performance.now()-submitted>15000)throw Error('GPU query timed out');await new Promise(r=>setTimeout(r,20));}
  const disjoint=gl.getParameter(ext.GPU_DISJOINT_EXT);if(!disjoint)info.measurements.push({gpuMS:gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6,cpuMS:cpu,triangles:renderer.info.render.triangles,calls:renderer.info.render.calls});gl.deleteQuery(q);
 }
 return info;
};
'''
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=os.environ.get('KAOPU_CHROMIUM_EXECUTABLE','/usr/bin/google-chrome'),headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']);report['browser']=browser.version
 def new(label,url):
  ctx=browser.new_context(viewport={'width':1440,'height':1000});p=ctx.new_page();p.set_default_timeout(180000);p.on('pageerror',lambda e:report['errors'].append({'label':label,'message':str(e)}));p.goto(url,wait_until='domcontentloaded',timeout=120000);p.wait_for_function('window.LEATHER_ATELIER?.ready',timeout=240000);return ctx,p
 try:
  if a.gpu:
   report['order']=['reference','candidate','candidate','reference'];rows=[]
   for index,label in enumerate(report['order']):
    source=R.parent/'r15/public-lite.html' if label=='reference' else R/'out/candidate-r16.html';s=source.read_text();assert s.count('boot().catch(fail);')==1;pfile=O/(label+'.html');pfile.write_text(s.replace('boot().catch(fail);',GPUHOOK+'\nboot().catch(fail);'));ctx,p=new(label,pfile.resolve().as_uri())
    for product in ['wallet','swatch','bag']:
     p.evaluate('(id)=>{LEATHER_ATELIER.selectProduct(id);LEATHER_ATELIER.configure({craft:"plain"});LEATHER_ATELIER.setView("home");LEATHER_ATELIER.render();}',product);p.wait_for_timeout(500);q=p.evaluate('__gpuRun()');q.update(label=label,iteration=index,product=product,inputSHA256=hashlib.sha256(source.read_bytes()).hexdigest());q['gpu']=stats([x['gpuMS'] for x in q['measurements'][2:]]);q['cpu']=stats([x['cpuMS'] for x in q['measurements'][2:]]);rows.append(q);report['rows']=rows;save();print(label,product,q['gpu'],flush=True)
    ctx.close()
   check('ABBA timing has valid non-disjoint GPU samples',all(not q['supported'] or q['gpu']['n']>=4 for q in rows))
  else:
   ctx,p=new('candidate',a.url or (R/'out/candidate-r16.html').resolve().as_uri());p.mouse.move(0,0)
   p.evaluate("async()=>{LEATHER_ATELIER.selectProduct('wallet');LEATHER_ATELIER.configure({craft:'plain'});LEATHER_ATELIER.selectMaterial('heritage');await LEATHER_ATELIER.resetGrab();LEATHER_ATELIER.render();}")
   p.wait_for_timeout(900);before=p.evaluate('LEATHER_ATELIER.presentation()');p.wait_for_timeout(600);after=p.evaluate('LEATHER_ATELIER.presentation()');check('Settled scene has no periodic frame polling',after['callbacks']==before['callbacks'] and not after['frameQueued'],{'before':before,'after':after})
   p.locator('[data-product="wallet"]').hover();p.wait_for_timeout(300);before=p.evaluate('LEATHER_ATELIER.presentation()');p.wait_for_timeout(800);after=p.evaluate('LEATHER_ATELIER.presentation()');check('Thumbnail animation does not redraw unchanged hero',after['sceneDraws']==before['sceneDraws'] and after['thumbnailDraws']>before['thumbnailDraws'],{'before':before,'after':after})
   p.mouse.move(0,0);p.wait_for_timeout(500);before=p.evaluate('LEATHER_ATELIER.presentation()');p.evaluate('()=>{for(let i=0;i<200;i++)LEATHER_ATELIER.setView("home")}');p.wait_for_timeout(900);after=p.evaluate('LEATHER_ATELIER.presentation()');check('Two hundred synchronous view commands share a single frame',after['callbacks']-before['callbacks']<=2 and after['sceneDraws']>before['sceneDraws'],{'before':before,'after':after})
   for i in range(24):
    product=['wallet','swatch','belt','bag','cowboy','pirate'][i%6];q=p.evaluate('async id=>{LEATHER_ATELIER.selectProduct(id);await LEATHER_ATELIER.stepProduct(1);return {product:LEATHER_ATELIER.product,steps:LEATHER_ATELIER.productPhysics.steps,failed:LEATHER_ATELIER.productPhysics.failed,finite:LEATHER_ATELIER.productPhysics.finite};}',product);check('Rebuild and current worker '+str(i),q['product']==product and q['steps']==1 and q['finite'] and not q['failed'],q)
   p.evaluate("LEATHER_ATELIER.selectProduct('swatch');LEATHER_ATELIER.configure({craft:'plain'});")
   mats=p.locator('[data-material]').evaluate_all('(e)=>e.map(x=>x.dataset.material)')
   for ident in mats*2:p.evaluate('(id)=>LEATHER_ATELIER.selectMaterial(id)',ident)
   check('Twenty-six real material changes preserve valid geometry',len(mats)==13 and p.evaluate('LEATHER_ATELIER.audit().finite'))
   for craft in ['plain','diamond','grid','channels','perforated','woven']*2:
    q=p.evaluate('async craft=>{LEATHER_ATELIER.configure({craft});await LEATHER_ATELIER.resetGrab();return {finite:LEATHER_ATELIER.audit().finite,t:LEATHER_ATELIER.measureShell()};}',craft);check('Craft rebuild '+craft,q['finite'] and all(t['minMM']>0 for t in q['t']))
   p.evaluate("async()=>{LEATHER_ATELIER.selectProduct('wallet');LEATHER_ATELIER.configure({craft:'plain'});await LEATHER_ATELIER.resetGrab();LEATHER_ATELIER.setView('home');LEATHER_ATELIER.render();}");p.wait_for_timeout(300)
   p.locator('#grabTool').click();box=p.locator('#stage').bounding_box();x=box['x']+box['width']/2;y=box['y']+box['height']/2;p.mouse.move(x,y);p.mouse.down();p.wait_for_function('LEATHER_ATELIER.productPhysics.held')
   for i in range(24):p.mouse.move(x+(i%4-2)*3,y-18-(i%3)*3)
   p.keyboard.press('Escape');p.mouse.up();q=p.evaluate('LEATHER_ATELIER.productPhysics');check('Continuous actual pointer input cancels cleanly',q['finite'] and not q['failed'] and not q['held'],q)
   p.evaluate('LEATHER_ATELIER.resetGrab()');p.locator('#grabTool').click();p.mouse.move(0,0)
   before=p.evaluate('LEATHER_ATELIER.presentation()');other=ctx.new_page();other.goto('about:blank');other.bring_to_front();observed=p.evaluate('document.visibilityState');other.close();p.bring_to_front();p.wait_for_timeout(300);report['tabVisibilityObserved']=observed
   p.evaluate('window.dispatchEvent(new PageTransitionEvent("pagehide"));window.dispatchEvent(new PageTransitionEvent("pageshow"));');p.wait_for_timeout(700);after=p.evaluate('LEATHER_ATELIER.presentation()');check('Explicit page lifecycle event restores rendering once',after['visibilityResumes']>before['visibilityResumes'] and not after['frameQueued'],{'before':before,'after':after,'actualTabVisibility':observed,'eventTestIsSimulated':True})
   refctx,ref=new('reference',(R.parent/'r15/public-lite.html').resolve().as_uri())
   for product in ['wallet','swatch','bag']:
    for page in [ref,p]:
     page.add_style_tag(content='#stageLabel{visibility:hidden !important}')
     page.evaluate('async id=>{LEATHER_ATELIER.selectProduct(id);LEATHER_ATELIER.configure({craft:"plain",thicknessScale:1});LEATHER_ATELIER.selectMaterial("heritage");await LEATHER_ATELIER.resetGrab();await LEATHER_ATELIER.stepProduct(8);LEATHER_ATELIER.setView("home");LEATHER_ATELIER.render();}',product)
    images=[]
    for name,page in [('reference',ref),('candidate',p)]:
     b=page.locator('#stage').screenshot();(O/(name+'-deformed-'+product+'.png')).write_bytes(b);images.append(Image.open(io.BytesIO(b)).convert('RGB'))
    d=ImageChops.difference(*images);mean=sum(ImageStat.Stat(d).mean)/3;changed=sum(d.convert('L').histogram()[3:])/(d.width*d.height);check('Deformed '+product+' raw pixel equivalence',mean<=.02 and changed<=.0005,{'meanRGB':mean,'changedFraction':changed})
   refctx.close();ctx.close()
  check('No new JavaScript errors',not report['errors'],report['errors']);report['pass']=True
 except Exception as e:report['error']=str(e);report['trace']=traceback.format_exc();raise
 finally:save();browser.close()
