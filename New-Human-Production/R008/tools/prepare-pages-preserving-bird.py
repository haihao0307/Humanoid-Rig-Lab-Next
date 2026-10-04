"""Compare every existing R014 published file byte-for-byte before any deploy."""
from pathlib import Path
import sys,urllib.request,concurrent.futures,hashlib,shutil,json
source,destination=map(Path,sys.argv[1:3]);base='https://haihao0307.github.io/Humanoid-Rig-Lab-Next/'
files=[p for p in source.rglob('*') if p.is_file()]
assert files and (source/'index.html').is_file()
def check(p):
 rel=p.relative_to(source).as_posix();url=base+urllib.parse.quote(rel)
 with urllib.request.urlopen(url,timeout=60) as response: data=response.read()
 expected=p.read_bytes()
 if data!=expected: raise RuntimeError('Existing Pages asset differs from frozen source; refusing replacement: '+rel)
 return {'path':rel,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool: verified=list(pool.map(check,files))
if destination.exists():raise RuntimeError('Destination must be fresh; refusing to erase another artifact')
shutil.copytree(source,destination)
Path('preserved-pages-report.json').write_text(json.dumps({'sourceCommit':'d4bfd674f4aaad711dd7c99c076013b8f59e2a9b','publicBase':base,'verified':verified},indent=2))
print(json.dumps({'allExistingFilesByteIdentical':True,'files':len(verified),'bytes':sum(v['bytes']for v in verified)}))
