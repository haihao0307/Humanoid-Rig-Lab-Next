"""Actual file:// smoke and material A/B. Not a visual approval or a public test."""
from pathlib import Path
import argparse,json,traceback
from playwright.sync_api import sync_playwright
import numpy as np
from PIL import Image
R=Path(__file__).resolve().parent
ap=argparse.ArgumentParser();ap.add_argument('--baseline',type=Path,required=True);ap.add_argument('--browser',default='/usr/bin/chromium');a=ap.parse_args()
O=R/'qa/browser';O.mkdir(parents=True,exist_ok=True)
r={'version':'R11.0-IP-CANDIDATE','scope':'file:// Chromium software rendering; not public-host or physical-phone verification','checks':[],'materials':[],'pass':False,'visualAcceptance':'PENDING_USER'}
def save():(O/'report.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
def check(n,p,d=None):
 r['checks'].append({'name':n,'pass':bool(p),'detail':d});save();print(n,p,flush=True)
 if not p:raise AssertionError(n)
def shot(p,name):
 p.evaluate('LEATHER_ATELIER.render()');p.wait_for_timeout(120);path=O/(name+'.png');p.locator('#stage').screenshot(path=str(path));return np.asarray(Image.open(path).convert('RGB'),dtype=float)
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=a.browser,headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'])
 r['browser']=b.version;pages=[];errors=[];requests=[]
 try:
  for label,file in [('before',a.baseline),('after',R/'candidate.html')]:
   p=b.new_page(viewport={'width':1440,'height':1000});p.set_default_timeout(120000)
   p.on('pageerror',lambda e,L=label:errors.append({'page':L,'error':str(e)}))
   p.on('request',lambda q,L=label:requests.append({'page':L,'url':q.url}) if q.url.startswith(('https:','http:')) else None)
   p.goto(file.as_uri(),wait_until='domcontentloaded');p.wait_for_function('window.LEATHER_ATELIER?.ready || (document.querySelector("#error") && !document.querySelector("#error").hidden)',timeout=180000)
   check(label+' renderer boot',p.evaluate('!!window.LEATHER_ATELIER?.ready'),p.locator('#error').inner_text());pages.append(p)
  before,after=pages
  check('candidate identity',after.evaluate('LEATHER_ATELIER.version')=='R11.0-IP-CANDIDATE')
  check('six products and thirteen materials retained',after.evaluate('JSON.stringify(LEATHER_ATELIER.snapshot().thumbs)')=='{"materials":13,"products":6}')
  check('accessible complete notices',after.locator('details.r11-rights').count()==1)
  ids=after.locator('[data-material]').evaluate_all('(els)=>els.map(e=>e.dataset.material)')
  for i in ids:
   before.evaluate('(id)=>LEATHER_ATELIER.selectMaterial(id)',i);after.evaluate('(id)=>LEATHER_ATELIER.selectMaterial(id)',i)
   A=shot(before,'before-'+i);B=shot(after,'after-'+i);d=np.abs(A-B)
   row={'id':i,'meanAbsolutePixelDifference':float(d.mean()),'changedPixelFraction':float(np.mean(np.any(d>0,axis=2))),'sameStageDimensions':A.shape==B.shape};r['materials'].append(row);save();print('material',row,flush=True)
  scan=next(x for x in r['materials'] if x['id']=='heritage')
  check('heritage scan stage pixels unchanged',scan['meanAbsolutePixelDifference']==0,scan)
  check('procedural pattern genuinely rewritten',any(x['meanAbsolutePixelDifference']>.01 for x in r['materials']))
  check('no application errors',not errors,errors);check('no network required',not requests,requests)
  after.evaluate("LEATHER_ATELIER.selectMaterial('heritage');LEATHER_ATELIER.selectProduct('wallet');LEATHER_ATELIER.configure({craft:'plain'});")
  after.wait_for_function('LEATHER_ATELIER.productPhysics?.version?.startsWith("R09")')
  thickness=after.evaluate('LEATHER_ATELIER.measureShell()');check('positive world-space thickness',all(x['minMM']>.1 for x in thickness),thickness)
  box=after.locator('#stage').bounding_box();x=box['x']+box['width']*.5;y=box['y']+box['height']*.5
  after.locator('#grabTool').click();after.mouse.move(x,y);after.mouse.down();after.wait_for_function('LEATHER_ATELIER.productPhysics.held')
  old=after.evaluate('LEATHER_ATELIER.productPhysics');after.mouse.move(x+20,y-45,steps=8)
  after.wait_for_function('(t)=>LEATHER_ATELIER.productPhysics.timeS>t+.04',arg=old['timeS'],timeout=90000)
  held=after.evaluate('LEATHER_ATELIER.productPhysics');after.mouse.up()
  check('actual grab solver advances with finite positions',held['finite'] and not held['failed'] and held['timeS']>old['timeS'],{'beforeS':old['timeS'],'afterS':held['timeS'],'forceN':held['grabForceN']})
  after.evaluate('LEATHER_ATELIER.resetGrab()');after.set_viewport_size({'width':390,'height':844});after.wait_for_timeout(150)
  check('mobile viewport width',after.locator('#stage').bounding_box()['width']>200 and after.evaluate('document.documentElement.scrollWidth<=innerWidth+2'))
  check('no final application errors',not errors,errors);r['pass']=True
 except Exception as e:r['exception']=str(e);r['traceback']=traceback.format_exc();raise
 finally:save();b.close()
