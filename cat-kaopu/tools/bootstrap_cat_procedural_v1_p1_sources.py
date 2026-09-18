from __future__ import annotations

import base64
import hashlib
import io
import lzma
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PART_DIR = ROOT / "cat-kaopu/tools/bootstrap"
PARTS = [PART_DIR / f"p1_authority_sources.part{i:02d}.b64" for i in range(6)]
EXPECTED_ARCHIVE_SHA256 = "36451a2da7fa0d5ba4b20f7a208453f7c8f577116ba690a992fa39e77fb4a3fe"

missing_parts = [str(path.relative_to(ROOT)) for path in PARTS if not path.is_file()]
if missing_parts:
    raise SystemExit(f"P1 source archive parts missing: {missing_parts}")

encoded = "".join(path.read_text(encoding="ascii").strip() for path in PARTS)
archive = base64.b64decode(encoded, validate=True)
actual = hashlib.sha256(archive).hexdigest()
if actual != EXPECTED_ARCHIVE_SHA256:
    raise SystemExit(f"P1 source archive digest mismatch: {actual}")

payload = lzma.decompress(archive)
with tarfile.open(fileobj=io.BytesIO(payload), mode="r:") as tf:
    members = tf.getmembers()
    root = ROOT.resolve()
    for member in members:
        target = (ROOT / member.name).resolve()
        if target != root and root not in target.parents:
            raise SystemExit(f"unsafe archive path: {member.name}")
        if member.issym() or member.islnk():
            raise SystemExit(f"links are not allowed: {member.name}")
    tf.extractall(ROOT)

expected = [
    ROOT / "cat-kaopu/procedural-cat-v1/index.html",
    ROOT / "cat-kaopu/procedural-cat-v1/src/cat-procedural-core.mjs",
    ROOT / "cat-kaopu/procedural-cat-v1/DEFAULT_GREY_TABBY_A.catdna.json",
    ROOT / "cat-kaopu/procedural-cat-v1/CAT_DNA_SCHEMA.json",
    ROOT / "cat-kaopu/procedural-cat-v1/P1_AUTHORITY_CALIBRATION.json",
    ROOT / "cat-kaopu/tools/validate_cat_procedural_v1_p1.mjs",
    ROOT / "cat-kaopu/tools/capture_cat_procedural_v1_p1.mjs",
]
missing = [str(path.relative_to(ROOT)) for path in expected if not path.is_file()]
if missing:
    raise SystemExit(f"P1 source bootstrap incomplete: {missing}")

print(f"decoded P1 authority-calibrated procedural cat sources; archive sha256={actual}")
