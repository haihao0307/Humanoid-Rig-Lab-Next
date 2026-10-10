"""Browser regression for the delivered page; screenshots are internal evidence."""
import argparse,hashlib,json,os,time
from pathlib import Path
from playwright.sync_api import sync_playwright
p=Path(__file__).resolve().parent;out=p/'evidence';out.mkdir(exist_ok=True)
parser=argparse.ArgumentParser();parser.add_argument('--public');parser.add_argument('--content',action='store_true');args=parser.parse_args()
spy='''(()=>{const p=WebGL2RenderingContext.prototype;window.__draws={instanced:0,indexed:0};for(const [name,key] of [['drawElementsInstanced','instanced'],['drawElements','indexed']]){const f=p[name];p[name]=function(...a){window.__draws[key]++;return f.apply(this,a)}}})();'''
def watch(page):
 data={'pageErrors':[],'consoleErrors':[],'httpErrors':[],'requests':[]}
 page.on('pageerror',lambda e:data['pageErrors'].append(str(e)))
 def console_message(m):
  if m.type=='error':
   item={'text':m.text,'location':m.location};data['consoleErrors'].append(item);print('CONSOLE_ERROR',json.dumps(item),flush=True)
 def response(r):
  if r.status>=400:
   item={'url':r.url,'status':r.status};data['httpErrors'].append(item);print('HTTP_ERROR',json.dumps(item),flush=True)
 page.on('console',console_message);page.on('response',response);page.on('request',lambda r:data['requests'].append(r.url))
 return data

def verify_errors(data):
 # Keep an exact-origin favicon warning separate. Never suppress an app failure.
 host_icon='https://htmlpreview.github.io/favicon.ico'
 warnings=[e for e in data['consoleErrors'] if e['location'].get('url')==host_icon and '404' in e['text']]
 fatal_console=[e for e in data['consoleErrors'] if e not in warnings]
 fatal_http=[e for e in data['httpErrors'] if not(e['url']==host_icon and e['status']==404)]
 data['previewHostWarnings']=warnings;data['fatalConsoleErrors']=fatal_console;data['fatalHttpErrors']=fatal_http
 assert not data['pageErrors'],data['pageErrors']
 assert not fatal_console,fatal_console
 assert not fatal_http,fatal_http

