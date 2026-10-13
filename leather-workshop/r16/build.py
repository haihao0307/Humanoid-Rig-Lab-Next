"""R16-RENDER deterministic linker. Only local declared inputs, no historic builder execution."""
from __future__ import annotations
import importlib.util
import argparse, base64, hashlib, io, json, re, subprocess, zlib, gzip, os
from pathlib import Path
ROOT = Path(__file__).resolve().parent
def sha(data): return hashlib.sha256(data).hexdigest()
def local(path):
    p=(ROOT/path).resolve()
    if not p.is_relative_to(ROOT) or not p.is_file():
        raise ValueError("Missing or non-local declared input: "+str(path))
    return p
def text(path): return local(path).read_text(encoding="utf-8")
def strip_es_syntax(source):
    # Restricted syntax lowering, NOT a domain-specific patch. Dependencies are
    # explicit in assembly.json; historical import spellings are never followed.
    source=re.sub(r"^import[^\n]*\n","",source,flags=re.M)
    source=re.sub(r"\bexport (?=(?:async )?(?:class|const|function))","",source)
    if re.search(r"^\s*(?:import|export)\b",source,re.M):
        raise ValueError("Unsupported ES module syntax; do not silently patch")
    return source

def native_source_binary():
    spec=importlib.util.spec_from_file_location('leather_source_kernel',local('native/build.py'))
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    data,receipt=module.rebuild(ROOT/'native')
    p=ROOT/'qa/s2/native.json';p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(receipt,indent=2)+'\n')
    return data

def verify_sources():
    lock=json.loads(text("canonical.lock.json"))
    for name,q in lock["files"].items():
        data=local(name).read_bytes()
        if len(data)!=q["bytes"] or sha(data)!=q["sha256"]:
            raise ValueError("Canonical source changed; review source and regression before updating lock: "+name)
    return lock

