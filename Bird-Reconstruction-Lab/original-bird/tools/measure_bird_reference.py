#!/usr/bin/env python3
from __future__ import annotations
import argparse, hashlib, json, struct
from pathlib import Path
from typing import Any

JSON_CHUNK=0x4E4F534A
GLB_MAGIC=0x46546C67

TERMS={
 "root":["root","body"],
 "thorax":["thorax","chest","sternum","keel"],
 "pelvis":["pelvis","synsacrum"],
 "neck":["neck","cervical"],
 "head":["head","skull","cranium"],
 "beak":["beak","bill","mandible"],
 "shoulder":["shoulder","scapula","coracoid"],
 "wing_humerus":["humerus"],
 "wing_ulna_radius":["ulna","radius"],
 "wing_wrist":["wrist","carpal","radiale","ulnare"],
 "wing_hand":["carpometacarpus","alula"],
 "leg_femur":["femur","thigh"],
 "leg_tibiotarsus":["tibiotarsus","tibia"],
 "leg_tarsometatarsus":["tarsometatarsus","ankle","tarsus"],
 "toe":["toe","hallux","phalange"],
 "tail":["tail","pygostyle"]
}

def sha(path):
 h=hashlib.sha256()
 with path.open("rb") as f:
  for c in iter(lambda:f.read(1048576),b""): h.update(c)
 return h.hexdigest()

def load(path):
 if path.suffix.lower()==".gltf":
  return json.loads(path.read_text()),{"container":"gltf-json","glbVersion":None,"declaredLength":None}
 if path.suffix.lower()!=".glb": raise ValueError("Expected .glb or .gltf")
 data=path.read_bytes()
 magic,ver,n=struct.unpack_from("<III",data,0)
 if magic!=GLB_MAGIC or n!=len(data): raise ValueError("Invalid GLB header/length")
 off=12; jb=None
 while off+8<=len(data):
  ln,typ=struct.unpack_from("<II",data,off); off+=8
  chunk=data[off:off+ln]; off+=ln
  if typ==JSON_CHUNK and jb is None: jb=chunk
 if jb is None: raise ValueError("GLB missing JSON chunk")
 return json.loads(jb.decode("utf-8").rstrip(" \t\r\n\0")),{"container":"glb","glbVersion":ver,"declaredLength":n}

def acc(doc,i):
 a=doc.get("accessors") or []
 return a[i] if isinstance(i,int) and 0<=i<len(a) else {}

def ub(bounds):
 v=[b for b in bounds if len(b[0])>=3 and len(b[1])>=3]
 if not v:return None
 return {
  "min":[min(x[0][i] for x in v) for i in range(3)],
  "max":[max(x[1][i] for x in v) for i in range(3)],
  "note":"mesh-local accessor bounds; node transforms not applied"
 }

def hints(doc):
 names=[str((n or {}).get("name") or "").strip() for n in doc.get("nodes") or []]
 out={}
 for k,ts in TERMS.items():
  h=sorted(set(n for n in names if n and any(t in n.lower() for t in ts)))
  if h: out[k]=h
 return out

