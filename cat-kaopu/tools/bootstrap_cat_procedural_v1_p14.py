from __future__ import annotations

import base64
import lzma
import tarfile
from io import BytesIO
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CHUNK_DIR = ROOT / 'cat-kaopu/tools/bootstrap'
CHUNKS = [CHUNK_DIR / f'p14_sources.b64.{index:02d}' for index in range(6)]

missing_chunks = [str(path.relative_to(ROOT)) for path in CHUNKS if not path.is_file()]
if missing_chunks:
    raise SystemExit(f'P1.4 source chunks missing: {missing_chunks}')

encoded = ''.join(path.read_text(encoding='ascii').strip() for path in CHUNKS)
try:
    archive = base64.b64decode(encoded, validate=True)
    payload = lzma.decompress(archive)
except Exception as exc:
    raise SystemExit(f'P1.4 source archive decode failed: {exc}') from exc

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
