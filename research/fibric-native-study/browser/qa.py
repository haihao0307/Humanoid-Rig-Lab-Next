import asyncio,json,pathlib,os,base64,hashlib,time
from playwright.async_api import async_playwright
from PIL import Image,ImageStat,ImageChops
root=pathlib.Path('out').resolve();ev=root/'evidence';ev.mkdir(exist_ok=True)
report={'sourceCommit':os.environ.get('GITHUB_SHA'),'publicDelivery':False,'visualAcceptance':False,'errors':[],'consoleErrors':[],'networkRequests':[],'checks':{},'captures':{}}
async def main():
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        page=await browser.new_page(viewport={'width':1200,'height':850})
        page.set_default_timeout(90000)
        page.on('pageerror',lambda e:report['errors'].append(str(e)))
        page.on('console',lambda m:report['consoleErrors'].append(m.text) if m.type=='error' else None)
        page.on('request',lambda r:report['networkRequests'].append(r.url) if r.url.startswith('http') else None)
        async def capture(name,raster=True):
            if raster:await page.evaluate('window.__YARN_TEST__.finishFrame()')
            data=await page.evaluate("window.__YARN_TEST__.renderer.domElement.toDataURL('image/png')")
            raw=base64.b64decode(data.split(',',1)[1]);path=ev/(name+'.png');path.write_bytes(raw)
            im=Image.open(path).convert('RGB');stat=ImageStat.Stat(im)
            assert max(stat.stddev)>5,(name,stat.stddev)
            report['captures'][name]={'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'size':list(im.size),'stddev':stat.stddev,'from':'actual_webgl_canvas'}
            print('CAPTURE',name,flush=True)
        try:
            await page.goto((root/'index.html').as_uri(),wait_until='load',timeout=60000)
            await page.wait_for_function('window.__YARN_TEST__ && window.__YARN_ATELIER__.ready',timeout=120000)
            report['initial']=await page.evaluate('window.__YARN_ATELIER__')
            assert report['initial']['yarns']==96 and report['initial']['generatedGeometry']
            assert report['initial']['contact']['maxResidualMm']<.0006
            for name in ['hero','macro','edge']:
                await page.locator('[data-view="'+name+'"]').click()
                await capture(name)
            for name in ['grazing','back','studio']:
                await page.locator('[data-light="'+name+'"]').click()
                await capture('light-'+name)
            report['checks']['threeCameraViewsAndThreeLights']=True
            await page.locator('[data-view="macro"]').click();await capture('fibers-on')
            await page.locator('#fibers').uncheck();await capture('fibers-off')
            assert report['captures']['fibers-on']['sha256']!=report['captures']['fibers-off']['sha256']
            await page.locator('#fibers').check();report['checks']['fiberToggleChangesPixels']=True
            for value in [.82,.98,.94]:
                await page.locator('#density').evaluate('(e,v)=>{e.value=v;e.dispatchEvent(new Event("change",{bubbles:true}));}',value)
                await page.wait_for_function('!window.__YARN_TEST__.isBusy()',timeout=120000)
                state=await page.evaluate('window.__YARN_ATELIER__')
                assert state['contact']['maxResidualMm']<.0006
                report['checks']['density'+str(value)]={'openFraction':state['openFraction'],'residualMm':state['contact']['maxResidualMm']}
            assert report['checks']['density0.82']['openFraction']>report['checks']['density0.98']['openFraction']
            await page.locator('#curved').uncheck();await page.wait_for_function('!window.__YARN_TEST__.isBusy()');await capture('flat')
            await page.locator('#curved').check();await page.wait_for_function('!window.__YARN_TEST__.isBusy()')
            await page.locator('[data-view="hero"]').click();await capture('final-hero')
            await page.screenshot(path=str(ev/'desktop-ui.png'),timeout=120000)
            async with page.expect_download() as d:await page.locator('#save').click()
            download=await d.value;await download.save_as(str(ev/'saved-recipe.json'))
            report['checks']['recipeDownload']=True
            await page.set_viewport_size({'width':390,'height':844});await page.locator('#reset').evaluate('e=>e.click()');await capture('mobile-canvas')
            await page.locator('#mobilePanel').click();assert await page.locator('body').evaluate('e=>e.classList.contains("panel-open")')
            await page.locator('[data-view="macro"]').click();await page.locator('#mobilePanel').click()
            await capture('mobile-macro');report['mobileViewport']={'width':390,'height':844,'realDevice':False,'overflow':await page.evaluate('document.documentElement.scrollWidth>innerWidth')}
            assert not report['mobileViewport']['overflow']
            await page.set_viewport_size({'width':720,'height':550})
            await page.locator('#mobilePanel').click()
            await page.evaluate('window.__YARN_TEST__.config.quality=.45')
            await page.locator('#trace').click()
            await page.wait_for_function('window.__YARN_ATELIER__.pathSamples>=6',timeout=300000)
            await page.evaluate('window.__YARN_TEST__.pauseTrace()')
            await capture('pathtraced',False);report['pathtraced']=await page.evaluate('window.__YARN_ATELIER__')
            report['checks']['realProgressivePathTracing']=report['pathtraced']['pathSamples']>=6
            assert not report['errors'] and not report['consoleErrors'],report
            assert not report['networkRequests'],report['networkRequests']
            report['browserExecuted']=True
        except Exception as e:
            report['fatal']=str(e)
            try:await capture('failure',False)
            except Exception as ce:report['captureError']=str(ce)
        finally:
            (ev/'report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False));print(json.dumps(report,ensure_ascii=False),flush=True)
            await browser.close()
        if report.get('fatal'):raise SystemExit(1)
asyncio.run(main())
