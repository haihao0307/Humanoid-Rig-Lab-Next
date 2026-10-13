from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
import argparse,threading,json,time,statistics
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parent;ROOT=R.parent.parent
parser=argparse.ArgumentParser();parser.add_argument('--public-url');args=parser.parse_args()
Q=R/'qa'/('public-iteration' if args.public_url else 'iteration');Q.mkdir(parents=True,exist_ok=True)
report={'environment':'GitHub Actions Ubuntu Chromium SwiftShader; not user hardware','publicURL':args.public_url,'checks':[],'runs':{},'pageErrors':[],'passed':False}
def save(): (Q/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
def check(name,passed,detail=None):
 report['checks'].append({'name':name,'passed':bool(passed),'detail':detail});save()
 if not passed:raise AssertionError(name+': '+str(detail))
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
local=f'http://127.0.0.1:{server.server_port}'
def url(version):return args.public_url if args.public_url and version=='r09' else f'{local}/hat-workshop/{version}/index.html#hat=trilby'
def context_for(browser,version='r09',details='blocked',hang_cache=False):
 context=browser.new_context(viewport={'width':1440,'height':1000},device_scale_factor=1)
 page=context.new_page();page.on('pageerror',lambda e:report['pageErrors'].append(str(e)))
 if hang_cache:page.add_init_script("Object.defineProperty(window,'caches',{value:{open:()=>new Promise(()=>{})},configurable:true});")
 def detail(route):
  if details=='blocked':return route.abort()
  if not args.public_url:return route.fulfill(path=str(R/'details'/route.request.url.split('/')[-1]),content_type='image/webp',headers={'Access-Control-Allow-Origin':'*'})
  return route.continue_()
 page.route('**/details/*.webp',detail)
 t=time.perf_counter();page.goto(url(version),wait_until='domcontentloaded',timeout=180000)
 page.wait_for_function('window.hatLab && hatLab.ready()',timeout=90000)
 return context,page,(time.perf_counter()-t)*1000

def click(page,id):
 t=time.perf_counter();page.locator(f'.hat-card[data-id="{id}"]').click();page.wait_for_function('(id)=>hatLab.ready()&&hatLab.metrics().hat===id',arg=id,timeout=35000)
 return {'id':id,'wallMS':(time.perf_counter()-t)*1000,'timing':page.evaluate('hatLab.performance().lastSwitch')}
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'])
  for v in (['r09'] if args.public_url else ['r08','r09']):
   c,p,boot=context_for(b,v);ids=p.evaluate('hatLab.catalogue().map(x=>x.id)');rows=[];hashes={};cycles=[]
   for cycle in range(4):
    before=p.evaluate('hatLab.performance().worker.started');current=[]
    for id in ids:
     r=click(p,id);r['cycle']=cycle;current.append(r);rows.append(r)
     h=p.evaluate('[hatLab.geometryHash(),hatLab.bandGeometryHash(),hatLab.headGeometryHash()]')
     if id not in hashes:hashes[id]=h
     else:check(v+' stable geometry '+str(cycle)+'/'+id,hashes[id]==h)
    after=p.evaluate('hatLab.performance()');cycles.append({'cycle':cycle,'workerStarts':after['worker']['started']-before,'medianWallMS':statistics.median(x['wallMS'] for x in current),'performance':after})
    if v=='r09':
     q=after['geometryCache'];check('array cache bounded cycle '+str(cycle),q['retainedArrayBytes']<=q['maxBytes'] and q['entries']<=q['maxEntries'],q)
     if cycle>0:check('no repeated generation/fit on full-directory return '+str(cycle),after['worker']['started']==before)
   report['runs'][v]={'bootWallMS':boot,'clicks':rows,'cycles':cycles};save()
   if v=='r09':
    m=p.evaluate('hatLab.performance()');check('CPU cache survives GPU eviction',m['geometryCache']['hits']>0,m['geometryCache'])
    h=p.evaluate('hatLab.geometryHash()');p.locator('#clear-cache').click();after=p.evaluate('hatLab.performance()');check('clear frees idle assets and derived arrays',after['idleAssets']==0 and after['geometryCache']['entries']==0)
    check('clear preserves current visible geometry',h==p.evaluate('hatLab.geometryHash()') and p.evaluate('hatLab.ready()'))
    before=after['worker']['started'];click(p,'cable');check('rebuild after explicit clear works',p.evaluate('hatLab.performance().worker.started')>before)
    check('startup decoded in Worker',p.evaluate('hatLab.performance().startup.payloadWorkerMS')>0)
   c.close()
  c,p,boot=context_for(b,details='live');normal_ids=['cable','fishing','sherpa','patrol','visor','trilby']
  for id in normal_ids:
   click(p,id);p.wait_for_function("hatLab.performance().detailState==='ready'",timeout=80000)
  before=p.evaluate('hatLab.performance().detailCache.networkRequests')
  for id in normal_ids:
   click(p,id);p.wait_for_function("hatLab.performance().detailState==='ready'",timeout=80000)
  q=p.evaluate('hatLab.performance().detailCache');check('all original HD normals reused without HTTP',q['networkRequests']==before,q)
  check('HD byte memory bounded',q['memoryBytes']<=q['maxMemoryBytes'],q)
  p.evaluate("hatLab.frame('three')");p.screenshot(path=str(Q/'desktop-full-detail.png'));c.close()
  if not args.public_url:
   c,p,_=context_for(b,details='live',hang_cache=True);p.wait_for_function("hatLab.performance().detailState==='ready'",timeout=15000)
   check('blocked disk cache still reaches original HD',p.evaluate('hatLab.performance().detailCache.cacheTimeouts')>=1)
   click(p,'flatcap');check('selection survives blocked disk cache',p.evaluate('hatLab.ready()'));c.close()
   c,p,_=context_for(b,details='live');p.wait_for_function("hatLab.performance().detailState==='ready'",timeout=15000);p.wait_for_timeout(800)
   p.reload(wait_until='domcontentloaded');p.wait_for_function("window.hatLab&&hatLab.ready()&&hatLab.performance().detailState==='ready'",timeout=25000)
   check('HD cache survives page reload',p.evaluate('hatLab.performance().detailCache.diskHits')>=1);c.close()
  b.close()
 check('no application exceptions',not report['pageErrors'],report['pageErrors']);report['passed']=True;save();print(json.dumps({'passed':True,'checks':len(report['checks'])}),flush=True)
except Exception as e:report['failure']=str(e);save();raise
finally:server.shutdown()
