"""One-time verified source recovery. Never overwrite an edited canonical runtime."""
from pathlib import Path
import base64,hashlib,json,lzma,subprocess
R=Path(__file__).resolve().parent
REPO=R.parents[1]
def sha(b):return hashlib.sha256(b).hexdigest()
def recover():
 if (R/'app.js').exists():
  print('Canonical app.js already exists; source transport will not be replayed.')
  return
 files=[R/'transfer'/f'{i:02}.txt' for i in range(29)]
 payload=base64.b64decode(''.join(p.read_text().strip() for p in files),validate=True)
 assert sha(payload)=='06f2101a5780394b83e63e5972b341b3d2b4a7f648efcd84df887cee79952fb3','Source transfer bytes do not match; refusing to run or publish'
 source=json.loads(lzma.decompress(payload))
 assert source['schema']=='kaopu.source-transfer/1' and source['target']=='hat-workshop/r06' and len(source['files'])==31
 output={}
 for name,item in source['files'].items():
  dest=(R/name).resolve()
  assert dest.is_relative_to(R) and not name.startswith('.') and '..' not in Path(name).parts
  if 'text' in item:text=item['text']
  else:
   base=(REPO/item['base']).resolve()
   assert any(base.is_relative_to(REPO/'hat-workshop'/version) for version in ['r03','r04'])
   raw=base.read_bytes();assert sha(raw)==item['baseSHA256'],f'Frozen source baseline mismatch: {name}'
   lines=raw.decode().splitlines(keepends=True)
   for lo,hi,replacement in sorted(item['lineEdits'],key=lambda e:e[0],reverse=True):
    assert 0<=lo<=hi<=len(lines)
    lines[lo:hi]=[replacement]
   text=''.join(lines)
  assert sha(text.encode())==item['sha256'],f'Recovered source mismatch: {name}'
  output[dest]=text
 for dest,text in output.items():
  dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(text)
 (R/'SOURCE_RECOVERY.json').write_text(json.dumps({'compressedSHA256':sha(payload),'files':{str(p.relative_to(R)):sha(t.encode()) for p,t in output.items()},'sourceTransportOnly':True,'canonicalFilesMustBeCommitted':True,'runtimeAuthority':'SOURCE_AUTHORITY.json'},indent=2))
 print('Recovered and byte-checked',len(output),'readable source files')
if __name__=='__main__':
 recover()
 if not (R/'flatcap-lining-map.mjs').exists():subprocess.run(['python3',str(R/'generate_liner.py')],check=True)
