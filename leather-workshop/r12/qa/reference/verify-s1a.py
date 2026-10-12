"""Fresh S1A structural, rebuild and numerical gates. No browser claims."""
from __future__ import annotations
import ast, base64, hashlib, importlib.util, json, os, re, shutil, subprocess, sys, tempfile, time
from pathlib import Path
ROOT=Path(__file__).resolve().parent
checks=[]
def sha(b): return hashlib.sha256(b).hexdigest()
def check(name, value, data=None):
    checks.append({"name":name,"pass":bool(value),"data":data})
    if not value: raise AssertionError(name)
def load(path,name):
    s=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(s)
    s.loader.exec_module(m);return m
def constant(doc,name):
    hits=list(re.finditer(r"\bconst\s+"+re.escape(name)+r"\s*=",doc))
    if len(hits)!=1:raise ValueError(name)
    v,_=json.JSONDecoder().raw_decode(doc[hits[0].end():]);return v
def run():
    started=time.time()
    lock=json.loads((ROOT/"migration.lock.json").read_text())
    for name,q in lock["entries"].items():
        p=ROOT/name
        check("source:"+name,p.is_file() and sha(p.read_bytes())==q["sha256"])
    src=(ROOT/"build.py").read_text()
    tree=ast.parse(src)
    forbidden=[n for n in ast.walk(tree) if isinstance(n,ast.Call) and isinstance(n.func,ast.Name) and n.func.id in ("exec","eval")]
    check("No eval/exec or runpy in regular linker",not forbidden and "import runpy" not in src)
    build=load(ROOT/"build.py","normalization_build")
    report=build.build()
    check("Whole HTML equals protected R10 SHA-256",report["byteIdenticalToR10"],report)
    js=(ROOT/"out/reproduced-r10.html").read_text()
    app=re.search(r"<script>([\s\S]*)</script>",js)[1]
    link=build.Linker(json.loads((ROOT/"assembly.json").read_text()))
    import gzip
    documents={"outer":app,"product":constant(app,"PRODUCT_WORKER_CODE"),"specimen":constant(app,"WORKER_CODE")}
    for k in ("LEGACY_CRAFT_GZIP","BASELINE_GZIP"):
        page=gzip.decompress(base64.b64decode(constant(app,k))).decode()
        documents[k]=re.search(r"<script>([\s\S]*)</script>",page)[1]
    with tempfile.TemporaryDirectory(prefix="leather-s1a-") as td:
        t=Path(td)
        for name,body in documents.items():
            p=t/(name+".js");p.write_text(body)
            q=subprocess.run(["node","--check",str(p)],capture_output=True,text=True,timeout=20)
            check("JavaScript syntax:"+name,q.returncode==0,q.stderr[:500])
        # This copy has no repository parent, R01-R11 directories or historical scripts.
        isolated=t/"isolated-package"
        shutil.copytree(ROOT,isolated,ignore=shutil.ignore_patterns("out","qa","node-lib.cjs","__pycache__"))
        ib=load(isolated/"build.py","isolated_build")
        ir=ib.build()
        check("Build succeeds outside repository with no historical directories",ir["byteIdenticalToR10"])
        pick=isolated/"src/app/runtime.js"
        old=pick.read_text()
        new=old.replace("const VERSION='R10.0'","const VERSION='SOURCE_MUTATION_TEST'",1)
        check("Adversarial source mutation applied",new!=old)
        pick.write_text(new)
        il=ib.Linker(json.loads((isolated/"assembly.json").read_text()))
        changed=il.build()
        check("Assembler genuinely consumes editable modules, not the old HTML",sha(changed)!=lock["baselineSHA256"])
        failed=False
        try:ib.build()
        except ValueError:failed=True
        check("Changed runtime cannot silently pass frozen-output gate",failed)
        pick.write_text(old)
        pick.unlink()
        failed=False
        try:ib.build()
        except (ValueError,FileNotFoundError):failed=True
        check("Missing source fails, no historical fallback",failed)
        pick.write_text(old)
        failed=False
        try:ib.local("../escape")
        except ValueError:failed=True
        check("Input path cannot escape declared source root",failed)
    q=subprocess.run(["node",str(ROOT/"qa-numeric.cjs")],capture_output=True,text=True,timeout=45)
    nr=json.loads((ROOT/"qa/numeric.json").read_text())
    check("Inherited numerical regression executes against newly linked core",q.returncode==0 and nr["pass"] and len(nr["checks"])==18,{"checks":len(nr["checks"]),"stdout":q.stdout,"stderr":q.stderr[:500]})
    check("Both actual worker payloads stay unchanged",sha(documents["product"].encode())=="7b079eec2525347d1b1087208e4d08799ad4646590fe3e366b92d6c9b7b71427" and sha(documents["specimen"].encode())=="743954938b8db6f27863c04ad473e96c88e6f73b222b08521f99a8b3d1520bdc")
    return {"scope":"R12-S1A migration and independent source build; not full S1 or fresh visual certification",
            "pass":all(x["pass"] for x in checks),"checks":checks,"checkCount":len(checks),
            "numericChecks":18,"htmlSHA256":report["htmlSHA256"],"htmlBytes":report["htmlBytes"],
            "elapsedSeconds":time.time()-started,"python":sys.version.split()[0],
            "node":subprocess.check_output(["node","--version"],text=True).strip(),
            "newBrowserChecks":0,"newPublicDeployment":False,"stableRuntimeChanged":False,
            "next":"S1B: check in normalized modules, explicit interfaces and remove late overrides, with separate frozen regression gates."}
if __name__=="__main__":
    out=ROOT/"qa/SUMMARY.json";out.parent.mkdir(parents=True,exist_ok=True)
    try: result=run()
    except Exception as e:
        result={"pass":False,"checks":checks,"error":str(e),"newBrowserChecks":0}
        out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n");raise
    out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n")
    print(json.dumps({k:result[k]for k in ("pass","checkCount","numericChecks","htmlSHA256","newBrowserChecks")},indent=2))
