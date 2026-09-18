from __future__ import annotations

import base64
import hashlib
import lzma
import tarfile
from io import BytesIO
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CHUNK_DIR = ROOT / 'cat-kaopu/tools/bootstrap'
CHUNKS = [CHUNK_DIR / f'p15_sources.part{i:02d}.b64' for i in range(7)]
EXPECTED_SHA256 = 'e5ecc0b2237d7c36a69bd009d8c31b6db5ecefd9f45aae7668b9d1d93f31dca8'

missing_chunks = [str(path.relative_to(ROOT)) for path in CHUNKS if not path.is_file()]
if missing_chunks:
    raise SystemExit(f'P1.5 source chunks missing: {missing_chunks}')

encoded = ''.join(path.read_text(encoding='ascii').strip() for path in CHUNKS)
try:
    payload = base64.b64decode(encoded, validate=True)
except Exception as exc:
    raise SystemExit(f'P1.5 base64 decode failed: {exc}') from exc

actual = hashlib.sha256(payload).hexdigest()
if actual != EXPECTED_SHA256:
    raise SystemExit(f'P1.5 source archive hash mismatch: {actual}')

try:
    raw = lzma.decompress(payload)
except lzma.LZMAError as exc:
    raise SystemExit(f'P1.5 source archive decode failed: {exc}') from exc

with tarfile.open(fileobj=BytesIO(raw), mode='r:') as tf:
    root = ROOT.resolve()
    members = tf.getmembers()
    for member in members:
        target = (ROOT / member.name).resolve()
        if target != root and root not in target.parents:
            raise SystemExit(f'unsafe archive path: {member.name}')
        if member.issym() or member.islnk():
            raise SystemExit(f'links are not allowed: {member.name}')
    tf.extractall(ROOT)

required = [
    ROOT / 'cat-kaopu/procedural-cat-v1/index.html',
    ROOT / 'cat-kaopu/procedural-cat-v1/DEFAULT_GREY_TABBY_A.catdna.json',
    ROOT / 'cat-kaopu/procedural-cat-v1/P1_5_NEUTRAL_STANCE_CANDIDATE.json',
    ROOT / 'cat-kaopu/procedural-cat-v1/src/cat-procedural-core.mjs',
    ROOT / 'cat-kaopu/tools/validate_cat_procedural_v1_p15.mjs',
    ROOT / 'cat-kaopu/tools/capture_cat_procedural_v1_p15.mjs',
]
missing = [str(path.relative_to(ROOT)) for path in required if not path.is_file()]
if missing:
    raise SystemExit(f'P1.5 bootstrap incomplete: {missing}')

print(f'decoded P1.5 neutral-stance sources from {len(CHUNKS)} verified chunks, sha256={actual}')
