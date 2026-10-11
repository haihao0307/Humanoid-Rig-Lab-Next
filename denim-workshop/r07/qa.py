"""Actual browser verification. --content means authored-document only, never file:// proof."""
import argparse,base64,hashlib,io,json,os,math
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates
from playwright.sync_api import sync_playwright
p=Path(__file__).resolve().parent;out=p/'evidence';out.mkdir(exist_ok=True)
a=argparse.ArgumentParser();a.add_argument('--public');a.add_argument('--content',action='store_true');a.add_argument('--alias-only',action='store_true');args=a.parse_args()
report={'version':'R07.0','passed':False,'actualPhone':False,'modes':{},'sourceSha':os.environ.get('GITHUB_SHA'),'publicBuild':os.environ.get('PUBLIC_BUILD')}
def pixels(page):
 raw=base64.b64decode(page.evaluate("document.getElementById('view').toDataURL().split(',')[1]"));return raw,np.array(Image.open(io.BytesIO(raw)).convert('RGB'))
def watch(page):
 net={'errors':[],'console':[],'requests':[],'httpErrors':[]};page.on('pageerror',lambda e:net['errors'].append(str(e)));page.on('console',lambda m:net['console'].append({'text':m.text,'url':m.location.get('url','')}) if m.type=='error' else None);page.on('request',lambda r:net['requests'].append(r.url));page.on('response',lambda r:net['httpErrors'].append({'status':r.status,'url':r.url}) if r.status>=400 else None);return net

def netcheck(net):
 icon='https://htmlpreview.github.io/favicon.ico';assert not net['errors'],net;assert not [x for x in net['console'] if not(x['url']==icon and '404' in x['text'])],net;assert not [x for x in net['httpErrors'] if not(x['url']==icon and x['status']==404)],net

def load(browser,path,url=None,mobile=False):
 ctx=browser.new_context(viewport={'width':390,'height':844} if mobile else {'width':1000,'height':780},device_scale_factor=1,is_mobile=mobile,has_touch=mobile);page=ctx.new_page();page.set_default_timeout(180000);net=watch(page)
 if args.content and not url:page.set_content(path.read_text(),wait_until='domcontentloaded')
 else:page.goto(url or path.as_uri(),wait_until='domcontentloaded',timeout=120000)
 page.wait_for_function('window.__DENIM_WORKBENCH__?.lastFrame||window.__DENIM_WORKBENCH__?.contextLost');assert page.evaluate('!__DENIM_WORKBENCH__.contextLost'),'Context lost during initialization';return ctx,page,net

def snap(page,rows,name,patch=None,save=False):
 if patch is not None:
  n=page.evaluate('__DENIM_WORKBENCH__.lastFrame.frame');page.evaluate('(s)=>__DENIM_WORKBENCH__.setState(s)',patch);page.wait_for_function('(n)=>__DENIM_WORKBENCH__.lastFrame.frame>n||__DENIM_WORKBENCH__.contextLost',arg=n)
 raw,im=pixels(page);q=page.evaluate('({frame:__DENIM_WORKBENCH__.lastFrame,gl:__DENIM_WORKBENCH__.getGLError(),lost:__DENIM_WORKBENCH__.contextLost,ready:__DENIM_WORKBENCH__.ready})');assert q['gl']==0 and not q.get('lost') and q['ready'],(name,q);assert q['frame']['projection']=='perspective' and not q['frame']['solidEdgeDrawn'];assert im.std()>2,(name,'blank render');q.update(name=name,pngSha256=hashlib.sha256(raw).hexdigest());rows.append(q)
 if save:(out/(name+'.png')).write_bytes(raw)
 print(name,q['frame'].get('farWeight'),q['frame']['triangles'],flush=True);return q,im

def interact(page,rows,name,action,save=False):
 n=page.evaluate('__DENIM_WORKBENCH__.lastFrame.frame');action();page.wait_for_function('(n)=>__DENIM_WORKBENCH__.lastFrame.frame>n||__DENIM_WORKBENCH__.contextLost',arg=n)
 return snap(page,rows,name,save=save)

def slider(page,key,value):
 page.locator('#'+key).evaluate("(el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));}",value)

