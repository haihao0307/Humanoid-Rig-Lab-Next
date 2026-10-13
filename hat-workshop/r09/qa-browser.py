from qa_capture import capture_page
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
import threading,json,time,argparse
import numpy as np
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parent;ROOT=R.parent.parent
P=argparse.ArgumentParser();P.add_argument('--public-url');P.add_argument('--source');args=P.parse_args()
Q=R/'qa'/('public' if args.public_url else 'browser');Q.mkdir(parents=True,exist_ok=True)
report={'environment':'GitHub Actions Ubuntu / Chromium / SwiftShader; not user hardware','publicURL':args.public_url,'checks':[],'clicks':[],'pageErrors':[],'passed':False}
def save(): (Q/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
def check(name,passed,detail=None):
 report['checks'].append({'name':name,'passed':bool(passed),'detail':detail});save()
 if not passed:raise AssertionError(name+': '+str(detail))
server=None
if not args.public_url:
 server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(ROOT)))
 threading.Thread(target=server.serve_forever,daemon=True).start()
 base=f'http://127.0.0.1:{server.server_port}/hat-workshop/r09/index.html#hat=trilby'
else:base=args.public_url
heartbeat="""window.__ticks=0;window.__stallWorker=false;setInterval(()=>window.__ticks++,40);
const RealWorker=window.Worker;window.Worker=class extends RealWorker{postMessage(msg,...args){if(window.__stallWorker&&msg.kind!=='head')return;return super.postMessage(msg,...args);}};"""
def open_page(browser,mode='normal',slow=False):
 context=browser.new_context(viewport={'width':1440,'height':1000},device_scale_factor=1)
 page=context.new_page();page.add_init_script(heartbeat)
 page.on('pageerror',lambda e:report['pageErrors'].append(str(e)))
 req=[];page.on('request',lambda r:req.append(r.url))
 if not args.public_url:
  def detail(route):
   if mode=='stall':return
   route.fulfill(path=str(R/'details'/route.request.url.split('/')[-1]),content_type='image/webp',headers={'Access-Control-Allow-Origin':'*'})
  page.route('**/details/*.webp',detail)
 elif mode=='stall':page.route('**/details/*.webp',lambda route:None)
 if slow:context.new_cdp_session(page).send('Emulation.setCPUThrottlingRate',{'rate':4})
 t=time.perf_counter();page.goto(base,wait_until='domcontentloaded',timeout=180000)
 page.wait_for_function('window.hatLab&&hatLab.ready()',timeout=90000)
 elapsed=(time.perf_counter()-t)*1000
 check(mode+' page boot',page.evaluate('hatLab.version')=='HAT-R09.0',{'coldWallMS':elapsed,'slowMainThread':slow})
 if args.source:check('actual source identity',page.evaluate('hatLab.sourceCommit')==args.source)
 check('11 thumbnails retained',page.evaluate('hatLab.thumbnails()')==11)
 return context,page,req

def click_hat(page,id,label='normal'):
 before=page.evaluate('__ticks');start=time.perf_counter()
 page.locator(f'.hat-card[data-id="{id}"]').click()
 page.wait_for_function('(id)=>hatLab.ready()&&hatLab.metrics().hat===id',arg=id,timeout=35000)
 item={'label':label,'id':id,'clickToReadyWallMS':(time.perf_counter()-start)*1000,'pageTiming':page.evaluate('hatLab.performance().lastSwitch'),'heartbeatTicks':page.evaluate('__ticks')-before,'head':page.evaluate('hatLab.metrics().headId'),'positionHash':page.evaluate('hatLab.geometryHash()'),'bandHash':page.evaluate('hatLab.bandGeometryHash()')}
 report['clicks'].append(item);check('visible '+label+'/'+id,page.evaluate('hatLab.metrics().hatVisible'));return item

