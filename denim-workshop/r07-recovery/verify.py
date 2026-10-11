"""Recovery verification, not a new material version or a film-grade approval.
Pins the actual R07 artifact saved after the user's failed chat screenshot.
No production files are modified. Screenshots are internal rendering evidence.
"""
from pathlib import Path
from datetime import datetime, timezone
import base64, hashlib, io, json, os, time, urllib.request
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'evidence'
OUT.mkdir(parents=True, exist_ok=True)
BUILD = 'fa143743b1b0f3d74ff827664d06ff119ef87063'
RAW = f'https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/{BUILD}/denim-workshop/r07/index.html'
PUBLIC = 'https://htmlpreview.github.io/?' + RAW
EXPECTED = 'da52a22edc0da2365d25791a46c20c5669cd5ce7df86b51372c7d79291dd2b5a'
ENTRY = ROOT.parent / 'r07/index.html'
REPORT = {'passed': False, 'startedAt': datetime.now(timezone.utc).isoformat(),
          'verificationCommit': os.environ.get('GITHUB_SHA'), 'recoveredBuild': BUILD,
          'publicUrl': PUBLIC, 'productionRuntimeChanged': False,
          'actualPhone': False, 'hardwareFPSVerified': False, 'userVisualApproval': False,
          'limits': ['Rendering and interaction verification, not film-grade certification',
                     'Software-rendered Chromium, not physical-device FPS',
                     'Mobile viewport simulation, not a physical phone',
                     'Existing R06/R07 motion comparison is reported separately, not invented here'],
          'modes': {}}


def fetch_locked_html():
    assert hashlib.sha256(ENTRY.read_bytes()).hexdigest() == EXPECTED, 'Local build differs from the recovered artifact'
    last_error = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(RAW, timeout=60) as response:
                data = response.read()
                assert response.status == 200
            assert hashlib.sha256(data).hexdigest() == EXPECTED, 'Public bytes differ from the tested build'
            REPORT['publicHtml'] = {'bytes': len(data), 'sha256': EXPECTED, 'status': 200}
            return
        except Exception as exc:
            last_error = exc
            time.sleep(3 * (attempt + 1))
    raise last_error


def capture(page, rows, name, save=False):
    q = page.evaluate('({version:__DENIM_WORKBENCH__.version, frame:__DENIM_WORKBENCH__.lastFrame, ready:__DENIM_WORKBENCH__.ready, lost:!!__DENIM_WORKBENCH__.contextLost, gl:__DENIM_WORKBENCH__.getGLError()})')
    assert q['version'] == 'R07.0' and q['ready'] and not q['lost'] and q['gl'] == 0, (name, q)
    assert q['frame']['projection'] == 'perspective' and not q['frame']['solidEdgeDrawn'], (name, q)
    raw = base64.b64decode(page.evaluate("document.getElementById('view').toDataURL('image/png').split(',')[1]"))
    im = np.asarray(Image.open(io.BytesIO(raw)).convert('RGB'))
    assert float(im.std()) > 2, (name, 'Blank rendering')
    assert q['frame']['natural']['finite'], (name, 'Nonfinite natural yarns')
    q.update(name=name, imageSha256=hashlib.sha256(raw).hexdigest(), pixelStd=float(im.std()))
    rows.append(q)
    if save:
        (OUT / (name + '.png')).write_bytes(raw)
    print(name, 'frame', q['frame']['frame'], 'far', q['frame']['farWeight'], 'samples', q['frame']['sampling']['msaaSamples'], flush=True)
    return q, raw


def action(page, rows, name, callback, save=False):
    previous = page.evaluate('__DENIM_WORKBENCH__.lastFrame.frame')
    callback()
    page.wait_for_function('(n)=>__DENIM_WORKBENCH__.lastFrame.frame>n || __DENIM_WORKBENCH__.contextLost', arg=previous)
    return capture(page, rows, name, save)


def check_network(events):
    assert not events['pageErrors'], events
    icon = 'https://htmlpreview.github.io/favicon.ico'
    assert not [e for e in events['httpErrors'] if not (e['url'] == icon and e['status'] == 404)], events
    assert not [e for e in events['consoleErrors'] if not (e['url'] == icon and '404' in e['text'])], events


