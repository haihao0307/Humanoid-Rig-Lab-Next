"""One-time locked source expansion. Thereafter edit canonical files, use build.py."""
from pathlib import Path
import base64,gzip,hashlib,json,shutil,subprocess,sys
p=Path(__file__).resolve().parent;old=p.parent/'r14'
lock=json.loads((p/'SOURCE_LOCK.json').read_text())
def sha(b):return hashlib.sha256(b).hexdigest()
assert sha((old/'index.html').read_bytes())==lock['parentHtmlSha256'],'R14 baseline differs'
if (p/'app.js').exists():raise SystemExit('Canonical R15 already exists; do not overwrite it with this one-time expansion.')
encoded=''.join((p/f'source.delta.{i}.b64').read_text().strip() for i in [1,2])
packed=base64.b64decode(encoded,validate=True);assert sha(packed)==lock['payloadSha256']
sources=json.loads(gzip.decompress(packed));assert set(sources)==set(lock['authored'])
for f in old.glob('*.js'):shutil.copy2(f,p/f.name)
for name in ['template.html','build.py','LICENSE','THIRD_PARTY_NOTICES.md']:shutil.copy2(old/name,p/name)
for name,text in sources.items():
    assert Path(name).name==name and sha(text.encode())==lock['authored'][name],name
    (p/name).write_text(text)
subprocess.run([sys.executable,str(p/'derive-r15.py')],check=True)
for name,want in (lock['canonical']|lock['otherCanonical']).items():assert sha((p/name).read_bytes())==want,name
print('R15 canonical authored source verified. R14 reference untouched.')
