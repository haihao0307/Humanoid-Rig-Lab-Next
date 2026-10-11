# independent wall export: raw dumps stay in Actions evidence, not production assets
from pathlib import Path
import json,argparse,time,hashlib,io
import numpy as np
from PIL import Image,ImageDraw
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parent

def run(url=None):
 out=R/'qa'/('public' if url else 'local');out.mkdir(parents=True,exist_ok=True);report={'url':url or (R/'standalone.html').as_uri(),'checks':[],'errors':[],'consoleErrors':[],'failedHTTP':[],'physicalPhone':False,'userVisualAccepted':False};images=[]
 def check(name,ok,detail=None):
  report['checks'].append({'name':name,'passed':bool(ok),'detail':detail});print(name,ok,flush=True)
  if not ok:raise AssertionError(name)
 with sync_playwright() as p:
  b=p.chromium.launch(headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']);page=b.new_page(viewport={'width':1440,'height':1000});page.set_default_timeout(120000)
  page.on('pageerror',lambda e:report['errors'].append(str(e)));page.on('console',lambda m:report['consoleErrors'].append(m.text) if m.type=='error' else None);page.on('response',lambda q:report['failedHTTP'].append({'url':q.url,'status':q.status}) if q.status>=400 else None);requests=[];page.on('request',lambda q:requests.append(q.url))
  try:
   start=time.monotonic();page.goto(report['url'],wait_until='load',timeout=180000);page.wait_for_function('window.hatLab&&hatLab.ready()',timeout=180000);report['readySeconds']=time.monotonic()-start
   check('R04 runtime',page.evaluate('hatLab.version')=='HAT-R04.0');manifest=json.loads((R/'BUILD_MANIFEST.json').read_text());check('source identity',page.evaluate('hatLab.sourceCommit')==manifest['sourceSha'])
   if not url:check('standalone no network',not [u for u in requests if u.startswith(('https:','http:'))])
   items=page.evaluate('hatLab.catalogue()');check('11 retained categories',len(items)==11);defaults={}
   for it in items:
    id=it['id'];page.evaluate('(id)=>hatLab.select(id)',id);page.evaluate("hatLab.set({view:'wear',head:0})");page.evaluate('hatLab.frame()');page.wait_for_timeout(130)
    check('actual geometry '+id,page.evaluate('hatLab.metrics().vertices')>200);m=page.evaluate('hatLab.metrics()');defaults[id]=page.evaluate('hatLab.recipe().settings');check('bounded whole hat '+id,40<m['widthMM']<400 and 40<m['heightMM']<500,m)
    image=Image.open(io.BytesIO(page.locator('#canvas').screenshot())).convert('RGB');image.save(out/(id+'-three.jpg'),quality=91);images.append((id,image))
    page.evaluate("hatLab.frame('side')");page.wait_for_timeout(100);page.locator('#canvas').screenshot(path=str(out/(id+'-side.png')))
    g=page.evaluate('hatLab.debugGeometry()');pos=np.array(g['position']).reshape(-1,3);check('finite points '+id,np.isfinite(pos).all())
    if id not in ['cable','sherpa']:
     # Default rigid/woven fit must be a common affine map, not point clamps per component.
     base=np.array(page.evaluate('hatLab.baselinePositions()')).reshape(-1,3);X=np.c_[base,np.ones(len(base))];M=np.linalg.lstsq(X,pos,rcond=None)[0];res=np.linalg.norm(X@M-pos,axis=1);check('shared assembly map '+id,res.max()<1e-6,{'maxResidualM':float(res.max()),'minSingularValue':float(np.linalg.svd(M[:3],compute_uv=False).min())})
    else:
     inner=np.array(g['inner']).reshape(-1,3)[len(pos):];delta=np.linalg.norm(pos-inner,axis=1)*1000;check('real nonzero wall '+id,np.max(abs(delta-defaults[id]['materialMM']))<.001,{'minMM':float(delta.min()),'medianMM':float(np.median(delta)),'maxMM':float(delta.max())});check('material edge faces '+id,m['shell']['rimEdges']>0)
     if id=='cable':(out/'cable-inspect.json').write_text(json.dumps(g))
    if id in ['cable','trilby','sherpa']:
     page.evaluate("hatLab.set({cutaway:true});hatLab.frame('side')");page.wait_for_timeout(100);page.locator('#canvas').screenshot(path=str(out/(id+'-cutaway.png')));page.evaluate("hatLab.set({cutaway:false,view:'product'});hatLab.frame('inside')");page.wait_for_timeout(100);page.locator('#canvas').screenshot(path=str(out/(id+'-inside.png')));page.evaluate("hatLab.set({view:'wear'})")
    for head in [1,2]:
     page.evaluate('(head)=>hatLab.set({head})',head);page.evaluate('hatLab.frame()');page.wait_for_timeout(100);check('head switch '+id+' '+str(head),page.evaluate('hatLab.recipe().settings.head')==head)
     if id in ['cable','trilby','sherpa']:page.locator('#canvas').screenshot(path=str(out/(id+'-head-'+str(head)+'.png')))
     if id=='cable':(out/('cable-head-'+str(head)+'-geometry.json')).write_text(json.dumps(page.evaluate('hatLab.debugGeometry()')))
   check('category-specific placement',len(set(v['wearBandMM'] for v in defaults.values()))>=5,defaults)
   page.evaluate("hatLab.select('cable')");page.evaluate("hatLab.set({head:0,view:'wear',cutaway:false,materialMM:3.6})");page.evaluate('hatLab.frame()');page.wait_for_timeout(100);original=page.evaluate('hatLab.recipe()');before=page.locator('#canvas').screenshot();page.screenshot(path=str(out/'desktop.png'))
   page.evaluate('hatLab.set({materialMM:5})');page.wait_for_timeout(100);check('thickness changes real geometry and pixels',page.evaluate('hatLab.metrics().shell.materialThicknessMM')==5 and page.locator('#canvas').screenshot()!=before);page.evaluate('(r)=>hatLab.restore(r)',original)
   page.locator('#compare').hover();page.mouse.down();page.wait_for_timeout(100);check('R02 comparison is real',page.locator('#canvas').screenshot()!=before);page.locator('#canvas').screenshot(path=str(out/'cable-r02-same-camera.png'));page.mouse.up();page.wait_for_timeout(100);check('release restores candidate',page.locator('#canvas').screenshot()==before)
   page.evaluate("hatLab.setPreset('relaxed')");page.wait_for_timeout(100);page.locator('#canvas').screenshot(path=str(out/'cable-relaxed.png'));check('preset preserves source material',page.evaluate('hatLab.recipe().settings.textureMode')=='source');page.evaluate('(r)=>hatLab.restore(r)',original)
   page.evaluate("hatLab.set({showClearance:true})");page.wait_for_timeout(100);page.locator('#canvas').screenshot(path=str(out/'support-regions.png'));check('support-region display changes pixels',page.locator('#canvas').screenshot()!=before);page.evaluate('(r)=>hatLab.restore(r)',original)
   h=page.evaluate('hatLab.headPositions()');page.evaluate('hatLab.set({materialMM:4,wearBandMM:15})');check('head untouched by fit and thickness',h==page.evaluate('hatLab.headPositions()'));page.evaluate('(r)=>hatLab.restore(r)',original)
   invalid=json.loads(json.dumps(original));invalid['settings']['materialMM']=-1;check('negative thickness rejected',page.evaluate('(r)=>{try{hatLab.validate(r);return false}catch(e){return true}}',invalid))
   with page.expect_download() as dl:page.locator('#export').click()
   dl.value.save_as(str(out/'recipe.json'));page.locator('#file').set_input_files(str(out/'recipe.json'));page.wait_for_function('hatLab.ready()');check('recipe thickness roundtrip',page.evaluate('hatLab.recipe().settings.materialMM')==3.6)
   page.evaluate("async()=>{await Promise.all([hatLab.select('cable'),hatLab.select('trilby')])}");check('last selection wins',page.evaluate('hatLab.metrics().hat')=='trilby');page.evaluate('hatLab.frame()');page.wait_for_timeout(100);page.locator('#canvas').screenshot(path=str(out/'trilby-final.png'))
   for camera in ['front','side','back','inside']:
    page.evaluate('(v)=>hatLab.frame(v)',camera);page.wait_for_timeout(100);page.locator('#canvas').screenshot(path=str(out/('trilby-'+camera+'-final.png')))
   page.set_viewport_size({'width':390,'height':844});page.evaluate("hatLab.select('cable')");page.evaluate('hatLab.frame()');page.locator('#viewport').scroll_into_view_if_needed();page.wait_for_timeout(100);page.screenshot(path=str(out/'mobile.png'));check('mobile viewport no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
   collage=Image.new('RGB',(1200,1000),(236,233,226));draw=ImageDraw.Draw(collage)
   for i,(id,im) in enumerate(images):
    im.thumbnail((396,225));x=i%3*400;y=i//3*250;collage.paste(im,(x+(400-im.width)//2,y));draw.text((x+12,y+230),id,fill=(30,30,30))
   collage.save(out/'all-categories.jpg',quality=92)
   check('no page errors',not report['errors'],report['errors']);check('no renderer errors',not report['consoleErrors'],report['consoleErrors']);check('no failed HTTP',not report['failedHTTP'],report['failedHTTP']);report['passed']=True
  except Exception as e:
   report['passed']=False;report['failure']=str(e)
   try:page.screenshot(path=str(out/'failure.png'))
   except Exception:pass
   raise
  finally:
   (out/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));b.close()
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--url');a=p.parse_args();run(a.url)
