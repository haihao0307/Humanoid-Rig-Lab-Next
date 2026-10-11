"""R09 independent browser gates. Authored content != file/public navigation.
Timing uses an ordered, blocking QA-only 1-pixel readback, never the production loop.
It measures this software renderer, not utilization or physical-device FPS.
"""
from pathlib import Path
from datetime import datetime, timezone
import argparse, base64, hashlib, io, json, math, os, statistics
import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates
from playwright.sync_api import sync_playwright
P=Path(__file__).resolve().parent;OUT=P/'evidence';OUT.mkdir(exist_ok=True)
a=argparse.ArgumentParser();a.add_argument('--public');a.add_argument('--content',action='store_true');a.add_argument('--scope',choices=['ui','compare'],default='ui');args=a.parse_args()
REPORT={'passed':False,'version':'R09.0','scope':args.scope,'sourceCommit':os.getenv('GITHUB_SHA'),'startedAt':datetime.now(timezone.utc).isoformat(),'actualPhone':False,'physicalGpuBenchmark':False,'modes':{},'states':[]}
HOOK="""(()=>{window.__calls={};for(const k of ['getUniformLocation','bufferData','bufferSubData','texStorage2D','texSubImage2D','createBuffer','deleteBuffer','createTexture','deleteTexture']){const p=WebGL2RenderingContext.prototype,o=p[k];p[k]=function(...a){__calls[k]=(__calls[k]||0)+1;return o.apply(this,a)};}})();"""
NEAR={'shape':1,'yaw':-.23,'pitch':.34,'zoom':5.2,'panX':3,'panY':-4,'damage':0,'seam':False,'wash':.23,'abrasion':.24,'backstain':.08,'slub':.55,'fuzz':.55,'light':2,'preset':'rinse','animate':False}
def load(b,version='r09',mobile=False,url=None):
 ctx=b.new_context(viewport={'width':390,'height':844} if mobile else {'width':1000,'height':780},device_scale_factor=1,is_mobile=mobile,has_touch=mobile)
 ctx.add_init_script(HOOK);p=ctx.new_page();p.set_default_timeout(180000)
 net={'requests':[],'pageErrors':[],'consoleErrors':[],'httpErrors':[]};p.on('request',lambda r:net['requests'].append(r.url));p.on('pageerror',lambda e:net['pageErrors'].append(str(e)));p.on('console',lambda m:net['consoleErrors'].append({'text':m.text,'url':m.location.get('url','')}) if m.type=='error' else None);p.on('response',lambda r:net['httpErrors'].append({'url':r.url,'status':r.status}) if r.status>=400 else None)
 file=P.parent/version/'index.html'
 if args.content and not url:p.evaluate(HOOK);p.set_content(file.read_text(),wait_until='domcontentloaded')
 else:p.goto(url or file.as_uri(),wait_until='domcontentloaded',timeout=120000)
 p.wait_for_function('window.__DENIM_WORKBENCH__?.lastFrame||window.__DENIM_WORKBENCH__?.contextLost')
 p.evaluate("(()=>{let o=KAOPUNaturalYarn.audit;KAOPUNaturalYarn.audit=function(...a){__calls.deepAudit=(__calls.deepAudit||0)+1;return o.apply(this,a)}})()")
 return ctx,p,net

def netcheck(net,offline=False):
 icon='https://htmlpreview.github.io/favicon.ico'
 assert not net['pageErrors'],net
 assert not [x for x in net['httpErrors'] if not(x['url']==icon and x['status']==404)],net
 assert not [x for x in net['consoleErrors'] if not(x['url']==icon and '404' in x['text'])],net
 if offline:assert not [x for x in net['requests'] if x.startswith('http')],net

def change(p,patch=None,action=None):
 n=p.evaluate('__DENIM_WORKBENCH__.lastFrame.frame')
 if action:action()
 else:p.evaluate('(s)=>__DENIM_WORKBENCH__.setState(s)',patch or {})
 p.wait_for_function('(n)=>__DENIM_WORKBENCH__.lastFrame.frame>n||__DENIM_WORKBENCH__.contextLost',arg=n)

