"""Validate the immutable public website using a clean browser and real controls."""
import asyncio,base64,hashlib,json,pathlib,sys
from playwright.async_api import async_playwright
from PIL import Image,ImageStat
info=json.loads(pathlib.Path(sys.argv[1]).read_text());out=pathlib.Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
report={'url':info['url'],'appCommit':info['commit'],'expectedHtmlSha256':info['htmlSha256'],'publicRender':False,'cinematicParity':False,'mobileRealDevice':False,'hostConfirmationRequired':False,'errors':[],'consoleErrors':[],'hostingErrors':[],'checks':{}}
async def run():
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        page=await browser.new_page(viewport={'width':1200,'height':850});page.set_default_timeout(120000)
        phase={'app':False}
        page.on('pageerror',lambda e:report['errors' if phase['app'] else 'hostingErrors'].append(str(e)))
        page.on('console',lambda m:report['consoleErrors' if phase['app'] else 'hostingErrors'].append(m.text) if m.type=='error' else None)
        async def capture(name,raster=True):
            if raster:await page.evaluate('window.__YARN_TEST__.finishFrame()')
            data=await page.evaluate("window.__YARN_TEST__.renderer.getContext().finish();window.__YARN_TEST__.renderer.domElement.toDataURL('image/png')")
            raw=base64.b64decode(data.split(',',1)[1]);path=out/(name+'.png');path.write_bytes(raw)
            im=Image.open(path).convert('RGB');sd=ImageStat.Stat(im).stddev;assert max(sd)>5,(name,sd)
            print('PUBLIC_CAPTURE',name,flush=True);return hashlib.sha256(raw).hexdigest()
        try:
            for attempt in range(4):
                response=await page.goto(info['url'],wait_until='domcontentloaded',timeout=120000)
                if await page.get_by_text('Open the page',exact=True).count():
                    report['hostConfirmationRequired']=True
                    async with page.expect_navigation(wait_until='domcontentloaded',timeout=120000) as nav:
                        await page.get_by_text('Open the page',exact=True).click()
                    response=await nav.value
                report['httpStatus']=response.status if response else None
                if response and response.status==200:
                    raw=await response.body();report['actualHtmlSha256']=hashlib.sha256(raw).hexdigest()
                    if report['actualHtmlSha256']==info['htmlSha256']:break
                await asyncio.sleep(8)
            assert report.get('actualHtmlSha256')==info['htmlSha256'],'Public endpoint did not serve the exact reviewed HTML'
            phase['app']=True
            await page.wait_for_function('window.__YARN_TEST__ && window.__YARN_ATELIER__.ready',timeout=120000)
            report['initial']=await page.evaluate('window.__YARN_ATELIER__')
            assert report['initial']['generatedGeometry'] and not report['initial']['usesOriginalCachedGeometry']
            assert report['initial']['yarns']==72 and not report['initial']['errors']
            report['checks']['renderedMeshes']=await page.evaluate('()=>{let n=0,t=0;window.__YARN_TEST__.scene.traverse(o=>{if(o.isMesh){n++;t+=(o.geometry.index?.count||0)/3;}});return {meshes:n,triangles:t};}')
            assert report['checks']['renderedMeshes']['triangles']>1000000
            hero=await capture('public-hero')
            before=await page.evaluate('window.__YARN_TEST__.camera.position.toArray()')
            await page.mouse.move(510,390);await page.mouse.down();await page.mouse.move(560,415,steps=5);await page.mouse.up()
            assert before!=await page.evaluate('window.__YARN_TEST__.camera.position.toArray()')
            moved=await capture('public-orbit');assert hero!=moved;report['checks']['mouseOrbitChangesPixels']=True
            await page.locator('[data-view="macro"]').click();macro=await capture('public-macro')
            await page.locator('#warpColor').evaluate('e=>{e.value="#865142";e.dispatchEvent(new Event("input",{bubbles:true}));}')
            recolored=await capture('public-color');assert recolored!=macro
            await page.locator('#warpColor').evaluate('e=>{e.value="#b7a888";e.dispatchEvent(new Event("input",{bubbles:true}));}')
            report['checks']['warpColorChangesPixels']=True
            await page.locator('[data-light="grazing"]').click();lit=await capture('public-grazing');assert lit!=macro
            await page.locator('[data-light="studio"]').click();await page.locator('[data-view="hero"]').click();await capture('public-default')
            await page.screenshot(path=str(out/'public-desktop-ui.png'),timeout=120000)
            await page.set_viewport_size({'width':390,'height':844});await page.wait_for_timeout(500)
            await page.wait_for_function('window.__YARN_TEST__.renderer.domElement.width===390')
            await page.locator('#mobilePanel').click();await page.locator('[data-view="hero"]').click();await page.locator('#mobilePanel').click()
            await capture('public-mobile-canvas');await page.screenshot(path=str(out/'public-mobile-ui.png'),timeout=120000)
            assert not await page.evaluate('document.documentElement.scrollWidth>innerWidth')
            report['checks']['mobileViewport']={'width':390,'height':844,'realDevice':False,'noHorizontalOverflow':True,'drawerOperated':True}
            await page.set_viewport_size({'width':720,'height':550});await page.wait_for_timeout(500)
            await page.locator('#mobilePanel').click();await page.locator('[data-view="macro"]').click();await page.locator('[data-quality="0.65"]').click();await page.locator('#trace').click()
            await page.wait_for_function('window.__YARN_ATELIER__.pathSamples>=3 || window.__YARN_ATELIER__.errors.length',timeout=360000)
            await page.evaluate('window.__YARN_TEST__.pauseTrace()');await capture('public-pathtrace',False)
            report['pathtraced']=await page.evaluate('window.__YARN_ATELIER__');assert report['pathtraced']['pathSamples']>=3
            report['checks']['realPublicPathTracing']=True
            assert not report['errors'] and not report['consoleErrors'] and not report['pathtraced']['errors'],report
            report['publicRender']=True
        except Exception as e:
            report['fatal']=repr(e)
            try:await page.screenshot(path=str(out/'public-failure.png'),timeout=30000)
            except Exception:pass
        finally:
            (out/'public-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print('PUBLIC_RESULT='+json.dumps(report,ensure_ascii=False),flush=True)
            await browser.close()
    if not report['publicRender']:raise SystemExit(1)
asyncio.run(run())
