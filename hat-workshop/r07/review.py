"""R07 reproducible source handoff, build and real-browser review.
The byte-checked source seed is applied ONCE, only when app.js is absent.
After the initial commit, readable r07 modules are the source authority.
"""
from pathlib import Path
import os,sys,subprocess,json,gzip,base64,hashlib,shutil,time,urllib.request
import numpy as np
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parent; ROOT=R.parent.parent; B=R.parent/'r06'
BRANCH='fix/hat-r07-seams-crown-switch-20261013'
BASE='7e72ff29495ca2307858dfd5ea1375423d30dda1'
hash256=lambda x:hashlib.sha256(x).hexdigest()
def run(args,**kw):return subprocess.run(args,cwd=ROOT,check=True,**kw)
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT,text=True).strip()
run(['git','config','user.name','github-actions[bot]'])
run(['git','config','user.email','41898282+github-actions[bot]@users.noreply.github.com'])
if not (R/'app.js').exists():
    auth=json.loads((B/'SOURCE_AUTHORITY.json').read_text())
    names=set(auth['canonicalRuntime']+[auth['builder'],'verify.mjs','check_distance.py','qa.py','distance_check.py','portable_geometry.py','SOURCES.json','THREE_LICENSE.txt','SOURCE_AUTHORITY.json'])
    for n in names:
        p=R/n;p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(B/n,p)
    delta=json.loads(gzip.decompress(base64.b64decode((R/'SOURCE_DELTA.b64').read_text())))
    for name,change in delta.items():
        p=R/name;text=p.read_text() if p.exists() else ''
        assert hash256(text.encode())==change['base'], 'Wrong source seed base: '+name
        for i,j,replacement in reversed(change['edits']):text=text[:i]+replacement+text[j:]
        assert hash256(text.encode())==change['result'], 'Corrupt source seed result: '+name
        p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text)
    auth=json.loads((R/'SOURCE_AUTHORITY.json').read_text());auth['initialTransport']='SOURCE_DELTA.b64 was verified and applied once before the initial readable-source commit. Never replay over readable source.'
    (R/'SOURCE_AUTHORITY.json').write_text(json.dumps(auth,indent=2)+'\n')
    (R/'TAKEOVER.json').write_text(json.dumps({'baseline':BASE,'parentReceipt':'8e5c875d01c199e56c9ae5e542d8f23fc46525e7','oldDirectoriesModified':False,'draftPR':59,'scope':['contained interior bands: trilby, cloche, chef','source-shaped free knit crown','flatcap bill excluded from lining pull and collar push','bounded source/asset/fit caches'],'hairImplemented':False,'userAccepted':False},indent=2))
    run(['git','add','hat-workshop/r07'])
    run(['git','commit','-m','feat(hat-r07): establish inspectable production source [skip ci]'])
    run(['git','push','origin','HEAD:'+BRANCH])
source=git('rev-parse','HEAD')
# Derive local test packages from the frozen full source payload. Public package
# references and their original SHA-256 hashes remain unchanged in build.py.
payload=json.loads(gzip.decompress(base64.b64decode(BeautifulSoup((R.parent/'r04/standalone.html').read_text(),'html.parser').find(id='payload').text)))
A=R.parent/'r03/assets';A.mkdir(parents=True,exist_ok=True)
for item in payload['hats']:
    (A/(item['id']+'.bin')).write_bytes(gzip.compress(json.dumps(item).encode()))
for item in payload['native']['heads']:
    (A/('head-'+item['id']+'.bin')).write_bytes(gzip.compress(json.dumps(item).encode()))
run(['node',str(R/'verify.mjs')])
run(['node',str(R/'geometry-audit.mjs')])
run(['python',str(R/'build.py'),'--source',source])
Q=R/'qa/browser';Q.mkdir(parents=True,exist_ok=True)
report={'version':'HAT-R07.1','sourceSha':source,'baselineSha':BASE,'environment':'GitHub Actions Ubuntu Chromium headless SwiftShader; desktop viewport, not phone hardware','cases':[],'checks':[],'errors':[],'visualAcceptance':'USER_PENDING'}
def check(name,ok,detail=None):
    report['checks'].append({'name':name,'passed':bool(ok),'detail':detail})
    if not ok:raise AssertionError(name+': '+str(detail))
def save():
    (Q/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))

