"""Quick real-browser visual gate. Does not replace the all-eleven/public QA."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
import threading,json,base64
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parent;Q=R/'qa/probe';Q.mkdir(parents=True,exist_ok=True)
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(R)))
threading.Thread(target=server.serve_forever,daemon=True).start()
errors=[]
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'])
  page=b.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('console',lambda m:errors.append(m.text) if m.type=='error' and ('Shader' in m.text or 'VALIDATE_STATUS' in m.text) else None)
  page.goto(f'http://127.0.0.1:{server.server_port}/index.html#hat=cable',wait_until='domcontentloaded',timeout=60000)
  page.wait_for_function('window.hatSurface&&hatSurface.ready()',timeout=60000)
  for id in ['cable','sherpa','flatcap']:
   page.evaluate('(id)=>hatSurface.select(id)',id)
   for view in ['three','detail']:
    page.evaluate('(v)=>hatLab.frame(v)',view)
    (Q/(id+'-'+view+'.png')).write_bytes(base64.b64decode(page.evaluate('hatSurface.render()').split(',')[1]))
  (Q/'report.json').write_text(json.dumps({'source':page.evaluate('hatSurface.snapshot().sourceSha'),'errors':errors,'visualApproved':False,'scope':'quick rendered views only; full QA remains required'},indent=2))
  assert not errors,errors
  b.close()
finally:server.shutdown()
