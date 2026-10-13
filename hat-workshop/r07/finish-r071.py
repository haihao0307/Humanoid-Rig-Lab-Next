"""One-time R07.0 -> R07.1 migration; readable modules remain authoritative.
No changes are replayed after R071_APPLIED.json has been written.
"""
from pathlib import Path
import hashlib,json,subprocess
R=Path(__file__).resolve().parent;root=R.parent.parent
if (R/'R071_APPLIED.json').exists():raise SystemExit(0)
p=R/'contact.mjs';s=p.read_text()
assert hashlib.sha256(s.encode()).hexdigest()=='e92ec9d6c862965c23b0a0704dd208f60882f59d8803c6336c0a1090ff57b667','Refusing to overwrite another contact revision'
a=s.index('function sweatband(mesh,cap,hp,band,gap){');b=s.index('\nfunction fitFlatcap',a)
s="import {flatcapSweatband} from './flatcap-facing.mjs';\n"+s[:a]+'const sweatband=flatcapSweatband;\n'+s[b:];p.write_text(s)
p=R/'build.py';p.write_text(p.read_text().replace('HAT-R07.0','HAT-R07.1'))
p=R/'SOURCE_AUTHORITY.json';d=json.loads(p.read_text());d['canonicalRuntime']=sorted(set(d['canonicalRuntime']+['flatcap-facing.mjs']));d['r071Migration']='finish-r071.py is a one-time SHA-256 guarded migration. R071_APPLIED.json prevents replay.';p.write_text(json.dumps(d,indent=2)+'\n')
p=R/'check_distance.py';p.write_text(p.read_text().replace('Numeric geometry is matched byte-for-byte by browser QA.','This audit uses emitted Node geometry; browser-to-Node coordinate agreement is reported independently.'))
p=R/'review.py';s=p.read_text().replace('HAT-R07.0','HAT-R07.1')
s=s.replace('from bs4 import BeautifulSoup','import numpy as np\nfrom bs4 import BeautifulSoup')
s=s.replace("run(['python',str(R/'build.py'),'--source',source])", "run(['node',str(R/'geometry-audit.mjs')])\nrun(['python',str(R/'build.py'),'--source',source])")
needle="            baseline_hashes[key]=[gh,bh];row['geometryHash']=gh;row['bandHash']=bh;report['cases'].append(row)"
assert needle in s
s=s.replace(needle,needle+"\n            if len(report['cases'])<=33:\n                head_id=row['metrics']['headId'];prefix=R/'qa/geometry-dump'/f'{head_id}--{id}--'\n                expected=np.fromfile(str(prefix)+'position.bin','<f4');observed=np.asarray(page.evaluate('hatLab.currentPositions()'),dtype=np.float64)\n                err=float(np.max(np.abs(expected-observed))) if len(expected)==len(observed) else float('inf')\n                check('browser versus Node '+key,err<2e-8,{'maximumPositionErrorM':err})\n                if bh:\n                    expected=np.fromfile(str(prefix)+'band-position.bin','<f4');observed=np.asarray(page.evaluate('hatLab.debugGeometry().sweatband.position'),dtype=np.float64)\n                    err=float(np.max(np.abs(expected-observed))) if len(expected)==len(observed) else float('inf')\n                    check('browser facing versus Node '+key,err<2e-8,{'maximumPositionErrorM':err})")
s=s.replace("        page.evaluate(\"hatLab.select('trilby')\");page.screenshot(path=str(Q/'desktop-workbench.png'))", "        page.evaluate(\"hatLab.select('trilby')\");page.screenshot(path=str(Q/'desktop-workbench.png'))\n        for hi in [0,1,2]:\n            page.evaluate('(head)=>hatLab.set({head})',hi);page.evaluate(\"hatLab.select('flatcap')\");page.evaluate(\"hatLab.frame('inside')\");page.wait_for_timeout(150);page.locator('#canvas').screenshot(path=str(Q/f'flatcap-head-{hi}-inside.png'))\n        page.evaluate('hatLab.set({head:0})');page.evaluate(\"hatLab.select('trilby')\")")
p.write_text(s)
# A separate recipe catalogue is generated from the same production defaults.
js="import fs from 'node:fs';import {categoryPresets,CONSTRUCTION,subtypeDefaults} from './core.mjs';const ids=Object.keys(CONSTRUCTION);fs.writeFileSync('PRESETS.json',JSON.stringify({schema:'kaopu.hat.prepared-presets/7',automaticOnSelection:true,headGeometryModified:false,presets:ids.map(id=>({id,title:categoryPresets(id)[0].title,settings:subtypeDefaults(id),construction:CONSTRUCTION[id]}))},null,2));"
subprocess.run(['node','--input-type=module','-e',js],cwd=R,check=True)
(R/'R071_APPLIED.json').write_text(json.dumps({'fromPublicBuild':'68506928485329ed5be4c78593786a20a3f7da69','version':'HAT-R07.1','change':'Replace bill-biased/capped sweatband attachment by an exact head-centred finite facing','userAccepted':False},indent=2))
for args in [['config','user.name','github-actions[bot]'],['config','user.email','41898282+github-actions[bot]@users.noreply.github.com'],['add','hat-workshop/r07'],['commit','-m','fix(hat-r07): publish readable R07.1 facing correction [skip ci]'],['push','origin','HEAD:fix/hat-r07-seams-crown-switch-20261013']]:subprocess.run(['git',*args],cwd=root,check=True)
