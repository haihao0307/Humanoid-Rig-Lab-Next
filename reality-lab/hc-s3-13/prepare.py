from pathlib import Path
import hashlib,json,os
R=Path(__file__).resolve().parent
BASE=Path(os.environ.get("RF313_BASE",str(R.parent/"hc-s3-12")))
STAGE=R/"_runtime";STAGE.mkdir(exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
solver=(BASE/"local-solve.mjs").read_bytes()
assert sha(solver)=="b9b7873d279eacc631b7c358dad71db312ffa42d4f18c12fc2b26e8ef88d53d2"
deps={"rf311-joint-guard.mjs":R.parent/"hc-s3-11/joint-guard.mjs","rf37-contact-probe.mjs":R.parent/"hc-s3-7/contact-probe.mjs"}
if os.environ.get("RF313_TOOLKIT"):
 T=Path(os.environ["RF313_TOOLKIT"])
 deps={"rf311-joint-guard.mjs":T/"hc-s3-11/joint-guard.mjs","rf37-contact-probe.mjs":T/"hc-s3-7/contact-probe.mjs"}
body=Path(os.environ["RF313_MESH_CONTACT"])
assert sha(body.read_bytes())=="0fe9b8e0840c7b35c4ee3fce9b7d648c220043783ad6166314812472ddde8ff3"
deps["mesh-contact.mjs"]=body
for name,path in deps.items():(STAGE/name).write_bytes(path.read_bytes())
(STAGE/"adaptive-preflight.mjs").write_bytes((R/"adaptive-preflight.mjs").read_bytes())
original=solver.decode()
scope="const scopes=[central,Array.from(oneRing).sort((a,b)=>a-b)].filter((v,i,a)=>i===0||v.length!==a[0].length);"
scope_new="const preflight=planScopes(this,central,Array.from(oneRing).sort((a,b)=>a-b),POLICY);const scopes=preflight.eligible;"
rec="mode:this.localMode,scopes:[],accepted:false,continuousCollision:false"
rec_new="mode:this.localMode,preflight,scopes:[],accepted:false,continuousCollision:false"
# Identical passive observers in both variants. Observers receive copies, never original arrays.
end="   if(!solution){const after=this.patch(current,nodes,faces,exact);"
end_new="   this.__trialObserver?.({nodes:[...nodes],faces:[...faces],positions:current.slice(),seed,status:srec.status});\n"+end
cut="     if(!edge.passed||shift>budget+TOLERANCE_M)continue;"
cut_new="     this.__proposalObserver?.({nodes:[...nodes],seed,iteration:iter,scale,edge:{...edge},shift,budget,merit:metrics.merit,maximumResidualM:metrics.maximumResidualM,crossings:metrics.crossing,previousMerit:samples.merit});\n"+cut
for old in [scope,rec,end,cut]:assert original.count(old)==1,old
proof={"passed":True,"sourceSolverSHA256":sha(solver),"sourceBodiesSHA256":sha(body.read_bytes()),"variants":{}}
for mode in ["original","adaptive"]:
 text=original.replace(end,end_new).replace(cut,cut_new)
 if mode=="adaptive":
  text=text.replace(scope,scope_new).replace(rec,rec_new)
  text="import {planScopes} from './adaptive-preflight.mjs';\n"+text
 restored=text
 if mode=="adaptive":
  restored=restored.removeprefix("import {planScopes} from './adaptive-preflight.mjs';\n").replace(scope_new,scope).replace(rec_new,rec)
 restored=restored.replace(end_new,end).replace(cut_new,cut)
 assert restored.encode()==solver
 (STAGE/(mode+"-solver.mjs")).write_text(text)
 proof["variants"][mode]={"removalExact":True,"sha256":sha(text.encode()),"passiveObservation":True,"scopePolicyChanged":mode=="adaptive"}
(R/"qa").mkdir(exist_ok=True)
(R/"qa/ASSEMBLY.json").write_text(json.dumps(proof,indent=2))
print(json.dumps(proof,indent=2))
