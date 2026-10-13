"""All-eleven reference identity and actual layer isolation, not film-quality certification."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
import threading,argparse,json,time,base64,io
from PIL import Image,ImageStat,ImageChops
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parent
P=argparse.ArgumentParser();P.add_argument('--source',required=True);P.add_argument('--url');A=P.parse_args()
Q=R/'qa'/('public' if A.url else 'local');Q.mkdir(parents=True,exist_ok=True)
report={'version':'HAT-STUDY-S0','source':A.source,'url':A.url,'checks':[],'hats':[],'errors':[],'passed':False,'reconstructionComplete':False,'filmReady':False,'environment':'GitHub Actions Ubuntu Chromium SwiftShader; not user device'}
def save():(Q/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
def check(name,ok,detail=None):
    report['checks'].append({'name':name,'passed':bool(ok),'detail':detail});save()
    if not ok:raise AssertionError(name+': '+str(detail))
def capture(p,name):
    raw=base64.b64decode(p.evaluate('hatLab.render()').split(',')[1]);(Q/(name+'.png')).write_bytes(raw);im=Image.open(io.BytesIO(raw)).convert('RGB')
    check('actual pixels '+name,min(im.size)>200 and sum(ImageStat.Stat(im).var)>40);return im
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(R.parent)));threading.Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}'
study=A.url or base+'/source-study-s0/index.html#hat=cable'
reference=('https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/53dfc29039450fb5892aaa0348c0eda63f2dba78/hat-workshop/r09/index.html#hat=cable') if A.url else base+'/r09/index.html#hat=cable'
def wait_detail(p):p.wait_for_function("['ready','not-required'].includes(hatLab.performance().detailState)",timeout=90000)
try:
    with sync_playwright() as pw:
        b=pw.chromium.launch(headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'])
        ctx=b.new_context(viewport={'width':1440,'height':1000},device_scale_factor=1)
        p=ctx.new_page();old=ctx.new_page()
        for target in [p,old]:
            target.on('pageerror',lambda e:report['errors'].append(str(e)))
        p.goto(study,wait_until='domcontentloaded',timeout=150000);p.wait_for_function('window.hatStudy&&hatStudy.ready()',timeout=120000)
        old.goto(reference,wait_until='domcontentloaded',timeout=150000);old.wait_for_function('window.hatLab&&hatLab.ready()',timeout=120000)
        check('source identity',p.evaluate('hatStudy.audit().sourceSha')==A.source)
        check('all eleven cards',p.locator('.hat-card').count()==11)
        rows=p.evaluate('hatStudy.audit().hats')
        for row in rows:
            id=row['id'];start=time.perf_counter();p.locator('.hat-card[data-id="'+id+'"]').click()
            p.wait_for_function('(id)=>hatStudy.ready()&&hatStudy.snapshot().hat===id',arg=id,timeout=30000)
            clickMS=(time.perf_counter()-start)*1000
            old.evaluate('(id)=>hatLab.select(id)',id);old.wait_for_function('hatLab.ready()',timeout=30000)
            old.evaluate("hatLab.set({repair:false,view:'product',layer:'material',textureMode:'source',useCustomColor:false,dye:'original',roughness:.86,detail:1,sheen:.65})")
            wait_detail(p);wait_detail(old)
            p.evaluate("hatStudy.layer('complete');hatLab.frame('three')");old.evaluate("hatLab.frame('three')")
            p.wait_for_timeout(250);old.wait_for_timeout(250)
            check('reference geometry identical '+id,p.evaluate('hatLab.geometryHash()')==old.evaluate('hatLab.geometryHash()'))
            check('same reference camera '+id,p.evaluate('hatLab.cameraPose()')==old.evaluate('hatLab.cameraPose()'))
            ref=capture(old,id+'-reference');full=capture(p,id+'-complete')
            check('canvas dimensions '+id,full.size==ref.size)
            difference=sum(ImageStat.Stat(ImageChops.difference(ref,full)).mean)/3
            check('reference appearance retained '+id,difference<.20,{'meanAbsByteError':difference})
            before=p.evaluate('hatLab.geometryHash()');camera=p.evaluate('hatLab.cameraPose()')
            images={}
            for layer in ['shape','color','noNormal','controls']+(['relief'] if row['normal'] else []):
                p.locator('#study-layer').select_option(layer);p.wait_for_timeout(100);images[layer]=capture(p,id+'-'+layer)
                check('layer does not move vertices or camera '+id+'/'+layer,p.evaluate('hatLab.geometryHash()')==before and p.evaluate('hatLab.cameraPose()')==camera)
            if row['normal']:
                d=sum(ImageStat.Stat(ImageChops.difference(full,images['noNormal'])).mean)/3
                check('actual normal-map contribution '+id,d>.01,d)
            else:check('absent normal explicitly disabled '+id,p.locator('#study-layer option[value="relief"]').is_disabled())
            p.locator('#study-layer').select_option('complete');restored=capture(p,id+'-restored')
            d=sum(ImageStat.Stat(ImageChops.difference(full,restored)).mean)/3
            check('complete layer restores reference '+id,d<.20,d)
            report['hats'].append({'id':id,'clickToReadyMS':clickMS,'normalMapPresent':bool(row['normal']),'comparisonMeanByteError':difference});save()
        p.locator('#study-space').select_option('fitted');p.wait_for_timeout(200)
        check('existing fit stays separately labeled',p.evaluate('hatStudy.snapshot().space')=='fitted')
        p.locator('#study-space').select_option('source');p.wait_for_timeout(200)
        p.locator('.hat-card[data-id="cable"]').click();p.wait_for_function('hatStudy.ready()&&hatStudy.snapshot().hat==="cable"',timeout=30000);wait_detail(p)
        p.screenshot(path=str(Q/'desktop.png'),timeout=30000)
        p.set_viewport_size({'width':390,'height':844});p.wait_for_timeout(250)
        check('small viewport still works',p.evaluate('hatStudy.ready()'));p.screenshot(path=str(Q/'mobile-viewport.png'),timeout=30000)
        report['mobileScope']='390x844 viewport only, not a physical phone'
        check('no page or study exceptions',not report['errors'] and not p.evaluate('hatStudy.snapshot().errors'))
        report['passed']=True;save();ctx.close();b.close();print(json.dumps({'passed':True,'checks':len(report['checks']),'hats':len(report['hats'])}),flush=True)
except Exception as e:report['failure']=str(e);save();raise
finally:server.shutdown()
