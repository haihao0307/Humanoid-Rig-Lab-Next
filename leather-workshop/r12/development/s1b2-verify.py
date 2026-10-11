"""One-time verification-script edit. This is not part of runtime construction."""
from pathlib import Path
r=Path(__file__).resolve().parents[1]
p=r/'verify.py';s=p.read_text()
s=s.replace("changed={'panels','closed-shell','pattern-physics','assembly-contract','yarn-host'}", "geometry_changed={'panels','closed-shell','pattern-physics','assembly-contract','yarn-host'}\n        app_changed={'app-runtime','view-polish','atelier-controls','craft-ui','lifecycle','input-perf','app-composition'}\n        changed=geometry_changed|app_changed")
s=s.replace("for key in changed]", "for key in geometry_changed]")
s=s.replace("        a=(ROOT/'src/geometry/panels.js').read_text();", "        app_files=[ROOT/manifest['modules'][key]['file'] for key in app_changed]\n        check('Application services have no late reassignment or prototype mutation',all(not re.search(r'(?:\\.prototype\\.|^(?:prepareGrab|selectProduct|setView|updateDetails|updateGrabUI|destroyGeometry|recipe)\\s*=)',p.read_text(),re.M) for p in app_files))\n        check('One explicit composition boot entry',sum(p.read_text().count('boot().catch(fail);') for p in app_files)==1 and 'initializeAppControls();library=new ArtistAtelierMaterials' in (ROOT/'src/app/runtime.js').read_text())\n        a=(ROOT/'src/geometry/panels.js').read_text();")
s=s.replace("b\"const VERSION='R10.0'\"", "b\"const VERSION='R12.0-S1B2'\"")
s=s.replace("env={**os.environ,'BASE_LIB':str(ref/'node-lib.cjs')}", "env={**os.environ,'BASE_LIB':str(ref/'node-lib.cjs'),'BASE_APP_DIR':str(ref/'src/app')}")
s=s.replace("('qa-geometry-equivalence.cjs','qa/s1b/equivalence.json',25)", "('qa-geometry-equivalence.cjs','qa/s1b/equivalence.json',25),('qa-app-interfaces.cjs','qa/s1b2/app-interfaces.json',25)")
s=s.replace("'phase':'S1B1'", "'phase':'S1B2'")
s=s.replace("'interfaceAssertions':3", "'interfaceAssertions':3,'appInterfaceCases':25")
s=s.replace("out=ROOT/'qa/s1b/SUMMARY.json'", "out=ROOT/'qa/s1b2/SUMMARY.json'")
p.write_text(s)
