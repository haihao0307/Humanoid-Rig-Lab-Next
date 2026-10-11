"""Actual Chromium regression. Images are internal evidence, never a substitute for the URL."""
from pathlib import Path
import argparse,json,time,io,hashlib
from PIL import Image,ImageStat,ImageDraw
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent

def run(url=None):
 public=bool(url);url=url or (ROOT/'standalone.html').as_uri();folder=ROOT/'qa'/('public' if public else 'local');folder.mkdir(parents=True,exist_ok=True)
 report={'url':url,'checks':[],'errors':[],'consoleErrors':[],'failedHTTP':[],'states':[],'device':'Chromium 1440x1000 and 390x844 viewport simulation; no physical-phone test','userAccepted':False,'physicsValidated':False}
 def check(name,value,detail=None):
  report['checks'].append({'name':name,'passed':bool(value),'detail':detail});print('CHECK',name,bool(value),flush=True)
  if not value:raise AssertionError(name)
 with sync_playwright() as pw:
  b=pw.chromium.launch(headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']);p=b.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1);p.set_default_timeout(180000)
  p.on('pageerror',lambda e:report['errors'].append(str(e)));p.on('console',lambda m:report['consoleErrors'].append(m.text) if m.type=='error' else None);p.on('response',lambda r:report['failedHTTP'].append({'url':r.url,'status':r.status}) if r.status>=400 else None)
  requests=[];p.on('request',lambda r:requests.append(r.url));start=time.monotonic()
  try:
   p.goto(url,wait_until='load',timeout=180000);p.wait_for_function('window.hatLab&&hatLab.ready()&&hatLab.thumbnails()===11',timeout=240000);p.wait_for_timeout(500)
   report['firstReadySeconds']=time.monotonic()-start;report['initialRequests']=[u for u in requests if u.startswith(('https:','http:'))]
   m=json.loads((ROOT/'BUILD_MANIFEST.json').read_text());check('correct R03 version',p.evaluate('hatLab.version')=='HAT-R03.0');check('correct source SHA',p.evaluate('hatLab.sourceCommit')==m['sourceSha']);check('default automatic fitting is visible',p.evaluate('hatLab.recipe().settings.autoFit&&hatLab.metrics().headVisible'));check('eleven indexed hat mothers',len(p.evaluate('hatLab.catalogue()'))==11)
   if not public:check('standalone core network requests zero',len(report['initialRequests'])==0,report['initialRequests'])
   collection=[]
   for item in p.evaluate('hatLab.catalogue()'):
    p.locator(f'.hat-card[data-id="{item["id"]}"]').click();p.wait_for_function('(id)=>hatLab.ready()&&hatLab.metrics().hat===id',arg=item['id']);p.evaluate('hatLab.setPreset("standard")');p.evaluate('hatLab.frame()');p.wait_for_timeout(200)
    state=p.evaluate('hatLab.metrics()');report['states'].append(state);check('regenerated geometry '+item['id'],state['controlPoints']>0 and state['generatedVertices']>200 and state['triangles']>300,state)
    image=Image.open(io.BytesIO(p.locator('#canvas').screenshot())).convert('RGB');check('nonempty real render '+item['id'],sum(ImageStat.Stat(image).stddev)>10);image.save(folder/(item['id']+'-standard.jpg'),quality=91);collection.append((item['id'],image));baseline=p.evaluate('hatLab.baselinePositions()')
    for head in range(3):
     p.evaluate('(head)=>hatLab.set({head,view:"wear",autoFit:true})',head);p.wait_for_timeout(80);s=p.evaluate('hatLab.metrics()');check('measured category fit '+item['id']+'/'+str(head),s['headVisible'] and 400<s['measuredHead']['headCircumferenceMM']<700 and s['fit']['sampledVertices']>0)
     if item['id'] in ['cable','visor','sherpa']:
      p.evaluate('hatLab.frame("side")');p.wait_for_timeout(100);p.locator('#canvas').screenshot(path=str(folder/(item['id']+'-head-'+str(head)+'-side.png')));p.evaluate('hatLab.frame()');p.wait_for_timeout(100);p.locator('#canvas').screenshot(path=str(folder/(item['id']+'-head-'+str(head)+'-three.png')))
    check('mother reference immutable during fitting '+item['id'],p.evaluate('hatLab.baselinePositions()')==baseline)
    p.evaluate('hatLab.set({head:0})');p.evaluate('hatLab.frame()');p.wait_for_timeout(150);standard=p.locator('#canvas').screenshot();standardPositions=p.evaluate('hatLab.currentPositions()');p.evaluate('hatLab.setPreset("relaxed")');p.wait_for_timeout(150);check('variant actual geometry '+item['id'],p.evaluate('hatLab.currentPositions()')!=standardPositions);check('variant actual pixels '+item['id'],p.locator('#canvas').screenshot()!=standard);p.locator('#canvas').screenshot(path=str(folder/(item['id']+'-variant.png')));p.evaluate('hatLab.setPreset("standard")')
   p.evaluate('hatLab.select("cable")');p.evaluate('hatLab.setPreset("standard")');p.evaluate('hatLab.set({head:0,view:"wear",layer:"material"})');p.evaluate('hatLab.frame()');p.wait_for_timeout(200);fitted=p.locator('#canvas').screenshot();p.locator('#canvas').screenshot(path=str(folder/'cable-r03-wrap.png'));native=p.evaluate('hatLab.headPositions()');recipe=p.evaluate('hatLab.recipe()')
   p.locator('#compare').hover();p.mouse.down();p.wait_for_timeout(200);check('hold R02 comparison really active',p.evaluate('hatLab.isComparing()'));p.locator('#canvas').screenshot(path=str(folder/'cable-r02-same-camera.png'));check('fitting differs from accepted R02',p.locator('#canvas').screenshot()!=fitted);p.mouse.up();p.wait_for_timeout(200);check('release restores exact fitted pixels',p.locator('#canvas').screenshot()==fitted)
   for view in ['front','side','back','inside','detail']:
    p.locator(f'[data-camera="{view}"]').click();p.wait_for_timeout(150);p.locator('#canvas').screenshot(path=str(folder/('cable-'+view+'.png')));check('camera '+view,p.locator('#canvas').screenshot()!=fitted)
   p.evaluate('hatLab.frame()');p.locator('#showMeasurements').check();p.wait_for_timeout(150);p.locator('#canvas').screenshot(path=str(folder/'measured-contours.png'));check('measurement overlay visible',p.locator('#canvas').screenshot()!=fitted);p.locator('#showMeasurements').uncheck();p.locator('#showClearance').check();p.wait_for_timeout(150);p.locator('#canvas').screenshot(path=str(folder/'radial-clearance.png'));check('clearance inspection actually changes rendering',p.locator('#canvas').screenshot()!=fitted);p.locator('#showClearance').uncheck()
   before=p.evaluate('hatLab.currentPositions()');p.evaluate('hatLab.set({wearBandMM:20})');check('wear plane changes reconstructed hat',before!=p.evaluate('hatLab.currentPositions()'));p.evaluate('(r)=>hatLab.restore(r)',recipe);p.evaluate('hatLab.set({hairMM:5})');check('explicit hair allowance changes hat not head',p.evaluate('hatLab.currentPositions()')!=before and p.evaluate('hatLab.headPositions()')==native);p.evaluate('(r)=>hatLab.restore(r)',recipe)
   oldRest=p.evaluate('hatLab.recipe().fitDiagnostics.restCircumferenceMM');p.evaluate('hatLab.set({negativeEase:.14})');check('negative ease reduces REST circumference',p.evaluate('hatLab.recipe().fitDiagnostics.restCircumferenceMM')<oldRest);check('negative ease never shrinks worn cap into skin',p.evaluate('hatLab.currentPositions()')==before);p.evaluate('(r)=>hatLab.restore(r)',recipe)
   p.locator('#textureMode').select_option('knit');p.locator('#customColor').evaluate('(el)=>{el.value="#355b78";el.dispatchEvent(new Event("input",{bubbles:true}));}');p.wait_for_timeout(200);check('procedural knit and custom dye affect pixels',p.locator('#canvas').screenshot()!=fitted);p.locator('#canvas').screenshot(path=str(folder/'procedural-knit.png'))
   for mode in ['wool','twill']:
    p.locator('#textureMode').select_option(mode);p.wait_for_timeout(200);p.locator('#canvas').screenshot(path=str(folder/('procedural-'+mode+'.png')));check('procedural surface '+mode,not report['consoleErrors'])
   p.evaluate('(r)=>hatLab.restore(r)',recipe);p.wait_for_timeout(150);check('source appearance restorable after procedural shaders',p.locator('#canvas').screenshot()==fitted)
   for layer in ['clay','normal','wire']:
    p.locator(f'[data-layer="{layer}"]').click();p.wait_for_timeout(100);check('inspection '+layer,p.locator('#canvas').screenshot()!=fitted)
   p.locator('[data-layer="material"]').click();p.locator('[data-light="raking"]').click();p.wait_for_timeout(150);check('raking light works',p.locator('#canvas').screenshot()!=fitted);p.evaluate('(r)=>hatLab.restore(r)',recipe)
   with p.expect_download() as d:p.locator('#export').click()
   d.value.save_as(str(folder/'recipe-export.json'));r=json.loads((folder/'recipe-export.json').read_text());check('export binds measurement and mother version',r['motherVersion']=='kaopu.hat.mother/3' and r['measurements']['headCircumferenceMM']>400)
   p.locator('#file').set_input_files(str(folder/'recipe-export.json'));p.wait_for_function('hatLab.ready()');check('recipe file import works',p.evaluate('hatLab.recipe().settings')==recipe['settings'])
   with p.expect_download() as d:p.locator('#mother-export').click()
   d.value.save_as(str(folder/'mother-export.json'));mother=json.loads((folder/'mother-export.json').read_text());check('mother export has controls and provenance, not fitted mesh','controls' in mother['mother'] and 'geometry' not in mother['mother'] and 'attribution' in mother)
   invalid=json.loads(json.dumps(recipe));invalid['settings']['crownMM']=10000;old=p.evaluate('hatLab.recipe().settings');check('invalid mother parameter rejected transactionally',p.evaluate('(r)=>{try{hatLab.validate(r);return false}catch(e){return true}}',invalid) and p.evaluate('hatLab.recipe().settings')==old)
   p.evaluate('async()=>{await Promise.all([hatLab.select("fishing"),hatLab.select("top"),hatLab.select("cable")]);}');check('rapid switching last selection wins',p.evaluate('hatLab.metrics().hat==="cable"&&hatLab.ready()'))
   check('head remains original size and coordinates',p.evaluate('hatLab.headPositions()')==native)
   p.evaluate('hatLab.setPreset("standard")');p.evaluate('hatLab.frame()');p.wait_for_timeout(150);p.screenshot(path=str(folder/'desktop.png'))
   out=Image.new('RGB',(1200,1000),(237,234,226));draw=ImageDraw.Draw(out)
   for i,(title,image)in enumerate(collection):
    image.thumbnail((392,222));x=(i%3)*400+(400-image.width)//2;y=(i//3)*250;out.paste(image,(x,y));draw.text(((i%3)*400+10,y+225),title,fill=(25,35,30))
   out.save(folder/'all-fitted-mothers.jpg',quality=92)
   p.set_viewport_size({'width':390,'height':844});p.evaluate('hatLab.frame()');p.locator('#viewport').scroll_into_view_if_needed();p.wait_for_timeout(150);check('mobile no horizontal overflow',p.evaluate('document.documentElement.scrollWidth<=innerWidth+1'));p.screenshot(path=str(folder/'mobile.png'));p.locator('.hat-card[data-id="fishing"]').click();p.wait_for_function('hatLab.ready()&&hatLab.metrics().hat==="fishing"');p.locator('#viewport').scroll_into_view_if_needed();p.wait_for_timeout(100);check('mobile actual selection works',p.evaluate('hatLab.metrics().hat')=='fishing');p.screenshot(path=str(folder/'mobile-fishing.png'))
   check('no page exceptions',not report['errors'],report['errors']);check('no shader or console errors',not report['consoleErrors'],report['consoleErrors']);check('no failed HTTP',not report['failedHTTP'],report['failedHTTP']);report['passed']=True;report['sourceSha']=m['sourceSha'];report['htmlSHA256']=m['htmlSHA256']
  except Exception as e:
   report['passed']=False;report['failure']=str(e)
   try:p.screenshot(path=str(folder/'failure.png'))
   except Exception:pass
   raise
  finally:
   (folder/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print('QA_RESULT',json.dumps({'passed':report.get('passed'),'checks':len(report['checks']),'failure':report.get('failure')}),flush=True);b.close()
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--url');a=parser.parse_args();run(a.url)
