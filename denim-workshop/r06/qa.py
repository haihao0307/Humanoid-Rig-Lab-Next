"""Real local-file/public browser regression; --content is authored-document only."""
import argparse,base64,hashlib,io,json,os,time
from pathlib import Path
from PIL import Image,ImageChops,ImageStat
from playwright.sync_api import sync_playwright
p=Path(__file__).resolve().parent;out=p/'evidence';out.mkdir(exist_ok=True)
a=argparse.ArgumentParser();a.add_argument('--public');a.add_argument('--content',action='store_true');a.add_argument('--quick',action='store_true');args=a.parse_args();report={'version':'R06.0','modes':{},'actualPhone':False}
spy="""(()=>{window.__draws={instanced:0,indexed:0};let p=WebGL2RenderingContext.prototype;for(let [n,k] of [['drawElementsInstanced','instanced'],['drawElements','indexed']]){let f=p[n];p[n]=function(...a){window.__draws[k]++;return f.apply(this,a)}}})();"""
def watch(page):
 d={'errors':[],'console':[],'http':[],'requests':[]}
 page.on('pageerror',lambda e:d['errors'].append(str(e)))
 page.on('console',lambda m:d['console'].append({'text':m.text,'url':m.location.get('url','')}) if m.type=='error' else None)
 page.on('response',lambda r:d['http'].append({'url':r.url,'status':r.status}) if r.status>=400 else None)
 page.on('request',lambda r:d['requests'].append(r.url));return d

def verify(d):
 icon='https://htmlpreview.github.io/favicon.ico';d['hostIconWarnings']=[x for x in d['console'] if x['url']==icon and '404' in x['text']]
 assert not d['errors'],d
 assert not [x for x in d['console'] if x not in d['hostIconWarnings']],d
 assert not [x for x in d['http'] if not(x['url']==icon and x['status']==404)],d

def delta(a,b,box=None):
 if box:a=a.crop(box);b=b.crop(box)
 return sum(ImageStat.Stat(ImageChops.difference(a,b)).mean)/3

