from __future__ import annotations

import lzma
import tarfile
from io import BytesIO
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ARCHIVE = ROOT / 'cat-kaopu/tools/bootstrap/p14_sources.tar.xz'

if not ARCHIVE.is_file():
    raise SystemExit(f'P1.4 source archive missing: {ARCHIVE.relative_to(ROOT)}')

payload = lzma.decompress(ARCHIVE.read_bytes())
with tarfile.open(fileobj=BytesIO(payload), mode='r:') as tf:
    root = ROOT.resolve()
    members = tf.getmembers()
    for member in members:
        target = (ROOT / member.name).resolve()
        if target != root and root not in target.parents:
            raise SystemExit(f'unsafe archive path: {member.name}')
        if member.issym() or member.islnk():
            raise SystemExit(f'links are not allowed in P1.4 archive: {member.name}')
    tf.extractall(ROOT)

expected = [
    ROOT / 'cat-kaopu/procedural-cat-v1/P1_4_JOINT_CARRIER_CANDIDATE.json',
    ROOT / 'cat-kaopu/tools/patch_cat_procedural_v1_p14_joint_carrier.py',
    ROOT / 'cat-kaopu/tools/validate_cat_procedural_v1_p14.mjs',
    ROOT / 'cat-kaopu/tools/capture_cat_procedural_v1_p14.mjs',
]
missing = [str(path.relative_to(ROOT)) for path in expected if not path.is_file()]
if missing:
    raise SystemExit(f'P1.4 source bootstrap incomplete: {missing}')

print('decoded P1.4 candidate, patcher, validator and browser QA source')