with sync_playwright() as pw:
 kw={'headless':False,'args':['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']}
 if os.environ.get('CHROMIUM_PATH'):kw['executable_path']=os.environ['CHROMIUM_PATH']
 browser=pw.chromium.launch(**kw);report['browserVersion']=browser.version
 try:
  if not args.alias_only:
   mode='public' if args.public else 'authored' if args.content else 'file';ctx,page,net=load(browser,p/'index.html',args.public);rows=[];report['modes'][mode]={'states':rows,'network':net}
   assert page.evaluate('__DENIM_WORKBENCH__.version')=='R07.0'
   q,im=snap(page,rows,mode+'-default',save=True);assert q['frame']['geometryOnly'] and q['frame']['sampling']['msaaSamples']>=2
   assert np.mean(im[:,:,2].astype(float)-im[:,:,0]>12)>.1,'No denim visible'
   for key in ['detail','back','front','showFray','rimReview','farReview']:
    interact(page,rows,mode+'-'+key,lambda:page.locator('#'+key).click(),True)
   q,im=snap(page,rows,mode+'-far-damage',{'damage':4,'zoom':.15,'panX':0,'panY':0},True);assert q['frame']['farWeight']==1 and q['frame']['natural']['bridges']>0
   if not args.public:
    snap(page,rows,'preset-test-camera',{'zoom':1,'damage':0,'light':2,'shape':1})
    for key in ['raw','rinse','vintage','bleach','slubby','black','grey','ecru','indigoBlack','doubleIndigo','enzyme','acid']:
     interact(page,rows,'finish-'+key,lambda:page.locator('[data-preset="'+key+'"]').click())
    for key,values in [('weave',[1,2,3,0]),('damage',[1,2,3,4,0]),('shape',[0,2,3,1]),('light',[0,1,3,4,2])]:
     for v in values:interact(page,rows,key+'-'+str(v),lambda:page.locator('#'+key).select_option(str(v)))
    for key,off,on in [('fuzz',0,1),('scatter',0,1),('transmission',0,1),('exposure',.7,1.3),('fog',0,1)]:
     _,i0=interact(page,rows,key+'-off',lambda:slider(page,key,off));_,i1=interact(page,rows,key+'-on',lambda:slider(page,key,on));delta=float(np.abs(i1.astype(float)-i0).mean());assert delta>.01,(key,delta);report.setdefault('parameterPixelDelta',{})[key]=delta
    snap(page,rows,'parameters-geometry',{'damage':4,'thickness':.83,'slub':.72,'fray':1.6,'zoom':1.3,'exposure':1,'fuzz':.55,'scatter':.85,'transmission':.55,'fog':.65},True)
    with page.expect_download() as dl:page.locator('#save').click()
    dl.value.save_as(str(out/'profile.json'));profile=json.loads((out/'profile.json').read_text());assert profile['schema']=='kaopu.denim_material_profile@2.5' and profile['damage']['released']
   page.wait_for_timeout(250);n0=page.evaluate('__DENIM_WORKBENCH__.lastFrame.frame');page.wait_for_timeout(500);n1=page.evaluate('__DENIM_WORKBENCH__.lastFrame.frame');assert n0==n1;report['modes'][mode]['idleFrames']=[n0,n1];netcheck(net)
   if mode=='file':assert not [u for u in net['requests'] if u.startswith('http')]
   page.screenshot(path=str(out/(mode+'-desktop.png')));ctx.close()
   ctx,page,net=load(browser,p/'index.html',args.public,True);rows=[];report['modes']['mobile-'+mode]={'viewport':[390,844],'actualPhone':False,'states':rows,'network':net}
   rect=page.locator('#view').bounding_box();assert rect['height']>200 and rect['y']>=0 and rect['y']+rect['height']<=844
   snap(page,rows,mode+'-mobile-default',save=True);interact(page,rows,mode+'-mobile-fray',lambda:page.locator('#showFray').click(),True);page.locator('#stage').scroll_into_view_if_needed();interact(page,rows,mode+'-mobile-far',lambda:page.locator('#farReview').click(),True);netcheck(net);ctx.close()
  if not args.public:
   comparison={}
   for version in ['r06','r07']:
    ctx,page,net=load(browser,p.parent/version/'index.html');rows=[];comparison[version]={}
    for damage,zoom in [(0,.50),(4,.25)]:
     snap(page,rows,version+'-alias-setup-'+str(damage),{'shape':0,'yaw':0,'pitch':0,'zoom':zoom,'panX':0,'panY':0,'seam':False,'light':2,'damage':damage,'animate':False,'preset':'rinse','wash':.23,'abrasion':.24,'backstain':.08,'slub':.55,'fuzz':.55})
     distance=page.evaluate('__DENIM_WORKBENCH__.lastFrame.distanceMm');height=page.evaluate("document.getElementById('view').height");mpp=2*distance*math.tan(math.pi/10)/height;frames=[]
     for i in range(8):
      _,im=snap(page,rows,f'{version}-phase-{damage}-{i}',{'panX':i*.25*mpp},i in [0,7]);xy=page.evaluate('__DENIM_WORKBENCH__.projectPoint([0,22,0])');cx,cy=xy[0],im.shape[0]-xy[1];yy,xx=np.meshgrid(cy+np.arange(-6,7),cx+np.arange(-25,26),indexing='ij');lum=im.astype(float).mean(axis=2);frames.append(map_coordinates(lum,[yy,xx],order=3,mode='nearest'))
     stack=np.stack(frames);residual=float(np.sqrt(np.mean(np.var(stack,axis=0))));comparison[version][str(damage)]={'zoom':zoom,'frames':8,'quarterPixelCameraPanMm':.25*mpp,'motionCompensatedResidual':residual,'method':'13x51 luminance patch at world [0,22,0], cubic reprojected to material location; 0..255 units. Not a universal flicker metric.'}
    netcheck(net);ctx.close()
   ratios={k:comparison['r07'][k]['motionCompensatedResidual']/max(.000001,comparison['r06'][k]['motionCompensatedResidual']) for k in ['0','4']};report['temporalProbe']={'comparison':comparison,'ratios':ratios,'physicalGPUFPS':False};assert all(v<.85 for v in ratios.values()),ratios
  report['passed']=True
 finally:
  (out/('public-qa.json' if args.public else 'alias-qa.json' if args.alias_only else 'browser-qa.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2));browser.close()
