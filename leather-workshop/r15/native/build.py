"""Compile reviewed C sources. A mismatch never falls back to a shipped binary."""
from __future__ import annotations
import argparse, hashlib, json, os, re, shutil, subprocess, tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parent

def sha(b): return hashlib.sha256(b).hexdigest()
def rebuild(root=ROOT):
    root=Path(root).resolve();cfg=json.loads((root/'toolchain.json').read_text())
    chunks=[]
    for name,expected in cfg['sources'].items():
        p=(root/name).resolve()
        if not p.is_relative_to(root):raise ValueError('Native source escapes its package')
        raw=p.read_bytes()
        if sha(raw)!=expected:raise ValueError('Native source changed: '+name)
        chunks.append(raw)
    clang=shutil.which(os.environ.get('LEATHER_CLANG','clang-18'))
    linker=shutil.which(os.environ.get('LEATHER_WASM_LD','wasm-ld-18'))
    if not clang or not linker:raise ValueError('Requires the reviewed clang-18 and wasm-ld-18; no prebuilt fallback')
    cv=subprocess.check_output([clang,'--version'],text=True).splitlines()[0]
    lv=subprocess.check_output([linker,'--version'],text=True).splitlines()[0]
    if cv!=cfg['compilerVersion'] or '18.1.3' not in lv:raise ValueError('Unreviewed native toolchain: '+cv+' / '+lv)
    source=b'\n'.join(chunks);outputs=[]
    env={**os.environ,'LC_ALL':'C','TZ':'UTC','SOURCE_DATE_EPOCH':str(cfg['sourceDateEpoch'])}
    for _ in range(2):
        with tempfile.TemporaryDirectory(prefix='leather-native-independent-') as tmp:
            tmp=Path(tmp);p=tmp/'combined.c';out=tmp/'contact.wasm';p.write_bytes(source)
            cmd=[clang,*cfg['flags'],'-fuse-ld='+linker,str(p),'-o',str(out)]
            subprocess.run(cmd,check=True,capture_output=True,env=env,timeout=60)
            outputs.append(out.read_bytes())
    if outputs[0]!=outputs[1]:raise ValueError('Native outputs depend on build directory or run')
    data=outputs[0]
    if len(data)!=cfg['expectedBytes'] or sha(data)!=cfg['expectedSHA256']:
        raise ValueError('Recompiled kernel is not the accepted kernel: '+sha(data)+'; no replacement emitted')
    receipt={'pass':True,'method':'two fresh source compilations in independent temporary directories','compiler':cv,'linker':lv,'compilerExecutableSHA256':sha(Path(clang).read_bytes()),'linkerExecutableSHA256':sha(Path(linker).read_bytes()),'flags':cfg['flags'],'sourceHashes':cfg['sources'],'combinedSourceSHA256':sha(source),'sha256':sha(data),'bytes':len(data),'identicalToPinnedCandidate':True,'identicalToR13Kernel':sha(data)==cfg['referenceR13SHA256'],'referenceR13SHA256':cfg['referenceR13SHA256'],'prebuiltBytesUsedForOutput':False,'sourceDateEpoch':cfg['sourceDateEpoch']}
    return data,receipt
if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--output',type=Path,required=True);ap.add_argument('--receipt',type=Path,required=True);a=ap.parse_args()
    raw,receipt=rebuild();a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_bytes(raw);a.receipt.parent.mkdir(parents=True,exist_ok=True);a.receipt.write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt))
