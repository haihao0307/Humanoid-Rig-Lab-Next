from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image,ImageChops,ImageStat
import sys,json,time,io,hashlib,traceback,os
P=Path(__file__).resolve().parent;Q=P/'qa';Q.mkdir(exist_ok=True)
public=len(sys.argv)>1;url=sys.argv[1] if public else 'http://127.0.0.1:8872/preview.html'
name='PUBLIC_REPORT' if public else 'BROWSER_REPORT';prefix='public-' if public else ''
report={'url':url,'public':public,'checks':[],'pageErrors':[],'consoleErrors':[],'screenshots':[],'realPhoneTest':False,'hardwarePerformanceCertified':False,'referenceVideoVerified':False}
def check(label,condition,detail=None):
    report['checks'].append({'name':label,'pass':bool(condition),'detail':detail});print(label,condition,detail or '',flush=True)
    if not condition:raise AssertionError(label)
def pixels(page):
    return Image.open(io.BytesIO(page.locator('#scene').screenshot(timeout=60000))).convert('RGB')
def diff(a,b):return sum(ImageStat.Stat(ImageChops.difference(a,b)).mean)/3
def shot(page,label):
    file=prefix+label+'.png';page.screenshot(path=str(Q/file),timeout=60000);report['screenshots'].append(file)