def snap(p,name,patch=None,action=None,save=False):
 if patch is not None or action:change(p,patch,action)
 raw=base64.b64decode(p.evaluate("document.getElementById('view').toDataURL().split(',')[1]"))
 im=np.asarray(Image.open(io.BytesIO(raw)).convert('RGB'))
 q=p.evaluate('({frame:__DENIM_WORKBENCH__.lastFrame,version:__DENIM_WORKBENCH__.version,gl:__DENIM_WORKBENCH__.getGLError(),lost:!!__DENIM_WORKBENCH__.contextLost,calls:{...__calls},recipe:__DENIM_WORKBENCH__.recipe?.(),budget:__DENIM_WORKBENCH__.getBudget?.()})')
 q.update(name=name,pixelStd=float(im.std()),sha256=hashlib.sha256(raw).hexdigest());REPORT['states'].append(q)
 bad=q['gl']!=0 or q['lost'] or im.std()<=2
 if save or bad:(OUT/(name+'.png')).write_bytes(raw)
 if bad:(OUT/(name+'-failure.json')).write_text(json.dumps(q,ensure_ascii=False,indent=2))
 assert not bad,(name,q)
 assert q['frame']['projection']=='perspective' and not q['frame']['solidEdgeDrawn']
 print(name,q['frame']['frame'],q['frame']['triangles'],flush=True);return im,q

def slider(p,k,v):p.locator('#'+k).evaluate('(e,v)=>{e.value=v;e.dispatchEvent(new Event("input",{bubbles:true}));}',v)
def diff(a,b):
 d=np.abs(a.astype(float)-b);return {'meanAbsRgb255':float(d.mean()),'p99':float(np.percentile(d,99)),'max':int(d.max())}

def bench(p,name):
 # The old synchronous benchmark could return without a frame while a GPU fence
 # was pending. Use the normal scheduler, then an ordered 1-pixel readback.
 # No zero-frame samples, skipped work, or retries are accepted as measurements.
 probe="""async()=>{const w=__DENIM_WORKBENCH__,g=document.getElementById('view').getContext('webgl2'),pixel=new Uint8Array(4);g.readPixels(0,0,1,1,g.RGBA,g.UNSIGNED_BYTE,pixel);await new Promise(requestAnimationFrame);const n=w.lastFrame.frame,c={...__calls},start=performance.now();w.setState({});while(w.lastFrame.frame===n){await new Promise(requestAnimationFrame);if(performance.now()-start>180000)throw Error('No submitted benchmark frame');if(w.contextLost)throw Error('Context lost during benchmark');}g.readPixels(0,0,1,1,g.RGBA,g.UNSIGNED_BYTE,pixel);return {completedFrameMs:performance.now()-start,frameDelta:w.lastFrame.frame-n,cpuSubmitMs:w.lastFrame.cpuSubmitMs,readbackPixel:Array.from(pixel),counts:Object.fromEntries(Object.keys(__calls).map(k=>[k,__calls[k]-(c[k]||0)]))}}"""
 warm=p.evaluate(probe);assert warm['frameDelta']==1 and warm['completedFrameMs']>0,(name,warm)
 rows=[]
 for i in range(3):
  row=p.evaluate(probe)
  assert row['frameDelta']==1 and row['completedFrameMs']>0,(name,row);rows.append(row)
  print('benchmark sample',name,i,row,flush=True)
 return {'samples':rows,'medianCompletedFrameMs':statistics.median(r['completedFrameMs'] for r in rows),'medianCpuSubmitMs':statistics.median(r['cpuSubmitMs'] for r in rows),'method':'3 warmed static frames via unmodified normal scheduler, followed by ordered 1-pixel readback; includes scheduling/readback overhead; software ANGLE only, not pure GPU time, utilization or physical-device FPS'}

