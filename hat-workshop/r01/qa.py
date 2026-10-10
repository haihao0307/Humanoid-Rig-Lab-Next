"""Actual Chromium file/public regression. Limited tests, never cinematic certification."""
from pathlib import Path
import argparse,json,hashlib,io,time
from playwright.sync_api import sync_playwright
from PIL import Image,ImageStat,ImageDraw
ROOT=Path(__file__).resolve().parent

def run(url,public=False):
 folder=ROOT/'qa'/('public' if public else 'local');folder.mkdir(parents=True,exist_ok=True)
 result={'url':url,'public':public,'checks':[],'errors':[],'failedHTTP':[],'platforms':['Chromium desktop 1440x1000','Chromium viewport 390x844; not physical phone'],'visualAccepted':False,'physicalValidated':False,'nativeDynamicIntegration':False}
 def check(name,value,details=None):
  result['checks'].append({'name':name,'passed':bool(value),'details':details});print('CHECK',name,bool(value),flush=True)
  if not value:raise AssertionError(name)
 with sync_playwright() as pw:
  b=pw.chromium.launch(headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  page=b.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1);page.set_default_timeout(180000)
  page.on('pageerror',lambda e:result['errors'].append(str(e)))
  page.on('response',lambda r:result['failedHTTP'].append({'url':r.url,'status':r.status}) if r.status>=400 else None)
  requests=[];page.on('request',lambda r:requests.append(r.url));start=time.monotonic()
  try:
   page.goto(url,wait_until='load',timeout=180000);page.wait_for_function('!!window.hatLab && hatLab.ready() && hatLab.thumbnails()===12',timeout=240000)
   result['startupSecondsIncludingThumbnails']=time.monotonic()-start
   check('correct build',page.evaluate('hatLab.version')=='HAT-R01.0')
   check('12 real thumbnails',page.locator('img[data-rendered="true"]').count()==12)
   check('one persistent canvas',page.locator('canvas').count()==1)
   manifest=json.loads((ROOT/'BUILD_MANIFEST.json').read_text());check('source version identity',page.evaluate('hatLab.sourceCommit')==manifest['sourceSha'])
   if not public:check('standalone no network',not [u for u in requests if u.startswith(('http:','https:'))])
   states=[];images=[]
   for item in page.evaluate('hatLab.catalogue()'):
    page.locator(f'.hat-card[data-id="{item["id"]}"]').click();page.wait_for_function('(id)=>hatLab.ready()&&hatLab.metrics().hat===id',arg=item['id']);page.wait_for_timeout(200)
    m=page.evaluate('hatLab.metrics()');check('geometry '+item['id'],m['vertices']>200 and m['triangles']>300 and 50<m['widthMM']<2000,m)
    png=page.locator('#canvas').screenshot();im=Image.open(io.BytesIO(png)).convert('RGB');check('render not blank '+item['id'],sum(ImageStat.Stat(im).stddev)>10)
    im.save(folder/(item['id']+'.jpg'),quality=90);images.append((item['title'],im));states.append(m)
   page.evaluate("hatLab.select('cable')");page.wait_for_timeout(150)
   saved=page.evaluate('hatLab.recipe()');before=page.locator('#canvas').screenshot()
   page.locator('[data-dye="wine"]').click();page.wait_for_timeout(150);after=page.locator('#canvas').screenshot();check('dye changes actual pixels',before!=after)
   page.evaluate('(r)=>hatLab.restore(r)',saved);page.wait_for_timeout(150);check('recipe restores state',page.evaluate('hatLab.recipe()')==saved)
   page.locator('[data-layer="clay"]').click();page.wait_for_timeout(150);check('layer changes pixels',page.locator('#canvas').screenshot()!=before)
   page.locator('[data-layer="material"]').click();page.locator('[data-light="raking"]').click();page.wait_for_timeout(150);check('lighting changes pixels',page.locator('#canvas').screenshot()!=before)
   page.locator('[data-light="studio"]').click();page.evaluate('(r)=>hatLab.restore(r)',saved)
   old=page.evaluate('hatLab.metrics().widthMM');page.evaluate('hatLab.set({width:1.1})');check('width controls geometry',page.evaluate('hatLab.metrics().widthMM')>old*1.08)
   raw=page.evaluate('hatLab.recipe()');invalid=json.loads(json.dumps(raw));invalid['settings']['width']=1000
   rejected=page.evaluate('(r)=>{try{hatLab.validate(r);return false}catch(e){return true}}',invalid);check('invalid recipe rejected atomically',rejected and page.evaluate('hatLab.recipe()')==raw)
   with page.expect_download() as download:page.locator('#export').click()
   exported=download.value;exported.save_as(str(folder/'exported-recipe.json'));check('actual JSON download',json.loads((folder/'exported-recipe.json').read_text())['schema']=='kaopu.hat.recipe/1')
   page.locator('#file').set_input_files(str(folder/'exported-recipe.json'));page.wait_for_function('hatLab.ready()');check('actual JSON reimport',page.evaluate('hatLab.recipe()')==raw)
   page.evaluate('(r)=>hatLab.restore(r)',saved)
   worn=[]
   for item in page.evaluate('hatLab.catalogue()'):
    page.evaluate('(id)=>hatLab.select(id)',item['id']);page.locator('#wear').click();page.evaluate('hatLab.frame()');page.wait_for_timeout(150)
    check('native wearer visible '+item['id'],page.evaluate('hatLab.metrics().headVisible'))
    img=Image.open(io.BytesIO(page.locator('#canvas').screenshot())).convert('RGB');img.save(folder/(item['id']+'-wear.jpg'),quality=88);worn.append((item['title'],img))
   page.evaluate("hatLab.select('cable')");page.locator('#wear').click();head_before=page.evaluate('hatLab.headPositions()');page.evaluate('hatLab.set({width:1.1,depth:1.05,height:.95})');check('fit does not shrink native head',head_before==page.evaluate('hatLab.headPositions()'))
   for i in range(3):
    page.select_option('#head-select',str(i));page.wait_for_timeout(250);check('native head selection '+str(i),page.evaluate('hatLab.metrics().headId')==page.evaluate('hatLab.headHashes()')[i]['id'])
   page.evaluate('(r)=>hatLab.restore(r)',saved);page.evaluate('hatLab.frame()');page.wait_for_timeout(200);page.screenshot(path=str(folder/'desktop.png'))
   for name,series in [('collection',images),('wearers',worn)]:
    out=Image.new('RGB',(1200,4*250),(237,234,226));draw=ImageDraw.Draw(out)
    for i,(title,im) in enumerate(series):
     im.thumbnail((392,222));x=(i%3)*400+(400-im.width)//2;y=(i//3)*250;out.paste(im,(x,y));draw.text(((i%3)*400+12,y+224),str(i+1)+' / '+states[i]['hat'],fill=(30,40,30))
    out.save(folder/(name+'.jpg'),quality=90)
   page.set_viewport_size({'width':390,'height':844});page.evaluate('hatLab.frame()');page.wait_for_timeout(250)
   check('mobile no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
   rect=page.locator('#canvas').bounding_box();check('mobile first screen actual canvas',rect['y']<150 and rect['height']>350,rect)
   page.screenshot(path=str(folder/'mobile.png'));page.locator('.hat-card[data-id="fishing"]').click();page.wait_for_function("hatLab.ready() && hatLab.metrics().hat==='fishing'");page.locator('#viewport').scroll_into_view_if_needed();page.wait_for_timeout(150);page.screenshot(path=str(folder/'mobile-selected.png'))
   check('mobile selection real output',page.evaluate('hatLab.metrics().hat')=='fishing')
   check('no page exceptions',not result['errors'],result['errors']);check('no failing HTTP',not result['failedHTTP'],result['failedHTTP']);result['states']=states;result['passed']=True
   result['htmlSHA256']=manifest['htmlSHA256'];result['sourceSha']=manifest['sourceSha']
  except Exception as e:
   result['passed']=False;result['failure']=str(e);page.screenshot(path=str(folder/'failure.png'));raise
  finally:
   (folder/'report.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print('QA_RESULT',json.dumps(result,ensure_ascii=False),flush=True);b.close()
if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('--url');o=a.parse_args();run(o.url or (ROOT/'index.html').as_uri(),bool(o.url))
