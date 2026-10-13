"""One-time fixed-SHA migration. Never invoked by the regular R12 builder.
Produces editable source units; refuses to overwrite any nonidentical local edit.
No historical build script, browser, workflow, or network access is used.
"""
from __future__ import annotations
import argparse, base64, hashlib, json, re
from pathlib import Path
ROOT=Path(__file__).resolve().parent
def sha(b): return hashlib.sha256(b).hexdigest()
def inside(root, rel):
    p=(root/rel).resolve()
    if not p.is_relative_to(root.resolve()): raise ValueError("Path escapes root")
    return p
def constant(doc, name):
    hits=list(re.finditer(r"\bconst\s+"+re.escape(name)+r"\s*=",doc))
    if len(hits)!=1: raise ValueError("Ambiguous emitted constant: "+name)
    value,_=json.JSONDecoder().raw_decode(doc[hits[0].end():])
    if not isinstance(value,str): raise ValueError("Expected string constant")
    return value
def materialize(repo, destination=ROOT):
    repo=Path(repo).resolve();destination=Path(destination).resolve()
    lock=json.loads((ROOT/"migration.lock.json").read_text())
    raw=inside(repo,lock["baseline"]).read_bytes()
    if sha(raw)!=lock["baselineSHA256"]: raise ValueError("Wrong R10 baseline; never move the expected hash")
    doc=raw.decode()
    match=re.search(r"<script>([\s\S]*)</script>",doc)
    if not match: raise ValueError("Missing baseline application")
    app=match[1]
    product=constant(app,"PRODUCT_WORKER_CODE")
    specimen=constant(app,"WORKER_CODE")
    a,b=lock["stackRange"]
    docs={"main":app,"product":product,"specimen":specimen,"stack":product[a:b]}
    staged=[]
    for path,q in lock["entries"].items():
        kind=q["kind"]
        if kind=="copy": data=inside(repo,q["from"]).read_bytes()
        elif kind=="slice": data=docs[q["document"]][q["start"]:q["end"]].encode()
        elif kind=="wasm": data=base64.b64decode(constant(docs[q["document"]],q["constant"]),validate=True)
        elif kind=="ui-template":
            ds=re.search(r'<div id="scanData" hidden>(.*?)</div>',doc,re.S)
            if not ds: raise ValueError("Missing protected scan data")
            value=doc[:ds.start(1)]+"@@SCAN_DATA@@"+doc[ds.end(1):match.start(1)]+"@@APPLICATION@@"+doc[match.end(1):]
            data=value.encode()
        else: raise ValueError("Unknown migration operation")
        if len(data)!=q["bytes"] or sha(data)!=q["sha256"]: raise ValueError("Source provenance mismatch: "+path)
        target=inside(destination,path)
        if target.exists() and target.read_bytes()!=data:
            raise ValueError("Local edit protected; migration refused: "+path)
        staged.append((target,data))
    # All input checks finish before any write; interrupted writes are idempotent.
    for target,data in staged:
        target.parent.mkdir(parents=True,exist_ok=True)
        if not target.exists(): target.write_bytes(data)
    return {"materializedFiles":len(staged),"baselineSHA256":lock["baselineSHA256"],
            "output":str(destination),"historicBuildersExecuted":0,"runtimeChanged":False}
if __name__=="__main__":
    ap=argparse.ArgumentParser()
    ap.add_argument("--repo",type=Path,default=ROOT.parents[1])
    ap.add_argument("--output",type=Path,default=ROOT)
    a=ap.parse_args()
    print(json.dumps(materialize(a.repo,a.output),indent=2))
