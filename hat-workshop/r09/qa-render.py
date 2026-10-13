"""Pixel regression and real renderer scheduling: original R08 vs recovered R09."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import threading, argparse, time, json, base64, io
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parent; ROOT=R.parent.parent
arg=argparse.ArgumentParser();arg.add_argument('--public-url');args=arg.parse_args()
Q=R/'qa'/('public-render' if args.public_url else 'render');Q.mkdir(parents=True,exist_ok=True)
report={'environment':'Ubuntu Chromium SwiftShader; not user hardware','publicURL':args.public_url,'checks':[],'errors':[],'passed':False}
def save(): (Q/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
def check(name,ok,detail=None):
 report['checks'].append({'name':name,'passed':bool(ok),'detail':detail});save()
 if not ok:raise AssertionError(name+': '+str(detail))
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}'
def capture(page,name):
 data=base64.b64decode(page.evaluate('hatLab.render()').split(',')[1]);(Q/(name+'.png')).write_bytes(data)
 return np.asarray(Image.open(io.BytesIO(data)).convert('RGB')).astype(float)
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'])
  hats=['chef','cloche','trilby','cable','flatcap']
  for id in hats:
   baseline={}
   for version in (['r09'] if args.public_url else ['r08','r09']):
    context=browser.new_context(viewport={'width':1440,'height':1000},device_scale_factor=1);page=context.new_page()
    page.on('pageerror',lambda e:report['errors'].append(str(e)))
    if not args.public_url:
     page.route('**/details/*.webp',lambda route:route.fulfill(path=str(R/'details'/route.request.url.split('/')[-1]),content_type='image/webp',headers={'Access-Control-Allow-Origin':'*'}))
    url=(args.public_url.split('#')[0] if args.public_url else f'{base}/hat-workshop/{version}/index.html')+'#hat='+id
    page.goto(url,wait_until='domcontentloaded',timeout=180000)
    page.wait_for_function('window.hatLab&&hatLab.ready()',timeout=90000)
    page.wait_for_function("['ready','not-required'].includes(hatLab.performance().detailState)",timeout=90000)
    page.wait_for_timeout(150)
    for pose in ['three','front','inside'] if id=='flatcap' else ['three']:
     page.evaluate('(pose)=>hatLab.frame(pose)',pose)
     image=capture(page,version+'-'+id+'-'+pose)
     if version=='r08':baseline[pose]=image
     else:
      ref=np.asarray(Image.open(R/'qa/render'/('r09-'+id+'-'+pose+'.png')).convert('RGB')).astype(float) if args.public_url else baseline[pose]
      check('same raster size '+id+'/'+pose,image.shape==ref.shape)
      error=np.abs(image-ref);check('original full-detail pixels retained '+id+'/'+pose,float(error.mean())<0.35 and float((error.max(axis=2)>3).mean())<0.005,{'meanAbsByteError':float(error.mean()),'fractionOver3':float((error.max(axis=2)>3).mean())})
    if version=='r09':
     page.evaluate("hatLab.frame('three')");page.wait_for_timeout(200)
     before=page.evaluate('hatLab.performance().rendering')
     page.evaluate("()=>{hatLab.frame('front');hatLab.frame('side');hatLab.frame('front');}")
     page.wait_for_timeout(250);after=page.evaluate('hatLab.performance().rendering')
     check('camera burst draws once '+id,after['submissions']-before['submissions']==1,{'before':before,'after':after})
     check('camera-only movement reuses unchanged shadows '+id,after['shadowUpdates']==before['shadowUpdates'])
     before=after
     page.evaluate("()=>{hatLab.frame('three');hatLab.render();}");page.wait_for_timeout(200)
     after=page.evaluate('hatLab.performance().rendering')
     check('immediate draw cancels duplicate queued draw '+id,after['submissions']-before['submissions']==1 and after['cancelledDuplicates']>before['cancelledDuplicates'])
     before=after;page.evaluate("hatLab.set({light:'raking'})");page.wait_for_timeout(200);after=page.evaluate('hatLab.performance().rendering')
     check('changed lighting refreshes shadow map '+id,after['shadowUpdates']>before['shadowUpdates'])
     if id=='flatcap':
      before=after;page.locator('#rotate').click();page.wait_for_timeout(400);page.locator('#rotate').click();after=page.evaluate('hatLab.performance().rendering')
      check('turntable continues to refresh moving shadows',after['shadowUpdates']>before['shadowUpdates'] and after['submissions']>before['submissions'])
      page.evaluate("hatLab.frame('three')");page.wait_for_timeout(100)
    context.close()
  browser.close()
 check('no application exceptions',not report['errors'],report['errors']);report['passed']=True;save();print(json.dumps({'passed':True,'checks':len(report['checks'])}),flush=True)
except Exception as e:report['failure']=str(e);save();raise
finally:server.shutdown()
