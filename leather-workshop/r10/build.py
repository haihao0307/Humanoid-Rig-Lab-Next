"""Extend the frozen R09 builder without writing any R01-R09 file."""
from pathlib import Path
R=Path(__file__).resolve().parent
s=(R.parent/'r09/build.py').read_text()
s=s.replace("if p.parent==R/'site':return L/'r08/site'/p.name", "if p.parent==R/'site':\n  q=L/'r09/site'/p.name\n  return q if q.exists() else L/'r08/site'/p.name")
s=s.replace("(R/'native/contact.c').read_text()", "adapt('contact.c',(L/'r09/native/contact.c').read_text())")
s=s.replace("(R/'native/energy.c').read_text()", "(L/'r09/native/energy.c').read_text()")
s=s.replace("+mod(R/'site/shell.mjs','ProductShell')", "+'(()=>{'+src(R/'site/broadphase.js')+'})();'+mod(R/'site/shell.mjs','ProductShell')")
s=s.replace("src(R/'site/resource-lifecycle.js')])", "src(R/'site/resource-lifecycle.js'),src(R/'site/interaction-perf.js')])")
s=s.replace("adapt('energy.c',(L/'r09/native/energy.c').read_text()))", "adapt('energy.c',(L/'r09/native/energy.c').read_text())+'\\n'+(R/'native-broadphase.c').read_text())")
s=s.replace("'R09.1'", "'R10.0'").replace("PARENT='f1ab73a7b289461a7d81e65eed935ec62369ed34'", "PARENT='416d2b7a7d7214865fa47b82973450c700a65da9'")
exec(compile(s,str(__file__),'exec'))
