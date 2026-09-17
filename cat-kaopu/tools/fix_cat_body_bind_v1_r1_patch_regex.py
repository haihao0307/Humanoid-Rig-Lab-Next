from __future__ import annotations

from pathlib import Path

TARGET = Path(__file__).resolve().parent / "patch_cat_body_bind_v1_r1_anatomy.py"
text = TARGET.read_text(encoding="utf-8")
old = 're.subn(r"function bodySdf\\\\(x,y,z\\\\)\\\\{.*?return d;\\\\}", new_sdf, text, count=1, flags=re.S)'
new = 're.subn(r"function bodySdf\\(x,y,z\\)\\{.*?return d;\\s*\\}", new_sdf, text, count=1, flags=re.S)'
if old in text:
    TARGET.write_text(text.replace(old, new, 1), encoding="utf-8")
    print("repaired R1 bodySdf replacement regex")
elif new in text:
    print("R1 bodySdf replacement regex already repaired")
else:
    raise SystemExit("R1 regex marker missing")
