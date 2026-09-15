#!/usr/bin/env python3
from __future__ import annotations
import hashlib, json, sys
from pathlib import Path
root=Path(__file__).resolve().parent
manifest=json.loads((root/'BUILD_MANIFEST.json').read_text(encoding='utf-8'))
errors=[]
for item in manifest['files']:
    p=root/item['path']
    if not p.is_file():
        errors.append({'path':item['path'],'error':'missing'})
        continue
    data=p.read_bytes()
    if len(data)!=item['bytes']:
        errors.append({'path':item['path'],'error':'size','expected':item['bytes'],'actual':len(data)})
    h=hashlib.sha256(data).hexdigest()
    if h!=item['sha256']:
        errors.append({'path':item['path'],'error':'sha256','expected':item['sha256'],'actual':h})
result={'passed':not errors,'manifest_files':len(manifest['files']),'errors':errors}
print(json.dumps(result,ensure_ascii=False,indent=2))
sys.exit(0 if result['passed'] else 1)
