import asyncio, json, os, pathlib, hashlib, base64, gzip, time
from playwright.async_api import async_playwright
from PIL import Image, ImageStat

ROOT=pathlib.Path(__file__).parent
OUT=ROOT/'qa-public'; OUT.mkdir(exist_ok=True)
SHA=os.environ['GITHUB_SHA']
URL=f'https://raw.githack.com/haihao0307/Humanoid-Rig-Lab-Next/{SHA}/previews/fabric-fidelity-r1/index.html'
raw=gzip.decompress(base64.b64decode(''.join(p.read_text().strip() for p in sorted((ROOT/'chunks').glob('*.b64')))))
assert hashlib.sha256(raw).hexdigest()=='6c700e5fd7bd659380b17b06e370b42d536e54abfb6387fc5ea2ebecae7f2fb6'
report={'url':URL,'commit':SHA,'contentIntegrity':True,'publicRender':False,'mobileIsViewportEmulation':True,'errors':[],'scenes':[]}

async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  page=await browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
  page.on('pageerror',lambda e:report['errors'].append(str(e)))
  try:
   for attempt in range(3):
    try:
     response=await page.goto(URL,wait_until='domcontentloaded',timeout=90000)
     report['httpStatus']=response.status
     await page.wait_for_function('window.fabricLab && window.fabricLab.runtime.running',timeout=90000)
     break
    except Exception:
     if attempt==2: raise
     await page.wait_for_timeout(5000)
   await page.wait_for_function('window.fabricLab.runtime.frames>2',timeout=30000)
   report['renderer']=await page.evaluate("document.getElementById('canvas').getContext('webgl2').getParameter(7937)")
   await page.evaluate('fabricLab.state.paused=true;fabricLab.step(120)')
   await page.screenshot(path=str(OUT/'01-linen-desktop.png'))
   im=Image.open(OUT/'01-linen-desktop.png').convert('RGB'); report['imageStdDev']=ImageStat.Stat(im.crop((550,220,1150,850))).stddev
   assert max(report['imageStdDev'])>5, 'No visible scene variation'
   report['initial']=await page.evaluate('({...fabricLab.runtime})')
   assert report['initial']['frames']>2 and report['initial']['finite']
   await page.select_option('#material','1')
   await page.click('[data-view="macro"]')
   await page.evaluate('fabricLab.state.paused=true;fabricLab.render()')
   await page.screenshot(path=str(OUT/'02-acrylic-macro.png'))
   await page.click('#compare')
   assert await page.evaluate('fabricLab.state.split')
   await page.click('#compare')
   await page.select_option('#material','0')
   for name in ['hang','flag','drape','capsule','table','flat']:
    await page.evaluate('(name)=>{fabricLab.scene(name);fabricLab.state.paused=true}',name)
    metrics=await page.evaluate('fabricLab.step(240)')
    assert metrics['finite'],name+' unstable'
    report['scenes'].append({'name':name,'metrics':metrics})
    if name in ['drape','flag','table']:
     await page.screenshot(path=str(OUT/(name+'.png')))
   await page.evaluate("fabricLab.scene('hang');fabricLab.state.paused=true;fabricLab.state.wind=0;fabricLab.reset();fabricLab.step(30)")
   a=await page.evaluate('fabricLab.positions()')
   await page.evaluate('fabricLab.state.wind=4;fabricLab.step(60)')
   b=await page.evaluate('fabricLab.positions()')
   report['windMovementMaxM']=max(abs(x-y) for x,y in zip(a,b));assert report['windMovementMaxM']>.001
   await page.click('[data-tab="physics"]') if await page.locator('[data-tab="physics"]').count() else None
   await page.evaluate('fabricLab.state.collision=false;fabricLab.step(1);fabricLab.state.collision=true')
   report['collisionToggleExecuted']=True
   await page.set_viewport_size({'width':390,'height':844})
   await page.evaluate("fabricLab.scene('hang');fabricLab.state.paused=true;fabricLab.step(20)")
   await page.wait_for_timeout(500)
   await page.screenshot(path=str(OUT/'03-mobile-viewport.png'))
   await page.click('#mobile');await page.screenshot(path=str(OUT/'04-mobile-controls.png'))
   report['mobileViewport']={'width':390,'height':844,'realDevice':False,'noHorizontalOverflow':await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')}
   report['publicRender']=True
  except Exception as e:
   report['fatal']=str(e)
   await page.screenshot(path=str(OUT/'failure.png'))
  finally:
   (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
   print('PUBLIC_QA_REPORT='+json.dumps(report,ensure_ascii=False))
   await browser.close()
 if not report['publicRender'] or report['errors']:raise SystemExit(1)

asyncio.run(main())
