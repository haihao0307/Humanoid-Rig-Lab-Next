from __future__ import annotations

import lzma
import tarfile
from io import BytesIO
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ARCHIVE = ROOT / "cat-kaopu/tools/bootstrap/v446_sources.tar.xz"

if not ARCHIVE.is_file():
    raise SystemExit(f"V4.46 source archive missing: {ARCHIVE.relative_to(ROOT)}")

payload = lzma.decompress(ARCHIVE.read_bytes())
with tarfile.open(fileobj=BytesIO(payload), mode="r:") as tf:
    members = tf.getmembers()
    root = ROOT.resolve()
    for member in members:
        target = (ROOT / member.name).resolve()
        if target != root and root not in target.parents:
            raise SystemExit(f"unsafe archive path: {member.name}")
        if member.issym() or member.islnk():
            raise SystemExit(f"links are not allowed in V4.46 archive: {member.name}")
    tf.extractall(ROOT)

expected = [
    ROOT / "cat-kaopu/tools/build_cat_v446_wide_eye_region.py",
    ROOT / "cat-kaopu/tools/verify_cat_v446_module.py",
    ROOT / "cat-kaopu/tools/capture_cat_v446_browser_qa.mjs",
]
missing = [str(path.relative_to(ROOT)) for path in expected if not path.is_file()]
if missing:
    raise SystemExit(f"V4.46 source bootstrap incomplete: {missing}")

print("decoded V4.46 builder, verifier and browser QA sources")
