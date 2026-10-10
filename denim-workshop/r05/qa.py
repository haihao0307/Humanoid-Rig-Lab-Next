"""Actual file and public browser verification. --content is only a local authored test."""
import argparse,base64,hashlib,json,os,io
from pathlib import Path
from PIL import Image,ImageChops,ImageStat
from playwright.sync_api import sync_playwright
p=Path(__file__).resolve().parent;out=p/'evidence';out.mkdir(exist_ok=True)
a=argparse.ArgumentParser();a.add_argument('--public');a.add_argument('--content',action='store_true');a.add_argument('--quick',action='store_true');args=a.parse_args()
spy="""(()=>{let p=WebGL2RenderingContext.prototype;window.__draws={instanced:0,indexed:0};for(let [n,k] of [['drawElementsInstanced','instanced'],['drawElements','indexed']]){let f=p[n];p[n]=function(...a){window.__draws[k]++;return f.apply(this,a)}}})();"""
def watch(page):
 d={'pageErrors':[],'consoleErrors':[],'httpErrors':[],'requests':[]}
 page.on('pageerror',lambda e:d['pageErrors'].append(str(e)))
 page.on('console',lambda m:d['consoleErrors'].append({'text':m.text,'url':m.location.get('url','')}) if m.type=='error' else None)
 page.on('response',lambda r:d['httpErrors'].append({'url':r.url,'status':r.status}) if r.status>=400 else None)
 page.on('request',lambda r:d['requests'].append(r.url));return d

def verify_network(d):
 icon='https://htmlpreview.github.io/favicon.ico'
 d['previewHostWarnings']=[e for e in d['consoleErrors'] if e['url']==icon and '404' in e['text']]
 assert not d['pageErrors'],d
 assert not [e for e in d['consoleErrors'] if e not in d['previewHostWarnings']],d
 assert not [e for e in d['httpErrors'] if not(e['url']==icon and e['status']==404)],d

def image(page):
 raw=base64.b64decode(page.evaluate("document.getElementById('view').toDataURL('image/png').split(',')[1]"))
 return raw,Image.open(io.BytesIO(raw)).convert('RGB')

def diff(a,b,box):
 return sum(ImageStat.Stat(ImageChops.difference(a.crop(box),b.crop(box))).mean)/3

