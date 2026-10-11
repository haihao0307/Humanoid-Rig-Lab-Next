"""One-time source transport, not a runtime dependency. All bytes are hash verified."""
from pathlib import Path
import base64, gzip, hashlib, json
R=Path(__file__).resolve().parents[1]
REPO=R.parents[1]
expected={'src/main.mjs','src/model.mjs','src/materials.mjs','src/sewing.mjs','tools/prepare.mjs','tools/build.mjs','tests/kernel.mjs','tests/browser.mjs','style.css','.gitignore','README.md','docs/RESEARCH.md'}
if (R/'src/main.mjs').exists():
    print('Readable production source already exists; source transport is not replayed.')
    raise SystemExit(0)
s=''.join((R/'source-transfer'/f'{n:02d}.b64').read_text().strip() for n in range(3))
# Correct known text-channel transport typos; the immutable decoded SHA below remains authoritative.
rep=[('GNNwZnr/buScn','GNNwZnr/bu/pScn'),('05OpuWpuW/G','05OpuW/G'),('TY5ea3ea3Y4','TY5ea3Y4'),('Mft+ft+5UD','Mft+5UD'),('ZdDB1+uUbnz0','ZdDB1+vbnz0'),('dnj/Y/PjRae3','dnj/Y/PjcjRae3')]
for a,b in rep:
    if a in s:s=s.replace(a,b)
corrections=R/'source-transfer/corrections.json'
if corrections.exists():
    for a,b in json.loads(corrections.read_text()):
        if s.count(a)!=1:raise ValueError('Ambiguous transport correction')
        s=s.replace(a,b)
raw=gzip.decompress(base64.b64decode(s,validate=True))
if hashlib.sha256(raw).hexdigest()!='90396cdbffe35fb9247b7dcb6103010c4c5cfb0ba7eb7147d13b55c99d39af61':raise ValueError('Source transport SHA mismatch')
entries=json.loads(raw)
if set(entries)!=expected:raise ValueError('Unexpected source paths')
outputs={}
for name,entry in entries.items():
    if 'text' in entry:text=entry['text']
    else:
        base=entry['base']
        if base!='shoe-workshop/r03b/'+name:raise ValueError('Unexpected inherited source')
        text=(REPO/base).read_text()
        if hashlib.sha256(text.encode()).hexdigest()!=entry['baseSHA256']:raise ValueError('Inherited source changed')
        for i,j,replacement in reversed(entry['patches']):
            if not 0<=i<=j<=len(text):raise ValueError('Invalid source splice')
            text=text[:i]+replacement+text[j:]
    if hashlib.sha256(text.encode()).hexdigest()!=entry['sha256']:raise ValueError('Restored source SHA mismatch '+name)
    outputs[name]=text
for name,text in outputs.items():
    p=R/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text)
print('Restored',len(outputs),'hash-verified readable source files, only inside shoe-workshop/r04.')
