from __future__ import annotations

import base64
import lzma
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PAYLOAD_ROOT = ROOT / "bootstrap" / "v445"
FILES = (
    "build_cat_v445_mls_periorbital.py",
    "verify_cat_v445_module.py",
    "capture_cat_v445_browser_qa.mjs",
)

for name in FILES:
    source = PAYLOAD_ROOT / f"{name}.xz.b64"
    target = ROOT / name
    if not source.exists():
        raise SystemExit(f"missing V4.45 source payload: {source}")
    encoded = "".join(source.read_text(encoding="utf-8").split())
    data = lzma.decompress(base64.b64decode(encoded))
    target.write_bytes(data)
    print(f"decoded {name}: {len(data)} bytes")
