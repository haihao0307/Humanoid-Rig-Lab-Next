"""R08 real browser, matched appearance and R07 far-stability regression.
--content is authored-document local QA only. No screenshots replace the public workbench.
"""
from pathlib import Path
from datetime import datetime,timezone
import argparse,base64,hashlib,io,json,os,math
import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates
from playwright.sync_api import sync_playwright
P=Path(__file__).resolve().parent;OUT=P/'evidence';OUT.mkdir(exist_ok=True)
a=argparse.ArgumentParser();a.add_argument('--public');a.add_argument('--content',action='store_true');a.add_argument('--motion-only',action='store_true');args=a.parse_args()
report={'version':'R08.0','passed':False,'sourceCommit':os.getenv('GITHUB_SHA'),'startedAt':datetime.now(timezone.utc).isoformat(),'actualPhone':False,'consumerGpuFPS':False,'modes':{}}
def pixels(p):
 raw=base64.b64decode(p.evaluate("document.getElementById('view').toDataURL().split(',')[1]"));return raw,np.asarray(Image.open(io.BytesIO(raw)).convert('RGB'))
def load(browser,version='r08',mobile=False,url=None):
 ctx=browser.new_context(viewport={'width':390,'height':844} if mobile else {'width':1000,'height':780},device_scale_factor=1,is_mobile=mobile,has_touch=mobile)
 p=ctx.new_page();p.set_default_timeout(180000);net={'pageErrors':[],'httpErrors':[],'consoleErrors':[],'requests':[]}
 p.on('pageerror',lambda e:net['pageErrors'].append(str(e)));p.on('request',lambda r:net['requests'].append(r.url));p.on('response',lambda r:net['httpErrors'].append({'url':r.url,'status':r.status}) if r.status>=400 else None);p.on('console',lambda m:net['consoleErrors'].append({'url':m.location.get('url',''),'text':m.text}) if m.type=='error' else None)
 file=P.parent/version/'index.html'
 if args.content and not url:p.set_content(file.read_text(),wait_until='domcontentloaded')
 else:p.goto(url or file.as_uri(),wait_until='domcontentloaded',timeout=120000)
 p.wait_for_function('window.__DENIM_WORKBENCH__?.lastFrame||window.__DENIM_WORKBENCH__?.contextLost')
 return ctx,p,net

def netcheck(net,file=False):
 icon='https://htmlpreview.github.io/favicon.ico'
 assert not net['pageErrors'],net
 assert not [x for x in net['consoleErrors'] if not(x['url']==icon and '404' in x['text'])],net
 assert not [x for x in net['httpErrors'] if not(x['url']==icon and x['status']==404)],net
 if file:assert not [u for u in net['requests'] if u.startswith('http')],net

def snap(p,rows,name,patch=None,save=False,action=None):
 if patch is not None or action:
  n=p.evaluate('__DENIM_WORKBENCH__.lastFrame.frame')
  if action:action()
  else:p.evaluate('(s)=>__DENIM_WORKBENCH__.setState(s)',patch)
  p.wait_for_function('(n)=>__DENIM_WORKBENCH__.lastFrame.frame>n||__DENIM_WORKBENCH__.contextLost',arg=n)
 q=p.evaluate('({version:__DENIM_WORKBENCH__.version,frame:__DENIM_WORKBENCH__.lastFrame,lost:!!__DENIM_WORKBENCH__.contextLost,gl:__DENIM_WORKBENCH__.getGLError()})')
 assert not q['lost'] and q['gl']==0,(name,q)
 assert q['frame']['projection']=='perspective' and not q['frame']['solidEdgeDrawn']
 raw,im=pixels(p);assert im.std()>2,(name,'blank');q.update(name=name,imageSha256=hashlib.sha256(raw).hexdigest());rows.append(q)
 if save:(OUT/(name+'.png')).write_bytes(raw)
 print(name,q['frame']['frame'],flush=True);return im,q

