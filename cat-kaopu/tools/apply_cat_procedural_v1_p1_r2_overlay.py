from __future__ import annotations

import base64
import hashlib
import io
import lzma
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PART_DIR = ROOT / "cat-kaopu/tools/bootstrap"
PARTS = [PART_DIR / f"p1_r2_shape_overlay.part{i:02d}.b64" for i in range(3)]
EXPECTED_SHA256 = "63a4abca26034d5dd7067be4cfc1af9e4d703c11a0ade504293d80897ebc3e13"

missing = [str(path.relative_to(ROOT)) for path in PARTS if not path.is_file()]
if missing:
    raise SystemExit(f"P1 R2 overlay parts missing: {missing}")

encoded = "".join(path.read_text(encoding="ascii").strip() for path in PARTS)
archive = base64.b64decode(encoded, validate=True)
actual = hashlib.sha256(archive).hexdigest()
if actual != EXPECTED_SHA256:
    raise SystemExit(f"P1 R2 overlay digest mismatch: {actual}")

payload = lzma.decompress(archive)
with tarfile.open(fileobj=io.BytesIO(payload), mode="r:") as tf:
    members = tf.getmembers()
    root = ROOT.resolve()
    for member in members:
        target = (ROOT / member.name).resolve()
        if target != root and root not in target.parents:
            raise SystemExit(f"unsafe overlay path: {member.name}")
        if member.issym() or member.islnk():
            raise SystemExit(f"links are not allowed: {member.name}")
    tf.extractall(ROOT)

print(f"applied P1 R2 feline shape overlay; sha256={actual}")
