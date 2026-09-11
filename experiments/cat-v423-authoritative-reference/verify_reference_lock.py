#!/usr/bin/env python3
from __future__ import annotations

import json
import py_compile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LOCK = ROOT / 'CAT_AUTHORITATIVE_FULL_BODY_REFERENCE_LOCK_V423.kaopu.json'
HTML = ROOT / 'CAT_KAOPU_V423_AUTHORITATIVE_REFERENCE_WORKBENCH.html'
INTAKE = ROOT / 'intake_reference.py'
POLICY = ROOT / 'CAT_REFERENCE_USE_POLICY_V423.md'

checks = []

def check(name: str, condition: bool) -> None:
    checks.append({'name': name, 'ok': bool(condition)})

for path in (LOCK, HTML, INTAKE, POLICY):
    check(f'exists:{path.name}', path.is_file())

lock = json.loads(LOCK.read_text(encoding='utf-8'))
primary = lock['primaryReference']
check('primary-selected', lock['selectionStatus'] == 'primary-reference-selected')
check('species-felis-catus', primary['species'] == 'Felis catus')
check('model-uid-locked', primary['modelUid'] == '7c99ca836d834c39872ecf5e9b5e2087')
check('veterinary-provenance', 'Royal (Dick) School of Veterinary Studies' in primary['department'])
check('license-declared-cc-by', primary['licenseShortId'] == 'CC-BY')
check('source-not-redistributed', primary['sourceAssetRedistributedInThisPackage'] is False)
check('runtime-independent', primary['runtimeDependency'] is False)
check('ingest-status-honest', primary['sourceGeometryIngested'] is False)
check('whole-body-acceptance-false', lock['productionPolicy']['oneToOneWholeBodyAccepted'] is False)
html = HTML.read_text(encoding='utf-8')
check('viewer-uid-present', primary['modelUid'] in html)
check('local-file-input-present', 'type="file"' in html)
check('browser-sha256-present', 'crypto.subtle.digest' in html)

try:
    py_compile.compile(str(INTAKE), doraise=True)
    check('intake-python-compile', True)
except Exception:
    check('intake-python-compile', False)

result = {
    'schema': 'kaopu.qa/1.0',
    'revision': 'v4.23-reference-lock-r1',
    'passed': sum(1 for item in checks if item['ok']),
    'total': len(checks),
    'allPassed': all(item['ok'] for item in checks),
    'checks': checks
}
print(json.dumps(result, ensure_ascii=False, indent=2))
raise SystemExit(0 if result['allPassed'] else 1)
