from pathlib import Path
import json,hashlib
p=Path(__file__).resolve().parent
s=(p/'template.html').read_text()
for k,f in [('OPTICS','fiber-optics.js'),('STRUCTURE','structure.js'),('CORE','core.js'),('NATURAL','natural-yarn.js'),('APP','app.js')]:
 assert s.count('/*'+k+'*/')==1
 s=s.replace('/*'+k+'*/',(p/f).read_text())
(p/'index.html').write_text(s)
m={'version':'R06.0','baseCommit':'cca5466b1e58b09a9a5c1ce75ea47ee142eafbcb','entry':'denim-workshop/r06/index.html','bytes':len(s.encode()),'sha256':hashlib.sha256(s.encode()).hexdigest(),'runtimeAssets':0,'color':'linear HDR RGBA16F when supported; linear RGBA8 fallback; final single tone map','scatter':'Jensen dipole radial profile CPU quadrature, local three-tap longitudinal approximation + finite-depth transmission','coefficients':'artist candidates, unmeasured','geometry':'same yarn identities, shared smooth material-coordinate field, finite migrating staples','protected':['perspective','near/mid explicit yarns','no solid side wall','gray studio','background-only haze','retained bridges','clumps/strays','R01-R05 unchanged'],'filmGradeValidated':False,'physicalTearing':False,'realPhoneTest':False,'hardwareFPS':'unverified'}
(p/'BUILD_MANIFEST.json').write_text(json.dumps(m,indent=2));print(json.dumps(m))