def browser_suite(page,extended=True):
    page.wait_for_function('window.hatLab && hatLab.ready()',timeout=240000)
    check('browser version',page.evaluate('hatLab.version')=='HAT-R07.1')
    check('browser source identity',page.evaluate('hatLab.sourceCommit')==source)
    page.wait_for_function('hatLab.thumbnails()===11',timeout=60000)
    heads={};baseline_hashes={}
    ids=page.evaluate('hatLab.catalogue().map(h=>h.id)')
    focus=['trilby','cloche','chef','cable','flatcap']
    for hid in ([0,1,2,0] if extended else [0]):
        page.evaluate('(head)=>hatLab.set({head})',hid)
        hh=page.evaluate('hatLab.headGeometryHash()')
        if hid in heads:check('head unchanged after round trip',heads[hid]==hh)
        heads[hid]=hh
        for id in ids:
            start=time.perf_counter();page.evaluate('(id)=>hatLab.select(id)',id)
            page.wait_for_function('hatLab.ready()',timeout=240000)
            row={'hat':id,'headIndex':hid,'switchWallMS':(time.perf_counter()-start)*1000,'metrics':page.evaluate('hatLab.metrics()'),'performance':page.evaluate('hatLab.performance()')}
            key=f'{hid}/{id}';gh=page.evaluate('hatLab.geometryHash()');bh=page.evaluate('hatLab.bandGeometryHash()')
            if key in baseline_hashes:check('geometry deterministic '+key,baseline_hashes[key]==[gh,bh])
            baseline_hashes[key]=[gh,bh];row['geometryHash']=gh;row['bandHash']=bh;report['cases'].append(row)
            if len(report['cases'])<=33:
                head_id=row['metrics']['headId'];prefix=R/'qa/geometry-dump'/f'{head_id}--{id}--'
                expected=np.fromfile(str(prefix)+'position.bin','<f4');observed=np.asarray(page.evaluate('hatLab.currentPositions()'),dtype=np.float64)
                err=float(np.max(np.abs(expected-observed))) if len(expected)==len(observed) else float('inf')
                check('browser versus Node '+key,err<2e-8,{'maximumPositionErrorM':err})
                if bh:
                    expected=np.fromfile(str(prefix)+'band-position.bin','<f4');observed=np.asarray(page.evaluate('hatLab.debugGeometry().sweatband.position'),dtype=np.float64)
                    err=float(np.max(np.abs(expected-observed))) if len(expected)==len(observed) else float('inf')
                    check('browser facing versus Node '+key,err<2e-8,{'maximumPositionErrorM':err})
            check('target head preserved '+key,hh==page.evaluate('hatLab.headGeometryHash()'))
            check('finite visible geometry '+key,row['metrics']['hatVisible'] and row['metrics']['vertices']>100)
            if hid==0 and id in focus and len(report['cases'])<=11:
                for view in ['three','front','inside','side','detail']:
                    page.evaluate('(v)=>hatLab.frame(v)',view);page.wait_for_timeout(150)
                    page.locator('#canvas').screenshot(path=str(Q/f'{id}-{view}.png'))
                if id in ['trilby','cloche','chef']:
                    page.evaluate("hatLab.frame('front')");page.wait_for_timeout(100)
                    page.evaluate('hatLab.debugBandVisible(false)');page.wait_for_timeout(100)
                    page.locator('#canvas').screenshot(path=str(Q/f'{id}-band-hidden-control.png'))
                    page.evaluate('hatLab.debugBandVisible(true)')
            save()
        if extended and hid==0 and len(report['cases'])==11:
            # Warm A-B-A measurements with rendering included, no replacement by a timer.
            for id in focus+focus:
                page.evaluate('(id)=>hatLab.select(id)',id)
            report['warmMeasurements']=page.evaluate('hatLab.performance()')
    gh=page.evaluate('hatLab.geometryHash()')
    page.evaluate('hatLab.set({roughness:0.8,detail:0.9})')
    check('material edit preserves geometry',gh==page.evaluate('hatLab.geometryHash()'))
    page.evaluate("hatLab.setPreset('standard')")
    check('preset restores fitted geometry',gh==page.evaluate('hatLab.geometryHash()'))
    page.evaluate("Promise.all([hatLab.select('chef'),hatLab.select('cloche'),hatLab.select('flatcap')])")
    check('latest rapid selection wins',page.evaluate('hatLab.recipe().settings.id')=='flatcap')
    check('all catalogue thumbnails retained',page.evaluate('hatLab.thumbnails()')==11)
    report['finalPerformance']=page.evaluate('hatLab.performance()')
    check('no application errors',not report['errors'],report['errors'])
    save()

