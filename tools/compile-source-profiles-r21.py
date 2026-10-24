"""Frozen original states, not interpolated presets or new shape parameters."""
from pathlib import Path
import subprocess,sys,json
root=Path(__file__).resolve().parent.parent
for profile in ['lean','fuller','muscular','female','A-reach','A-joints','B-neutral','B-bend']:
    result=subprocess.run([sys.executable,str(root/'tools/compile-source-atlas-r21.py'),'full',profile],cwd=root,capture_output=True,text=True)
    (root/('qa/fidelity-r21/atlas-'+profile+'-compile.log')).write_text(result.stdout+result.stderr,encoding='utf8')
    if result.returncode:raise RuntimeError('Source profile compiler failed: '+profile)
    data=json.loads((root/('qa/fidelity-r21/offline/atlas-full-'+profile+'.json')).read_text(encoding='utf8'))
    print(json.dumps({'profile':profile,**data['report']}),flush=True)
    if data['report']['unresolved']:raise RuntimeError('Unresolved original regions: '+profile)
