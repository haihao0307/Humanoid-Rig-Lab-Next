from __future__ import annotations

import base64
import hashlib
import io
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PART_DIR = Path(__file__).resolve().parent / "bootstrap" / "v442"
PARTS = ['archive.part01.b64', 'archive.part02.b64', 'archive.part03.b64', 'archive.part04.b64']
ARCHIVE_SHA256 = "14906f5a6ece08854df2d25a5eacc79f93e764e5c5b04b8a6ba73c806758cad4"
EXPECTED = ['cat-kaopu/tools/build_cat_v442_geometric_eyelid.py', 'cat-kaopu/tools/capture_cat_v442_browser_qa.mjs', 'cat-kaopu/tools/verify_cat_v442_module.py', '.github/workflows/cat-kaopu-v442-build.yml']

def main() -> None:
    encoded = "".join((PART_DIR / name).read_text(encoding="ascii").strip() for name in PARTS)
    payload = base64.b64decode(encoded, validate=True)
    actual = hashlib.sha256(payload).hexdigest()
    if actual != ARCHIVE_SHA256:
        raise RuntimeError(f"bootstrap archive checksum mismatch: {actual} != {ARCHIVE_SHA256}")
    with tarfile.open(fileobj=io.BytesIO(payload), mode="r:gz") as tf:
        members = [member for member in tf.getmembers() if member.isfile()]
        names = sorted(member.name for member in members)
        if names != sorted(EXPECTED):
            raise RuntimeError(f"unexpected bootstrap members: {names}")
        for member in members:
            target = (ROOT / member.name).resolve()
            if ROOT.resolve() not in target.parents:
                raise RuntimeError(f"unsafe bootstrap path: {member.name}")
        tf.extractall(ROOT, members=members, filter="data")
    for rel in EXPECTED:
        path = ROOT / rel
        if not path.is_file() or path.stat().st_size == 0:
            raise RuntimeError(f"missing decoded source: {rel}")
        print(f"decoded {rel} ({path.stat().st_size} bytes)")

if __name__ == "__main__":
    main()
