"""Assemble standalone from canonical source. Do not rerun upgrade over edits."""
from pathlib import Path
import hashlib,json
p=Path(__file__).resolve().parent
s=(p/'template.html').read_text()
for key,name in [('CORE','core.js'),('NATURAL','natural-yarn.js'),('APP','app.js')]:
    assert s.count('/*'+key+'*/')==1,key
    s=s.replace('/*'+key+'*/',(p/name).read_text())
(p/'index.html').write_text(s)
m={'version':'R05.0','baseCommit':'1f644eefce4282cf248653c999dedb4cfb9b9955','entry':'denim-workshop/r05/index.html','sha256':hashlib.sha256(s.encode()).hexdigest(),'bytes':len(s.encode()),'renderer':'WebGL2 standalone','runtimeAssets':0,'background':'ray-intersected gray floor and back plane','fog':'background only, distance haze with static low-frequency variation','lighting':'four-sample soft key plus fill and rim; cached PCF depth shadow','shadowMapPixels':{'desktop':1024,'mobileViewport':768},'fiberRepresentation':'real warped yarns, representative exterior sheath curves and tangent-facing fine ribbons; not every cotton fiber','material':'rough cloth diffuse, broad Charlie-like sheen and bounded scatter approximation; not Jensen dipole','invariants':{'perspective':True,'nearMidGeometry':True,'solidSideWall':False,'preservedBridgesAndClumps':True},'limits':{'filmGradeValidated':False,'realPhoneTest':False,'physicalFiberCalibration':False,'physicalTearing':False,'globalSelfCollisionProof':False,'hardwareFPS':'unverified'}}
(p/'BUILD_MANIFEST.json').write_text(json.dumps(m,indent=2));print(json.dumps(m))
