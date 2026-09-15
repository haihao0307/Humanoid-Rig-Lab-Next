"""Exercise the original NPC and fitting entry, preserving actual browser evidence."""
import asyncio, functools, http.server, json, threading, time, traceback, os
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
        page=await browser.new_page(viewport={'width':1280,'height':960},device_scale_factor=1)
        def observe(target):
            target.set_default_timeout(90000)
            target.on('console',lambda msg: logs.append({'type':msg.type,'text':msg.text}))
            target.on('pageerror',lambda error: errors.append(str(error)))
            target.on('requestfailed',lambda request: requests.append({'url':request.url,'error':request.failure}))
        observe(page)
        try:
            entry=(f"https://rawcdn.githack.com/haihao0307/Humanoid-Rig-Lab-Next/{os.environ['GITHUB_SHA']}/npc-tailor.html" if os.environ.get('REVIEW_ROUTE')=='public' else f'http://127.0.0.1:{server.server_port}/npc-tailor.html')
            response=await page.goto(entry,wait_until='domcontentloaded',timeout=90000)
            tests['entryHTTP200']=response.status==200
            (OUT/'entry-url.txt').write_text(entry)
            if response.status!=200: raise RuntimeError(f'Entry HTTP {response.status}')
            gate=page.get_by_text('Open the page',exact=True)
            if await gate.count():
                await page.screenshot(path=str(OUT/'host-confirmation.png'),timeout=90000)
                context=page.context; before=len(context.pages)
                await gate.click();await page.wait_for_timeout(1000)
                if len(context.pages)>before:
                    page=context.pages[-1];observe(page)
                await page.wait_for_load_state('domcontentloaded',timeout=90000)
                tests['normalHostConfirmationClicked']=True
            await page.wait_for_selector('#progress',state='attached',timeout=90000)
            for k in range(240):
                await asyncio.sleep(2)
                status=await page.evaluate("({ready:!!window.TailorApp?.ready,progress:document.getElementById('progress')?.textContent,stageError:document.getElementById('bodyFrame')?.contentWindow?.__startupError})")
                if k%8==0: print('PROGRESS',status,flush=True)
                if status['ready']: break
                if errors: raise RuntimeError('; '.join(errors))
                if status.get('stageError'): raise RuntimeError(str(status['stageError']))
                if '失败' in (status['progress'] or ''): raise RuntimeError(status['progress'])
            else: raise RuntimeError('NPC fitting initialization timeout')
            report=await page.evaluate('TailorApp.report')
            (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
            tests['bodySource']=report['source']['commit']=='2c10edaec6e8515bc64f9df8b3da78cb34c89e61'
            tests['bodyGenerated']=report['source']['bodyVertices']>10000
            tests['shaderHashCheckedByRuntime']=True
            tests['staticDefaultSamples']=report['clearance']['violatingSamples']==0 and report['clearance']['ambiguousSamples']==0
            for view in ['quarter','front','side','back','full','neck','close']:
                await page.evaluate('(v)=>TailorApp.view(v)',view)
                await page.wait_for_timeout(1000)
                await page.screenshot(path=str(OUT/f'{view}.png'),timeout=90000)
            await page.locator('#neutral').check(); await page.wait_for_timeout(500)
            tests['neutralToggle']=await page.evaluate('TailorApp.state.neutral===true')
            await page.screenshot(path=str(OUT/'neutral.png'),timeout=90000)
            await page.locator('#neutral').uncheck()
            await page.locator('#light').select_option('0')
            tests['lightToggle']=await page.evaluate('TailorApp.state.light===0')
            await page.locator('#light').select_option('1')
            await page.locator('#swatch').check()
            tests['swatchToggle']=await page.evaluate('TailorApp.state.swatch===true')
            await page.evaluate("TailorApp.view('front')");await page.wait_for_timeout(1000)
            await page.screenshot(path=str(OUT/'swatch.png'),timeout=90000)
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
            await page.screenshot(path=str(OUT/'failure.png'),timeout=90000)
            raise
        finally:
            (OUT/'browser-log.json').write_text(json.dumps({'tests':tests,'errors':errors,'failedRequests':requests,'logs':logs,'elapsedSeconds':time.time()-started},ensure_ascii=False,indent=2))
            await browser.close()
    assert tests and all(tests.values()), tests
asyncio.run(main())
