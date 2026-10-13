"""Check the browser-tested manifest BEFORE creating any publication manifest.

Run after checkout, not just in the build workspace:
  python lighting/eb1/verify-deployment-files.py
Do not regenerate expected FILES.json from an incomplete checkout: that hides
missing ignored images. Public publishers must retain the original expected list.
"""
from pathlib import Path
import hashlib
import json
import subprocess
import sys

root = Path(__file__).resolve().parent / 'v1'
manifest = json.loads((root / 'FILES.json').read_text())
errors = []
for relative, expected in manifest.items():
    path = root / relative
    if path.resolve().is_relative_to(root.resolve()) is False:
        errors.append(f'Unsafe asset path: {relative}')
        continue
    if not path.is_file():
        errors.append(f'Missing asset: {relative}')
        continue
    if hashlib.sha256(path.read_bytes()).hexdigest() != expected:
        errors.append(f'Changed browser-tested bytes: {relative}')
    tracked = subprocess.run(['git', 'ls-files', '--error-unmatch', str(path)],
                             capture_output=True, text=True)
    if tracked.returncode:
        errors.append(f'Not committed (possibly ignored): {relative}')
if errors:
    print('\n'.join(errors), file=sys.stderr)
    raise SystemExit(1)
print(f'All {len(manifest)} browser-tested assets exist, are tracked and match SHA-256.')
