"""One-time reviewed migration into R13; not part of ordinary build or runtime."""
from pathlib import Path
import hashlib,importlib.util,json,shutil
TOOLS=Path(__file__).resolve().parent;L=TOOLS.parent;R=L/'r13'
BASE='bbd0c0ba2a6e74d532d1545b48b252709efae02f'
def sha(b):return hashlib.sha256(b).hexdigest()
def load(p,n):
 s=importlib.util.spec_from_file_location(n,p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
if (R/'MIGRATION_COMPLETE.json').exists():raise SystemExit('Migration already completed; edit canonical sources, do not rerun')
assert sha((L/'r12/public-lite.html').read_bytes())=='46cfe2531e1c2c98242a6c1338725fa35ffeb5ec5a913c889287dd46278a398c'
shutil.copytree(L/'r12',R,ignore=shutil.ignore_patterns('out','__pycache__','node-lib.cjs','public-lite.html','BUILD_RESULT.json','DELIVERY.json','qa','development'),dirs_exist_ok=True)
shutil.copytree(L/'r12/qa/reference',R/'qa/reference',dirs_exist_ok=True)
# Collapse historical adapters once. Only the reviewed effective C is retained
# as production input. The regular compiler never loads these old adapters.
a=load(L/'r10/source_adapters.py','source_provenance_only')
expected={'contact':'4464cf5bf17242ad37f82444d3b56678cac4e042931e3ae42e1a7d39036e43ad','energy':'cceaeae3c1929f16b670d1f11d99cb7c78312e920c7b399d80ee1a6149ba9f41'}
for name in ['contact','energy']:
 raw=a.adapt(name+'.c',(L/'r09/native'/(name+'.c')).read_text()).encode();assert sha(raw)==expected[name];(R/'native'/(name+'.c')).write_bytes(raw)
shutil.copy2(L/'r10/native-broadphase.c',R/'native/broadphase.c')
assert sha((R/'native/broadphase.c').read_bytes())=='7688a0bcfe72f4f2734f7ed7e08e10dd47f44963bc2c240b9165630bc0ee6bbb'
shutil.copy2(TOOLS/'native-build.py',R/'native/build.py')
flags=['--target=wasm32','-O3','-nostdlib','-fno-builtin','-Wl,--no-entry','-Wl,--export-all','-Wl,--allow-undefined','-Wl,--initial-memory=131072','-Wl,--max-memory=134217728']
cfg={'schema':'kaopu/native-source-toolchain@1','compilerVersion':'Ubuntu clang version 18.1.3 (1ubuntu1)','sourceDateEpoch':1791685565,'flags':flags,'sources':{n+'.c':sha((R/'native'/(n+'.c')).read_bytes()) for n in ['contact','energy','broadphase']},'expectedBytes':28697,'expectedSHA256':'2f9550559469e184d18bce32989c975aae67da580e95924b1e4f8c0a0f02abb6','provenance':{'repositoryHead':BASE,'contact':'r09/native/contact.c + reviewed r10 native adaptation','energy':'r09/native/energy.c + reviewed r09/r10 native adaptations','broadphase':'r10/native-broadphase.c'},'fallbackAllowed':False}
(R/'native/toolchain.json').write_text(json.dumps(cfg,indent=2)+'\n')
# Build logic is edited once and committed before any verification. Never replay
# this transformation in the ordinary linker.
p=R/'build.py';s=p.read_text().replace('R12-S1B2','R13-S1C').replace('R12.0-S1B2','R13.0-S1C').replace('UNCOMMITTED-S1B2','UNCOMMITTED-S1C').replace('candidate-r12-s1b.html','candidate-r13.html')
s=s.replace('import argparse,','import importlib.util\nimport argparse,',1)
start=s.index('def packed_binary(path):');end=s.index('\ndef verify_sources()',start)
s=s[:start]+'''def native_source_binary():
    spec=importlib.util.spec_from_file_location('leather_source_kernel',local('native/build.py'))
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    data,receipt=module.rebuild(ROOT/'native')
    p=ROOT/'qa/s1c/native.json';p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(receipt,indent=2)+'\\n')
    return data
'''+s[end:]
s=s.replace('self.cache={}','self.cache={}\n        self.native=None',1)
s=s.replace('if op=="packedBinary": return packed_binary(v)','if op=="nativeSource":\n            if self.native is None:self.native=native_source_binary()\n            return self.native')
p.write_text(s)
m=json.loads((R/'assembly.json').read_text());m['phase']='S1C';m['buildArchitecture']='R13-S1C';m['runtimeIdentity']='R13.0-S1C'
m['limits']=['Shared module bindings are inventoried by a compiler-backed contract; not converted to standalone ESM.','Four reviewed inherited extension assignments remain locked in the dependency contract.','Native kernel is compiled from reviewed C and must match the accepted bytes exactly.','R02 and R05 compatibility documents remain explicit frozen archives, including pending reference-media rights review.','Source reproducibility is not independent ownership or commercial legal clearance.']
def visit(n):
 if isinstance(n,dict):
  if 'packedBinary' in n:n['nativeSource']=n.pop('packedBinary')
  for v in n.values():visit(v)
 elif isinstance(n,list):
  for v in n:visit(v)
visit(m)
(R/'assembly.json').write_text(json.dumps(m,ensure_ascii=False,separators=(',',':'))+'\n')
for name in ['src/app/runtime.js','ui/template.html']:
 p=R/name;p.write_text(p.read_text().replace('R12.0-S1B2','R13.0-S1C'))
shutil.copy2(TOOLS/'dependencies.cjs',R/'qa-dependencies.cjs')
shutil.copy2(TOOLS/'verify-closure.py',R/'verify-closure.py')
# Keep the inherited regression thresholds and camera state capture unchanged.
p=R/'qa-browser-s1b2.py';s=p.read_text().replace('R12.0-S1B2','R13.0-S1C').replace('candidate-r12-s1b.html','candidate-r13.html').replace("'s1b2'","'s1c'")
# No material/shader/geometry changes: sample 6 products + 3 discriminating
# views. All 13 material source outputs still pass immutable byte gates.
a0=s.index("   for craft in ['plain','diamond'");a1=s.index("   reference.close()",a0)
s=s[:a0]+'''   compare_view('grid',"()=>{LEATHER_ATELIER.selectProduct('swatch');LEATHER_ATELIER.configure({craft:'grid'});LEATHER_ATELIER.setView('home');}")
   compare_view('patent',"()=>{LEATHER_ATELIER.selectProduct('swatch');LEATHER_ATELIER.configure({craft:'plain'});LEATHER_ATELIER.selectMaterial('patent');LEATHER_ATELIER.setView('home');}")
   compare_view('wallet-cut',"()=>{LEATHER_ATELIER.selectProduct('wallet');LEATHER_ATELIER.configure({craft:'plain'});LEATHER_ATELIER.inspectCut();LEATHER_ATELIER.thicknessView(true);}")
'''+s[a1:]
(R/'qa-browser-s1c.py').write_text(s)
# Fresh evidence is never copied from R12 or assigned a new identity.
for name in ['verify.py','verify-recovery.py','qa-browser-s1b2.py']:
 (R/name).unlink(missing_ok=True)
(R/'MIGRATION_COMPLETE.json').write_text(json.dumps({'sourceBaseline':BASE,'logicalBaselineHTML':'46cfe2531e1c2c98242a6c1338725fa35ffeb5ec5a913c889287dd46278a398c','regularBuildUsesMigration':False,'productionSources':'src/** and native/*.c','decodedNativeChangeAllowed':False},indent=2)+'\n')
# Define the exact active input inventory, including test tool integrity.
old=json.loads((R/'canonical.lock.json').read_text());paths=set(old['files'])
paths.discard('verify.py');paths.discard('qa-browser-s1b2.py')
paths.update(['native/contact.c','native/energy.c','native/broadphase.c','native/build.py','native/toolchain.json','qa-dependencies.cjs','verify-closure.py','qa-browser-s1c.py'])
lock={'schema':'kaopu/canonical-source-lock@1','phase':'S1C','files':{}}
for n in sorted(paths):
 p=R/n
 if p.is_file():
  b=p.read_bytes();lock['files'][n]={'bytes':len(b),'sha256':sha(b),'gitBlob':hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()}
(R/'canonical.lock.json').write_text(json.dumps(lock,separators=(',',':'))+'\n')
print('Canonical R13 prepared; build must recompile native source; R12 unchanged')
