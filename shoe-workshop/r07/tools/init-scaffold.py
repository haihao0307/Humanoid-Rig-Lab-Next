"""One-time source adaptation; existing readable source ALWAYS wins on later runs."""
from pathlib import Path
import json, hashlib
root=Path(__file__).resolve().parents[1]
for name,item in json.loads((root/'tools/scaffold.json').read_text()).items():
    dst=(root/name).resolve()
    if not dst.is_relative_to(root): raise ValueError('Invalid output path')
    if dst.exists(): continue
    src=(root.parent/item['base']).resolve()
    if not src.is_relative_to(root.parent): raise ValueError('Invalid input path')
    text=src.read_text()
    assert hashlib.sha256(text.encode()).hexdigest()==item['baseSha256'], name
    for a,b,new in reversed(item['edits']): text=text[:a]+new+text[b:]
    assert hashlib.sha256(text.encode()).hexdigest()==item['sha256'], name
    dst.parent.mkdir(parents=True,exist_ok=True); dst.write_text(text)
    print('Initialized readable source',name)