with sync_playwright() as w:
 kw={'headless':False,'args':['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']}
 if os.environ.get('CHROMIUM_PATH'):kw['executable_path']=os.environ['CHROMIUM_PATH']
 browser=w.chromium.launch(**kw)
 try:
  modes=[('authored' if args.content else 'file',(p/'index.html').as_uri())]+([('public',args.public)] if args.public else [])
  for mode,url in modes:
   ctx=browser.new_context(viewport={'width':1100,'height':840},device_scale_factor=1);ctx.add_init_script(spy);page=ctx.new_page();page.set_default_timeout(180000);net=watch(page);states=[]
   report['modes'][mode]={'passed':False,'url':url,'states':states,'network':net}
   if args.content and mode=='authored':page.set_content('<script>'+spy+'</script>'+(p/'index.html').read_text(),wait_until='domcontentloaded')
   else:page.goto(url,wait_until='domcontentloaded',timeout=120000)
   page.wait_for_function('window.__DENIM_WORKBENCH__?.lastFrame');assert page.evaluate('__DENIM_WORKBENCH__.version')=='R06.0'
   def snap(name,patch=None,save=False):
    if patch is not None:
     n=page.evaluate('__DENIM_WORKBENCH__.lastFrame.frame');page.evaluate('(p)=>__DENIM_WORKBENCH__.setState(p)',patch);page.wait_for_function('(n)=>__DENIM_WORKBENCH__.lastFrame.frame>n',arg=n)
    raw=base64.b64decode(page.evaluate("document.getElementById('view').toDataURL().split(',')[1]"));im=Image.open(io.BytesIO(raw)).convert('RGB')
    q=page.evaluate('({frame:__DENIM_WORKBENCH__.lastFrame,gl:__DENIM_WORKBENCH__.getGLError(),draws:window.__draws})');assert q['gl']==0,(name,q);assert q['frame']['projection']=='perspective' and not q['frame']['solidEdgeDrawn'];assert q['frame']['colorPipeline'].startswith('linear-');assert q['draws']['instanced']>0
    q.update(name=name,hash=hashlib.sha256(raw).hexdigest());states.append(q)
    if save:(out/f'{mode}-{name}-canvas.png').write_bytes(raw);page.screenshot(path=str(out/f'{mode}-{name}.png'),timeout=180000)
    print(mode,name,q['frame']['triangles'],flush=True);return q,im
   q,initial=snap('default',save=True);assert q['frame']['geometryOnly'];iw,ih=initial.size
   corners=[initial.getpixel((int(iw*x),int(ih*y))) for x,y in [(.02,.03),(.97,.03),(.02,.97),(.97,.97)]];assert all(50<sum(c)/3<235 and max(c)-min(c)<40 for c in corners),corners
   q,s0=snap('scatter-off',{'scatter':0});q,s1=snap('scatter-on',{'scatter':1});ds=delta(s0,s1);assert ds>.05;assert q['frame']['studio']['shadowDrawCalls']==0
   _,f0=snap('fog-off',{'fog':0});_,f1=snap('fog-on',{'fog':1});df=delta(f0,f1,(0,0,40,40));assert df>.3
   page.locator('#showFray').click();q,_=snap('ragged',{'fog':.65,'scatter':.85},True);n=q['frame']['natural'];assert n['bridges']>0 and n['tails']>0 and n['partialBridges']>0;assert n['saggedBridges']==n['bridges'] and n['maxAnchorErrorMm']<1e-9
   page.locator('#rimReview').click();_,t0=snap('transmission-off',{'transmission':0});_,t1=snap('transmission-on',{'transmission':1},True);dt=delta(t0,t1);assert dt>.05
   report['modes'][mode]['layerEffects']={'scatterMeanDelta':ds,'thinTransmissionMeanDelta':dt,'fogBackgroundDelta':df,'grayCorners':corners,'note':'Causal pixel differences, not visual quality or measured optical accuracy scores'}
   snap('side',{'transmission':.55,'light':1,'damage':0,'zoom':1.3,'yaw':-.5,'pitch':.64,'panY':-12},True)
   snap('close',{'light':2,'zoom':2.35,'yaw':-.23,'pitch':.34,'panY':-4,'panX':3},True)
   if not args.quick:
    snap('back',{'yaw':3.14159265,'zoom':1,'pitch':.1,'panX':0,'panY':0},True)
    for d in [1,2,3]:snap('damage-'+str(d),{'damage':d,'yaw':-.17,'pitch':.2},d==3)
    snap('rolled',{'shape':2,'damage':0,'zoom':1},True)
    for z in [.6,.32]:q,_=snap('middle-'+str(z),{'zoom':z});assert q['frame']['geometryOnly']
    q,_=snap('far-intact',{'zoom':.1,'shape':0,'damage':0});assert not q['frame']['geometryOnly']
    q,_=snap('far-damage',{'damage':4});assert q['frame']['geometryOnly']
    snap('material-reset',{'zoom':1,'damage':0,'shape':1,'panX':0,'panY':0,'light':2})
    for button in page.locator('[data-preset]').all():
     key=button.get_attribute('data-preset');button.click();page.wait_for_timeout(100);snap('finish-'+key)
    for k in [0,1,2,3,4]:page.locator('#light').select_option(str(k));page.wait_for_timeout(100);snap('light-'+str(k))
    for k in [1,2,3,0]:page.locator('#weave').select_option(str(k));page.wait_for_timeout(100);snap('weave-'+str(k))
   snap('parameters',{'damage':4,'thickness':.83,'slub':.72,'fray':1.6})
   with page.expect_download() as dl:page.locator('#save').click()
   dl.value.save_as(str(out/f'{mode}-profile.json'));profile=json.loads((out/f'{mode}-profile.json').read_text());assert profile['schema']=='kaopu.denim_material_profile@2.4';assert profile['fiberModel']['diffusion']['weights'] and profile['damage']['released']
   page.wait_for_timeout(250);n0=page.evaluate('__DENIM_WORKBENCH__.lastFrame.frame');page.wait_for_timeout(500);n1=page.evaluate('__DENIM_WORKBENCH__ .lastFrame.frame');assert n0==n1
   verify(net)
   if mode=='file':assert not any(x.startswith('http') for x in net['requests'])
   report['modes'][mode].update(passed=True,idle=[n0,n1]);ctx.close()
  ctx=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True);page=ctx.new_page();page.set_default_timeout(180000);net=watch(page)
  if args.content and not args.public:page.set_content((p/'index.html').read_text(),wait_until='domcontentloaded')
  else:page.goto(args.public or (p/'index.html').as_uri(),wait_until='domcontentloaded')
  page.wait_for_function('window.__DENIM_WORKBENCH__?.lastFrame');page.screenshot(path=str(out/'mobile-first.png'),timeout=180000);rect=page.locator('#view').bounding_box();assert 0<=rect['y'] and rect['y']+rect['height']<=844
  page.locator('#showFray').click();page.locator('#stage').scroll_into_view_if_needed();page.locator('#rimReview').click();page.screenshot(path=str(out/'mobile-rim.png'),timeout=180000)
  m=page.evaluate('({frame:__DENIM_WORKBENCH__.lastFrame,gl:__DENIM_WORKBENCH__.getGLError()})');assert m['gl']==0 and m['frame']['natural']['bridges']>0;verify(net)
  report['mobile']={'passed':True,'viewport':[390,844],'actualPhone':False,'firstRect':rect,'network':net,**m};ctx.close();report['passed']=True
 finally:
  (out/'browser-qa.json').write_text(json.dumps(report,indent=2,ensure_ascii=False));browser.close()
