from pathlib import Path
import json,gzip,base64,hashlib,subprocess,os
R=Path(__file__).resolve().parent
sha=lambda b:hashlib.sha256(b).hexdigest()
raw=(R/"RESULT.json").read_bytes();x=json.loads(raw)
assert x["schema"]=="kaopu/adaptive-contact-preflight-experiment@1"
tests=json.loads((R/"qa/TESTS.json").read_text());assembly=json.loads((R/"qa/ASSEMBLY.json").read_text())
assert tests["passed"] and assembly["passed"]
# Geometry is stored once per native fixture; terminal previews only need changed-node coordinates.
data={k:v for k,v in x.items() if k!="cases"};data["cases"]=[]
summary=[]
for c in x["cases"]:
 out={k:v for k,v in c.items() if k not in ["variants","runs"]}
 out["runs"]=[{k:v for k,v in run.items() if k not in ["scopes","linearAudits","preflight"]} for run in c["runs"]]
 out["variants"]={};points={};faces={};body={}
 for mode,v in c["variants"].items():
  var={k:value for k,value in v.items() if k!="scopes"};var["scopes"]=[]
  for s in v["scopes"]:
   row={k:value for k,value in s.items() if k not in ["geometry","before","after","recordedDecision"]}
   row["before"]={k:value for k,value in s["before"].items() if k!="samples"}
   row["after"]={k:value for k,value in s["after"].items() if k!="samples"}
   row["afterPoints"]={};row["bodyOffsets"]=[]
   for t in s["geometry"]["before"]["cloth"]:
    faces[str(t["faceOffset"])]=t["nodeIds"]
    for node,pos in zip(t["nodeIds"],t["triangle"]):
     if str(node) in points:assert points[str(node)]==pos
     points[str(node)]=pos
   for t in s["geometry"]["after"]["cloth"]:
    for node,pos in zip(t["nodeIds"],t["triangle"]):
     if node in s["nodes"]:row["afterPoints"][str(node)]=pos
   for phase in ["before","after"]:
    for t in s["geometry"][phase]["body"]:
     key=str(t["faceOffset"])
     if key in body:assert body[key]==t["triangle"]
     body[key]=t["triangle"];row["bodyOffsets"].append(t["faceOffset"])
   row["bodyOffsets"]=sorted(set(row["bodyOffsets"]));var["scopes"].append(row)
  out["variants"][mode]=var
 out["geometry"]={"points":points,"faces":faces,"body":body}
 data["cases"].append(out)
 a=c["variants"]["adaptive"];o=c["variants"]["original"]
 summary.append({"fixture":c["fixture"],"step":c["step"],"originalSearches":o["scopeSearches"],"adaptiveSearches":a["scopeSearches"],
 "adaptiveNodes":sorted(set(len(s["nodes"]) for s in a["scopes"])),"accepted":a["independentCandidateAccepted"],
 "sourceWritten":False,"adaptiveTrials":[{"seed":s["seed"],"nodes":len(s["nodes"]),"beforeCrossings":s["before"]["strictCrossingPairs"],
 "terminalCrossings":s["after"]["strictCrossingPairs"],"terminalMinM":s["after"]["minimumM"],"status":s["status"],"shapeRejectedTrials":s["shapeRejectedTrials"]} for s in a["scopes"]]})
source=os.environ.get("RF313_SOURCE_COMMIT")
if not source:
 source=subprocess.check_output(["git","-C",str(R),"rev-parse","HEAD"],text=True).strip()
m={"version":"REALITY-HC-S3.13","sourceCommit":source,"rawReportSHA256":sha(raw),"sourceSolverSHA256":x["sourceSolverSHA256"],
 "sourceFiles":{n:sha((R/n).read_bytes()) for n in ["adaptive-preflight.mjs","prepare.py","evaluate.mjs","tests.mjs","build.py","index.html","app.js","browser.py","README.md"]},
 "fixtureRun":x["fixtureRun"],"fixtureDigests":{c["fixture"]:c["fixtureSHA256"] for c in x["cases"]},"policy":x["policy"],
 "status":x["status"],"motionGate":x["motionGate"],"fullMotionExecuted":False,"sourceWritten":False,"fitCertified":False,"live":False,
 "checks":tests["count"],"summary":summary}
b=json.dumps(data,ensure_ascii=False,separators=(",",":")).encode();payload={"sha256":sha(b),"bytes":len(b),"gzip":base64.b64encode(gzip.compress(b,9,mtime=0)).decode()}
js="const BUILD="+json.dumps(m,ensure_ascii=False)+";const PAYLOAD="+json.dumps(payload)+";\n"+(R/"app.js").read_text()
assert "</script" not in js.lower()
(R/"qa/bundle.js").write_text(js);subprocess.run(["node","--check",str(R/"qa/bundle.js")],check=True)
template=(R/"index.html").read_text();assert template.count("<!-- SCRIPT -->")==1
html=template.replace("<!-- SCRIPT -->","<script>"+js+"</script>");(R/"preview.html").write_text(html)
m["html"]={"bytes":len(html.encode()),"sha256":sha(html.encode())};m["payloadSHA256"]=sha(b)
(R/"BUILD_MANIFEST.json").write_text(json.dumps(m,ensure_ascii=False,indent=2))
(R/"SUMMARY.json").write_text(json.dumps({"schema":"kaopu/adaptive-contact-summary@1","status":x["status"],"sourceCommit":source,"summary":summary,
 "checks":tests["count"],"motionGate":x["motionGate"],"fullMotionExecuted":False,"productionChanged":False,"rawReportSHA256":sha(raw)},ensure_ascii=False,indent=2))
print(json.dumps({"sourceCommit":source,"html":m["html"],"dataBytes":len(b),"status":x["status"]},indent=2))
