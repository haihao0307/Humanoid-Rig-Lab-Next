from pathlib import Path
import os,json,hashlib,base64,time,traceback,io,urllib.request
from PIL import Image,ImageStat
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1];kind=os.environ.get('RF32_KIND','source');Q=Path(os.environ.get('RF32_QA',str(R/'qa/source-file')));Q.mkdir(parents=True,exist_ok=True)
prepared=json.loads((R/'SOURCE_PREPARED.json').read_text());lock=prepared['lock'];core=prepared['core']
URL=os.environ.get('RF32_URL',Path(prepared['sourceEntry']).as_uri() if kind=='source' else (R/'preview.html').as_uri())
report={'kind':kind,'url':URL,'passed':False,'checks':[],'pageErrors':[],'consoleErrors':[],'requestFailures':[],'cancelledRequests':[],'sourceCommit':os.environ.get('RF32_INSTALL_COMMIT'),'htmlSHA256':lock['installedHTMLSHA256'],'physicalDeviceTested':False,'userVisualAccepted':False}
requests=[]
def save():(Q/'BROWSER.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
def check(name,ok=True,detail=None):
 if not ok:raise AssertionError(name+': '+str(detail))
 report['checks'].append({'name':name,'passed':True,'detail':detail});print('PASS',name,flush=True);save()
def pixels(locator):
 result=locator.evaluate('(c)=>({w:c.width,h:c.height,png:c.toDataURL("image/png")})');return base64.b64decode(result['png'].split(',',1)[1]),[result['w'],result['h']]
def shot(page,name):
 p=Q/(name+'.png');page.screenshot(path=str(p),timeout=90000);report.setdefault('screenshots',[]).append({'file':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
 ctx=browser.new_context(viewport={'width':1440,'height':1000},device_scale_factor=1,accept_downloads=True)
 page=ctx.new_page();page.set_default_timeout(90000)
 page.on('pageerror',lambda e:report['pageErrors'].append(str(e)));page.on('console',lambda e:report['consoleErrors'].append(e.text) if e.type=='error' else None)
 page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
 page.on('requestfailed',lambda r:report['cancelledRequests' if 'ERR_ABORTED' in str(r.failure) else 'requestFailures'].append({'url':r.url,'reason':r.failure}))
 try:
  if kind=='source' and URL.startswith('https:'):
   commit=os.environ['RF32_INSTALL_COMMIT'];raw='https://raw.githubusercontent.com/'+core['repository']+'/'+commit+'/'+core['entryPath'];data=urllib.request.urlopen(raw,timeout=120).read();check('published native source bytes match installed output',hashlib.sha256(data).hexdigest()==lock['installedHTMLSHA256'] and len(data)==lock['installedBytes'])
  page.goto(URL,wait_until='domcontentloaded',timeout=120000)
  if kind=='source':
   page.wait_for_function('!!window.KAOPU_SOURCE_INSTALLATION && !!window.DENIM_R17?.state.ready')
   info=page.evaluate('KAOPU_SOURCE_INSTALLATION.info()');check('source owns matching installation identity',info==core)
   check('source trial is not production',info['scope']=='trial_branch' and not info['authorities']['productionInstalled'])
   check('original denim identity preserved',page.evaluate('DENIM_R17.version')=='DENIM-R17.2-GARMENT-SCALE')
   read='async()=>{for(let i=0;i<80;i++){try{return KAOPU_SOURCE_INSTALLATION.read()}catch(e){if(!e.message.includes("PENDING"))throw e;await new Promise(r=>setTimeout(r,30))}}throw Error("READ_TIMEOUT")}'
   native=page.evaluate(read);report['initialNative']=native
   check('native lineage remains original rendering source',native['source']['commit']==core['sourceBaseCommit'])
   check('source exposes no write command',page.evaluate('Object.keys(KAOPU_SOURCE_INSTALLATION).sort().join(",")')=='info,read,version')
   check('source registry identity deeply frozen',page.evaluate('Object.isFrozen(KAOPU_SOURCE_INSTALLATION.info().authorities)'))
   check('existing geometry retained',native['mesh']['vertices']==9046 and native['mesh']['triangles']==18080)
   check('unknown real material measures retained',all(m['value'] is None for m in native['measurements'][5:]))
   first,dims=pixels(page.locator('#gl'));check('source renders real content',max(ImageStat.Stat(Image.open(io.BytesIO(first)).convert('RGB')).stddev)>5)
   n2=page.evaluate(read);second,dims2=pixels(page.locator('#gl'));check('independent source read leaves pixels unchanged',dims==dims2 and first==second)
   check('existing state and shader preservation holds',n2['preservation']['before']==n2['preservation']['after'])
   (Q/'source-native.png').write_bytes(first)
   if URL.startswith('file:'):
    baseline=ctx.new_page();baseline.goto((R/'_generated/renderer-before.html').as_uri(),wait_until='load');baseline.wait_for_function('DENIM_R17.state.ready');original,bdims=pixels(baseline.locator('#gl'));check('installed source matches original whole canvas',dims==bdims and original==first,{'installedSHA256':hashlib.sha256(first).hexdigest(),'originalSHA256':hashlib.sha256(original).hexdigest(),'size':dims});(Q/'source-original.png').write_bytes(original);baseline.close()
   shot(page,'01-source-installed')
   slider=page.locator('#weaveScale');slider.focus();slider.press('End');page.wait_for_function('()=>{try{return KAOPU_REALITY.read().shaderInputs.weaveScale===1.5}catch{return false}}')
   changed=page.evaluate(read);report['changedNative']=changed;check('actual source control reaches actual uniform',changed['shaderInputs']['weaveScale']==1.5)
   check('read follows current native input without platform',abs(changed['measurements'][0]['value']-.000635)<1e-12)
   page.locator('#reality-source-installation summary').click()
   with page.expect_download() as event:page.locator('#reality-source-export').click()
   out=Q/'SOURCE_RECEIPT.json';event.value.save_as(out);receipt=json.loads(out.read_text());check('standalone source exports complete native receipt',receipt['installation']==core and receipt['native']['family']=='denim')
   check('source export cannot grant production authority',not receipt['installation']['authorities']['productionInstalled'])
   if URL.startswith('file:'):check('installed source has no HTTP runtime dependency',not requests,requests)
  else:
   page.wait_for_function('!!window.__REALITY_S32__');api=lambda:page.evaluate('__REALITY_S32__.report()');connections=lambda:page.evaluate('__REALITY_S32__.connections()')
   check('three entries have explicit installation states',page.locator('#rf32-connections tr').count()==3)
   check('no native engine on startup',api()['iframeCount']==0)
   check('no automatic production promotion',all(not e['productionInstalled'] and not e['productionVerified'] for e in connections()['registry']['entries']))
   check('knit and leather are not falsely source installed',all(e['installation'] is None for e in connections()['registry']['entries'] if e['family']!='denim'))
   page.locator('#load').click();page.wait_for_function('__REALITY_S32__.connections().session.state==="CONNECTED" && __REALITY_S32__.report().common?.sourceMode==="live_read_only"')
   c=connections();check('source byte verification precedes runtime observation',c['session']['observedCore']==core)
   check('transport distinguishes offline source copy from HTTPS',c['session']['transport']==('embedded_installed_bytes' if URL.startswith('file:') else 'pinned_https'))
   check('installed original source used unchanged',page.frame_locator('#native').locator('body').evaluate('()=>!!window.KAOPU_SOURCE_INSTALLATION'))
   check('native common protocol remains original',api()['common']['schema']=='kaopu/reality-object@0.2')
   shot(page,'02-portal-source-connected')
   slider=page.frame_locator('#native').locator('#weaveScale');slider.focus();slider.press('End');page.wait_for_function('__REALITY_S32__.report().native?.shaderInputs.weaveScale===1.5');check('platform reads real installed-source control change',abs(api()['native']['measurements'][0]['value']-.000635)<1e-12)
   before=connections()['registry'];page.locator('#rf32-negative').click();check('wrong adapter test rejected explicitly','已拒绝' in page.locator('#rf32-negative-result').inner_text());check('negative test does not edit actual registry',connections()['registry']==before)
   with page.expect_download() as event:page.locator('#rf32-export').click()
   p=Q/'CONNECTION_REVIEW.json';event.value.save_as(p);check('connection export retains production false',all(not x['productionInstalled'] for x in json.loads(p.read_text())['registry']['entries']))
   native=api()['native'];fake={'schema':'kaopu/reality-review-bundle@1','native':native,'productionInstalled':True,'installation':{'scope':'production'}}
   page.evaluate('(x)=>__REALITY_S32__.importPacket(x)',fake);check('import cannot become live or source installation',api()['common']['sourceMode']=='imported_unverified' and connections()['registry']==before)
   page.locator('#restore-live').click();page.wait_for_function('__REALITY_S32__.report().common.sourceMode==="live_read_only"')
   if URL.startswith('https:'):
    raw=page.evaluate('RealityConnectionContract.rawURL(RF32_REGISTRY.entries[0].installation)')
    def corrupted(route):
     response=route.fetch();body=response.body();changed=bytes([body[0]^1])+body[1:];route.fulfill(response=response,body=changed)
    page.route(raw,corrupted);page.locator('#load').click();page.wait_for_function('__REALITY_S32__.connections().session.state==="FAILED"')
    check('changed source bytes refused before execution','HASH_MISMATCH' in connections()['session']['error'])
    check('no unverified source frame mounted',api()['iframeCount']==0 and api()['common']['sourceMode']!='live_read_only')
    page.unroute(raw,corrupted);page.locator('#load').click();page.wait_for_function('__REALITY_S32__.connections().session.state==="CONNECTED"');check('valid pinned source reconnects after refusal',api()['nativeReady'])
    original_url='https://raw.githubusercontent.com/'+core['repository']+'/refs/heads/'+core['productionBranch']+'/'+core['entryPath']
    page.locator('#rf32-check-original').click();page.wait_for_function('__REALITY_S32__.connections().sourceCheck.state!=="CHECKING"');check('original active entry still unchanged',connections()['sourceCheck']['state']=='MATCH')
    page.route(original_url,lambda route:route.fulfill(status=200,content_type='text/html',body='changed source fixture'))
    page.locator('#rf32-check-original').click();page.wait_for_function('__REALITY_S32__.connections().sourceCheck.state==="CHANGED"');check('actual changed-entry response is labelled stale',connections()['sourceCheck']['state']=='CHANGED');page.unroute(original_url)
    page.locator('#rf32-check-original').click();page.wait_for_function('__REALITY_S32__.connections().sourceCheck.state==="MATCH"')
   for family,button,identity in [('knit','#load-knit','fabric-knit-public-p02-c2'),('leather','#load-leather',None)]:
    page.locator(button).click();page.wait_for_function('(f)=>__REALITY_S32__.report().native?.family===f && __REALITY_S32__.report().common.sourceMode==="live_read_only"',arg=family,timeout=180000)
    check(family+' existing runtime smoke regression',api()['iframeCount']==1 and (identity is None or api()['native']['objectId']==identity))
    check(family+' does not inherit denim connection status',connections()['session']['state']=='CLOSED')
   page.locator('[data-history="fabric-denim-r17-2"]').click();check('history never becomes source installation evidence',api()['iframeCount']==0 and api()['common']['sourceMode']=='fixed_snapshot')
   cancel=page.evaluate('async()=>{const pending=__REALITY_S32__.loadNative("denim");__REALITY_S32__.close();try{await pending}catch(e){}return __REALITY_S32__.report().iframeCount;}');check('cancelled connection cannot resurrect old native',cancel==0)
   page.set_viewport_size({'width':390,'height':844});page.evaluate('scrollTo(0,0)');page.wait_for_timeout(150);check('390px status view fits without page overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+2'));shot(page,'03-mobile-registry')
   if URL.startswith('file:'):check('offline platform has no runtime HTTP dependency',not requests,requests)
   report['finalConnections']=connections()
  check('no unhandled page error',not report['pageErrors'],report['pageErrors']);check('no console error',not report['consoleErrors'],report['consoleErrors']);check('no unexpected failed request',not report['requestFailures'],report['requestFailures'])
  report['passed']=True;report['publicVerified']=URL.startswith('https:');report['fileVerified']=URL.startswith('file:')
 except Exception as e:
  report['failure']=str(e);report['trace']=traceback.format_exc();print(report['trace'],flush=True)
  try:shot(page,'FAILURE')
  except Exception as e2:report['captureFailure']=str(e2)
 finally:save();ctx.close();browser.close()
if not report['passed']:raise SystemExit(1)
print('BROWSER_PASSED',kind,len(report['checks']),flush=True)