try:
 with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
    page.set_default_timeout(60000)
    page.on('pageerror',lambda e:report['pageErrors'].append(str(e)))
    page.on('console',lambda e:report['consoleErrors'].append(e.text) if e.type=='error' else None)
    started=time.monotonic();response=page.goto(url,wait_until='domcontentloaded',timeout=120000)
    page.wait_for_function('window.FUR?.audit().ready',timeout=120000)
    page.wait_for_timeout(1500)
    report['wallReadySeconds']=time.monotonic()-started;initial=page.evaluate('FUR.audit()');report['initial']=initial;report['build']=page.evaluate('window.FUR_BUILD')
    check('Actual app version and ready',initial['ready'] and initial['version']=='FUR-ATELIER-R01')
    check('165000 explicit fiber instances',initial['instances']==165000)
    check('Authoritative EB1 1.1 core',initial['lighting']['version']=='EB1-1.1.0' and not initial['lighting'].get('localInspectionAdapter'))
    check('Shader rendered nontrivial geometry',initial['triangles']>2000000,initial['triangles'])
    check('Lighting recipe key/exposure/rim',initial['lighting']['profile']['exposure']==.7 and initial['lighting']['profile']['key']==1.6 and initial['lighting']['profile']['rim']==3.5)
    shot(page,'01-coat');a=pixels(page);check('Nonblank canvas',max(ImageStat.Stat(a).stddev)>12)
    steps=page.evaluate('FUR.audit().simSteps');page.wait_for_timeout(750);check('Guide physics advances',page.evaluate('FUR.audit().simSteps')>steps)
    page.evaluate('FUR.setSimulating(false)');h=initial['rootHash'];frozen=page.evaluate('FUR.audit().simSteps');page.wait_for_timeout(350);check('Physics pause holds',page.evaluate('FUR.audit().simSteps')==frozen)
    if public:
        for key in ['silver','ivory','sable']:
            page.locator('[data-preset="'+key+'"]').click();page.wait_for_timeout(250);check('Public preset '+key,page.evaluate('FUR.audit().preset')==key)
        page.locator('[data-preset="fox"]').click()
        page.locator('[data-camera="macro"]').click();page.wait_for_timeout(400);shot(page,'02-macro')
        page.locator('[data-camera="full"]').click()
        page.locator('[data-view="hat"]').click();page.wait_for_timeout(500);shot(page,'03-hat');check('Public hat',page.evaluate('FUR.audit().view')=='hat')
        page.locator('[data-view="coat"]').click()
    else:
        for key in ['sable','silver','ivory','fox','shearling','suede']:
            page.locator('[data-preset="'+key+'"]').click();page.wait_for_timeout(250)
            audit=page.evaluate('FUR.audit()');check('Preset '+key+' preserves roots',audit['preset']==key and audit['rootHash']==h)
            if key in ['silver','ivory','sable']:shot(page,'preset-'+key)
        page.locator('[data-preset="fox"]').click();page.evaluate('FUR.setSimulating(false)');page.wait_for_timeout(300);full=pixels(page)
        page.locator('[data-layer="base"]').click();page.wait_for_timeout(250);base=pixels(page);delta=diff(full,base);check('Visible fur differs from bare coat',delta>.15,delta);shot(page,'02-base-comparison')
        for layer in ['under','guard','all']:
            page.locator('[data-layer="'+layer+'"]').click();page.wait_for_timeout(200);check('Layer '+layer,page.evaluate('FUR.audit().layer')==layer)
        page.locator('[data-camera="macro"]').click();page.wait_for_timeout(350);shot(page,'03-macro')
        before=page.evaluate('FUR.audit().rootHash');page.locator('[data-param="length"]').fill('115');page.locator('[data-param="length"]').dispatch_event('input');check('Length control changes uniform without roots',page.evaluate('FUR.audit().parameters.length')==115 and page.evaluate('FUR.audit().rootHash')==before)
        page.locator('[data-preset="fox"]').click();page.locator('[data-camera="back"]').click();page.wait_for_timeout(350);shot(page,'04-back')
        page.locator('[data-view="collar"]').click();page.wait_for_timeout(350);shot(page,'05-collar')
        page.locator('[data-view="hat"]').click();page.wait_for_timeout(350);shot(page,'06-hat')
        page.locator('[data-view="swatch"]').click();page.wait_for_timeout(350);shot(page,'07-swatch')
        page.locator('[data-view="coat"]').click();page.wait_for_timeout(350);check('Rebuilt coat keeps same deterministic roots',page.evaluate('FUR.audit().rootHash')==h)
        page.evaluate('FUR.setSimulating(true);FUR.setWind(1.4);FUR.impulse()');page.wait_for_timeout(700);check('Guide tips are bounded',page.evaluate('FUR.audit().guideTipMax')<.036)
    page.locator('#light').click();page.locator('[data-key="exposure"]').fill('1.1');page.locator('[data-key="exposure"]').dispatch_event('input');check('Actual EB1 exposure control',page.evaluate('FUR.audit().lighting.profile.exposure')==1.1)
    page.locator('#light').click();page.locator('[data-view="hat"]').click();check('Geometry rebuild does not reset EB1',page.evaluate('FUR.audit().lighting.profile.exposure')==1.1)
    page.reload(wait_until='domcontentloaded',timeout=120000);page.wait_for_function('window.FUR?.audit().ready',timeout=120000);check('EB1 survives reload',page.evaluate('FUR.audit().lighting.profile.exposure')==1.1)
    page.locator('#reset').click();page.wait_for_timeout(300)
    rect=page.locator('#scene').bounding_box();before=page.evaluate('FUR.camera.position.toArray()');page.mouse.move(rect['x']+rect['width']*.55,rect['y']+rect['height']*.50);page.mouse.down();page.mouse.move(rect['x']+rect['width']*.62,rect['y']+rect['height']*.51,steps=4);page.mouse.up();check('Pointer orbit changes camera',page.evaluate('FUR.camera.position.toArray()')!=before)
    page.locator('#export').click();recipe=json.loads(page.locator('#recipe').input_value());check('Exported editable recipe',recipe['schema']=='kaopu.fur/1')
    report['final']=page.evaluate('FUR.audit()')
    page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(500);page.evaluate("FUR.cameraPreset('full')");shot(page,'mobile-viewport')
    check('Mobile viewport contains a drawable canvas',page.locator('#scene').bounding_box()['height']>350)
    check('No JS page errors',not report['pageErrors'],report['pageErrors'])
    shader_errors=[e for e in report['consoleErrors'] if any(s in e for s in ['WebGLProgram','VALIDATE_STATUS','ERROR: 0:','Error creating WebGL'])]
    check('No shader errors',not shader_errors,shader_errors)
    browser.close();report['passed']=True
except Exception:
 report['passed']=False;report['failure']=traceback.format_exc();print(report['failure'],flush=True)
finally:
 (Q/(name+'.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'passed':report.get('passed'), 'report':str(Q/(name+'.json'))}),flush=True)
if not report.get('passed'):sys.exit(1)
