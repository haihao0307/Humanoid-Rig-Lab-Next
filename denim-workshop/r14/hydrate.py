"""One-time locked source reconstruction; final browser fix is separately locked."""
from pathlib import Path
import gzip,hashlib,json,subprocess,sys
P=Path(__file__).resolve().parent
parent=P.parent/'r13'
lock=json.loads((P/'SOURCE_LOCK.json').read_text(encoding='utf-8'))
hash256=lambda data:hashlib.sha256(data).hexdigest()
assert hash256((parent/'index.html').read_bytes())==lock['parentHtmlSha256'],'Wrong frozen R13'
if (P/'app.js').exists():
    subprocess.run([sys.executable,str(P/'finalize-browser.py')],check=True)
    print('Existing final canonical source checked without bootstrap overwrite.')
    raise SystemExit(0)
parts=[f'part-{i:02d}.bin' for i in range(14)]
parts[7:8]=['part-07-0.bin','part-07-1.bin','part-07-2.bin']
packed=b''.join((P/'source-increment'/n).read_bytes() for n in parts)
assert hash256(packed)==lock['payloadSha256'],'Transport checksum mismatch'
increment=json.loads(gzip.decompress(packed).decode('utf-8'))
assert set(increment)<=set(lock['canonicalFiles']),'Unexpected source path'
candidates={}
for name,expected in lock['canonicalFiles'].items():
    assert Path(name).name==name and name not in ('.','..')
    entry=increment.get(name)
    if entry and 'text' in entry:data=entry['text'].encode('utf-8')
    else:
        data=(parent/name).read_bytes()
        if entry:
            assert hash256(data)==entry['before'],(name,'Wrong parent source')
            lines=data.decode('utf-8').splitlines(keepends=True)
            for first,last,replacement in reversed(entry['ops']):
                assert 0<=first<=last<=len(lines)
                lines[first:last]=replacement
            data=''.join(lines).encode('utf-8')
    assert hash256(data)==expected,(name,'Bootstrap canonical mismatch')
    candidates[name]=data
for name,data in candidates.items():
    target=P/name
    if target.exists():assert target.read_bytes()==data,(name,'Already edited; use build.py')
for name,data in candidates.items():(P/name).write_bytes(data)
subprocess.run([sys.executable,str(P/'finalize-browser.py')],check=True)
print('Canonical readable R14 source verified:',len(candidates),'files; R13 unchanged.')
