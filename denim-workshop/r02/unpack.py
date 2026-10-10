"""Reconstruct only the R02 authoring files from an integrity-checked bundle."""
from pathlib import Path
import base64,gzip,json,hashlib
root=Path(__file__).resolve().parent
bundle=json.loads(gzip.decompress(base64.b64decode(''.join(f.read_text().strip() for f in sorted((root/'_bundle').glob('part*.txt'))))))
allowed={'core.js','app.js','template.html','build.py','qa.mjs','test-core.cjs','README.md','SOURCES.md','TASK_ANCHOR.json','BUILD_MANIFEST.json','denim-material-profile.schema.json'}
assert set(bundle['files'])==allowed, 'Unexpected bundle path'
for name,text in bundle['files'].items():
 data=text.encode('utf-8');assert hashlib.sha256(data).hexdigest()==bundle['sha256'][name],name
 (root/name).write_bytes(data)
print('R02 source bundle verified and unpacked:', len(allowed),'files')
