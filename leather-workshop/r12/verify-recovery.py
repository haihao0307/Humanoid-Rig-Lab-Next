"""S1A recovery probe: verifies checkout-only reconstruction and protects edits."""
import hashlib, importlib.util, json, shutil, sys, tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parent
def load(p,n):
 s=importlib.util.spec_from_file_location(n,p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
def main(repo):
 rows=[]
 def record(n,p):
  rows.append({"name":n,"pass":bool(p)})
  if not p:raise AssertionError(n)
 mat=load(ROOT/"materialize.py","materialization_probe")
 lock=json.loads((ROOT/"migration.lock.json").read_text())
 with tempfile.TemporaryDirectory(prefix="leather-recovery-") as d:
  target=Path(d)/"package";target.mkdir()
  for n in ["build.py","assembly.json","migration.lock.json","materialize.py"]:shutil.copyfile(ROOT/n,target/n)
  result=mat.materialize(Path(repo),target)
  record("Fresh checkout materializes all declared files",result["materializedFiles"]==53)
  b=load(target/"build.py","recovered_source_build");r=b.build()
  record("Recovered standalone has exact R10 bytes",r["byteIdenticalToR10"])
  pick=target/"src/app/runtime.js";old=pick.read_bytes();pick.write_bytes(old+b"\n// LOCAL EDIT\n")
  fail=False
  try:mat.materialize(Path(repo),target)
  except ValueError:fail=True
  record("Re-running migration refuses to overwrite local source edits",fail and pick.read_bytes()!=old)
  bad=Path(d)/"badrepo";q=bad/lock["baseline"];q.parent.mkdir(parents=True);q.write_bytes(b"not the accepted snapshot")
  out=Path(d)/"rejected";fail=False
  try:mat.materialize(bad,out)
  except ValueError:fail=True
  record("Wrong baseline is rejected before materializing any output",fail and not out.exists())
 out=ROOT/"qa/RECOVERY.json";out.parent.mkdir(exist_ok=True)
 data={"scope":"fresh source recovery without chat or historic builder execution","checks":rows,"pass":all(x["pass"]for x in rows),"newBrowserChecks":0}
 out.write_text(json.dumps(data,indent=2)+"\n");return data
if __name__=="__main__":print(json.dumps(main(Path(sys.argv[1]) if len(sys.argv)>1 else ROOT.parents[1]),indent=2))