r={'version':'R05.0','actualPhone':False,'physicalGPU':False,'modes':{}}
with sync_playwright() as pw:
 kw={'headless':False,'args':['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']}
 if os.environ.get('CHROMIUM_PATH'):kw['executable_path']=os.environ['CHROMIUM_PATH']
 b=pw.chromium.launch(**kw)
 try:
  for mode,url in [('authored' if args.content else 'file',(p/'index.html').as_uri())]+([('public',args.public)] if args.public else []):
   ctx=b.new_context(viewport={'width':1100,'height':840},device_scale_factor=1);ctx.add_init_script(spy)
   page=ctx.new_page();page.set_default_timeout(180000);network=watch(page);states=[]
   r['modes'][mode]={'url':url,'passed':False,'states':states,'network':network}
   if args.content and mode=='authored':page.set_content('<script>'+spy+'</script>'+(p/'index.html').read_text(),wait_until='domcontentloaded')
   else:page.goto(url,wait_until='domcontentloaded',timeout=120000)
   page.wait_for_function('window.__DENIM_WORKBENCH__?.lastFrame');assert page.evaluate('__DENIM_WORKBENCH__.version')=='R05.0'
   def snap(name,patch=None,screen=False):
    if patch is not None:
     prev=page.evaluate('__DENIM_WORKBENCH__.lastFrame.frame');page.evaluate('(p)=>__DENIM_WORKBENCH__.setState(p)',patch)
     page.wait_for_function('(n)=>__DENIM_WORKBENCH__.lastFrame.frame>n',arg=prev)
    raw,im=image(page)
    q=page.evaluate('({frame:__DENIM_WORKBENCH__.lastFrame,gl:__DENIM_WORKBENCH__.getGLError(),draws:window.__draws})')
    assert q['gl']==0,(name,q);assert q['frame']['projection']=='perspective';assert not q['frame']['solidEdgeDrawn'];assert q['frame']['renderTarget'][0]*q['frame']['renderTarget'][1]<=2405000
    q['name']=name;q['hash']=hashlib.sha256(raw).hexdigest();states.append(q)
    if screen:
     (out/f'{mode}-{name}-canvas.png').write_bytes(raw);page.screenshot(path=str(out/f'{mode}-{name}.png'),timeout=180000)
    print(mode,name,q['frame']['triangles'],q['frame']['studio'],flush=True);return q,im
   q,im=snap('default',screen=True);assert q['frame']['geometryOnly'];assert q['draws']['instanced']>0
   w,h=im.size;corners=[im.getpixel((int(w*x),int(h*y))) for x,y in [(.03,.04),(.96,.05),(.03,.94),(.96,.94)]]
   assert all(40<sum(c)/3<240 and max(c)-min(c)<40 for c in corners),corners
   r['modes'][mode]['grayCornerRGB']=corners
   # Fog changes the backdrop; fine gaps and transparent fibers legitimately reveal it.
   page.locator('#fog').fill('0');page.locator('#fog').dispatch_event('input');page.wait_for_timeout(150)
   _,fog0=snap('fog-off')
   page.locator('#fog').fill('1');page.locator('#fog').dispatch_event('input');page.wait_for_timeout(150)
   fq,fog1=snap('fog-on',screen=True)
   bg=diff(fog0,fog1,(0,0,40,40));cloth=diff(fog0,fog1,(w//2-12,h//2-12,w//2+12,h//2+12));assert bg>.3,bg
   blue=[]
   for yy in range(h//2-70,h//2+70):
    for xx in range(w//2-70,w//2+70):
     c=fog0.getpixel((xx,yy));d=fog1.getpixel((xx,yy))
     if c[2]-c[0]>12 and sum(c)/3<120:blue.append(max(abs(c[i]-d[i]) for i in range(3)))
   assert len(blue)>500;unchanged=sum(v==0 for v in blue)/len(blue);assert unchanged>.85,unchanged
   assert fq['frame']['studio']['shadowDrawCalls']==0,'Exposure/fog reuse shadows'
   r['modes'][mode]['fogIsolation']={'backgroundDelta':bg,'centerPatchDeltaIncludingGaps':cloth,'selectedBluePixels':len(blue),'unchangedBlueFraction':unchanged,'note':'Fine gaps/alpha fibers reveal a changed background; solid unblended cloth is not fog shaded'}
   snap('exposure',{'exposure':1.25,'fog':.65})
   if not args.quick:
    for l in [0,1,2,3]:page.locator('#light').select_option(str(l));page.wait_for_timeout(150);snap('light-'+str(l),screen=l==1)
   page.locator('#showFray').click();page.wait_for_timeout(150)
   q,_=snap('ragged',{'exposure':1,'light':2},True);n=q['frame']['natural'];assert n['bridges']>0 and n['tails']>0 and n['partialBridges']>0;assert n['maxAnchorErrorMm']<1e-9
   for d in [2,3]:page.locator('#damage').select_option(str(d));page.wait_for_timeout(150);snap('damage-'+str(d),screen=True)
   snap('back',{'yaw':3.14159265,'pitch':.14,'zoom':1},True)
   snap('edge',{'damage':0,'yaw':-.5,'pitch':.64,'zoom':1.3,'panY':-12},True)
   snap('close-fiber',{'yaw':-.23,'pitch':.34,'zoom':2.35,'panY':-4,'panX':3},True)
   if not args.quick:
    snap('rolled',{'shape':2,'zoom':1,'panY':0},True)
    for z in [.6,.32]:q,_=snap('mid-'+str(z),{'zoom':z});assert q['frame']['geometryOnly']
    q,_=snap('far-intact',{'zoom':.1,'shape':0,'damage':0});assert not q['frame']['geometryOnly']
    q,_=snap('far-damage',{'damage':4});assert q['frame']['geometryOnly']
    snap('reset-material',{'damage':0,'shape':1,'zoom':1,'panX':0,'panY':0,'seam':True})
    for button in page.locator('[data-preset]').all():
     name=button.get_attribute('data-preset');button.click();page.wait_for_timeout(150);snap('finish-'+name)
    for weave in [1,2,3,0]:page.locator('#weave').select_option(str(weave));page.wait_for_timeout(150);snap('weave-'+str(weave))
   snap('parameters',{'thickness':.85,'slub':.7,'fray':1.4,'damage':4})
   with page.expect_download() as dl:page.locator('#save').click()
   dl.value.save_as(str(out/f'{mode}-profile.json'));pr=json.loads((out/f'{mode}-profile.json').read_text());assert pr['schema']=='kaopu.denim_material_profile@2.3';assert pr['display']['studio']['background']=='gray-studio-planes';assert pr['damage']['released']
   page.wait_for_timeout(250);f0=page.evaluate('__DENIM_WORKBENCH__.lastFrame.frame');page.wait_for_timeout(500);f1=page.evaluate('__DENIM_WORKBENCH__.lastFrame.frame');assert f0==f1
   verify_network(network)
   if mode=='file':assert not any(x.startswith('http') for x in network['requests'])
   r['modes'][mode].update(passed=True,idle=[f0,f1]);ctx.close()
  ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True);page=ctx.new_page();page.set_default_timeout(180000);net=watch(page)
  if args.content and not args.public:page.set_content((p/'index.html').read_text(),wait_until='domcontentloaded')
  else:page.goto(args.public or (p/'index.html').as_uri(),wait_until='domcontentloaded')
  page.wait_for_function('window.__DENIM_WORKBENCH__?.lastFrame');page.screenshot(path=str(out/'mobile-first.png'),timeout=180000);rect=page.locator('#view').bounding_box();assert 0<=rect['y'] and rect['y']+rect['height']<=844
  page.locator('#showFray').click();page.locator('#stage').scroll_into_view_if_needed();page.screenshot(path=str(out/'mobile-ragged.png'),timeout=180000)
  m=page.evaluate('({frame:__DENIM_WORKBENCH__.lastFrame,gl:__DENIM_WORKBENCH__.getGLError()})');assert m['gl']==0 and m['frame']['natural']['bridges']>0;assert m['frame']['studio']['shadowSize']==768
  verify_network(net);r['mobile']={'passed':True,'firstRect':rect,'network':net,**m};ctx.close();r['passed']=True
 finally:
  (out/'browser-qa.json').write_text(json.dumps(r,indent=2,ensure_ascii=False));b.close()
