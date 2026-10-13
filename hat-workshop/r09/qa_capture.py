"""Capture real browser pixels, retaining slow/fallback evidence instead of dropping screenshots.
No source scene, camera, resolution, material or test assertions are changed.
"""
from pathlib import Path
import base64, io, signal, time
from PIL import Image, ImageStat


def capture_page(page, *, path, report):
    start = time.perf_counter()
    record = {'path': Path(path).name, 'method': 'playwright', 'firstAttemptError': None}
    before = page.evaluate('({ready:hatLab.ready(),hat:hatLab.metrics().hat,hash:hatLab.geometryHash(),errors:hatLab.issues()})')
    if not before['ready']:
        raise AssertionError('Cannot capture a not-ready workbench')
    try:
        data = page.screenshot(timeout=15000, animations='disabled')
    except Exception as exc:
        record['firstAttemptError'] = str(exc)
        record['method'] = 'same-page-cdp-compositor'
        # Verify the SAME running document still responds; do not reload it to hide a crash.
        after = page.evaluate('({ready:hatLab.ready(),hat:hatLab.metrics().hat,hash:hatLab.geometryHash()})')
        if not after['ready'] or (after['hat'], after['hash']) != (before['hat'], before['hash']):
            raise AssertionError('Screenshot failure coincided with lost or changed workbench state')
        session = page.context.new_cdp_session(page)
        def timed_out(signum, frame):
            raise TimeoutError('Same-page compositor capture exceeded 25 seconds')
        prior = signal.signal(signal.SIGALRM, timed_out)
        signal.alarm(25)
        try:
            result = session.send('Page.captureScreenshot', {'format':'png','fromSurface':True,'captureBeyondViewport':False})
            data = base64.b64decode(result['data'])
        finally:
            signal.alarm(0)
            signal.signal(signal.SIGALRM, prior)
            session.detach()
    image = Image.open(io.BytesIO(data)).convert('RGB')
    variance = sum(ImageStat.Stat(image).var)
    if min(image.size) < 100 or variance < 20:
        raise AssertionError('Empty or implausibly flat browser screenshot')
    Path(path).write_bytes(data)
    record.update(elapsedMS=(time.perf_counter()-start)*1000, width=image.width, height=image.height,
                  pixelVariance=variance, hat=before['hat'], geometryHash=before['hash'])
    report.setdefault('captures', []).append(record)
    return data
