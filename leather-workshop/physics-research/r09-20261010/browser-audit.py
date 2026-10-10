"""Read-only diagnostics on the exact R08 build. Adds getters only in a private
copy, no new material/physics/geometry. Screenshot evidence is internal only.
"""
from pathlib import Path
import hashlib,json,os
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parent
source=R.parents[1]/'r08/public-lite.html'
raw=source.read_bytes()
assert hashlib.sha256(raw).hexdigest()=='c9524e0c9d50ba8ba4e8070f621fc2e0d05a387b8c33b06e49a9e518da4e86be'
html=raw.decode();at=html.rfind('})();');assert at>0
getters='window.R08_PRIVATE_DIAGNOSTIC={get hero(){return hero},get solver(){return productSolver},get renderer(){return renderer}};'
html=html[:at]+getters+html[at:]
out=R/'results';out.mkdir(exist_ok=True);private=out/'private-inspection.html';private.write_text(html)
report={'scope':'Exact R08 build, with private diagnostic getters only. Not a new release. Real browser in workflow, not user device.', 'checks':[], 'errors':[], 'releaseReady':False}
def check(name,yes,data=None):
 report['checks'].append({'name':name,'pass':bool(yes),'data':data})
 if not yes:raise AssertionError(name)
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ['KAOPU_CHROMIUM_EXECUTABLE'],headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'])
 p=b.new_page(viewport={'width':1440,'height':1000});p.set_default_timeout(120000)
 p.on('pageerror',lambda e:report['errors'].append(str(e)))
 p.on('console',lambda m:report['errors'].append(m.text) if m.type=='error' else None)
 try:
  p.goto(private.as_uri(),wait_until='domcontentloaded',timeout=120000);p.wait_for_function('window.LEATHER_ATELIER?.ready',timeout=180000)
  report['version']=p.evaluate('LEATHER_ATELIER.version');check('exact R08 starts',report['version']=='R08.0')
  shader=p.evaluate("""() => {const r=R08_PRIVATE_DIAGNOSTIC.hero.userData.rig,m=r.meshes.find(m=>m.userData.thread),s=m.material.userData.shader;return {shaderPresent:!!s,skinTransform:!!s?.vertexShader.includes('transformed=productPoint'),sameNodeTexture:s?.uniforms.uProductNodes.value===r.texture,textureVersion:r.texture.version};}""")
  report['yarnShader']=shader;check('yarn has actual node-field shader binding, not a static unbound object',shader['shaderPresent'] and shader['skinTransform'] and shader['sameNodeTexture'],shader)
  report['controls']=p.evaluate("""() => Object.fromEntries(['craftChoice','legacyCraft','grabTool'].map(id=>{const e=document.getElementById(id);return [id,e?{text:e.textContent,visible:!!e.getClientRects().length,disabled:e.disabled}:null]}))""")
  p.locator('#legacyCraft').click();p.wait_for_function("document.getElementById('craftArchiveFrame').contentDocument?.querySelector('canvas')!==null",timeout=120000)
  archive=p.evaluate("""() => {const d=document.getElementById('craftArchiveFrame').contentDocument;return {open:document.getElementById('craftArchive').open,canvasCount:d.querySelectorAll('canvas').length,controls:d.querySelectorAll('input,select,button').length,title:d.title,text:d.body.innerText.slice(0,3000)}}""")
  report['archive']=archive;check('old craft interface loads and has actual controls',archive['open'] and archive['canvasCount']>0 and archive['controls']>10,archive)
  p.locator('#closeCraftArchive').click();p.evaluate("LEATHER_ATELIER.setView('home')")
  box=p.locator('#stage').bounding_box();x=box['x']+box['width']*.5;y=box['y']+box['height']*.5
  p.locator('#grabTool').click();p.mouse.move(x,y);p.mouse.down();p.wait_for_function('LEATHER_ATELIER.productPhysics.held',timeout=90000)
  p.mouse.move(x+45,y-55,steps=15);p.wait_for_timeout(1800)
  after=p.evaluate("""() => {const r=R08_PRIVATE_DIAGNOSTIC.hero.userData.rig,m=r.meshes.find(m=>m.userData.thread);return {physics:LEATHER_ATELIER.productPhysics,textureVersion:r.texture.version,sameNodeTexture:m.material.userData.shader.uniforms.uProductNodes.value===r.texture}}""")
  report['held']=after;check('grab updates the same texture read by the yarn shader',after['textureVersion']>shader['textureVersion'] and after['sameNodeTexture'] and after['physics']['timeS']>0,after)
  p.mouse.up();p.wait_for_function('!LEATHER_ATELIER.productPhysics.held',timeout=90000);check('release processed',not p.evaluate('LEATHER_ATELIER.productPhysics.held'))
  check('diagnostic browser has no application errors',not report['errors'],report['errors']);report['pass']=True
 except Exception as e:report['pass']=False;report['failure']=str(e)
 finally:b.close();private.unlink(missing_ok=True);(out/'browser-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False,indent=2))
if not report.get('pass'):raise SystemExit(1)
