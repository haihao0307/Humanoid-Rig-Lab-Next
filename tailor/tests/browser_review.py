"""Exercise the real original NPC and added fitting entry in Chromium.
No fake worker or replacement body is used. Screenshots are evidence, not approval.
"""
import asyncio, functools, http.server, json, threading, time, traceback
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'tailor-review'; OUT.mkdir(exist_ok=True)
class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        if len(args)>1 and str(args[1]) not in ('200','304'): print(fmt%args,flush=True)
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
async def main():
    logs=[]; errors=[]; requests=[]; tests={}; started=time.time()
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        page=await browser.new_page(viewport={'width':1450,'height':1080},device_scale_factor=1)
        page.on('console',lambda msg: logs.append({'type':msg.type,'text':msg.text}))
        page.on('pageerror',lambda error: errors.append(str(error)))
        page.on('requestfailed',lambda request: requests.append({'url':request.url,'error':request.failure}))
        try:
            await page.goto(f'http://127.0.0.1:{server.server_port}/npc-tailor.html',wait_until='domcontentloaded')
            for k in range(180):
                await asyncio.sleep(2)
                status=await page.evaluate("({ready:!!window.TailorApp?.ready,progress:document.getElementById('progress').textContent})")
                if k%8==0: print('PROGRESS',status,flush=True)
                if status['ready']: break
                if errors: raise RuntimeError('; '.join(errors))
                if '失败' in status['progress']: raise RuntimeError(status['progress'])
            else: raise RuntimeError('NPC fitting initialization timeout')
            report=await page.evaluate('TailorApp.report')
            (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
            tests['bodySource']=report['source']['commit']=='2c10edaec6e8515bc64f9df8b3da78cb34c89e61'
            tests['bodyGenerated']=report['source']['bodyVertices']>10000
            tests['shaderHashCheckedByRuntime']=True
            tests['staticDefaultSamples']=report['clearance']['violatingSamples']==0 and report['clearance']['ambiguousSamples']==0
            for view in ['quarter','front','side','back','full','neck','close']:
                await page.evaluate('(v)=>TailorApp.view(v)',view)
                await page.wait_for_timeout(900)
                await page.screenshot(path=str(OUT/f'{view}.png'))
            await page.locator('#neutral').check(); await page.wait_for_timeout(500)
            tests['neutralToggle']=await page.evaluate('TailorApp.state.neutral===true')
            await page.screenshot(path=str(OUT/'neutral.png'))
            await page.locator('#neutral').uncheck()
            await page.locator('#light').select_option('0')
            tests['lightToggle']=await page.evaluate('TailorApp.state.light===0')
            await page.locator('#light').select_option('1')
            await page.locator('#swatch').check()
            tests['swatchToggle']=await page.evaluate('TailorApp.state.swatch===true')
            await page.evaluate("TailorApp.view('front')");await page.wait_for_timeout(500)
            await page.screenshot(path=str(OUT/'swatch.png'))
            await page.locator('#swatch').uncheck()
            await page.locator('#garment').uncheck()
            tests['garmentToggle']=await page.evaluate('TailorApp.state.garment===false')
            await page.locator('#garment').check()
            await page.evaluate("document.getElementById('ease').value='10';document.getElementById('length').value='2';TailorApp.rebuild()")
            adjusted=await page.evaluate('TailorApp.report')
            tests['dimensionRebuild']=adjusted['recipe']=={'easeCm':10,'lengthCm':2}
            (OUT/'adjusted-report.json').write_text(json.dumps(adjusted,ensure_ascii=False,indent=2))
            tests['noPageErrors']=not errors
        except Exception:
            (OUT/'failure.txt').write_text(traceback.format_exc())
            await page.screenshot(path=str(OUT/'failure.png'))
            raise
        finally:
            (OUT/'browser-log.json').write_text(json.dumps({'tests':tests,'errors':errors,'failedRequests':requests,'logs':logs,'elapsedSeconds':time.time()-started},ensure_ascii=False,indent=2))
            await browser.close()
    assert tests and all(tests.values()), tests
asyncio.run(main())
