"""One-time reviewed source editing, not a build adapter.

The regular linker never imports or executes this directory. Outputs are committed
as readable canonical source before building/testing. Both before/after hashes are
fixed to the locally tested edit; no permission, branch-policy or browser bypass.
"""
from pathlib import Path
import hashlib,json,subprocess,sys
D=Path(__file__).resolve().parent;R=D.parent
record=json.loads((D/'S1B2_SOURCE_EDITS.json').read_text())
def valid(group):return all((R/p).is_file() and hashlib.sha256((R/p).read_bytes()).hexdigest()==h for p,h in record[group].items())
if valid('after'):
 print('Canonical S1B2 sources already match the reviewed edit.');sys.exit(0)
if not valid('before'):raise RuntimeError('Source drift before one-time edit; no source is written')
for name in ['s1b2-app.py','s1b2-build.py','s1b2-verify.py']:
 subprocess.run([sys.executable,str(D/name)],check=True)
if not valid('after'):raise RuntimeError('Edited source does not match tested output; do not commit')
print('All twelve canonical outputs match the exact locally verified source hashes.')
