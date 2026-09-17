#!/usr/bin/env python3
"""Verify the Chicken R10.0 V7.1 browser technical gate without self-approving visuals."""
from __future__ import annotations

import json
from pathlib import Path

EXPECTED = {
    'weightingRevision': 'anatomical-neck-root-preserving-centerline-sweep-v7.1',
    'topologyRevision': 'torso-preserving-neck-root-split-v7.1',
    'centerlineCurveRevision': 'rotation-minimizing-frame-centerline-v2',
}

required = [
    Path('CHICKEN_V46_R10_0_SINGLE_AGENT.html'),
    Path('data/CHICKEN_R100_SINGLE_AGENT_PARAMETERS.json'),
    Path('qa/CHICKEN_R100_STATIC_QA.json'),
    Path('qa/CHICKEN_R100_CENTERLINE_V7_QA.json'),
    Path('qa/CHICKEN_R100_BROWSER_QA.json'),
    Path('BUILD_MANIFEST_R100.json'),
    Path('evidence/r100/R100_BEHAVIOR_REVIEW_BOARD.html'),
    Path('evidence/r100/R100_CENTERLINE_TORSO_ONLY.png'),
    Path('evidence/r100/R100_CENTERLINE_NECK_ONLY.png'),
    Path('evidence/r100/R100_CENTERLINE_BODY_AND_NECK.png'),
]
missing = [str(path) for path in required if not path.exists() or path.stat().st_size == 0]
if missing:
    raise SystemExit(f'Missing R10.0 V7.1 files: {missing}')

for path in [
    Path('qa/CHICKEN_R100_STATIC_QA.json'),
    Path('qa/CHICKEN_R100_CENTERLINE_V7_QA.json'),
    Path('qa/CHICKEN_R100_BROWSER_QA.json'),
]:
    data = json.loads(path.read_text(encoding='utf-8'))
    if not data.get('passed'):
        raise SystemExit(f'QA failed: {path}')

browser = json.loads(Path('qa/CHICKEN_R100_BROWSER_QA.json').read_text(encoding='utf-8'))
skin = browser.get('runtime', {}).get('motion', {}).get('skin', {})
for key, value in EXPECTED.items():
    if skin.get(key) != value:
        raise SystemExit(f'Unexpected {key}: {skin.get(key)!r}')
if skin.get('logicalBoneCount') != 21 or skin.get('skeletonBoneCount') != 22:
    raise SystemExit('V7.1 logical/helper bone accounting is wrong')
if skin.get('helperBoneCount') != 1:
    raise SystemExit('V7.1 must expose exactly one identity helper bone')

checks = browser.get('checks', {})
for name in [
    'independentNeckShell',
    'torsoNeckTopologySplit',
    'rigidRingAreaRetained',
    'centerlineLengthStableDuringPeck',
    'longitudinalStrainBounded',
    'peckBillGrounded',
    'footContactsGrounded',
    'rigInvariants',
]:
    if checks.get(name) is not True:
        raise SystemExit(f'Browser technical gate did not prove {name}')

peck_capture = next(
    (item for item in browser.get('captures', []) if item.get('requested') == 'peck'),
    None,
)
frame = (peck_capture or {}).get('frameAudit') or {}
if frame.get('longitudinalRatioP95', float('inf')) >= 2.25:
    raise SystemExit('V7.1 P95 longitudinal strain is still too high')
if frame.get('longitudinalRatioMax', float('inf')) >= 3.50:
    raise SystemExit('V7.1 maximum longitudinal strain is still too high')

boundary = browser.get('truthBoundary', {})
if boundary.get('groupTestAuthorized') is not False:
    raise SystemExit('Group testing must remain closed')
if boundary.get('manualVisualAcceptance') is not False:
    raise SystemExit('Browser QA must not self-approve visual quality')
if boundary.get('manualMotionNaturalnessAcceptance') is not False:
    raise SystemExit('Browser QA must not self-approve motion naturalness')

print('R10.0 V7.1 technical single-agent gate passed. Manual visual, naturalness, collision and group gates remain closed.')