try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'])
  context,page,requests=open_page(b)
  ids=page.evaluate('hatLab.catalogue().map(h=>h.id)')
  ref=json.loads((R/'qa/worker-equivalence.json').read_text());refs={(r['hat'],r['head']):r for r in ref['records']}
  for hi in ([0] if args.public_url else [0,1,2]):
   page.evaluate('(head)=>hatLab.set({head})',hi);headHash=page.evaluate('hatLab.headGeometryHash()')
   for id in ids:
    row=click_hat(page,id,'cold-catalogue' if hi==0 else 'head-'+str(hi));key=(id,row['head']);expected=refs[key]
    if row['positionHash']!=expected['positionHash'] or row['bandHash']!=expected['bandHash']:
     prefix=R.parent/'r07/qa/geometry-dump'/f'{row["head"]}--{id}--'
     old=np.fromfile(str(prefix)+'position.bin','<f4');new=np.asarray(page.evaluate('hatLab.currentPositions()'))
     err=float(np.max(np.abs(old-new))) if len(old)==len(new) else float('inf')
     if row['bandHash']:
      old=np.fromfile(str(prefix)+'band-position.bin','<f4');new=np.asarray(page.evaluate('hatLab.debugGeometry().sweatband.position'));err=max(err,float(np.max(np.abs(old-new))))
     check('geometry agrees R07.1 '+str(key),err<2e-8,err)
    else:check('geometry identical R07.1 '+str(key),True)
    check('head geometry unchanged '+id,headHash==page.evaluate('hatLab.headGeometryHash()'))
    if hi==0 and id in ['trilby','flatcap','cable','chef','cloche']:
     if id in ['trilby','cable']:page.wait_for_function("hatLab.performance().detailState==='ready'",timeout=80000)
     page.evaluate("hatLab.frame('three')");page.wait_for_timeout(100);page.locator('#canvas').screenshot(path=str(Q/(id+'.png')))
     if id=='flatcap':page.evaluate("hatLab.frame('inside')");page.wait_for_timeout(100);page.locator('#canvas').screenshot(path=str(Q/'flatcap-inside.png'))
  check('no remote package requests',not any('/r03/assets/' in u for u in requests))
  page.evaluate('hatLab.set({head:0})');click_hat(page,'flatcap')
  gh=page.evaluate('hatLab.geometryHash()');page.evaluate('hatLab.set({roughness:.8,detail:.9})');check('material edits preserve geometry',gh==page.evaluate('hatLab.geometryHash()'))
  box=page.locator('#compare').bounding_box();page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2);page.mouse.down();page.wait_for_timeout(50);page.mouse.up()
  check('comparison release preserves geometry',gh==page.evaluate('hatLab.geometryHash()'))
  page.evaluate("hatLab.setPreset('standard')");check('preset preserved',gh==page.evaluate('hatLab.geometryHash()'))
  page.evaluate('hatLab.restore(hatLab.recipe())');check('recipe restored',gh==page.evaluate('hatLab.geometryHash()'))
  capture_page(page, report=report, path=str(Q/'desktop.png'));report['nominalPerformance']=page.evaluate('hatLab.performance()');context.close()
  context,page,requests=open_page(b,mode='stall');context.set_offline(True)
  for id in ids:click_hat(page,id,'network-offline')
  check('all hats usable offline after page load',len([x for x in report['clicks'] if x['label']=='network-offline'])==11)
  capture_page(page, report=report, path=str(Q/'offline-switch.png'));context.close()
  context,page,requests=open_page(b,mode='stall',slow=not bool(args.public_url))
  count=page.evaluate('hatLab.performance().worker.started')
  page.evaluate("()=>{const card=document.querySelector('.hat-card[data-id=patrol]');for(let i=0;i<16;i++)card.click();}")
  page.wait_for_function("hatLab.ready()&&hatLab.metrics().hat==='patrol'",timeout=35000)
  perf=page.evaluate('hatLab.performance()');check('16 identical clicks -> one generation',perf['worker']['started']-count==1,perf['worker'])
  check('duplicate clicks recorded',sum(e['kind']=='deduplicated-click' for e in perf['selectionEvents'])>=15)
  page.locator('.hat-card[data-id=cable]').click();page.wait_for_function('hatLab.performance().worker.active===1',timeout=10000)
  at=page.evaluate('__ticks');page.wait_for_timeout(100);check('interface heartbeat during worker',page.evaluate('__ticks')>at)
  click_hat(page,'flatcap','supersede-worker');page.wait_for_timeout(300)
  check('latest click wins',page.evaluate('hatLab.metrics().hat')=='flatcap');check('superseded Worker terminated',page.evaluate('hatLab.performance().worker.terminated')>=1)
  page.locator('.hat-card[data-id=sherpa]').click();page.wait_for_function('hatLab.performance().worker.active===1',timeout=10000)
  page.locator('#cancel-load').click();page.wait_for_function('hatLab.ready()',timeout=3000)
  check('explicit cancel preserves current hat',page.evaluate('hatLab.metrics().hat')=='flatcap');click_hat(page,'sherpa','after-cancel')
  check('no permanent busy state',page.evaluate('hatLab.ready()'));report['faultPerformance']=page.evaluate('hatLab.performance()');context.close()
  if not args.public_url:
   context,page,requests=open_page(b,mode='stall');page.evaluate('__stallWorker=true');page.locator('.hat-card[data-id=chef]').click()
   page.wait_for_function('hatLab.performance().worker.timeouts>=1&&hatLab.ready()',timeout=28000)
   check('worker timeout leaves original visible',page.evaluate('hatLab.metrics().hat')=='trilby');check('timeout message visible','超过' in page.locator('#status').inner_text())
   page.evaluate('__stallWorker=false');click_hat(page,'flatcap','after-worker-timeout');context.close()
   context,page,requests=open_page(b,mode='stall');page.wait_for_function("hatLab.performance().detailState==='retry'",timeout=20000)
   check('detail timeout does not block ready',page.evaluate('hatLab.ready()'));click_hat(page,'chef','after-detail-timeout');context.close()
  context,page,requests=open_page(b,mode='stall');page.set_viewport_size({'width':390,'height':844});click_hat(page,'flatcap','mobile-viewport')
  capture_page(page, report=report, path=str(Q/'mobile-viewport.png'));report['mobileScope']='390x844 viewport only; not a physical phone';context.close();b.close()
 check('no application exceptions',not report['pageErrors'],report['pageErrors']);report['passed']=True;save();print(json.dumps({'passed':True,'checks':len(report['checks']),'clicks':len(report['clicks'])}),flush=True)
except Exception as e:
 report['failure']=str(e);save();raise
finally:
 if server:server.shutdown()
