"""Idempotent recovery of the interrupted R09 verification; never rewrites runtime sources."""
from pathlib import Path
import json
R = Path(__file__).resolve().parent
for name, pairs in {
    'qa-browser.py': [('page.screenshot(path=', 'capture_page(page, report=report, path=')],
    'qa-r09.py': [('p.screenshot(path=', 'capture_page(p, report=report, path=')],
}.items():
    path = R/name
    text = path.read_text()
    if 'from qa_capture import capture_page' not in text:
        text = 'from qa_capture import capture_page\n' + text
    for old, new in pairs:
        text = text.replace(old, new)
    path.write_text(text)
(R/'RECOVERY.json').write_text(json.dumps({
    'version':'HAT-R09.0',
    'recoveredFrom':'a16987bbd17bb0a4b66a1f587e47f8a956bc8d40',
    'previousRun':38359565004,
    'previousFailure':'Page.screenshot timeout after 108 passing browser checks; no application exception recorded',
    'runtimeReplaced':False,
    'oldVersionsModified':False,
    'samePageScreenshotRequired':True,
    'acceptancePolicy':'Rerun original worker, unit, browser and complete-directory tests plus independent fixed-public verification; fail on lost state, blank capture or failed assertions. No passed flag prefilled.',
    'status':'verification-pending'
},ensure_ascii=False,indent=2))
print('R09 verification recovery prepared; runtime and original geometry untouched',flush=True)
