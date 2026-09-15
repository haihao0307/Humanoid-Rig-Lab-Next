from __future__ import annotations
import base64
import hashlib
import json
import re
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CURRENT = json.loads((ROOT / 'CURRENT.json').read_text(encoding='utf-8'))
HTML = ROOT / 'workbench/CAT_KAOPU_CURRENT.html'
BIN = ROOT / 'runtime/cat_v440.bin'

errors = []
if CURRENT.get('currentVersion') != 'V4.40':
    errors.append('CURRENT.json currentVersion is not V4.40')
if not HTML.exists():
    errors.append('current HTML missing')
if not BIN.exists():
    errors.append('runtime binary missing')

if HTML.exists() and BIN.exists():
    text = HTML.read_text(encoding='utf-8')
    m = re.search(r"const CAT_B64='([^']+)'", text)
    if not m:
        errors.append('CAT_B64 not found in HTML')
    else:
        embedded = base64.b64decode(m.group(1))
        external = BIN.read_bytes()
        if embedded != external:
            errors.append('embedded payload differs from runtime/cat_v440.bin')
        if embedded[:7] != b'CATV440':
            errors.append(f'payload magic is {embedded[:7]!r}, expected CATV440')
        if len(embedded) >= 28:
            bone_count = struct.unpack_from('<I', embedded, 24)[0]
            if bone_count != 34:
                errors.append(f'bone count {bone_count}, expected 34')

for forbidden in ['http://', 'https://']:
    if HTML.exists() and forbidden in HTML.read_text(encoding='utf-8'):
        errors.append(f'external URL marker found in HTML: {forbidden}')

if errors:
    print('FAIL')
    for e in errors:
        print('-', e)
    sys.exit(1)
print('PASS')
print('version:', CURRENT['currentVersion'])
print('html sha256:', hashlib.sha256(HTML.read_bytes()).hexdigest())
print('bin sha256:', hashlib.sha256(BIN.read_bytes()).hexdigest())
