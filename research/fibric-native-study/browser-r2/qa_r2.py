"""Browser pixel and recipe regression for the actual standalone or public R2."""
import asyncio, hashlib, json, pathlib, sys, os
from playwright.async_api import async_playwright
from PIL import Image, ImageChops, ImageStat
R=pathlib.Path(__file__).parent
OUT=pathlib.Path(os.environ.get('YARN_QA_OUT',str(R/'qa-final')));OUT.mkdir(exist_ok=True,parents=True)
URL=os.environ.get('YARN_QA_URL',(R/'index.html').as_uri())
report={'url':URL,'ready':False,'public':URL.startswith('https:'),'realMobileDevice':False,'cinematicParity':False,'errors':[],'consoleErrors':[],'requests':[],'checks':{}}
async def run():
 async with async_playwright() as p:
  kwargs={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']}
  local=list((R/'browser').rglob('headless_shell')) if (R/'browser').exists() else []
  if local:kwargs['executable_path']=str(local[0])
  b=await p.chromium.launch(**kwargs)
  pg=await b.new_page(viewport={'width':1080,'height':800},device_scale_factor=1)
  pg.set_default_timeout(120000)
  pg.on('pageerror',lambda e:report['errors'].append(str(e)))
  pg.on('console',lambda e:report['consoleErrors'].append(e.text) if e.type=='error' else None)
  pg.on('request',lambda q:report['requests'].append(q.url) if q.url.startswith('http') else None)
  async def shot(name):
   await pg.evaluate('__YARN_TEST__.finishFrame()');await pg.wait_for_timeout(250)
   path=OUT/(name+'.png');await pg.screenshot(path=str(path))
   a=Image.open(path).convert('RGB');v=ImageStat.Stat(a).stddev
   assert max(v)>8,(name,v)
   report['checks'][name]={'imageSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'stddev':v}
   print(name,flush=True);return path
  try:
   await pg.goto(URL,wait_until='domcontentloaded',timeout=120000)
   if await pg.get_by_text('One more step',exact=True).count():
    report['hostConfirmationRequired']=True;await pg.get_by_text('Open the page',exact=True).click()
    report['hostingConsoleErrors']=report['consoleErrors'][:];report['consoleErrors']=[]
   await pg.wait_for_function('window.__YARN_ATELIER__?.ready || window.__YARN_ATELIER__?.errors?.length',timeout=120000)
   assert await pg.evaluate("__YARN_ATELIER__.version==='YARN_ATELIER_R2'&&__YARN_ATELIER__.errors.length===0")
   report['initial']=await pg.evaluate('__YARN_ATELIER__')
   report['renderer']=await pg.evaluate("()=>{const g=__YARN_TEST__.renderer.getContext(),e=g.getExtension('WEBGL_debug_renderer_info');return e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER)}")
   initial=await shot('macro-default')
   await pg.evaluate("async()=>{await __YARN_TEST__.setView('hero')}");await shot('whole-swatch')
   await pg.evaluate("async()=>{await __YARN_TEST__.setView('edge');__YARN_TEST__.lighting('grazing')}");await shot('grazing')
   await pg.evaluate("async()=>{await __YARN_TEST__.setView('macro');__YARN_TEST__.lighting('studio')}")
   await pg.evaluate("async()=>{await __YARN_TEST__.applyRecipe({disorder:0,seed:7319})}");regular=await shot('regular-comparison')
   await pg.evaluate("async()=>{await __YARN_TEST__.applyRecipe({disorder:.68,seed:7320,curved:false})}");await shot('new-seed-flat')
   # Reject invalid parameters before mutating the live scene.
   report['checks']['invalidRecipeRejected']=await pg.evaluate("async()=>{const old=__YARN_TEST__.config.seed;try{await __YARN_TEST__.applyRecipe({seed:-4,density:8});return false}catch(e){return __YARN_TEST__.config.seed===old}}")
   assert report['checks']['invalidRecipeRejected']
   await pg.evaluate("async()=>{await __YARN_TEST__.applyRecipe({disorder:.68,seed:7319,curved:true})}")
   await pg.locator('[data-palette="charcoal"]').click();await shot('charcoal')
   await pg.locator('[data-palette="oat"]').click()
   # The exported file must be usable for actual import, not just exist.
   async with pg.expect_download() as d:await pg.locator('#save').click()
   download=await d.value;await download.save_as(str(OUT/'recipe.json'))
   recipe=json.loads((OUT/'recipe.json').read_text());assert recipe['schema']=='kaopu/dense_yarn_look@2'
   await pg.evaluate("async()=>{await __YARN_TEST__.applyRecipe({seed:7419,warp:'#504234'})}")
   await pg.locator('#recipeInput').set_input_files(str(OUT/'recipe.json'))
   await pg.wait_for_function("__YARN_TEST__.config.seed===7319 && !__YARN_TEST__.isBusy()")
   assert await pg.locator('#recipeStatus').inner_text()=='已还原：recipe.json'
   restored=await shot('restored-recipe')
   report['checks']['recipeRoundTrip']=True
   await pg.locator('#newSeed').click();await pg.wait_for_function('__YARN_TEST__.config.seed===7320&&!__YARN_TEST__.isBusy()')
   await pg.locator('#undo').click();await pg.wait_for_function('__YARN_TEST__.config.seed===7319&&!__YARN_TEST__.isBusy()')
   await pg.locator('#redo').click();await pg.wait_for_function('__YARN_TEST__.config.seed===7320&&!__YARN_TEST__.isBusy()')
   report['checks']['undoRedo']=True
   await pg.evaluate("async()=>{await __YARN_TEST__.applyRecipe({seed:7319,warp:'#bcb19a',weft:'#a99f8b'})}")
   # Finite arrays and independently read attributes, not just UI labels.
   report['checks']['geometry']=await pg.evaluate("()=>{let vertices=0,triangles=0,finite=true,meshes=0;__YARN_TEST__.scene.traverse(o=>{if(o.isMesh&&o.name!=='StudioGround'){meshes++;const a=o.geometry.attributes.position.array;vertices+=a.length/3;for(const v of a)if(!Number.isFinite(v))finite=false;triangles+=o.geometry.index.count/3;}});return {vertices,triangles,finite,meshes}}")
   assert report['checks']['geometry']['finite'] and report['checks']['geometry']['triangles']>100000
   await pg.set_viewport_size({'width':390,'height':844});await pg.evaluate("async()=>{await __YARN_TEST__.setView('hero')}");await shot('mobile-viewport')
   await pg.locator('#mobilePanel').click();await shot('mobile-controls');await pg.locator('#mobilePanel').click()
   assert await pg.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
   report['checks']['mobileViewport']={'width':390,'height':844,'realDevice':False,'noHorizontalOverflow':True}
   await pg.set_viewport_size({'width':960,'height':720});await pg.evaluate("async()=>{await __YARN_TEST__.setView('macro')}")
   if os.environ.get('YARN_TRACE','1')=='1':
    await pg.evaluate("__YARN_TEST__.config.quality=.65;__YARN_TEST__.renderer.setPixelRatio(.65)")
    await pg.locator('#trace').click()
    target=int(os.environ.get('YARN_SPP','32'))
    await pg.wait_for_function('(n)=>__YARN_ATELIER__.pathSamples>=n',arg=target,timeout=600000)
    await pg.evaluate('__YARN_TEST__.pauseTrace()');await pg.wait_for_timeout(500)
    await pg.screenshot(path=str(OUT/'pathtraced.png'))
    report['checks']['pathTracing']={'samples':await pg.evaluate('__YARN_ATELIER__.pathSamples'),'requested':target,'renderScale':.65,'convergenceVerified':False}
   report['final']=await pg.evaluate('__YARN_ATELIER__');report['ready']=True
  except Exception as e:
   report['fatal']=str(e)
   try:await pg.screenshot(path=str(OUT/'failure.png'))
   except Exception:pass
  finally:
   (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False),flush=True);await b.close()
 assert report['ready'] and not report['errors'] and not report['consoleErrors'],report.get('fatal',report['consoleErrors'])
asyncio.run(run())
