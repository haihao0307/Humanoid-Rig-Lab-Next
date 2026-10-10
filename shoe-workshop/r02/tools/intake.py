"""Fetch only immutable declared originals. Validate bytes BEFORE using them."""
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.parse import quote
import json,hashlib,shutil
R=Path(__file__).resolve().parents[1]
lock=json.loads((R/'SOURCES_LOCK.json').read_text())
for f in lock['files']:
 p=R/f['destination'];p.parent.mkdir(parents=True,exist_ok=True)
 if p.exists():b=p.read_bytes()
 else:
  url=f"https://raw.githubusercontent.com/{f['repo']}/{f['commit']}/"+quote(f['path'])
  b=urlopen(Request(url,headers={'User-Agent':'KAOPU-pinned-source-study'}),timeout=120).read()
 if len(b)!=f['bytes'] or hashlib.sha256(b).hexdigest()!=f['sha256']:raise ValueError('Source hash mismatch: '+f['path'])
 p.write_bytes(b)
 print('VERIFIED',f['destination'],len(b))
shutil.copyfile(R/'source/teacher/LICENSE',R/'licenses/GPL-3.0.txt')
