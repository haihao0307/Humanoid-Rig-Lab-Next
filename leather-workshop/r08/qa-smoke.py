from pathlib import Path
import os,json,traceback
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parent;O=R/'qa/smoke';O.mkdir(parents=True,exist_ok=True)
q={'errors':[],'objects':[]}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('KAOPU_CHROMIUM_EXECUTABLE'),headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']);page=b.new_page(viewport={'width':1440,'height':1000});page.set_default_timeout(180000)
 page.on('pageerror',lambda e:q['errors'].append(str(e)));page.on('console',lambda m:q['errors'].append(m.text) if m.type=='error' else None)
 try:
  page.goto((R/'public-lite.html').as_uri(),wait_until='domcontentloaded',timeout=180000)
  page.wait_for_function("window.LEATHER_ATELIER?.ready || !document.getElementById('error').hidden",timeout=240000)
  assert page.evaluate('!!window.LEATHER_ATELIER?.ready'),page.locator('#error').inner_text()
  for id in ['wallet','belt','bag','cowboy','pirate','jacket','swatch']:
   page.evaluate('(id)=>LEATHER_ATELIER.selectProduct(id)',id);page.evaluate('LEATHER_ATELIER.render()');page.wait_for_timeout(120);page.screenshot(path=str(O/(id+'.png')))
   q['objects'].append(page.evaluate('LEATHER_ATELIER.snapshot()'))
   for view in ['macro','back']:
    page.evaluate('(v)=>LEATHER_ATELIER.setView(v)',view);page.evaluate('LEATHER_ATELIER.render()');page.screenshot(path=str(O/(id+'-'+view+'.png')))
  q['pass']=not q['errors']
 except Exception as e:
  q['pass']=False;q['failure']=str(e);q['traceback']=traceback.format_exc();page.screenshot(path=str(O/'FAILURE.png'))
 finally:
  (O/'report.json').write_text(json.dumps(q,ensure_ascii=False,indent=2));b.close()
print(json.dumps({'pass':q.get('pass'),'failure':q.get('failure'),'errors':q['errors']},ensure_ascii=False));raise SystemExit(0 if q.get('pass') else 1)
