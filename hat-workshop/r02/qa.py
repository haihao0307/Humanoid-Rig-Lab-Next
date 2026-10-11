"""Real Chromium evidence, not aesthetic or physical certification."""
from pathlib import Path
import argparse,json,io,time,hashlib,base64,gzip
from playwright.sync_api import sync_playwright
from PIL import Image,ImageStat,ImageDraw
import numpy as np
ROOT=Path(__file__).resolve().parent

def run(url,public=False,thumbs=False):
 folder=ROOT/'qa'/('public' if public else ('thumbnails' if thumbs else 'local'));folder.mkdir(parents=True,exist_ok=True)
 result={'url':url,'public':public,'checks':[],'errors':[],'consoleErrors':[],'failedHTTP':[],'platforms':['Chromium desktop 1440x1000','Chromium viewport 390x844, not physical phone'],'visualAccepted':False,'physicalValidated':False,'nativeDynamicIntegration':False}
 def check(name,value,details=None):
  result['checks'].append({'name':name,'passed':bool(value),'details':details});print('CHECK',name,bool(value),flush=True)
  if not value:raise AssertionError(name)
 with sync_playwright() as pw:
  b=pw.chromium.launch(headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  page=b.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1);page.set_default_timeout(180000)
  page.on('pageerror',lambda e:result['errors'].append(str(e)))
  page.on('console',lambda m:result['consoleErrors'].append(m.text) if m.type=='error' else None)
  page.on('response',lambda r:result['failedHTTP'].append({'url':r.url,'status':r.status}) if r.status>=400 else None)
  requests=[];page.on('request',lambda r:requests.append(r.url));start=time.monotonic()
  try:
   page.goto(url,wait_until='load',timeout=180000);page.wait_for_function('window.hatLab && hatLab.ready() && hatLab.firstFrameMS()!==null',timeout=240000)
   result['firstReadySeconds']=time.monotonic()-start;result['firstFramePerformanceMS']=page.evaluate('hatLab.firstFrameMS()');result['initialRequests']=[u for u in requests if u.startswith(('http:','https:'))]
   page.wait_for_function('hatLab.thumbnails()===11',timeout=240000)
   if thumbs:
    mapping=page.evaluate('hatLab.thumbnailMap()');check('11 actual rendered thumbnails',len(mapping)==11 and all(v.startswith('data:image/') for v in mapping.values()));(ROOT/'thumbnails.json').write_text(json.dumps(mapping));result['passed']=True;return
   manifest=json.loads((ROOT/'BUILD_MANIFEST.json').read_text());check('correct R02 build',page.evaluate('hatLab.version')=='HAT-R02.0');check('source identity',page.evaluate('hatLab.sourceCommit')==manifest['sourceSha']);check('11 actual thumbnails',page.locator('img[data-rendered="true"]').count()==11);check('one persistent WebGL canvas',page.locator('canvas').count()==1)
   if not public:check('standalone zero core network requests',not result['initialRequests'])
   else:
    initial=[u for u in result['initialRequests'] if '/r02/assets/' in u];check('public initially loads only selected hat',len(initial)==1 and initial[0].endswith('/cable.bin'),initial);check('lightweight public HTML under 1.5MB',manifest['publicBytes']<1500000,manifest['publicBytes'])
   images=[];states=[]
   for item in page.evaluate('hatLab.catalogue()'):
    page.locator(f'.hat-card[data-id="{item["id"]}"]').click();page.wait_for_function('(id)=>hatLab.ready()&&hatLab.metrics().hat===id',arg=item['id']);page.wait_for_timeout(150)
    m=page.evaluate('hatLab.metrics()');check('real geometry '+item['id'],m['vertices']>200 and m['triangles']>300 and 50<m['widthMM']<2000,m)
    im=Image.open(io.BytesIO(page.locator('#canvas').screenshot())).convert('RGB');check('nonempty render '+item['id'],sum(ImageStat.Stat(im).stddev)>10);im.save(folder/(item['id']+'.jpg'),quality=90);images.append((item['id'],im));states.append(m)
   page.evaluate("hatLab.select('cable')");page.evaluate('hatLab.set({repair:true,width:1,depth:1,height:1,dye:"original",light:"studio",view:"product",layer:"material"})');page.wait_for_timeout(150);saved=page.evaluate('hatLab.recipe()');before=page.locator('#canvas').screenshot();page.locator('#canvas').screenshot(path=str(folder/'cable-corrected.png'))
   page.evaluate('hatLab.set({repair:false})');page.wait_for_timeout(150);old_uv=page.locator('#canvas').screenshot();page.locator('#canvas').screenshot(path=str(folder/'cable-source-r01.png'));check('UV repair changes actual pixels',before!=old_uv);page.evaluate('(r)=>hatLab.restore(r)',saved)
   original_positions=page.evaluate('hatLab.currentPositions()');page.evaluate('hatLab.set({repair:false})');check('UV repair never changes position vertices',original_positions==page.evaluate('hatLab.currentPositions()'));page.evaluate('(r)=>hatLab.restore(r)',saved)
   page.locator('[data-dye="wine"]').click();page.wait_for_timeout(150);check('dye changes actual pixels',before!=page.locator('#canvas').screenshot());page.evaluate('(r)=>hatLab.restore(r)',saved);check('recipe restores complete settings',page.evaluate('hatLab.recipe()')==saved)
   for layer in ['clay','wire','normal']:
    page.locator(f'[data-layer="{layer}"]').click();page.wait_for_timeout(100);check('inspection layer '+layer,page.locator('#canvas').screenshot()!=before)
   page.locator('[data-layer="material"]').click();page.locator('[data-light="raking"]').click();page.wait_for_timeout(150);check('light changes actual pixels',page.locator('#canvas').screenshot()!=before);page.evaluate('(r)=>hatLab.restore(r)',saved)
   old=page.evaluate('hatLab.metrics().widthMM');page.evaluate('hatLab.set({width:1.1})');check('width changes world bounds',page.evaluate('hatLab.metrics().widthMM')>old*1.08)
   raw=page.evaluate('hatLab.recipe()');invalid=json.loads(json.dumps(raw));invalid['settings']['width']=1000;check('invalid recipe rejected without state mutation',page.evaluate('(r)=>{try{hatLab.validate(r);return false}catch(e){return true}}',invalid) and page.evaluate('hatLab.recipe()')==raw)
   check('unknown hat preserves prior object',page.evaluate('async()=>{const id=hatLab.metrics().hat;try{await hatLab.select("missing-hat");return false}catch(e){return hatLab.metrics().hat===id&&hatLab.ready()}}'))
   with page.expect_download() as download:page.locator('#export').click()
   download.value.save_as(str(folder/'exported-recipe.json'));check('actual JSON export',json.loads((folder/'exported-recipe.json').read_text())['schema']=='kaopu.hat.recipe/1')
   page.locator('#file').set_input_files(str(folder/'exported-recipe.json'));page.wait_for_function('hatLab.ready()');check('actual JSON reimport',page.evaluate('hatLab.recipe()')==raw)
   page.evaluate('(r)=>hatLab.restore(r)',saved)
   legacy=json.loads(json.dumps(saved));legacy['version']='HAT-R01.0';legacy['sourceCommit']='ed35e97be7de8b1842f679980b9bd48da911d2e3';legacy['settings'].pop('repair',None);page.evaluate('(r)=>hatLab.restore(r)',legacy);check('explicit frozen R01 recipe migration',page.evaluate('hatLab.recipe().settings.repair') is True)
   for view in ['front','side','back','inside','detail']:
    page.locator(f'[data-camera="{view}"]').click();page.wait_for_timeout(100);page.locator('#canvas').screenshot(path=str(folder/(view+'-inspection.png')));check('camera '+view,page.locator('#canvas').screenshot()!=before)
   page.evaluate('hatLab.frame()');page.locator('[data-dye="wine"]').click();page.wait_for_timeout(150);dyed=page.locator('#canvas').screenshot();page.locator('#compare').hover();page.mouse.down();page.wait_for_timeout(150);held=page.locator('#canvas').screenshot();page.mouse.up();page.wait_for_timeout(150);check('hold comparison changes pixels',dyed!=held);check('comparison release restores exact candidate pixels',page.locator('#canvas').screenshot()==dyed)
   page.evaluate('async()=>{await Promise.all([hatLab.select("fishing"),hatLab.select("patrol"),hatLab.select("visor")]);}');check('rapid selection last request wins',page.evaluate('hatLab.ready()&&hatLab.metrics().hat==="visor"'))
   worn=[];heads=json.loads((ROOT/'ASSET_MANIFEST.json').read_text())['native']['heads']
   for item in page.evaluate('hatLab.catalogue()'):
    page.evaluate('(id)=>hatLab.select(id)',item['id'])
    for i in range(3):
     page.evaluate('(i)=>hatLab.set({view:"wear",head:i,repair:true,width:1,depth:1,height:1,lift:0,tilt:0})',i);page.evaluate('hatLab.frame()');page.wait_for_timeout(100);m=page.evaluate('hatLab.metrics()');check('static wearer '+item['id']+' / '+str(i),m['headVisible'] and m['headId']==heads[i]['id'])
     if i==0:
      im=Image.open(io.BytesIO(page.locator('#canvas').screenshot())).convert('RGB');im.save(folder/(item['id']+'-wear.jpg'),quality=90);worn.append((item['id'],im))
     if item['id']=='visor':
      page.locator('#canvas').screenshot(path=str(folder/('visor-head-'+str(i)+'-corrected.png')));page.evaluate('hatLab.set({repair:false})');page.wait_for_timeout(100);page.locator('#canvas').screenshot(path=str(folder/('visor-head-'+str(i)+'-r01.png')));page.evaluate('hatLab.set({repair:true})')
   for i,head in enumerate(heads):
    page.evaluate('(i)=>hatLab.set({head:i,view:"wear"})',i);actual=np.array(page.evaluate('hatLab.headPositions()'),dtype='<f4');source=json.loads(gzip.decompress((ROOT/'assets'/head['packageFile']).read_bytes()));expected=np.frombuffer(gzip.decompress(base64.b64decode(source['p'])),dtype='<f4');check('native head bytes unchanged '+str(i),np.array_equal(actual,expected))
   h=page.evaluate('hatLab.headPositions()');page.evaluate('hatLab.set({width:1.1,depth:1.1,height:.95})');check('fitting never shrinks native head',page.evaluate('hatLab.headPositions()')==h)
   page.evaluate('(r)=>hatLab.restore(r)',saved);page.evaluate('hatLab.frame()');page.wait_for_timeout(150);page.screenshot(path=str(folder/'desktop.png'))
   page.get_by_text('记录本款修改意见',exact=True).click();page.locator('#feedback-text').fill('QA fixture: neckline observation, not a user acceptance');page.locator('#feedback-save').click();check('feedback saves real state without user approval',page.evaluate('JSON.parse(localStorage.getItem("kaopu.hat.feedback.draft")).userAccepted===false'));f=page.evaluate('hatLab.feedback()');check('feedback binds source recipe and camera',f['sourceCommit']==manifest['sourceSha'] and len(f['camera']['position'])==3 and f['recipe']['settings']['id']=='cable')
   with page.expect_download() as download:page.locator('#feedback-export').click()
   download.value.save_as(str(folder/'feedback-fixture.json'));check('feedback download contains schema',json.loads((folder/'feedback-fixture.json').read_text())['schema']=='kaopu.workbench.feedback/1')
   for name,series in [('collection',images),('wearers',worn)]:
    out=Image.new('RGB',(1200,1000),(237,234,226));draw=ImageDraw.Draw(out)
    for i,(title,im) in enumerate(series):
     im.thumbnail((392,222));x=(i%3)*400+(400-im.width)//2;y=(i//3)*250;out.paste(im,(x,y));draw.text(((i%3)*400+12,y+224),str(i+1)+' / '+title,fill=(30,40,30))
    out.save(folder/(name+'.jpg'),quality=90)
   page.set_viewport_size({'width':390,'height':844});page.evaluate('hatLab.frame()');page.locator('#viewport').scroll_into_view_if_needed();page.wait_for_timeout(150);check('mobile no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'));rect=page.locator('#canvas').bounding_box();check('mobile real visible canvas',rect['height']>350 and rect['width']>350,rect);page.screenshot(path=str(folder/'mobile.png'))
   page.locator('.hat-card[data-id="fishing"]').click();page.wait_for_function('hatLab.ready()&&hatLab.metrics().hat==="fishing"');page.locator('#viewport').scroll_into_view_if_needed();page.wait_for_timeout(150);page.screenshot(path=str(folder/'mobile-selected.png'));check('mobile selection updates actual model',page.evaluate('hatLab.metrics().hat')=='fishing')
   check('no page exceptions',not result['errors'],result['errors']);check('no renderer console errors',not result['consoleErrors'],result['consoleErrors']);check('no failed HTTP',not result['failedHTTP'],result['failedHTTP']);check('no silently failed thumbnails',not page.evaluate('hatLab.issues()'));result['states']=states;result['passed']=True;result['sourceSha']=manifest['sourceSha'];result['htmlSHA256']=manifest['htmlSHA256'];result['requests']=[u for u in requests if u.startswith(('http:','https:'))]
  except Exception as e:
   result['passed']=False;result['failure']=str(e)
   try:page.screenshot(path=str(folder/'failure.png'))
   except Exception:pass
   raise
  finally:
   (folder/'report.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print('QA_RESULT',json.dumps(result,ensure_ascii=False),flush=True);b.close()
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--url');p.add_argument('--thumbnails',action='store_true');a=p.parse_args();run(a.url or (ROOT/'standalone.html').as_uri(),bool(a.url),a.thumbnails)
