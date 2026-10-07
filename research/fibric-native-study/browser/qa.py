import asyncio,json,pathlib,os
from playwright.async_api import async_playwright
from PIL import Image,ImageStat
root=pathlib.Path('out').resolve()
report={'sourceCommit':os.environ.get('GITHUB_SHA'),'publicDelivery':False,'visualAcceptance':False,'errors':[],'consoleErrors':[],'networkRequests':[]}
async def main():
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        page=await browser.new_page(viewport={'width':1440,'height':1000})
        page.on('pageerror',lambda e:report['errors'].append(str(e)))
        page.on('console',lambda m:report['consoleErrors'].append(m.text) if m.type=='error' else None)
        page.on('request',lambda r:report['networkRequests'].append(r.url) if r.url.startswith('http') else None)
        try:
            await page.goto((root/'index.html').as_uri(),wait_until='load',timeout=60000)
            await page.wait_for_function('window.__YARN_ATELIER__?.ready || window.__YARN_ATELIER__?.errors.length',timeout=60000)
            report['initial']=await page.evaluate('window.__YARN_ATELIER__')
            assert report['initial']['ready'],report['initial']
            for name in ['hero','macro','edge']:
                await page.evaluate('(name)=>window.__YARN_TEST__.setView(name)',name)
                await page.wait_for_timeout(1200)
                await page.screenshot(path=str(root/'evidence'/f'{name}.png'))
            await page.evaluate("window.__YARN_TEST__.lighting('back')")
            await page.wait_for_timeout(1200)
            await page.screenshot(path=str(root/'evidence'/'back.png'))
            await page.evaluate("window.__YARN_TEST__.lighting('studio'); window.__YARN_TEST__.setView('macro')")
            await page.set_viewport_size({'width':960,'height':720})
            await page.evaluate('window.__YARN_TEST__.config.quality=.6')
            await page.locator('#trace').click()
            await page.wait_for_function('window.__YARN_ATELIER__.pathSamples>=6',timeout=240000)
            await page.screenshot(path=str(root/'evidence'/'pathtraced.png'))
            report['pathtraced']=await page.evaluate('window.__YARN_ATELIER__')
            await page.locator('#trace').click()
            await page.set_viewport_size({'width':390,'height':844})
            await page.evaluate("window.__YARN_TEST__.setView('hero')")
            await page.wait_for_timeout(1000)
            await page.screenshot(path=str(root/'evidence'/'mobile-viewport.png'))
            report['mobileViewport']={'width':390,'height':844,'realDevice':False,'overflow':await page.evaluate('document.documentElement.scrollWidth>innerWidth')}
            for name in ['hero','macro','edge','pathtraced']:
                im=Image.open(root/'evidence'/f'{name}.png').convert('RGB');stat=ImageStat.Stat(im)
                assert max(stat.stddev)>5
            assert not report['errors'] and not report['consoleErrors'],report
            assert report['networkRequests']==[],report['networkRequests']
            report['browserExecuted']=True
        except Exception as e:
            report['fatal']=str(e)
            await page.screenshot(path=str(root/'evidence'/'failure.png'))
        finally:
            (root/'evidence/report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False))
            print(json.dumps(report,ensure_ascii=False))
            await browser.close()
        if report.get('fatal'):raise SystemExit(1)
asyncio.run(main())
