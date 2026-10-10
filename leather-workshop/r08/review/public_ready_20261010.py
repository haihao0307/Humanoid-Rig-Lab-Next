"""Apply the bounded public-bootstrap repair to the authoritative QA source.

The preview host loads before it inserts the atelier DOM. A missing #error at
that moment is a waiting state, not an application exception or a successful
startup. No rendering, thickness, motion, craft, or error assertion is removed.
"""
from pathlib import Path
import hashlib

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / 'qa-release.py'
source = path.read_text()
old = "window.LEATHER_ATELIER?.ready || !document.getElementById('error').hidden"
new = "window.LEATHER_ATELIER?.ready || Boolean(document.getElementById('error') && !document.getElementById('error').hidden)"
if old in source:
    assert source.count(old) == 1, 'Ambiguous readiness predicate; stop.'
    source = source.replace(old, new)
else:
    assert new in source, 'Readiness source drift; stop.'

marker = "  snap=page.evaluate('LEATHER_ATELIER.snapshot()');report['initial']=snap"
replacement = marker + "\n  expected_source=os.environ.get('R08_EXPECTED_SOURCE_SHA')\n  if expected_source:check('rendered runtime source matches the immutable candidate',snap['sourceCommit']==expected_source,{'expected':expected_source,'actual':snap['sourceCommit']})"
if replacement not in source:
    assert source.count(marker) == 1, 'Runtime identity hook drift; stop.'
    source = source.replace(marker, replacement)

compile(source, str(path), 'exec')
path.write_text(source)
print('Fixed readiness waiting state; retained all geometry and application-error gates.')
print('QA source SHA-256:', hashlib.sha256(source.encode()).hexdigest())