class Linker:
    def __init__(self, manifest):
        self.m=manifest
        self.cache={}
        self.native=None
    def module(self, key):
        if key in self.cache: return self.cache[key]
        q=self.m["modules"][key]
        s=text(q["file"])
        if q.get("ensureFinalLF") and not s.endswith("\n"): s += "\n"
        if q["format"]=="legacy-esm":
            s=strip_es_syntax(s)
        elif q["format"]=="three-esm":
            e=re.search(r"export\s*\{([^}]+)\}\s*;?\s*$",s)
            if not e: raise ValueError("Unrecognized pinned Three.js export table")
            names=[re.split(r"\s+as\s+",p.strip()) for p in e[1].split(",")]
            s="const T=(()=>{"+s[:e.start()]+";return {"+",".join(p[-1]+":"+p[0] for p in names)+"};})();"
        elif q["format"]!="text": raise ValueError("Unknown module format")
        s=q.get("prefix","")+s+q.get("suffix","")
        self.cache[key]=s
        return s
    def emit(self, node):
        if len(node)!=1: raise ValueError("Assembly node must have exactly one operation")
        op,v=next(iter(node.items()))
        if op=="text": return v
        if op=="module": return self.module(v)
        if op=="ref": return self.emit(self.m["programs"][v])
        if op=="file": return local(v).read_bytes()
        if op=="nativeSource":
            if self.native is None:self.native=native_source_binary()
            return self.native
        if op=="buildIdentity":
            data=json.loads(text(v))
            data["inheritedSourceCommit"]=data.get("sourceCommit")
            commit=os.environ.get("LEATHER_SOURCE_COMMIT","UNCOMMITTED-S2")
            if commit!="UNCOMMITTED-S2" and not re.fullmatch(r"[0-9a-f]{40}",commit):
                raise ValueError("Invalid source identity")
            data.update(sourceCommit=commit,version="R16.0-RENDER",architecture="R16-RENDER")
            return json.dumps(data,ensure_ascii=True)
        if op=="join": return "".join(self.as_text(self.emit(x)) for x in v)
        if op=="jsonString": return json.dumps(self.as_text(self.emit(v)),ensure_ascii=True)
        if op=="base64":
            x=self.emit(v);b=x.encode() if isinstance(x,str) else x
            return base64.b64encode(b).decode("ascii")
        if op=="gzip":
            x=self.emit(v);b=x.encode() if isinstance(x,str) else x
            # Matches the pinned stream, including zero time and OS byte 3.
            return zlib.compress(b,9,wbits=31)
        if op=="r02Document": return self.r02()
        raise ValueError("Unsupported assembly operation: "+op)
    @staticmethod
    def as_text(value): return value.decode("utf-8") if isinstance(value,bytes) else value
    def r02(self):
        body=[self.module("vendor-three"),
              "const LegacyLeatherKernel=(()=>{"+self.module("compat-r02-legacy")+";return LegacyLeatherKernel;})();"]
        body += [self.module("compat-r02-"+k) for k in ("leather","craft","export","app")]
        js="(()=>{"+"\n".join(body)+"})();"
        js=re.sub(r"</script",r"<\\/script",js,flags=re.I)
        notice=text("licenses/THREE-AND-REFERENCE.txt").replace("--","—")
        return text("compat/r02/template.html").replace("<!--IMPORTMAP-->","<!--\n"+notice+"\n-->").replace("<!--APP-->","<script>"+js+"</script>")
    def scan(self):
        from PIL import Image
        import numpy as np
        maps={}
        for name,q in self.m["assets"].items():
            raw=local(q["path"]).read_bytes()
            if sha(raw)!=q["sourceSHA256"]: raise ValueError("Protected image source changed: "+name)
            im=Image.open(io.BytesIO(raw)).convert("RGB").resize((1536,768),Image.Resampling.LANCZOS)
            if name=="nor_gl":
                a=np.asarray(im).astype(float)/127.5-1
                a/=np.maximum(1e-8,np.linalg.norm(a,axis=2,keepdims=True))
                im=Image.fromarray(np.uint8(np.clip((a+1)*127.5,0,255)))
            out=io.BytesIO();im.save(out,"WEBP",quality=94 if name=="diff" else 92,method=6)
            data=out.getvalue()
            if sha(data)!=q["outputSHA256"]: raise ValueError("Texture codec output differs from R10: "+name)
            maps[name]="data:image/webp;base64,"+base64.b64encode(data).decode("ascii")
        return json.dumps(maps)
    def build(self):
        template=text("ui/template.html")
        if template.count("@@SCAN_DATA@@")!=1 or template.count("@@APPLICATION@@")!=1:
            raise ValueError("Template slot contract changed")
        app=self.as_text(self.emit(self.m["main"]))
        return template.replace("@@SCAN_DATA@@",self.scan()).replace("@@APPLICATION@@",app).encode("utf-8")
    def node_library(self):
        keys=["vendor-three","vendor-poly2tri","material-law","shell-dynamics",
              "seam-paths","contact-relief"]
        parts=[self.module(k) for k in keys]
        parts+=["const {insideHole}=R05_SEW;const {mapSurfacePoint}=R05_CONTACT;"]
        parts += [self.module(k) for k in ("seam-geometry","sewing","panels",
            "closed-shell","pattern-physics","assembly-contract","yarn-host","measurements","products","grip-base")]
        parts += [self.as_text(self.emit({"ref":"physics"}))]
        return "\n".join(parts)+"""
module.exports={ImplicitLeatherShell,SurfaceContact,closestPT,closestEE,sweptContact,ContactReference,evaluateBoundVertex,worldShellMeasurements,updateSkin,skinMaterial,T,PRODUCT_SPECS,productMaterials,makeProduct,productAudit,ProductShell,fastHinge,hinge,PanelAssembly,SeamPath,SeamIndex,seamRelief,R05_SEW,R05_CONTACT};
"""
def build(out=None):
    lock=verify_sources()
    manifest=json.loads(text("assembly.json"));link=Linker(manifest)
    data=link.build()
    provenance={"architecture":"R16-RENDER", "runtimeCompatibility":"R10.0",
                "baselineBuild":manifest["baselineBuild"],
                "canonicalLockSHA256":sha(local("canonical.lock.json").read_bytes()),
                "status":"SOURCE_CANDIDATE_REQUIRES_BROWSER_GATES",
                "sourceCommit":os.environ.get("LEATHER_SOURCE_COMMIT","UNCOMMITTED-S2")}
    marker=("<!-- "+json.dumps(provenance,separators=(",",":"))+" -->").encode()
    data=marker+b"\n"+data
    output=Path(out) if out else ROOT/"out/candidate-r16.html"
    output.parent.mkdir(parents=True,exist_ok=True);output.write_bytes(data)
    (ROOT/"node-lib.cjs").write_text(link.node_library(),encoding="utf-8")
    receipt={**provenance,"htmlSHA256":sha(data),"htmlBytes":len(data),
             "baselineHTMLSHA256":manifest["baselineHTMLSHA256"],
             "byteIdenticalToR10":sha(data)==manifest["baselineHTMLSHA256"],
             "moduleCount":len(manifest["modules"]),"trackedInputFiles":len(lock["files"]),
             "historicBuilderExecutions":0,"newBrowserChecks":0,
             "publicDeploymentPerformed":False,"fullS1Complete":False,
             "runtimePromotionAllowed":False}
    (ROOT/"BUILD_RESULT.json").write_text(json.dumps(receipt,indent=2)+"\n",encoding="utf-8")
    return receipt
if __name__=="__main__":
    ap=argparse.ArgumentParser();ap.add_argument("--out",type=Path)
    a=ap.parse_args();print(json.dumps(build(a.out),indent=2))