try:
    fetch_locked_html()
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=False, args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        REPORT['browserVersion'] = browser.version
        for mode, width, height, url, mobile in [
            ('file-desktop', 1440, 1000, ENTRY.as_uri(), False),
            ('public-desktop', 1440, 1000, PUBLIC, False),
            ('public-mobile-viewport', 390, 844, PUBLIC, True),
        ]:
            ctx = browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=1, is_mobile=mobile, has_touch=mobile)
            page = ctx.new_page()
            page.set_default_timeout(180000)
            events = {'requests': [], 'pageErrors': [], 'consoleErrors': [], 'httpErrors': []}
            page.on('request', lambda r: events['requests'].append(r.url))
            page.on('pageerror', lambda e: events['pageErrors'].append(str(e)))
            page.on('console', lambda m: events['consoleErrors'].append({'text': m.text, 'url': m.location.get('url', '')}) if m.type == 'error' else None)
            page.on('response', lambda r: events['httpErrors'].append({'status': r.status, 'url': r.url}) if r.status >= 400 else None)
            rows = []
            REPORT['modes'][mode] = {'viewport': [width, height], 'states': rows, 'network': events}
            page.goto(url, wait_until='domcontentloaded', timeout=120000)
            page.wait_for_function('window.__DENIM_WORKBENCH__?.lastFrame || window.__DENIM_WORKBENCH__?.contextLost')
            q, _ = capture(page, rows, mode + '-default', True)
            assert q['frame']['sampling']['msaaSamples'] >= 2, 'Actual offscreen multisampling was not active'
            assert q['frame']['geometryOnly'], 'Default view silently substituted a carrier'
            rect = page.locator('#view').bounding_box()
            if mobile:
                assert rect['height'] > 200 and rect['y'] >= 0 and rect['y'] + rect['height'] <= height
            buttons = ['detail', 'back', 'front', 'showFray', 'rimReview', 'farReview'] if not mobile else ['detail', 'showFray', 'farReview']
            for button in buttons:
                q, _ = action(page, rows, mode + '-' + button, lambda key=button: page.locator('#' + key).click(), True)
                if button == 'showFray':
                    assert q['frame']['natural']['bridges'] > 0 and q['frame']['natural']['tails'] > 0
            q, _ = action(page, rows, mode + '-extreme-far-damage', lambda: page.evaluate('__DENIM_WORKBENCH__.setState({damage:4,zoom:.12,panX:0,panY:0})'), True)
            assert q['frame']['farWeight'] == 1 and q['frame']['natural']['bridges'] > 0
            if not mobile:
                for name, patch in [('oblique-detail', {'damage':0,'zoom':3.5,'yaw':-.9,'pitch':.48,'panX':-6,'panY':1}),
                                    ('oblique-far', {'zoom':.32,'yaw':.85,'pitch':.65,'panX':0,'panY':0}),
                                    ('near-restored', {'zoom':1.1,'yaw':-.23,'pitch':.34})]:
                    action(page, rows, mode + '-' + name, lambda s=patch: page.evaluate('(s)=>__DENIM_WORKBENCH__.setState(s)', s), True)
                page.locator('#stage').scroll_into_view_if_needed()
                rect = page.locator('#view').bounding_box()
                x, y = rect['x'] + rect['width'] * .5, rect['y'] + rect['height'] * .5
                old_yaw = page.evaluate('__DENIM_WORKBENCH__.state.yaw')
                def orbit():
                    page.mouse.move(x, y)
                    page.mouse.down()
                    page.mouse.move(x + 32, y + 18, steps=4)
                    page.mouse.up()
                action(page, rows, mode + '-pointer-orbit', orbit)
                assert page.evaluate('__DENIM_WORKBENCH__.state.yaw') != old_yaw
                old_zoom = page.evaluate('__DENIM_WORKBENCH__.state.zoom')
                action(page, rows, mode + '-wheel-zoom', lambda: page.mouse.wheel(0, 110))
                assert page.evaluate('__DENIM_WORKBENCH__.state.zoom') < old_zoom
                with page.expect_download() as downloaded:
                    page.locator('#save').click()
                profile_path = OUT / (mode + '-profile.json')
                downloaded.value.save_as(str(profile_path))
                profile = json.loads(profile_path.read_text())
                assert profile['schema'] == 'kaopu.denim_material_profile@2.5'
                assert profile['limits']['filmGradeValidated'] is False
                REPORT['modes'][mode]['exportSchema'] = profile['schema']
            page.wait_for_timeout(400)
            first_frame = page.evaluate('__DENIM_WORKBENCH__.lastFrame.frame')
            page.wait_for_timeout(600)
            assert page.evaluate('__DENIM_WORKBENCH__.lastFrame.frame') == first_frame, 'Idle renderer kept running'
            q, raw0 = capture(page, rows, mode + '-static-before')
            q, raw1 = action(page, rows, mode + '-static-repeat', lambda: page.evaluate('__DENIM_WORKBENCH__.setState({})'))
            assert raw0 == raw1, 'Same state is not deterministic'
            REPORT['modes'][mode]['identicalStatePixelRepeat'] = True
            check_network(events)
            if mode.startswith('file'):
                assert not [r for r in events['requests'] if r.startswith('http')], 'Standalone file requested network assets'
            page.screenshot(path=str(OUT / (mode + '-layout.png')))
            ctx.close()
        browser.close()
    REPORT['passed'] = True
finally:
    REPORT['finishedAt'] = datetime.now(timezone.utc).isoformat()
    (OUT / 'recovery-qa.json').write_text(json.dumps(REPORT, ensure_ascii=False, indent=2))
