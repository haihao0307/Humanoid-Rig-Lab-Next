"""One-time manifest/source edit; regular builds only read the resulting files."""
from pathlib import Path
import json,hashlib
r=Path(__file__).resolve().parents[1]
p=r/'assembly.json';m=json.loads(p.read_text());m['phase']='S1B2';m['buildArchitecture']='R12-S1B2';m['runtimeIdentity']='R12.0-S1B2'
m['modules']['app-composition']={'file':'src/app/composition.js','format':'text','ensureFinalLF':True}
m['main']['join'].insert(-1,{'module':'app-composition'})
def walk(n):
 if isinstance(n,dict):
  if n=={'file':'src/app/r10-runtime-identity.json'}:
   n.clear();n['buildIdentity']='src/app/r10-runtime-identity.json'
  else:
   for x in n.values():walk(x)
 elif isinstance(n,list):
  for x in n:walk(x)
walk(m['main'])
for k,q in m['modules'].items():
 if q['file'].startswith('src/app/'):
  q.pop('emittedSHA256',None)
m['limits']=[x for x in m['limits'] if 'override' not in x.lower()]
m['limits']+=['S1B2 application services are explicitly composed before boot. The pinned physics broadphase adapter and native compiler reproducibility are outside this bounded application-interface stage.','First-boot API now exposes the same live delegates as subsequent product switches; no change to solver commands or numerics.']
p.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
p=r/'build.py';s=p.read_text();s=s.replace('R12-S1B deterministic','R12-S1B2 deterministic');s=s.replace('subprocess, zlib, gzip','subprocess, zlib, gzip, os')
s=s.replace('        if op=="packedBinary": return packed_binary(v)', '''        if op=="packedBinary": return packed_binary(v)
        if op=="buildIdentity":
            data=json.loads(text(v))
            data["inheritedSourceCommit"]=data.get("sourceCommit")
            commit=os.environ.get("LEATHER_SOURCE_COMMIT","UNCOMMITTED-S1B2")
            if commit!="UNCOMMITTED-S1B2" and not re.fullmatch(r"[0-9a-f]{40}",commit):
                raise ValueError("Invalid source identity")
            data.update(sourceCommit=commit,version="R12.0-S1B2",architecture="R12-S1B2")
            return json.dumps(data,ensure_ascii=True)''')
s=s.replace('"R12-S1B1"','"R12-S1B2"')
s=s.replace('"status":"SOURCE_CANDIDATE_NOT_PUBLIC_RELEASE"','"status":"SOURCE_CANDIDATE_REQUIRES_BROWSER_GATES",\n                "sourceCommit":os.environ.get("LEATHER_SOURCE_COMMIT","UNCOMMITTED-S1B2")')
p.write_text(s)
p=r/'ui/template.html';s=p.read_text();s=s.replace('数字皮匠 R10.0','数字皮匠 R12.0-S1B2');p.write_text(s)
p=r/'canonical.lock.json';lock=json.loads(p.read_text());lock['phase']='S1B2';lock['notes'].append('2026-10-11: explicit application composition; R10-compatible appearance and physics protected by independent differential verification.')
lock['files']['src/app/composition.js']={}
for path,q in lock['files'].items():
 data=(r/path).read_bytes();q.update(bytes=len(data),sha256=hashlib.sha256(data).hexdigest(),gitBlob=hashlib.sha1(('blob '+str(len(data))+'\0').encode()+data).hexdigest())
lock['canonicalDataFiles']=len(lock['files'])-2
p.write_text(json.dumps(lock,ensure_ascii=False,indent=2)+'\n')