try:
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'])
        page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
        page.on('pageerror',lambda e:report['errors'].append(str(e)))
        page.goto((R/'standalone.html').as_uri()+'#hat=trilby',wait_until='domcontentloaded',timeout=180000)
        browser_suite(page)
        page.evaluate("hatLab.select('trilby')");page.screenshot(path=str(Q/'desktop-workbench.png'))
        for hi in [0,1,2]:
            page.evaluate('(head)=>hatLab.set({head})',hi);page.evaluate("hatLab.select('flatcap')");page.evaluate("hatLab.frame('inside')");page.wait_for_timeout(150);page.locator('#canvas').screenshot(path=str(Q/f'flatcap-head-{hi}-inside.png'))
        page.evaluate('hatLab.set({head:0})');page.evaluate("hatLab.select('trilby')")
        page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(200)
        page.screenshot(path=str(Q/'mobile-viewport.png'))
        report['mobileScope']='390x844 viewport only; no physical phone test'
        browser.close()
    report['passed']=all(x['passed'] for x in report['checks']);save()
    # Freeze the actual tested built bytes before any external-browser verification.
    run(['git','add','hat-workshop/r07'])
    if git('status','--porcelain','hat-workshop/r07'):
        run(['git','commit','-m','build(hat-r07): freeze tested candidate and browser evidence [skip ci]'])
        run(['git','push','origin','HEAD:'+BRANCH])
    built=git('rev-parse','HEAD')
    url=f'https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/{built}/hat-workshop/r07/index.html#hat=trilby'
    P=R/'qa/public';P.mkdir(parents=True,exist_ok=True)
    public={'sourceSha':source,'buildSha':built,'url':url,'errors':[],'checks':[],'cases':[],'userAccepted':False}
    manifest=json.loads((R/'BUILD_MANIFEST.json').read_text())
    raw=f'https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/{built}/hat-workshop/r07/index.html'
    for retry in range(6):
        try:
            data=urllib.request.urlopen(raw,timeout=60).read();assert hash256(data)==manifest['htmlSHA256'];break
        except Exception:
            if retry==5:raise
            time.sleep(3)
    public['htmlSHA256']=hash256(data)
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'])
        page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
        page.on('pageerror',lambda e:public['errors'].append(str(e)))
        requests=[];page.on('request',lambda r:requests.append(r.url))
        start=time.perf_counter();page.goto(url,wait_until='domcontentloaded',timeout=180000)
        page.wait_for_function('window.hatLab && hatLab.ready()',timeout=240000)
        public['coldWallMS']=(time.perf_counter()-start)*1000
        assert page.evaluate('hatLab.version')=='HAT-R07.1'
        assert page.evaluate('hatLab.sourceCommit')==source
        for id in ['trilby','cloche','chef','cable','flatcap']:
            start=time.perf_counter();page.evaluate('(id)=>hatLab.select(id)',id)
            public['cases'].append({'hat':id,'wallMS':(time.perf_counter()-start)*1000,'metrics':page.evaluate('hatLab.metrics()'),'performance':page.evaluate('hatLab.performance()')})
            page.evaluate("hatLab.frame('three')");page.wait_for_timeout(150)
            page.locator('#canvas').screenshot(path=str(P/f'{id}.png'))
        network_before=len(requests)
        for id in ['trilby','cloche','chef','cable','flatcap']:page.evaluate('(id)=>hatLab.select(id)',id)
        public['warmPerformance']=page.evaluate('hatLab.performance()');public['warmNetworkRequests']=requests[network_before:]
        public['checks']=[{'name':'fixed public version/source verified','passed':True},{'name':'five focused hats visibly rendered','passed':len(public['cases'])==5},{'name':'no app errors','passed':not public['errors']},{'name':'warm switches no package fetch','passed':not any('/assets/' in r for r in public['warmNetworkRequests'])}]
        page.evaluate("hatLab.select('trilby')");page.screenshot(path=str(P/'desktop.png'))
        browser.close()
    public['passed']=all(c['passed'] for c in public['checks'])
    (P/'report.json').write_text(json.dumps(public,ensure_ascii=False,indent=2))
    (R/'DELIVERY.json').write_text(json.dumps({'version':'HAT-R07.1','sourceSha':source,'buildSha':built,'publicURL':url,'publicVerified':public['passed'],'browserVerified':report['passed'],'userAccepted':False,'oldVersionsModified':False,'noMerge':True,'draftPR':59,'numericScope':'388 checks, 98 fits, one explicitly rejected synthetic stress fixture; three original heads, not nine different people','nearestTriangleDistanceAudit':'PENDING','mobileScope':'viewport only','hairCompressionImplemented':False,'dynamicDonningVerified':False},ensure_ascii=False,indent=2))
    assert public['passed'], 'Public browser checks failed'
    print('PUBLIC_CANDIDATE',url,flush=True)
except Exception as e:
    report['failure']=str(e);report['passed']=False;save();raise