report={'version':'R04.0' ,'modes':{},'actualPhone':False,'physicalGPU':False}
with sync_playwright() as pw:
 kw={'headless':False,'args':['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']}
 if os.environ.get('CHROMIUM_PATH'):kw['executable_path']=os.environ['CHROMIUM_PATH']
 b=pw.chromium.launch(**kw)
 try:
  for mode,url in [('authored' if args.content else 'file',(p/'index.html').as_uri())]+([('public',args.public)] if args.public else []):
   ctx=b.new_context(viewport={'width':1280,'height':900},device_scale_factor=1);ctx.add_init_script(spy);page=ctx.new_page();page.set_default_timeout(120000)
   network=watch(page);states=[];report['modes'][mode]={'passed':False,'url':url,'states':states,'network':network}
   if args.content and mode=='authored':page.set_content('<script>'+spy+'</script>'+(p/'index.html').read_text(),wait_until='domcontentloaded')
   else:page.goto(url,wait_until='domcontentloaded',timeout=120000)
   page.wait_for_function('window.__DENIM_WORKBENCH__?.ready===true');assert page.evaluate('__DENIM_WORKBENCH__.version')=='R04.0'
   def snap(name,patch=None):
    if patch is not None:page.evaluate('(p)=>__DENIM_WORKBENCH__.setState(p)',patch)
    page.wait_for_timeout(160);page.screenshot(path=str(out/f'{mode}-{name}.png'),timeout=180000)
    r=page.evaluate('({frame:__DENIM_WORKBENCH__.lastFrame,gl:__DENIM_WORKBENCH__.getGLError(),draws:window.__draws})');assert r['gl']==0,(name,r);assert r['frame']['projection']=='perspective';assert not r['frame']['solidEdgeDrawn'];
    pic=page.locator('#view').screenshot(timeout=180000);r['name']=name;r['hash']=hashlib.sha256(pic).hexdigest();states.append(r);print(mode,name,r['frame']['triangles'],flush=True);return r
   default=snap('default');assert default['frame']['geometryOnly']
   # User-visible new button; not just changing internal variables.
   page.locator('#showFray').click();rag=snap('ragged');a=rag['frame']['natural'];assert a['bridges']>0 and a['tails']>0 and a['partialBridges']>0;assert a['saggedBridges']==a['bridges'];assert a['maxAnchorErrorMm']<1e-9;assert a['clumpedFibers']>a['strayFibers']>0
   for d in [2,3]:
    page.locator('#damage').select_option(str(d));r=snap(f'damage-{d}');assert r['frame']['natural']['bridges']>0 and r['frame']['natural']['tails']>0
   snap('back',{'yaw':3.14159,'pitch':.14,'zoom':1})
   snap('edge',{'yaw':-.55,'pitch':.66,'zoom':1.5,'panY':-20,'damage':0})
   snap('rolled',{'shape':2,'zoom':1,'panY':0})
   for z in [.6,.32]:assert snap(f'mid-{z}',{'zoom':z})['frame']['geometryOnly']
   far=snap('far-intact',{'zoom':.10,'shape':0,'yaw':0,'pitch':0});assert not far['frame']['geometryOnly']
   farhole=snap('far-damage',{'damage':4});assert farhole['frame']['geometryOnly']
   snap('fray-long',{'zoom':1,'fray':2.2,'damage':4,'pitch':.2})
   for l in [0,1,2,3]:
    page.locator('#light').select_option(str(l));snap(f'light-{l}')
   for preset in ['raw','vintage','black','ecru']:
    page.locator(f'[data-preset="{preset}"]').click();snap('finish-'+preset)
   for w in [1,2,3,0]:
    page.locator('#weave').select_option(str(w));snap('weave-'+str(w))
   snap('thickness',{'thickness':1.05,'slub':.9,'damage':3,'fray':1})
   with page.expect_download() as ev:page.locator('#save').click()
   ev.value.save_as(str(out/f'{mode}-profile.json'));profile=json.loads((out/f'{mode}-profile.json').read_text());assert profile['schema']=='kaopu.denim_material_profile@2.2';assert profile['damage']['released'] and profile['damage']['clumps'];assert profile['graph']['slub']==.9
   page.wait_for_timeout(200);idle1=page.evaluate('__DENIM_WORKBENCH__.lastFrame.frame');page.wait_for_timeout(500);idle2=page.evaluate('__DENIM_WORKBENCH__.lastFrame.frame');assert idle1==idle2
   verify_errors(network)
   if mode=='file':assert not [r for r in network['requests'] if r.startswith('http')]
   report['modes'][mode].update({'passed':True,'idle':[idle1,idle2]});ctx.close()
  ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True);page=ctx.new_page();page.set_default_timeout(180000);mobile_network=watch(page)
  if args.content and not args.public:page.set_content((p/'index.html').read_text(),wait_until='domcontentloaded')
  else:page.goto(args.public or (p/'index.html').as_uri(),wait_until='domcontentloaded')
  page.wait_for_function('window.__DENIM_WORKBENCH__?.ready');page.screenshot(path=str(out/'mobile-first.png'),timeout=180000);rect=page.locator('#view').bounding_box();assert 0<=rect['y'] and rect['y']+rect['height']<=844
  page.locator('#showFray').click();page.locator('#stage').scroll_into_view_if_needed();page.screenshot(path=str(out/'mobile-ragged.png'),timeout=180000);mobile=page.evaluate('({frame:__DENIM_WORKBENCH__.lastFrame,gl:__DENIM_WORKBENCH__.getGLError()})');assert mobile['gl']==0 and mobile['frame']['natural']['bridges']>0
  verify_errors(mobile_network)
  report['mobile']={'network':mobile_network,'passed':True,'actualPhone':False,'viewport':[390,844],'firstRect':rect,**mobile};ctx.close()
  report['passed']=True
 finally:
  (out/'browser-qa.json').write_text(json.dumps(report,indent=2,ensure_ascii=False));b.close()
