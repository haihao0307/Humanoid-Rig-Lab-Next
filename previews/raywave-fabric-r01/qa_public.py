import asyncio, base64, gzip, hashlib, json, os, pathlib
from playwright.async_api import async_playwright
from PIL import Image, ImageStat

ROOT = pathlib.Path(__file__).parent
OUT = ROOT / 'qa-public'
OUT.mkdir(exist_ok=True)
APP_SHA = '1349c7ae02d1ee41e590a47353efd077a82ff230'
EXPECTED_SHA = '95a75a5f2d16658493831f86ffb84c800448ba25a82a025b158f30594d7e29f8'
URL = f'https://raw.githack.com/haihao0307/Humanoid-Rig-Lab-Next/{APP_SHA}/previews/raywave-fabric-r01/index.html'

encoded = ''.join(p.read_text().strip() for p in sorted((ROOT / 'chunks').glob('*.b64')))
raw = gzip.decompress(base64.b64decode(encoded))
actual_sha = hashlib.sha256(raw).hexdigest()
assert actual_sha == EXPECTED_SHA, f'payload SHA mismatch: {actual_sha}'

report = {
    'url': URL,
    'appCommit': APP_SHA,
    'qaCommit': os.environ.get('GITHUB_SHA'),
    'decodedBytes': len(raw),
    'decodedSha256': actual_sha,
    'contentIntegrity': True,
    'publicRender': False,
    'mobileIsViewportEmulation': True,
    'errors': [],
    'consoleErrors': [],
    'materials': [],
    'scenes': [],
    'modes': []
}

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        page = await browser.new_page(viewport={'width': 1440, 'height': 1000}, device_scale_factor=1)
        page.on('pageerror', lambda e: report['errors'].append(str(e)))
        page.on('console', lambda e: report['consoleErrors'].append(e.text) if e.type == 'error' else None)
        try:
            response = await page.goto(URL, wait_until='domcontentloaded', timeout=60000)
            report['httpStatus'] = response.status if response else None
            if await page.get_by_text('One more step', exact=True).count():
                report['hostConfirmationRequired'] = True
                await page.get_by_text('Open the page', exact=True).click()
            await page.wait_for_function('window.__RAYWAVE_READY__ === true', timeout=90000)
            await page.wait_for_function('window.__RAYWAVE_STATUS__ && window.__RAYWAVE_STATUS__.ready', timeout=30000)
            await page.wait_for_timeout(1200)
            report['renderer'] = await page.evaluate("document.getElementById('gl').getContext('webgl2').getParameter(7937)")
            report['initial'] = await page.evaluate('window.__RAYWAVE_STATUS__')
            assert report['initial']['webgl2'] and report['initial']['triangles'] == 50688
            canvas = page.locator('#gl')
            await canvas.screenshot(path=str(OUT / '01-satin-backlit.png'))
            im = Image.open(OUT / '01-satin-backlit.png').convert('RGB')
            report['canvasStdDev'] = ImageStat.Stat(im).stddev
            assert max(report['canvasStdDev']) > 8, 'canvas lacks visible variation'

            material_buttons = page.locator('[data-material]')
            for i in range(await material_buttons.count()):
                await material_buttons.nth(i).click()
                await page.wait_for_timeout(180)
                status = await page.evaluate('window.__RAYWAVE_STATUS__')
                report['materials'].append(status['material'])
            assert len(set(report['materials'])) == 6

            scene_buttons = page.locator('[data-scene]')
            for i in range(await scene_buttons.count()):
                await scene_buttons.nth(i).click()
                await page.wait_for_timeout(250)
                status = await page.evaluate('window.__RAYWAVE_STATUS__')
                report['scenes'].append(status['scene'])
            assert len(set(report['scenes'])) == 3

            mode_buttons = page.locator('[data-mode]')
            for i in range(await mode_buttons.count()):
                await mode_buttons.nth(i).click()
                await page.wait_for_timeout(180)
                status = await page.evaluate('window.__RAYWAVE_STATUS__')
                report['modes'].append(status['mode'])
            assert len(set(report['modes'])) == 3

            await page.locator('[data-material="1"]').click()
            await page.locator('[data-scene="0"]').click()
            await page.locator('[data-mode="1"]').click()
            await page.wait_for_timeout(700)
            await page.screenshot(path=str(OUT / '02-organza-ab-desktop.png'))
            assert await page.locator('#compareLabels').evaluate("e=>e.classList.contains('show')")

            await page.locator('#diffraction').evaluate("e=>{e.value='1.8';e.dispatchEvent(new Event('input',{bubbles:true}))}")
            assert await page.locator('#diffractionO').input_value() == '1.80'
            await page.locator('#pulse').click()
            await page.wait_for_timeout(400)
            report['controlsExecuted'] = True

            await page.set_viewport_size({'width': 390, 'height': 844})
            await page.locator('[data-mode="2"]').click()
            await page.locator('[data-material="2"]').click()
            await page.locator('[data-scene="2"]').click()
            await page.wait_for_timeout(700)
            await page.screenshot(path=str(OUT / '03-mobile-viewport.png'), full_page=True)
            report['mobileViewport'] = {
                'width': 390,
                'height': 844,
                'realDevice': False,
                'noHorizontalOverflow': await page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
            }
            assert report['mobileViewport']['noHorizontalOverflow']
            report['final'] = await page.evaluate('window.__RAYWAVE_STATUS__')
            report['publicRender'] = True
        except Exception as exc:
            report['fatal'] = str(exc)
            report['pageText'] = (await page.locator('body').inner_text())[:5000]
            await page.screenshot(path=str(OUT / 'failure.png'), full_page=True)
        finally:
            (OUT / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
            print('PUBLIC_QA_REPORT=' + json.dumps(report, ensure_ascii=False), flush=True)
            await browser.close()
        if not report['publicRender'] or report['errors'] or report['consoleErrors']:
            raise SystemExit(1)

asyncio.run(main())