with sync_playwright() as pw:
 kw={'headless':False,'args':['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']}
 if os.getenv('CHROMIUM_PATH'):kw['executable_path']=os.getenv('CHROMIUM_PATH')
 b=pw.chromium.launch(**kw);REPORT['browserVersion']=b.version
 try:
  if args.scope=='ui':
   for mobile in [False,True]:
    mode=('public' if args.public else 'authored' if args.content else 'file')+('-mobile' if mobile else '-desktop')
    ctx,p,net=load(b,mobile=mobile,url=args.public);REPORT['modes'][mode]={'network':net}
    _,q=snap(p,mode+'-default',save=True);assert q['version']=='R09.0';assert q['frame']['sampling']['msaaSamples']==4
    assert q['budget']['fiberEncoding']['curves']==39096 and q['budget']['retainedDenseFiberPoints']==0
    assert q['budget']['recipeBytes']<600 and q['budget']['compactFiberTextures']<25000000
    rect=p.locator('#view').bounding_box();assert rect['height']>200
    if mobile:assert rect['y']+rect['height']<=844
    initial_recipe=q['recipe']
    for key in (['detail','seamNear','seamBack','showFray','farReview'] if not mobile else ['seamNear','seamBack','showFray']):
     _,q=snap(p,mode+'-'+key,action=lambda k=key:p.locator('#'+k).click(),save=True)
     if key=='showFray':assert q['frame']['natural']['bridges']>0
    if not mobile:
     snap(p,mode+'-restore-view',{**NEAR,'seam':True,'quality':'balanced'})
     _,q=snap(p,mode+'-pitch-short',action=lambda:slider(p,'stitchCells',4));assert q['budget']['stitch']['stitches']>64
     _,q=snap(p,mode+'-thread-fine',action=lambda:slider(p,'threadDiameter',.08));assert q['budget']['stitch']['threadDiameterMm']==.08
     with p.expect_download() as dl:p.locator('#saveRecipe').click()
     target=OUT/(mode+'-recipe.json');dl.value.save_as(str(target));r=json.loads(target.read_text());assert r['schema']=='kaopu.denim_recipe@1.0' and target.stat().st_size<600
     n=p.evaluate('__DENIM_WORKBENCH__.lastFrame.frame');p.locator('#loadRecipe').set_input_files(str(target));p.wait_for_function('(n)=>__DENIM_WORKBENCH__.lastFrame.frame>n',arg=n);assert p.evaluate('__DENIM_WORKBENCH__.recipe()')==r
     assert p.evaluate("(()=>{try{__DENIM_WORKBENCH__.restoreRecipe({schema:'invalid'});return false}catch(e){return true}})()")
     if not args.public:
      for w in [1,2,3,0]:snap(p,mode+'-weave-'+str(w),action=lambda w=w:p.locator('#weave').select_option(str(w)))
      for preset in ['ecru','black','vintage','rinse']:snap(p,mode+'-finish-'+preset,action=lambda k=preset:p.locator('[data-preset="'+k+'"]').click())
     _,q=snap(p,mode+'-restore-material',action=lambda:p.evaluate('(r)=>__DENIM_WORKBENCH__.restoreRecipe(r)',initial_recipe))
     q0=q['budget'];i0,_=snap(p,mode+'-stable0',{})
     i1,q=snap(p,mode+'-stable1',{});assert diff(i0,i1)['max']==0;assert q['budget']['geometryBuilds']==q0['geometryBuilds']
     change(p,{'zoom':.65,'panX':0,'panY':0,'quality':'balanced','frameLimit':30});n=p.evaluate('__DENIM_WORKBENCH__.lastFrame.frame');before=p.evaluate('({calls:{...__calls},budget:__DENIM_WORKBENCH__.getBudget()})');p.locator('#wind').click()
     p.wait_for_function('(n)=>__DENIM_WORKBENCH__.lastFrame.frame>=n+4||__DENIM_WORKBENCH__.contextLost',arg=n,timeout=180000)
     p.locator('#wind').click();p.wait_for_function('!__DENIM_WORKBENCH__.state.animate');_,q=snap(p,mode+'-sway-paused',save=True)
     assert q['budget']['geometryBuilds']==before['budget']['geometryBuilds']
     for k in ['bufferData','bufferSubData','texSubImage2D']:assert q['calls'].get(k,0)==before['calls'].get(k,0),(mode,k)
     REPORT['modes'][mode]['swayNoGeometryRebuildOrUpload']=True
     p.locator('#wind').click();other=ctx.new_page();other.goto('about:blank');other.bring_to_front();p.wait_for_timeout(500)
     hidden=p.evaluate('document.hidden');REPORT['modes'][mode]['actualHiddenStateObserved']=hidden
     if hidden:
      n=p.evaluate('__DENIM_WORKBENCH__.lastFrame.frame');p.wait_for_timeout(700);assert p.evaluate('__DENIM_WORKBENCH__.lastFrame.frame')==n
     other.close();p.bring_to_front();p.evaluate('__DENIM_WORKBENCH__.setState({animate:false})');p.wait_for_timeout(500)
    else:p.wait_for_timeout(500)
    n=p.evaluate('__DENIM_WORKBENCH__.lastFrame.frame');p.wait_for_timeout(700);assert n==p.evaluate('__DENIM_WORKBENCH__.lastFrame.frame'),mode
    p.screenshot(path=str(OUT/(mode+'-layout.png')));netcheck(net,offline=not args.public and not args.content);ctx.close()
  else:
   images={};benchmarks={};motion={};nearFrames={};cullRows=[]
   for version in ['r08','r09']:
    ctx,p,net=load(b,version=version);REPORT['modes'][version]={'network':net}
    snap(p,version+'-default',save=True)
    images[version],q=snap(p,version+'-near-reference',{**NEAR,'quality':'reference'},save=True);nearFrames[version]=q
    benchmarks[version+'-reference']=bench(p,version+'-reference')
    if version=='r09':
     pure=diff(images['r08'],images['r09']);REPORT['referencePixelDifference']=pure;assert pure['meanAbsRgb255']<.10,pure
     _,q=snap(p,'r09-near-unculled',{'qaNoCull':True},save=True);im,_=snap(p,'r09-cull-verify',{});d=diff(images['r09'],im);assert d['max']<=1,d;cullRows.append({'name':'near','difference':d})
     ib,q=snap(p,'r09-near-balanced',{'quality':'balanced','qaNoCull':False},save=True);nearFrames['r09-balanced']=q;REPORT['balancedPixelDifference']=diff(images['r08'],ib)
     assert REPORT['balancedPixelDifference']['meanAbsRgb255']<5,REPORT['balancedPixelDifference']
     benchmarks['r09-balanced']=bench(p,'r09-balanced')
     assert q['budget']['trackedGpuBytes']<120000000 and q['frame']['triangles']<3000000
     for shape,view in [(0,{'yaw':0,'pitch':.18,'panX':-19,'panY':-12}),(2,{'yaw':-.5,'pitch':.7,'panX':-6,'panY':-29}),(3,{'yaw':3.14,'pitch':.15,'panX':12,'panY':8})]:
      ia,qa=snap(p,'r09-cull-shape'+str(shape),{**view,'shape':shape,'zoom':3.5,'qaTime':1.7,'quality':'reference','qaNoCull':False},save=True)
      ib,qb=snap(p,'r09-full-shape'+str(shape),{'qaNoCull':True});d=diff(ia,ib);assert d['max']<=1,(shape,d);cullRows.append({'name':'shape'+str(shape),'qaTime':1.7,'difference':d})
     change(p,{'qaNoCull':False,'qaTime':0,'quality':'balanced'})
    motion[version]={}
    for damage,zoom in [(0,.5),(4,.25)]:
     snap(p,version+'-motion'+str(damage),{**NEAR,'shape':0,'yaw':0,'pitch':0,'zoom':zoom,'panX':0,'panY':0,'damage':damage,'quality':'balanced'})
     distance=p.evaluate('__DENIM_WORKBENCH__.lastFrame.distanceMm');h=p.evaluate("document.getElementById('view').height");mpp=2*distance*math.tan(math.pi/10)/h;frames=[]
     for i in range(8):
      im,q=snap(p,version+'-motion'+str(damage)+'-'+str(i),{'panX':i*.25*mpp},save=i==0)
      xy=p.evaluate('__DENIM_WORKBENCH__.projectPoint([0,22,0])');cx,cy=xy[0],im.shape[0]-xy[1];yy,xx=np.meshgrid(cy+np.arange(-6,7),cx+np.arange(-25,26),indexing='ij');frames.append(map_coordinates(im.astype(float).mean(2),[yy,xx],order=3,mode='nearest'))
     motion[version][str(damage)]=float(np.sqrt(np.mean(np.var(np.stack(frames),axis=0))))
    netcheck(net,offline=not args.content);ctx.close()
   limits={k:max(motion['r08'][k]*1.15,motion['r08'][k]+.12) for k in ['0','4']};assert all(motion['r09'][k]<=limits[k] for k in limits),(motion,limits)
   REPORT.update(benchmarks=benchmarks,nearFrames=nearFrames,culling=cullRows,motionResidual=motion,motionTolerance=limits)
   assert all(r['counts'].get('getUniformLocation',0)==0 and r['counts'].get('deepAudit',0)==0 for r in benchmarks['r09-reference']['samples'])
  REPORT['passed']=True
 finally:
  REPORT['finishedAt']=datetime.now(timezone.utc).isoformat();(OUT/('public-qa.json' if args.public else args.scope+'-qa.json')).write_text(json.dumps(REPORT,ensure_ascii=False,indent=2));b.close()
