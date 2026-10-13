"""Additional actual-render tests, independent of the general browser regression."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
import argparse,threading,json,base64,io
from PIL import Image,ImageStat,ImageChops
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parent
P=argparse.ArgumentParser();P.add_argument('--url');P.add_argument('--source',required=True);A=P.parse_args()
Q=R/'qa'/('public-r102' if A.url else 'browser-r102');Q.mkdir(parents=True,exist_ok=True)
report={'version':'HAT-R10.2','source':A.source,'url':A.url,'environment':'GitHub Actions Ubuntu Chromium SwiftShader; not user hardware','checks':[],'errors':[],'passed':False}
def save(): (Q/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
def check(name,ok,detail=None):
 report['checks'].append({'name':name,'passed':bool(ok),'detail':detail});save()
 if not ok:raise AssertionError(name+': '+str(detail))
server=None
if A.url:url=A.url
else:
 server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(R)))
 threading.Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/index.html#hat=pinch'
def capture(page,name):
 data=base64.b64decode(page.evaluate('ownedHat.render()').split(',')[1]);im=Image.open(io.BytesIO(data)).convert('RGB')
 check('visible pixels '+name,sum(ImageStat.Stat(im).var)>50)
 (Q/(name+'.png')).write_bytes(data);return im
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'])
  ctx=b.new_context(viewport={'width':1440,'height':1000},device_scale_factor=1);page=ctx.new_page()
  page.on('pageerror',lambda e:report['errors'].append(str(e)))
  page.goto(url,wait_until='domcontentloaded',timeout=120000);page.wait_for_function('window.ownedHat&&ownedHat.ready()&&ownedHat.stats().thumbs===11',timeout=90000)
  check('source and version',page.evaluate('ownedHat.source')==A.source and page.evaluate('ownedHat.version')=='HAT-R10.2')
  check('same display transform',page.evaluate('ownedHat.stats().metrics.thumbnailOutput')=='display-srgb-tone-mapped')
  thumbs=page.evaluate("""()=>Array.from(document.querySelectorAll('.hat-card')).map(b=>{const im=b.querySelector('img'),c=document.createElement('canvas');c.width=220;c.height=146;const x=c.getContext('2d');x.drawImage(im,0,0);return {id:b.dataset.id,rgb:Array.from(x.getImageData(0,0,1,1).data).slice(0,3),data:c.toDataURL('image/png')};})""")
  for thumb in thumbs:
   rgb=thumb['rgb'];check('sRGB thumbnail background '+thumb['id'],max(abs(a-b) for a,b in zip(rgb,[222,222,215]))<=7,rgb)
   (Q/('thumb-'+thumb['id']+'.png')).write_bytes(base64.b64decode(thumb['data'].split(',')[1]))
  size=page.evaluate('({w:document.querySelector("#canvas").width,cw:document.querySelector("#canvas").getBoundingClientRect().width})')
  check('display drawing buffer restored',abs(size['w']-size['cw'])<=1,size)
  page.evaluate("ownedHat.frame('top')");capture(page,'pinch-top');page.evaluate("ownedHat.frame('three')");capture(page,'pinch-three')
  for id in ['pinch','bucket','braid']:
   page.evaluate('(id)=>ownedHat.restore(HAT10.defaults(id))',id);page.wait_for_function('ownedHat.ready()')
   page.evaluate("ownedHat.frame('three')");h=page.evaluate('ownedHat.hash()');generated=page.evaluate('ownedHat.stats().metrics.generated')
   page.evaluate('ownedHat.set({detail:0,seed:111})');smooth=capture(page,id+'-detail-zero')
   page.evaluate('ownedHat.set({detail:1.3,seed:111})');detailed=capture(page,id+'-detail-on')
   diff=sum(ImageStat.Stat(ImageChops.difference(smooth,detailed)).mean)/3
   check('detail has actual shader effect '+id,diff>.05,{'meanAbsByteDifference':diff})
   page.evaluate('ownedHat.set({detail:1.3,seed:222})');seeded=capture(page,id+'-seed-222')
   diff=sum(ImageStat.Stat(ImageChops.difference(detailed,seeded)).mean)/3
   check('seed has actual shader effect '+id,diff>.02,{'meanAbsByteDifference':diff})
   check('surface changes preserve geometry '+id,page.evaluate('ownedHat.hash()')==h)
   check('surface changes do not regenerate '+id,page.evaluate('ownedHat.stats().metrics.generated')==generated)
  before=page.evaluate('ownedHat.stats().metrics')
  page.evaluate("()=>{for(let i=0;i<16;i++)void ownedHat.set({id:'bucket',circumference:59.1});}")
  page.wait_for_function("ownedHat.ready()&&ownedHat.recipe().id==='bucket'&&ownedHat.recipe().circumference===59.1",timeout=15000)
  after=page.evaluate('ownedHat.stats().metrics')
  check('duplicate in-flight selections deduplicated',after['ignoredDuplicates']-before['ignoredDuplicates']==15,{'before':before,'after':after})
  check('one generation for duplicate selection burst',after['generated']-before['generated']==1)
  page.evaluate("ownedHat.restore(HAT10.defaults('pinch'))");page.wait_for_function('ownedHat.ready()');page.evaluate("ownedHat.frame('three')")
  page.screenshot(path=str(Q/'desktop.png'),timeout=20000)
  check('no browser or shader exceptions',not report['errors'] and not page.evaluate('ownedHat.stats().errors'),page.evaluate('ownedHat.stats().errors'))
  report['passed']=True;save();ctx.close();b.close()
 print(json.dumps({'passed':True,'checks':len(report['checks'])}),flush=True)
except Exception as e:report['failure']=str(e);save();raise
finally:
 if server:server.shutdown()
