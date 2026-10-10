"""Bootstrap only the exact locally tested R03 authoring files."""
from pathlib import Path
import base64,gzip,json,hashlib
root=Path(__file__).resolve().parent
encoded=''.join(p.read_text().strip() for p in sorted((root/'_source').glob('*.txt')))
data=base64.b64decode(encoded,validate=True)
assert hashlib.sha256(data).hexdigest()=='5009c9f7013887d3b86d1fc7b2b595ac4b487b8cb247877b7fd16c4fbc822bb8','Source transport mismatch'
bundle=json.loads(gzip.decompress(data))
allowed={'core.js','app.js','template.html','build.py','test-core.cjs','qa.py','README.md','SOURCES.md','TASK_ANCHOR.json'}
assert set(bundle['files'])==allowed
for name,text in bundle['files'].items():
 data=text.encode('utf-8')
 assert hashlib.sha256(data).hexdigest()==bundle['sha256'][name], name
 (root/name).write_bytes(data)
print('Verified and unpacked R03 source:',len(allowed),'files')