def measure(path):
 doc,meta=load(path)
 meshes=doc.get("meshes") or []
 pos=set(); pc=tc=unk=mt=0; b=[]
 for m in meshes:
  for p in (m or {}).get("primitives") or []:
   pc+=1
   attrs=p.get("attributes") or {}
   pi=attrs.get("POSITION")
   if isinstance(pi,int):
    pos.add(pi); a=acc(doc,pi)
    if isinstance(a.get("min"),list) and isinstance(a.get("max"),list): b.append((a["min"],a["max"]))
   mt+=len(p.get("targets") or [])
   mode=p.get("mode",4)
   if mode==4:
    if isinstance(p.get("indices"),int): tc+=int(acc(doc,p["indices"]).get("count") or 0)//3
    elif isinstance(pi,int): tc+=int(acc(doc,pi).get("count") or 0)//3
    else: unk+=1
   else: unk+=1
 skins=doc.get("skins") or []
 anim=doc.get("animations") or []
 return {
  "schema":"bird/original-reference-measurement@0.0.1",
  "source":{"filename":path.name,"path":str(path),"bytes":path.stat().st_size,"sha256":sha(path),**meta},
  "asset":doc.get("asset") or {},
  "structure":{
   "sceneCount":len(doc.get("scenes") or []),
   "nodeCount":len(doc.get("nodes") or []),
   "meshCount":len(meshes),
   "primitiveCount":pc,
   "uniquePositionAccessorVertexCount":sum(int(acc(doc,i).get("count") or 0) for i in pos),
   "triangleCountKnown":tc,
   "triangleCountUnknownPrimitiveCount":unk,
   "accessorCount":len(doc.get("accessors") or []),
   "bufferCount":len(doc.get("buffers") or []),
   "bufferViewCount":len(doc.get("bufferViews") or []),
   "materialCount":len(doc.get("materials") or []),
   "textureCount":len(doc.get("textures") or []),
   "imageCount":len(doc.get("images") or []),
   "skinCount":len(skins),
   "skinJointCounts":[len((s or {}).get("joints") or []) for s in skins],
   "animationCount":len(anim),
   "animationSummary":[{"name":(a or {}).get("name"),"channels":len((a or {}).get("channels") or []),"samplers":len((a or {}).get("samplers") or [])} for a in anim],
   "morphTargetCount":mt,
   "meshLocalAccessorBounds":ub(b)
  },
  "birdSemanticNameHints":hints(doc),
  "scaleBoundary":{
   "gltfLinearDistanceConvention":"metre",
   "realWorldScaleVerified":False,
   "status":"unknown-until-reference-scale-is-cross-checked",
   "note":"glTF uses metre-based linear units by convention, but authoring/export scale can still be biologically wrong."
  },
  "truthBoundary":{
   "taxonomyVerified":False,
   "ageVerified":False,
   "sexVerified":False,
   "anatomyVerified":False,
   "visualAcceptance":False,
   "productionReady":False
  }
 }

def selftest(tmp):
 doc={
  "asset":{"version":"2.0"},
  "scenes":[{"nodes":[0]}],
  "nodes":[{"name":"root","mesh":0,"skin":0},{"name":"left_humerus"}],
  "meshes":[{"primitives":[{"attributes":{"POSITION":0},"indices":1,"targets":[{"POSITION":2}]}]}],
  "accessors":[
   {"count":3,"type":"VEC3","componentType":5126,"min":[0,0,0],"max":[1,2,3]},
   {"count":3,"type":"SCALAR","componentType":5123},
   {"count":3,"type":"VEC3","componentType":5126}
  ],
  "skins":[{"joints":[0,1]}],
  "animations":[{"name":"idle","channels":[],"samplers":[]}],
  "materials":[{}],"textures":[{}],"images":[{}]
 }
 p=tmp/"synthetic.gltf"; p.write_text(json.dumps(doc))
 o=measure(p)
 assert o["structure"]["meshCount"]==1
 assert o["structure"]["skinJointCounts"]==[2]
 assert o["structure"]["morphTargetCount"]==1
 assert o["structure"]["triangleCountKnown"]==1
 assert "wing_humerus" in o["birdSemanticNameHints"]

def main():
 ap=argparse.ArgumentParser(description="Measure GLB/GLTF references for Original Bird without treating them as runtime truth.")
 ap.add_argument("input",nargs="?")
 ap.add_argument("-o","--output")
 ap.add_argument("--self-test",action="store_true")
 a=ap.parse_args()
 if a.self_test:
  import tempfile
  with tempfile.TemporaryDirectory() as td:selftest(Path(td))
  print("SELF_TEST_OK")
  return
 if not a.input: ap.error("input required unless --self-test")
 out=json.dumps(measure(Path(a.input)),ensure_ascii=False,indent=2)+"\n"
 Path(a.output).write_text(out,encoding="utf-8") if a.output else print(out,end="")

if __name__=="__main__": main()