def slide(p,key,value):p.locator('#'+key).evaluate('(e,v)=>{e.value=v;e.dispatchEvent(new Event("input",{bubbles:true}));}',value)
with sync_playwright() as pw:
 kw={'headless':False,'args':['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']}
 if os.getenv('CHROMIUM_PATH'):kw['executable_path']=os.getenv('CHROMIUM_PATH')
 b=pw.chromium.launch(**kw);report['browserVersion']=b.version
 try:
  if not args.motion_only:
   for mobile in [False,True]:
    mode=('public' if args.public else 'authored' if args.content else 'file')+('-mobile' if mobile else '-desktop')
    ctx,p,net=load(b,mobile=mobile,url=args.public);rows=[];report['modes'][mode]={'network':net,'states':rows}
    im,q=snap(p,rows,mode+'-default',save=True);assert q['version']=='R08.0';assert q['frame']['sampling']['msaaSamples']>=2
    rect=p.locator('#view').bounding_box();assert rect['height']>200
    if mobile:
     heading=p.locator('#heading').bounding_box();tools=p.locator('#tools').bounding_box();assert heading['y']+heading['height']<=tools['y'],(heading,tools)
     assert rect['y']+rect['height']<=844
    for key in ['detail','showFray','farReview'] if mobile else ['detail','back','front','showFray','rimReview','farReview']:
     im,q=snap(p,rows,mode+'-'+key,action=lambda k=key:p.locator('#'+k).click(),save=True)
     if key=='showFray':assert q['frame']['natural']['bridges']>0
    if not mobile:
     snap(p,rows,mode+'-near',{'damage':0,'zoom':5.2,'yaw':-.23,'pitch':.34,'panX':3,'panY':-4,'wash':.23,'abrasion':.24,'preset':'rinse','slub':.55,'light':2},True)
     delta={}
     for key in ['cotton','staple','nap']:
      i0,_=snap(p,rows,mode+'-'+key+'-off',action=lambda k=key:slide(p,k,0))
      i1,_=snap(p,rows,mode+'-'+key+'-on',action=lambda k=key:slide(p,k,1))
      delta[key]=float(np.abs(i1.astype(float)-i0).mean());assert delta[key]>.01,(key,delta)
     report['modes'][mode]['parameterPixelDelta']=delta
     snap(p,rows,mode+'-close-restored',{'cotton':.78,'staple':.72,'nap':.70},True)
     if not args.public:
      for key in ['raw','rinse','vintage','bleach','slubby','black','grey','ecru','indigoBlack','doubleIndigo','enzyme','acid']:
       snap(p,rows,'finish-'+key,action=lambda k=key:p.locator('[data-preset="'+k+'"]').click(),save=key in ['vintage','ecru','black'])
      for w in [1,2,3,0]:snap(p,rows,'weave-'+str(w),action=lambda w=w:p.locator('#weave').select_option(str(w)))
     with p.expect_download() as dl:p.locator('#save').click()
     dl.value.save_as(str(OUT/(mode+'-profile.json')));profile=json.loads((OUT/(mode+'-profile.json')).read_text());assert profile['schema']=='kaopu.denim_material_profile@2.6'
     assert set(['cotton','staple','nap'])<=profile['surface'].keys()
     report['modes'][mode]['exportSchema']=profile['schema']
    p.wait_for_timeout(500);n0=p.evaluate('__DENIM_WORKBENCH__.lastFrame.frame');p.wait_for_timeout(500);assert n0==p.evaluate('__DENIM_WORKBENCH__.lastFrame.frame')
    r0,_=pixels(p);snap(p,rows,mode+'-repeat',{});r1,_=pixels(p);assert r0==r1
    p.screenshot(path=str(OUT/(mode+'-layout.png')));netcheck(net,file=not args.content and not args.public);ctx.close()
  if not args.public:
   comparison={};matched={}
   for version in ['r07','r08']:
    ctx,p,net=load(b,version=version);rows=[];comparison[version]={}
    if not args.motion_only:
     for light in [2,0]:
      im,q=snap(p,rows,version+'-matched-near-'+str(light),{'shape':1,'yaw':-.23,'pitch':.34,'zoom':5.2,'panX':3,'panY':-4,'damage':0,'seam':False,'wash':.23,'abrasion':.24,'backstain':.08,'slub':.55,'fuzz':.55,'light':light,'preset':'rinse'},True)
      matched.setdefault(version,{})[str(light)]={'sha':q['imageSha256'],'meanRGB':im.mean((0,1)).tolist(),'triangles':q['frame']['triangles'],'buffers':q['frame'].get('geometryBufferBytes')}
    for damage,zoom in [(0,.5),(4,.25)]:
     snap(p,rows,f'{version}-motion-{damage}',{'shape':0,'yaw':0,'pitch':0,'zoom':zoom,'panX':0,'panY':0,'damage':damage,'seam':False,'wash':.23,'abrasion':.24,'backstain':.08,'slub':.55,'fuzz':.55,'light':2,'preset':'rinse'})
     distance=p.evaluate('__DENIM_WORKBENCH__.lastFrame.distanceMm');height=p.evaluate("document.getElementById('view').height");mpp=2*distance*math.tan(math.pi/10)/height;frames=[]
     for i in range(8):
      im,q=snap(p,rows,f'{version}-phase-{damage}-{i}',{'panX':i*.25*mpp},save=i in [0,7]);xy=p.evaluate('__DENIM_WORKBENCH__.projectPoint([0,22,0])');cx,cy=xy[0],im.shape[0]-xy[1];yy,xx=np.meshgrid(cy+np.arange(-6,7),cx+np.arange(-25,26),indexing='ij');frames.append(map_coordinates(im.astype(float).mean(2),[yy,xx],order=3,mode='nearest'))
     comparison[version][str(damage)]=float(np.sqrt(np.mean(np.var(np.stack(frames),axis=0))))
    netcheck(net);ctx.close()
   report['matchedNear']=matched;report['motionResidual']=comparison
   limits={k:max(comparison['r07'][k]*1.30,comparison['r07'][k]+.20) for k in ['0','4']}
   report['motionTolerance']=limits;assert all(comparison['r08'][k]<=limits[k] for k in limits),(comparison,limits)
  report['passed']=True
 finally:
  report['finishedAt']=datetime.now(timezone.utc).isoformat();(OUT/('public-qa.json' if args.public else 'motion-qa.json' if args.motion_only else 'browser-qa.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2));b.close()
