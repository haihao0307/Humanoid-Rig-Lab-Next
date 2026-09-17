from __future__ import annotations

import re
from pathlib import Path

TARGET = Path(__file__).resolve().parent / "patch_cat_body_bind_v1_r1_anatomy.py"
text = TARGET.read_text(encoding="utf-8")
pattern = re.compile(r'text, count = re\.subn\(r"[^"\n]*bodySdf[^"\n]*", new_sdf, text, count=1, flags=re\.S\)')
replacement = 'text, count = re.subn(r"function bodySdf\\(x,y,z\\)\\{.*?return d;\\s*\\}", new_sdf, text, count=1, flags=re.S)'
text, count = pattern.subn(lambda _: replacement, text, count=1)
if count != 1:
    if replacement in text:
        print("R1 bodySdf replacement pattern already repaired")
    else:
        raise SystemExit("R1 bodySdf replacement statement not found")
else:
    TARGET.write_text(text, encoding="utf-8")
    print("repaired R1 bodySdf replacement pattern")
