from __future__ import annotations

import base64
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASELINE = ROOT / 'baselines/v4.44/CAT_KAOPU_V444_CONTINUOUS_PERIORBITAL_WORKBENCH_2026-09-16.html'
CURRENT = ROOT / 'workbench/CAT_KAOPU_CURRENT.html'
TECH = ROOT / 'qa/CAT_KAOPU_V445_TECHNICAL_QA_2026-09-16.json'


def payload(text: str) -> bytes:
    m = re.search(r"const CAT_B64='([^']+)'", text)
    if not m:
        raise SystemExit('CAT_B64 missing')
    return base64.b64decode(m.group(1))


def json_const(text: str, name: str, next_name: str) -> dict:
    a = text.index(f'const {name}=') + len(f'const {name}=')
    b = text.index(f';\nconst {next_name}=', a)
    return json.loads(text[a:b])


def main() -> None:
    source = BASELINE.read_text(encoding='utf-8')
    output = CURRENT.read_text(encoding='utf-8')
    source_payload, output_payload = payload(source), payload(output)
    source_rig = json_const(source, 'RIG', 'LIB')
    output_rig = json_const(output, 'RIG', 'LIB')
    checks = {
        'payloadByteIdentical': source_payload == output_payload,
        'payloadSha256': hashlib.sha256(output_payload).hexdigest(),
        'rigJsonIdentical': source_rig == output_rig,
        'boneCount': len(output_rig.get('bones', [])),
        'readyApi': '__CAT_V445_READY__' in output,
        'statsApi': '__CAT_V445_STATS__' in output,
        'geometryApi': '__CAT_V445_PERIORBITAL_GEOMETRY__' in output,
        'mlsBuilder': 'function buildSmoothPeriorbital' in output,
        'mlsSolver': 'function mlsFace' in output and 'function solve(A,b)' in output,
        'frozenBoundary': "fitMode:'quadratic_mls_lowpass_c1_frozen_boundary'" in output,
        'highResolution': 'const segments=96,rings=14' in output,
        'c1Weight': 'float smoother(float x)' in output,
        'upperLidArc': 'uArcStrength' in output,
        'opaqueSkinPass': 'gl.enable(gl.POLYGON_OFFSET_FILL)' in output,
        'noExternalModel': 'externalModel:false' in output,
        'noExternalTexture': 'externalTexture:false' in output,
        'noExternalAnimation': 'externalAnimation:false' in output,
        'legacyNamespaceRemoved': '__CAT_V444_' not in output,
    }
    failures = [k for k,v in checks.items() if (k != 'boneCount' and k != 'payloadSha256' and v is not True)]
    if checks['boneCount'] != 34:
        failures.append('boneCount')
    if failures:
        raise SystemExit('V4.45 verification failed: ' + ', '.join(failures))
    if TECH.exists():
        report = json.loads(TECH.read_text(encoding='utf-8'))
        if not report.get('payloadByteIdentical') or not report.get('rigJsonIdentical'):
            raise SystemExit('technical QA invariant report failed')
    print(json.dumps({'version':'V4.45','checks':checks,'visualAcceptance':False,'productionReady':False}, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
