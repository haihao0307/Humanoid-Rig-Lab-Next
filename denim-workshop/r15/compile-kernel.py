"""Build readable R15 C source; no fast-math, SIMD requirement or runtime download."""
from pathlib import Path
import base64,hashlib,json,shutil,subprocess
p=Path(__file__).resolve().parent
compiler=shutil.which('clang')
if not compiler:raise SystemExit('clang with wasm32 + wasm-ld is required to rebuild this kernel')
flags=['--target=wasm32','-O3','-fno-fast-math','-ffp-contract=off','-fno-builtin','-nostdlib',str(p/'bend-kernel.c'),'-Wl,--no-entry','-Wl,--export=addr','-Wl,--export=configure','-Wl,--export=step','-Wl,--export-memory','-Wl,--allow-undefined','-Wl,-z,stack-size=65536','-o',str(p/'bend-kernel.wasm')]
subprocess.run([compiler,*flags],check=True)
b=(p/'bend-kernel.wasm').read_bytes();t=(p/'bend-fast.template.js').read_text();assert t.count('__WASM_BASE64__')==1
(p/'bend-fast.js').write_text(t.replace('__WASM_BASE64__',base64.b64encode(b).decode()))
(p/'KERNEL_BUILD.json').write_text(json.dumps({'compiler':subprocess.check_output([compiler,'--version'],text=True),'arguments':flags,'sourceSha256':hashlib.sha256((p/'bend-kernel.c').read_bytes()).hexdigest(),'wasmSha256':hashlib.sha256(b).hexdigest(),'wasmBytes':len(b),'fastMath':False,'simdRequired':False,'runtimeNetwork':False},indent=2))
